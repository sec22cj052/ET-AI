# API Contract
Exact request/response shapes for every backend endpoint. Frontend and backend should both build against this document — if a shape needs to change, update this file first (see `CONTRIBUTING.md` schema/contract change process) and flag it, don't drift silently.

Base URL (local): `http://localhost:8000`

---

## Shared Types

### Citation
Used in every agent response. See `system_architecture_and_data_flow.md` Section 5 for the mechanism.
```json
{
  "ref": 1,
  "filename": "Pump-101_OEM_Manual.pdf",
  "page": 14,
  "url": "https://.../Pump-101_OEM_Manual.pdf#page=14"
}
```

### Error Response
All endpoints return this shape on failure (4xx/5xx):
```json
{
  "error": true,
  "message": "human-readable description",
  "code": "ERR_VALIDATION | ERR_NOT_FOUND | ERR_UPSTREAM | ERR_INTERNAL"
}
```

---

## Feature 1: Ingestion

### `POST /ingest/upload`
Uploads a raw document and kicks off parsing/extraction.

**Request:** `multipart/form-data`
| Field | Type | Notes |
|---|---|---|
| file | binary | PDF, PNG/JPG, CSV, or XLSX |
| doc_type | string | `manual` \| `work_order` \| `pid` \| `standard` \| `safety_procedure` |

**Response `200`**
```json
{
  "document_id": "uuid",
  "filename": "Pump-101_OEM_Manual.pdf",
  "status": "processing",
  "storage_url": "https://..."
}
```

### `GET /ingest/status/{document_id}`
**Response `200`**
```json
{
  "document_id": "uuid",
  "status": "processing | pending_review | approved | failed",
  "entities_extracted": 12,
  "chunks_created": 34,
  "error": null
}
```

---

## Feature 7: Human-in-the-Loop (HITL) Verification Dashboard

### `GET /ingest/{document_id}/review`
Returns the document plus all associated entities, relationships, and chunks for review.

**Response `200`**
```json
{
  "document": { "id": "uuid", "filename": "Pump-101_OEM_Manual.pdf", "status": "pending_review", "storage_url": "https://..." },
  "entities": [
    { "id": "uuid", "type": "Equipment", "name": "Pump-101", "properties": { "operating_pressure": "12 bar" }, "source_page": 14, "is_locked": false }
  ],
  "entity_relationships": [
    { "source_id": "uuid", "target_id": "uuid", "relationship_type": "HAS_PART" }
  ],
  "vector_chunks": [
    { "id": "uuid", "text": "...", "page_number": 14, "section_heading": "Operating Parameters", "is_locked": false }
  ]
}
```

### `PUT /ingest/chunk/{chunk_id}`
**Request**
```json
{ "text": "corrected chunk text" }
```
**Response `200`** — updated chunk, re-embedded via Cohere, `is_locked` set to `true`
```json
{ "id": "uuid", "text": "corrected chunk text", "is_locked": true, "re_embedded": true }
```

### `PUT /ingest/entity/{entity_id}`
**Request**
```json
{ "properties": { "operating_pressure": "12.5 bar" } }
```
**Response `200`**
```json
{ "id": "uuid", "properties": { "operating_pressure": "12.5 bar" }, "is_locked": true }
```

### `POST /ingest/{document_id}/improve`
**Request**
```json
{ "feedback": "You missed the secondary valve parameters" }
```
**Response `200`** — only unlocked rows were touched
```json
{
  "document_id": "uuid",
  "entities_regenerated": 4,
  "entities_skipped_locked": 2,
  "chunks_regenerated": 6,
  "chunks_skipped_locked": 1,
  "vision_rerun": false
}
```

### `PUT /ingest/{document_id}/approve`
**Response `200`**
```json
{ "document_id": "uuid", "status": "approved" }
```
Once approved, the document becomes immediately queryable by all agents (Features 2-5) and visible in the Knowledge Graph Explorer (Feature 6).

---

## Feature 2: Expert Knowledge Copilot

### `POST /query/copilot`
**Request**
```json
{
  "question": "What is the operating pressure for Pump-101, and when was it last inspected?",
  "session_id": "uuid (optional, for multi-turn context)"
}
```

