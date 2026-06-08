---
baseline_commit: 3daea0df76e1cffc74ce6b84fa0c5cc1a92b06b2
---

# Story 0.4: Implement LocalStorageRepository honoring the 4-beat + REST contract

Status: ready-for-dev

- **Story ID:** E0-S4 (`0-4-implement-localstoragerepository-4-beat-rest-contract`)
- **Epic:** E0 — Platform Guidelines & Standards · **Feature:** 0.2 — Repository Seam & Data Kernel
- **Cut:** Pilot · **Depends on:** E0-S3 (done), E0-S1 (done), E0-S2 (done), E0-S5 (done), E0-S6 (done), E0-S7 (done)
- **ADRs:** ADR-004, ADR-007, ADR-008, ADR-009
- **Constitution:** project-context.md §4, §5, §6, §7
- **Unblocks:** ALL feature CRUD in Epics 1–5

## Story

As the platform,
the pilot persists through one localStorage adapter that runs every mutation through the 4-beat use case and returns REST-shaped envelopes,
so that the production frontend behaves identically when the adapter swaps to a server.

## Acceptance Criteria

1. **AC1 — Key scheme.** Persist under `crm:{tenantId}:{subsidiaryId|_parent}:{entity}` (parent-level rows use the `_parent` segment). Entity name is lowercase (e.g. `lead`, `customer`, `ticket`).
2. **AC2 — Scope from auth context, never from caller.** `tenantId`/`subsidiaryId` read from injected `SessionClaims`; callers cannot pass scope. `tenant_admin` (`subsidiaryId=null`) sees all tenant rows across all subsidiaries; a subsidiary user sees own + parent-level (`_parent`) rows.
3. **AC3 — Create / update / soft-delete semantics.** `create` sets `id` (typed UUID from `newId`), all BaseEntity audit fields, `version=1`. `update` requires the caller's `version`; mismatch → `409`. `remove` is soft (`deletedAt` set, excluded from `list`/`get`). `update` REJECTS `status` in the patch with `422` — status changes go through `transition()`.
4. **AC4 — Validate-before-persist (Zod).** Every write validates the full entity with `schemas.ts`; invalid → `422` with `ValidationDetail[]` (field + issue). No invalid row is ever written.
5. **AC5 — 4-beat on every mutation.** Order is fixed: authorize → mutate → emit → audit. `authorize()` from `permissions.ts` is called (it handles `Auth.RoleDenied` internally on denial). On denial: outcome=`denied` → throw `RepositoryError(403)`; outcome=`notFound` (out-of-tenant) → throw `RepositoryError(404)`. On grant: validate (Zod) + write + emit one `DomainEvent` (canonical type) + append one `AuditEvent`, all sharing one `correlationId` minted at action start. `canTransition` called on the mutate beat for state moves (illegal → `422`).
6. **AC6 — REST-shaped errors.** `RepositoryError` carries `statusCode` + `code` + `message` + optional `details: ValidationDetail[]`. Codes: `201` on create (plus `location: /entity/{id}`), `204` on delete, `200` on read/update, `409`/`422`/`403`/`404` on errors. `transition()` is the only path that changes status (maps to `POST /{id}/transition`).
7. **AC7 — Fault-injection toggle.** `faultInjection.ts` exports `setFaultMode('409'|'422'|'network'|'none')` / `getFaultMode()` / `resetFaultMode()`. Each mutation checks the fault mode at its start and throws the matching `RepositoryError`, so optimistic-rollback paths are deterministically testable.

## Tasks / Subtasks

- [ ] **Task 1 — Install Zod** (AC: 4)
  - [ ] `npm install zod` — adds zod as production dependency
- [ ] **Task 2 — Create `src/shared/domain/schemas.ts`** (AC: 4)
  - [ ] `baseEntitySchema` with all 9 BaseEntity fields (id, tenantId, subsidiaryId, createdAt, updatedAt, createdBy, updatedBy, version, deletedAt)
  - [ ] `leadSchema`, `customerSchema`, `ticketSchema` extending baseEntitySchema with entity-specific fields
  - [ ] Export all schemas; types exported via `import type { z } from 'zod'`
- [ ] **Task 3 — Create `src/shared/data/faultInjection.ts`** (AC: 7)
  - [ ] `FaultMode` type: `'409' | '422' | 'network' | 'none'`
  - [ ] `setFaultMode`, `getFaultMode`, `resetFaultMode` (test-only reset)
