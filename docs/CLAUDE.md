# CLAUDE.md
Project context and operating rules for any AI coding agent (Claude Code, Cursor, etc.) working in this repository.

## Project Overview
Industrial Knowledge Intelligence Platform — ingests heterogeneous industrial documents (manuals, work orders, P&IDs, safety/compliance docs) scoped to **Centrifugal Pump** equipment, builds a queryable knowledge graph + vector index, and serves it through six features: Ingestion Pipeline, Expert Copilot (RAG/GraphRAG), Maintenance RCA Agent, Compliance Intelligence, Lessons Learned Engine, and a Knowledge Graph Explorer UI. Built for a hackathon demo at 40-50 concurrent users.

Read `docs/system_architecture_and_data_flow.md` and `docs/implementation_plan_detailed.md` before making any structural change. This file governs *how* to work in the repo; those files govern *what* to build.

## Locked Tech Stack — DO NOT CHANGE WITHOUT EXPLICIT APPROVAL
These decisions were made deliberately to reduce risk on a time-boxed build. If you (the agent) find yourself about to install, suggest, or scaffold anything outside this list, STOP and ask the user first — do not silently substitute a "better" or "more standard" alternative.

| Layer | Locked choice | Explicitly NOT this |
|---|---|---|
| Frontend | React (Vite SPA) + TypeScript, Tailwind CSS v4 | Create React App, plain CSS, Material UI |
| Backend | FastAPI (async) | Flask, Django, Express |
| AI orchestration | LangChain | LlamaIndex |
| LLM | Cohere (command-r-08-2024) | OpenAI GPT-4o, Gemini, other providers |
| Embeddings | Cohere (embed-english-v3.0) | Voyage AI, text-embedding-3-small |
| Database | PostgreSQL (Supabase) + pgvector extension, ONE instance | Neo4j, Qdrant, Pinecone, or any second database |
| File storage | Supabase Storage | S3, local filesystem in production |
| Hosting | Vercel (frontend), Render (backend), Supabase (DB) | AWS, GCP, Azure |
| Graph model | Relational tables (`entities`, `entity_relationships`) queried via recursive CTEs | A dedicated graph database |

This has happened before on a related project: an AI coding session silently reverted a locked dependency choice back to a "default" the model was more familiar with. Treat this table as non-negotiable unless the user explicitly says otherwise in the current conversation.

## Locked Scope Decisions
- **Equipment type:** Centrifugal Pump only. Do not generalize the schema or seed data to other equipment types without being asked.
- **Knowledge Graph Explorer (React Flow UI):** core deliverable (Feature 6), not a stretch goal. Don't deprioritize it under time pressure without flagging that to the user first.
- **Benchmark questions:** synthetic, already written in `docs/BENCHMARK_QUESTIONS.md` — use these for verification, don't invent new ones ad hoc.
- **HITL Verification (Feature 7) gates everything.** No document is queryable by any agent until `documents.status = 'approved'`. This filter is applied once at the shared query-builder level — never bypass it in an individual agent for convenience, even during local testing.
- **`is_locked` protects human edits.** The `/improve` re-extraction endpoint must never touch a row where `is_locked = true`. This is the single most important invariant in the ingestion pipeline — breaking it silently destroys human corrections.

## Repository Structure (target)
```
/frontend          React Vite app
  /src/pages       Vite SPA pages (Copilot, Ingestion, KnowledgeGraph)
  /src/layouts     Main UI layouts (Sidebar, Header)
  /src/components  Shared UI components
  /src/lib         API client, types
/backend
  /agents          copilot.py, rca.py, compliance.py, lessons_learned.py
  /ingestion       parse.py, extract.py, chunk_embed.py
  /routers         FastAPI route modules, one per feature (includes graph.py)
  /db              schema.sql, migrations/, queries/ (recursive CTEs live here)
  /shared          citation.py (format_citations utility — used by ALL agents)
/docs               README, architecture, implementation plan, API contract, benchmark questions
```

## Core Conventions
- **Citations are mandatory, not optional.** Every agent response (Copilot, RCA, Compliance, Lessons Learned) and every Graph Explorer node click must resolve through the shared `format_citations()` utility in `/backend/shared/citation.py`. Do not build a one-off citation implementation inside an individual agent or the graph endpoint.
- **Graph queries live in `/backend/db/queries/`, not inline in agent code.** Recursive CTEs should be named, tested, and reused (e.g. `get_equipment_history(equipment_id)`), not copy-pasted per agent or per the graph explorer endpoint.
- **All entity extraction and chunking must tag source page/section.** Never write a `vector_chunks` or `entities` row without `page_number` / `source_page` populated — citations depend on it.
- **Environment variables**, never hardcoded keys: `COHERE_API_KEY`, `SUPABASE_URL`, `SUPABASE_SERVICE_KEY`. Reference `.env.example`, keep real values out of the repo.
- **TypeScript on the frontend is strict** — no `any` without a comment explaining why.
- **Python backend uses type hints** on all function signatures.
- **API shapes match `docs/API_CONTRACT.md` exactly.** If a shape needs to change, update that file first and flag it — don't let frontend and backend drift out of sync.
- **Background Tasks:** Document ingestion rate limits are strictly enforced by a persistent singleton worker (`worker.py`) polling the database. Do not use fire-and-forget `BackgroundTasks` for ingestion tasks to avoid 429 Resource Exhaustion from Cohere API.

## Before Adding Any New Dependency
Ask: does this duplicate something already in the locked stack? If yes, don't add it — extend what's there instead. If genuinely new and necessary, flag it to the user rather than installing silently.

## Commands
```bash
# Backend
cd backend && uvicorn main:app --reload

# Frontend
cd frontend && npm run dev

# DB migrations
cd backend && python -m db.migrate
```

## When Implementing a Feature
1. Re-read the relevant feature section in `docs/implementation_plan_detailed.md` first.
2. Check the Definition of Done for that feature before marking it complete.
3. Test against the relevant questions in `docs/BENCHMARK_QUESTIONS.md` where applicable.
4. If a requirement is ambiguous or missing, ask the user — do not assume and build silently, especially for schema or agent-behavior decisions.
5. New agent behavior or schema changes go through the process in `CONTRIBUTING.md`.
