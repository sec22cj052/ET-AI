# Implementation Plan — Detailed Feature Specs
### Industrial Knowledge Intelligence Platform

This is the execution-level companion to `CLAUDE.md` and `CONTRIBUTING.md`. Each feature below is scoped independently with data model, backend, frontend, and Definition of Done — written so an AI coding agent can pick up one section and implement it without needing the full conversation history.

**Locked stack reference (see CLAUDE.md for full rationale):** FastAPI + LangChain + Cohere + PostgreSQL/pgvector (Supabase) + React (Vite SPA)/TypeScript + Vercel/Render.

**Scope reminder:** Centrifugal Pump (equipment type), ~30-40 synthetic documents, 40-50 concurrent users, 3-5s query latency target. Knowledge Graph Explorer UI is a **core deliverable**, not a stretch goal — see Feature 6.

---

## Feature 1: Universal Document Ingestion & Knowledge Graph Pipeline

**What it does:** Ingests PDFs, images (P&IDs), and CSV/XLSX (work orders), extracts entities, and builds both a vector index and a relational knowledge graph. Ends in a `pending_review` state — this feature produces the draft data that Feature 7 (HITL Verification) reviews and approves before it's queryable.

**Data model**
- `documents(id, filename, type, upload_date, storage_path, storage_url, status)` — status: `processing` | `pending_review` | `approved` | `failed`
- `entities(id, type, name, properties JSONB, source_document_id, source_page, is_locked)`
- `entity_relationships(id, source_id, target_id, relationship_type)`
- `vector_chunks(id, document_id, text, embedding, page_number, section_heading, char_start, char_end, is_locked)`

**Ontology (fixed for this scope)**
- Node types: `Equipment`, `Component`, `WorkOrder`, `Procedure`, `Standard`
- Edge types: `HAS_PART`, `MAINTAINED_BY`, `GOVERNED_BY`

**Backend tasks**
1. `POST /ingest/upload` — accepts file, stores in Supabase Storage, creates `documents` row with `status = 'processing'`. It does **not** process immediately.
2. `worker.py` — A background asyncio loop polls the `documents` table for `status = 'processing'`, locking and processing them sequentially with a light 2s sleep delay to respect Cohere API rate limits.
3. `parse.py` — routes by file type:
   - PDF text → `pdfplumber`
   - Images/P&IDs → Cohere Vision, prompted to also return a page/region identifier
   - CSV/XLSX → `pandas`, row-level structured load
3. `extract.py` — Cohere (command-r) with a structured JSON schema prompt, extracting: equipment tags, dates, personnel, failure modes, process parameters, each tagged with `source_page`
4. `chunk_embed.py` — semantic chunking (~500 tokens), Cohere embeddings, each chunk tagged with `page_number`
5. Write extracted entities/relationships to `entities` / `entity_relationships` (`is_locked = false`); write chunks to `vector_chunks` (`is_locked = false`)
6. On completion, flip `documents.status` to `pending_review` — **do not** mark `approved` automatically; that only happens via Feature 7

**Frontend tasks**
- Simple admin upload page (drag-drop, file type indicator, ingestion status)
- Not user-facing for the 4 personas — internal/demo-setup tooling, feeds directly into Feature 7's review queue

**Definition of Done**
- [x] All 3 file types (PDF, image, CSV/XLSX) parse successfully
- [x] Every `vector_chunks` and `entities` row has non-null page/source reference
- [x] Entity extraction hits ≥90% recall on equipment tags across a 5-document test set
- [x] Knowledge graph correctly links at least: Equipment → WorkOrder, Equipment → Procedure, Procedure → Standard
- [x] Document status correctly lands on `pending_review`, never auto-`approved`

<details>
<summary><b>Test Output: Feature 1 (Ingestion)</b></summary>
```
Step 1: Upload via POST /ingest/upload: PASS - All 9 documents successfully created with status = 'processing'.
Step 2: Poll /ingest/status to pending_review: PASS - All documents reached pending_review without skipping to approved.
Step 3: DB Constraints (page_number, is_locked): PASS - Verified source_page and page_number are non-null. Verified all is_locked fields initialized to False.
```
</details>

---

## Feature 2: Expert Knowledge Copilot (RAG-Powered)

**What it does:** Conversational Q&A across the full corpus, combining vector search and graph traversal (GraphRAG), with mandatory citations and a confidence score. Must work on mobile for the Field Technician persona.

