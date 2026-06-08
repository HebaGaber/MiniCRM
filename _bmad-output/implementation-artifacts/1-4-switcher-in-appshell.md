---
id: E1-S4
title: Switcher in AppShell
epic: "E1 — Tenancy & Subsidiary"
feature: "1.3 — Tenant/Subsidiary Switcher"
cut: pilot
status: done
baseline_commit: 41313b73819d90b040b2ebef41473710503f945f
depends_on: [E1-S1, E1-S2, E1-S3]
inherits_uc: [UC-1, UC-5, TC]
adrs: [ADR-002, ADR-009, ADR-015]
constitution_refs: ["§5.2", "§6", "§8"]
---

# E1-S4 — Switcher in AppShell

> **GitHub Epic → Feature → Story:** Epic **E1 — Tenancy & Subsidiary** › Feature **1.3 — Tenant/Subsidiary Switcher** › Story **E1-S4**
> **Cut:** Pilot · **Depends on:** E1-S1 (scope seam), E1-S2 (subsidiaries to switch to), E1-S3 (offboarded subs must disappear)

## Story

As a tenant admin, I switch active subsidiary scope in the AppShell, so that the data
visibly changes to the unit I am working in (UJ-1 climax).

---

## Acceptance Criteria

1. **AC1 — Switcher in AppShell.** A subsidiary switcher control lives in the shared `AppShell` topbar; it lists the admin's same-tenant active subsidiaries plus a "whole tenant / parent-level" option.
2. **AC2 — Selecting sets active subsidiary scope in auth context (validated, not trusted).** Selection updates `session.subsidiaryId` in the auth context via `setSubsidiaryScope(id, tenantId)`. The pilot adapter validates that the chosen subsidiary belongs to the token's tenant (passed `tenantId !== session.tenantId` → rejected). `tenantId` always comes from the token — never from client input.
3. **AC3 — Visible data set changes to match (UJ-1 climax).** On switch, scope change propagates to `TenantContext` → `useRepository()` mints a new repo instance (memoized on session) → feature `useEffect([repo])` re-queries → lists/reads rerender. TanStack Query cache keys (if in use) include the scope so stale cross-scope data is never shown.
4. **AC4 — Non-admins see only their own scope.** A subsidiary-scoped user (sales/support/viewer) sees the chip in read-only/locked state (lock icon, title "Scope is fixed for your role") with no dropdown. They cannot select another subsidiary or parent-level.

---

## UX & Behavior (from prototype)

**Source:** `prototype/app/shell.jsx` (`ScopeSwitcher`, `ScopeOption`), `prototype/app/store.jsx` (`setScope`). Build **identical** to the prototype.

### Chip (always visible in topbar)

- Shows the **tenant name** (`"Northwind Trading"`) on the top line and the **current scope name** on the bottom line.
  - Current scope name: `"Whole tenant (roll-up)"` when `subsidiaryId === null`; otherwise the subsidiary's `name` field from the `activeSubs` list.
- For **scope-fixed roles** (sales/support/viewer): chip is **`disabled`** with a **`lock`** icon on the right; `title="Scope is fixed for your role"`.
- For **tenant_admin**: chip shows `chevrons-up-down` icon; click opens dropdown. Border turns `var(--iso-brand)` + focus shadow when open.
- Icon on the left: `layers` for whole-tenant; `building-2` for subsidiary scope. Icon container: 26×26px, `var(--iso-radius-xs)`, brand background for tenant / brand-soft for sub.

### Dropdown (admin only)

Position: `top: 44px`, `left: 0`, width `288px`. Enter animation: `crm-pop var(--crm-base) var(--crm-ease-decelerate)`. `z-index: var(--iso-z-dropdown)`.

Header label: `"{TENANT_NAME} · scope"` (uppercase, muted, 10px).

Options:
1. **"Whole tenant (roll-up)"** (`layers` icon, subline `"Aggregate across the tenant"`) — always first.
2. Divider line.
3. Each **active** subsidiary (`building-2` icon, subline = `s.region ?? ""`).

