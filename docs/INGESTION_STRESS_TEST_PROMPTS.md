# Ingestion Stress-Test Suite
Purpose: test Feature 1's ingestion pipeline against every format type named in the challenge brief, plus documents deliberately designed to hit the failure modes already found (false-positive table detection, 0-entity extraction) and their positive-case counterparts, so you have a clean pass/fail baseline instead of guessing from one example.

This is separate from `SEED_DATA.md` (built to make `BENCHMARK_QUESTIONS.md` answerable) — these documents test the *pipeline's* correctness, not the *agents'* answer quality.

---

## 1. Real Table PDF — tests the POSITIVE case for table detection

```
Write the content of a spare parts list for a centrifugal pump tagged "Pump-101," as it would appear in a maintenance parts catalog. Format it as an ACTUAL markdown table with columns: Part Number | Description | Quantity | Unit Cost (INR). Include 6 real-looking rows (e.g. mechanical seal, impeller, bearing set, gasket kit, coupling, shaft sleeve) with plausible part numbers and prices. This must render as a genuine multi-row, multi-column table when converted to PDF — not prose describing a table.
```

**Expected output when ingested:**
- Exactly ONE chunk for this content (not 2-3 near-duplicates like WO-489 produced)
- The chunk correctly labeled/flagged as table-derived — this time it's genuinely true, so the label should appear
- `pdfplumber`'s `extract_tables()` should return actual row/column data, not just fall back to `extract_text()`
- 6 entities extracted (one per part), each with `properties` containing part_number, description, quantity, unit_cost
- **This is the control for the WO-489 bug:** WO-489 tested the false-positive (prose mislabeled as table); this tests the true-positive (real table correctly detected). If this document does NOT get the table treatment, or produces the same duplicate-chunk pattern as WO-489, the bug isn't just "detects tables where none exist" — it's "table detection doesn't work at all," which is a bigger problem.

---

## 2. Scanned Form (image) — tests the Vision/OCR path specifically, with realistic noise

```
Generate an image of a filled-out industrial equipment inspection checklist form, styled to look like a scanned paper document (not a clean digital PDF) — slight skew (2-3 degrees), mild paper texture/shadow, slightly uneven scan lighting. The form should have printed field labels and handwritten-style filled values:
- Equipment Tag: Pump-101
- Inspector Name: R. Sharma
- Date: [any recent date]
- Checklist items (checkboxes, some checked): Seal condition OK, Vibration within limits, No visible leakage, Bearing temperature normal
- One field intentionally illegible/smudged (e.g. a handwritten note in the "Remarks" section that's genuinely hard to read even for a human)
```

**Expected output when ingested:**
- Gemini Vision should correctly extract: equipment tag, inspector name, date, and the checkbox states with reasonably high confidence
- The intentionally illegible remarks field should produce either a low `ocr_confidence` score (if Feature 7 v2 is implemented) or be flagged/omitted rather than confidently hallucinated — **this is the test**: does the system admit uncertainty on a genuinely unclear field, or does it confidently invent plausible-sounding text? The second outcome is a real problem worth knowing about before a demo.
- `source_page`/`page_number` should still populate correctly even though this is an image, not a text PDF

---

## 3. Email Archive (.eml) with attachment — tests a format never tested before

```
Write the content of an email thread (2-3 messages) discussing Pump-204's recent seal failure, in the format of an exported email:

From: J. Menon <j.menon@plant.example>
To: R. Sharma <r.sharma@plant.example>
Subject: Re: Pump-204 seal failure — inspection interval

Body: informal discussion where J. Menon suggests extending Pump-204's inspection interval from 3 months to 4 months based on recent field observations, and R. Sharma replies agreeing but asking for it to be documented properly. Include realistic email formatting (date headers, quoted reply text below).

Also describe a one-page PDF attachment: a brief informal memo titled "Pump-204 Interval Change Proposal" summarizing the same proposal in 3-4 sentences, unsigned, no official letterhead — clearly informal/pre-approval, not a finalized procedure.
```
Save the email portion as a `.eml` file (standard email format — can construct manually with `From:`/`To:`/`Subject:`/`Date:` headers followed by body text) and the attachment as a separate PDF, matching whatever attachment-handling your `.eml` parser expects.

