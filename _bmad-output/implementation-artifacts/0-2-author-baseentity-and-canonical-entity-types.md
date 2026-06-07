---
baseline_commit: 76266366a32d3dd2a9a9b5f37e4c4510a0c41eeb
---

# Story 0.2: Author BaseEntity and canonical entity types

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

- **Story ID:** E0-S2 (`0-2-author-baseentity-and-canonical-entity-types`)
- **Epic:** E0 — Platform Guidelines & Standards (the governing contract) · **Feature:** 0.1 — Domain & Status Kernel
- **Cut:** Pilot · **Depends on:** E0-S1 (status/role literals — `done`) · **ADRs:** ADR-002 · **Constitution:** §2, §3
- **Unblocks:** E0-S3 + E0-S4 (the `Repository<T>` generics bind to `BaseEntity`) · **Hard prerequisite for Epic 3 & Epic 4** (`WorkflowInstance` is the saga/onboarding persisted state; the bidirectional conversion lineage feeds E3-S1)

## Story

As the platform,
I want all canonical entities to derive from one `BaseEntity` and carry typed IDs and lineage,
so that tenancy, audit, versioning, and saga state are uniform across every feature.

## Acceptance Criteria

1. **AC1 — `BaseEntity`.** Define `BaseEntity` (NFR-2, constitution §2.1) in `src/shared/domain/types.ts` with exactly these fields: `id: ID`, `tenantId: ID`, `subsidiaryId: ID | null`, `createdAt: string`, `updatedAt: string`, `createdBy: ID`, `updatedBy: ID`, `version: number`, `deletedAt: string | null`. Also export `type ID = string` (a type-prefixed UUID). Every persisted entity extends `BaseEntity`.
   *File:* `src/shared/domain/types.ts`
2. **AC2 — Canonical entity types.** Define `Tenant`, `Subsidiary`, `User`, `Customer` (shared capability), `Lead`, and `Ticket`, each extending `BaseEntity` and using the **E0-S1** status/role literals imported from `./status` via `import type`. `Customer` carries `taxRegistrationNumber?: string` and `contactAddress?: string` (DEC-CC-2) — optional fields the §3.2 activation gate (E3-S2) requires before `onboarding → active`. Fields copied verbatim from constitution §2.2 (see Dev Notes for the reconciliations that override §2.2).
   *Files:* `src/shared/domain/tenant.types.ts` (`Tenant`, `Subsidiary`, `User`), `src/shared/domain/customer.types.ts` (`Customer`), `src/shared/domain/lead.types.ts` (`Lead`), `src/shared/domain/ticket.types.ts` (`Ticket`)
3. **AC3 — Bidirectional conversion lineage (flag G).** `Customer` carries `convertedFromLeadId?: ID`; `Lead` carries `convertedToCustomerId?: ID`. **Both are optional** (`?:`), not `| null` — see Dev Notes "Reconciliation 2". This pair is the durable lineage the conversion saga (E3-S1, Pattern 2 step `link-lineage`) writes.
   *Files:* `src/shared/domain/customer.types.ts`, `src/shared/domain/lead.types.ts`
4. **AC4 — Type-prefixed UUID factory.** In `src/shared/domain/types.ts`, export an ID factory that produces type-prefixed UUIDs using `crypto.randomUUID()`. Prefixes (constitution §2.1): `lead_`, `cust_`, `tkt_`, `wf_`, `tnt_`, `sub_`, `usr_`. All entity creation (the repository *create* beat, E0-S4) uses it so IDs are self-describing. Shape: a `newId(kind)` helper keyed off a `const` prefix map — **not** an `enum`.
   *File:* `src/shared/domain/types.ts`
5. **AC5 — `WorkflowInstance` saga entity.** In `src/shared/domain/types.ts` (lives with `BaseEntity`), define `WorkflowInstance` extending `BaseEntity` with: `type` (`"lead_conversion" | "customer_onboarding"` literal), `status` (`"running" | "completed" | "compensating" | "failed"` literal), `currentStep: number`, `steps: string[]`, `completedSteps: string[]`, `correlationId: string`, `payload`. This is the **persisted state the conversion saga (E3-S1) and onboarding workflow (E3-S2) read and resume from** via the `WorkflowRunner` (E3). Make `payload` generic (`WorkflowInstance<P = unknown>`) — concrete payload shapes (e.g. `{ leadId, fieldMap, customerId? }`) belong to E3, not here.
   *File:* `src/shared/domain/types.ts`