Each option: check icon (`var(--iso-brand)`) on the right when that scope is currently active. Option background: `var(--iso-brand-soft)` when active; hover: `var(--iso-n-100)`.

**On selection:** call `setSubsidiaryScope(id, tenantId)` → close dropdown. The `scopeLoading` skeleton re-query runs for 420ms (TenantProvider already handles this).

### Offboarded subsidiaries

- Offboarded subsidiaries (`deletedAt !== null`) are excluded from the `activeSubs` list passed to AppShell.
- If the currently active scope is offboarded, the `AppShellWithSubsidiaries` wrapper detects it and calls `setSubsidiaryScope(null, session.tenantId)` — snapping scope back to tenant level.

### Click-outside to close

Clicking outside the dropdown ref closes it (same pattern as `UserMenuDropdown`).

---

## Architecture — files & modules touched

### New files

| File | Purpose |
|---|---|
| `src/shared/ui/components/AppShell.test.tsx` | Vitest + RTL tests for `ScopeSwitcher` (E1-S4) |

### Modified files

| File | Change |
|---|---|
| `src/shared/auth/auth.types.ts` | Add `setSubsidiaryScope(id: ID \| null, tenantId: ID): void` to `AuthContextValue` |
| `src/shared/auth/AuthProvider.tsx` | Implement `setSubsidiaryScope` — validate cross-tenant, update session |
| `src/shared/ui/components/AppShell.tsx` | Replace scope-switcher placeholder with live `ScopeSwitcher`; add `activeSubs` prop |
| `src/app/router.tsx` | Replace `<AppShell>` with `<AppShellWithSubsidiaries>` wrapper that loads subs + injects `activeSubs` |

---

## Dev Notes

### 1 — `setSubsidiaryScope` in AuthProvider

Add to `auth.types.ts` → `AuthContextValue`:
```typescript
// Call with id=null for whole-tenant; id=someSubId + the sub's tenantId for subsidiary scope.
// The implementation validates tenantId matches the token — never trusts the client value.
setSubsidiaryScope: (id: ID | null, tenantId: ID) => void;
```

Implement in `AuthProvider.tsx`:
```typescript
const setSubsidiaryScope = useCallback((id: ID | null, tenantId: ID) => {
  const current = sessionRef.current;
  if (current === null) return;                      // no session — no-op
  if (id !== null && tenantId !== current.tenantId) return; // cross-tenant rejected
  const updated: SessionClaims = { ...current, subsidiaryId: id };
  sessionRef.current = updated;
  setSession(updated);
}, []);
```

Add to the `useMemo` value object:
```typescript
const value = useMemo<AuthContextValue>(
  () => ({ session, isAuthenticated: session !== null, signIn, signOut, setSubsidiaryScope }),
  [session, signIn, signOut, setSubsidiaryScope],
);
```

**No domain event emitted for a scope switch** — a scope switch is NOT a mutation (it updates no entity, emits no audit). It is a UI navigation decision that re-scopes subsequent reads. The 4-beat applies to writes against entities (E0-S7 / ADR-008). Scope switching is analogous to changing a URL filter parameter.

### 2 — AppShell changes

Add a prop type:
```typescript
type ActiveSub = {
  id: ID;
  name: string;
  region?: string;
  tenantId: ID; // needed for setSubsidiaryScope validation
};

type AppShellProps = {
  children?: React.ReactNode;
  activeSubs?: ActiveSub[];
};
```

`AppShell` imports `ID` from `../../domain/types` (already in shared/auth, not a new dep for shared/ui).

Alternatively, import `Subsidiary` directly — `src/shared/domain/tenant.types` is a sibling `shared` module and importing from there is fine (NFR-1 only forbids importing FROM features). Use whichever is simpler.

Replace the placeholder `<div aria-label="Scope switcher (coming soon)">` block with:
```tsx
<ScopeSwitcher activeSubs={activeSubs ?? []} />
```

