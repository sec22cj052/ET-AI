from fastapi import APIRouter, UploadFile, File, Form, Depends, HTTPException
import os
import uuid
import asyncpg
import json
from datetime import datetime

from db.database import get_db
from ingestion.parse import parse_pdf, parse_csv_or_excel
from ingestion.extract import extract_entities_from_text
from ingestion.chunk_embed import chunk_text, embed_chunks

from pydantic import BaseModel
from typing import List, Optional

router = APIRouter(prefix="/ingest", tags=["ingestion"])

class ChunkUpdate(BaseModel):
    text: str

class ImproveRequest(BaseModel):
    feedback: str

async def process_document_background(
    document_id: str, 
    file_path: str, 
    doc_type: str, 
    db: asyncpg.Connection
):
    try:
        # 1. Parse Document
        pages = []
        ext = file_path.lower()
        if ext.endswith('.pdf'):
            pages = await parse_pdf(file_path)
        elif ext.endswith('.csv'):
            pages = await parse_csv_or_excel(file_path, is_excel=False)
        elif ext.endswith('.xlsx'):
            pages = await parse_csv_or_excel(file_path, is_excel=True)
        elif ext.endswith('.png') or ext.endswith('.jpg') or ext.endswith('.jpeg') or ext.endswith('.webp'):
            from ingestion.parse import parse_image
            pages = await parse_image(file_path)
        else:
            print(f"Unsupported file type for async processing: {file_path}")
            return
            
        # 2. Extract Entities & Chunk/Embed
        for page in pages:
            text = page["text"]
            page_num = page["page_number"]
            
            # Extract
            extracted_data = await extract_entities_from_text(text, page_num)
            entities = extracted_data["entities"]
            relationships = extracted_data["relationships"]
            
            name_to_uuid = {}
            
            # Upsert entities (match on name to avoid duplicates in KG)
            for ent in entities:
                # Check if exists
                existing_id = await db.fetchval("SELECT id FROM entities WHERE name = $1", ent["name"])
                if existing_id:
                    ent_id = existing_id
                else:
                    ent_id = str(uuid.uuid4())
                    await db.execute(
                        """
                        INSERT INTO entities (id, type, name, properties, source_document_id, source_page)
                        VALUES ($1, $2, $3, $4, $5, $6)
                        """,
                        ent_id, ent["type"], ent["name"], json.dumps(ent["properties"]), 
                        document_id, ent["source_page"]
                    )
                name_to_uuid[ent["name"]] = ent_id
                
            # Insert relationships
            for rel in relationships:
                source_id = name_to_uuid.get(rel["source_name"])
                target_id = name_to_uuid.get(rel["target_name"])
                
                # If we couldn't resolve the UUID in this chunk, try global DB lookup
                if not source_id:
                    source_id = await db.fetchval("SELECT id FROM entities WHERE name = $1", rel["source_name"])
                if not target_id:
                    target_id = await db.fetchval("SELECT id FROM entities WHERE name = $1", rel["target_name"])
                    
                if source_id and target_id:
                    rel_id = str(uuid.uuid4())
                    await db.execute(
                        """
                        INSERT INTO entity_relationships (id, source_id, target_id, relationship_type)
                        VALUES ($1, $2, $3, $4)
                        """,
                        rel_id, source_id, target_id, rel["relationship_type"]
                    )
            
            # Chunk and Embed
            chunks = chunk_text(text)
            embedded_chunks = await embed_chunks(chunks)
            
            for chunk in embedded_chunks:
                # Store in db
                await db.execute(
                    """
                    INSERT INTO vector_chunks (document_id, text, embedding, page_number)
                    VALUES ($1, $2, $3, $4)
                    """,
                    document_id, chunk["text"], json.dumps(chunk["embedding"]), page_num
                )
                
        await db.execute("UPDATE documents SET status = 'pending_review' WHERE id = $1", document_id)
        print(f"Successfully processed document {document_id}")
    except Exception as e:
        print(f"Failed to process document {document_id}: {e}")
        await db.execute("UPDATE documents SET status = 'failed' WHERE id = $1", document_id)

