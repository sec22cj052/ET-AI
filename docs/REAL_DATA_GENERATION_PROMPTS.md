# Real-Data-First Generation Prompts
Supersedes `GENERATION_PROMPTS.md` for any document where real sourcing is genuinely possible. Rule: **search for and ground content in real, publicly available sources first. Only invent a value if no real equivalent can be found after a genuine search attempt — and when you do, say so explicitly in the document's provenance note.**

This matters for the "biggest risk to your score" issue directly — a document grounded in real manufacturer specs and real regulatory text is a categorically different claim than "we made this up," even when the equipment tag (`Pump-101`) itself is fictional.

---

## The Master Instruction (paste this before each per-document prompt below, into a web-search-capable tool — Gemini with grounding, Claude with web search, Perplexity)

```
Before writing any content, search for real, publicly available source material matching what this document needs. Prioritize, in order:
1. Official manufacturer documentation (e.g. a manufacturer's own product/support domain)
2. Government or regulatory bodies (public domain — can be used directly, not just paraphrased)
3. Established industry/engineering reference sources
4. Only if none of the above yields a real match after a genuine attempt: synthesize the specific value, and mark it clearly as synthetic in the provenance note

For anything sourced from a real but copyrighted document (e.g. a manufacturer manual): paraphrase the facts into original wording. Do not reproduce their sentences verbatim. The real facts (torque values, pressure ranges, intervals) matter — their exact phrasing doesn't, and reproducing it isn't necessary and isn't permitted.

For anything sourced from a real public-domain government document (e.g. a federal regulation): direct use of the actual clause text is fine, since it carries no copyright.

At the top of every generated document, add a short "Provenance" note (this can be stripped before final formatting, but must exist in your working draft) stating: which facts are real and from where, which facts are synthetic and why no real equivalent existed, and which parts (like the specific equipment tag "Pump-101" itself, which is fictional by design for this project) are intentionally fictional regardless of data availability.
```

---

## 1. Pump-101_OEM_Manual.pdf — REAL grounding available

**Real anchor already found:** official Grundfos installation/operating manuals hosted on `net.grundfos.com` contain genuine specs — e.g. a documented torque specification of 50-60 Nm for certain fittings, real lockout/power-isolation safety language ("switch off the power supply and lock the main switch"), and real troubleshooting patterns (suction pipe leakage, air in suction pipe, low inlet pressure as failure causes).

```
Search for real Grundfos or KSB centrifugal pump installation/operation manuals (check net.grundfos.com and ksb.com directly, not aggregator/upload sites). Pull real values for: a plausible operating pressure range, a real seal type description, a real maintenance/service interval, and real safety-precaution language for isolating power before maintenance.

Paraphrase these into an OEM manual for a fictional pump tagged "Pump-101" — the equipment tag and company context are fictional, but the technical facts (pressure range, seal type, interval, safety steps) should be grounded in what you actually found, not invented. Structure with page-like breaks, a Component List section (name at least 4 real sub-components centrifugal pumps of this type genuinely have — impeller, mechanical seal, bearing housing, coupling), and a Safety Precautions section using the real isolation/lockout language you found, paraphrased.

Add the provenance note per the Master Instruction above.
```

---

## 2. Pump-101_PID.png — SYNTHETIC by necessity, not by laziness

Real P&ID engineering drawings are proprietary technical work product — plants don't publish them, and manufacturers don't either (a P&ID is site-specific, not a manufacturer artifact). There is no real public equivalent to source this from. This stays synthetic, and that's the correct call, not a shortcut — say so plainly if asked.

```
Generate a simple, clean, technical P&ID-style schematic for a centrifugal pump labeled "Pump-101" — flat line-art style, labeled components (Pump-101, Inlet Valve, Outlet Valve, Mechanical Seal, Motor, Pressure Gauge), simple title block. This is intentionally synthetic — no real public P&ID source exists to ground it in.
```

---

## 3-5. WO-489, WO-501, WO-552 (work orders/inspection) — SYNTHETIC by necessity

Real maintenance work orders are internal plant records — confidential by nature, never public, for any company. No amount of searching will find one. This is the correct, honest limitation to state, not a gap in effort. **Where real grounding IS possible:** the failure patterns and intervals themselves can be grounded in real published reliability-engineering statistics (e.g. published studies on centrifugal pump mechanical seal failure rates/intervals) rather than arbitrary invented numbers.

