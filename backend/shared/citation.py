from typing import List, Dict, Any

def format_citations(retrieved_items: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    """
    Standardizes citations across all agents (Copilot, RCA, Compliance).
    Maps raw retrieved chunks/entities to a structured citation list.
    """
    citations = []
    for i, item in enumerate(retrieved_items):
        citations.append({
            "index": i + 1, # 1-based indexing for LLM prompting
            "document_id": str(item.get("document_id")) if item.get("document_id") else None,
            "filename": item.get("filename", "Unknown Document"),
            "page": item.get("page_number") or item.get("source_page") or 1,
            "storage_url": item.get("storage_url", "#"),
            "type": item.get("type", "text_chunk"), # Can be 'text_chunk' or 'graph_edge'
        })
    return citations
