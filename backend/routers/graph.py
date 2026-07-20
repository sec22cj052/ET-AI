from fastapi import APIRouter, Depends, HTTPException
import asyncpg
import json
from typing import List, Dict, Any

from db.database import get_db

router = APIRouter(prefix="/graph", tags=["graph"])

@router.get("/explore")
async def get_full_graph(db: asyncpg.Connection = Depends(get_db)):
    """
    Returns the full knowledge graph (nodes and edges), strictly filtered 
    to entities originating from approved documents.
    Enriched with properties, degree counts, and source document info.
    """
    approved_docs = await db.fetch("SELECT id, filename FROM documents WHERE status = 'approved'")
    approved_doc_ids = [str(d["id"]) for d in approved_docs]
    doc_name_map = {str(d["id"]): d["filename"] for d in approved_docs}
    
    if not approved_doc_ids:
        return {"nodes": [], "edges": []}
        
    entities = await db.fetch(
        "SELECT id, type, name, properties, source_document_id FROM entities WHERE source_document_id = ANY($1)", 
        approved_doc_ids
    )
    
    valid_entity_ids = {str(e["id"]) for e in entities}
    
    # Calculate degree for each entity
    degree_map: Dict[str, int] = {eid: 0 for eid in valid_entity_ids}
    
    edges = []
    if valid_entity_ids:
        relationships = await db.fetch(
            """
            SELECT id, source_id, target_id, relationship_type 
            FROM entity_relationships 
            WHERE source_id = ANY($1) AND target_id = ANY($1)
            """,
            list(valid_entity_ids)
        )
        
        for r in relationships:
            sid = str(r["source_id"])
            tid = str(r["target_id"])
            edges.append({
                "source": sid,
                "target": tid,
                "relationship": r["relationship_type"]
            })
            degree_map[sid] = degree_map.get(sid, 0) + 1
            degree_map[tid] = degree_map.get(tid, 0) + 1

    nodes = []
    for e in entities:
        eid = str(e["id"])
        props = json.loads(e["properties"]) if isinstance(e["properties"], str) else e["properties"]
        doc_id = str(e["source_document_id"])
        nodes.append({
            "id": eid,
            "type": e["type"],
            "label": e["name"],
            "data": props or {},
            "degree": degree_map.get(eid, 0),
            "source_document": doc_name_map.get(doc_id, "Unknown"),
            "source_document_id": doc_id,
        })
            
    return {"nodes": nodes, "edges": edges}


@router.get("/explore/{entity_id}")
async def get_entity_graph(entity_id: str, db: asyncpg.Connection = Depends(get_db)):
    """
    Returns a specific entity node and its 1-hop neighbors, 
    filtered by approved documents. Enriched with properties and degree.
    """
    entity = await db.fetchrow(
        """
        SELECT e.id, e.type, e.name, e.properties, e.source_document_id
        FROM entities e
        JOIN documents d ON e.source_document_id = d.id
        WHERE e.id = $1 AND d.status = 'approved'
        """,
        entity_id
    )
    
    if not entity:
        raise HTTPException(status_code=404, detail="Entity not found or not approved")

    edges_records = await db.fetch(
        """
        WITH approved_entities AS (
            SELECT e.id
            FROM entities e
            JOIN documents d ON e.source_document_id = d.id
            WHERE d.status = 'approved'
        )
        SELECT id, source_id, target_id, relationship_type
        FROM entity_relationships
        WHERE (source_id = $1 OR target_id = $1)
          AND source_id IN (SELECT id FROM approved_entities)
          AND target_id IN (SELECT id FROM approved_entities)
        """,
        entity_id
    )
    
    connected_node_ids = {str(entity["id"])}
    edges = []
    for r in edges_records:
        sid = str(r["source_id"])
        tid = str(r["target_id"])
        connected_node_ids.add(sid)
        connected_node_ids.add(tid)
        edges.append({
            "source": sid,
            "target": tid,
            "relationship": r["relationship_type"]
        })
        
    nodes_records = await db.fetch(
        """
        SELECT e.id, e.type, e.name, e.properties, e.source_document_id, d.filename as doc_filename
        FROM entities e
        JOIN documents d ON e.source_document_id = d.id
        WHERE e.id = ANY($1)
        """, 
        list(connected_node_ids)
    )
    
    # Calculate degree for returned nodes
    degree_map: Dict[str, int] = {}
    for r in edges:
        degree_map[r["source"]] = degree_map.get(r["source"], 0) + 1
        degree_map[r["target"]] = degree_map.get(r["target"], 0) + 1
    
    nodes = []
    for e in nodes_records:
        eid = str(e["id"])
        props = json.loads(e["properties"]) if isinstance(e["properties"], str) else e["properties"]
        nodes.append({
            "id": eid,
            "type": e["type"],
            "label": e["name"],
            "data": props or {},
            "degree": degree_map.get(eid, 0),
            "source_document": e["doc_filename"],
            "source_document_id": str(e["source_document_id"]),
        })
        
    return {"nodes": nodes, "edges": edges}


@router.get("/explore/{entity_id}/documents")
async def get_entity_documents(entity_id: str, db: asyncpg.Connection = Depends(get_db)):
    """Returns all approved documents that contain this entity."""
    docs = await db.fetch(
        """
        SELECT d.id, d.filename, d.type, d.status, d.storage_url
        FROM documents d
        JOIN entities e ON e.source_document_id = d.id
        WHERE e.id = $1 AND d.status = 'approved'
        """,
        entity_id
    )
    return [dict(d) for d in docs]
