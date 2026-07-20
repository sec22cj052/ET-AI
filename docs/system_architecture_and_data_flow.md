# System Architecture & Data Flow Design
## Industrial Knowledge Intelligence Platform

See `system_architecture_diagram.mermaid` for the visual diagram referenced throughout this document.

---

## 1. Architecture Overview

Three layers, one database:

1. **Client Layer** — React (Vite SPA) web app, mobile-responsive by default (no separate native app for the hackathon)
2. **Backend Orchestration** — FastAPI async server hosting a query router and four specialized agents. Secured via JWT Auth and Role-Based Access Control (Admin vs. Operator).
3. **Data Layer** — a single PostgreSQL (Supabase) instance with the `pgvector` extension, holding vector embeddings, relational "graph" tables, and metadata

**Why one database instead of Neo4j + Qdrant + Postgres:** at 40-50 users and ~30-40 seed documents, the dataset is small enough that a relational graph model (`entities` + `entity_relationships` tables, queried with recursive CTEs) delivers the same relationship-traversal capability the judges are scoring ("knowledge graph linkage completeness") without the operational cost of running, securing, and debugging three separate databases in a multi-day build window.

---

## 2. Data Flow: Ingestion (now a 2-step process: AI extraction → human review/approval)

```
Raw Document (PDF / Image / CSV)
        │
        ▼
[1] Upload & Store — file saved, row created in `documents` table, status = 'processing'
        │
        ▼
[2] Parse
    - Text PDFs → pdfplumber (fast, free, no API call)
    - P&IDs / scanned images → Gemini 2.5 Flash Vision (multimodal OCR + layout reasoning)
    - CSV/XLSX work orders → pandas, direct structured load
        │
        ▼
[3] Entity Extraction — Gemini 2.5 Flash with a structured JSON schema prompt
    Extracts: equipment tags, dates, personnel, failure modes, process parameters
        │
        ├──► [4a] Write nodes/edges to `entities` / `entity_relationships` (is_locked = false)
        │        e.g. Pump-101 —HAS_MAINTENANCE_RECORD→ WO-552
        │
        └──► [4b] Chunk text (semantic chunking, ~500 tokens)
                 → Voyage AI embeddings
                 → store in `vector_chunks` (pgvector column, is_locked = false)
        │
        ▼
[5] Document status → 'pending_review' — NOT yet queryable by any agent
        │
        ▼
[6] HUMAN REVIEW (see Section 5a: Human-in-the-Loop Verification Dashboard)
    - Reviewer inspects entities + chunks in the admin dashboard
    - Manual edits lock the edited row (is_locked = true)
    - Optional "Improve via AI" re-extraction pass (skips locked rows)
        │
        ▼
[7] Reviewer clicks Approve → status → 'approved'
        │
        ▼
    Document (and only this document) now queryable by Copilot / RCA / Compliance / Lessons Learned
```

## 3. Data Flow: Query (online, real-time, <5s target)

```
User question (web or mobile)
        │
        ▼
[1] Query Router — classifies intent (general Q&A / RCA / compliance / trend)
        │
        ├─► Expert Copilot Agent (default path)
        │     - Vector search (pgvector cosine similarity, WHERE documents.status = 'approved') → relevant chunks
        │     - Graph lookup (recursive CTE, joined against approved documents only) → related entities
        │     - Both contexts passed to Gemini 2.5 Flash → answer + citations + confidence score
        │
        ├─► Maintenance RCA Agent
        │     - Pulls equipment's full work-order + manual history via graph traversal (approved docs only)
        │     - Structured RCA prompt chain → root cause report
        │
        ├─► Compliance Gap Agent
        │     - Diff uploaded procedure text against stored regulatory chunks (approved docs only)
        │     - Returns missing/deviating steps
        │
        └─► Lessons Learned Agent
              - Scans incident/near-miss entities for recurring patterns (approved docs only)
              - Surfaces proactive alerts to a dashboard feed
        │
        ▼
[2] Citation formatting — retrieved chunks/entities mapped to {filename, page, storage_url}
    (see Section 6: Source Citation & File-Linking Mechanism)
        │
        ▼
[3] Response streamed back to client: answer text + citation list + confidence indicator
```

**Every query-time retrieval — vector search and graph traversal alike — filters on `documents.status = 'approved'`.** This is a single shared filter applied at the query-builder level (not per-agent), so it can't be accidentally omitted when a new agent is added later.

## 4. Database Schema (minimum viable)

| Table | Purpose | Key columns |
|---|---|---|
| `documents` | Source file metadata + retrievable location + review workflow state | id, filename, type, upload_date, **storage_path**, **storage_url**, **status** (`processing` \| `pending_review` \| `approved` \| `error`), **summary** |
| `entities` | Graph nodes | id, type (Equipment/Component/WorkOrder/Procedure/Standard), name, properties (JSONB), **source_document_id**, **source_page**, **is_locked** |
| `entity_relationships` | Graph edges | source_id, target_id, relationship_type (HAS_PART/MAINTAINED_BY/GOVERNED_BY) |
| `vector_chunks` | RAG text chunks | id, document_id, text, embedding (vector), **page_number**, **section_heading**, **char_start**, **char_end**, **is_locked** |
| `users` | Auth for users | id, email, hashed_password, full_name, role, company, created_at |

The bolded columns are what make citations possible — every retrievable unit (a chunk, an entity) carries a pointer back to the exact document and location it came from, not just the document as a whole. `status` gates queryability; `is_locked` protects human edits from being overwritten by a re-extraction pass.

