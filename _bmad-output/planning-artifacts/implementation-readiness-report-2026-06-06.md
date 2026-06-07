---
title: min-crm — Implementation Readiness (Cohesion) Report
status: complete
created: 2026-06-06
owner: Heba
verdict: GO — all 10 findings remediated 2026-06-06 (see Remediation log)
inputDocuments:
  - _bmad-output/project-context.md
  - _bmad-output/planning-artifacts/prds/prd-MiniCRM-2026-06-06/prd.md
  - _bmad-output/planning-artifacts/prds/prd-MiniCRM-2026-06-06/.decision-log.md
  - _bmad-output/planning-artifacts/architecture.md
  - _bmad-output/planning-artifacts/epics/index.md
  - _bmad-output/planning-artifacts/epics/**/E*-S*.md
  - _bmad-output/planning-artifacts/briefs/brief-MiniCRM-2026-06-06/addendum.md
---

# Implementation Readiness — Cohesion Findings (min-crm)

**Scope:** 35 story files + PRD (§6 + decision-log) + architecture (ADR-001…016) + epics index + brief addendum + the fixed constitution. Ten cohesion dimensions checked.

## VERDICT: 🟢 GO for Epic 0 — with a conditional fix list before Epics 1–5

Epic 0's internal dependency graph is acyclic, complete, and correctly ordered (`E0-S1` is a clean no-dependency entry point; the kernel build order S1+S2 → S3+S4 → S5+S6 → S7+S8 → S9 → S10+S12 → S11 holds). **No finding blocks Epic 0 from starting.** The blocking-class issues all concern how Epics 1–5 *reference* Epic 0 — they must be fixed before those epics begin, not before Epic 0 does.

| # | Dimension | Result |
|---|---|---|
| 1 | Coverage (35 stories, contiguous/unique) | ✅ PASS |
| 2 | Traceability integrity (prd_story / adrs / constitution_refs resolve) | ✅ FIXED (3 MEDIUM) |
| 3 | UC-inheritance correctness | ✅ FIXED (Epic 3 TC) |
| 4 | Dependency graph (DAG + critical prereqs encoded) | ✅ FIXED (HIGH + LOW) |
| 5 | Residual resolutions (ADR-014/015/016) | ✅ PASS |
| 6 | Status-map consistency (DEC-1, Flag C) | ✅ PASS |
| 7 | NFR & ADR ownership | ✅ FIXED (LOW note added) |
| 8 | Permission-matrix encodability | ✅ PASS |
| 9 | Scope guard (Epic 6 design-only / pilot purity) | ✅ PASS |
| 10 | Open questions = pre-Epic-6 gates, not pilot blockers | ✅ PASS |

> **All findings remediated 2026-06-06** — see the Remediation log at the foot of this report. Post-fix re-validation: 35 stories, **valid DAG (no cycles)**, no unknown dependency targets, every event-emitting story reaches the repo/guard/event kernels, `TC` present on all 35 `inherits_uc`.

---

## 1. Coverage — ✅ PASS

All 35 expected story files exist; IDs are contiguous, unique, no gaps, no duplicates:
`E0-S1…S12 (12) · E1-S1…S5 (5) · E2-S1…S4 (4) · E3-S1…S3 (3) · E4-S1…S4 (4) · E5-S1…S3 (3) · E6-S1…S4 (4) = 35.`

- **PRD §6 anchor reconciliation:** PRD §6 defines 34 stories (Epic 0 stops at **E0-S11**; Epic 6 *includes* **E6-S4** at prd.md:452). The 35th file, **E0-S12 (Notifications kernel)**, is a legitimate architecture delta (ADR-014), explicitly logged in `epics/index.md` → "Architecture deltas applied." **No orphans, no true gaps.** (The E0-S12 anchor *citation* is a traceability nit — see §2.5.)

## 2. Traceability integrity — ⚠️ 3 MEDIUM

ADR references resolve: every cited ADR is within the architecture's ADR-001…**016** (note: ADR-016 exists and is owned, though the request scoped "ADR-001…015"). Constitution `§`-refs mostly resolve. Three citations do **not** say what's cited:

