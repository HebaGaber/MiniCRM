---
baseline_commit: 7b0aeb3df0d8caeb10c458610e5ce3b84d589c47
---

# Story 0.3: Define Repository<T> + Page<T> + ListQuery

Status: review

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

- **Story ID:** E0-S3 (`0-3-define-repository-page-listquery`)
- **Epic:** E0 — Platform Guidelines & Standards (the governing contract) · **Feature:** 0.2 — Repository Seam & Data Kernel
- **Cut:** Pilot · **Depends on:** E0-S2 (entity types — `done`) · **ADRs:** ADR-004 · **Constitution:** §4, §5
- **Unblocks:** E0-S4 (the `LocalStorageRepository` implements this interface) **and every feature data hook in Epics 1–5** · Asserted by the E0-S11 architecture-fitness test (`src/features/*` import this interface, never a concrete repository)

## Story

As the platform,
I want all data access to go through one generic `Repository<T>` seam with a uniform paginated list contract,
so that features never touch persistence directly and the adapter can swap (localStorage → HTTP) without changing a single call site.

## Acceptance Criteria

1. **AC1 — `Repository<T extends BaseEntity>` interface.** Define the interface in `src/shared/data/Repository.ts` **verbatim per constitution §4.1**, with exactly these five members:
   - `list(q?: ListQuery): Promise<Page<T>>`
   - `get(id: ID): Promise<T | null>`
   - `create(input: Omit<T, keyof BaseEntity>): Promise<T>`
   - `update(id: ID, patch: Partial<Omit<T, keyof BaseEntity>>, version: number): Promise<T>`
   - `remove(id: ID): Promise<void>` (soft delete)

   No persistence detail (localStorage, keys, HTTP, fetch) leaks into the type. `T` is constrained `extends BaseEntity`. `ID` and `BaseEntity` are imported **`import type`** from `../domain/types` (E0-S2).
   *File:* `src/shared/data/Repository.ts`

