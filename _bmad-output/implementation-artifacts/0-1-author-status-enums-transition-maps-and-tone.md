---
baseline_commit: 4ea3daeee5d5d3b236092fa7458f45b2fd035a54
---

# Story 0.1: Author status enums, transition maps, and tone

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

- **Story ID:** E0-S1 (`0-1-author-status-enums-transition-maps-and-tone`)
- **Epic:** E0 — Platform Guidelines & Standards (the governing contract) · **Feature:** 0.1 — Domain & Status Kernel
- **Cut:** Pilot · **Depends on:** none (foundational kernel) · **ADRs:** ADR-008 · **Constitution:** §3
- **Unblocks:** E0-S2, E0-S3, E0-S4 · **Hard prerequisite for Epic 3 & Epic 4** (`CUSTOMER_TRANSITIONS` was the blocker for conversion/onboarding)

## Story

As the platform,
I want all statuses and legal transitions defined exactly once,
so that no feature hardcodes a status string or invents a transition.

## Acceptance Criteria

1. **AC1 — Status literals.** Define `LeadStatus`, `CustomerStatus` (5-state per DEC-1: `prospect|onboarding|active|inactive|churned`), `TicketStatus`, `TicketPriority`, `LeadSource`, `Role`, `TenantStatus` as string-literal unions. **Literal unions only — no `enum`** (TS `enum` emits runtime code and is rejected by `erasableSyntaxOnly: true`; see Dev Notes).
   *File:* `src/shared/domain/status.ts`
2. **AC2 — Transition maps.** Author `LEAD_TRANSITIONS`, `CUSTOMER_TRANSITIONS` (newly authored, DEC-1), and `TICKET_TRANSITIONS` (Flag C) as `const` records, exactly:
   - **Lead:** `new→[contacted,disqualified]`, `contacted→[qualified,disqualified]`, `qualified→[converted,disqualified]`, `disqualified→[contacted]`, `converted→[]`
   - **Customer:** `prospect→[onboarding]`, `onboarding→[active]`, `active→[inactive,churned]`, `inactive→[active,churned]`, `churned→[]`
   - **Ticket:** `open→[in_progress,pending,closed]`, `in_progress→[pending,resolved,open]`, `pending→[in_progress,resolved]`, `resolved→[closed,open]`, `closed→[]` (terminal — **reopen only via `resolved→open`**)
   *File:* `src/shared/domain/status.ts`
3. **AC3 — Status tone.** `STATUS_TONE` maps each pill-rendered status value to a semantic tone token (`neutral | info | success | warning | danger`), copied verbatim from constitution §3.3. It MUST include `customer.prospect` and `customer.onboarding`. Tone is the **only** source `StatusPill` (E0-S9) may read for status color. Scope of `STATUS_TONE` is the four pill-rendered categories — `lead`, `ticket`, `priority`, `customer` (see Dev Notes re: tenant/source/role).
   *File:* `src/shared/domain/status.ts`
4. **AC4 — `canTransition` helper.** Export `canTransition(entity, from, to): boolean` that resolves the correct map by entity kind (`'lead' | 'customer' | 'ticket'`) and returns whether `to` is in the legal set for `from`. This is the single helper the service/repository layer (4-beat *mutate* beat) calls before any state move. It performs **structural legality only** — no business preconditions (see Dev Notes re: DEC-CC-2).
   *File:* `src/shared/domain/status.ts`
5. **AC5 — Illegal transition → 422 (documented contract).** Document and expose the contract that an illegal transition surfaces as `422` (UC-3) when invoked via `POST /{resource}/{id}/transition`; state never changes via `PATCH status`. Enforcement lands in E0-S4 — **this story guarantees `canTransition` returns `false` for the illegal case** and carries the contract in a doc comment.
   *File:* `src/shared/domain/status.ts`