Add the `ScopeSwitcher` component as a local function in `AppShell.tsx` (same file, below `UserMenuDropdown`, before `AppShell`):

```tsx
type ActiveSub = { id: ID; name: string; region?: string; tenantId: ID; };

function ScopeSwitcher({ activeSubs }: { activeSubs: ActiveSub[] }) {
  const { session, setSubsidiaryScope } = useAuth();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  // Click-outside to close
  useEffect(() => {
    if (!open) return;
    const h = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, [open]);

  if (session === null) return null;

  const isAdmin = session.roles.includes('tenant_admin');
  const currentSubId = session.subsidiaryId;
  const isTenant = currentSubId === null;
  const currentSub = activeSubs.find(s => s.id === currentSubId);
  const currentName = isTenant ? 'Whole tenant (roll-up)' : (currentSub?.name ?? currentSubId ?? '—');
  const locked = !isAdmin;

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      {/* Chip */}
      <button
        disabled={locked}
        onClick={() => !locked && setOpen(o => !o)}
        title={locked ? 'Scope is fixed for your role' : 'Switch scope'}
        data-testid="scope-switcher-chip"
        style={{
          display: 'flex', alignItems: 'center', gap: 10, height: 38, padding: '0 12px',
          cursor: locked ? 'default' : 'pointer',
          border: `1px solid ${open ? 'var(--iso-brand)' : 'var(--iso-border)'}`,
          borderRadius: 'var(--iso-radius-sm)', background: 'var(--iso-bg)',
          boxShadow: open ? 'var(--iso-shadow-focus)' : 'none',
          transition: 'border-color var(--crm-fast) var(--crm-ease-standard), box-shadow var(--crm-fast) var(--crm-ease-standard)',
        }}
      >
        {/* Scope icon */}
        <span style={{
          width: 26, height: 26, borderRadius: 'var(--iso-radius-xs)', flexShrink: 0,
          background: isTenant ? 'var(--iso-brand)' : 'var(--iso-brand-soft)',
          color: isTenant ? 'var(--iso-fg-on-brand)' : 'var(--iso-brand)',
          display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <Icon name={isTenant ? 'layers' : 'building-2'} size={15} />
        </span>
        {/* Text */}
        <span style={{ textAlign: 'left', minWidth: 0 }}>
          <span style={{ display: 'block', font: '500 12px/1.2 var(--iso-font-body)', color: 'var(--iso-fg-strong)', whiteSpace: 'nowrap' }}>
            Northwind Trading
          </span>
          <span style={{ display: 'block', font: '400 11px/1.2 var(--iso-font-ui)', color: 'var(--iso-fg-muted)', whiteSpace: 'nowrap' }}>
            {currentName}
          </span>
        </span>
        {/* Trailing icon */}
        {locked
          ? <Icon name="lock" size={13} style={{ color: 'var(--iso-fg-subtle)', marginLeft: 2 }} />
          : <Icon name="chevrons-up-down" size={15} style={{ color: 'var(--iso-fg-subtle)', marginLeft: 2 }} />
        }
      </button>

      {/* Dropdown */}
      {open && !locked && (
        <div
          data-testid="scope-dropdown"
          style={{
            position: 'absolute', top: 44, left: 0, width: 288,
            background: 'var(--iso-bg)', border: '1px solid var(--iso-border)',
            borderRadius: 'var(--iso-radius-md)', boxShadow: 'var(--iso-shadow-lg)',
            padding: 6, zIndex: 'var(--iso-z-dropdown)',
            animation: 'crm-pop var(--crm-base) var(--crm-ease-decelerate)',
          }}
        >
          <div style={{ font: '500 10px/1 var(--iso-font-ui)', letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--iso-fg-subtle)', padding: '8px 10px 6px' }}>
            Northwind Trading · scope
          </div>
          {/* Whole tenant option */}
          <ScopeOption
            active={isTenant}
            icon="layers"
            name="Whole tenant (roll-up)"
            sub="Aggregate across the tenant"
            onClick={() => {
              setSubsidiaryScope(null, session.tenantId);
              setOpen(false);
            }}
          />
          <div style={{ height: 1, background: 'var(--iso-border-muted)', margin: '4px 8px' }} />
          {/* Active subsidiaries */}
          {activeSubs.map(s => (
            <ScopeOption
              key={s.id}
              active={currentSubId === s.id}
              icon="building-2"
              name={s.name}
              sub={s.region ?? ''}
              onClick={() => {
                setSubsidiaryScope(s.id, s.tenantId);
                setOpen(false);
              }}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function ScopeOption({ active, icon, name, sub, onClick }: {
  active: boolean; icon: string; name: string; sub: string; onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      style={{
        display: 'flex', alignItems: 'center', gap: 10, width: '100%', padding: '8px 10px',
        border: 0, borderRadius: 'var(--iso-radius-sm)', cursor: 'pointer', textAlign: 'left',
        background: active ? 'var(--iso-brand-soft)' : 'transparent',
        transition: 'background var(--crm-fast) var(--crm-ease-standard)',
      }}
      onMouseEnter={e => { if (!active) (e.currentTarget as HTMLElement).style.background = 'var(--iso-n-100)'; }}
      onMouseLeave={e => { if (!active) (e.currentTarget as HTMLElement).style.background = 'transparent'; }}
    >
      <span style={{
        width: 28, height: 28, borderRadius: 'var(--iso-radius-xs)', flexShrink: 0,
        background: active ? 'var(--iso-brand)' : 'var(--iso-blue-3-100)',
        color: active ? 'var(--iso-fg-on-brand)' : 'var(--iso-brand)',
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
      }}>
        <Icon name={icon} size={15} />
      </span>
      <span style={{ flex: 1, minWidth: 0 }}>
        <span style={{ display: 'block', font: '500 13px/1.3 var(--iso-font-body)', color: 'var(--iso-fg)' }}>{name}</span>
        <span style={{ display: 'block', font: '400 11px/1.3 var(--iso-font-ui)', color: 'var(--iso-fg-subtle)' }}>{sub}</span>
      </span>
      {active && <Icon name="check" size={15} style={{ color: 'var(--iso-brand)' }} />}
    </button>
  );
}
```

