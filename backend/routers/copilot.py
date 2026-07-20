from fastapi import APIRouter, Depends, Request
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from typing import Optional
import asyncpg
import os
import json
from db.database import get_db
from shared.citation import format_citations
from langchain_cohere import CohereEmbeddings, ChatCohere
from langchain_core.messages import HumanMessage

router = APIRouter(prefix="/query", tags=["copilot"])

class QueryRequest(BaseModel):
    question: str
    session_id: Optional[str] = None

@router.post("/copilot")
async def copilot_query(req: QueryRequest, db: asyncpg.Connection = Depends(get_db)):
    """
    RAG-powered conversational endpoint combining Vector Search and Graph Traversal.
    Strictly filters to approved documents only.
    """
    # 1. Embed question
    embeddings = CohereEmbeddings(model="embed-english-v3.0", cohere_api_key=os.getenv("COHERE_API_KEY"))
    query_vector = await embeddings.aembed_query(req.question)
    
    query_vector_str = "[" + ",".join(map(str, query_vector)) + "]"
    
    # 2. Vector Search (join documents d WHERE status = 'approved')
    # Using <=> for cosine distance in pgvector
    vector_results = await db.fetch("""
        SELECT v.id, v.text, v.page_number, d.filename, d.storage_url, d.id as document_id, (v.embedding <=> $1::vector) as distance
        FROM vector_chunks v
        JOIN documents d ON v.document_id = d.id
        WHERE d.status = 'approved'
        ORDER BY v.embedding <=> $1::vector
        LIMIT 5
    """, query_vector_str)
    
    # Calculate confidence score
    confidence = "Low"
    if vector_results:
        avg_dist = sum(r["distance"] for r in vector_results) / len(vector_results)
        # Cosine distance: lower is better (0 is exact match, 1 is orthogonal)
        if avg_dist < 0.45: confidence = "High"
        elif avg_dist < 0.65: confidence = "Medium"
        
    retrieved_items = [dict(r) for r in vector_results]
    
    # 3. Graph Context (Recursive CTE or 1-Hop traversal)
    doc_ids = list(set([r["document_id"] for r in vector_results]))
    graph_context = []
    if doc_ids:
        # Fetch entities for these docs and their 1-hop relationships to ANY approved entity
        edges = await db.fetch("""
            WITH approved_entities AS (
                SELECT e.id, e.name, e.type
                FROM entities e
                JOIN documents d ON e.source_document_id = d.id
                WHERE d.status = 'approved' AND d.id = ANY($1)
            )
            SELECT src.name as source_name, src.type as source_type, 
                   er.relationship_type, 
                   tgt.name as target_name, tgt.type as target_type
            FROM entity_relationships er
            JOIN approved_entities src ON er.source_id = src.id
            JOIN entities tgt ON er.target_id = tgt.id
            JOIN documents td ON tgt.source_document_id = td.id
            WHERE td.status = 'approved'
        """, doc_ids)
        
        for edge in edges:
            graph_context.append(f"{edge['source_type']} '{edge['source_name']}' is {edge['relationship_type']} {edge['target_type']} '{edge['target_name']}'")
            
    # Remove duplicates from graph context
    graph_context = list(set(graph_context))
    
    citations_metadata = format_citations(retrieved_items)
    
    # Construct Context string for prompt
    context_str = "DOCUMENTS:\n"
    for idx, r in enumerate(retrieved_items):
        context_str += f"[{idx+1}] File: {r['filename']} (Page {r['page_number']})\n{r['text']}\n\n"
        
    if graph_context:
        context_str += "KNOWLEDGE GRAPH RELATIONSHIPS:\n"
        for idx, g in enumerate(graph_context):
            context_str += f"- {g}\n"
            
    # 4. LLM Generation
    llm = ChatCohere(model="command-r-08-2024", cohere_api_key=os.getenv("COHERE_API_KEY"), temperature=0)
    
    prompt = f"""You are an Expert Knowledge Copilot for an industrial maintenance team.
Answer the user's question based strictly on the provided DOCUMENTS and KNOWLEDGE GRAPH RELATIONSHIPS.
Always cite your sources using bracketed indices (e.g., [1], [2]) corresponding to the DOCUMENTS.
Format your answer clearly using Markdown.

CRITICAL INSTRUCTION: If the user's question is completely unrelated to the industrial domain (e.g., general knowledge, politics, "who is the president", chit-chat) or cannot be answered using the provided context, you MUST politely refuse to answer. State that you are an Industrial Knowledge Copilot and can only answer questions related to operations, maintenance, and the provided documents. Do not attempt to guess or provide outside knowledge.

{context_str}

User Question: {req.question}"""

    async def generate_response():
        # First yield the metadata (citations + confidence)
        meta = {
            "citations": citations_metadata,
            "confidence": confidence
        }
        yield f"data: {json.dumps({'type': 'meta', 'data': meta})}\n\n"
        
        # Then stream the tokens
        async for chunk in llm.astream([HumanMessage(content=prompt)]):
            if chunk.content:
                yield f"data: {json.dumps({'type': 'content', 'text': chunk.content})}\n\n"
        
        yield "data: [DONE]\n\n"
        
    return StreamingResponse(generate_response(), media_type="text/event-stream")
