# Implementation Plan: Industrial Knowledge Intelligence Platform
### (Revised — aligned to proven stack, reduced infra risk)

## Decisions Locked In (answers to the open questions)

| Decision | Choice | Rationale |
|---|---|---|
| Data source | Synthetic dataset, generated via Gemini, scoped to **Centrifugal Pump** | No real dataset access in the timeframe; single equipment type keeps entity-extraction and query testing focused and deep |
| Document count | ~30-40 docs: 5-8 manuals, 15 work orders, 5 P&IDs (simplified/synthetic), 5-8 safety/compliance docs | Enough variety to demo all 4 agent types without over-scoping ingestion |
| OCR/Vision | Cohere Vision (command-a-vision-07-2025) | Unified provider, simplifies API management |
| Cloud hosting | Vercel (frontend) + Render (FastAPI backend) + Supabase (Postgres + pgvector) | Free-tier friendly, near-zero DevOps overhead at 40-50 users |
| AI framework | LangChain (not LlamaIndex) | You have working LangChain experience from PS-08; don't add a new framework mid-hackathon |
| LLM / Embeddings | Cohere (command-r-08-2024) + Cohere Embeddings | Unified provider, simplifies API management |
| Knowledge graph | Modeled relationally in PostgreSQL (`entities` + `entity_relationships`), not Neo4j | One database instead of three; still satisfies the "graph linkage" judging criterion at this scale |
| Vector DB | pgvector extension on the same Postgres instance | Eliminates a second database service and its connection/auth management |

---

## 1. Tech Stack (Final)

**Frontend**
- Next.js (React) + TypeScript
- Tailwind CSS + shadcn/ui
- React Flow (Knowledge Graph explorer view — **core deliverable**, not stretch; build alongside the dashboards in Phase 3)

**Backend**
- FastAPI (async)
- LangChain for RAG orchestration and prompt chains
- Cohere for extraction, reasoning, RCA generation, vision/OCR, and embeddings

**Data Layer**
- PostgreSQL via Supabase, with `pgvector` extension
- Single schema covering documents, entities, relationships, vector chunks, users/sessions (see architecture doc for exact schema)

**Hosting**
- Frontend → Vercel
- Backend → Render
- Database → Supabase (managed Postgres)

---

## 2. Step-by-Step Execution Roadmap

### Phase 1 — Foundation & Data (Days 1-2)
1. Define the industrial ontology: node types (Equipment, Component, WorkOrder, Procedure, Standard) and edge types (HAS_PART, MAINTAINED_BY, GOVERNED_BY)
2. Provision Supabase project, enable `pgvector`, create a Storage bucket for raw files, create schema (documents with storage_url, entities with source_page, entity_relationships, vector_chunks with page_number)
3. Generate synthetic dataset: manuals, work orders, P&IDs (as structured/simplified diagrams), safety/compliance docs for one equipment type
4. Build ingestion script: upload raw file to Storage → parse (capturing page/section numbers) → extract entities (Cohere, structured JSON output, tagged with source page) → chunk + embed (Cohere, tagged with page number) → write to Postgres

**Checkpoint:** run ingestion end-to-end on 5 test documents; manually verify entity extraction accuracy before scaling to the full 30-40 doc set.

### Phase 2 — RAG Backend & Agent Logic (Days 3-5)
1. FastAPI setup with async routes for query, upload, and dashboard endpoints
2. Query Router: classify incoming questions into Copilot / RCA / Compliance / Lessons-Learned paths
3. Expert Copilot Agent: hybrid retrieval — pgvector similarity search + recursive CTE graph traversal — combined into one Cohere prompt with citation formatting
4. RCA Agent: prompt chain that pulls an equipment's full history (work orders + manuals via graph traversal) and generates a structured RCA report
5. Compliance Agent: diff an uploaded procedure against stored regulatory chunks, return gap list
6. **Citation utility**: shared `format_citations()` function used by all four agents, mapping retrieved chunks/entities to `{filename, page, storage_url}` and returning them alongside the answer text (see architecture doc, Section 5) — build this once, reuse everywhere, so citations aren't a per-agent afterthought

**Checkpoint:** validate against 5-10 domain-expert benchmark questions before moving to frontend polish.

### Phase 3 — Frontend & UX (Days 6-8)
1. Next.js app scaffold, dark-mode-first theme, mobile-responsive layout from the start (not retrofitted later)
2. Copilot Chat UI: streaming responses, markdown rendering, **clickable inline citation markers `[1] [2]` that open the source file at the exact page** (`#page=N` works in-browser for PDFs, no custom viewer needed), confidence badge
3. Dashboards: high-risk equipment view, Lessons Learned feed — reuse the same citation chip component so RCA reports and compliance gap lists are also click-through to source documents
4. Knowledge Graph explorer (React Flow) — **core deliverable**: interactive node/edge view of the Centrifugal Pump ontology (Equipment → Component/WorkOrder/Procedure/Standard), clickable nodes opening the same citation/source-file link pattern used elsewhere

### Phase 4 — Integration, Testing & Deploy (Days 9-10)
1. Wire all frontend components to FastAPI endpoints
2. Latency check: confirm queries return within 3-5s target; add simple in-memory caching for repeated queries
3. Load test with `locust` simulating 40-50 concurrent users against the query endpoint
4. Deploy: backend → Render, frontend → Vercel, confirm Supabase connection pooling is configured
5. Record demo video, finalize architecture diagram and pitch deck

---

## 3. Verification Plan

**Automated**
- Entity extraction unit test against 5 known documents — target 90%+ equipment tag recall
- Load test via `locust` for 50 concurrent users on the Copilot query endpoint

**Manual**
- Domain-expert question run-through: confirm answers correctly pull from both vector chunks and graph relationships (the GraphRAG claim needs to visibly work in the demo)
- **Citation check**: for every benchmark question, click each citation and confirm it opens the correct source file at the correct page — not just that a citation label appears
- Mobile responsiveness check on the Field Technician chat flow specifically

---

## 4. What Changed From the Original Plan (and why)

| Original | Revised | Reason |
|---|---|---|
| LlamaIndex | LangChain | You already know LangChain; new framework adds unnecessary risk |
| OpenAI GPT-4o + text-embedding-3-small | Cohere (command-r + embed-v3) | Unified API, fewer providers to manage |
| Azure Document Intelligence for OCR | Cohere Vision | No new API account, natively multimodal |
| Unscoped "1-2 equipment types" | Locked to 1 equipment type, ~30-40 docs | Removes an open decision that would otherwise eat planning time |

This keeps every capability the judges are scoring — entity extraction, GraphRAG query quality, graph linkage, compliance gap detection — while removing three new tools you'd otherwise be learning under deadline pressure.