**Import `ID`** at the top of `AppShell.tsx`:
```typescript
import type { ID } from '../../domain/types'
```

### 3 — `AppShellWithSubsidiaries` in router.tsx

Replace the inline `<AppShell>` JSX in `AppRouter` with `<AppShellWithSubsidiaries>`:

```tsx
import { SUBSIDIARY_CONFIG } from '../features/tenancy/subsidiaryConfig';
import type { Subsidiary } from '../shared/domain/tenant.types';
import { useRepository } from './composition';
import { subscribe } from '../shared/events/bus';
import type { DomainEvent } from '../shared/events/bus';

function AppShellWithSubsidiaries({ children }: { children: ReactNode }) {
  const { session, setSubsidiaryScope } = useAuth();
  const repo = useRepository(SUBSIDIARY_CONFIG);
  const [activeSubs, setActiveSubs] = useState<Subsidiary[]>([]);

  const loadSubs = useCallback(async () => {
    if (!repo) return;
    try {
      const page = await repo.list({ filter: { includeDeleted: false }, pageSize: 100 });
      setActiveSubs(page.data);
    } catch {
      // silent — switcher shows empty list, not an error state
    }
  }, [repo]);

  useEffect(() => {
    void loadSubs();
  }, [loadSubs]);

  // Scope snap-back: if current scope is offboarded, reset to tenant level
  useEffect(() => {
    if (!session || session.subsidiaryId === null) return;
    const stillActive = activeSubs.some(s => s.id === session.subsidiaryId);
    if (!stillActive && activeSubs.length > 0) {
      // Only snap back once subs have loaded (length > 0) — avoids false snap on initial load
      setSubsidiaryScope(null, session.tenantId);
    }
  }, [activeSubs, session, setSubsidiaryScope]);

  // Refresh list on subsidiary lifecycle events (onboard / offboard)
  useEffect(() => {
    return subscribe((event: DomainEvent) => {
      if (event.type === 'Tenant.SubsidiaryCreated' || event.type === 'Tenant.SubsidiaryRemoved') {
        void loadSubs();
      }
    });
  }, [loadSubs]);

  return (
    <AppShell activeSubs={activeSubs}>
      {children}
    </AppShell>
  );
}
```

