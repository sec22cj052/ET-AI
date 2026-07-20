# Seed Data Specification
### Centrifugal Pump — Synthetic Demo Dataset

This is the concrete document list behind `BENCHMARK_QUESTIONS.md`'s "Seeding Requirements." Every document here exists because a specific benchmark question or Feature 7 test case needs it to be answerable/testable. Generate with Gemini, ingest through Feature 1, review/approve through Feature 7 — this also serves as your first real end-to-end test of the full pipeline.

Naming convention: equipment `Pump-101` / `Pump-204`, work orders `WO-###`, standards `OISD-Standard-###`.

---

## Document List

| # | Filename | Type | Doc Type Tag | Purpose |
|---|---|---|---|---|
| 1 | `Pump-101_OEM_Manual.pdf` | PDF (text) | `manual` | Core spec source — operating pressure, seal type, component list, maintenance interval |
| 2 | `Pump-101_PID.png` | Image | `pid` | Tests Gemini Vision parsing path; simplified P&ID showing Pump-101 + component tags |
| 3 | `WO-489_Seal_Replacement.pdf` | PDF (text) | `work_order` | Pump-101 seal replacement, dated to make the next replacement overdue |
| 4 | `WO-501_Seal_Replacement.pdf` | PDF (text) | `work_order` | **Pump-204's** seal failure — makes the recurring-pattern question (BQ11) true |
| 5 | `WO-552_Inspection.pdf` | PDF (text) | `work_order` | Pump-101 inspection record, referenced by Copilot benchmark question BQ1 |
| 6 | `Pump-204_Summary.pdf` | PDF (text) | `manual` | Minimal second-equipment record, just enough for BQ8/BQ11 to have a real comparison point |
| 7 | `OISD-Standard-105.pdf` | PDF (text) | `standard` | Regulatory standard requiring lockout-tagout verification before maintenance |
| 8 | `Pump-101_Maintenance_Procedure_INCOMPLETE.pdf` | PDF (text) | `safety_procedure` | **Deliberately missing** the lockout-tagout verification step required by doc #7 — this is what BQ9 (Compliance) must catch |
| 9 | `Work_Orders_Batch.csv` | CSV | `work_order` | 10-15 rows of routine work orders (not centrally referenced by any benchmark question) — tests the CSV/XLSX ingestion path and gives the dashboard/high-risk equipment list realistic volume |

9 documents get every ingestion path exercised (PDF text, image/Vision, CSV) and every benchmark question answerable. Pad with a few more routine, non-critical documents from the CSV batch if you want closer to the 30-40 doc target from the original plan — the 9 above are the ones that must exist with exact content; the rest can be generic filler.

---

## Exact Content Requirements (what must be true in each document)

**`Pump-101_OEM_Manual.pdf`**
- States operating pressure explicitly (e.g. "12 bar")
- States seal type and OEM-recommended replacement interval (e.g. "every 12 months")
- Lists at least 3 components (for `HAS_PART` graph edges)
- Includes a safety precautions section (for BQ4)

**`WO-489_Seal_Replacement.pdf`** (Pump-101)
- Dated ~14 months before the "current" demo date — deliberately exceeds the 12-month interval from the manual, so RCA (BQ6) has a real overdue-maintenance cause to find

**`WO-501_Seal_Replacement.pdf`** (Pump-204)
- Similar seal-failure description to WO-489, different equipment — this pairing is what makes BQ11 ("recurring pattern across 2 units") genuinely detectable rather than fabricated

**`OISD-Standard-105.pdf`**
- Explicitly states: maintenance procedures must include a lockout-tagout verification step before work begins
- Also states a PPE requirement (so BQ10 has a "compliant section" to find, not just gaps)

**`Pump-101_Maintenance_Procedure_INCOMPLETE.pdf`**
- Contains PPE requirements and isolation steps (should read as compliant on those)
- Does NOT contain a lockout-tagout verification step — this omission is what the Compliance agent must catch

---

## Generation Approach
1. Draft each document's required facts (above) as a short outline
2. Use Gemini to expand each outline into realistic industrial document prose/formatting
3. For the P&ID image, generate a simplified schematic-style image (labeled boxes/lines is sufficient — doesn't need to be a real engineering-standard P&ID)
4. Keep a local record (spreadsheet or this file, updated) of exactly which fact lives in which document/page — you'll need this to verify Copilot answers and citations are actually correct, not just plausible-sounding

## Ingestion & Approval Checklist (also your Feature 7 end-to-end test)
- [ ] Upload all 9 documents through `/ingest/upload`
- [ ] Confirm each lands in `pending_review`
- [ ] Open the review dashboard for at least one document, manually edit a chunk (locks it)
- [ ] On a different document, use "Improve via AI" with real feedback (e.g. "you missed the PPE section") and confirm the locked chunk from the previous step is unaffected — real-data version of the earlier SQL-level verification
- [ ] Approve all 9 documents
- [ ] Confirm all 9 now show `status = approved` and are visible in `/graph/explore`

## Verification Tie-Back
Once ingested and approved, every question in `BENCHMARK_QUESTIONS.md` should be answerable against this exact dataset. If a question can't be answered correctly, the gap is either in this seed data (missing/ambiguous fact) or in the retrieval/agent logic — worth distinguishing which before debugging Feature 2/3/4/5 code.