2. **AC2 — `Page<T>` paging contract.** Define `Page<T>` per constitution §4.1: `{ data: T[]; total: number; page: number; pageSize: number }`. See **Reconciliation 1** below — the field is `data`, **not** `items` (the constitution §4.1 written interface and the §5.5 wire envelope both use `data`; the E0-S3 epic file's `items` is an un-logged drift). The default `pageSize=25` and **max 100** (clamp, not error) are **runtime behaviors of the adapter (E0-S4)** — the `Page<T>` type itself only carries the shape. Do **not** try to encode the default/clamp in the type.
   *File:* `src/shared/data/Repository.ts`

3. **AC3 — `ListQuery` standard params.** Define `ListQuery` **verbatim per constitution §4.1**: `{ filter?: Record<string, string | number | boolean>; q?: string; page?: number; pageSize?: number; sort?: string }`. See **Reconciliation 2** — the wire params `status` and `ownerId` (epic AC3 / §5.4) are **conventional keys inside the open `filter` Record**, not dedicated top-level fields. Because `filter` is `Record<string, …>`, arbitrary filter keys are accepted at the type boundary — this is exactly what satisfies "**unknown filters ignored, never errored**" (UC-5 forward-compat). `sort` is a `string` of the form `"field"` / `"-field"` (desc).
   *File:* `src/shared/data/Repository.ts`

4. **AC4 — Type-level tests (NFR-12).** In `src/shared/data/Repository.test.ts`, add **compile-time** assertions (mirroring the E0-S2 `types.test.ts` pattern — validated by `tsc -b`, not runtime), plus at least one trivial runtime assertion so Vitest has a test to run:
   - `Repository<T>` constrains `T extends BaseEntity` (a `Repository<NotAnEntity>` use is rejected — assert with a `// @ts-expect-error` guarded line).
   - `Page<T>` has the four fields with `data: T[]` (assignment-shape assertion against a literal).
   - `ListQuery` is **structurally open at the filter boundary**: `{ filter: { status: 'new', ownerId: 'usr_x', anyUnknownKey: 'y' } }` compiles (unknown filter keys tolerated).
   - Behavioral defaults/clamping (`pageSize=25`, max 100) are **NOT** tested here — they belong to E0-S4 against the concrete adapter.
   *File:* `src/shared/data/Repository.test.ts`

## Tasks / Subtasks

- [x] **Task 1 — Create the data kernel directory + interface file** `src/shared/data/Repository.ts` (AC: 1, 2, 3)
  - [x] Create the new `src/shared/data/` directory (currently only `src/shared/domain/` and `src/shared/ui/` exist).
  - [x] `import type { ID, BaseEntity } from '../domain/types'` (type-only — `verbatimModuleSyntax` is on).
  - [x] Define `ListQuery` verbatim from §4.1 (`filter?` open Record, `q?`, `page?`, `pageSize?`, `sort?`). (AC3)
  - [x] Define `Page<T>` = `{ data: T[]; total: number; page: number; pageSize: number }`. (AC2)
  - [x] Define `interface Repository<T extends BaseEntity>` with the five members exactly as §4.1 / AC1. (AC1)
  - [x] File is **100% type-only** — zero runtime exports. No Zod, no enum, no classes, no helpers.
- [x] **Task 2 — Author the type-level test** `src/shared/data/Repository.test.ts` (AC: 4)
  - [x] Compile-time assertions per AC4 (constraint, `Page.data` shape, open-`filter` tolerance).
  - [x] One trivial runtime `expect(true).toBe(true)` (or assert a constructed `Page`/`ListQuery` literal) so the file is a runnable Vitest spec.
  - [x] `npm test` — all green (E0-S1's + E0-S2's existing tests still pass; this file adds at least one).
- [x] **Task 3 — Conformance gates** (AC: all)
  - [x] `npx tsc -b` clean (no `enum`; all type pulls use `import type`).
  - [x] `npm run lint` (`eslint .`) clean.
  - [x] Self-check against DoD (constitution §10) — note which items are out-of-scope for a non-UI, non-persistence, type-only kernel story (see Dev Notes "Definition of Done").

### Review Findings

_Code review 2026-06-07 (bmad-code-review, 3 layers). Verdict: contract correct & verbatim §4.1; all 4 ACs PASS; gates green (tsc -b 0 / 91 tests / eslint clean). All findings are optional test-coverage hardening — none block done._

- [ ] [Review][Patch] `update`'s `version` arg and `patch`-excludes-`BaseEntity` constraint have zero coverage — `update` is never called in the suite; both mocks drop the 3rd param, so dropping `version` or widening `patch` to allow audit fields would pass silently [src/shared/data/Repository.test.ts:81-112] (blind+edge)
- [ ] [Review][Patch] `Page<T>.data` is never pinned as *required* — the `items` negative only proves excess-property rejection, not that `data` is mandatory; add a `@ts-expect-error` omitting `data` to lock the other half of Reconciliation 1 [src/shared/data/Repository.test.ts:36-41] (edge)
- [ ] [Review][Patch] `get`'s `T | null` return is never narrowed in a test — nothing fails if `| null` is dropped from the signature [src/shared/data/Repository.test.ts:91] (edge)
- [x] [Review][Defer] No explicit `"strict": true` in any tsconfig — the `T | null` / `?:` contracts rely on the TS 6.x default (verified active); pinning strict explicitly hardens against a future toolchain/default change [tsconfig.app.json] — deferred, pre-existing & project-wide (not introduced by E0-S3)

## Dev Notes

### What this story is (and is NOT)
A **pure type-contract module**: one `.ts` file with three exported types (`Repository<T>`, `Page<T>`, `ListQuery`) and one type-level test. **No React, no persistence, no localStorage, no Zod, no service/API/UI code, no runtime exports at all.** It is the seam (ADR-004) that every feature data hook in Epics 1–5 binds to and that `LocalStorageRepository` (E0-S4) implements. Get the member signatures and field names **exactly** right — a wrong shape cascades into the adapter and every feature. This mirrors E0-S2: copy the constitution verbatim, apply only the explicitly-logged reconciliations below.

### Source of truth — copy verbatim from constitution §4.1, with two reconciliations
`_bmad-output/project-context.md` **§4.1** is the canonical, written-out interface for all three types. **Copy them exactly — do not paraphrase, rename, or "improve".** [Source: project-context.md#4.1] Two places where the E0-S3 epic file's wording drifts from §4.1; the **constitution wins** (no decision-log entry authorizes the drift):

- **🚨 Reconciliation 1 — `Page<T>` field is `data: T[]`, NOT `items: T[]`.** The epic file ([E0-S3.md](../planning-artifacts/epics/epic-0-platform-guidelines/E0-S3.md) AC2) writes `{ items: T[], … }`, but constitution §4.1 explicitly defines `export interface Page<T> { data: T[]; total; page; pageSize }`, and the §5.5 list envelope also keys on `data` (`{ data: [...], meta: {...} }`). The PRD (§6 line 229) does **not** say `items` — it only says "`list` returns `Page<T>`". So `items` is an un-logged authoring drift introduced during epic sharding. **Use `data: T[]`** — it keeps the in-app `Page<T>` aligned with the wire envelope and avoids a needless rename seam in E0-S4. *(Flagged for confirmation — see "Open Questions".)* [Source: project-context.md §4.1, §5.5; prd.md §6 E0-S3]
- **🚨 Reconciliation 2 — `status`/`ownerId` live inside `filter`, not as top-level fields.** Epic AC3 / §5.4 list the **wire query-string** params `q/status/ownerId/page/pageSize/sort`. §4.1's TS interface makes `q/page/pageSize/sort` first-class fields and folds domain filters (`status`, `ownerId`, …) into an **open `filter?: Record<string, string|number|boolean>`**. Keep §4.1 verbatim: `status`/`ownerId` are **filter keys**, not interface members. The open `Record` is precisely what makes "unknown filters ignored, never errored" (UC-5) true **at the type boundary** — any string key is structurally accepted; the *runtime* ignore-unknown behavior is the adapter's job (E0-S4). [Source: project-context.md §4.1, §5.4; E0-S3.md AC3; architecture.md L522]

### The exact shapes to author (from §4.1 — author these verbatim)
```ts
// src/shared/data/Repository.ts
import type { ID, BaseEntity } from '../domain/types';

export interface ListQuery {
  filter?: Record<string, string | number | boolean>;
  q?: string;        // free-text search
  page?: number;     // 1-based
  pageSize?: number; // default 25, max 100 — ENFORCED BY THE ADAPTER (E0-S4), not the type
  sort?: string;     // "field" | "-field" (desc)
}

export interface Page<T> {
  data: T[];
  total: number;
  page: number;
  pageSize: number;
}

export interface Repository<T extends BaseEntity> {
  list(q?: ListQuery): Promise<Page<T>>;
  get(id: ID): Promise<T | null>;
  create(input: Omit<T, keyof BaseEntity>): Promise<T>;
  update(id: ID, patch: Partial<Omit<T, keyof BaseEntity>>, version: number): Promise<T>;
  remove(id: ID): Promise<void>; // soft delete
}
```
- `Omit<T, keyof BaseEntity>` on `create` is deliberate: the caller supplies only the **business** fields; the adapter sets `id`/all audit fields/`version=1` in the create-beat (E0-S4, §4.2 rule 3). [Source: project-context.md §4.1, §4.2]
- `update` takes the caller's `version` for optimistic concurrency; a mismatch is the adapter's `409` (E0-S4) — not modeled in the type. [Source: project-context.md §4.2 rule 4, §5.3]
- `remove` returns `Promise<void>` and is **soft** by default (the adapter sets `deletedAt`); lists exclude soft-deleted unless `filter.includeDeleted=true` — again adapter behavior, the type just declares `remove`. [Source: project-context.md §4.2 rule 5]

### 🚨 Compiler constraints — same ones E0-S1/E0-S2 hit (do not relearn the hard way)
[tsconfig.app.json](../../tsconfig.app.json) sets `"verbatimModuleSyntax": true` and `"erasableSyntaxOnly": true` (`target es2023`, `lib ["ES2023","DOM"]`). Consequences:
- **Type-only imports MUST use `import type`** — `ID` and `BaseEntity` are types: `import type { ID, BaseEntity } from '../domain/types'`. A plain `import` fails `verbatimModuleSyntax`. This file has **no** runtime imports at all.
- **No TS `enum`** anywhere (not needed here — there are no literal unions in this story).
- All three exports are `interface` (type-only). This module emits **zero JavaScript** after compilation — it is types only.

### Architecture compliance (guardrails)
- **File location is fixed:** `src/shared/data/Repository.ts` — a **new** `src/shared/data/` directory. The architecture source tree pins it: `data/ → Repository.ts # interface + ListQuery + Page<T> (E0-S3)`. **No barrel `index.ts`** (E0-S1/E0-S2 established direct-file imports; the source tree shows none). [Source: architecture.md#Source-Tree L780-784]
- **ADR-004 (the one ADR for this story):** all persistence goes through `Repository<T>` (`list/get/create/update/remove`); feature code **never** touches `localStorage`. `LocalStorageRepository` now, `HttpRepository` later, injected at the composition root. This story authors **only the seam interface** — the 4-beat use case, scoping, REST shapes, and fault toggle are all E0-S4. The E0-S11 architecture-fitness test later asserts no `src/features/*` imports a concrete repository — so the value of this interface is that features depend on **it**, not the adapter. [Source: architecture.md#ADR-004 L327-337]
- **NFR-5 REST-contract parity (context, not built here):** the E0-S4 adapter returns production HTTP shapes/status codes (`200 Page<T>` on list, `201+Location` create, `204` delete-soft, `409` version mismatch, `422` validation/illegal-transition, `404` cross-tenant). This story's `Page<T>`/`Repository<T>` are the in-app types those wire shapes map to. [Source: architecture.md#NFR-5 L339-347, project-context.md §5.3]
- **NFR-1 one-way dependency:** shared-layer code; imports **nothing** from `src/features/*`. The only import is the sibling `../domain/types`.
- **UC-5 tenant scope — the interface exposes NO tenant/subsidiary params.** Scoping is composed **inside** the adapter from auth context (E0-S4), never passed by the caller. Do **not** add `tenantId`/`subsidiaryId` to `ListQuery`, `Repository`, or any signature. [Source: E0-S3.md "Inherited UC-5"; architecture.md L746 "Repository scope resolution (never from caller)"]

### Previous story intelligence (E0-S2 — `done`)
E0-S2 shipped `src/shared/domain/types.ts` (`ID`, `BaseEntity`, `WorkflowInstance`, `newId`, `ID_PREFIXES`) + the six `*.types.ts` files + `types.test.ts`. It is the pattern to mirror. Actionable carry-overs:
- **`ID` and `BaseEntity` already exist** at `src/shared/domain/types.ts` — `import type { ID, BaseEntity } from '../domain/types'`. Do **not** redefine them. [src/shared/domain/types.ts:16,27]
- **Vitest is already wired** (node environment, `vitest ^4.1.8`, `"test": "vitest run"`). Add `Repository.test.ts` — **no new test deps.** A review finding on E0-S1 explicitly **removed** RTL/jsdom as premature (E0-S11 owns the full harness); do **not** add them, and do **not** add `expectTypeOf`/`--typecheck` machinery — E0-S2 proved plain compile-time assertions validated by `tsc -b` are sufficient. [E0-S2 Review Findings; src/shared/domain/types.test.ts]
- **Type-level test pattern that worked:** E0-S2 used `const _c: BaseEntity = {} as Customer` style assignments + `// @ts-expect-error`-guarded blocks for negative cases, all caught by `tsc -b`. Reuse exactly that approach for the `T extends BaseEntity` constraint and the `Page.data` shape. [src/shared/domain/types.test.ts; E0-S2 AC6]
- **`?:` vs `| null` is intentional and compiler-enforced** — `strictNullChecks` is effectively active (TS ~6.x default), confirmed in E0-S2 review. Match §4.1's optionals exactly (`filter?`, `q?`, etc.).

### Git intelligence
- Branch `story/E0-S3-define-repository-t-page-t-listquery` is **already checked out** (branch-per-story convention). Baseline = `7b0aeb3 feat(E0-S2)` (the immediately preceding implementation commit; see frontmatter `baseline_commit`).
- **No existing `src/shared/data/` directory and no `Repository.ts` anywhere** — both the file and its directory are **NEW**; nothing to preserve or regress. The `Prototype/` HTML/JSX is illustrative UI, **not** a code source.
- History before E0-S2 is docs/prototype only; E0-S1 (`bbb246b`) → E0-S2 (`7b0aeb3`) are the two implementation commits to mirror for module shape and test style.

### Project Structure Notes
- Stack: React 19 + TypeScript ~6.0.2 + Vite 8, Vitest 4.1.8, npm. [Source: package.json]
- This story touches **no React** — plain `.ts`. ESLint flat config applies; keep lint-clean.
- Naming: the source tree and §4.1 both name the file **`Repository.ts`** (PascalCase — it's the seam module carrying the interface, mirroring why `status.ts`/`types.ts` aren't `*.types.ts`). The test mirrors the source file casing: **`Repository.test.ts`** (E0-S2 used `types.test.ts` ↔ `types.ts`; the architecture line `repository.test.ts` is a casing slip — match the source file). [Source: project-context.md §4.1, §9; architecture.md#Source-Tree L781,784]

### Definition of Done (scoped for a type-only kernel story) — constitution §10
**Applicable:** meets ACs; passes `bmad-code-review`; reuses shared types (imports E0-S2 `ID`/`BaseEntity`, no redefinition); `tsc -b` + `eslint` + tests green; traceable chain (`Closes #<issue>`). **N/A for this story** (no persistence/UI/auth/events): tenant-scoping *enforcement*, the 4-beat authorize→mutate→emit→audit, audit/domain-event emission, the four UI states, REST status codes, Zod validation — all bind the **consuming** stories (E0-S4 adapter, E0-S9 UI, Epics 1–5). This story only authors the contract those stories honor.

### References
- [Source: _bmad-output/planning-artifacts/epics/epic-0-platform-guidelines/E0-S3.md] — story spec & ACs (note `items`→`data` Reconciliation 1)
- [Source: _bmad-output/planning-artifacts/epics/epic-0-platform-guidelines/epic-0.md#Feature-0.2] — epic context; build order S3 (interface) → S4 (adapter)
- [Source: project-context.md#4.1] — `Repository<T>`, `Page<T>`, `ListQuery` **written interfaces (copy verbatim)**; §4.2 CRUD rules (create sets audit fields, update needs version, soft delete)
- [Source: project-context.md#5] — §5.3 status codes, §5.4 query params, §5.5 envelopes (`data`/`meta`) — context the E0-S4 adapter realizes
- [Source: architecture.md#ADR-004 L327-337] — Repository seam, composition-root swap, fitness test (the contract this story authors)
- [Source: architecture.md#NFR-5 L339-347] — REST-contract parity the adapter (E0-S4) honors
- [Source: architecture.md#Source-Tree L780-790] — `src/shared/data/Repository.ts` location; no barrel
- [Source: src/shared/domain/types.ts] — `ID`/`BaseEntity` to import (do not redefine)
- [Source: _bmad-output/implementation-artifacts/0-2-author-baseentity-and-canonical-entity-types.md] — previous-story learnings (Vitest wiring, no new deps, compile-time test pattern, `import type`, no enum)
- [Source: tsconfig.app.json] — `verbatimModuleSyntax`, `erasableSyntaxOnly` (no enum; `import type`)
- PRD: prd.md §6 E0-S3 · ADR(s): ADR-004 · Inherited UC: UC-5 (tenant scope), TC (traceability)

## Resolved Decisions

1. **`Page<T>` field name = `data` (CONFIRMED 2026-06-07 by Heba).** Reconciliation 1 stands: use `data: T[]` per constitution §4.1 + §5.5. The E0-S3 epic file's `items` is a confirmed un-logged drift and is **not** to be used. No decision-log entry needed (we conform to the constitution).

## Dev Agent Record

### Agent Model Used

claude-opus-4-8[1m] (Opus 4.8, 1M context)

### Debug Log References

- `npx tsc -b` → exit 0 (clean). Because the build is clean, every `// @ts-expect-error` in the test is verifiably suppressing a *real* compile error — i.e. the negative assertions (rejects `items`, rejects nested-object filter value, rejects non-`BaseEntity` T, rejects `id` in create input) all hold.
- `npm test` (`vitest run`) → 3 files, 91 tests passed (E0-S1 status + E0-S2 types + new Repository spec; no regressions).
- `npm run lint` (`eslint .`) → clean. Initial run flagged two unused mock params (`_q`, `_version`) — ESLint's `no-unused-vars` has no `argsIgnorePattern`, unlike tsc's underscore convention; resolved by dropping the params (interface methods may be implemented with fewer params).

### Completion Notes List

- Authored the pure type-contract seam `src/shared/data/Repository.ts` (ADR-004): `ListQuery`, `Page<T>`, `Repository<T extends BaseEntity>` — **verbatim from constitution §4.1**, 100% type-only (zero runtime exports, emits no JS). Only import is `import type { ID, BaseEntity } from '../domain/types'`; no barrel.
- **Reconciliation 1 applied** — `Page.data: T[]` (not `items`), per §4.1 + §5.5 wire envelope and the Resolved Decision (CONFIRMED 2026-06-07 by Heba). A `@ts-expect-error` test pins that `items` is rejected.
- **Reconciliation 2 applied** — `status`/`ownerId` are conventional keys inside the open `filter?: Record<string, string|number|boolean>`, not top-level fields. A runtime test proves unknown filter keys compile (UC-5 "unknown filters ignored, never errored" at the type boundary); a `@ts-expect-error` test pins that non-scalar filter *values* are rejected.
- Behavioral concerns deliberately left to the E0-S4 adapter and NOT modeled in the type: `pageSize=25` default / max-100 clamp, tenant/subsidiary scoping (UC-5 — no scope params in any signature), optimistic-concurrency 409, soft-delete `deletedAt`, REST status codes. `create` uses `Omit<T, keyof BaseEntity>` (caller supplies only business fields); `update` takes the caller's `version`.
- DoD self-check (§10): **Applicable & met** — ACs satisfied; reuses E0-S2 `ID`/`BaseEntity` (no redefinition); `tsc -b` + `eslint` + tests green; `import type` only, no `enum`. **N/A for this type-only kernel story** (bind the consuming stories E0-S4/E0-S9/Epics 1–5): tenant-scope *enforcement*, the 4-beat authorize→mutate→emit→audit, audit/domain-event emission, the four UI states, REST status codes, Zod validation. Traceability `Closes #<issue>` pending the commit/PR.

### File List

- `src/shared/data/Repository.ts` (new) — the `Repository<T>` / `Page<T>` / `ListQuery` seam (type-only).
- `src/shared/data/Repository.test.ts` (new) — compile-time + runtime type-level tests (NFR-12).
- `_bmad-output/implementation-artifacts/sprint-status.yaml` (modified) — E0-S3 status ready-for-dev → in-progress → review.

## Change Log

| Date       | Change                                                                 |
|------------|------------------------------------------------------------------------|
| 2026-06-07 | Implemented E0-S3: authored `Repository<T>`, `Page<T>`, `ListQuery` (constitution §4.1 verbatim, Reconciliations 1 & 2 applied) + type-level test. tsc -b / eslint / 91 tests green. Status → review. |