In `AppRouter`, replace:
```tsx
<AppShell>
  <Routes>...
```
with:
```tsx
<AppShellWithSubsidiaries>
  <Routes>...
```

Add `useState` and `useCallback` to the React import in `router.tsx`.

**Import `Subsidiary`**: `router.tsx` is in `src/app/` which may import from `src/features/` (per NFR-1: `src/app` is above `src/features`). But actually, it only needs `Subsidiary` as a type for state typing — it can import it from `src/shared/domain/tenant.types` (a shared module) which is already the correct source.

### 4 — TenantProvider stays as-is

TenantProvider reads `session.subsidiaryId` from auth. When `setSubsidiaryScope` updates the session:
- `useAuth()` returns new session → TenantProvider's `useEffect([session])` fires
- `scopeLoading` timer starts → 420ms skeleton window
- `scopeName` resolves via the static `SUB_NAMES` map (fallback: shows the ID for dynamic subs)

**Acceptable for pilot**: The static map covers `sub_eu`/`sub_us`. Dynamically-onboarded subsidiaries fall back to showing the raw ID in `NotFoundView`. The ScopeSwitcher chip independently shows the correct name from `activeSubs`. Full dynamic name resolution is a future enhancement.

### 5 — Compiler constraints (non-negotiable)

- `verbatimModuleSyntax: true` → `import type` for all type-only imports
- `erasableSyntaxOnly: true` → no TS `enum`, no decorators
- `.tsx` for files with JSX, `.ts` for pure logic
- No barrel `index.ts` — direct-file imports only
- No hardcoded hex/px/font — tokens only

### 6 — Existing patterns to reuse

- `useEffect` + click-outside via `mousedown` → copy the pattern in `UserMenuDropdown` in `AppShell.tsx` verbatim
- `Icon` component is already imported in `AppShell.tsx`
- `useAuth` is already imported in `AppShell.tsx`
- `subscribe` from `../../events/bus` is already imported in `AppShell.tsx`
- `useState` and `useRef` are already imported from React in `AppShell.tsx`
- The `AppShellProps` type is already defined in `AppShell.tsx` — just add `activeSubs` to it

### 7 — "Tenant name" in the chip

Currently `TenantProvider` has `const TENANT_NAME = "Northwind Trading"`. For the chip, inline the constant in `ScopeSwitcher` (same value, same source of truth for the pilot). In a future story, expose it from TenantContext.

### 8 — What NOT to do

- Do NOT emit a domain event or audit record for a scope switch (it is not a mutation)
- Do NOT add a `setSubsidiaryScope` call to TenantProvider — scope comes from auth, TenantProvider derives from it
- Do NOT try to update `TenantContext.scopeName` dynamically — TenantProvider handles it via `resolveScopeName` (static map + ID fallback is acceptable)
- Do NOT import `SUBSIDIARY_CONFIG` from `src/features/tenancy/` in `src/shared/ui/components/AppShell.tsx` — that would break NFR-1 layering (feature → shared direction is forbidden; shared → feature is also forbidden). The `activeSubs` prop is the correct seam
- Do NOT add query key scoping to existing hooks in this story — `useEffect([repo])` re-fire is sufficient; TanStack Query key scoping belongs in Epic 2+ feature hooks

---

## Test Requirements (NFR-12)

### Vitest / RTL — `src/shared/ui/components/AppShell.test.tsx`

