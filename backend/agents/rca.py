"""
Maintenance Intelligence & Root Cause Analysis Agent.

Pulls full equipment history (work orders, manuals, inspections) via graph traversal
and generates structured RCA reports with citations using Cohere LLM.
"""

from typing import List, Dict, Any
import os
import json

import asyncpg
from langchain_cohere import CohereEmbeddings, ChatCohere
from langchain_core.messages import HumanMessage

from shared.citation import format_citations


async def get_equipment_history(
    equipment_name: str, db: asyncpg.Connection
) -> Dict[str, Any]:
    """
    Retrieves full history for a given equipment entity:
    - The equipment entity itself
    - All 1-hop connected entities (work orders, components, procedures, standards)
    - All vector chunks from documents related to this equipment
    Returns structured data ready for the RCA prompt.
    """
    # 1. Find the equipment entity (approved docs only)
    equipment = await db.fetchrow(
        """
        SELECT e.id, e.type, e.name, e.properties, e.source_document_id, e.source_page
        FROM entities e
        JOIN documents d ON e.source_document_id = d.id
        WHERE e.name = $1 AND d.status = 'approved'
        LIMIT 1
        """,
        equipment_name,
    )

    if not equipment:
        return None

    equipment_id = str(equipment["id"])

    # 2. Get all 1-hop relationships (both directions)
    related_entities = await db.fetch(
        """
        SELECT e.id, e.type, e.name, e.properties, e.source_page,
               er.relationship_type,
               d.filename, d.storage_url, d.id as document_id
        FROM entity_relationships er
        JOIN entities e ON (
            (er.target_id = e.id AND er.source_id = $1)
            OR (er.source_id = e.id AND er.target_id = $1)
        )
        JOIN documents d ON e.source_document_id = d.id
        WHERE d.status = 'approved'
        """,
        equipment_id,
    )

    # 3. Collect all document IDs related to this equipment
    doc_ids = set()
    doc_ids.add(str(equipment["source_document_id"]))
    for ent in related_entities:
        doc_ids.add(str(ent["document_id"]))

    # 4. Pull all vector chunks from those documents
    chunks = await db.fetch(
        """
        SELECT v.id, v.text, v.page_number,
               d.filename, d.storage_url, d.id as document_id
        FROM vector_chunks v
        JOIN documents d ON v.document_id = d.id
        WHERE d.id = ANY($1) AND d.status = 'approved'
        ORDER BY d.filename, v.page_number
        """,
        list(doc_ids),
    )

    return {
        "equipment": dict(equipment),
        "related_entities": [dict(e) for e in related_entities],
        "chunks": [dict(c) for c in chunks],
    }


