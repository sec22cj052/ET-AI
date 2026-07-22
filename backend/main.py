import os
from fastapi import FastAPI, Request, HTTPException
from fastapi.responses import FileResponse
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
from routers.auth import router as auth_router
from routers.tacit import router as tacit_router
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
app.include_router(auth_router)
app.include_router(ingest_router)
app.include_router(graph_router)
app.include_router(copilot_router)
app.include_router(rca_router)
app.include_router(compliance_router)
app.include_router(lessons_router)
app.include_router(tacit_router)

# Serve the React Frontend SPA
frontend_dist = os.path.join(os.path.dirname(__file__), "../frontend/dist")
if os.path.isdir(frontend_dist):
    # Mount the /assets folder from Vite
    assets_path = os.path.join(frontend_dist, "assets")
    if os.path.isdir(assets_path):
        app.mount("/assets", StaticFiles(directory=assets_path), name="frontend-assets")
        
    # Optional: mount public folder items like vite.svg if they exist
    # If there are other static files in dist root (like favicon.ico), 
    # we could mount them individually or use a custom middleware. 
    # For simplicity, we'll serve the main ones:
    
    @app.get("/{full_path:path}")
    async def serve_frontend(full_path: str):
        # Exclude known backend prefixes (if they were missed by routers)
        if full_path.startswith("api/") or full_path.startswith("docs") or full_path.startswith("openapi.json"):
            raise HTTPException(status_code=404, detail="Not Found")
            
        # Serve favicon if requested
        if full_path == "vite.svg" or full_path.endswith(".ico") or full_path.endswith(".png") or full_path.endswith(".webmanifest"):
            file_path = os.path.join(frontend_dist, full_path)
            if os.path.exists(file_path):
                return FileResponse(file_path)
                
        # For all other routes, serve the React index.html for SPA routing
        index_path = os.path.join(frontend_dist, "index.html")
        if os.path.exists(index_path):
            return FileResponse(index_path)
        return {"message": "Frontend build not found"}
else:
    @app.get("/")
    async def root():
        return {"message": "Industrial Knowledge Intelligence Platform API is running. (Frontend not built)"}