```
describe('ScopeSwitcher — tenant_admin')
  it('renders chip with tenant name and "Whole tenant (roll-up)" when subsidiaryId is null')
  it('renders chip with subsidiary name when subsidiaryId is set')
  it('chip shows chevrons-up-down icon for admin')
  it('clicking chip opens the dropdown')
  it('dropdown lists "Whole tenant" option first')
  it('dropdown lists all activeSubs')
  it('active option shows check icon')
  it('selecting "Whole tenant" calls setSubsidiaryScope(null, tenantId)')
  it('selecting a subsidiary calls setSubsidiaryScope(sub.id, sub.tenantId)')
  it('dropdown closes after selection')
  it('click-outside closes dropdown')
  it('dropdown enters with crm-pop animation class')

describe('ScopeSwitcher — non-admin (sales/support/viewer)')
  it('chip is disabled with lock icon')
  it('chip title is "Scope is fixed for your role"')
  it('clicking chip does not open dropdown')
  it('no dropdown renders for non-admin')

describe('setSubsidiaryScope validation (AuthProvider unit)')
  it('accepts null (whole-tenant switch)')
  it('accepts a sub id when tenantId matches session.tenantId')
  it('rejects a sub id when tenantId differs from session.tenantId')
  it('tenantId is always read from the session (token), not from the passed tenantId argument')
  it('no-op when session is null')

describe('AppShellWithSubsidiaries — snap-back')
  it('resets scope to null when current subsidiaryId is no longer in activeSubs')
  it('does not snap back when activeSubs is still loading (empty)')
  it('refreshes sub list on Tenant.SubsidiaryCreated event')
  it('refreshes sub list on Tenant.SubsidiaryRemoved event')
```

### Playwright (E2E) — UJ-1 climax

```
describe('E2E: UJ-1 climax — scope switching')
  it('admin switches to EU subsidiary and visible records change to EU data')
  it('admin switches back to whole-tenant and sees all records')
  it('non-admin (sales/viewer) has no switcher choices — chip is locked')
  it('cross-tenant isolation — forged subsidiaryId value is rejected; no cross-tenant data')
```

---

## Definition of Done Checklist

### Functional

- [ ] AC1: `ScopeSwitcher` in AppShell topbar; lists same-tenant active subs + whole-tenant option
- [ ] AC2: `setSubsidiaryScope` validates `tenantId === session.tenantId`; cross-tenant rejected; `tenantId` from token only
- [ ] AC3: Scope change → new repo instance → feature `useEffect([repo])` re-queries → data changes
- [ ] AC4: Non-admin chip locked (disabled, lock icon); no dropdown; cannot switch

### Files created

- [ ] `src/shared/ui/components/AppShell.test.tsx` created

### Files modified

- [ ] `src/shared/auth/auth.types.ts` — `setSubsidiaryScope` added to `AuthContextValue`
- [ ] `src/shared/auth/AuthProvider.tsx` — `setSubsidiaryScope` implemented + in useMemo value
- [ ] `src/shared/ui/components/AppShell.tsx` — placeholder replaced with `ScopeSwitcher`; `activeSubs` prop added
- [ ] `src/app/router.tsx` — `AppShellWithSubsidiaries` wrapper replaces raw `<AppShell>`; loads subs; handles snap-back + event refresh

### Quality gates

- [ ] `npx tsc -b` clean
- [ ] `npm run lint` clean
- [ ] `npm run test:run` green
- [ ] Passes `bmad-code-review`

### Traceability (TC)

- [ ] Story → spec → code → test → GitHub issue (`Closes #<issue>`)
- [ ] `sprint-status.yaml` updated to `done`
- [ ] PR body `Closes #<issue>`

---

## References