**Response `200`** (streamed as SSE chunks, final shape below)
```json
{
  "answer": "The operating pressure for Pump-101 is 12 bar [1], last inspected on 3 March 2026 [2].",
  "citations": [
    { "ref": 1, "filename": "Pump-101_OEM_Manual.pdf", "page": 14, "url": "https://.../Pump-101_OEM_Manual.pdf#page=14" },
    { "ref": 2, "filename": "WO-552_Inspection.pdf", "page": 1, "url": "https://.../WO-552_Inspection.pdf#page=1" }
  ],
  "confidence": 0.87,
  "session_id": "uuid"
}
```

---

## Feature 3: Maintenance Intelligence & RCA Agent

### `GET /agents/rca/{equipment_id}`
**Response `200`**
```json
{
  "equipment_id": "Pump-101",
  "probable_causes": [
    {
      "cause": "Seal degradation due to overdue maintenance interval",
      "evidence": "Last seal replacement was 14 months ago, exceeding the OEM-recommended 12-month interval [1]",
      "citations": [
        { "ref": 1, "filename": "WO-489_Seal_Replacement.pdf", "page": 1, "url": "https://.../WO-489_Seal_Replacement.pdf#page=1" }
      ]
    }
  ],
  "recommended_actions": [
    "Schedule immediate seal inspection",
    "Reduce maintenance interval to 10 months going forward"
  ]
}
```

### `GET /agents/rca/high-risk`
**Response `200`**
```json
{
  "equipment": [
    { "equipment_id": "Pump-101", "failure_count_90d": 3, "risk_level": "high" },
    { "equipment_id": "Pump-204", "failure_count_90d": 1, "risk_level": "low" }
  ]
}
```

---

## Feature 4: Quality & Regulatory Compliance Intelligence

### `POST /agents/compliance/check`
**Request:** `multipart/form-data`
| Field | Type | Notes |
|---|---|---|
| file | binary | procedure document to check |
| equipment_type | string | optional, narrows which standards are checked against |

**Response `200`**
```json
{
  "missing_steps": [
    {
      "description": "Lockout-tagout verification step not present before maintenance begins",
      "citations": [
        { "ref": 1, "filename": "OISD-Standard-105.pdf", "page": 7, "url": "https://.../OISD-Standard-105.pdf#page=7" }
      ]
    }
  ],
  "deviations": [],
  "compliant_sections": ["PPE requirements", "Isolation procedure"],
  "overall_status": "gaps_found"
}
```

---

## Feature 5: Lessons Learned & Failure Intelligence Engine

### `GET /agents/lessons/feed`
**Response `200`**
```json
{
  "alerts": [
    {
      "summary": "3 recent seal failures on Centrifugal Pumps across 2 units in the last 90 days.",
      "pattern_type": "recurring_failure_mode",
      "citations": [
        { "ref": 1, "filename": "WO-489_Seal_Replacement.pdf", "page": 1, "url": "https://.../WO-489_Seal_Replacement.pdf#page=1" },
        { "ref": 2, "filename": "WO-501_Seal_Replacement.pdf", "page": 1, "url": "https://.../WO-501_Seal_Replacement.pdf#page=1" }
      ]
    }
  ]
}
```

---

## Feature 6: Knowledge Graph Explorer

### `GET /graph/explore/{entity_id}`
Returns a node and its connected neighbors (1-2 hops), shaped for React Flow.

**Response `200`**
```json
{
  "nodes": [
    { "id": "Pump-101", "type": "Equipment", "label": "Pump-101" },
    { "id": "WO-552", "type": "WorkOrder", "label": "WO-552" }
  ],
  "edges": [
    { "source": "Pump-101", "target": "WO-552", "relationship": "MAINTAINED_BY" }
  ]
}
```

### `GET /graph/explore`
Returns the full graph for the seeded Centrifugal Pump dataset (no `entity_id`). Same response shape as above, unfiltered.

---

## HTTP Status Codes Used
| Code | Meaning |
|---|---|
| 200 | Success |
| 202 | Accepted (async processing started — used for `/ingest/upload`) |
| 400 | Validation error (bad file type, missing field) |
| 404 | Resource not found (e.g. unknown `equipment_id`) |
| 422 | Retrieval succeeded but produced no usable context — return this rather than a fabricated answer |
| 500 | Internal/upstream error (Cohere or Supabase failure) |

## Rate Limiting Note
Cohere calls should be rate-limited per session to avoid quota exhaustion during the live demo — return `429` with `Retry-After` header if hit.
