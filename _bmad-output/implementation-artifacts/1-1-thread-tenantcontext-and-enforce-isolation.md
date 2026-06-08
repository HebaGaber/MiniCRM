---
id: E1-S1
title: Thread TenantContext and enforce isolation
epic: "E1 — Tenancy & Subsidiary"
feature: "1.1 — Tenant Context & Isolation"
cut: pilot
status: ready-for-dev
depends_on: [E0-S4, E0-S5, E0-S6]
inherits_uc: [UC-1, UC-5, TC]
adrs: [ADR-002, ADR-004, ADR-009, ADR-015]
constitution_refs: ["§1", "§5.2", "§6"]
---

# E1-S1 — Thread TenantContext and enforce isolation

> **GitHub Epic → Feature → Story:** Epic **E1 — Tenancy & Subsidiary** › Feature **1.1 — Tenant Context & Isolation** › Story **E1-S1**
> **Cut:** Pilot · **Depends on:** E0-S4 (repository/4-beat), E0-S5 (auth claims), E0-S6 (permissions) · *test-time:* E0-S11 (cross-tenant isolation E2E scaffold)

## Story

As any user, I only ever see data in my tenant/subsidiary scope, so that one tenant's records can never leak into another's view or mutation.

---

## Story-Specific Acceptance Criteria

1. **AC1 — TenantContext from claims, consumed by repository (UC-5).**
   `TenantContext` derives `{ tenantId, subsidiaryId, scopeName, scopeLoading }` from `session` in the `AuthContext`. It is mounted via a `TenantProvider` added inside `<AuthProvider>` in `src/app/providers.tsx`. `src/app/composition.ts` exports a `useRepository<T>(config)` hook that calls `useAuth()` to get the session and constructs a `LocalStorageRepository` bound to those claims — scope is NEVER passed as a call-site argument.
   - Storage key composed by `LocalStorageRepository`: `crm:{tenantId}:{subsidiaryId|_parent}:{entity}` (already implemented in E0-S4).
   - *New files:* `src/shared/auth/tenant.types.ts`, `src/shared/auth/tenantContext.ts`, `src/shared/auth/useTenant.ts`, `src/app/TenantProvider.tsx` · *Modified files:* `src/app/providers.tsx`, `src/app/composition.ts` (create)

2. **AC2 — No caller passes scope.**
   `Repository<T>` public signatures (`list/get/create/update/remove`) carry no `tenantId`/`subsidiaryId` parameter (already satisfied by E0-S4). An architecture-fitness Vitest assertion in `src/shared/data/LocalStorageRepository.test.ts` (or a new `src/shared/auth/tenant-fitness.test.ts`) asserts that no feature file references `tenantId` or `subsidiaryId` on its own or passes them as arguments.
   - *Modified files:* `e2e/architecture-fitness.spec.ts` (add scope-param fitness test)

3. **AC3 — Out-of-tenant access by ID → 404.**
   `get(id)` returns `null` for a record whose `tenantId` ≠ session `tenantId` (existence never disclosed). `update` / `remove` / `transition` on such a record throws `RepositoryError(404, "NOT_FOUND", …)`. These behaviors are already implemented in `LocalStorageRepository`; this AC is satisfied by ensuring the cross-tenant E2E tests pass (they already test this).
   - *Files:* `e2e/cross-tenant-isolation.spec.ts` (already exists)

4. **AC4 — Scope-resolution rule.**
   `tenant_admin` (session `subsidiaryId=null`) sees ALL tenant rows (all subsidiaries + parent-level). Subsidiary user (session `subsidiaryId="sub_X"`) sees ONLY rows where `record.subsidiaryId === "sub_X"` OR `record.subsidiaryId === null`. Cross-subsidiary rows are invisible. Already implemented in `LocalStorageRepository.accessibleKeys()`; cover with Vitest unit tests.
   - *Files:* `src/shared/data/LocalStorageRepository.test.ts` (add subsidiary isolation describe block)

---

## UX & Behavior

