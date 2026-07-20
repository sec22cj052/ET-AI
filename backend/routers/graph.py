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
    """
    # 1. Fetch approved document IDs
    approved_docs = await db.fetch("SELECT id FROM documents WHERE status = 'approved'")
    approved_doc_ids = [str(d["id"]) for d in approved_docs]
    
    if not approved_doc_ids:
        return {"nodes": [], "edges": []}
        
    # 2. Fetch Entities (Nodes)
    entities = await db.fetch(
        "SELECT id, type, name, properties FROM entities WHERE source_document_id = ANY($1)", 
        approved_doc_ids
    )
    
    valid_entity_ids = {str(e["id"]) for e in entities}
    
    nodes = []
    for e in entities:
        props = json.loads(e["properties"]) if isinstance(e["properties"], str) else e["properties"]
        nodes.append({
            "id": str(e["id"]),
            "type": e["type"],
            "label": e["name"],
            "data": props
        })
        
    # 3. Fetch Relationships (Edges)
    # Only return edges where BOTH source and target are approved entities
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
            edges.append({
                "source": str(r["source_id"]),
                "target": str(r["target_id"]),
                "relationship": r["relationship_type"]
            })
            
    return {"nodes": nodes, "edges": edges}


@router.get("/explore/{entity_id}")
async def get_entity_graph(entity_id: str, db: asyncpg.Connection = Depends(get_db)):
    """
    Returns a specific entity node and its 1-2 hop neighbors, 
    filtered by approved documents.
    """
    # Verify the requested entity belongs to an approved document
    entity = await db.fetchrow(
        """
        SELECT e.id, e.type, e.name, e.properties 
        FROM entities e
        JOIN documents d ON e.source_document_id = d.id
        WHERE e.id = $1 AND d.status = 'approved'
        """,
        entity_id
    )
    
    if not entity:
        raise HTTPException(status_code=404, detail="Entity not found or not approved")
        
    # We need to find valid neighbors (1 hop for now, expandable to 2 hops later if needed)
    # For a scalable graph, traversing 1 hop in SQL is simple.
    # Let's get all relationships where this entity is source or target, 
    # AND the OTHER end is also an approved entity.
    
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
    
    if not edges_records:
        # Node has no approved edges, just return the node
        props = json.loads(entity["properties"]) if isinstance(entity["properties"], str) else entity["properties"]
        return {
            "nodes": [{
                "id": str(entity["id"]),
                "type": entity["type"],
                "label": entity["name"],
                "data": props
            }],
            "edges": []
        }
        
    # Collect all node IDs from the edges (the center node + 1 hop neighbors)
    connected_node_ids = set()
    edges = []
    for r in edges_records:
        connected_node_ids.add(str(r["source_id"]))
        connected_node_ids.add(str(r["target_id"]))
        edges.append({
            "source": str(r["source_id"]),
            "target": str(r["target_id"]),
            "relationship": r["relationship_type"]
        })
        
    # Fetch the node details for all connected_node_ids
    nodes_records = await db.fetch(
        "SELECT id, type, name, properties FROM entities WHERE id = ANY($1)", 
        list(connected_node_ids)
    )
    
    nodes = []
    for e in nodes_records:
        props = json.loads(e["properties"]) if isinstance(e["properties"], str) else e["properties"]
        nodes.append({
            "id": str(e["id"]),
            "type": e["type"],
            "label": e["name"],
            "data": props
        })
        
    return {"nodes": nodes, "edges": edges}
