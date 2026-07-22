from fastapi import APIRouter, UploadFile, File, Form, Depends, HTTPException
import os
import uuid
import asyncpg
import json
from datetime import datetime

from db.database import get_db
from ingestion.parse import parse_pdf, parse_csv_or_excel
from ingestion.extract import extract_entities_from_text, generate_document_summary
from ingestion.chunk_embed import chunk_text, embed_chunks
from ingestion.confidence import calculate_confidence_score
from ingestion.confidence_score import compute_entity_confidence

from pydantic import BaseModel
from typing import List, Optional
from supabase import create_client, Client

SUPABASE_API_URL = os.getenv("SUPABASE_API_URL")
SUPABASE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY")
supabase: Client | None = None
if SUPABASE_API_URL and SUPABASE_KEY:
    supabase = create_client(SUPABASE_API_URL, SUPABASE_KEY)

router = APIRouter(prefix="/ingest", tags=["ingestion"])

class ChunkUpdate(BaseModel):
    text: str

class ImproveRequest(BaseModel):
    feedback: str

class ReviewActionRequest(BaseModel):
    action: str
    reason_code: str

class PlantManagerDecisionRequest(BaseModel):
    decision: str

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

        # Collect full text for summary generation
        full_text = "\n\n".join(p["text"] for p in pages if p.get("text"))
            
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
                # Calculate confidence metrics
                conf_data = await compute_entity_confidence(db, ent, text, extracted_data.get("document_type_confidence", 0.5))
                
                # Check if exists
                existing_id = await db.fetchval("SELECT id FROM entities WHERE name = $1", ent["name"])
                if existing_id:
                    ent_id = existing_id
                else:
                    ent_id = str(uuid.uuid4())
                    await db.execute(
                        """
                        INSERT INTO entities (
                            id, type, name, properties, source_document_id, source_page, 
                            confidence_composite, confidence_breakdown, criticality, 
                            review_status, rule_violations, required_approval_level
                        )
                        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
                        """,
                        ent_id, ent["type"], ent["name"], json.dumps(ent["properties"]), 
                        document_id, ent["source_page"],
                        conf_data["confidence_composite"], json.dumps(conf_data["confidence_breakdown"]),
                        conf_data["criticality"], conf_data["review_status"], json.dumps(conf_data["rule_violations"]),
                        conf_data["required_approval_level"]
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
                
        # Generate AI summary for HITL review
        summary = ""
        if full_text.strip():
            summary = await generate_document_summary(full_text)

        await db.execute(
            "UPDATE documents SET status = 'pending_review', summary = $2 WHERE id = $1", 
            document_id, summary
        )
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
        
    # Upload to Supabase Storage
    storage_url = f"http://localhost:8000/files/{doc_id}_{file.filename}"
    if supabase:
        try:
            with open(file_path, 'rb') as f:
                supabase.storage.from_('industrial-documents').upload(
                    path=f"{doc_id}_{file.filename}", 
                    file=f,
                    file_options={"content-type": file.content_type}
                )
            storage_url = supabase.storage.from_('industrial-documents').get_public_url(f"{doc_id}_{file.filename}")
        except Exception as e:
            print(f"Failed to upload to Supabase Storage: {e}")
            # fallback to local url if supabase fails

    # Insert into DB
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
    doc = await db.fetchrow("SELECT id, filename, type, upload_date, storage_url, status, summary FROM documents WHERE id = $1", document_id)
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
        
    # Calculate confidence score
    confidence = await calculate_confidence_score(document_id, db)

    return {
        "document": dict(doc),
        "entities": parsed_entities,
        "chunks": [dict(c) for c in chunks],
        "confidence": confidence
    }

@router.get("/{document_id}/confidence")
async def get_document_confidence(document_id: str, db: asyncpg.Connection = Depends(get_db)):
    """Returns the rules-based confidence score for a document."""
    doc = await db.fetchrow("SELECT id FROM documents WHERE id = $1", document_id)
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")
    return await calculate_confidence_score(document_id, db)

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

@router.put("/entity/{entity_id}/review-action")
async def review_action(entity_id: str, req: ReviewActionRequest, db: asyncpg.Connection = Depends(get_db)):
    if req.action not in ["approve", "correct", "mark_not_present", "escalate"]:
        raise HTTPException(status_code=400, detail="Invalid action")
        
    status = "sme_approved" if req.action == "approve" else \
             "corrected" if req.action == "correct" else \
             "rejected" if req.action == "mark_not_present" else "escalated"
             
    if req.action == "escalate":
        await db.execute("UPDATE entities SET review_status = 'needs_review', required_approval_level = 3 WHERE id = $1", entity_id)
    else:
        await db.execute("UPDATE entities SET review_status = $1, is_locked = true WHERE id = $2", status, entity_id)
        
    return {
        "entity_id": entity_id,
        "review_status": status if req.action != "escalate" else "needs_review",
        "reviewer": "SME-1",
        "timestamp": datetime.utcnow().isoformat()
    }

@router.get("/plant-manager/inbox")
async def get_plant_manager_inbox(db: asyncpg.Connection = Depends(get_db)):
    rows = await db.fetch("""
        SELECT e.id as entity_id, e.name as equipment_tag, d.filename as document_filename, 
               e.rule_violations
        FROM entities e
        JOIN documents d ON e.source_document_id = d.id
        WHERE e.required_approval_level = 3 AND e.review_status = 'needs_review'
    """)
    
    items = []
    for r in rows:
        violations = json.loads(r["rule_violations"]) if isinstance(r["rule_violations"], str) else (r["rule_violations"] or [])
        items.append({
            "entity_id": str(r["entity_id"]),
            "equipment_tag": r["equipment_tag"],
            "document_filename": r["document_filename"],
            "plain_language_summary": f"This requires Level 3 sign-off. Reason: {', '.join(violations) if violations else 'Escalated by SME'}",
            "flagged_reason": violations[0] if violations else "escalated"
        })
        
    return {
        "items": items,
        "corrected_this_week": 4, # Mock data for trend widget
        "passed_clean_this_week": 27
    }

@router.put("/plant-manager/inbox/{entity_id}/decide")
async def plant_manager_decide(entity_id: str, req: PlantManagerDecisionRequest, db: asyncpg.Connection = Depends(get_db)):
    if req.decision not in ["confirm", "send_back"]:
        raise HTTPException(status_code=400, detail="Invalid decision")
        
    status = "published" if req.decision == "confirm" else "rejected"
    await db.execute("UPDATE entities SET review_status = $1, is_locked = true WHERE id = $2", status, entity_id)
    
    return {
        "entity_id": entity_id,
        "review_status": status,
        "decided_by": "Plant-Manager-1",
        "timestamp": datetime.utcnow().isoformat()
    }