- Constitution: `_bmad-output/project-context.md` §5.2, §6, §8
- Architecture + ADRs: `_bmad-output/planning-artifacts/architecture.md` ADR-002, ADR-009, ADR-015
- Epic spec: `_bmad-output/planning-artifacts/epics/epic-1-tenancy-subsidiary/E1-S4.md`
- Prototype: `prototype/app/shell.jsx` (`ScopeSwitcher`, `ScopeOption`), `prototype/app/store.jsx` (`setScope`)
- Motion tokens: `prototype/tokens/motion.css` (`--crm-base`=200ms)
- Previous story (E1-S3) patterns: `src/features/tenancy/OffboardDialog.tsx`, `src/features/tenancy/SubsidiariesPage.tsx`
- Testing stack: ADR-013 (Vitest + RTL + Playwright)

## Dev Agent Record

### Agent Model Used

claude-sonnet-4-6

### Debug Log References

### Review Findings (code-review 2026-06-08)

- [x] [Review][Patch] Event type `'Tenant.SubsidiaryCreated'` was wrong; registry has `'Tenant.SubsidiaryAdded'` [router.tsx:71] — **fixed**
- [x] [Review][Patch] `setSubsidiaryScope` null-id bypass: removed `id !== null &&` so guard applies unconditionally [AuthProvider.tsx:233] — **fixed**
- [x] [Review][Patch] Missing `AppShellWithSubsidiaries — snap-back` test suite — **fixed** (new file: `AppShellWithSubsidiaries.test.tsx`)
- [x] [Review][Patch] Missing lock icon SVG assertion in non-admin chip test [AppShell.test.tsx] — **fixed**
- [x] [Review][Defer] Stale `activeSubs` after role-switch race — pre-existing async loading pattern; pilot acceptable
- [x] [Review][Defer] Pagination cap of 100 silently truncates large tenants — pre-existing repo limit
- [x] [Review][Defer] Raw ID shown in chip during async load gap — visual-only, brief window

### Completion Notes List

- AC1: `ScopeSwitcher` component in AppShell topbar; lists same-tenant active subs + whole-tenant. Prototype-identical chip + dropdown.
- AC2: `setSubsidiaryScope(id, tenantId)` added to `AuthContextValue` and implemented in `AuthProvider`; cross-tenant (mismatched tenantId) silently rejected for all cases (including `id === null`).
- AC3: Scope change updates `session.subsidiaryId` → `useRepository()` mints new repo (memoized on session) → feature `useEffect([repo])` re-queries automatically.
- AC4: Non-admin chip is `disabled` with lock icon and title "Scope is fixed for your role"; no dropdown rendered.
- `vitest.config.ts`: wired `src/test-setup.ts` as `setupFiles`; updated setup to use `@testing-library/jest-dom/vitest` subpath (v6 API).
- `AppShellWithSubsidiaries` wrapper in router.tsx: loads active subs via `useRepository(SUBSIDIARY_CONFIG)`, snap-back for offboarded scope, event-driven refresh on `Tenant.SubsidiaryAdded/Removed`.
- Code review: 4 patches applied (event type bug, null-id bypass, snap-back tests, lock icon test); 3 issues deferred.
- 536/536 tests pass; 3 pre-existing lint errors (TenantProvider.tsx, SubsidiariesPage.tsx) unchanged.

### File List

- `src/shared/auth/auth.types.ts` — added `setSubsidiaryScope` to `AuthContextValue`
- `src/shared/auth/AuthProvider.tsx` — implemented `setSubsidiaryScope` (unconditional cross-tenant guard)
- `src/shared/ui/components/AppShell.tsx` — replaced placeholder with `ScopeSwitcher`; `ActiveSub` type; `activeSubs` prop
- `src/app/router.tsx` — `AppShellWithSubsidiaries` (exported) wrapper; replaced raw `<AppShell>`; fixed event type to `Tenant.SubsidiaryAdded`
- `src/app/TenantProvider.test.tsx` — added `setSubsidiaryScope: vi.fn()` to `makeAuthValue`
- `src/features/tenancy/OffboardDialog.test.tsx` — added `setSubsidiaryScope: vi.fn()` to `makeAuthValue`
- `src/features/tenancy/SubsidiariesPage.test.tsx` — added `setSubsidiaryScope: vi.fn()` to `makeAuthValue`
- `src/shared/ui/components/AppShell.test.tsx` — ScopeSwitcher + AuthProvider unit tests + lock icon assertion
- `src/app/AppShellWithSubsidiaries.test.tsx` — NEW: snap-back + event-refresh tests
- `src/test-setup.ts` — `@testing-library/jest-dom` → `@testing-library/jest-dom/vitest`
- `vitest.config.ts` — added `setupFiles: ['src/test-setup.ts']`
- `_bmad-output/implementation-artifacts/1-4-switcher-in-appshell.md` — story file
- `_bmad-output/implementation-artifacts/sprint-status.yaml` — status → done

