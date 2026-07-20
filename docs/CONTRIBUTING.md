# CONTRIBUTING.md
Governance for this repository. Applies equally to human contributors and AI coding agents (Claude Code, Cursor, etc.). This file exists specifically because AI coding sessions have, in past projects, silently reverted locked decisions back to "defaults" — the rules below are designed to catch that before it merges.

## Golden Rules (Non-Negotiable)
1. **Never change the locked tech stack** in `CLAUDE.md` without the user explicitly approving it in the current session. "This is more standard" or "this is usually better" is not approval.
2. **Never add a second database, vector store, or LLM provider.** If a feature seems to need one, stop and raise it as a question — don't install it and continue.
3. **Never remove or bypass the citation utility.** Any agent response that skips `format_citations()` is incomplete, not "simplified."
4. **Never silently change a database schema.** Schema changes require a migration file and a one-line note in the PR description explaining why.
5. **Never fabricate data or citations.** If a retrieval returns nothing, the agent must say so — it must not generate a plausible-looking but unsourced answer.
6. **Never drop or deprioritize the Knowledge Graph Explorer.** It's a core deliverable (Feature 6), not a stretch goal — if time pressure makes it tempting to cut, flag that to the user rather than quietly deprioritizing it.
7. **Never expand scope beyond Centrifugal Pump** without the user asking for it.
8. **Never let an unapproved document reach any query agent.** The `documents.status = 'approved'` filter is applied once, centrally, at the query-builder level — never add a code path that queries chunks/entities without it, even temporarily for testing.
9. **Never let the `/improve` re-extraction endpoint touch a locked row.** `is_locked = true` means a human corrected it; regenerating or deleting that row defeats the entire purpose of the review dashboard.
10. **Never bypass the Ingestion Queue.** Document ingestion runs through a persistent singleton worker (`worker.py`) to enforce strict API rate limits (e.g. 3 RPM for Voyage AI). Never use fire-and-forget `BackgroundTasks` for ingestion processing.

## Spec-First Workflow
This project is built spec-first for AI-agent execution:
1. Every feature has a section in `docs/implementation_plan_detailed.md` with a Definition of Done.
2. Before writing code, confirm the relevant spec section is being followed as written. If it's ambiguous, ask — don't infer silently.
3. After implementing, check the work against the Definition of Done explicitly before calling it complete, and test against the relevant questions in `docs/BENCHMARK_QUESTIONS.md`.
4. If you (the agent) deviate from the spec for a good reason, say so out loud in the PR description or commit message — don't deviate quietly.

## Branch & Commit Conventions
- Branch naming: `feature/<short-name>`, `fix/<short-name>`
- Commit format: `<type>: <summary>` where type is one of `feat`, `fix`, `refactor`, `docs`, `test`
  - e.g. `feat: add RCA agent citation formatting`
- One feature per PR where possible — the seven platform features (Ingestion, HITL Verification, Copilot, RCA, Compliance, Lessons Learned, Knowledge Graph Explorer) should generally map to separate PRs, not one giant commit.

## Schema Change Process
1. Write the migration in `/backend/db/migrations/`.
2. Update the schema reference table in `docs/system_architecture_and_data_flow.md`.
3. Note in the PR: what changed, why, and which agents/queries are affected.
4. Do not modify `vector_chunks` or `entities` core columns (`page_number`, `source_page`, `document_id`) without flagging it — citations depend on these directly.

## Code Review Checklist (self-check before marking a task done)
- [ ] Does this follow the locked tech stack in `CLAUDE.md`?
- [ ] If this is an agent (Copilot/RCA/Compliance/Lessons Learned) or the Graph Explorer, does it return citations correctly via `format_citations()`?
- [ ] If this touches ingestion, is `page_number` / `source_page` populated on every new row?
- [ ] Are secrets read from environment variables, not hardcoded?
- [ ] Does this match the Definition of Done in `docs/implementation_plan_detailed.md` for the relevant feature?
- [ ] Does the API shape match `docs/API_CONTRACT.md`?
- [ ] If anything was ambiguous, was it flagged/asked rather than assumed?

## Definition of "Done" for a Feature
A feature is not done when it runs. It's done when:
- It matches its spec in `docs/implementation_plan_detailed.md`
- It returns citations correctly (if it's agent-facing or the Graph Explorer)
- It's been tested against the relevant questions in `docs/BENCHMARK_QUESTIONS.md`
- Any schema or stack changes are documented per the process above

## Handling Ambiguity
If a requirement is unclear, missing, or seems to conflict with the locked stack — **ask the user**. Do not:
- Pick the "most common" interpretation and proceed silently
- Add a new tool/library to work around a constraint
- Simplify a requirement (e.g. dropping citations "for now") without saying so explicitly

## Reporting Deviations
If, partway through implementation, you realize the spec doesn't quite work as written (e.g. a recursive CTE performs poorly, a Gemini prompt needs restructuring), stop and report it rather than quietly rearchitecting. Small tactical fixes are fine; anything that changes the shape of a feature or the schema needs a flag.
