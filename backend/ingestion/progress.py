import json
from datetime import datetime, timezone
import asyncpg

async def set_step(db: asyncpg.Connection, document_id: str, step: str, status: str, detail: str = None):
    entry = {
        "step": step, 
        "status": status, 
        "detail": detail,
        "at": datetime.now(timezone.utc).isoformat()
    }
    
    await db.execute(
        """
        UPDATE documents
        SET current_step = $1, 
            step_status = $2, 
            step_detail = $3,
            step_history = COALESCE(step_history, '[]'::jsonb) || $4::jsonb
        WHERE id = $5
        """,
        step, status, detail, json.dumps([entry]), document_id
    )