- **[MEDIUM 2.3] E0-S6 `constitution_refs: ["§6", "§2.2"]` → `§2.2` is wrong.** In the **constitution**, §2.2 is *"Canonical entities (pilot scope)"* — not permissions. The permission matrix is **constitution §6.2** (the addendum §A header and the PRD §2.2 reconciliation note both cite "§6.2"). The `§2.2` here is the *PRD's* section number for the matrix, misplaced in the constitution field. → Change to `§6` + `§6.2`.
- **[MEDIUM 2.4] E2-S3 and E3-S2 cite ADR-003 — irrelevant.** ADR-003 is *"Mandatory RLS indexing: tenant_id leads every primary access index"* — a **production / Epic-6** concern. Both are **pilot** status-transition stories with no DB index. E3-S2's body even reads *"ADR-003/DEC-1 (`CUSTOMER_TRANSITIONS` single source)"* — conflating the RLS-indexing ADR with the status source (which is **NFR-3 / constitution §3**, realized via ADR-008/E0-S1). → Drop ADR-003 from both; the transition concern is already covered by ADR-008 + §3.
- **[MEDIUM 2.5] E0-S12 `prd_story: "(§6 E0-S12)"` does not resolve.** PRD §6 has no E0-S12 (it is the ADR-014 delta). → Point `prd_story` at the architecture delta source (architecture.md ADR-014 / `epics/index.md` "Architecture deltas applied"), not a fictitious PRD anchor.

## 3. UC-inheritance correctness — ⚠️ 1 MEDIUM

Applying the rule (mutates→UC-2, status-change→UC-3, conversion→UC-4, data-backed view→UC-1, scoped→UC-5) across all feature stories: **all correct.** Spot confirmations:
- **E2-S4 defect class is resolved** — it now carries `[UC-1, UC-2, UC-3, UC-5]` (ships edit + transition mutations). ✅
- Conversion (UC-4) appears only on **E3-S1** and is present. ✅
- Every event-emitting mutation carries UC-2; every status-change story carries UC-3; every data view carries UC-1; all scoped stories carry UC-5. ✅

- **[MEDIUM 3.1] Epic 3 frontmatter omits `TC` on all three stories.** `inherits_uc` is `[UC-1,UC-2,UC-3,UC-4,UC-5]` (E3-S1), `[UC-2,UC-3,UC-5]` (E3-S2), `[UC-1,UC-5]` (E3-S3) — **no `TC`** — while every *other* story (E0/E1/E2/E4/E5/E6) lists it, and the **E3 bodies themselves assert TC** (Inherited-Conformance section, References block, and the "Inherited: … + TC" line). This is a machine-readable/body mismatch: any DoD/traceability tooling keyed on `inherits_uc` would skip the TC gate for the entire conversion epic. → Add `TC` to `inherits_uc` on E3-S1/S2/S3.

## 4. Dependency graph — 🔴 1 HIGH + ⚪ 1 LOW

The graph is a **valid DAG — no cycles.** All edges point to earlier-built work; Epic 0 internals are correctly ordered. Of the named critical prerequisites:

- ✅ **E0-S1 + E0-S2 precede Epic 3 & 4** — encoded directly on E3-S1/E3-S2; Epic 4 inherits transitively (E4-S1 → E3-S1/S2).
- ✅ **E0-S12 precedes E4-S3 and E5-S3** — both list `E0-S12` in `depends_on`.
- 🔴 **E0-S3/S4 (repo), E0-S6 (guards), E0-S7 (events) prerequisites are NOT encoded** on the stories that need them.

**[HIGH 4.1] Epics 1 & 2 declare no Epic-0 prerequisite at all, and most event/CRUD/guarded stories omit the repo/guard/event kernels.**
- `E1-S1.depends_on = []` and `E2-S1.depends_on = [E1-S1]` — the roots of Epics 1 & 2 float free of Epic 0, yet both consume the repository (E0-S3/S4) and auth context (E0-S5).
- **No pilot feature story depends on E0-S3 or E0-S4** (only E6-S1/S2 do) — the "repo precedes feature CRUD" rule is unencoded.
- **No story depends on E0-S6** — the "E0-S6 precedes guarded mutations" rule is unencoded for every guarded mutation (E1-S2, E2-S1, E3-S1, E4-S1…).
- **E0-S7 is missing from most event-emitting stories** — present (directly/transitively) only on E5-S2, E4-S3/E4-S4, E5-S3 (via E0-S12). **Missing from E1-S2, E1-S3, E2-S1, E2-S3, E2-S4, E3-S1, E3-S2, E4-S1, E4-S2** — all of which emit canonical events.

The encoding is *selectively* present (E3 lists E0-S1/S2; E5-S2 lists E0-S7; E4-S3/E5-S3 list E0-S12), which proves the intent is per-story prerequisite encoding — so the omissions are genuine gaps, not a convention. **Fix before Epic 1/2 kickoff** (does not block Epic 0). *If* the team instead intends a blanket "all of Epic 0 ships before any Epic 1–5 story," state that explicitly in `epics/index.md` and this downgrades to LOW.

