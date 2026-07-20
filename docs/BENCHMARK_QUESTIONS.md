# Benchmark Questions — Verification Test Set
Synthetic domain-expert questions for testing the Copilot, RCA, Compliance, and Lessons Learned agents against the Centrifugal Pump seed dataset. Use these for the manual verification pass in `implementation_plan_detailed.md`.

Naming convention used throughout (keep consistent when generating seed documents): equipment IDs like `Pump-101`, `Pump-204`; work orders like `WO-489`, `WO-501`, `WO-552`; standards like `OISD-Standard-105`.

---

## Copilot — General Q&A (tests vector search + graph traversal together)
1. What is the rated operating pressure for Pump-101, and when was it last inspected?
   - *Should pull from: OEM manual (vector) + inspection work order (graph link)*
2. What type of seal does Pump-101 use, and what is the OEM-recommended replacement interval?
3. Which components make up Pump-101's assembly, according to the manual?
   - *Tests HAS_PART graph traversal*
4. What safety precautions are required before performing maintenance on Pump-101?
5. Show me the maintenance history for Pump-101 over the last 6 months.
   - *Tests MAINTAINED_BY graph traversal, multiple work orders*

## RCA Agent (tests multi-document synthesis + structured output)
6. Pump-101 failed last week — what's the probable root cause based on its history?
   - *Should synthesize: overdue maintenance interval, prior seal replacement record, manual spec*
7. Why do centrifugal pumps like Pump-101 typically experience seal failure, and does the maintenance record show any missed intervals?
8. Which equipment currently has the highest failure frequency, and why?
   - *Tests /agents/rca/high-risk aggregation*

## Compliance Agent (tests gap detection against regulatory standards)
9. Upload the maintenance procedure for Pump-101 and check it against OISD-Standard-105 — are there any missing safety steps?
   - *Seed one intentionally incomplete procedure (e.g. missing lockout-tagout verification) to confirm the agent actually catches it, not just passes everything*
10. Does the current isolation procedure for Pump-101 meet the PPE requirements specified in the governing standard?

## Lessons Learned Agent (tests pattern detection across incidents)
11. Have there been repeated failure patterns across pumps of the same type in the last 90 days?
    - *Seed at least 2-3 similar seal-failure incidents across 2 units to make this pattern genuinely detectable*
12. What near-miss or incident patterns should field technicians be warned about for Pump-101-type equipment?

---

## Seeding Requirements (so these questions are actually answerable)
To make questions 6-12 answerable, the synthetic dataset needs deliberate structure, not just random documents:
- At least 2 work orders for Pump-101 referencing seal replacement, with dates showing an overdue interval
- At least 1 additional pump (e.g. Pump-204) with a similar seal-failure work order, to make the "recurring pattern" in Q11 genuinely present in the data
- At least 1 procedure document with a deliberately missing step (e.g. no lockout-tagout verification), to make Q9 a real test rather than an automatic pass
- OISD-Standard-105 (or equivalent synthetic standard doc) explicitly requiring the step that's missing

## Expected Verification Outcome
For each question above, confirm:
- [ ] Answer is factually consistent with the seeded data (not hallucinated)
- [ ] At least one citation is present and clicks through to the correct file/page
- [ ] Where multiple document types are involved (manual + work order, procedure + standard), the answer visibly draws from both — this is what proves GraphRAG and cross-functional linkage are actually working, not just vector search alone
