import os
from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel, Field
from typing import List, Optional
from db.database import get_db
import asyncpg
from ingestion.chunk_embed import get_embeddings_model

router = APIRouter(prefix="/tacit-knowledge", tags=["Tacit Knowledge"])

class TacitNoteCreate(BaseModel):
    equipment_id: str
    contributor_name: str
    contributor_role: str
    content_text: str
    capture_context: str = "quick_capture"
    audio_storage_url: Optional[str] = None
    capture_method: str = "text"

class TacitNoteResponse(BaseModel):
    id: str
    equipment_entity_id: str
    contributor_name: str
    contributor_role: str
    capture_method: str
    content_text: str
    capture_context: str
    trust_tier: str
    created_at: str

class ExitInterviewSubmit(BaseModel):
    equipment_id: str
    contributor_name: str
    contributor_role: str
    answers: List[dict] # [{"question": "...", "answer": "..."}]

class VerifyRequest(BaseModel):
    trust_tier: str # 'peer_reviewed' | 'sme_verified'

@router.post("/capture")
async def capture_tacit_note(note: TacitNoteCreate, conn: asyncpg.Connection = Depends(get_db)):
    # 1. Insert note
    row = await conn.fetchrow("""
        INSERT INTO tacit_knowledge_notes (
            equipment_entity_id, contributor_name, contributor_role, 
            capture_method, content_text, audio_storage_url, capture_context
        ) VALUES ($1, $2, $3, $4, $5, $6, $7)
        RETURNING id
    """, note.equipment_id, note.contributor_name, note.contributor_role, 
         note.capture_method, note.content_text, note.audio_storage_url, note.capture_context)
    
    note_id = row['id']

    # 2. Embed the content text
    model = get_embeddings_model()
    embeddings = await model.aembed_documents([note.content_text])
    embedding = embeddings[0]

    # 3. Insert into vector_chunks
    # We pass None for document_id since this chunk is tied to a tacit note
    await conn.execute("""
        INSERT INTO vector_chunks (
            text, embedding, source_type, tacit_note_id
        ) VALUES ($1, $2, 'tacit_knowledge', $3)
    """, note.content_text, f"[{','.join(map(str, embedding))}]", note_id)

    return {"message": "Captured", "note_id": note_id}

@router.put("/{note_id}/verify")
async def verify_tacit_note(note_id: str, req: VerifyRequest, conn: asyncpg.Connection = Depends(get_db)):
    if req.trust_tier not in ['peer_reviewed', 'sme_verified']:
        raise HTTPException(status_code=400, detail="Invalid trust_tier")
        
    res = await conn.execute("UPDATE tacit_knowledge_notes SET trust_tier = $1 WHERE id = $2", req.trust_tier, note_id)
    if res == "UPDATE 0":
        raise HTTPException(status_code=404, detail="Note not found")
    
    return {"message": "Verified", "trust_tier": req.trust_tier}

@router.get("/{equipment_id}", response_model=List[TacitNoteResponse])
async def get_tacit_notes(equipment_id: str, conn: asyncpg.Connection = Depends(get_db)):
    rows = await conn.fetch("""
        SELECT * FROM tacit_knowledge_notes 
        WHERE equipment_entity_id = $1
        ORDER BY created_at DESC
    """, equipment_id)
    
    return [dict(r, id=str(r['id']), equipment_entity_id=str(r['equipment_entity_id']), created_at=str(r['created_at'])) for r in rows]

@router.get("/exit-interview-template/{equipment_type}")
async def get_exit_interview_template(equipment_type: str):
    return {
        "prompts": [
            "What do you check on this equipment that isn't in the manual?",
            "What has failed before that surprised you?",
            "What would you tell your replacement on day one?"
        ]
    }

@router.post("/exit-interview-submit")
async def submit_exit_interview(submission: ExitInterviewSubmit, conn: asyncpg.Connection = Depends(get_db)):
    model = get_embeddings_model()
    
    note_ids = []
    for qa in submission.answers:
        q = qa.get("question", "")
        a = qa.get("answer", "")
        if not a: continue
        
        content = f"Q: {q}\nA: {a}"
        
        row = await conn.fetchrow("""
            INSERT INTO tacit_knowledge_notes (
                equipment_entity_id, contributor_name, contributor_role, 
                capture_method, content_text, capture_context
            ) VALUES ($1, $2, $3, 'text', $4, 'exit_interview')
            RETURNING id
        """, submission.equipment_id, submission.contributor_name, submission.contributor_role, content)
        
        note_id = row['id']
        note_ids.append(note_id)
        
        embeddings = await model.aembed_documents([content])
        embedding = embeddings[0]
        
        await conn.execute("""
            INSERT INTO vector_chunks (
                text, embedding, source_type, tacit_note_id
            ) VALUES ($1, $2, 'tacit_knowledge', $3)
        """, content, f"[{','.join(map(str, embedding))}]", note_id)
        
    return {"message": "Exit interview submitted", "note_ids": note_ids}