**[LOW 4.2] E6-S4 `depends_on` includes `E5` — a malformed node.** `E5` is an epic id, not a story id; the DAG has no `E5` vertex. → Replace with the intended story (likely `E5-S2`/`E5-S3`). Design-only, non-blocking.

## 5. Residual resolutions — ✅ PASS

- **ADR-014 (Notifications kernel):** E0-S12 builds `src/shared/notifications`; **E4-S3 and E5-S3 consume it** (both list `E0-S12` in `depends_on` and cite ADR-014). ✅
- **ADR-015 (predicates):** E0-S6 encodes `own`/`restricted` as data; `restricted ⊂ {softDelete, export}`; **hard-delete never granted** (RESTRICTED_SAFE excludes it). ✅
- **ADR-016 / DEC-4 split:** Activity timeline (DomainEvent, record-view permission, `viewer` included) vs Audit/Events log (raw AuditEvent, §6.2-gated, `viewer = none`) — consistently applied in E2-S4, E3-S3, E4-S4; logged as DEC-4 in the decision-log. ✅

## 6. Status-map consistency — ✅ PASS

Every transition-touching story matches the constitution §3.2 maps:
- **DEC-1 5-state Customer:** E0-S1 authors `CUSTOMER_TRANSITIONS`; E3-S2 encodes `prospect→onboarding→active`, `active↔inactive`, `active/inactive→churned` (churned terminal) — exact. ✅
- **Flag C terminal `closed`:** E0-S1 + E4-S2 both encode `closed` terminal, reopen only `resolved→open`. ✅
- Lead map (E2-S3): `new→contacted→qualified|disqualified`, `disqualified→contacted` revive, `converted` terminal — exact. ✅

## 7. NFR & ADR ownership — ✅ PASS (1 LOW note)

- **NFR-1…12 each realized by ≥1 Epic 0 story:** N1→E0-S10/S11, N2→E0-S2, N3→E0-S1, N4→E0-S3/S4/S11, N5→E0-S4, N6→E0-S5/S6, N7→E0-S7, N8→E0-S8, N9→E0-S9/S11, N10→E0-S9, N12→E0-S11. ✅
- **ADR-001…016 each owned by ≥1 story.** ✅ (Production ADRs 001/003/005/010 owned by Epic 6 stories, as intended.)
- **[LOW 7.1] NFR-11 (folder layout/naming) has no discrete owning story AC.** It's realized by "E0 setup" (folded in *before* E0-S1 per architecture) and the layering half is enforced by E0-S11's architecture-fitness test. Recommend adding an explicit NFR-11 line to E0-S11's References (or the E0 setup note) so ownership is traceable, not implicit.

## 8. Permission-matrix encodability — ✅ PASS

Every §2.2/§6.2 cell maps cleanly to an ADR-015 `Grant`: `✅→allow`, `—→deny`, `view→view`, `own→own`, `restricted→restricted`. No undefined predicate remains — `own` and `restricted` are defined as data (`isOwned`, `RESTRICTED_SAFE`), and E0-S6 unit-tests the matrix cell-by-cell. ✅

## 9. Scope guard — ✅ PASS

- All four E6 stories carry `cut: "design-only (NOT in 2-week pilot)"`. ✅
- No pilot (`cut: pilot`) story builds server/OIDC/outbox/external connectors: mock SSO only (E0-S5), Noop ports flags-OFF (E0-S10), outbox/CQRS/OIDC isolated to E6-S4, RLS to E6-S1. ✅

## 10. Open questions as pre-Epic-6 gates — ✅ PASS

PRD §11 + decision-log: **OQ1 (F-6 DB mandate)**, **OQ2 (F-2 residency)**, **OQ5 (backend placement / F-3)** all carry owner = architecture(+customer) and "revisit **before Epic 6 kickoff**." OQ3 (widget choice) → sprint planning; OQ4 (untriaged ticket state) → non-blocking. **None are pilot blockers.** ✅

---

## Fix list (ordered)

**Before Epics 1–5 (HIGH — must fix; does not block Epic 0):**
1. **Encode the missing Epic-0 prerequisites in `depends_on`** (HIGH 4.1):
   - Add `E0-S3, E0-S4` (repo) to the feature-CRUD roots — at minimum `E1-S1`, `E2-S1`.
   - Add `E0-S6` (guards) to guarded-mutation stories — `E1-S2, E1-S3, E2-S1, E3-S1, E4-S1, E4-S3`.
   - Add `E0-S7` (event bus) to event-emitting stories missing it — `E1-S2, E1-S3, E2-S1, E2-S3, E2-S4, E3-S1, E3-S2, E4-S1, E4-S2`.
   - (Or: document a blanket "all Epic 0 precedes all Epics 1–5" rule in `epics/index.md` and downgrade to LOW.)