6. **AC6 — Tests (NFR-12).** Vitest unit tests in `src/shared/domain/types.test.ts`:
   - **ID factory:** each `kind` emits the correct prefix (`newId('lead')` → starts `lead_`, `customer` → `cust_`, `ticket` → `tkt_`, `workflow` → `wf_`, `tenant` → `tnt_`, `subsidiary` → `sub_`, `user` → `usr_`); two calls return **distinct** values; the part after the prefix is a valid UUID v4 shape.
   - **`WorkflowInstance` round-trip:** `JSON.parse(JSON.stringify(instance))` preserves `correlationId`, `currentStep`, `completedSteps`, `steps`, `type`, `status`.
   - **Compile-time:** type-level assertions that each entity extends `BaseEntity` (e.g. `const _c: BaseEntity = {} as Customer`), kept in the test file or a `// @ts-expect-error`-guarded block.
   *File:* `src/shared/domain/types.test.ts`

## Tasks / Subtasks

- [x] **Task 1 — Author the base kernel** `src/shared/domain/types.ts` (AC: 1, 4, 5)
  - [x] Export `type ID = string` and `interface BaseEntity { … }` with the nine fields verbatim from constitution §2.1 (AC1)
  - [x] Add the type-prefixed `ID_PREFIXES` `const` map + `newId(kind)` factory using `crypto.randomUUID()` (AC4) — no `enum`
  - [x] Define `WorkflowStatus`, `WorkflowType` literal unions + `interface WorkflowInstance<P = unknown> extends BaseEntity { … }` (AC5)
- [x] **Task 2 — Author the canonical entity type files** (AC: 2, 3)
  - [x] `tenant.types.ts`: `Tenant` (`name`, `status: TenantStatus`), `Subsidiary` (`name`, `parentSubsidiaryId: ID | null`), `User` (`email`, `displayName`, `roles: Role[]`) — all `extends BaseEntity`; `import type { TenantStatus, Role } from './status'`
  - [x] `customer.types.ts`: `Customer extends BaseEntity` with `name`, `primaryEmail`, `phone?`, `status: CustomerStatus`, `convertedFromLeadId?: ID`, `taxRegistrationNumber?: string`, `contactAddress?: string`; `import type { CustomerStatus } from './status'` + `import type { ID } from './types'`
  - [x] `lead.types.ts`: `Lead extends BaseEntity` with `name`, `email`, `phone?`, `company?`, `source: LeadSource`, `status: LeadStatus`, `ownerId: ID`, `notes?`, `convertedToCustomerId?: ID`; `import type { LeadStatus, LeadSource } from './status'`
  - [x] `ticket.types.ts`: `Ticket extends BaseEntity` with `customerId: ID`, `subject`, `description`, `status: TicketStatus`, `priority: TicketPriority`, `assigneeId: ID | null`; `import type { TicketStatus, TicketPriority } from './status'`
