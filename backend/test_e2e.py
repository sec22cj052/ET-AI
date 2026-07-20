import os
import time
import requests
import asyncio
import asyncpg
from dotenv import load_dotenv

load_dotenv()

async def check_db_for_document(doc_id):
    conn = await asyncpg.connect(os.getenv("SUPABASE_URL"), statement_cache_size=0)
    
    print(f"\n--- Checking DB for Document {doc_id} ---")
    # Check if doc exists
    doc = await conn.fetchrow("SELECT * FROM documents WHERE id = $1", doc_id)
    if doc:
        print(f"✅ Document found: {doc['filename']} ({doc['type']})")
    
    # Check chunks
    chunks = await conn.fetch("SELECT * FROM vector_chunks WHERE document_id = $1", doc_id)
    print(f"✅ Created {len(chunks)} vector chunks.")
    
    # Check entities
    entities = await conn.fetch("SELECT * FROM entities WHERE source_document_id = $1", doc_id)
    print(f"✅ Extracted {len(entities)} entities.")
    for ent in entities:
        print(f"   - {ent['type']}: {ent['name']}")
        
    await conn.close()

def run_test():
    # 1. Create a dummy Work Order CSV
    csv_content = "WorkOrder,Equipment,Date,Description,AssignedTo\nWO-999,Pump-101,2026-07-17,Replace broken seal due to vibration,John Doe\n"
    csv_path = "dummy_work_order.csv"
    with open(csv_path, "w") as f:
        f.write(csv_content)
        
    print("Dummy CSV created.")

    # 2. Upload to FastAPI
    url = "http://127.0.0.1:8000/ingest/upload"
    try:
        with open(csv_path, "rb") as f:
            files = {"file": ("dummy_work_order.csv", f, "text/csv")}
            data = {"doc_type": "work_order"}
            print("Sending POST request to /ingest/upload...")
            response = requests.post(url, files=files, data=data)
            
        print(f"Response ({response.status_code}):", response.json())
        
        doc_id = response.json().get("document_id")
        
        # 3. Wait for async processing
        print("Waiting 15 seconds for background extraction to finish...")
        time.sleep(15)
        
        # 4. Check DB
        asyncio.run(check_db_for_document(doc_id))
        
    except requests.exceptions.ConnectionError as e:
        print("Error: Could not connect to the FastAPI server. Please ensure 'uvicorn main:app' is running.")
        raise e
    finally:
        if os.path.exists(csv_path):
            os.remove(csv_path)

if __name__ == "__main__":
    run_test()
