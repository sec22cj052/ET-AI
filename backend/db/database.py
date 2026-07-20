import os
import asyncpg
from typing import Optional

_pool: Optional[asyncpg.Pool] = None

async def init_db_pool():
    global _pool
    db_url = os.getenv("SUPABASE_URL")
    if not db_url:
        raise ValueError("SUPABASE_URL environment variable is not set")
    _pool = await asyncpg.create_pool(dsn=db_url, statement_cache_size=0)

async def close_db_pool():
    global _pool
    if _pool:
        await _pool.close()

async def get_db() -> asyncpg.Connection:
    global _pool
    if not _pool:
        await init_db_pool()
    async with _pool.acquire() as conn:
        yield conn

def get_pool() -> asyncpg.Pool:
    global _pool
    return _pool
