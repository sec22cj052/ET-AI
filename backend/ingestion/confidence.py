"""
Industrial Quality Rules Engine for HITL Confidence Scoring.

Implements 9 industry-standard rules inspired by ISO 55000 (Asset Management)
and API 580/581 (Risk-Based Inspection) to produce a 0-100% quality score
per ingested document.
"""
import asyncpg
import math
from typing import Dict, List, Any


RULES = [
    {"id": "equipment_tag", "name": "Equipment Tag Present", "weight": 15,
     "description": "At least one Equipment entity was extracted"},
    {"id": "work_order_linked", "name": "Work Order Linked", "weight": 15,
     "description": "At least one WorkOrder entity exists with a relationship to Equipment"},
    {"id": "date_extraction", "name": "Date Extraction", "weight": 10,
     "description": "At least one date was captured in entity properties"},
    {"id": "page_traceability", "name": "Page Traceability", "weight": 15,
     "description": "Every entity has a non-null source_page value"},
    {"id": "chunk_coverage", "name": "Chunk Coverage", "weight": 10,
     "description": "Sufficient chunks extracted relative to document complexity"},
    {"id": "no_orphan_entities", "name": "No Orphan Entities", "weight": 10,
     "description": "Every entity participates in at least one relationship"},
    {"id": "properties_populated", "name": "Properties Populated", "weight": 10,
     "description": "Entity properties are populated for at least 50% of entities"},
    {"id": "chunk_length_sanity", "name": "Chunk Length Sanity", "weight": 10,
     "description": "No chunk is too short (<20 chars) or too long (>3000 chars)"},
    {"id": "duplicate_entity_check", "name": "No Duplicate Entities", "weight": 5,
     "description": "No two entities share the exact same name+type combination"},
]


async def calculate_confidence_score(
    document_id: str, db: asyncpg.Connection
) -> Dict[str, Any]:
    """
    Calculates a rules-based confidence score for a document's AI extraction.
    Returns the overall score (0-100) and per-rule breakdown.
    """
    # Fetch all data needed for scoring in bulk
    entities = await db.fetch(
        "SELECT id, type, name, properties, source_page FROM entities WHERE source_document_id = $1",
        document_id,
    )
    chunks = await db.fetch(
        "SELECT id, text, page_number FROM vector_chunks WHERE document_id = $1",
        document_id,
    )

    entity_ids = [str(e["id"]) for e in entities]

    # Fetch relationships for these entities
    relationships = []
    if entity_ids:
        relationships = await db.fetch(
            """
            SELECT source_id, target_id, relationship_type
            FROM entity_relationships
            WHERE source_id = ANY($1) OR target_id = ANY($1)
            """,
            entity_ids,
        )

    # Build lookup structures
    import json

    entity_list = []
    for e in entities:
        props = e["properties"]
        if isinstance(props, str):
            props = json.loads(props)
        entity_list.append({
            "id": str(e["id"]),
            "type": e["type"],
            "name": e["name"],
            "properties": props or {},
            "source_page": e["source_page"],
        })

    chunk_list = [{"id": str(c["id"]), "text": c["text"], "page_number": c["page_number"]} for c in chunks]

    rel_list = [
        {"source_id": str(r["source_id"]), "target_id": str(r["target_id"]), "type": r["relationship_type"]}
        for r in relationships
    ]

    # Evaluate each rule
    results = []
    for rule in RULES:
        passed, detail = _evaluate_rule(rule["id"], entity_list, chunk_list, rel_list)
        results.append({
            "id": rule["id"],
            "name": rule["name"],
            "weight": rule["weight"],
            "passed": passed,
            "detail": detail,
            "description": rule["description"],
        })

    # Calculate weighted score
    total_weight = sum(r["weight"] for r in results)
    earned_weight = sum(r["weight"] for r in results if r["passed"])
    score = round((earned_weight / total_weight) * 100) if total_weight > 0 else 0

    return {"score": score, "rules": results}


