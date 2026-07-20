from fastapi import APIRouter, Depends, HTTPException
import asyncpg

from db.database import get_db
from agents.rca import generate_rca_report, get_high_risk_equipment

router = APIRouter(prefix="/agents", tags=["agents"])


@router.get("/rca/high-risk")
async def high_risk_equipment(db: asyncpg.Connection = Depends(get_db)):
    """
    Returns all equipment ranked by maintenance/failure incident count.
    Used to populate the high-risk equipment dashboard.
    """
    equipment_list = await get_high_risk_equipment(db)
    return {"equipment": equipment_list}


@router.get("/rca/{equipment_name}")
async def rca_report(equipment_name: str, db: asyncpg.Connection = Depends(get_db)):
    """
    Generates a structured Root Cause Analysis report for the given equipment.
    Pulls full history via graph traversal and generates the report using Cohere LLM.
    """
    result = await generate_rca_report(equipment_name, db)
    if result is None:
        raise HTTPException(
            status_code=404,
            detail=f"Equipment '{equipment_name}' not found in approved documents",
        )
    return result