- [ ] **Task 4 — Create `src/shared/data/LocalStorageRepository.ts`** (AC: 1–7)
  - [ ] `RepositoryError` class with `statusCode, code, message, details?, location?`
  - [ ] `ValidationDetail` interface `{ field: string; issue: string }`
  - [ ] `EntityEventConfig` interface for event type names per operation
  - [ ] `EntityConfig<T>` interface for constructor options (name, entityType, idKind, schema, capability, deleteCapability, events, transitionEntity?)
  - [ ] `LocalStorageRepository<T extends BaseEntity>` class implementing `Repository<T>`
  - [ ] Private key helpers: `writeKey()`, `accessibleKeys()`, `readBucket()`, `writeBucket()`
  - [ ] Private `findRecord(id)` scanning accessible buckets
  - [ ] Private `validate(entity)` calling Zod schema
  - [ ] Private `checkAuthorize(action, resource, capability?)` mapping AuthZOutcome to throw
  - [ ] Private `checkFaultInjection()` at start of each mutation
  - [ ] `list(q?)` — aggregate rows from accessible buckets, filter/sort/paginate (pageSize default 25, max 100)
  - [ ] `get(id)` — return null if not found or soft-deleted
  - [ ] `create(input)` — 4-beat: authorize → validate+write → emit Created → audit
  - [ ] `update(id, patch, version)` — rejects status in patch; 4-beat; 409 on version mismatch
  - [ ] `remove(id)` — soft delete; 4-beat; emit Deleted
  - [ ] `transition(id, to, version)` — canTransition check; 4-beat; emit StatusChanged (or Updated if no statusChanged config)
- [ ] **Task 5 — Update `src/shared/events/conformance.ts`** (test infrastructure)
  - [ ] Add `recordEmissionsAsync(op: () => Promise<unknown>): Promise<Emissions>`
  - [ ] Add `expectOneOpOneEventOneAuditAsync(op: () => Promise<unknown>): Promise<Emissions>`
- [ ] **Task 6 — Create `src/shared/data/repository.test.ts`** (AC: all, NFR-12)
  - [ ] All required Vitest tests (see Test Requirements below)
- [ ] **Task 7 — Conformance gates**
  - [ ] `npx tsc -b` clean
  - [ ] `npm run lint` clean
  - [ ] `npm run test:run` all green (all previous tests still pass)

## Test Requirements (NFR-12)

File: `src/shared/data/repository.test.ts` · Environment: `// @vitest-environment jsdom`

Required test cases:
- **Key scheme:** Create a record and verify localStorage key matches `crm:{tenantId}:{subsidiaryId|_parent}:{entity}`
- **Create audit fields:** `version=1`, `createdAt`/`updatedAt` set, `createdBy`/`updatedBy` = session userId
- **Stale-version update → 409:** `update(id, patch, wrongVersion)` throws `RepositoryError(409)`
- **Soft-delete hides rows:** After `remove(id)`, `list()` excludes it; `get(id)` returns null
- **Invalid input → 422:** `create` with bad data (e.g. empty name, invalid email) throws `RepositoryError(422)` with `ValidationDetail[]`
- **Unknown ListQuery filters ignored:** `list({ filter: { unknownField: 'x' } })` does not throw, returns a `Page<T>`
- **pageSize clamped to 100:** `list({ pageSize: 999 })` returns `pageSize=100` in the result
- **UC-2 conformance:** One `create` → exactly 1 `DomainEvent` + 1 `AuditEvent` sharing one `correlationId` (use `expectOneOpOneEventOneAuditAsync`)
- **Cross-tenant `get` → null:** A record from tenantB is not visible to a session from tenantA
- **Cross-tenant `update` → 404:** Trying to update a record from a different tenant throws `RepositoryError(404)`
- **Illegal transition → 422:** `transition(id, 'invalid_target', version)` throws `RepositoryError(422)`
- **Fault injection 409:** `setFaultMode('409')` before `create` → throws `RepositoryError(409)`
- **Fault injection 422:** `setFaultMode('422')` before `create` → throws `RepositoryError(422)`

## Dev Notes

### What this story IS (and is NOT)

The **concrete localStorage adapter** implementing `Repository<T>` (E0-S3 interface). Every mutation
runs the 4-beat use case (authorize → mutate → emit → audit) — this is the single most-copied shape
in the codebase, defined in architecture §Pattern 1. The adapter returns REST-shaped errors and
scopes all data access from injected `SessionClaims` (never from callers). This is NOT a UI story,
not a service wrapper, not a new entity type.

### Critical: canonical 4-beat shape (architecture §Pattern 1)