## 5. Human-in-the-Loop (HITL) Verification Dashboard

**Why this exists:** raw AI extraction is not trustworthy enough to serve directly to field technicians and compliance officers without a check. This gate is what makes the "industry-grade" claim credible to judges — it's the difference between a RAG demo and a system with an actual accuracy guardrail.

**Workflow**
1. Document finishes AI extraction → status `pending_review`. It is invisible to every agent until approved.
2. A human reviewer opens `/admin/review/[id]` and sees a split-screen view: extracted entities on one side, raw text chunks on the other.
3. Reviewer can inline-edit any chunk or entity property directly. Any edit sets `is_locked = true` on that row.
4. Reviewer can instead type natural-language feedback (e.g. "you missed the secondary valve parameters") and trigger "Improve via AI":
   - Locked rows are skipped entirely — they are not deleted or regenerated
   - Unlocked entities/chunks are deleted and regenerated via a fresh Gemini 2.5 Flash pass, with the feedback appended to the prompt
   - **Re-extraction reuses the already-parsed source content (text/CSV rows) rather than re-running Vision, except for image/P&ID-sourced documents where Vision re-run is unavoidable** — this keeps re-extraction fast and cheap
5. Reviewer clicks "Approve & Commit to Knowledge Graph" → status flips to `approved` → document becomes queryable platform-wide.

**Why `is_locked` instead of full chunk-targeted re-extraction:** targeted re-extraction (regenerating only the specific chunk the reviewer is looking at) would require region-level re-parsing logic that's a heavier lift than this timeline supports. `is_locked` gets the same practical outcome — human edits are never silently destroyed — with a single boolean flag and one WHERE clause added to the wipe-and-regenerate query.

## 6. Source Citation & File-Linking Mechanism

This is a first-class requirement from the challenge statement ("source citations, confidence scores, and direct links to the originating documents"), so it needs to be designed end-to-end, not bolted on at the UI layer.

**A. Capture location metadata at ingestion time (Phase 1)**
- On upload, the raw file is written to a Supabase Storage bucket. The `documents` row stores both the internal `storage_path` and a signed/public `storage_url`.
- During parsing, every extracted chunk keeps its page number (PDF) or row/section reference (CSV, P&ID region) — this is why `vector_chunks` and `entities` carry `page_number` / `source_page` rather than just a `document_id`.
- For PDFs, `pdfplumber` gives page numbers natively. For Gemini Vision parsing of P&IDs/scans, the extraction prompt should explicitly request a page/region identifier alongside each extracted entity.

**B. Attach citations at retrieval time (Phase 2)**
- Every agent (Copilot, RCA, Compliance, Lessons Learned) retrieves chunks/entities as structured objects, not raw text — each carrying `document_id`, `filename`, `page_number`, `storage_url`.
- Build one shared utility, e.g. `format_citations(retrieved_items) -> List[Citation]`, used by all four agents so citation behavior is consistent across the whole platform, not just the chat.
- The LLM prompt should reference chunks by an index (e.g. `[1]`, `[2]`) and the backend maps those indices back to the structured citation objects — this avoids relying on the LLM to invent or correctly copy file names/URLs.
- Response shape returned to the frontend:
```json
{
  "answer": "The operating pressure for Pump-101 is 12 bar [1], last inspected on 3 March 2026 [2].",
  "citations": [
    {"ref": 1, "filename": "Pump-101_OEM_Manual.pdf", "page": 14, "url": "https://.../Pump-101_OEM_Manual.pdf#page=14"},
    {"ref": 2, "filename": "WO-552_Inspection.pdf", "page": 1, "url": "https://.../WO-552_Inspection.pdf#page=1"}
  ],
  "confidence": 0.87
}
```
- `#page=N` works directly in most browser-native PDF viewers, so no custom PDF viewer component is strictly required for the demo.

**C. Render at the UI (Phase 3)**
- Inline citation markers `[1]` `[2]` in the chat response, clickable, opening the source file at the correct page in a new tab (or a side panel viewer if time allows).
- Dashboards (RCA reports, compliance gap lists, lessons-learned feed) use the same citation chips — this is what demonstrates "cross-functional linkage" to judges: click a work order reference in an RCA report and it opens the actual PDF.

**D. Verification**
- Add to the manual verification pass: for every benchmark question, confirm the citation link opens the correct file at the correct page — not just that a citation exists.

## 7. Scalability Notes for 40-50 Concurrent Users
- FastAPI async endpoints + Supabase connection pooling (pgbouncer) — no code changes needed, just config
- Cache the last N common queries (in-memory dict is sufficient at this scale; skip Redis unless time allows)
- Rate-limit Gemini calls per session to avoid quota exhaustion during the live demo

## 8. Key Trade-offs Made (be ready to explain to judges)
- **Relational graph instead of Neo4j:** faster to build, one less service to run; acceptable because dataset is small and demo-bounded. Worth mentioning Neo4j as the "production path" in your pitch.
- **Gemini + Voyage instead of OpenAI:** consistent with your other project stack, avoids managing two LLM providers.
- **Synthetic data instead of real industrial documents:** faster to bootstrap and iterate; frame this explicitly as a limitation with a clear path to real data in the pitch deck.
- **`is_locked` flag instead of true chunk-targeted re-extraction:** protects human edits from being overwritten by "Improve via AI" without needing region-level re-parsing logic — a much smaller lift for the same practical guarantee.

