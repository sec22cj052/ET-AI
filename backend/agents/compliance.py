"""
Quality & Regulatory Compliance Intelligence Agent.

Compares an uploaded procedure against stored regulatory/standard documents
and flags missing steps or deviations using Cohere LLM with citations.
"""

from typing import List, Dict, Any
import os
import json

import asyncpg
from langchain_cohere import CohereEmbeddings, ChatCohere
from langchain_core.messages import HumanMessage

from shared.citation import format_citations


async def run_compliance_check(
    procedure_text: str,
    equipment_name: str | None,
    db: asyncpg.Connection,
) -> Dict[str, Any]:
    """
    Embeds the procedure text, retrieves the most relevant standard/regulatory
    chunks from approved documents, and asks the LLM to perform a gap analysis.
    """

    # 1. Embed the procedure text
    embeddings = CohereEmbeddings(
        model="embed-english-v3.0",
        cohere_api_key=os.getenv("COHERE_API_KEY"),
    )
    query_vector = await embeddings.aembed_query(procedure_text[:2000])  # cap input
    query_vector_str = "[" + ",".join(map(str, query_vector)) + "]"

    # 2. Vector search — prioritise Standard-type documents, but include all approved
    vector_results = await db.fetch(
        """
        SELECT v.id, v.text, v.page_number,
               d.filename, d.storage_url, d.id as document_id, d.type as doc_type,
               (v.embedding <=> $1::vector) as distance
        FROM vector_chunks v
        JOIN documents d ON v.document_id = d.id
        WHERE d.status = 'approved'
        ORDER BY
            CASE WHEN d.type = 'standard' THEN 0 ELSE 1 END,
            v.embedding <=> $1::vector
        LIMIT 10
        """,
        query_vector_str,
    )

    retrieved_items = [dict(r) for r in vector_results]
    citations_metadata = format_citations(retrieved_items)

    # 3. Also pull graph relationships for standards (GOVERNED_BY edges)
    graph_context: List[str] = []
    if equipment_name:
        edges = await db.fetch(
            """
            SELECT src.name as source_name, src.type as source_type,
                   er.relationship_type,
                   tgt.name as target_name, tgt.type as target_type
            FROM entities src
            JOIN entity_relationships er ON er.source_id = src.id
            JOIN entities tgt ON er.target_id = tgt.id
            JOIN documents ds ON src.source_document_id = ds.id
            JOIN documents dt ON tgt.source_document_id = dt.id
            WHERE ds.status = 'approved' AND dt.status = 'approved'
              AND (src.name ILIKE $1 OR tgt.name ILIKE $1)
              AND er.relationship_type = 'GOVERNED_BY'
            """,
            f"%{equipment_name}%",
        )
        for edge in edges:
            graph_context.append(
                f"{edge['source_type']} '{edge['source_name']}' is "
                f"{edge['relationship_type']} {edge['target_type']} '{edge['target_name']}'"
            )

    # 4. Build context for LLM
    context_str = "REGULATORY / STANDARD DOCUMENTS:\n"
    for idx, r in enumerate(retrieved_items):
        context_str += (
            f"[{idx + 1}] File: {r['filename']} (Page {r['page_number']})\n"
            f"{r['text']}\n\n"
        )

    if graph_context:
        context_str += "KNOWLEDGE GRAPH RELATIONSHIPS:\n"
        for g in graph_context:
            context_str += f"- {g}\n"

    # 5. LLM gap analysis
    llm = ChatCohere(
        model="command-r-08-2024",
        cohere_api_key=os.getenv("COHERE_API_KEY"),
        temperature=0,
    )

    prompt = f"""You are a Quality & Regulatory Compliance Intelligence Agent for an industrial maintenance organisation.

TASK: Compare the UPLOADED PROCEDURE below against the REGULATORY / STANDARD DOCUMENTS retrieved from our knowledge base. Identify gaps, missing steps, and deviations.

UPLOADED PROCEDURE:
\"\"\"
{procedure_text[:3000]}
\"\"\"

{context_str}

Generate a JSON response with this structure:
{{
  "overall_status": "Compliant" | "Gaps Found" | "Non-Compliant",
  "compliance_score": <number 0-100>,
  "summary": "2-3 sentence executive summary of the compliance check",
  "gaps": [
    {{
      "title": "Short title of the gap",
      "description": "What is missing or deviating",
      "severity": "Critical" | "Major" | "Minor",
      "standard_reference": "Which standard clause this relates to, with citation [N]",
      "recommendation": "Suggested corrective action"
    }}
  ],
  "compliant_areas": [
    {{
      "area": "Area that is compliant",
      "standard_reference": "Supporting standard clause with citation [N]"
    }}
  ]
}}

Return ONLY valid JSON, no markdown fences or extra text."""

    response = await llm.ainvoke([HumanMessage(content=prompt)])

    # Parse the JSON response
    try:
        raw = response.content.strip()
        if raw.startswith("```"):
            raw = raw.split("\n", 1)[1]
        if raw.endswith("```"):
            raw = raw.rsplit("```", 1)[0]
        raw = raw.strip()
        result = json.loads(raw)
    except (json.JSONDecodeError, IndexError):
        result = {
            "overall_status": "Error",
            "compliance_score": 0,
            "summary": response.content,
            "gaps": [],
            "compliant_areas": [],
        }

    return {
        "result": result,
        "citations": citations_metadata,
    }
