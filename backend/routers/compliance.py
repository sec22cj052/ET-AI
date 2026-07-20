from fastapi import APIRouter, Depends, UploadFile, File, Form
from typing import Optional
import asyncpg

from db.database import get_db
from agents.compliance import run_compliance_check

router = APIRouter(prefix="/agents/compliance", tags=["compliance"])


@router.post("/check")
async def compliance_check(
    procedure_text: str = Form(None),
    equipment_name: Optional[str] = Form(None),
    file: Optional[UploadFile] = File(None),
    db: asyncpg.Connection = Depends(get_db),
):
    """
    Compares an uploaded procedure (text or file) against stored regulatory
    standards and flags gaps/deviations with citations.
    Accepts either raw text via `procedure_text` or an uploaded file.
    """
    text = procedure_text or ""

    # If a file was uploaded, read its text content
    if file and not text:
        content = await file.read()
        text = content.decode("utf-8", errors="ignore")

    if not text.strip():
        return {"error": "No procedure text provided. Submit text or upload a file."}

    result = await run_compliance_check(text, equipment_name, db)
    return result