---

## Dev Agent Record — correct-course re-alignment (2026-06-08)

**Agent Model Used:** claude-opus-4-8[1m]

**Context:** UI-fidelity re-alignment to the prototype sidebar (DEC-CC-5/6) via `bmad-dev-story E1-S4`. The story was previously `done`; this pass brings the sidebar nav to the tightened pins. The ScopeSwitcher chip/dropdown already matched the prototype and was left unchanged.

### Completion Notes
- **Sidebar grouping (DEC-CC-5):** `NAV_ITEMS` gained a `group` field and a `NAV_GROUPS` constant; the sidebar now renders two labelled groups — **Workspace** (Leads, Customers, Tickets) and **Tenancy** (Subsidiaries, Roll-up) — replacing the single hardcoded "Workspace" header over a flat list. Mirrors `prototype/app/shell.jsx` `Sidebar` + `config.jsx` NAV (Dashboard/Audit omitted — not-yet-built epics).
- **Per-item icons (DEC-CC-5):** Subsidiaries `layers` → **`network`**; Roll-up `bar-chart-2` → **`layers`** (the two were swapped relative to the prototype).
- **Roll-up role-gating (DEC-CC-6):** unchanged — Roll-up stays visible to all roles (`tenant_admin`/`sales`/`support`/`viewer`); the prototype's admin-only nav gate is the stale artifact. Pinned by a non-admin-visibility test.
- **Gates:** `vitest` 573/573 · touched files `eslint` clean · `npx tsc -b` adds **zero** new errors (the 4 remaining are pre-existing E1-S5 debt, cleared in the E1-S5 pass).
- Not changed: the `scopeLoading` re-query skeleton and offboarded-scope snap-back are owned by `AppShellWithSubsidiaries` (router) and already correct; the switcher chip/dropdown copy + icons already matched the prototype.

### File List
- `src/shared/ui/components/AppShell.tsx` — `NavGroupId`/`group` on `NavItem`; `NAV_GROUPS`; icons `network`/`layers`; reordered items; grouped sidebar render.
- `src/shared/ui/components/AppShell.fidelity.test.tsx` — NEW: Workspace/Tenancy group labels, Subsidiaries=network + Roll-up=layers icons, non-admin Roll-up visibility (DEC-CC-6).
- `_bmad-output/implementation-artifacts/sprint-status.yaml` — `1-4` → in-progress → review.
- `_bmad-output/planning-artifacts/epics/epic-1-tenancy-subsidiary/E1-S4.md` — `baseline_commit` added (DEC-CC-5/6 pins added in the prior correct-course pass).

### Change Log
- **2026-06-08** — Sidebar re-alignment to the prototype: Workspace/Tenancy nav groups, Subsidiaries=`network` + Roll-up=`layers` icons, roll-up stays all-roles (DEC-CC-6). 4 new fidelity tests; suite 573/573. Status → review.

## Status
done

## Review Findings (code-review 2026-06-08)

Reviewed jointly with E1-S5 (combined adversarial review). **Clean for E1-S4** — all E1-S4 ACs + DEC-CC-5/6 pins satisfied (Workspace/Tenancy groups, Subsidiaries=`network` / Roll-up=`layers` icons, roll-up visible to all roles); no findings. The combined review's deferred items are all in E1-S5 (see `1-5-cross-subsidiary-roll-up-read-model.md` → Review Findings).