def _evaluate_rule(
    rule_id: str,
    entities: List[Dict],
    chunks: List[Dict],
    relationships: List[Dict],
) -> tuple[bool, str]:
    """Evaluates a single rule and returns (passed, detail_message)."""

    if rule_id == "equipment_tag":
        equipment = [e for e in entities if e["type"] == "Equipment"]
        if equipment:
            names = ", ".join(e["name"] for e in equipment[:3])
            return True, f"Found {len(equipment)} equipment entities: {names}"
        return False, "No Equipment entities were extracted"

    elif rule_id == "work_order_linked":
        work_orders = [e for e in entities if e["type"] == "WorkOrder"]
        equipment = [e for e in entities if e["type"] == "Equipment"]
        if not work_orders:
            return False, "No WorkOrder entities found"
        if not equipment:
            return False, "WorkOrders exist but no Equipment to link to"
        # Check if any relationship connects equipment to work order
        eq_ids = {e["id"] for e in equipment}
        wo_ids = {e["id"] for e in work_orders}
        linked = any(
            (r["source_id"] in eq_ids and r["target_id"] in wo_ids)
            or (r["source_id"] in wo_ids and r["target_id"] in eq_ids)
            for r in relationships
        )
        if linked:
            return True, f"{len(work_orders)} WorkOrders linked to Equipment"
        return False, f"{len(work_orders)} WorkOrders found but none linked to Equipment"

    elif rule_id == "date_extraction":
        for e in entities:
            props = e.get("properties", {})
            dates = props.get("dates", [])
            if dates and len(dates) > 0 and any(d for d in dates if d):
                return True, f"Dates found in entity properties"
        return False, "No dates captured in any entity properties"

    elif rule_id == "page_traceability":
        if not entities:
            return True, "No entities to check (vacuously true)"
        missing = [e for e in entities if e["source_page"] is None]
        if not missing:
            return True, f"All {len(entities)} entities have source_page"
        return False, f"{len(missing)}/{len(entities)} entities missing source_page"

    elif rule_id == "chunk_coverage":
        if not chunks:
            return False, "No chunks extracted"
        # Simple heuristic: at least 2 chunks for a meaningful document
        if len(chunks) >= 2:
            return True, f"{len(chunks)} chunks extracted (sufficient coverage)"
        return False, f"Only {len(chunks)} chunk — likely incomplete extraction"

    elif rule_id == "no_orphan_entities":
        if not entities:
            return True, "No entities to check"
        connected_ids = set()
        for r in relationships:
            connected_ids.add(r["source_id"])
            connected_ids.add(r["target_id"])
        orphans = [e for e in entities if e["id"] not in connected_ids]
        if not orphans:
            return True, f"All {len(entities)} entities participate in relationships"
        return False, f"{len(orphans)}/{len(entities)} entities are orphaned (no relationships)"

    elif rule_id == "properties_populated":
        if not entities:
            return True, "No entities to check"
        populated = [e for e in entities if e["properties"] and len(e["properties"]) > 0]
        ratio = len(populated) / len(entities)
        if ratio >= 0.5:
            return True, f"{len(populated)}/{len(entities)} entities have populated properties ({round(ratio*100)}%)"
        return False, f"Only {len(populated)}/{len(entities)} entities have properties ({round(ratio*100)}%)"

    elif rule_id == "chunk_length_sanity":
        if not chunks:
            return False, "No chunks to check"
        bad_short = [c for c in chunks if len(c["text"]) < 20]
        bad_long = [c for c in chunks if len(c["text"]) > 3000]
        if not bad_short and not bad_long:
            return True, f"All {len(chunks)} chunks within acceptable length range"
        issues = []
        if bad_short:
            issues.append(f"{len(bad_short)} too short (<20 chars)")
        if bad_long:
            issues.append(f"{len(bad_long)} too long (>3000 chars)")
        return False, "; ".join(issues)

    elif rule_id == "duplicate_entity_check":
        if not entities:
            return True, "No entities to check"
        seen = set()
        dupes = []
        for e in entities:
            key = (e["type"], e["name"].lower().strip())
            if key in seen:
                dupes.append(e["name"])
            seen.add(key)
        if not dupes:
            return True, f"All {len(entities)} entities are unique"
        return False, f"Duplicates found: {', '.join(dupes[:3])}"

    return False, "Unknown rule"