6. **AC6 — Exhaustive transition tests.** Vitest unit tests cover **every** legal transition in each map (assert `true`) and a representative sample of illegal transitions per map (assert `false`), including: terminal states `converted` / `churned` / `closed` reject **all** moves, and `resolved→open` is the **only** legal ticket reopen. Additionally assert `STATUS_TONE` has a tone for **every** literal in each of its categories (no missing keys).
   *File:* `src/shared/domain/status.test.ts`

## Tasks / Subtasks

- [x] **Task 1 — Create the domain kernel module** (AC: 1, 2, 3, 4, 5)
  - [x] Create directory `src/shared/domain/` and file `src/shared/domain/status.ts`
  - [x] Define the eight string-literal union types (AC1), copied verbatim from constitution §3.1
  - [x] Author the three `*_TRANSITIONS` maps typed as `Record<XStatus, XStatus[]>` (AC2), copied verbatim from constitution §3.2
  - [x] Author `STATUS_TONE` `as const` over `{lead, ticket, priority, customer}` (AC3), copied verbatim from constitution §3.3
  - [x] Export `canTransition(entity, from, to)` resolving map by entity kind; structural check only (AC4)
  - [x] Add a doc comment on `canTransition` stating the illegal→`422`/no-`PATCH-status` contract and the DEC-CC-2 carve-out (AC5)
- [x] **Task 2 — Make tests runnable (minimal Vitest install)** (AC: 6) — see Dev Notes "Tooling gap"
  - [x] Vitest present in `package.json` devDeps (`vitest ^4.1.8`); no RTL/Playwright/jsdom added by this story
  - [x] Add `vitest.config.ts` (node environment is sufficient — no DOM needed for this story)
  - [x] Add a `"test": "vitest run"` script to `package.json`
- [x] **Task 3 — Author exhaustive transition + tone tests** (AC: 6)
  - [x] `src/shared/domain/status.test.ts`: iterate each map and assert every listed `(from → to)` pair is `true` via `canTransition`
  - [x] Assert a representative sample of illegal pairs is `false` (incl. all terminal-state moves and all non-`resolved→open` reopen attempts)
  - [x] Assert each `STATUS_TONE` category has a key for every literal in its union (drive the assertion off the union, not a hardcoded list)
  - [x] Run `npm test` — all green (70 tests pass)
- [x] **Task 4 — Conformance gates** (AC: all)
  - [x] `npx tsc -b` clean (no `enum`, type-only imports use `import type` per `verbatimModuleSyntax`)
  - [x] `npm run lint` clean
  - [x] Self-check against DoD (constitution §10) — note which items are out-of-scope for a non-UI, non-persistence kernel story

## Dev Notes

### What this story is (and is NOT)
This is a **pure domain-kernel module** — TypeScript types, three constant transition maps, one tone map, and one pure helper, plus its unit test. **No React, no persistence, no service/API code, no UI.** It is the single source of truth that every later story imports. Get the literals and maps **exactly** right — downstream switch statements rely on exhaustiveness.

