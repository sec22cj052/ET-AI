"""Link entities that are already stored.

Extraction only writes entities. This pass reads those entities, the text of
stored chunks, and each entity's properties, then writes MAINTAINED_BY edges.
A work order joins an equipment node when either name appears in the other's
record or in the same document. Older files do not need to be uploaded again.
"""

import json
import re
import uuid
from typing import Any, Iterable


def _as_text(value: Any) -> str:
    if value is None:
        return ""
    if isinstance(value, str):
        return value
    return json.dumps(value)


def _mentioned(name: str, text: str) -> bool:
    if not name or not text:
        return False
    pattern = r"(?<!\w)" + re.escape(name) + r"(?!\w)"
    return re.search(pattern, text, flags=re.IGNORECASE) is not None


def find_maintained_by_pairs(
    equipment: Iterable[dict],
    work_orders: Iterable[dict],
    document_texts: Iterable[str],
) -> list[tuple[str, str]]:
    """Return (equipment_id, work_order_id) pairs that should be linked."""
    equipment = [e for e in equipment if e.get("id") and e.get("name")]
    work_orders = [w for w in work_orders if w.get("id") and w.get("name")]
    pairs: set[tuple[str, str]] = set()

    for text in document_texts:
        if not text:
            continue
        found_equipment = [e for e in equipment if _mentioned(e["name"], text)]
        found_orders = [w for w in work_orders if _mentioned(w["name"], text)]
        for eq in found_equipment:
            for wo in found_orders:
                if eq["id"] != wo["id"]:
                    pairs.add((str(eq["id"]), str(wo["id"])))

    for wo in work_orders:
        blob = f"{wo['name']}\n{_as_text(wo.get('properties'))}"
        for eq in equipment:
            if eq["id"] != wo["id"] and _mentioned(eq["name"], blob):
                pairs.add((str(eq["id"]), str(wo["id"])))

    for eq in equipment:
        blob = f"{eq['name']}\n{_as_text(eq.get('properties'))}"
        for wo in work_orders:
            if eq["id"] != wo["id"] and _mentioned(wo["name"], blob):
                pairs.add((str(eq["id"]), str(wo["id"])))

    return sorted(pairs)


async def link_stored_entities(
    db: Any,
    extra_texts: list[str] | None = None,
) -> int:
    """Write missing MAINTAINED_BY edges. Returns how many new edges were inserted."""
    rows = await db.fetch(
        """
        SELECT id, type, name, properties
        FROM entities
        WHERE lower(type) IN ('equipment', 'workorder')
        """
    )
    equipment = []
    work_orders = []
    for row in rows:
        record = {
            "id": str(row["id"]),
            "name": row["name"],
            "properties": row["properties"],
        }
        if str(row["type"]).lower() == "equipment":
            equipment.append(record)
        else:
            work_orders.append(record)

    chunk_rows = await db.fetch("SELECT text FROM vector_chunks WHERE text IS NOT NULL")
    texts = [row["text"] for row in chunk_rows]
    if extra_texts:
        texts.extend(extra_texts)

    pairs = find_maintained_by_pairs(equipment, work_orders, texts)
    written = 0
    for source_id, target_id in pairs:
        exists = await db.fetchval(
            """
            SELECT 1 FROM entity_relationships
            WHERE source_id = $1 AND target_id = $2 AND relationship_type = 'MAINTAINED_BY'
            """,
            source_id,
            target_id,
        )
        if exists:
            continue
        await db.execute(
            """
            INSERT INTO entity_relationships (id, source_id, target_id, relationship_type)
            VALUES ($1, $2, $3, 'MAINTAINED_BY')
            """,
            str(uuid.uuid4()),
            source_id,
            target_id,
        )
        written += 1
    return written
