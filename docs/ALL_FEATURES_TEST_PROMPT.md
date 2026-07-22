# Full Feature Test Prompt (Features 1-8)
Give this to your coding agent once you've confirmed the actual current stack (Vite/Cohere question above). Do not run this until the WO-489-style bugs are fixed — testing Features 2-6 on top of broken extraction will produce misleading results, since they all depend on Feature 1's output being correct.

This file has two parts: the agent-executed prompt below (DB/API-level checks), and a manual testing checklist (things only a human clicking through the real UI can actually verify — an agent's DB query can confirm a citation *link* is correct, but not that it *looks* right, isn't cut off on mobile, or that a plant manager would actually understand the card in front of them).

---

## Part 1: Agent-Executed Prompt (DB/API-level)

## The Prompt

```
Read CLAUDE.md, CONTRIBUTING.md, docs/implementation_plan_detailed.md, docs/SEED_DATA.md, and docs/BENCHMARK_QUESTIONS.md before starting.

Run a full test pass across all 7 features. For each item, verify against actual database state or actual API responses — not a visual glance at the UI. Report a structured PASS/FAIL table, and stop immediately on the first FAIL rather than continuing past it.

## Feature 1: Ingestion
1. Re-upload WO-489_Seal_Replacement.pdf (or inspect the existing one). Query `entities` for this document_id directly. Report the actual count and contents. If it's 0, this is a P0 bug — check backend logs for a swallowed exception during Cohere extraction and report the exact error.
2. Query `vector_chunks` for this same document_id. Report how many chunks exist and whether any two have near-identical text (this document should NOT produce 3 chunks for 1 page of plain prose with no table).
3. For any chunk marked as table-extracted, confirm the source PDF page actually contains a real table (via pdfplumber's extract_tables(), not just extract_text()). Report whether the "table" label is a false positive.
4. Confirm every entities/vector_chunks row has a non-null page_number/source_page.

## Feature 2: Copilot
5. Run BENCHMARK_QUESTIONS.md items 1-5 against POST /query/copilot. For each: report the answer, whether at least one citation is present, and whether the citation link resolves to the correct file/page.
6. Confirm a document still in pending_review never appears in any answer or citation.
7. Confirm the answer draws from both vector search AND graph traversal on at least one question (not just one retrieval path).

## Feature 3: RCA Agent
8. Run BENCHMARK_QUESTIONS.md items 6-8 against the RCA endpoints. Report whether the RCA report pulls from at least 2 document types (e.g. work order + manual) and whether every claim has a citation.

## Feature 4: Compliance Agent
9. Run BENCHMARK_QUESTIONS.md items 9-10. Confirm the deliberately incomplete procedure correctly flags the missing LOTO step.
10. Report the compliance score calculation method — confirm it's computed deterministically in backend code, not generated freeform by the LLM (this was flagged as a known issue; report current status).
11. Confirm no non-standard document (e.g. a procedure file) appears under "Source Standards" in the citation list — check the `type` column on any cited document.

## Feature 5: Lessons Learned
12. Run BENCHMARK_QUESTIONS.md items 11-12 against GET /agents/lessons/feed. Confirm the seal-failure pattern across Pump-101/Pump-204 is actually detected, and that the alert text is plain-language with citations.

## Feature 6: Knowledge Graph Explorer
13. Call GET /graph/explore. Confirm all approved documents' entities appear. Confirm all 5 ontology node types (Equipment/Component/WorkOrder/Procedure/Standard) are represented if the seed data includes them.
14. Confirm clicking a document-backed node in the UI opens the source file at the correct page.

## Feature 7: HITL Verification (v1 + v2)
15. Confirm the full is_locked protection still holds: edit a chunk, note its id, trigger /improve on the same document with unrelated feedback, confirm the locked chunk is unchanged.
16. Confirm entity editing works — edit an entity property, confirm is_locked is set, confirm /improve doesn't touch it.
17. Confirm the status filter values in the UI match the actual DB enum: processing, pending_review, approved, failed (not "error").
18. Query `entities` and confirm every row has a non-null `confidence_composite` and populated `confidence_breakdown` before the document reaches pending_review.
19. Inject one deliberately hallucinated value (a fact not present anywhere in the source document) and confirm `evidence_confidence` correctly scores it low. Report the actual score.
20. Take one field tagged `critical` with an artificially high confidence score and confirm it still routes to human review — it must NOT auto-approve. This is the hard rule; report explicitly if it auto-approved, that's a P0 finding.
21. Take one field tagged `operational` with high confidence and no rule violations and confirm it DOES auto-approve.
22. Deliberately create two documents with contradictory equipment attributes (e.g. one says Pump-101 is a centrifugal pump, another implies otherwise) and confirm `cross_doc_consistency` flags the conflict.
23. Call GET /plant-manager/inbox and confirm it returns ONLY entities with required_approval_level = 3. Confirm no level-1 or level-2 item ever appears.
24. Inspect the Plant Manager UI directly and confirm zero raw chunk text or JSON is rendered anywhere on that screen — plain language only.
25. Perform one review-action (approve/correct/mark_not_present/escalate) and confirm it's recorded with a reason code, reviewer identifier, and timestamp — query the DB directly to verify, don't trust the UI alone.

## Feature 8: Tacit Knowledge Capture & Attrition Risk Engine
26. Submit a tacit knowledge note via POST /tacit-knowledge/capture for Pump-101 (e.g. "Technicians always slightly over-torque this seal bolt beyond OEM spec based on field experience"). Query `tacit_knowledge_notes` directly and confirm it was created at trust_tier = 'unverified'.
27. Query `vector_chunks` and confirm a row exists with source_type = 'tacit_knowledge' and tacit_note_id pointing to the note from step 26.
28. Ask the Copilot a question that plausibly benefits from both a document fact and the tacit note (e.g. about Pump-101 seal maintenance). Confirm the response can surface the tacit note alongside document citations, and that its citation renders as "Field Insight — [contributor], [date], [trust_tier]" — NOT as a file/page link like a document citation.
29. Confirm an unverified note is never promoted to sme_verified without an explicit PUT /tacit-knowledge/{note_id}/verify call — no auto-promotion path should exist. Try to find one; report if found.
30. Call GET /tacit-knowledge/exit-interview-template/{equipment_type} for Centrifugal Pump and confirm it returns equipment-type-specific prompts, not a generic form.
31. Submit a full exit interview via POST /tacit-knowledge/exit-interview-submit and confirm multiple linked notes are created, all tagged capture_context = 'exit_interview'.
32. Call the attrition-risk extension of GET /agents/lessons/feed and confirm at least one equipment item is correctly ranked as "documentation-rich, insight-poor" given the current seed data (i.e. has several approved documents but zero or few tacit notes).
33. Inspect the voice-capture code path and confirm it uses the browser's native Web Speech API — confirm no new backend AI provider or third-party STT dependency was added.

## Cross-Cutting
34. Confirm every citation across all agents (including Feature 8's tacit-knowledge citations) uses the shared format_citations() utility — spot-check that the citation JSON shape is consistent, with tacit-knowledge citations correctly differentiated from document citations by shape or an explicit type field.

Report format: one table, one row per numbered check, PASS/FAIL, plus the actual observed value (counts, IDs, error messages, actual confidence scores) — not "looks fine."
```

