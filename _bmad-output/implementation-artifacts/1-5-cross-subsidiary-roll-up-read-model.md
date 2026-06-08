---
id: E1-S5
title: Cross-subsidiary roll-up (read model)
baseline_commit: 4bb9544e36839054dc7db4edc7303409bcee70b7
status: review
---

# E1-S5 — Cross-subsidiary roll-up (read model)

> **Backfilled implementation artifact.** The roll-up was originally built and merged
> (PR #90) without an implementation artifact, and sprint-status still showed `1-5` as
> `backlog`. Created during the **correct-course re-alignment** (`bmad-dev-story E1-S5`,
> 2026-06-08), which also **cleared the 4 pre-existing `tsc -b` errors** the branch was
> carrying. Authoritative spec:
> `_bmad-output/planning-artifacts/epics/epic-1-tenancy-subsidiary/E1-S5.md`.

## Story
As a tenant admin, I see aggregate counts across my subsidiaries, so that I have a parent-level view of the whole tenant.

## Acceptance Criteria (summary — full text in the epic story file)
- AC1 gated by `rollup.view`; **admin tenant-wide, others scope-limited** (DEC-CC-6, corrected from the contradictory "tenant_admin-only") · AC2 read-only aggregation, no writes/events · AC3 subsidiary user sees own + parent-level only · AC4 four states, **empty fires on `grandTotal === 0`**.
- **UX & Behavior (DEC-CC-5 pins):** empty `layers` icon + scope line (§8.7); eyebrow = role display label + scope display name; table layout/copy already matched.

## Tasks / Subtasks
- [x] **Clear the pre-existing `tsc -b` errors (build-green goal):**
  - [x] `ListQuery.filter` widened to `Record<string, string | number | boolean | null>` so the roll-up's `{ subsidiaryId: null }` parent-level filter typechecks (runtime already did `r[key] === value`).
  - [x] `useRollup.countFor` — replaced the invalid `repo as Repository<{ subsidiaryId: ID | null }>` cast (didn't satisfy `BaseEntity`) with a minimal structural type `{ list(q?: ListQuery): Promise<{ total: number }> }`.
  - [x] `permissions.test.ts` — added the `rollup.view` row to the `EXPECTED` oracle (now cell-tests roll-up: admin `allow`, others `view`).
  - [x] `AppShellWithSubsidiaries.test.tsx` — removed the unused `beforeEach` import.
- [x] **AC4 behavioral fix** — empty predicate `grand === 0 && visibleSubs.length === 0` → **`grand === 0`** (a tenant whose subs hold no records shows empty, not an all-zeros table). Matches prototype `tenancy.jsx:249`.
- [x] **Empty state (§8.7)** — `QueryStateBoundary.EmptyConfig` gained `icon?` + `scopeLine?` (plumbed to `EmptyState`); RollupPage passes `icon: "layers"` + `scopeLine: scopeName`.
- [x] **Eyebrow (DEC-CC-5)** — role **display label** (`ROLE_LABELS`) + scope **display name** ("Whole tenant (roll-up)" / current sub name), replacing the raw `roles[0]` + `tenantId`.
- [x] **AC1 (DEC-CC-6)** — already correct in code (`rollup.view` for all roles); the AC text was corrected in the epic story.

## Dev Agent Record

### Agent Model Used
claude-opus-4-8[1m]

### Debug Log References
- RED: `RollupPage.fidelity.test.tsx` — 2/2 failing before changes (empty didn't fire with a sub present; eyebrow showed `tenant_admin · tnt_a`).
- GREEN: fidelity 2/2; full suite 583/583; **`tsc -b` clean (0 errors)**; eslint clean.

### Completion Notes
- The 4 `tsc -b` errors were **pre-existing on the branch** (E1-S5 code merged without a green typecheck); this pass clears them, so the branch typecheck gate is finally green.
- `ListQuery.filter` allowing `null` is a small, sound widening of the shared contract — filtering a nullable field (`subsidiaryId`) is legitimate and the adapter already handled it at runtime.
- Empty predicate now matches the prototype exactly; eyebrow + empty-state icon/scope-line bring the roll-up to the pins. Table columns/totals/lock-pill/edge-link already matched and were untouched.
- DEC-CC-6 (roll-up visible to all roles, scoped) is now encoded end-to-end: §6.2 row, `permissions.ts` MATRIX, the `permissions.test.ts` oracle, the E1-S4 nav, and this surface.

### File List
- `src/shared/data/Repository.ts` — `ListQuery.filter` allows `null`.
- `src/features/dashboard/useRollup.ts` — structural `countFor` type (cast removed); empty predicate `grand === 0`; lint-disable on the compute effect.
- `src/shared/ui/QueryStateBoundary.tsx` — `EmptyConfig` gains `icon`/`scopeLine`; passed to `EmptyState`.
- `src/features/dashboard/RollupPage.tsx` — `ROLE_LABELS`; eyebrow role-label + scope-name; empty `icon: "layers"` + `scopeLine`.
- `src/shared/auth/permissions.test.ts` — `rollup.view` row added to `EXPECTED`.
- `src/app/AppShellWithSubsidiaries.test.tsx` — dropped unused `beforeEach` import.
- `src/features/dashboard/RollupPage.fidelity.test.tsx` — NEW: empty-on-grand-zero + eyebrow specs.
- `_bmad-output/implementation-artifacts/{1-5-…md (NEW), sprint-status.yaml}`; `_bmad-output/planning-artifacts/epics/epic-1-tenancy-subsidiary/E1-S5.md` — `baseline_commit`.

## Change Log
- **2026-06-08** — Roll-up re-alignment + **tsc-green**: cleared 4 pre-existing type errors (filter-null, repo cast, matrix oracle, unused import); empty fires on `grand === 0` (AC4); `layers` icon + scope line; eyebrow role-label + scope-name. 2 new fidelity tests; suite 583/583; `tsc -b` clean. Status → review.

## Review Findings (code-review 2026-06-08)

Adversarial review — Blind Hunter (diff-only) + Edge Case Hunter (diff+repo) + Acceptance Auditor
(diff+spec), combined **E1-S4 + E1-S5** scope. **Acceptance Auditor: all E1-S4 + E1-S5 ACs + DEC-CC-5/6
pins satisfied.** Triage: **0 decision-needed · 0 patch · 4 defer · 8 dismissed**. Dismissed = the empty
`grand === 0` predicate (ratified AC4/prototype, not a bug) + verified false positives (`visibleSubs`
still used at `useRollup.ts:91`; the `null`-filter widening and the structural `countFor` type confirmed
runtime-sound by the repo-access layer) + icon-class/test-convention nitpicks.

- [x] [Review][Defer] **Stranded terminal records invisible to the roll-up (Med).** Offboard reassigns only ACTIVE records and soft-deletes the sub, leaving terminal records (churned customers, closed/resolved tickets, disqualified/converted leads) in the offboarded sub's bucket. `useRollup` counts only active subs (`includeDeleted:false`) + the parent (`subsidiaryId===null`) bucket, so records with `subsidiaryId===<deletedSubId>` are counted by nothing → tenant total under-counts, and a tenant whose only records are stranded shows a false "empty". **Pre-existing** offboard×roll-up data-model interaction (not introduced by this diff); needs a product decision (count offboarded subs' records, or reassign terminal records on offboard too?). [`useRollup.ts:68-101`; `OffboardDialog.tsx` active-only reassign]
- [x] [Review][Defer] `ROLE_LABELS[session.roles[0]]` → "undefined" eyebrow if a role outside the closed `Role` union ever appears (type-safe today). [`RollupPage.tsx:128`]
- [x] [Review][Defer] Eyebrow/empty `scopeName` falls back to "Your subsidiary" for a non-admin during load (and sticks if their sub never resolves into `rows`); cosmetic flash. [`RollupPage.tsx:131-132`]
- [x] [Review][Defer] `compute()` effect has no abort/cancel guard (set-state-after-unmount race on fast scope changes); matches the repo's load-effect convention. [`useRollup.ts:134`]

## Status
review
