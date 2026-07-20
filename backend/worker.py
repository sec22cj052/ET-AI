import asyncio
import asyncpg
import os
from db.database import get_db, get_pool
from routers.ingest import process_document_background

# We'll use the main DB pool, but we must ensure it's initialized before the worker uses it.

async def document_worker():
    print("Started background document worker. Throttling active (2s delay).")
    
    # Wait briefly to let the main app fully initialize the DB pool
    await asyncio.sleep(2)
    
    from db.database import get_pool
    pool = get_pool()
    if not pool:
        print("Worker failed to start: DB pool not initialized.")
        return

    while True:
        try:
            pool = get_pool()
            async with pool.acquire() as conn:
                # 1. Find the oldest 'processing' document and lock it
                # We use FOR UPDATE SKIP LOCKED to prevent multiple workers (if we ever scale)
                # from grabbing the same row. We set it to 'processing_active' explicitly.
                row = await conn.fetchrow(
                    """
                    SELECT id, storage_path, type 
                    FROM documents 
                    WHERE status = 'processing' 
                    ORDER BY upload_date ASC 
                    FOR UPDATE SKIP LOCKED 
                    LIMIT 1
                    """
                )
                
                if row:
                    doc_id = row['id']
                    file_path = row['storage_path']
                    doc_type = row['type']
                    
                    # Update status to processing_active so it's not picked up again
                    await conn.execute("UPDATE documents SET status = 'processing_active' WHERE id = $1", doc_id)
                    print(f"Worker picked up document {doc_id} for processing.")
                else:
                    doc_id = None
            
            if doc_id:
                # 2. Process the document using the existing pipeline
                # We do this using a fresh connection from the pool so we don't hold the lock during LLM calls
                async with pool.acquire() as conn:
                    await process_document_background(doc_id, file_path, doc_type, conn)
                
                # 3. Throttle lightly to avoid Cohere limits
                # If we processed a document, wait 2 seconds before doing anything else
                print(f"Worker finished {doc_id}, sleeping 2s for rate limits...")
                await asyncio.sleep(2)
            else:
                # 4. No documents found, sleep lightly
                await asyncio.sleep(5)
                
        except Exception as e:
            print(f"Worker loop encountered an error: {e}")
            await asyncio.sleep(10) # Backoff on error
