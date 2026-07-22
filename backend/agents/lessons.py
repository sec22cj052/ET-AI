"""
Lessons Learned & Failure Intelligence Engine.

Scans incident/near-miss/failure entities for recurring patterns 
and proactively surfaces alerts using Cohere LLM.
"""

from typing import List, Dict, Any
import os
import json

import asyncpg
from langchain_cohere import ChatCohere
from langchain_core.messages import HumanMessage

from shared.citation import format_citations


async def generate_lessons_feed(db: asyncpg.Connection) -> Dict[str, Any]:
    """
    Retrieves all WorkOrder entities from approved documents, along with their related
    Equipment, and prompts the LLM to detect recurring patterns or failures.
    """
    # 1. Fetch all work orders and their associated equipment from the knowledge graph
    work_orders_records = await db.fetch(
        """
        WITH work_orders AS (
            SELECT e.id, e.name as wo_name, e.properties as wo_props, 
                   d.filename, d.storage_url, e.source_page as page_number, d.id as document_id
            FROM entities e
            JOIN documents d ON e.source_document_id = d.id
            WHERE e.type = 'WorkOrder' AND d.status = 'approved'
        )
        SELECT wo.*,
               eq.name as equipment_name
        FROM work_orders wo
        LEFT JOIN entity_relationships er ON (er.source_id = wo.id OR er.target_id = wo.id)
        LEFT JOIN entities eq ON (
            (eq.id = er.target_id AND er.source_id = wo.id AND eq.type = 'Equipment')
            OR (eq.id = er.source_id AND er.target_id = wo.id AND eq.type = 'Equipment')
        )
        """
    )

    if not work_orders_records:
        return {"alerts": []}

    retrieved_items = []
    context_str = "RECENT INCIDENTS & WORK ORDERS:\n"
    
    # Deduplicate work orders (since multiple relationships might return multiple rows)
    seen_wos = set()
    for idx, r in enumerate(work_orders_records):
        if r["id"] not in seen_wos:
            seen_wos.add(r["id"])
            retrieved_items.append(dict(r))
            
            props = json.loads(r["wo_props"]) if isinstance(r["wo_props"], str) else r["wo_props"]
            eq_name = r["equipment_name"] or "Unknown Equipment"
            
            # Format context for LLM with citation index
            citation_idx = len(retrieved_items)
            context_str += f"[{citation_idx}] Record: {r['wo_name']} (Equipment: {eq_name})\n"
            context_str += f"Details: {json.dumps(props)}\n\n"

    citations_metadata = format_citations(retrieved_items)

    # 2. LLM call to detect patterns
    llm = ChatCohere(
        model="command-r-08-2024",
        cohere_api_key=os.getenv("COHERE_API_KEY"),
        temperature=0,
    )

    prompt = f"""You are a Reliability Engineering Agent analyzing maintenance records to detect recurring failures and lessons learned.

Analyze the RECENT INCIDENTS & WORK ORDERS below. Look for patterns across different pieces of equipment (e.g., the same failure mode happening on multiple machines, or happening repeatedly).

{context_str}

Generate a JSON response containing a list of detected alerts/patterns. Only include genuine recurring patterns (happened more than once). If no patterns exist, return an empty list.

Structure your response exactly like this:
{{
  "alerts": [
    {{
      "title": "Short title (e.g., 'Recurring Mechanical Seal Failure')",
      "summary": "Plain-language summary of the pattern you detected.",
      "equipment_affected": ["List", "of", "equipment"],
      "recommendation": "Proactive recommendation to prevent this.",
      "citations": [1, 2] // The bracketed indices of the records that support this pattern
    }}
  ]
}}

Return ONLY valid JSON, no markdown fences or extra text."""

    response = await llm.ainvoke([HumanMessage(content=prompt)])

    # 3. Parse JSON
    try:
        raw = response.content.strip()
        if raw.startswith("```"):
            raw = raw.split("\n", 1)[1]
        if raw.endswith("```"):
            raw = raw.rsplit("```", 1)[0]
        raw = raw.strip()
        result = json.loads(raw)
    except (json.JSONDecodeError, IndexError):
        result = {"alerts": []}

    # Format output to include full citation objects in the alerts
    formatted_alerts = []
    for alert in result.get("alerts", []):
        alert_citations = []
        for c_idx in alert.get("citations", []):
            # Find the citation in the metadata (1-indexed)
            match = next((c for c in citations_metadata if c["index"] == c_idx), None)
            if match:
                alert_citations.append(match)
                
        formatted_alerts.append({
            "title": alert.get("title", "Pattern Detected"),
            "summary": alert.get("summary", ""),
            "equipment_affected": alert.get("equipment_affected", []),
            "recommendation": alert.get("recommendation", ""),
            "citations": alert_citations
        })

    # 4. Compute Attrition Risk (ratio of formal docs to captured tacit notes per equipment)
    attrition_records = await db.fetch("""
        SELECT e.id as equipment_id, e.name as equipment_name,
               COUNT(DISTINCT d.id) as doc_count,
               COUNT(DISTINCT tkn.id) as tacit_note_count
        FROM entities e
        LEFT JOIN documents d ON d.status = 'approved' AND EXISTS (
            SELECT 1 FROM entity_relationships er 
            JOIN entities e2 ON (er.target_id = e.id AND er.source_id = e2.id) OR (er.source_id = e.id AND er.target_id = e2.id)
            WHERE e2.source_document_id = d.id
        ) OR e.source_document_id = d.id
        LEFT JOIN tacit_knowledge_notes tkn ON tkn.equipment_entity_id = e.id
        WHERE e.type = 'Equipment'
        GROUP BY e.id, e.name
    """)
    
    attrition_risk = []
    for r in attrition_records:
        doc_count = r['doc_count']
        tacit_count = r['tacit_note_count']
        
        # Calculate risk score: High if lots of docs but few tacit notes
        # Avoid division by zero
        risk_score = 0
        if doc_count > 0:
            if tacit_count == 0:
                risk_score = 100
            else:
                risk_score = min(100, int((doc_count / (tacit_count + 1)) * 10))
                
        risk_level = "High" if risk_score > 70 else "Medium" if risk_score > 30 else "Low"
        
        if doc_count > 0: # Only care about equipment that has at least some formal documentation
            attrition_risk.append({
                "equipment_id": str(r['equipment_id']),
                "equipment_name": r['equipment_name'],
                "doc_count": doc_count,
                "tacit_note_count": tacit_count,
                "risk_score": risk_score,
                "risk_level": risk_level
            })
            
    # Sort by risk score descending
    attrition_risk.sort(key=lambda x: x['risk_score'], reverse=True)

    return {"alerts": formatted_alerts, "attrition_risk": attrition_risk}