Every mutation method MUST follow this EXACT order:
```ts
// 1. Fault injection check (allows deterministic error testing)
this.checkFaultInjection();

// 2. Mint correlationId at the start of the action
const correlationId = newCorrelationId();
const now = new Date().toISOString();

// BEAT 1 — AUTHORIZE (permissions.authorize() handles Auth.RoleDenied internally)
this.checkAuthorize(action, resource);  // throws 403/404 if not granted

// BEAT 2 — MUTATE (validate + write to localStorage)
const validated = this.validate(draft);
this.writeBucket(key, rows);

// BEAT 3 — EMIT (one DomainEvent with canonical type)
publish({ ..., correlationId });

// BEAT 4 — AUDIT (one immutable AuditEvent)
append({ ..., correlationId });

return validated;
```

### Key scheme (AC1 + AC2)

```
crm:{tenantId}:{subsidiaryId|'_parent'}:{entityName}
Examples:
  crm:tnt_northwind:_parent:lead          ← parent-level leads (created by tenant_admin)
  crm:tnt_northwind:sub_eu:lead           ← EU subsidiary leads
```

- **Write key:** `crm:{session.tenantId}:{session.subsidiaryId ?? '_parent'}:{entityName}`
- **Accessible keys for tenant_admin (`subsidiaryId=null`):** scan ALL localStorage keys matching `crm:{tenantId}:*:{entityName}` using `localStorage.key(i)` iteration
- **Accessible keys for subsidiary user:** `[crm:{tenantId}:_parent:{name}, crm:{tenantId}:{subsidiaryId}:{name}]`

### RepositoryError (AC6 REST parity)

```ts
export class RepositoryError extends Error {
  constructor(
    public readonly statusCode: number,  // 200/201/204/403/404/409/422/503
    public readonly code: string,        // 'VERSION_CONFLICT', 'VALIDATION', 'NOT_FOUND', ...
    message: string,
    public readonly details?: ValidationDetail[],
    public readonly location?: string,   // for 201 Location header
  ) { super(message); this.name = 'RepositoryError'; }
}
```

### EntityConfig<T> constructor pattern

```ts
const leadRepo = new LocalStorageRepository<Lead>({
  name: 'lead',                         // lowercase — key segment
  entityType: 'Lead',                   // PascalCase — audit entityType
  idKind: 'lead',                       // passed to newId()
  schema: leadSchema,                   // from schemas.ts
  capability: 'lead.manage',            // from permissions.ts Capability
  deleteCapability: 'record.deleteExport',
  events: {
    created: 'Lead.Created',
    updated: 'Lead.Updated',
    deleted: 'Lead.Deleted',
    statusChanged: 'Lead.StatusChanged',
  },
  transitionEntity: 'lead',             // from status.ts TransitionEntity
}, session);
```

### Update rejects status changes (AC3 + AC6)

`update()` must check if `status` is in the patch and throw `RepositoryError(422)`:
```ts
if (Object.hasOwn(patch as object, 'status')) {
  throw new RepositoryError(422, 'PATCH_STATUS', 'Status transitions must use transition()', [
    { field: 'status', issue: 'Use transition() to change entity status' },
  ]);
}
```

### Zod validation is on the FULL entity (AC4)

- `create()`: build draft entity with all fields set → `this.validate(draft)`
- `update()`: merge old record + patch + bumped audit fields → `this.validate(merged)`
- `transition()`: apply new status + bumped audit fields → `this.validate(transitioned)`
- Zod errors: `error.issues.map(i => ({ field: i.path.join('.') || '_', issue: i.message }))`

### authorize() integration (AC5)

Call `authorize()` from `src/shared/auth/permissions.ts` (already handles `Auth.RoleDenied` internally):
```ts
import { authorize } from '../auth/permissions';

private checkAuthorize(action: Action, resource: OwnedResource, capability = this.config.capability): void {
  const outcome = authorize(this.session, capability, action, resource);
  if (outcome === 'notFound') throw new RepositoryError(404, 'NOT_FOUND', 'Record not found');
  if (outcome === 'denied')   throw new RepositoryError(403, 'FORBIDDEN', 'Access denied');
  // 'granted' → continue
}
```

For `create()`: resource is `{ tenantId: session.tenantId, subsidiaryId: session.subsidiaryId }`.
For `update()/remove()/transition()`: resource is the stored record (structurally compatible with `OwnedResource`).

### canTransition check in transition() (AC5 + UC-3)

```ts
import { canTransition } from '../domain/status';

const from = (record as { status?: string }).status ?? '';
if (!this.config.transitionEntity || !canTransition(this.config.transitionEntity, from, to)) {
  throw new RepositoryError(422, 'ILLEGAL_TRANSITION', `Cannot transition from '${from}' to '${to}'`, [
    { field: 'status', issue: `Transition '${from}' → '${to}' is not allowed` },
  ]);
}
```