async def generate_rca_report(
    equipment_name: str, db: asyncpg.Connection
) -> Dict[str, Any]:
    """
    Generates a structured Root Cause Analysis report for the given equipment
    using retrieved history + Cohere LLM.
    """
    history = await get_equipment_history(equipment_name, db)
    if not history:
        return None

    equipment = history["equipment"]
    related = history["related_entities"]
    chunks = history["chunks"]

    # Build context for LLM
    retrieved_items = [dict(c) for c in chunks]
    citations_metadata = format_citations(retrieved_items)

    context_str = "EQUIPMENT PROFILE:\n"
    props = (
        json.loads(equipment["properties"])
        if isinstance(equipment["properties"], str)
        else equipment["properties"]
    )
    context_str += f"Name: {equipment['name']}, Type: {equipment['type']}\n"
    context_str += f"Properties: {json.dumps(props)}\n\n"

    context_str += "RELATED ENTITIES (from Knowledge Graph):\n"
    for ent in related:
        ent_props = (
            json.loads(ent["properties"])
            if isinstance(ent["properties"], str)
            else ent["properties"]
        )
        context_str += (
            f"- [{ent['relationship_type']}] {ent['type']} '{ent['name']}'"
            f" (Source: {ent['filename']}, Page {ent['source_page']})"
            f" Properties: {json.dumps(ent_props)}\n"
        )

    context_str += "\nDOCUMENT CHUNKS:\n"
    for idx, chunk in enumerate(chunks):
        context_str += (
            f"[{idx + 1}] File: {chunk['filename']} (Page {chunk['page_number']})\n"
            f"{chunk['text']}\n\n"
        )

    # LLM call
    llm = ChatCohere(
        model="command-r-08-2024",
        cohere_api_key=os.getenv("COHERE_API_KEY"),
        temperature=0,
    )

    prompt = f"""You are a Maintenance Intelligence Agent performing a Root Cause Analysis (RCA) for industrial equipment.

Based on the EQUIPMENT PROFILE, RELATED ENTITIES, and DOCUMENT CHUNKS below, generate a structured RCA report.

{context_str}

Generate a JSON response with the following structure:
{{
  "equipment_name": "the equipment name",
  "summary": "A 2-3 sentence executive summary of the equipment's maintenance situation",
  "probable_root_causes": [
    {{
      "cause": "Description of the probable root cause",
      "evidence": "Supporting evidence with citation references [1], [2] etc.",
      "severity": "High" | "Medium" | "Low",
      "confidence": "High" | "Medium" | "Low"
    }}
  ],
  "maintenance_timeline": [
    {{
      "event": "Description of the maintenance event",
      "date": "Date if available, else 'N/A'",
      "source": "Citation reference [N]"
    }}
  ],
  "recommended_actions": [
    {{
      "action": "Recommended corrective or preventive action",
      "priority": "Critical" | "High" | "Medium" | "Low",
      "rationale": "Why this action is recommended, with citations"
    }}
  ]
}}

Return ONLY valid JSON, no markdown fences or extra text."""

    response = await llm.ainvoke([HumanMessage(content=prompt)])

    # Parse the JSON response
    try:
        # Strip markdown code fences if present
        raw = response.content.strip()
        if raw.startswith("```"):
            raw = raw.split("\n", 1)[1]
        if raw.endswith("```"):
            raw = raw.rsplit("```", 1)[0]
        raw = raw.strip()
        report = json.loads(raw)
    except (json.JSONDecodeError, IndexError):
        report = {
            "equipment_name": equipment_name,
            "summary": response.content,
            "probable_root_causes": [],
            "maintenance_timeline": [],
            "recommended_actions": [],
        }

    return {
        "report": report,
        "citations": citations_metadata,
    }


async def get_high_risk_equipment(db: asyncpg.Connection) -> List[Dict[str, Any]]:
    """
    Aggregates failure/maintenance frequency by equipment from approved documents.
    Returns a ranked list of equipment sorted by incident count (descending).
    """
    results = await db.fetch(
        """
        WITH equipment_entities AS (
            SELECT e.id, e.name, e.properties
            FROM entities e
            JOIN documents d ON e.source_document_id = d.id
            WHERE e.type = 'Equipment' AND d.status = 'approved'
        ),
        maintenance_counts AS (
            SELECT 
                eq.id as equipment_id,
                eq.name as equipment_name,
                eq.properties,
                COUNT(DISTINCT er.id) as incident_count,
                ARRAY_AGG(DISTINCT related.name) FILTER (WHERE related.type = 'WorkOrder') as work_orders,
                ARRAY_AGG(DISTINCT related.name) FILTER (WHERE related.type = 'Component') as components
            FROM equipment_entities eq
            LEFT JOIN entity_relationships er ON er.source_id = eq.id OR er.target_id = eq.id
            LEFT JOIN entities related ON (
                (related.id = er.target_id AND er.source_id = eq.id)
                OR (related.id = er.source_id AND er.target_id = eq.id)
            )
            GROUP BY eq.id, eq.name, eq.properties
        )
        SELECT 
            equipment_id, equipment_name, properties,
            incident_count, work_orders, components
        FROM maintenance_counts
        ORDER BY incident_count DESC
        """
    )

    equipment_list = []
    for r in results:
        props = (
            json.loads(r["properties"])
            if isinstance(r["properties"], str)
            else r["properties"]
        )
        # Determine risk level based on incident count
        count = r["incident_count"]
        if count >= 6:
            risk_level = "Critical"
        elif count >= 4:
            risk_level = "High"
        elif count >= 2:
            risk_level = "Medium"
        else:
            risk_level = "Low"

        equipment_list.append(
            {
                "equipment_id": str(r["equipment_id"]),
                "equipment_name": r["equipment_name"],
                "properties": props,
                "incident_count": count,
                "work_orders": [wo for wo in (r["work_orders"] or []) if wo],
                "components": [c for c in (r["components"] or []) if c],
                "risk_level": risk_level,
            }
        )

    return equipment_list
