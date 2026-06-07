---
stepsCompleted: [step-01-document-discovery, step-02-prd-analysis, step-03-coverage, step-04-traceability, step-05-reconciliation, step-06-final-assessment]
filesIncluded:
  prd: _bmad-output/planning-artifacts/prds/prd-MiniCRM-2026-06-06/prd.md
  architecture: _bmad-output/planning-artifacts/architecture.md
  epics_index: _bmad-output/planning-artifacts/epics/index.md
  epics: epic-0..epic-6 (E0-S1..S12, E1-S1..S5, E2-S1..S4, E3-S1..S3, E4-S1..S4, E5-S1..S3, E6-S1..S4)
  ux_design: _bmad-output/planning-artifacts/ux-designs/ux-MiniCRM-2026-06-06/DESIGN.md
  ux_experience: _bmad-output/planning-artifacts/ux-designs/ux-MiniCRM-2026-06-06/EXPERIENCE.md
  ux_binding_rules: _bmad-output/planning-artifacts/ux-designs/ux-MiniCRM-2026-06-06/§8-binding-rules.md
  ux_decision_log: _bmad-output/planning-artifacts/ux-designs/ux-MiniCRM-2026-06-06/.decision-log.md
  constitution: _bmad-output/project-context.md
  decision_log: _bmad-output/decision-log.md
  correct_course: _bmad-output/planning-artifacts/sprint-change-proposal-2026-06-07.md
  prototype_behavior: Prototype/prototype-behavior.md
  prototype_tokens: Prototype/tokens/*
  prototype_screenshots: Prototype/screenshots/*
  pass1_report: _bmad-output/planning-artifacts/implementation-readiness-report-2026-06-06.md
---

# Implementation Readiness Assessment Report — Pass 2 (Post-Prototype Reconciliation)

**Date:** 2026-06-07
**Project:** MiniCRM (min-crm)
**Pass:** 2 — re-validation of AC-enriched stories after correct-course folded the prototype into the ACs.
**Pass 1 result (2026-06-06):** GO; all 10 findings remediated.

## Step 1 — Document Inventory

No format duplicates (no whole+sharded collisions). All required documents present.

| Type | Selected source | Notes |
|---|---|---|
| PRD | `prds/prd-MiniCRM-2026-06-06/prd.md` (whole, 62 KB, status: final) | Companions: reconcile-*, review-* (not authoritative) |
| Architecture | `architecture.md` (whole, 69 KB) | single file |
| Epics & Stories | `epics/` + `epics/index.md` | E0–E6, 39 story files + 7 epic files |
| UX Design | `ux-designs/ux-MiniCRM-2026-06-06/` (DESIGN, EXPERIENCE, §8-binding-rules, .decision-log) | spine |
| Constitution | `_bmad-output/project-context.md` (BINDING) | + `_bmad-output/decision-log.md` |
| Correct-course output | `sprint-change-proposal-2026-06-07.md` | GAP REPORT + CONFLICT LIST source |
| Prototype (UX oracle) | `Prototype/prototype-behavior.md`, `Prototype/tokens/*`, `Prototype/screenshots/*` | 19 JSX modules, ~50 screenshots, token CSS |

**Story file count:** E0 (12) + E1 (5) + E2 (4) + E3 (3) + E4 (4) + E5 (3) + E6 (4) = **35 backlog stories (E0–E5) + 4 Epic-6 server stories**.

---

## VERDICT — ✅ GO (conditional) for Epic 0

The AC-enriched E0–E5 backlog is **implementation-ready against the prototype**. The architecture
held through enrichment, all four escalated conflicts (C-1…C-4) were ratified *and* logged (DEC-CC-1/2/3
+ C-2 keep), the UX spine is reconciled (DEC-UX-7/8/9), coverage/traceability/scope-guard are intact,
and the prototype UX blocks are concrete enough to build identically. **Epic 0 may start now.**

Two **HIGH** findings must be fixed (one before E0 sequencing is acted on, one before Epic 3) and a
short MEDIUM/LOW fix list should be cleared. None is a structural/architectural break → **not a NO-GO**.

| Check | Area | Result |
|---|---|---|
| 1 | Coverage (35 stories E0–E5, contiguous, no dup/orphan) | ✅ PASS |
| 2 | Traceability (prd_story / adrs / constitution_refs resolve) | ✅ PASS |
| 3 | UC-inheritance after edits | ⚠️ 1 HIGH (E3-S3) |
| 4 | Dependency DAG acyclic + prereqs | ⚠️ 1 HIGH (index build-order string) |
| 5 | NFR-1…12 / ADR-001…016 ownership; ADR-016 split | ✅ PASS |
| 6 | Scope guard — Epic 6 untouched | ✅ PASS |
| 7 | Gaps closed (every gap → concrete AC) | ⚠️ 1 HIGH (customer-edit) |
| 8 | Prototype ACs sound (testable, oracle-cited, concrete) | ✅ PASS |
| 9 | No silent conflicts | ⚠️ 1 MED (C-2 not surfaced in E3-S3) |
| 10 | Token discipline | ⚠️ 1 MED + 1 LOW (literal overlay/ms) |
| 11 | Decisions settled (OQ3 etc.) | ⚠️ 1 MED + 1 LOW (E5-S2 / PRD §11 stale) |
| 12 | Spine consistency (DESIGN/EXPERIENCE/§8/decision-log) | ✅ PASS |

---

## RANKED FINDINGS

### 🔴 HIGH

**H-1 — Epic-0 build-order narrative contradicts the `depends_on` edges (Check 4).**
`epics/index.md` states the Epic-0 build order as `S1+S2 → S3+S4 → S5+S6 → S7+S8 → S9 → S10+S12 → S11`.
The story `depends_on` edges (acyclic, and themselves correct) say otherwise:
- `E0-S5 depends_on [E0-S7]` and `E0-S6 depends_on [E0-S5, E0-S7]` — so **S7 must precede S5 and S6**, but the string puts S7 in beat 4, *after* S5/S6 (beat 3).
- `E0-S4 depends_on [E0-S1,S2,S3,S5,S6,S7]` — so **S4 must come after S5/S6/S7**, but the string puts S4 in beat 2, *before* all of them.
Correct topological order from the edges: `S1 → (S2, S7) → (S3, S5, S8) → S6 → S9 → S4 → (S10, S12) → S11`.
**Why HIGH:** Epic 0 is the epic about to start; a team following the index's build-order line would
begin S4/S5/S6 before their prerequisites exist. The DAG (edges) is sound — only the human-readable
order string is stale.
**Fix:** Replace the build-order line in `epics/index.md` with the edge-derived order above (and note S7 is the auth/event prerequisite for S5/S6, S4 lands last among the kernels).

**H-2 — The customer field-edit mutation (load-bearing for the C-3 activation gate) is unowned; E3-S3 lacks UC-2 (Checks 3 & 7).**
DEC-CC-2 added `taxRegistrationNumber`/`contactAddress` and gates `onboarding → active` on both being
set (E3-S2). The *only* way to populate those fields is the `CustomerForm` create/edit — which the
prototype ships (`customers.jsx`, oracle §5.2) and which E3-S3 carries **only in its "UX & Behavior"
prose**. But:
- E3-S3's formal ACs (AC1–AC4) are all **read-only** (list / detail / lineage / Tickets-tab / four states).
- E3-S3 `inherits_uc: [UC-1, UC-5, TC]` — **no UC-2**, despite the form being a `Customer.Updated` (and `Customer.Created`) mutation.
- No other story owns "edit customer fields." (E3-S1 creates via the saga; E3-S2 only transitions status.)
**Why HIGH:** an implementer building E3-S3 from its ACs produces a read-only screen — and the C-3
activation flow ("Edit the customer to fill it in, then activate") becomes unsatisfiable; the edit
mutation also has no event/audit (UC-2) conformance owner.
**Fix:** Add a customer create/edit AC to E3-S3 (Zod-validated `CustomerForm`, `Customer.Created`/`Customer.Updated` + audit, 422 on invalid, optimistic rollback) and add **UC-2** to its `inherits_uc`; or split a dedicated "Edit customer" story. Tie the AC to the C-3 gate (editing sets the two activation fields).

### 🟠 MEDIUM

**M-1 — E5-S2 contradicts itself on OQ3 (Check 11).** The intro callout + UX block + DEC-UX-7 settle
the widget as the **conversion funnel**, but **AC1** still reads "conversion funnel OR per-subsidiary
roll-up (the choice is Open Question 3, deferred to sprint planning)", and the **Dependencies** ("OQ3
must be resolved at sprint planning before implementation") and **References** ("widget choice = Open
Question 3, deferred to sprint planning") echo the stale, undecided framing.
**Fix:** Rewrite AC1 to "renders the **conversion funnel** (OQ3 resolved → DEC-UX-7)"; drop the
"deferred to sprint planning" clauses from Dependencies and References.

**M-2 — C-2 ("support stays read-only on customers") is not surfaced in E3-S3 (Check 9).** C-2 was
ruled *keep constitution* (logged in `decision-log.md`), i.e. the prototype's `canWrite` customers =
admin/sales/**support** is the divergence we chose **not** to build. Yet E3-S3 says "build identical to
the prototype" with "role-gated Edit" and never restates C-2. Risk: an implementer replicates the
prototype's support-can-edit-customers.
**Fix:** Add an explicit note to E3-S3 (and the new edit AC from H-2): "C-2 — support is **read-only**
on customers (constitution kept); the prototype's wider `canWrite` grant is the divergence to NOT build.
Support keeps customer **read** + the status-transition for onboarding."

**M-3 — E0-S9 specifies a literal overlay color + blur, not a token (Check 10).** The E0-S9 UX block
(from the prototype) hardcodes the modal scrim as `rgba(15,22,38,0.42)` + `blur(2px)`. No DS color token
backs this (`prototype/tokens/colors_and_type.css` defines only `--iso-z-overlay: 800`, a z-index).
This contradicts NFR-10/§8.4 ("no hardcoded hex/px in components") and DESIGN.md ("No hex in this repo").
**Fix:** Reference a DS scrim/overlay token (add one to the token layer if absent) and a radius/blur
token, or log an explicit, scoped NFR-10 token exception for the overlay scrim in `decision-log.md`.

### 🟡 LOW

**L-1 — Raw/derived `ms` and opacity literals in enriched ACs (Check 10).** Several blocks carry
timings beyond the four motion tokens — `base+220ms` (E1-S1), `base+60ms`/`base+80ms` (E3-S1),
`~700ms` (optimistic-undo across forms), `max(90, base/2)` per record (E1-S3) — plus `0.55` opacity
for offboarded rows (E1-S2). §8.6 says product code references token names, never raw ms/curves.
Acceptable as JS step-cadence constants, but they should be **named constants**, not inline literals.
**Fix:** Note that these are derived cadence constants (not CSS style tokens); centralize them as named
constants so no raw ms/opacity is hardcoded in components.

**L-2 — PRD §11 OQ3 still says "decide during sprint planning" (Checks 11/12).** The PRD was outside
correct-course's edit scope (stories + spine + decision-log only), so PRD §11 OQ3 now disagrees with
the settled DEC-UX-7 / E5-S2 intro.
**Fix:** Add a one-line "RESOLVED → conversion funnel (DEC-UX-7, 2026-06-07)" note to PRD §11 OQ3.

**L-3 — E0-S6 not explicitly updated for DEC-CC-1 (Checks 9/3).** E0-S6 encodes "the §2.2 matrix" by
reference (now amended to ticket-create = all roles), so it is *transitively* correct, but its AC6
cell-test enumeration calls out only "View audit/events" and "Delete/export" — not the amended
ticket-create row. E4-S1 is explicit; E0-S6 (the kernel that encodes the matrix) is not.
**Fix:** Add the ticket-create row (all four roles) to E0-S6's cell-test enumeration for parity with the
amended §6.2 / E4-S1.

---

## What is SOLID (no action)

- **Coverage (Check 1):** exactly E0-S1…S12, E1-S1…S5, E2-S1…S4, E3-S1…S3, E4-S1…S4, E5-S1…S3 = **35
  backlog stories**, contiguous, no dup/orphan; E6-S1…S4 present as DESIGN-ONLY.
- **Traceability (Check 2):** every `prd_story`/`adrs`/`constitution_refs` resolves; ADR-001…016 all
  defined in `architecture.md` (014/15/16 pinned). E0-S12's non-PRD origin is transparently documented.
- **NFR/ADR ownership (Check 5):** NFR-1…12 each owned by an Epic-0 kernel; ADR-016 timeline-vs-audit
  split intact and applied identically across E2-S4 / E3-S3 / E4-S4 (timeline = DomainEvent, record-view
  gated, viewer included; audit = raw AuditEvent, matrix-`own` gated, viewer = none).
- **Scope guard (Check 6):** `git status` shows **no** Epic-6 file modified; only E0–E5 stories + UX
  spine + decision-log changed. Epic 6 stays server-side/no-UI.
- **Conflicts (Check 9, the rest):** C-1 adopt → E4-S1 AC1 + DEC-CC-1; C-3 adopt → E0-S2/E3-S2/E3-S3 +
  DEC-CC-2; C-4 adopt → E0-S9 + DEC-CC-3; C-5 channel defaulted decorative → E4-S1/E4-S2. All ratified
  *and* logged — nothing silently overwrote the transition maps, role matrix, or project-context.
- **Prototype ACs (Check 8):** UX blocks specify fields-in-order, columns, dropdown filters, sort,
  five list states (incl. filtered-empty), microcopy, and motion beats; each cites the screenshot oracle
  by filename; known drifts (PREVIEW STATE control, KPI dashboard, `01-edge.png` chip filters) are
  explicitly flagged "do not build."
- **Spine consistency (Check 12):** DESIGN.md / §8-binding-rules / EXPERIENCE / UX .decision-log all
  reconciled (DEC-UX-7 funnel, DEC-UX-8 easing → `prototype/tokens/motion.css`, DEC-UX-9 reduced-motion)
  and agree with the enriched stories (in-page saga inspector, four-state boundary, timeline split).

---

## FIX LIST (pre-implementation)

| # | Sev | File(s) | Action |
|---|---|---|---|
| H-1 | 🔴 | `epics/index.md` | Replace the Epic-0 build-order line with the edge-derived order `S1 → (S2,S7) → (S3,S5,S8) → S6 → S9 → S4 → (S10,S12) → S11`. |
| H-2 | 🔴 | `E3-S3.md` | Add a Customer create/edit AC (`CustomerForm`, `Customer.Created`/`Updated` + audit, 422, optimistic rollback) tied to the C-3 activation fields; add **UC-2** to `inherits_uc`. |
| M-1 | 🟠 | `E5-S2.md` | Rewrite AC1 to the **conversion funnel** (OQ3 resolved); drop "deferred to sprint planning" from Dependencies + References. |
| M-2 | 🟠 | `E3-S3.md` | Add an explicit "C-2 — support read-only on customers; do not build the prototype's wider grant" note. |
| M-3 | 🟠 | `E0-S9.md` (+ token layer) | Replace literal `rgba(15,22,38,0.42)`/`blur(2px)` scrim with a DS overlay token, or log a scoped NFR-10 exception. |
| L-1 | 🟡 | enriched UX blocks | Treat `base+Δ` / `~700ms` / `max(90,base/2)` / `0.55` as named cadence constants, not inline literals. |
| L-2 | 🟡 | `prd.md` §11 | Note OQ3 RESOLVED → funnel (DEC-UX-7). |
| L-3 | 🟡 | `E0-S6.md` | Add the ticket-create (all-roles) row to the cell-test enumeration (DEC-CC-1 parity). |

**Recommendation:** Start Epic 0 now. Apply **H-1 immediately** (it governs E0 sequencing) and **H-2
before Epic 3 kicks off**. M-1…M-3 are quick story edits; L-1…L-3 are housekeeping. None gates the
Epic-0 kernels (S1/S2/S7/S3/S8/S9), which are unaffected by every finding above.

---

## ADDENDUM — fix list applied (2026-06-07, post-report)

All 8 findings were remediated in-place after the verdict:

| # | Status | Edit |
|---|---|---|
| H-1 | ✅ fixed | `epics/index.md` build-order replaced with edge-derived order `S1 → (S2,S7) → (S3,S5,S8) → S6 → S9 → S4 → (S10,S12) → S11`. |
| H-2 | ✅ fixed | `E3-S3`: added **AC5** (CustomerForm create/edit, 4-beat + 422 + rollback, sets the DEC-CC-2 fields) + **UC-2** in `inherits_uc`; deps gain E0-S9; modules/ADRs/§refs/tests updated. |
| M-1 | ✅ fixed | `E5-S2` AC1 + Dependencies + References rewritten to "conversion funnel (OQ3 resolved → DEC-UX-7)"; no "deferred to sprint planning" remains. |
| M-2 | ✅ fixed | `E3-S3` **AC6** + UX block + decision-log: C-2 surfaced (support read-only on customers; do not rebuild the prototype's wider grant). |
| M-3 | ✅ fixed | `E0-S9` scrim now references a DS `--iso-overlay-scrim` + blur token (raw `rgba()/px` logged as realized value only); **DEC-CC-4** added to `decision-log.md`. |
| L-1 | ✅ fixed | §8.6 (both `§8-binding-rules.md` and `project-context.md`): derived step-cadence values are named JS constants, never inline raw ms/opacity. |
| L-2 | ✅ fixed | `prd.md` §11 OQ3 marked RESOLVED → conversion funnel (DEC-UX-7). |
| L-3 | ✅ fixed | `E0-S6` AC3 + tests enumerate the amended ticket-create (all-roles, DEC-CC-1) and customer-create (C-2) rows. |

**Net state:** all 12 checks now PASS. Epic 0 is clear to start.