**Cleanups (MEDIUM — fix before the affected epic):**
2. Add `TC` to `inherits_uc` on **E3-S1, E3-S2, E3-S3** (MEDIUM 3.1).
3. Fix `E0-S6` constitution ref `§2.2 → §6` + `§6.2` (MEDIUM 2.3).
4. Drop `ADR-003` from **E2-S3** and **E3-S2** frontmatter + fix E3-S2 body wording "ADR-003/DEC-1" → "NFR-3/§3 + ADR-008/DEC-1" (MEDIUM 2.4).
5. Repoint `E0-S12 prd_story` to the ADR-014 architecture delta (MEDIUM 2.5).

**Polish (LOW):**
6. `E6-S4 depends_on`: replace `E5` with a concrete story (LOW 4.2).
7. Give NFR-11 an explicit owner reference on E0-S11 / E0 setup (LOW 7.1).

**Epic 0 is clear to start now.** None of the above touches the Epic 0 internal graph or its kernels.

---

## Remediation log — applied 2026-06-06

Root cause of the HIGH finding: the story **bodies already enumerated the Epic-0 prerequisites** (in their "Depends on" header + "Dependencies & sequencing" lines); the machine-readable `depends_on` frontmatter had simply drifted out of sync. The fix synced frontmatter to each body's authoritative prereq list (and added the named kernels to the thinner Epic-3 stories per the finding rule).

| Finding | Files | Change |
|---|---|---|
| HIGH 4.1 | E1-S1 | `depends_on: []` → `[E0-S4, E0-S5, E0-S6]` (build-time); E0-S11 documented as a **test-time-only** dependency, not a build/merge gate |
| HIGH 4.1 | E1-S2 | `+E0-S7, E0-S9, E0-S10` |
| HIGH 4.1 | E1-S3 | `+E0-S7, E0-S9` |
| HIGH 4.1 | E2-S1 | `+E0-S1, E0-S4, E0-S6, E0-S7, E0-S9` |
| HIGH 4.1 | E2-S3 | `+E0-S1, E0-S4, E0-S6, E0-S7` |
| HIGH 4.1 | E2-S4 | `+E0-S6, E0-S7, E0-S9` |
| HIGH 4.1 | E3-S1 | `+E0-S4, E0-S6, E0-S7` (frontmatter + prose) |
| HIGH 4.1 | E3-S2 | `+E0-S4, E0-S6, E0-S7` (frontmatter + prose) |
| HIGH 4.1 | E3-S3 | `+E0-S4, E0-S6, E0-S7` (frontmatter + prose) |
| HIGH 4.1 | E4-S1 | `+E0-S1, E0-S4, E0-S5, E0-S6, E0-S7`; body **E0-S3→E0-S1** status-map mislabel corrected |
| HIGH 4.1 | E4-S2 | `+E0-S1, E0-S4, E0-S6, E0-S7`; body **E0-S3→E0-S1** corrected |
| HIGH 4.1 | E4-S3 | `+E0-S4, E0-S6, E0-S7` |
| MED 3.1 | E3-S1/S2/S3 | added `TC` to `inherits_uc` (bodies already asserted it) |
| MED 2.3 | E0-S6 | `constitution_refs` `§2.2 → §6.2` (matrix lives at constitution §6.2) |
| MED 2.4 | E2-S3, E3-S2 | dropped `ADR-003` (RLS indexing); status source re-cited to **NFR-3/§3 + DEC-1**, authored in E0-S1 |
| MED 2.5 | E0-S12 | `prd_story` repointed to architecture ADR-014 delta (was fictitious "§6 E0-S12") |
| LOW 4.2 | E6-S4 | `depends_on` `E5` → `E5-S2, E5-S3` |
| LOW 7.1 | E0-S11 | added explicit NFR-11 ownership note |

**Post-fix re-validation (automated):** 35 stories · referential integrity (all dep targets exist) · **no cycles — valid DAG** · all event-emitting stories reach `E0-S7`/`E0-S4`/`E0-S6` · all Epic-3/4 reach `E0-S1`/`E0-S2` · `TC` on all 35 `inherits_uc` · no pilot story cites `ADR-003` (only E6-S1) · no malformed dependency tokens.