- **Scope re-query skeleton (AC1 UX):** When the auth session changes (user signs in/switches role), `TenantProvider` sets `scopeLoading: true` for `200 + 220 = 420ms` (`--crm-base` = 200ms + 220ms per prototype-behavior.md §Timings). Every screen that uses `useTenant().scopeLoading` can show a skeleton during this window.
- **NotFoundView (AC3 UX):** `src/shared/ui/NotFoundView.tsx` — calm centered 404: `compass` glyph, eyebrow **"404 · not found"**, heading **"Not found in this workspace"**, body copy (record isn't part of `<scopeName>`, may belong to another subsidiary/tenant), single primary action **"Back to \<scopeName\>"** (`onClick` prop). Copy is explicitly NOT a permission warning. Never discloses that the record exists elsewhere.
- **Motion:** skeleton→data cross-fade at `--crm-base`/`decelerate`; reduced-motion keeps timing + opacity, drops travel.

---

## Architecture — components, seams & modules touched

### New files

| File | Purpose |
|---|---|
| `src/shared/auth/tenant.types.ts` | `TenantContextValue` type |
| `src/shared/auth/tenantContext.ts` | React context object (mirrors `authContext.ts` pattern) |
| `src/shared/auth/useTenant.ts` | `useTenant()` hook (mirrors `useAuth.ts` pattern) |
| `src/app/TenantProvider.tsx` | Provider that reads `useAuth()`, derives scope, exposes TenantContext; owns `scopeLoading` timer |
| `src/app/composition.ts` | DI root: `useRepository<T>(config)` hook — reads session from `useAuth()`, constructs `LocalStorageRepository<T>` |
| `src/shared/ui/NotFoundView.tsx` | 404 view component |
| `src/shared/auth/tenant.test.ts` | Vitest tests: TenantProvider scope derivation, scopeLoading timer, subsidiary isolation |

### Modified files

| File | Change |
|---|---|
| `src/app/providers.tsx` | Add `<TenantProvider>` inside `<AuthProvider>` |
| `e2e/architecture-fitness.spec.ts` | Add scope-param fitness test: no `src/features/**` reads `\.tenantId` or `\.subsidiaryId` directly |
| `e2e/cross-tenant-isolation.spec.ts` | Add subsidiary isolation tests (sub_eu cannot see sub_us rows) |
| `src/shared/data/LocalStorageRepository.test.ts` | Add subsidiary isolation describe block (already has cross-tenant; add cross-subsidiary) |

### Seams used

- `Repository<T>` (ADR-004) — scope inside, never from callers
- `SessionClaims` from `AuthContext` (ADR-009)
- `isInScope()` from `permissions.ts` (ADR-015) — 404-not-403 logic (already in `LocalStorageRepository.findRecord`)
- `QueryStateBoundary` (UC-1) — for RTL test of loading/empty states

---

## Test Requirements (NFR-12)

### Vitest (unit) — `src/shared/auth/tenant.test.ts`

```
describe('TenantProvider scope derivation')
  it('derives scopeName "Northwind Trading" for tenant_admin (subsidiaryId=null)')
  it('derives scopeName "EU / Frankfurt" for sub_eu session')
  it('derives scopeName "US / Chicago" for sub_us session')
  it('sets scopeLoading=true on session change then false after 420ms')

describe('LocalStorageRepository — subsidiary isolation')
  it('tenant_admin sees rows from all subsidiaries')
  it('subsidiary user sees own-subsidiary + parent-level rows')
  it('subsidiary user does NOT see sibling subsidiary rows')
  it('storage key for subsidiary user write is crm:{tenantId}:{subsidiaryId}:{entity}')
  it('storage key for tenant_admin write is crm:{tenantId}:_parent:{entity}')
```

### Vitest (architecture-fitness) — `src/shared/auth/tenant.test.ts` or separate

```
it('Repository<T> list/get/create/update/remove signatures have no tenantId/subsidiaryId param')
```

### RTL (component) — `src/shared/ui/NotFoundView.test.tsx`

```
it('renders eyebrow "404 · not found"')
it('renders heading "Not found in this workspace"')
it('renders back button with scopeName label')
it('calls onBack when back button clicked')
```

### Playwright (E2E)

- `e2e/cross-tenant-isolation.spec.ts` — Add subsidiary tests:
  - `sub_eu user cannot see sub_us records`
  - `sub_eu user can see parent-level (subsidiaryId=null) records`
  - `tenant_admin sees both sub_eu and sub_us records`
- `e2e/architecture-fitness.spec.ts` — Add:
  - `no src/features/** file reads .tenantId or .subsidiaryId directly`
  - `no src/features/** file passes tenantId/subsidiaryId as arguments`

---

## Dev Notes

### Compiler constraints (non-negotiable)

- `verbatimModuleSyntax: true` → use `import type` for type-only imports
- `erasableSyntaxOnly: true` → no TypeScript `enum`, no decorators
- No bare `React` global — use named imports (`import React from 'react'` OK or named)
- `.tsx` for JSX files, `.ts` for pure logic
- No barrel `index.ts` — direct-file imports only

### TenantContext design

`TenantContextValue` (in `src/shared/auth/tenant.types.ts`):

```typescript
export interface TenantContextValue {
  tenantId: ID;
  subsidiaryId: ID | null;
  scopeName: string;
  scopeLoading: boolean;
}
```

`tenantContext.ts` follows the same pattern as `authContext.ts` — `createContext<TenantContextValue | undefined>(undefined)` sentinel.

`useTenant()` in `useTenant.ts` follows `useAuth()` pattern — throws if called outside `<TenantProvider>`.

`TenantProvider.tsx` in `src/app/`:
- Calls `useAuth()` (must be inside `<AuthProvider>`)
- Derives `scopeName` from a local map: `{ null: "Northwind Trading", "sub_eu": "EU / Frankfurt", "sub_us": "US / Chicago" }`  
  (This map will be expanded by E1-S2/S3 when subsidiaries are dynamic; for E1-S1 use the same mock data as `AuthProvider.tsx`)
- Owns the `scopeLoading` timer: `useEffect` watching `session` — when session changes, set `scopeLoading=true`, clear after 420ms (`setTimeout`)
- `session === null` → renders `children` as-is (no scope available yet — the auth layer handles unauthenticated UI)

### composition.ts design

`src/app/composition.ts`:

```typescript
import { useMemo } from 'react';
import { useAuth } from '../shared/auth/useAuth';
import { LocalStorageRepository } from '../shared/data/LocalStorageRepository';
import type { EntityConfig } from '../shared/data/LocalStorageRepository';
import type { BaseEntity } from '../shared/domain/types';
import type { Repository } from '../shared/data/Repository';

export function useRepository<T extends BaseEntity>(config: EntityConfig<T>): Repository<T> | null {
  const { session } = useAuth();
  return useMemo(
    () => (session ? new LocalStorageRepository<T>(config, session) : null),
    // config is expected to be a stable reference (module-level constant)
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [session, config.name],
  );
}
```

Returns `null` when unauthenticated (feature screens are behind route guards, so this is defensive). Feature hooks will call `useRepository(leadConfig)` etc.

### NotFoundView design

`src/shared/ui/NotFoundView.tsx`:
- Props: `{ scopeName: string; onBack: () => void }`
- Renders: compass icon (`<Icon name="compass" />`), eyebrow `"404 · not found"`, heading `"Not found in this workspace"`, body `"This record isn't part of ${scopeName}. It may belong to another subsidiary or workspace."`, `<Button>` `"Back to ${scopeName}"`
- Uses only tokens (no hardcoded hex/px/font)
- Centered layout using shared ui patterns

### LocalStorageRepository.accessibleKeys() — already correct

The existing implementation is already correct for AC4:
- `subsidiaryId === null` (tenant_admin): scans all `crm:{tenantId}:*:{entity}` keys
- subsidiary user: returns `["crm:{tenantId}:_parent:{entity}", "crm:{tenantId}:{subsidiaryId}:{entity}"]`

No changes needed to `LocalStorageRepository.ts` for the business logic. Only new tests.

### Architecture-fitness assertion for scope params

Add to `e2e/architecture-fitness.spec.ts`:

```typescript
test('no src/features/** file reads .tenantId or .subsidiaryId directly', () => {
  // Feature code must get scope only via useTenant() or the repository seam — 
  // never by reading session.tenantId or session.subsidiaryId in product code
  const files = collectTsFiles(path.resolve('src/features'));
  const violations: string[] = [];
  for (const file of files) {
    const content = fs.readFileSync(file, 'utf8');
    if (/\b(tenantId|subsidiaryId)\b/.test(content)) {
      violations.push(path.relative(process.cwd(), file));
    }
  }
  expect(violations, '…').toHaveLength(0);
});
```

Note: `src/features/` doesn't exist yet (Epics 2–5 fill it). This test will pass trivially today (empty/missing dir) and become a live gate when feature code arrives.

### Existing tests that cover this story's behaviors

The following are ALREADY tested in `LocalStorageRepository.test.ts` (E0-S4):
- Cross-tenant list returns 0 rows (AC3/AC6)
- Cross-tenant get returns null (AC3/AC6)  
- Cross-tenant update/remove throws 404 (AC3)
- Storage key scheme (AC1)

The `e2e/cross-tenant-isolation.spec.ts` (E0-S11) already has 6 tests covering tenant-to-tenant isolation. **This story adds subsidiary-level isolation tests** that are not yet covered.

### Previous story learnings

From E0-S4 and E0-S5:
- `SessionClaims` has `subsidiaryId: ID | null` — `null` is the tenant_admin roll-up signal (not "no subsidiary" ambiguously)
- The `AuthProvider` uses `Object.hasOwn` guard on identity maps — copy this pattern for the `scopeName` map
- The dual-event pattern (audit BEFORE publish) must be maintained — but TenantProvider doesn't emit events (it only reads auth context)
- Use `useCallback` + `useMemo` to stabilize callbacks passed to `useEffect`
- `useRef` for mutable values that shouldn't trigger re-renders (the auth provider uses it for `sessionRef` to avoid stale closure in signOut)

---

## Universal Conformance ACs (inherited)

- **UC-1 — Four UI states.** RTL test: `QueryStateBoundary`-wrapped scoped list shows `loading` state when `scopeLoading=true`, `empty` state when scope has no data.
- **UC-5 — Tenant isolation / 404.** This story IS the canonical UC-5 implementation. Out-of-tenant → null/404. Scope from auth context only.

---

## Inherited TC — Traceability

- Story → spec → code → test → GitHub issue (`Closes #<issue>`)
- `sprint-status.yaml` updated to `done` by dev agent on completion
- Preview deploy green before merge
- Passes `bmad-code-review`

---

## Definition of Done Checklist

### Functional

- [ ] AC1: `TenantContext` + `TenantProvider` + `useTenant()` created; `providers.tsx` mounts it; `composition.ts` exports `useRepository<T>()`
- [ ] AC2: `Repository<T>` signatures unchanged (no scope params); architecture-fitness test added to `e2e/architecture-fitness.spec.ts`
- [ ] AC3: Cross-tenant get/update/remove 404 behavior covered by passing E2E tests
- [ ] AC4: Subsidiary isolation unit tests added and passing

### UI

- [ ] `NotFoundView.tsx` created with correct copy, compass glyph, back button
- [ ] `scopeLoading` timer implemented (420ms)
- [ ] Tokens only — no hardcoded hex/px/font

### Quality gates

- [ ] `npx tsc -b` clean
- [ ] `npm run lint` clean
- [ ] `npm run test:run` green (all Vitest tests)
- [ ] `npx playwright test` green (cross-tenant + architecture-fitness E2E)
- [ ] Passes `bmad-code-review`

### Traceability (TC)

- [ ] Story → spec → code → test → GitHub issue (`Closes #<issue>`)
- [ ] `sprint-status.yaml` updated to `done`
- [ ] PR body `Closes #<issue>`

---

## References

- Constitution: `_bmad-output/project-context.md` §1, §5.2, §6
- Architecture + ADRs: `_bmad-output/planning-artifacts/architecture.md` ADR-002, ADR-004, ADR-009, ADR-015
- Epic spec: `_bmad-output/planning-artifacts/epics/epic-1-tenancy-subsidiary/E1-S1.md`
- Prototype behavior: `prototype/prototype-behavior.md` §Timings (`--crm-base` = 200ms)
- Testing stack: ADR-013 (Vitest + RTL + Playwright)