### Compiler constraints (same as E0-S1/S2/S3)

`tsconfig.app.json` has `"verbatimModuleSyntax": true` and `"erasableSyntaxOnly": true`:
- Type-only imports MUST use `import type`
- No TS `enum` (use string literal unions)
- `import type { z } from 'zod'` for Zod type annotations; `import { z } from 'zod'` for runtime usage

### Test environment: jsdom required

`repository.test.ts` needs `localStorage`. Add `// @vitest-environment jsdom` as the first line.
This follows the `AuthProvider.test.tsx` pattern: it opts into jsdom while the global Vitest env
stays `node` (so all other data/events/domain tests are unaffected).

### Conformance helper async extension (Task 5)

`conformance.ts` is synchronous. Since `LocalStorageRepository` methods are `async` (though internally
synchronous), add async variants to conformance.ts:
```ts
export async function recordEmissionsAsync(operation: () => Promise<unknown>): Promise<Emissions> { ... }
export async function expectOneOpOneEventOneAuditAsync(operation: () => Promise<unknown>): Promise<Emissions> { ... }
```

### Previous story intelligence (E0-S3 — review status)

E0-S3 shipped `src/shared/data/Repository.ts` (the type-only interface) + `Repository.test.ts`. Key carry-overs:
- `Repository<T>`, `Page<T>`, `ListQuery` are at `src/shared/data/Repository.ts` — import from there
- `import type { Repository, Page, ListQuery }` (type-only, verbatimModuleSyntax)
- `Page.data: T[]` (not `items`) — Reconciliation 1 confirmed
- `ListQuery.filter` is an open `Record<string, string|number|boolean>` — unknown filters ignored at runtime
- Test env for data tests: **node** (default); this story needs **jsdom** for localStorage

### Git intelligence

- Branch: `story/E0-S4-local-storage-repository` (newly created)
- Baseline: `3daea0d feat(E0-S6): route guard + action guard from the ADR-015 permission matrix (#78)`
- E0-S5/S6/S7 are done: `AuthProvider.tsx`, `permissions.ts`, `authorize()`, `bus.ts`, `auditLog.ts`,
  `correlation.ts`, `conformance.ts` are all available to import

### Architecture compliance checklist

- **NFR-1 one-way dependency:** `src/shared/data/` imports only `shared/domain/` + `shared/auth/` + `shared/events/` — never `src/features/*`
- **ADR-004:** Feature code never touches localStorage; all persistence goes through `Repository<T>` (enforced by E0-S11 fitness test)
- **ADR-007:** Fault injection toggle in `faultInjection.ts` checked at mutation start
- **ADR-008:** Every mutation emits exactly ONE `DomainEvent` + ONE `AuditEvent` on ONE `correlationId`
- **ADR-009:** `authorize()` from `permissions.ts` is the single auth gate; out-of-tenant → 404; in-tenant denial → 403

### Definition of Done (applicable gates)

- All 7 ACs met
- `src/shared/data/repository.test.ts` (jsdom) covers all required test cases
- `npx tsc -b` clean (0 errors)
- `npm run lint` (`eslint .`) clean
- `npm run test:run` all green (previous 91+ tests still pass; new tests added)
- PR body `Closes #<issue>`

### References

- [src/shared/data/Repository.ts] — the interface this class implements
- [src/shared/domain/types.ts] — `ID`, `BaseEntity`, `newId`, `IdKind`
- [src/shared/domain/status.ts] — `canTransition`, `TransitionEntity`
- [src/shared/auth/permissions.ts] — `authorize`, `Capability`, `Action`, `OwnedResource`
- [src/shared/auth/auth.types.ts] — `SessionClaims`
- [src/shared/events/bus.ts] — `publish`, `DomainEvent`
- [src/shared/events/auditLog.ts] — `append`, `AuditEvent`
- [src/shared/events/correlation.ts] — `newCorrelationId`
- [src/shared/events/conformance.ts] — `expectOneOpOneEventOneAuditAsync` (to add)
- [src/shared/events/eventTypes.ts] — `EventType`
- [_bmad-output/project-context.md §4] — 4-beat, key scheme, CRUD rules
- [_bmad-output/planning-artifacts/architecture.md §Pattern 1] — canonical 4-beat pseudocode
- [_bmad-output/planning-artifacts/architecture.md ADR-004/007/008/009]

## Change Log

| Date       | Change |
|------------|--------|
| 2026-06-08 | Story created (bmad-create-story). Status → ready-for-dev. |