- [x] **Task 3 — Author tests** `src/shared/domain/types.test.ts` (AC: 6)
  - [x] ID-factory prefix + uniqueness + UUID-shape assertions for every `kind`
  - [x] `WorkflowInstance` serialize/deserialize round-trip preserving the listed fields
  - [x] Compile-time `extends BaseEntity` assertions for all six entities + `WorkflowInstance`
  - [x] `npm test` — all green (E0-S1's 72 still pass + the new file)
- [x] **Task 4 — Conformance gates** (AC: all)
  - [x] `npx tsc -b` clean (no `enum`; type-only imports use `import type` per `verbatimModuleSyntax`)
  - [x] `npm run lint` clean
  - [x] Self-check against DoD (constitution §10) — note which items are out-of-scope for a non-UI, non-persistence kernel story

## Dev Notes

### What this story is (and is NOT)
A **pure domain-kernel module**: TypeScript interfaces/types, one `const` prefix map, one pure ID factory, and unit tests. **No React, no persistence, no Zod, no service/API/UI code.** It is the type foundation every later story imports. Get the field names and optionality **exactly** right — the `Repository<T>` generics (E0-S3) and the saga `WorkflowRunner` (E3) bind to these shapes; a wrong field cascades into every downstream story.

### Source of truth — copy verbatim from the constitution, with three explicit reconciliations
`_bmad-output/project-context.md` §2 is canonical for entity fields. **Copy them exactly — do not paraphrase or "improve".** §2.1 = `BaseEntity` + `ID`; §2.2 = `Tenant`/`Subsidiary`/`User`/`Customer`/`Lead`/`Ticket`. [Source: project-context.md#2] Three places where the **story AC overrides** the constitution snippet — apply the AC:

- **🚨 Reconciliation 1 — file location is `src/shared/domain/types.ts`, NOT `shared/data/types.ts`.** Constitution §2.1's inline comment reads `// shared/data/types.ts`, but that comment is illustrative. The authoritative locations are the architecture source tree (`domain/types.ts # BaseEntity, ID, WorkflowInstance (E0-S2)`) and AC1. Put `ID` + `BaseEntity` + `WorkflowInstance` in **`src/shared/domain/types.ts`**, alongside the existing `status.ts`. [Source: architecture.md#Source-Tree L786; E0-S2.md AC1/AC5]
- **🚨 Reconciliation 2 — conversion lineage is optional (`?:`), not `| null`.** Constitution §2.2 predates flag G: it shows `Customer.convertedFromLeadId: ID | null` (required-nullable) and gives `Lead` **no** lineage field. AC3 (flag G, bidirectional) is the newer, more specific spec and **wins**: `Customer.convertedFromLeadId?: ID` and `Lead.convertedToCustomerId?: ID` — both **optional**. A non-converted record simply omits the field. [Source: E0-S2.md AC3; architecture.md#Pattern-2 step `link-lineage` L583]
- **🚨 Reconciliation 3 — entity → file split.** §2.2 lists the entities in one block; the source tree splits them across files. Map: `Tenant`/`Subsidiary`/`User` → **`tenant.types.ts`**; `Customer` → `customer.types.ts`; `Lead` → `lead.types.ts`; `Ticket` → `ticket.types.ts`. `BaseEntity`/`ID`/`WorkflowInstance` stay in `types.ts`. [Source: architecture.md#Source-Tree L786-788; E0-S2.md AC2]

### 🚨 No `enum`, `import type` everywhere — same compiler constraints E0-S1 hit
[tsconfig.app.json](tsconfig.app.json) sets `"erasableSyntaxOnly": true` and `"verbatimModuleSyntax": true` (`target: es2023`, `lib: ["ES2023","DOM"]`). Consequences the dev agent MUST honor:
- **No TS `enum`** anywhere — the ID-prefix set is a `const` object (`as const`), the `kind`/`status`/`type` discriminators are **string-literal unions**. (`enum` emits runtime JS and fails the compile.)
- **Type-only imports MUST use `import type`** — every status/role literal pulled from `./status` and every `ID`/`BaseEntity` pulled from `./types` into another type file is type-only: `import type { CustomerStatus } from './status'`. A plain `import` of a type fails `verbatimModuleSyntax`. The **only** runtime imports in this story are `newId`/`ID_PREFIXES` (values).
- `BaseEntity`/entities are interfaces (type-only); `WorkflowInstance` is an interface. `ID_PREFIXES` + `newId` are the only runtime exports of `types.ts`.

### `newId` — use the platform UUID API; entity creation's single ID source
- Use `crypto.randomUUID()` (available under `lib: DOM` in the browser and as a Node global in the Vitest **node** environment — no polyfill, no `uuid` package; **do not add a dependency**).
- Shape it as: a `const ID_PREFIXES = { lead:'lead_', customer:'cust_', ticket:'tkt_', workflow:'wf_', tenant:'tnt_', subsidiary:'sub_', user:'usr_' } as const` map, and `export function newId(kind: keyof typeof ID_PREFIXES): ID { return ID_PREFIXES[kind] + crypto.randomUUID() }`. Keep the **kind keys** human (`'customer'`) and the **prefixes** per §2.1 (`'cust_'`) — they intentionally differ.
- This is the helper the repository *create* beat (E0-S4) calls; it is **not** `newCorrelationId()` (that's a separate `events/correlation.ts` helper, E0-S7 — do **not** build it here). [Source: architecture.md#Source-Tree L802, L786; project-context.md §2.1, §4.2 rule 3]

### `WorkflowInstance` — the saga/onboarding persisted state (don't over-specify it)
Shape per architecture Pattern 2 [Source: architecture.md L570-575]:
```ts
export type WorkflowType   = "lead_conversion" | "customer_onboarding";
export type WorkflowStatus = "running" | "completed" | "compensating" | "failed";

export interface WorkflowInstance<P = unknown> extends BaseEntity {
  type: WorkflowType;
  status: WorkflowStatus;
  currentStep: number;        // resume point — saga reloads from here
  steps: string[];            // ordered step names
  completedSteps: string[];   // names of steps already run (idempotency)
  correlationId: string;      // ties the saga's multiple 4-beat mutations together
  payload: P;
}
```
- `id` is a `wf_…` UUID (`newId('workflow')`). [AC5, AC4]
- `steps`/`completedSteps` are `string[]` step **names** — do NOT hardcode the conversion step list (`guard`/`create-customer`/…) here; those are owned by E3-S1's saga definition. Keep `payload` generic; the concrete `{ leadId, fieldMap, customerId? }` shape is E3's. [Source: architecture.md#Pattern-2 L577-589]
- Resumability contract this entity exists to serve (context only — enforcement is E3): an interrupted saga reloads from `currentStep` and continues forward; a failure flips `status → compensating`, runs compensations in reverse, ends `failed` with no half-made customer. [Source: architecture.md#Pattern-2 L591-600]

### Architecture compliance (guardrails)
- **File locations are fixed** (all under the existing `src/shared/domain/`, which currently holds only `status.ts` + `status.test.ts`): `types.ts`, `tenant.types.ts`, `customer.types.ts`, `lead.types.ts`, `ticket.types.ts`, `types.test.ts`. **No barrel `index.ts`** (E0-S1 established direct-file imports; the source tree shows none). [Source: architecture.md#Source-Tree L785-790]
- **ADR-002 (the one ADR for this story):** `tenantId` is the **hard isolation boundary**; `subsidiaryId` is an **in-tenant scoping dimension**, and `subsidiaryId = null` ⇒ a **parent-level** record (tenant-wide config / shared `Customer` rows). This story encodes that as the `subsidiaryId: ID | null` field shape on `BaseEntity` — the **resolution logic** (relax filter for `tenant_admin`, etc.) lives in the repository (E0-S4), not here. Get the field nullable and required-present. [Source: architecture.md#ADR-002 L200-211]
- **NFR-1 one-way dependency:** shared-layer code; imports **nothing** from `src/features/*`. Imports are limited to sibling `./status` and `./types`.
- **NFR-2 BaseEntity standard:** after this lands, every persisted entity in the app extends `BaseEntity`; tenant scope (`tenantId`) is mandatory, timestamps are ISO 8601 **strings** (never `Date`), deletes are soft (`deletedAt`), `version` starts at 1 (the repository sets it on create — not a default here). [Source: project-context.md §2.1; architecture.md#Data-model L233-239]
- **Downstream consumers (do not build — just be shape-compatible):** `Repository<T extends BaseEntity>` + `create(input: Omit<T, keyof BaseEntity>)` (E0-S3); `LocalStorageRepository` create-beat calls `newId` and sets all audit fields + `version=1` (E0-S4); Zod `schemas.ts` derives runtime validation per entity (E0-S3/E0-S4 — **not** this story); `WorkflowRunner` reads `WorkflowInstance` (E3). [Source: architecture.md#Source-Tree L781-789, project-context.md §4.1]

### Previous story intelligence (E0-S1 — `done`)
E0-S1 shipped `src/shared/domain/status.ts` (the status literals this story imports) + `status.test.ts`, and is the pattern to mirror. Actionable carry-overs:
- **Status literals already exist** — `import type { LeadStatus, LeadSource, CustomerStatus, TicketStatus, TicketPriority, TenantStatus, Role } from './status'`. Do **not** redefine them. [src/shared/domain/status.ts:15-21]
- **Vitest is already wired** (node environment, `vitest ^4.1.8`, `"test": "vitest run"`, `vitest.config.ts` in `tsconfig.node.json`). Add `types.test.ts` alongside — **no new test deps.** A review finding on E0-S1 explicitly **removed** RTL/jsdom as premature (E0-S11 owns the full harness); do not re-add them. [E0-S1 Review Findings]
- **Drive exhaustiveness off the types, not hardcoded lists** — E0-S1 used `satisfies Record<Union, true>` so an added literal becomes a compile error. Apply the same spirit: drive the ID-factory test loop off the `ID_PREFIXES` keys so a new `kind` is automatically covered.
- **Test author for no-throw on bad input** — E0-S1's review caught an unguarded throw. The ID factory has no user input, but keep the UUID-shape assertion strict.

### Git intelligence
- `bbb246b feat(E0-S1): status enums, transition maps, tones` is the immediately preceding implementation commit; recent history before it is docs/prototype only (`add prototype`, `adopt realized tokens`). The `Prototype/` HTML/JSX is illustrative of UI usage and is **not** a code source. Branch-per-story convention in use (`story/E0-S1-status-maps`); this story's branch is `story/E0-S2-author-baseentity-and-canonical-entity-types` (already checked out).
- No existing `types.ts` / `*.types.ts` anywhere in `src/` — all six files are **NEW**; nothing to preserve or regress.

### Project Structure Notes
- Stack: React 19 + TypeScript ~6.0.2 + Vite 8, Vitest 4.1.8, npm (lockfile present). [Source: package.json]
- This story touches **no React** — plain `.ts`. ESLint flat config applies; keep lint-clean.
- Naming: types/interface files are `thing.types.ts` (per §9 + source tree); the base kernel is `types.ts` (it carries the runtime `newId` factory + the foundational `BaseEntity`/`ID`, mirroring why `status.ts` is not `status.types.ts`). [Source: project-context.md §9; architecture.md#Source-Tree L786-788]

### Definition of Done (scoped for a kernel story) — constitution §10
Applicable: meets ACs; passes `bmad-code-review`; uses the shared status source (imports E0-S1, no re-definition); entity shapes per §2; `tsc` + lint + tests green; traceable chain (`Closes #<issue>`). **N/A for this story** (no persistence/UI/auth): tenant-scoping *enforcement*, audit/domain-event emission, the four UI states — those bind the stories that consume this kernel (E0-S4, E0-S9, Epics 1–5).

### References
- [Source: _bmad-output/planning-artifacts/epics/epic-0-platform-guidelines/E0-S2.md] — story spec & ACs
- [Source: _bmad-output/planning-artifacts/epics/epic-0-platform-guidelines/epic-0.md#Feature-0.1] — epic context, build order S1→S2→S3+S4
- [Source: project-context.md#2] — §2.1 `BaseEntity`/`ID`, §2.2 canonical entities (copy verbatim, apply the 3 reconciliations); §2.1 ID prefixes
- [Source: project-context.md#3] — §3.1 status/role literals (imported from E0-S1's `status.ts`)
- [Source: architecture.md#ADR-002 L200-211] — `tenantId` isolation boundary / `subsidiaryId` scoping dimension / `null` = parent-level
- [Source: architecture.md#Data-model L233-244] — `BaseEntity` + `WorkflowInstance` field list; key scheme; Zod-per-entity is downstream
- [Source: architecture.md#Pattern-2 L563-600] — `WorkflowInstance` state model + conversion lineage (`link-lineage`)
- [Source: architecture.md#Source-Tree L780-818] — file locations; `domain/types.ts` (NOT `data/`); no barrel
- [Source: src/shared/domain/status.ts] — the E0-S1 literals to import; the module-pattern to mirror
- [Source: _bmad-output/implementation-artifacts/0-1-author-status-enums-transition-maps-and-tone.md] — previous-story learnings (Vitest wiring, no-enum, no premature test deps)
- [Source: tsconfig.app.json] — `erasableSyntaxOnly`, `verbatimModuleSyntax` (no enum; `import type`)
- PRD: prd.md §6 E0-S2 · ADR(s): ADR-002 · Inherited UC: TC (Traceability)

## Dev Agent Record

### Agent Model Used

claude-opus-4-8[1m] (Claude Code dev-story workflow)

### Debug Log References

- `npm test` → 2 files, **83 passed** (72 E0-S1 + 11 new). No regressions.
- `npx tsc -b` → clean (exit 0). No `enum`; all cross-file type pulls use `import type` / inline `type` modifier (`verbatimModuleSyntax` satisfied).
- `npm run lint` (`eslint .`) → clean (exit 0).

### Completion Notes List

- **Reconciliation 1 applied** — `ID`/`BaseEntity`/`WorkflowInstance` live in `src/shared/domain/types.ts` (not `data/`), alongside the existing `status.ts`. No barrel `index.ts`.
- **Reconciliation 2 applied** — conversion lineage is optional: `Customer.convertedFromLeadId?: ID` and `Lead.convertedToCustomerId?: ID` (flag G, bidirectional). Overrides §2.2's `| null` / lead-has-none. Test `lineage fields are optional, not nullable` proves a non-converted record omits the field and compiles.
- **Reconciliation 3 applied** — entities split: `Tenant`/`Subsidiary`/`User` → `tenant.types.ts`; `Customer` → `customer.types.ts`; `Lead` → `lead.types.ts`; `Ticket` → `ticket.types.ts`.
- **`newId`** uses a `const ID_PREFIXES` map (`as const`) + `crypto.randomUUID()` — no `enum`, no `uuid` dependency. Kind keys are human (`'customer'`), prefixes are §2.1 wire prefixes (`'cust_'`). The ID-factory test loops off `Object.entries(ID_PREFIXES)`, so adding a kind is auto-covered (E0-S1 exhaustiveness carry-over).
- **`WorkflowInstance<P = unknown>`** kept generic; step lists and concrete payload shapes deferred to E3. JSON round-trip test preserves `correlationId`/`currentStep`/`completedSteps`/`steps`/`type`/`status`.
- **DoD scope note (constitution §10):** met — ACs, shared status source (imported, not redefined), entity shapes per §2, `tsc` + lint + tests green. **N/A for this kernel story:** tenant-scoping *enforcement*, audit/event emission, the four UI states, persistence/Zod schemas — those bind the consuming stories (E0-S3/S4, Epics 1–5). `version` left for the repository to set on create (E0-S4), not defaulted here.

### File List

- `src/shared/domain/types.ts` (new) — `ID`, `BaseEntity`, `ID_PREFIXES`, `IdKind`, `newId`, `WorkflowType`, `WorkflowStatus`, `WorkflowInstance`
- `src/shared/domain/tenant.types.ts` (new) — `Tenant`, `Subsidiary`, `User`
- `src/shared/domain/customer.types.ts` (new) — `Customer`
- `src/shared/domain/lead.types.ts` (new) — `Lead`
- `src/shared/domain/ticket.types.ts` (new) — `Ticket`
- `src/shared/domain/types.test.ts` (new) — ID-factory, WorkflowInstance round-trip, compile-time `extends BaseEntity` assertions
- `_bmad-output/implementation-artifacts/sprint-status.yaml` (modified) — E0-S2 status → in-progress → review

### Review Findings (bmad-code-review — 2026-06-07)

Three parallel layers (Blind Hunter, Edge Case Hunter, Acceptance Auditor). Acceptance Auditor: **all six ACs + constitution constraints PASS**. Two flagged findings were independently verified and refuted; one is deferred.

- [x] [Review][Defer] `crypto.randomUUID()` requires a secure context [src/shared/domain/types.ts:62] — `newId` uses the bare global. Safe for Vitest (Node), `localhost` dev, and HTTPS prod, but throws `TypeError` if served over plain `http://` on a LAN IP. The story consciously accepted "no polyfill, no `uuid` dependency", so this is a deployment constraint, not a code fix — recorded in `deferred-work.md`.
- [x] [Review][Verified-Refuted] "strict-off nullifies the optional-vs-nullable contract" — **false**. `strictNullChecks` is effectively active (TS ~6.x default); `convertedFromLeadId: null` and `tenantId: null` both fail to compile. AC3 is compiler-enforced.
- [x] [Review][Dismissed-by-spec] Unbranded `type ID = string`, `?:`-vs-`| null` convention mix, bare `string` timestamps, `newId` runtime kind-guard, empty-`steps` invariant — all intentional per constitution §2.1/§2.2, Reconciliation 2, ADR-002, or deferred to E0-S4/E3 (Zod/repository/saga). No action this story.

**Verdict:** clean, spec-conformant kernel. No `patch` or `decision-needed` findings; 1 deferred (deployment awareness).

## Change Log

- 2026-06-07 — Implemented E0-S2: authored `BaseEntity`/`ID`/`newId` factory/`WorkflowInstance` kernel + the six canonical entity types across `domain/*.types.ts`, with Vitest coverage. All ACs satisfied; `tsc -b`, `eslint`, and the full suite (83 tests) green. Status → review.
- 2026-06-07 — bmad-code-review passed: all ACs + constitution constraints conform; `strictNullChecks` contract verified enforced; 1 deferred deployment note (`crypto.randomUUID` secure-context). Status → done.
