# Industrial Knowledge Intelligence Platform

AI-powered platform that ingests heterogeneous industrial documents (manuals, work orders, P&IDs, safety/compliance docs) for a scoped equipment type, builds a queryable knowledge graph + vector index, and serves four intelligence agents through a RAG copilot with mandatory source citations.

Built as a hackathon prototype targeting 40-50 concurrent users.

## Features
1. **Universal Document Ingestion & Knowledge Graph Pipeline** — parses PDFs, P&IDs (images), and CSV/XLSX work orders; extracts entities; builds a relational knowledge graph + vector index
2. **Expert Knowledge Copilot** — GraphRAG chat interface, mobile-responsive, cited answers with confidence scores
3. **Maintenance Intelligence & RCA Agent** — root cause analysis reports pulling from work order + manual history, plus a high-risk equipment dashboard
4. **Quality & Regulatory Compliance Intelligence** — gap analysis between uploaded procedures and stored regulatory standards
5. **Lessons Learned & Failure Intelligence Engine** — pattern detection across incident/failure records, proactive alert feed
6. **Knowledge Graph Explorer** — interactive visual graph view of the Centrifugal Pump ontology (React Flow), core deliverable
7. **Human-in-the-Loop (HITL) Verification Dashboard** — every ingested document sits in `pending_review` until a human reviews and approves it; nothing reaches the RAG Copilot or any other agent unapproved

Every agent response includes clickable citations linking directly to the source document page — see `docs/system_architecture_and_data_flow.md` Section 5 for how this works end-to-end.

## Implementation Status
**Implemented:**
- All 7 core features are fully implemented, functional, and integrated.
- End-to-end ingestion pipeline with Cohere Vision parsing.
- Expert Knowledge Copilot with GraphRAG and citations.
- Maintenance Intelligence (RCA) and Compliance Gap Analysis agents.
- Lessons Learned pattern detection.
- Knowledge Graph Explorer (React Flow).
- HITL Verification Dashboard with chunk locking and AI re-extraction.

**Remaining / Fast-Follows:**
- *Entity Editing in HITL:* Currently, the verification dashboard allows viewing entities but editing is limited to raw chunks. Inline editing for JSON entity properties is a planned fast-follow.
- *Real-world Data Load:* System is currently seeded with synthetic Centrifugal Pump data. Transitioning to real industrial P&IDs and manuals is the next phase.

## Tech Stack
| Layer | Choice |
|---|---|
| Frontend | React (Vite SPA) + TypeScript, Tailwind CSS v4 |
| Backend | FastAPI (async) |
| AI orchestration | LangChain |
| LLM | Cohere (command-r-08-2024) |
| Embeddings | Cohere (embed-english-v3.0) |
| Database | PostgreSQL (Supabase) + pgvector |
| File storage | Supabase Storage |
| Hosting | Vercel (frontend) / Render (backend) / Supabase (DB) |

Full rationale for these choices: `CLAUDE.md`.

## Project Structure
```
/frontend          React Vite app (chat UI, graph explorer, upload)
/backend
  /agents          copilot.py, rca.py, compliance.py, lessons_learned.py
  /ingestion       parse.py, extract.py, chunk_embed.py
  /routers         FastAPI route modules
  /db              schema.sql, migrations/, queries/
  /shared          citation.py
/docs               architecture, implementation plan, API contract
```

## Getting Started

### Prerequisites
- Node.js 18+
- Python 3.11+
- A Supabase project (Postgres + pgvector + Storage bucket enabled)
- API keys: Cohere

### Setup
```bash
# Clone and enter the repo
git clone <repo-url>
cd industrial-knowledge-platform

# Backend
cd backend
python -m venv venv && source venv/bin/activate
pip install -r requirements.txt
cp .env.example .env   # fill in real keys
python -m db.migrate
uvicorn main:app --reload

# Frontend (new terminal)
cd frontend
npm install
cp .env.example .env.local
npm run dev
```

Frontend runs on `http://localhost:5173`, backend on `http://localhost:8000`.

### Environment Variables
See `.env.example` in both `/frontend` and `/backend`. Required:
- `COHERE_API_KEY`
- `SUPABASE_URL`
- `SUPABASE_SERVICE_KEY`
- `NEXT_PUBLIC_API_URL` (frontend, points to backend)

## Seed Data
Demo dataset is scoped to Centrifugal Pump equipment: 9 core documents with exact required content, plus filler. See `docs/SEED_DATA.md` for the full spec — document list, exact facts each document must contain, and the generation/ingestion checklist.

## Documentation
- `CLAUDE.md` — locked tech stack and conventions for AI coding agents working in this repo
- `CONTRIBUTING.md` — governance, schema-change process, code review checklist
- `docs/implementation_plan_detailed.md` — feature-by-feature spec with Definition of Done
- `docs/system_architecture_and_data_flow.md` — full architecture, data flow, citation mechanism
- `docs/API_CONTRACT.md` — request/response schema for every endpoint
- `docs/BENCHMARK_QUESTIONS.md` — synthetic domain-expert questions used for verification
- `docs/system_architecture_diagram.mermaid` — visual architecture diagram

## Verification
- Entity extraction: target ≥90% recall on equipment tags (5-document test set)
- Load test: `locust` simulating 40-50 concurrent users against `/query/copilot`
- Manual: domain-expert benchmark questions, citation click-through check, mobile responsiveness check on the Copilot chat

## Known Limitations (hackathon scope)
- Synthetic dataset, not real industrial documents — see `docs/SEED_DATA.md` for the stated path to real data
- Knowledge graph modeled relationally in Postgres rather than a dedicated graph database — trade-off documented in `docs/system_architecture_and_data_flow.md` Section 7
- Single equipment type (Centrifugal Pump) in scope for the demo