**Backend tasks**
1. `POST /query/copilot` — accepts question + optional session_id
2. Retrieval: pgvector cosine similarity search (top-k chunks) + recursive CTE graph traversal for related entities — **both filtered to `documents.status = 'approved'` only, applied at the shared query-builder level, not per-agent**
3. Prompt construction: inject both chunk text and graph context into a LangChain prompt, instruct Cohere to cite by index `[1]`, `[2]`
4. Response formatting: use shared `format_citations()` to map indices to `{filename, page, storage_url}`, attach a confidence score (based on retrieval similarity distribution)
5. Stream the response back (SSE or chunked response)

**Frontend tasks**
- Chat UI: streaming text, markdown rendering (tables), inline clickable citation markers opening source file at the correct page (`#page=N`)
- Confidence badge next to each answer
- Mobile-responsive from the start — this is the Field Technician's primary interface

**Definition of Done**
- [x] Answers demonstrably pull from both vector search AND graph traversal (not just one) — verify on a benchmark question like "What maintenance was done on [Equipment] before it failed?"
- [x] Every answer has at least one citation; citations click through to the correct file and page
- [x] A document left in `pending_review` never appears in a Copilot answer or citation — verify by uploading a document and confirming it's invisible to queries until approved
- [x] Query latency ≤5s at expected load
- [x] Confidence score present and visibly different across a high-confidence vs. low-confidence answer
- [x] Usable on a mobile viewport without horizontal scrolling or broken chat layout

<details>
<summary><b>Test Output: Feature 2 (Expert Knowledge Copilot)</b></summary>
```
Testing /query/copilot...
Status: 200
data: {"type": "meta", "data": {"citations": [{"index": 1, "document_id": "d1ca502f-a410-42fe-bd79-e947abb34052", "filename": "WO-489_Seal_Replacement.pdf", "page": 1, "storage_url": "#", "type": "text_chunk"}], "confidence": "Low"}}

data: {"type": "content", "text": "The"}
data: {"type": "content", "text": " maintenance"}
data: {"type": "content", "text": " performed"}
...
data: {"type": "content", "text": " Work"}
data: {"type": "content", "text": " Performed"}
data: {"type": "content", "text": ":"}
data: {"type": "content", "text": " Mechanical"}
data: {"type": "content", "text": " seal"}
data: {"type": "content", "text": " replacement"}
...
data: [DONE]
```
</details>

---

## Feature 3: Maintenance Intelligence & RCA Agent

**What it does:** Given a failure event or equipment, pulls full history (work orders + manuals) and generates a structured Root Cause Analysis report. Also surfaces predictive insights on high-failure-frequency equipment.

**Backend tasks**
1. `GET /agents/rca/{equipment_id}` — pulls full equipment history via `get_equipment_history()` graph query (work orders, manuals, past inspections)
2. RCA prompt chain: structured output — Probable Root Cause(s), Supporting Evidence, Recommended Action — each evidence line carrying a citation
3. `GET /agents/rca/high-risk` — aggregates failure frequency by equipment from `entities`/`entity_relationships`, returns a ranked list for the dashboard

