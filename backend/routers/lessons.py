from fastapi import APIRouter, Depends
import asyncpg

from db.database import get_db
from agents.lessons import generate_lessons_feed

router = APIRouter(prefix="/agents/lessons", tags=["lessons"])


@router.get("/feed")
async def lessons_feed(db: asyncpg.Connection = Depends(get_db)):
    """
    Returns a proactive feed of recurring failure patterns detected 
    across all approved WorkOrder incident entities.
    """
    result = await generate_lessons_feed(db)
    return result