### Source of truth — copy verbatim from the constitution
`_bmad-output/project-context.md` §3 is canonical and already pins every literal, map, and tone. **Copy them exactly — do not paraphrase or "improve" them.** The relevant blocks:
- §3.1 — the eight literal unions [Source: project-context.md#3.1]
- §3.2 — `LEAD_TRANSITIONS`, `CUSTOMER_TRANSITIONS`, `TICKET_TRANSITIONS` [Source: project-context.md#3.2]
- §3.3 — `STATUS_TONE` (`lead`/`ticket`/`priority`/`customer` categories) [Source: project-context.md#3.3]

### 🚨 Tooling gap — Vitest is not installed yet
`package.json` currently has **no test framework and no `test` script**, and `node_modules` has no vitest binary. The full testing harness (RTL + Playwright + jsdom + `vitest.config.ts` + architecture-fitness test) is formally wired in **E0-S11** (the last E0 story) [Source: architecture.md#ADR-013, source-tree L769]. But AC6 here requires **runnable** Vitest tests now, and DoD §10 requires tests pass. Resolution: install **only** `vitest` (`npm i -D vitest`, version per the ADR-013 install line) and add a minimal `vitest.config.ts` (node environment — this story needs no DOM) plus a `"test": "vitest run"` script. Do **not** pre-empt E0-S11 by adding RTL/Playwright/jsdom. [Source: architecture.md L120-122]

### 🚨 No `enum` — `erasableSyntaxOnly` will reject it
[tsconfig.app.json](tsconfig.app.json) sets `"erasableSyntaxOnly": true` and `"verbatimModuleSyntax": true`. Consequences the dev agent MUST honor:
- **No TS `enum`** anywhere (it emits runtime JS and fails the compile) — use string-literal unions. AC1 already mandates this; the compiler enforces it.
- **Type-only imports must use `import type`** (e.g. in the test: `import type { LeadStatus } from './status'` for types, plain `import { canTransition, LEAD_TRANSITIONS } from './status'` for values).
- The `*_TRANSITIONS` and `STATUS_TONE` are runtime `const` objects (allowed) — type them with `Record<...>` / `as const`, never as enums.

### `canTransition` — structural legality ONLY
`canTransition(entity, from, to)` answers one question: *is `to` in the legal set for `from` in this entity's map?* It must **not** encode business preconditions:
- **DEC-CC-2 customer activation gate:** `onboarding → active` requires the customer to have both `taxRegistrationNumber` and `contactAddress`. This is an **action-guard precondition** enforced later in the service layer (E0-S4 / E3-S2), **not** in `canTransition`. `canTransition('customer','onboarding','active')` returns **`true`** structurally; the precondition is a separate `422` carve-out (no pill change, no `StatusChanged` event). Do not bake it into this helper. [Source: project-context.md DEC-CC-2 §3.2; architecture.md#Pattern-4]
- **Ticket customer-state gate** (tickets only against `active`/`onboarding` customers) is likewise an action-guard precondition, not part of `canTransition`. [Source: architecture.md#Pattern-4]
- `TenantStatus` has **no** transition map in §3.2; `canTransition`'s entity kind is `'lead' | 'customer' | 'ticket'` only.

### `STATUS_TONE` scope — don't invent tones
Constitution §3.3 defines tone for exactly four categories: `lead`, `ticket`, `priority`, `customer`. **`TenantStatus`, `LeadSource`, and `Role` are NOT pill-rendered and have no tone** — do not add bogus tone entries for them to "satisfy" AC6. AC6's exhaustiveness assertion is scoped to the categories that exist in `STATUS_TONE` (every literal of `LeadStatus`, `TicketStatus`, `TicketPriority`, `CustomerStatus` has a key). Drive the test off the union types so an added status becomes a failing test (and, with `noUncheckedIndexedAccess`-style exhaustive switches downstream, a compile error). [Source: project-context.md#3.3]

### Architecture compliance (guardrails)
- **File location is fixed:** `src/shared/domain/status.ts` + `src/shared/domain/status.test.ts`. The `domain/` folder does not exist yet — create it. `src/shared/` already exists (`ui/tokens/`). [Source: architecture.md source-tree L785-790]
- **NFR-1 one-way dependency:** this is shared-layer code; it imports **nothing** from `src/features/*`. It has no imports at all beyond (in the test) vitest + itself.
- **NFR-3 single status source:** after this lands, every status string, tone, and transition in the entire app resolves here. UI never hardcodes a status string; service layer calls `canTransition` before any move. [Source: architecture.md#Pattern-4, §Enforcement-Guidelines]
- **Downstream consumers (do not build, just be compatible):** `StatusPill` reads `STATUS_TONE` (E0-S9); the 4-beat mutate beat / `LocalStorageRepository.transition()` calls `canTransition` (E0-S4); illegal → `422` (UC-3). Event naming (`<Entity>.StatusChanged`, ADR-008) is downstream — not implemented here. [Source: architecture.md#ADR-008]

### Status changelog context (why these maps differ from a naive CRM)
- `CustomerStatus` was expanded 3→5 states with `CUSTOMER_TRANSITIONS` newly authored (DEC-1) — it was the 🔴 blocker for the conversion saga (E3-S1) and onboarding (E3-S2).
- Ticket `closed` is **terminal**; reopen is only `resolved → open` (Flag C). Be careful: `closed → []`, and `resolved` is the only state that lists `open`.

### Project Structure Notes
- Stack: React 19 + TypeScript ~6.0.2 + Vite 8, npm (lockfile present). [Source: package.json]
- This story touches **no React** — it is plain `.ts`. ESLint flat config applies; keep it lint-clean.
- Naming: the architecture source tree explicitly names this file `status.ts` (not `status.types.ts`) because it carries runtime maps + a helper, not just types. [Source: architecture.md source-tree L787]
- No previous story exists (first story of Epic 0). No prior implementation patterns to inherit; the constitution + architecture are the only sources. Recent commits are docs/prototype only (`add prototype`, `adopt realized tokens`) — the HTML/JSX prototype under `Prototype/` is illustrative of UI status usage but is **not** a code source; the constitution reconciled it (DEC-CC-*).

### Definition of Done (scoped for a kernel story) — constitution §10
Applicable: meets ACs; passes `bmad-code-review`; uses the single status source (this story *is* it); statuses/transitions per §3; `tsc` + lint + tests green; traceable chain (`Closes #<issue>`). **N/A for this story** (no persistence/UI/auth): tenant scoping, audit/domain event emission, four UI states — those bind the stories that consume this kernel.

### References
- [Source: _bmad-output/planning-artifacts/epics/epic-0-platform-guidelines/E0-S1.md] — story spec & ACs
- [Source: _bmad-output/planning-artifacts/epics/epic-0-platform-guidelines/epic-0.md#Feature-0.1] — epic context, build order S1→S2→…
- [Source: project-context.md#3] — §3.1 literals, §3.2 transition maps, §3.3 STATUS_TONE (canonical, copy verbatim); DEC-1, DEC-CC-2, Flag C
- [Source: architecture.md#Pattern-4-Status-transitions] — `canTransition` contract, illegal→422
- [Source: architecture.md#ADR-013] — Vitest testing stack; install line L120-122
- [Source: architecture.md#ADR-008] — downstream event naming (`StatusChanged`)
- [Source: architecture.md#Source-Tree L785-790, L769] — file locations; harness wired in E0-S11
- [Source: tsconfig.app.json] — `erasableSyntaxOnly`, `verbatimModuleSyntax` (no enum; `import type`)
- PRD: prd.md §6 E0-S1 · ADR(s): ADR-008 · Inherited UC: TC (Traceability)

## Dev Agent Record

### Agent Model Used

claude-opus-4-8[1m] (bmad-dev-story workflow)

### Debug Log References

- `npm test` → 70 tests passed (1 file), node environment, vitest 4.1.8.
- `npx tsc -b` → exit 0 (no `enum`; type-only imports use `import type`; config files type-checked via tsconfig.node.json).
- `npm run lint` → exit 0, no findings.

### Completion Notes List

- **AC1** — Eight string-literal unions authored in `src/shared/domain/status.ts`, copied verbatim from constitution §3.1. No TS `enum` (would fail `erasableSyntaxOnly`).
- **AC2** — `LEAD_TRANSITIONS`, `CUSTOMER_TRANSITIONS`, `TICKET_TRANSITIONS` copied verbatim from §3.2 as `Record<XStatus, XStatus[]>` `const` declarations. (Kept the verbatim `: Record<...>` annotation from §3.2 rather than `as const` — Dev Notes mandate exact copy, and `as const` would conflict with the annotated mutable-array type.)
- **AC3** — `STATUS_TONE as const` over the four pill-rendered categories (`lead`/`ticket`/`priority`/`customer`); includes `customer.prospect` and `customer.onboarding`. No bogus tones for tenant/source/role.
- **AC4** — `canTransition(entity, from, to)` resolves the map by entity kind (`'lead'|'customer'|'ticket'`), structural legality only. `canTransition('customer','onboarding','active')` returns `true` (DEC-CC-2 precondition deferred to service layer).
- **AC5** — Doc comment on `canTransition` carries the illegal→`422` (UC-3) / never-via-`PATCH status` contract and the DEC-CC-2 + ticket customer-state carve-outs. Enforcement lands in E0-S4.
- **AC6** — 70 Vitest assertions: every legal transition per map asserted `true`; terminal states (`converted`/`churned`/`closed`) reject all moves; `resolved→open` is the only terminal/blocked-state reopen and `closed→open` is rejected; representative illegal pairs `false`; unknown from-state returns `false` (no throw); every `STATUS_TONE` literal has a valid tone, driven off the unions via `satisfies Record<Union, true>` so an added status is a compile error.
- **DoD (constitution §10) scoping:** Applicable items met — ACs satisfied; single status source (this module *is* it); statuses/transitions per §3; `tsc`+lint+tests green. N/A for this kernel story (no persistence/UI/auth): tenant scoping, audit/domain-event emission, four UI states.

### File List

- `src/shared/domain/status.ts` (new) — domain kernel: literals, transition maps, tone, `canTransition`
- `src/shared/domain/status.test.ts` (new) — exhaustive transition + tone unit tests
- `vitest.config.ts` (new) — minimal node-environment Vitest config
- `package.json` (modified) — added `vitest ^4.1.8` to devDeps and the `"test": "vitest run"` script (RTL/jsdom removed in review — see Review Findings)
- `tsconfig.node.json` (modified) — added `vitest.config.ts` to `include`

### Change Log

| Date | Change |
|------|--------|
| 2026-06-07 | Implemented E0-S1 domain status kernel (status.ts), exhaustive tests, minimal Vitest wiring. All conformance gates green. Status → review. |
| 2026-06-07 | Code review (bmad-code-review): hardened `canTransition` against inherited-key throw + unknown-entity fallthrough (+2 regression tests, 72 pass); removed premature RTL/jsdom devDeps per Tooling-gap note (vitest only); corrected File List. Gates re-run green. |

## Review Findings

_bmad-code-review, 2026-06-07 — 0 decision-needed · 3 patch (all fixed) · 0 deferred · ~18 dismissed as by-design/noise._

- [x] [Review][Patch] `canTransition` threw on inherited Object keys & silently used the ticket map for an unknown entity [src/shared/domain/status.ts:86-93] — **fixed**: `Object.hasOwn` guard + explicit `ticket` branch with empty-object default; preserves the documented "unknown status → rejected (no throw)" contract. Confirmed reproducible (`canTransition('lead','toString','x')` threw `TypeError`) before the fix; +2 regression tests in status.test.ts.
- [x] [Review][Patch] RTL + jsdom devDeps (`@testing-library/react`, `@testing-library/jest-dom`, `@testing-library/user-event`, `jsdom`) added in violation of the Tooling-gap note "install **only** `vitest` … do not pre-empt E0-S11" [package.json] — **fixed**: uninstalled; only `vitest ^4.1.8` retained; node-env tests still green (72 pass).
- [x] [Review][Patch] Dev Agent Record File List understated the `package.json` change (omitted the devDep additions) [story record] — **fixed**: File List corrected.

_Notable dismissals:_ AC1–AC6 verified verbatim against constitution §3, so the "asymmetric transition rules", "closed-terminal comment contradiction", and "STATUS_TONE missing tenant" flags are by-design (canonical §3.2 / Flag C / AC3 explicitly forbids tenant tones). The `string` typing of `from`/`to` is **required** by AC6's `'bogus'` no-throw test — narrowing it to the union would break the spec's own test. Case/empty-string inputs returning `false` is correct safe behavior for invalid input. The node-env / `.ts`-only vitest config is correct for this kernel story (E0-S11 owns the full jsdom harness).
