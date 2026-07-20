import os
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from dotenv import load_dotenv

import asyncio
from db.database import init_db_pool, close_db_pool
from routers.ingest import router as ingest_router
from routers.graph import router as graph_router
from routers.copilot import router as copilot_router
from routers.rca import router as rca_router
from routers.compliance import router as compliance_router
from routers.lessons import router as lessons_router
from worker import document_worker

load_dotenv()

app = FastAPI(title="Industrial Knowledge Intelligence API")

# Serve uploaded files at /files/<filename> so citation links work
UPLOAD_DIR = "uploads"
os.makedirs(UPLOAD_DIR, exist_ok=True)
app.mount("/files", StaticFiles(directory=UPLOAD_DIR), name="files")

# Setup CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"], # In production, restrict this to frontend URL
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.on_event("startup")
async def startup_event():
    print("Initializing Database Pool...")
    await init_db_pool()
    
    print("Starting background worker task...")
    app.state.worker_task = asyncio.create_task(document_worker())

@app.on_event("shutdown")
async def shutdown_event():
    print("Cancelling background worker task...")
    if hasattr(app.state, "worker_task"):
        app.state.worker_task.cancel()
    
    print("Closing Database Pool...")
    await close_db_pool()

# Include routers
app.include_router(ingest_router)
app.include_router(graph_router)
app.include_router(copilot_router)
app.include_router(rca_router)
app.include_router(compliance_router)
app.include_router(lessons_router)

@app.get("/")
async def root():
    return {"message": "Industrial Knowledge Intelligence Platform API is running"}