```
Search for real, published reliability engineering data on centrifugal pump mechanical seal failure intervals or failure rates (academic papers, industry reliability studies, manufacturer reliability data — not the internal work order itself, which won't exist publicly, but the statistical pattern behind it). Use a realistic interval/failure pattern grounded in what you find, rather than an arbitrary invented number, when writing WO-489/WO-501/WO-552's dates and failure descriptions.

The work order documents themselves remain synthetic (format, specific IDs, specific plant) — note this explicitly in the provenance note — but the underlying failure pattern should be defensible against real published data if a judge asks "where does this interval come from."
```

---

## 6. Pump-204_Summary.pdf — SYNTHETIC (internal asset record, no real equivalent)

Same reasoning as work orders — an asset register entry is internal by nature. Stays fully synthetic; no real-data step needed here.

---

## 7. Regulatory Standard — REAL, direct use (public domain)

**This replaces the fabricated "OISD-Standard-105" entirely**, per the earlier discussion — use the real U.S. federal regulation instead, which is public domain and can be used directly.

```
Retrieve the actual text of OSHA 29 CFR 1910.147, "The Control of Hazardous Energy (Lockout/Tagout)." This is a real, current, public-domain U.S. federal regulation — direct use of the clause text is legally fine, no paraphrasing required, since U.S. government works carry no copyright.

Extract and present the clauses most relevant to this project's compliance test case: the requirement for a documented lockout-tagout verification step before maintenance begins, and the requirement to secure all energy sources (electrical, mechanical, hydraulic, etc.) before work starts. Present as the "Source Standards" document, correctly labeled as OSHA 29 CFR 1910.147, not a fabricated OISD number.

Provenance note: this document is REAL, sourced directly from the actual federal regulation — no synthesis involved.
```

---

## 8. Pump-101_Maintenance_Procedure_INCOMPLETE.pdf — SYNTHETIC by design, real-shaped

This document's whole purpose is to be deliberately incomplete for testing — it can't be "real" by definition, since you're intentionally engineering a gap into it. But its *shape* (what a real maintenance SOP looks like) can be grounded in a real published template.

```
Search for a real, publicly available generic lockout/tagout or maintenance procedure template (OSHA and NIOSH both publish generic public templates for this purpose). Use its structure and section headings as the shape for this document — PPE section, isolation section, step-by-step maintenance — but do NOT include a lockout-tagout verification step, since that omission is the deliberate test case for the Compliance agent.

Provenance note: structure grounded in a real public template; the deliberate omission is intentional and not a data limitation.
```

---

## 9. Work_Orders_Batch.csv — SYNTHETIC, statistically grounded where possible

Same reasoning as items 3-5 — individual rows are necessarily synthetic (real work order logs are confidential), but work-type distribution and frequency can be grounded in real published maintenance-type distributions for rotating equipment if you find one during search; otherwise proceed with reasonable synthetic variety and say so.

---

## Summary Table — what's actually achievable

| Document | Real data status | What's real | What stays synthetic |
|---|---|---|---|
| OEM Manual | **Grounded in real specs** | Torque values, seal type pattern, safety language (paraphrased from real Grundfos docs) | Company name, "Pump-101" tag |
| P&ID | Synthetic (no real equivalent exists) | — | Everything — this is correct, not a gap |
| Work Orders (3x) | Partially grounded | Failure-interval pattern, if published reliability data is found | Specific IDs, dates, plant context |
| Pump-204 Summary | Synthetic | — | Everything |
| Regulatory Standard | **Fully real** | Entire document — actual OSHA 1910.147 text, public domain | Nothing — no synthesis needed |
| Incomplete Procedure | Synthetic, real-shaped | Document structure/template | The content and the deliberate omission |
| CSV Batch | Synthetic, statistically informed if possible | Work-type distribution, if grounded | Specific rows |

**Honest framing for your pitch:** 2 of 9 documents (Manual, Standard) are genuinely real or real-grounded. The rest are synthetic because the underlying data (work orders, P&IDs, asset records) is inherently confidential — that's true of any company's real operational data, not a gap in your effort. Say this plainly rather than letting a judge assume everything is equally fabricated.
