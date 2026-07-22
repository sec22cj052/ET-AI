import re
import json
from typing import Dict, Any, List

def calculate_evidence_confidence(extracted_value: str, chunk_text: str) -> float:
    """Fuzzy match extracted value against source chunk text.
    Found verbatim/near-verbatim -> high; not found -> forced low (hallucination signal).
    """
    if not extracted_value or not chunk_text:
        return 0.0
    
    # Simple check for now: if extracted string is in the text case-insensitive
    val_lower = str(extracted_value).lower()
    text_lower = str(chunk_text).lower()
    
    if val_lower in text_lower:
        return 1.0
        
    # Check if parts are present (very simple fuzzy matching)
    words = val_lower.split()
    if not words:
        return 0.0
    
    match_count = sum(1 for w in words if w in text_lower)
    return match_count / len(words)

def calculate_rule_confidence(entity: Dict[str, Any], rule_violations: List[str]) -> float:
    """Regex on equipment tag format, date parses, mandatory fields."""
    score = 1.0
    if entity.get("type") == "Equipment":
        # Check tag format (e.g. Pump-\d+)
        if not re.match(r'^[A-Za-z]+-\d+$', entity.get("name", "")):
            rule_violations.append("tag_format_invalid")
            score -= 0.5
            
    # Check mandatory fields (example logic)
    if not entity.get("name"):
        rule_violations.append("missing_name")
        score -= 0.5
        
    return max(0.0, score)

async def check_cross_doc_consistency(conn, entity: Dict[str, Any], rule_violations: List[str]) -> float:
    """Does this entity's attributes agree with other already-approved entities sharing the same tag?"""
    if not conn:
        return 1.0 # Cannot check
        
    name = entity.get("name")
    if not name:
        return 1.0
        
    # Look up existing approved entities with same name
    rows = await conn.fetch("""
        SELECT e.type, e.properties 
        FROM entities e
        JOIN documents d ON e.source_document_id = d.id
        WHERE e.name = $1 AND d.status = 'approved'
    """, name)
    
    if not rows:
        return 1.0 # First time seeing this entity
        
    for row in rows:
        existing_type = row['type']
        if existing_type != entity.get("type"):
            rule_violations.append(f"cross_doc_consistency_conflict: type mismatch (expected {existing_type})")
            return 0.2 # Significant conflict
            
    return 1.0


async def compute_entity_confidence(conn, entity_data: Dict[str, Any], chunk_text: str, document_type_confidence: float) -> Dict[str, Any]:
    """Computes composite confidence and sets routing levels."""
    
    rule_violations = []
    
    # Deterministic scores
    # We take the entity name and stringified properties as what we want to check against chunk
    extracted_text = f"{entity_data.get('name', '')} {json.dumps(entity_data.get('properties', {}))}"
    
    evidence_conf = calculate_evidence_confidence(extracted_text, chunk_text)
    rule_conf = calculate_rule_confidence(entity_data, rule_violations)
    cross_doc_conf = await check_cross_doc_consistency(conn, entity_data, rule_violations)
    
    field_conf = entity_data.get("field_confidence", 0.5)
    
    # Weighted composite (weights lean deterministic)
    composite = (
        (evidence_conf * 0.3) +
        (rule_conf * 0.2) +
        (cross_doc_conf * 0.3) +
        (field_conf * 0.1) +
        (document_type_confidence * 0.1)
    )
    
    breakdown = {
        "document_type_confidence": document_type_confidence,
        "field_confidence": field_conf,
        "evidence_confidence": evidence_conf,
        "rule_confidence": rule_conf,
        "cross_doc_confidence": cross_doc_conf
    }
    
    criticality = entity_data.get("criticality", "operational")
    
    # Routing logic
    # Hard rule: critical fields can never auto-approve
    if criticality == "critical":
        required_level = 3 if composite < 0.7 or rule_violations else 2
        status = "needs_review"
    else:
        # operational field
        if composite >= 0.8 and not rule_violations:
            status = "sme_approved" # Auto-approves
            required_level = 1
        else:
            status = "needs_review"
            required_level = 1 if composite >= 0.5 else 2
            
    # Force escalate on massive conflict or low evidence
    if any("cross_doc_consistency_conflict" in v for v in rule_violations) or evidence_conf < 0.2:
        required_level = 3
        status = "needs_review"
        
    return {
        "confidence_composite": composite,
        "confidence_breakdown": breakdown,
        "criticality": criticality,
        "review_status": status,
        "rule_violations": rule_violations,
        "required_approval_level": required_level
    }