---

## Part 2: Manual Testing Checklist (you, clicking through the real app)

Do this after Part 1 passes clean. Go end to end, in this order, as if you were a first-time user in each persona — don't skip steps because "it probably works," that's exactly the assumption that let the WO-489 chunk bug and the compliance score bug ship unnoticed.

### As the Admin/Data Steward (Feature 1 + 7 reviewer view)
- [ ] Upload a brand-new document (not one already in the system). Watch it go from `processing` to `pending_review` in the UI without refreshing manually — confirm the status updates on its own (polling/websocket working)
- [ ] Open the review dashboard for it. Read the extracted entities out loud to yourself — do they actually make sense for the document, or do they look generic/wrong?
- [ ] Read the confidence breakdown for one field — can you tell at a glance *which* signal is weak, or does it still look like an opaque number to you?
- [ ] Deliberately edit a chunk with an obvious typo fix. Confirm the lock icon appears immediately, without a page reload
- [ ] Type vague AI-improvement feedback ("this seems incomplete") and click Improve — does the UI show a clear "processing" state, or does it look frozen/unresponsive during the wait?
- [ ] After improvement finishes, confirm your earlier locked edit is still there, unchanged, without having to search for it
- [ ] Approve the document. Confirm it disappears from the pending queue immediately

### As the Field Technician (Feature 2 Copilot, mobile)
- [ ] Open the Copilot on an actual phone (not just a resized browser window) — check for horizontal scrolling, cut-off buttons, or text too small to read
- [ ] Ask a question in your own words (not copy-pasted from BENCHMARK_QUESTIONS.md) — does it still answer correctly with a real-world phrasing?
- [ ] Tap a citation — does it actually open the right file at the right page on a phone browser, not just on desktop?
- [ ] Ask a question with no good answer in the data (e.g. about equipment that doesn't exist) — confirm it says so honestly instead of making something up

### As the Reliability Engineer (Feature 3 RCA + Feature 6 Graph Explorer)
- [ ] Pull up an RCA report for Pump-101 — does the reasoning read like something a real engineer would find useful, or does it feel generic/templated?
- [ ] Open the Graph Explorer, click around for 2 minutes without a script — does anything visually break, overlap, or become unreadable with the full dataset loaded (not just 2-3 test nodes)?
- [ ] Click a document-backed node and confirm the file opens correctly

### As the Compliance Officer (Feature 4)
- [ ] Re-run the two compliance tests from earlier in this conversation (LOTO missing / LOTO present) and confirm the score now moves the correct direction
- [ ] Confirm no procedure document appears mislabeled as a "Source Standard" anymore
- [ ] Read a gap recommendation out loud — is it something you could actually hand to a technician, or is it vague AI-speak?

### As the Plant Manager (Feature 7 v2 inbox)
- [ ] Open the Plant Manager dashboard fresh — before reading any documentation, can you understand what's being asked of you from the card alone, with zero technical background?
- [ ] Confirm you never see a chunk, JSON blob, or raw confidence number anywhere on this screen
- [ ] Make one Confirm and one Send Back decision — confirm the item leaves your inbox correctly after each

### As a Retiring Engineer (Feature 8)
- [ ] Use the quick-capture widget to leave one field note on an actual equipment node in the Graph Explorer, using your own phrasing
- [ ] Go through the full exit-interview wizard for Centrifugal Pump start to finish — do the prompts actually feel like they'd surface something worth capturing, or do they feel generic?
- [ ] If voice capture is built, actually test it out loud in a normal (not silent) room and check the transcription quality
- [ ] As a reviewer, verify the note, then ask the Copilot a related question and confirm the "Field Insight" citation is visually distinguishable from a document citation at a glance, not just technically different in the data

### Cross-cutting, do this last
- [ ] Time a full Copilot query end-to-end with a stopwatch, not a guess — is it actually under 5 seconds?
- [ ] Open the same session in two browser tabs and fire queries at roughly the same time — anything break, or slow to a crawl? (proxy for the 40-50 concurrent user requirement, and the point where the 5 RPM Cohere trial key will actually hurt if it's still in use)
- [ ] Step back and ask: if a judge did exactly these steps live, with no script, would anything embarrass you? Fix that thing first, whatever it is.