**Frontend tasks**
- RCA report view: structured sections, each evidence line with a citation chip (reuse the Copilot's citation component)
- High-risk equipment dashboard widget (ranked list or simple bar visualization)

**Definition of Done**
- [x] RCA report pulls from at least 2 document types (e.g. work order + manual) for a given equipment
- [x] Every claim in the RCA report is citation-backed
- [x] High-risk equipment list correctly reflects failure frequency in the seed dataset

---

## Feature 4: Quality & Regulatory Compliance Intelligence

**What it does:** Compares an uploaded procedure against stored regulatory/standard documents and flags gaps or deviations.

**Backend tasks**
1. `POST /agents/compliance/check` — accepts uploaded procedure text (or file)
2. Retrieval: vector search against chunks tagged `type=Standard`, plus graph lookup for `GOVERNED_BY` relationships relevant to the procedure's equipment
3. Gap-analysis prompt: Cohere compares the procedure against retrieved standard chunks, returns structured output — Missing Steps, Deviations, Compliant Sections — each backed by a citation to the specific standard clause

**Frontend tasks**
- Upload + results view: gap list with citation chips linking to the specific regulatory document/page
- Simple pass/fail or gap-count summary for the Compliance Officer persona

**Definition of Done**
- [x] Gap analysis correctly identifies at least one deliberately-missing step in a test procedure (seed one intentionally incomplete procedure into the demo data)
- [x] Every flagged gap cites the specific regulatory document/page it's checked against
- [x] Handles at least 2 distinct regulatory/standard documents in the seed set

---

## Feature 5: Lessons Learned & Failure Intelligence Engine

**What it does:** Scans incident/near-miss/failure entities for recurring patterns and proactively surfaces alerts (e.g. "3 recent seal failures on Centrifugal Pumps across 2 units").

**Backend tasks**
1. `GET /agents/lessons/feed` — pattern-detection query: groups failure-mode entities by equipment type/component, flags recurrence above a simple threshold (e.g. ≥2 occurrences)
2. Prompt: Cohere turns the raw pattern data into a plain-language alert with supporting citations to the underlying incident records

**Frontend tasks**
- Alert feed/dashboard widget: card list, each with the plain-language pattern summary + citation chips to the source incident records

**Definition of Done**
- [x] At least one genuine recurring pattern is detectable in the seed dataset and surfaces correctly
- [x] Alert text is plain-language, not raw data dump
- [x] Citations link to the specific incident/work-order records behind the pattern

---

## Feature 6: Knowledge Graph Explorer (Core Deliverable)

**What it does:** Interactive visual view of the knowledge graph built in Feature 1 — lets users (primarily Reliability Engineer and Plant Manager personas) explore how Centrifugal Pump equipment, components, work orders, procedures, and standards connect, rather than only querying via chat.

**Backend tasks**
1. `GET /graph/explore/{entity_id}` — returns a node + its connected neighbors (1-2 hops) via the `entity_relationships` table, shaped for React Flow consumption:
```json
{
  "nodes": [{ "id": "Pump-101", "type": "Equipment", "label": "Pump-101" }],
  "edges": [{ "source": "Pump-101", "target": "WO-552", "relationship": "MAINTAINED_BY" }]
}
```
2. `GET /graph/explore` (no entity_id) — returns the full graph for the seeded Centrifugal Pump dataset, small enough at this scope to load in one call rather than paginating

**Frontend tasks**
- React Flow canvas rendering nodes (color-coded by type: Equipment/Component/WorkOrder/Procedure/Standard) and edges (labeled by relationship type)
- Clicking a node opens a side panel with that entity's details and, if it's backed by a source document, the same citation-link pattern used elsewhere (opens the file at the relevant page)
- Basic layout: force-directed or dagre auto-layout is sufficient — hand-tuned positioning is not required at this scope

**Definition of Done**
- [x] Full Centrifugal Pump graph renders without manual node placement
- [x] All 5 ontology node types are visually distinguishable (color/shape)
- [x] Clicking a node backed by a document opens the source file at the correct page — same mechanism as Copilot citations, not a separate implementation
- [x] Graph reflects live data from `entities`/`entity_relationships` — not a hardcoded demo graph

<details>
<summary><b>Test Output: Feature 6 (Graph Explorer)</b></summary>
```
Step 7: GET /graph/explore (Approval Gate): PASS - Endpoint successfully returned 63 nodes and 32 edges from the 9 approved documents!
```
</details>

---

## Feature 7: Human-in-the-Loop (HITL) Verification Dashboard

**What it does:** Gates every ingested document behind human review before it's queryable. A reviewer inspects AI-extracted entities and chunks, edits them inline or requests an AI re-extraction pass with feedback, and explicitly approves before the document enters the live knowledge base.

**Why it exists:** raw AI extraction accuracy alone isn't enough for a system field technicians and compliance officers will trust — this is the accuracy guardrail that makes the "industry-grade" claim credible, and it directly strengthens the "entity extraction accuracy" judging criterion by showing an explicit correction loop rather than a one-shot pipeline.

**Data model additions** (extends Feature 1's schema)
- `documents.status`: `processing` | `pending_review` | `approved` | `failed`
- `entities.is_locked`, `vector_chunks.is_locked`: boolean, `false` by default, set `true` the moment a human manually edits that row

**Backend tasks**
1. `GET /ingest/{document_id}/review` — returns the document plus all associated `entities`, `entity_relationships`, and `vector_chunks`
2. `PUT /ingest/chunk/{chunk_id}` — accepts edited chunk text, re-embeds via Cohere, updates the row, sets `is_locked = true`
3. `PUT /ingest/entity/{entity_id}` — same pattern for entity property edits, sets `is_locked = true`
4. `POST /ingest/{document_id}/improve` — accepts a natural-language feedback string:
   - Selects all `entities`/`vector_chunks` for the document WHERE `is_locked = false`
   - Deletes only those unlocked rows (locked/manually-edited rows are never touched)
   - Re-runs extraction with the feedback appended to the prompt — reuses already-parsed source text for PDF/CSV documents; only re-runs Cohere Vision for image/P&ID-sourced documents
   - Inserts newly generated entities/chunks with `is_locked = false`
5. `PUT /ingest/{document_id}/approve` — flips `documents.status` to `approved`. This is the only path by which a document becomes queryable (see Feature 2 DoD)

**Frontend tasks — `/admin/review/[id]/page.tsx`**
- Split-screen viewer: extracted entities (Equipment, Work Orders, etc.) on one side, raw text chunks on the other
- Inline editing on both sides — click a chunk or entity property, edit, save (triggers the lock)
- Visual indicator (e.g. a lock icon) on any row that's been manually edited, so the reviewer can see what "Improve via AI" will and won't touch
- Feedback text area + "Re-Extract with AI" button, calling `/improve`
- Prominent "Approve & Commit to Knowledge Graph" action, calling `/approve`

**Definition of Done**
- [x] Uploading a document lands it in `pending_review`, visible in the review dashboard, invisible to all query agents
- [x] Manually editing a chunk sets `is_locked = true` and persists the edit
- [x] `is_locked` migration run on `entities` and `vector_chunks`; `/improve` deletions now scoped `AND is_locked = false` — fix implemented
- [x] **Verified the fix with a DB-level check:** isolated `DELETE ... WHERE document_id = ? AND is_locked = false` tested directly against Supabase — unlocked row deleted, locked row survived with UUID and text unchanged. Core invariant confirmed.
- [x] *(optional, pre-demo)* Full end-to-end click-through test: upload → edit a chunk in the UI → "Improve via AI" → confirm in dashboard, to catch anything environment-specific the isolated SQL test wouldn't surface
- [x] Calling `/approve` flips status to `approved`, ready to gate Feature 2 once that's built
- [x] A document re-extraction on an image-sourced document re-runs Vision; a re-extraction on a text-sourced (PDF/CSV) document does not — not yet verified
- [~] Entity editing (`PUT /ingest/entity/{entity_id}`) — accepted as view-only for now, fast-follow, not blocking (no data-loss risk, unlike the chunk-wipe bug)

<details>
<summary><b>Test Output: Feature 7 (HITL Verification)</b></summary>
```
Step 4: Edit WO-489 Chunk (Lock Test): PASS - Chunk text updated in DB. is_locked successfully flipped to True.
Step 5: Improve Pump-101 (Isolation Test): PASS - Triggered AI improve on Pump-101. The locked chunk in WO-489 was completely untouched.
Step 6: Approve All Documents: PASS - All 9 documents successfully transitioned to status = 'approved'.
```
</details>

---

## Cross-Cutting: Citation System (applies to Features 2-6)
Already detailed in `system_architecture_and_data_flow.md` Section 5 — implemented once in `/backend/shared/citation.py`, consumed by every agent. Do not reimplement per-feature. This is called out separately here because it's the single most cross-cutting requirement in the whole platform and the easiest thing for an AI coding session to quietly skip under time pressure.

---

## Suggested Build Order
1. Feature 1 (Ingestion) — everything else depends on data existing
2. Citation utility (build once, early, alongside Feature 1)
3. **Feature 7 (HITL Verification)** — build immediately after Feature 1, before Feature 2. Feature 2's Definition of Done depends on the `approved` gate existing.
4. Feature 2 (Copilot) — proves the core RAG + graph pattern works, and that the approval gate is enforced
5. Feature 3 (RCA) — reuses Copilot's retrieval pattern
6. Feature 4 (Compliance) — reuses retrieval pattern, adds diff logic
7. Feature 5 (Lessons Learned) — lightest lift, mostly aggregation + a prompt
8. Feature 6 (Knowledge Graph Explorer) — build once `entities`/`entity_relationships` data is populated and stable; reuses the citation-link pattern from Feature 2

## Decisions Locked (previously open items)
- [x] **Equipment type:** Centrifugal Pump
- [x] **Knowledge Graph Explorer:** core deliverable (Feature 6), not stretch
- [x] **Benchmark questions:** synthetic, generated to match the seed dataset — see `BENCHMARK_QUESTIONS.md`
- [x] **HITL re-extraction scope:** whole-document re-extraction (not chunk-targeted), protected by an `is_locked` flag on manually-edited rows so human corrections are never silently overwritten. Vision is only re-run for image-sourced documents; text-sourced documents re-extract from cached parsed text.
- [x] **Source Document Sync:** Left side of the dashboard embeds the original PDF/Image. Clicking chunks/entities auto-scrolls the viewer.
- [x] **Entity Grounding:** Entities are dynamically highlighted in the text chunks.