@router.post("/upload")
async def upload_document(
    file: UploadFile = File(...),
    doc_type: str = Form(...),
    db: asyncpg.Connection = Depends(get_db)
):
    if doc_type not in ["manual", "work_order", "pid", "standard", "safety_procedure"]:
        raise HTTPException(status_code=400, detail="Invalid document type")
        
    doc_id = str(uuid.uuid4())
    upload_dir = "uploads"
    os.makedirs(upload_dir, exist_ok=True)
    
    file_path = os.path.join(upload_dir, f"{doc_id}_{file.filename}")
    
    with open(file_path, "wb") as f:
        content = await file.read()
        f.write(content)
        
    # Insert into DB
    storage_url = f"http://localhost:8000/files/{doc_id}_{file.filename}"
    await db.execute(
        """
        INSERT INTO documents (id, filename, type, storage_path, storage_url, status)
        VALUES ($1, $2, $3, $4, $5, 'processing')
        """,
        doc_id, file.filename, doc_type, file_path, storage_url
    )
    
    # Process in background by worker
    # Worker will pick up any document with status = 'processing'
    
    return {
        "document_id": doc_id,
        "filename": file.filename,
        "status": "processing",
        "storage_url": storage_url
    }

@router.get("/list")
async def list_documents(db: asyncpg.Connection = Depends(get_db)):
    rows = await db.fetch("SELECT id, filename, type, upload_date, storage_url, status FROM documents ORDER BY upload_date DESC")
    return [dict(r) for r in rows]


@router.get("/{document_id}/review")
async def get_document_review(document_id: str, db: asyncpg.Connection = Depends(get_db)):
    doc = await db.fetchrow("SELECT id, filename, type, upload_date, storage_url, status FROM documents WHERE id = $1", document_id)
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")
        
    entities = await db.fetch("SELECT id, type, name, properties, source_page FROM entities WHERE source_document_id = $1", document_id)
    chunks = await db.fetch("SELECT id, text, page_number FROM vector_chunks WHERE document_id = $1", document_id)
    
    # Need to parse jsonb correctly for properties
    parsed_entities = []
    for e in entities:
        d = dict(e)
        d["properties"] = json.loads(d["properties"]) if isinstance(d["properties"], str) else d["properties"]
        parsed_entities.append(d)
        
    return {
        "document": dict(doc),
        "entities": parsed_entities,
        "chunks": [dict(c) for c in chunks]
    }

@router.put("/{document_id}/approve")
async def approve_document(document_id: str, db: asyncpg.Connection = Depends(get_db)):
    await db.execute("UPDATE documents SET status = 'approved' WHERE id = $1", document_id)
    return {"status": "approved"}

@router.put("/chunk/{chunk_id}")
async def update_chunk(chunk_id: str, update: ChunkUpdate, db: asyncpg.Connection = Depends(get_db)):
    # Generate new embedding for the updated text
    embedded = await embed_chunks([{"text": update.text}])
    embedding = embedded[0]["embedding"]
    
    await db.execute(
        "UPDATE vector_chunks SET text = $1, embedding = $2, is_locked = true WHERE id = $3",
        update.text, json.dumps(embedding), chunk_id
    )
    return {"status": "success"}

@router.post("/{document_id}/improve")
async def improve_extraction(document_id: str, req: ImproveRequest, db: asyncpg.Connection = Depends(get_db)):
    doc = await db.fetchrow("SELECT * FROM documents WHERE id = $1", document_id)
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")
        
    # Delete existing UNLOCKED entities and chunks
    await db.execute("DELETE FROM entities WHERE source_document_id = $1 AND is_locked = false", document_id)
    await db.execute("DELETE FROM vector_chunks WHERE document_id = $1 AND is_locked = false", document_id)
    await db.execute("UPDATE documents SET status = 'processing' WHERE id = $1", document_id)
    
    # Worker will automatically pick this up because status is now 'processing'
    
    return {"status": "re-processing", "message": "Feedback received. Re-extracting with AI."}