**Expected output when ingested:**
- Two separate `documents` rows created: one `type='email'` for the thread, one `type='memo'` or similar for the attachment PDF
- `Personnel` entities extracted for J. Menon and R. Sharma (this only works if Personnel was added as a 6th ontology type — if it wasn't, this will correctly show 0 personnel entities, which tells you that gap is still open)
- A `DISCUSSED_IN` (or equivalent) edge linking Pump-204 to the email document
- **This document is intentionally informal/pre-approval** — if your Compliance agent or Copilot ever cites this email as if it were an approved procedure change, that's a real problem: informal email discussion should never carry the same authority as an approved document. Worth checking explicitly.

---

## 4. Multi-Sheet Spreadsheet — tests a common real bug (only reading the first sheet)

```
Generate a CSV representing what would be Sheet 1 of a multi-sheet Excel workbook: 6 rows of routine work orders for Pump-305 (invent this as a new pump ID), columns: work_order_id, equipment_id, work_type, date_completed, status.

Generate a second CSV representing Sheet 2: 6 more rows of work orders, this time for Pump-410 (another new pump ID), same columns.
```
If your test tooling supports it, combine these into one actual .xlsx file with two named sheets ("WorkOrders_Q1", "WorkOrders_Q2"). If not, test them as two separate CSV uploads and confirm both ingest correctly — the point is confirming multi-sheet/multi-file handling isn't silently dropping data.

**Expected output when ingested:**
- All 12 rows across both sheets/files produce entities — a common bug is only reading the first sheet of an .xlsx and silently ignoring the rest. Query the DB and count: you should see work orders for both Pump-305 and Pump-410, not just one.

---

## 5. Deliberately Blank/Low-Content Page — tests that 0 entities is SOMETIMES correct

```
Write the content of a plain document cover/title page: just a title ("Pump-101 Documentation Package"), a company name placeholder, and a revision number. No technical content, no equipment specs, no dates, nothing extractable.
```

**Expected output when ingested:**
- **0 entities extracted is the CORRECT result here** — this is the control case for the WO-489 bug. WO-489 had real facts and got 0 entities (broken). This document has no facts and should also get 0 entities (correct). Without this control, you can't actually tell "extraction is broken" apart from "there was nothing to extract" — now you can compare the two directly.
- Confirm the document still reaches `pending_review` normally rather than erroring out just because it's sparse

---

## 6. Ambiguous Multi-Equipment Reference — tests entity attribution accuracy

```
Write a short paragraph (150-200 words) discussing both Pump-101 and Pump-204 in the same text, where facts about each are interleaved rather than clearly separated — e.g. "Pump-101 was inspected on March 3rd and showed normal vibration; unlike Pump-204, which required seal replacement the same week after showing elevated temperature readings that Pump-101 did not exhibit." Make it require careful reading to correctly attribute which fact belongs to which pump.
```

**Expected output when ingested:**
- Entities correctly separate Pump-101's facts (inspected March 3rd, normal vibration) from Pump-204's facts (seal replacement, elevated temperature) — not merged or cross-attributed
- This is a real test of extraction quality, not just presence — a model can "extract entities" while still getting the attribution wrong, and a wrong attribution here is worse than no extraction at all if it later feeds a wrong RCA or Compliance answer

---

## How to use this suite
1. Generate all 6 (plus attachment for #3) using the prompts above
2. Ingest each one individually, not in a batch — easier to isolate which one causes a problem
3. Compare actual output against the "Expected output" section for each before moving to the next
4. Anything that doesn't match: that's a real bug, prioritized by how close it is to something judges will actually see live (the false-positive/attribution bugs matter more than the multi-sheet edge case, for example)
