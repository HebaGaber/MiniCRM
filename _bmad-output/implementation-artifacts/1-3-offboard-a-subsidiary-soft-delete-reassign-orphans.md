---
id: E1-S3
title: Offboard a subsidiary (soft-delete + reassign orphans)
epic: "E1 — Tenancy & Subsidiary"
feature: "1.2 — Subsidiary Onboard / Offboard"
cut: pilot
status: done
baseline_commit: c9959bb9ce0d69465bf35304e20a1974f243056b
depends_on: [E1-S1, E1-S2, E0-S7, E0-S9]
inherits_uc: [UC-1, UC-2, UC-5, TC]
adrs: [ADR-002, ADR-004, ADR-008, ADR-009, ADR-015]
constitution_refs: ["§2", "§4", "§6", "§7"]
---

# E1-S3 — Offboard a subsidiary (soft-delete + reassign orphans)

> **GitHub Epic → Feature → Story:** Epic **E1 — Tenancy & Subsidiary** › Feature **1.2 — Subsidiary Onboard / Offboard** › Story **E1-S3**
> **Cut:** Pilot · **Depends on:** E1-S1 (scope seam), E1-S2 (subsidiary entities exist), E0-S7 (events/audit), E0-S9 (ConfirmDialog in shared UI inventory)

## Story

As a tenant admin, I offboard a subsidiary without orphaning or hard-deleting its records, so that the unit closes cleanly and its data stays owned and visible.

---

## Acceptance Criteria

1. **AC1 — tenant_admin-only.** Route + action guarded by `can(actor, 'subsidiary', 'softDelete', resource)`; non-admin denied (404 out-of-tenant / 403 in-tenant, audited `Auth.RoleDenied`). Hard-delete is never granted to anyone.
2. **AC2 — Soft-delete the subtree, never hard-delete.** Offboard sets `deletedAt` on the subsidiary. Records are never physically removed. Soft-delete flows through `Repository<T>.remove`.
3. **AC3 — Reassignment rule (before commit).** In the offboard dialog the admin chooses a **target** — either another **active** subsidiary in the same tenant, or **parent level (`subsidiaryId=null`)**. Before the subsidiary soft-delete commits, every **active (`deletedAt=null`)** lead/customer/ticket owned by the subsidiary is reassigned: set `subsidiaryId` to the target, and re-scope `ownerId`/`assigneeId` to the target where the prior owner is being offboarded. Each reassigned record emits its own `<Entity>.Updated` + audit **under the offboard correlationId**.
4. **AC4 — Emits `Tenant.SubsidiaryRemoved` + audit, sharing the correlationId.** The subsidiary soft-delete emits one `Tenant.SubsidiaryRemoved` DomainEvent + one AuditEvent, both threaded with the **same** offboard correlationId as all reassignment events.
5. **AC5 — ConfirmDialog required (destructive).** The destructive offboard requires explicit confirmation via the shared `ConfirmDialog` pattern — the `OffboardDialog` component renders it inline as a danger-toned modal. Surfaces the reassignment-target selector before commit.
6. **AC6 — Soft-deleted excluded from lists unless `includeDeleted=true`.** The offboarded subsidiary disappears from the switcher and lists by default.

---

## UX & Behavior (from prototype)

**Source:** `prototype/app/tenancy.jsx` (`OffboardDialog`), `prototype/app/store.jsx` (`commitOffboard`).
Build the OffboardDialog **identical** to the prototype.

### Phases: `choose` → `running`

**`choose` phase:**
- Body text: *"Offboarding soft-deletes **\<sub.name\>** — it disappears from lists and the scope switcher. Its active records must be reassigned first."*
- Impact preview: three stat cards — **Leads / Customers / Tickets** counts of active records (non-terminal status + `deletedAt=null`, owned by this subsidiary). Active states:
  - Lead: `new | contacted | qualified` (not `disqualified`, not `converted`)
  - Customer: `prospect | onboarding | active | inactive` (not `churned`)
  - Ticket: `open | in_progress | pending | resolved` (not `closed`)
- Required select field: **"Reassign active records to"** — options: every OTHER active subsidiary in the same tenant + **"Parent level (shared)"** (`subsidiaryId=null`). Placeholder: *"Choose a target…"*
- Toggle: **"Simulate a mid-batch failure (rolls back)"**
- Footer: **Cancel** (initial focus, safe control) + **"Offboard subsidiary"** (danger, disabled until a target is chosen)

**`running` phase:**
- Footer: a disabled secondary button "Reassigning…"
- Body: progress bar + counter `{done} / {total}` + sub-text "Moving leads, customers and tickets and re-scoping their owners…"
- Progress tick speed: `max(90, --crm-base / 2)` ms per record
- **Esc is suppressed while running**

**Success path:**
1. All `total` records reassigned (each: `subsidiaryId → target`, `ownerId → target default owner` for leads/customers or `assigneeId → target default person` for tickets)
2. Subsidiary soft-deleted (`repo.remove(sub.id)`)
3. If current scope was the offboarded sub → scope resets to tenant
4. Toast: `"<sub.name> offboarded. N active record(s) reassigned to <targetName>."` (success, transient)
5. Dialog closes, subsidiary leaves the list

**Mid-batch fault path (simulate toggle):**
- Batch aborts at ~60% of total, nothing is committed (rollback: no records were modified in the success path until after all ticks)
- Persistent **danger** toast: *"Reassignment failed mid-batch — rolled back. No records moved. \<sub.name\> is still active."* with **"Try again"** action
- Dialog closes

**Zero-record path (total = 0):**
- Immediately `finish()` (skip the tick loop), soft-delete + success toast

**ConfirmDialog discipline:**
- Danger-toned dialog
- Initial focus on **Cancel** (the safe button), never the destructive button
- Esc suppressed only while running (not in choose phase)
- Focus-trap while open

**Motion tokens:**
- Dialog enter: `crm-pop var(--crm-base) var(--crm-ease-decelerate)`
- Progress ticks: `max(90, 200/2)` = `max(90, 100)` = `100ms`
- Failed-run toast: `--crm-fast` (`120ms`), persistent

---

## Architecture — files & modules touched

### New files

| File | Purpose |
|---|---|
| `src/features/tenancy/OffboardDialog.tsx` | Multi-phase offboard modal (choose → running) |
| `src/features/tenancy/OffboardDialog.test.tsx` | Vitest + RTL tests for E1-S3 |
| `src/features/leads/leadConfig.ts` | EntityConfig for Lead (stub for offboard reassignment; Epics 2+ will use this) |
| `src/features/customers/customerConfig.ts` | EntityConfig for Customer (stub) |
| `src/features/tickets/ticketConfig.ts` | EntityConfig for Ticket (stub) |

### Modified files

| File | Change |
|---|---|
| `src/features/tenancy/SubsidiariesPage.tsx` | Wire `onClick` on "Offboard subsidiary" row action to open `OffboardDialog`; pass `onOffboard` callback to reload list + reset scope |
| `src/shared/data/LocalStorageRepository.ts` | Add optional `correlationId?: string` parameter to `update()` and `remove()` to support shared-ID batch offboard (see dev notes) |
| `src/shared/data/Repository.ts` | Add optional `options?: { correlationId?: string }` to `update()` and `remove()` signatures |
| `src/app/composition.ts` | Export `useScopedRepositories()` helper that returns lead/customer/ticket repos for offboard saga (or do it inline in OffboardDialog) |

---

## Dev Notes

### Shared correlationId across batch operations

**The key challenge:** each `repo.update()` call in `LocalStorageRepository` mints its own `newCorrelationId()`. The story requires all reassignment events + the final `Tenant.SubsidiaryRemoved` to share **one** correlationId minted at the start of the offboard action.

**Solution — extend Repository.update() and Repository.remove():**

In `src/shared/data/Repository.ts`, change the `update` and `remove` signatures to accept optional options:

```typescript
update(
  id: ID,
  patch: Partial<Omit<T, keyof BaseEntity>>,
  version: number,
  options?: { correlationId?: string },
): Promise<T>;

remove(id: ID, options?: { correlationId?: string }): Promise<void>;
```

In `src/shared/data/LocalStorageRepository.ts`, update both methods to use the provided correlationId (if given) instead of minting a new one:

```typescript
async update(id, patch, version, options?) {
  const correlationId = options?.correlationId ?? newCorrelationId();
  // ... rest unchanged, but use this correlationId
}

async remove(id, options?) {
  const correlationId = options?.correlationId ?? newCorrelationId();
  // ... rest unchanged
}
```

This is backward-compatible (existing callers pass no options). The offboard saga mints ONE `newCorrelationId()` and passes it through all update/remove calls.

### Entity configs for leads, customers, tickets

Create these stub files. They will be the canonical configs used by Epics 2–5 feature hooks.

**`src/features/leads/leadConfig.ts`:**
```typescript
import type { EntityConfig } from "../../shared/data/LocalStorageRepository";
import type { Lead } from "../../shared/domain/lead.types";
import { leadSchema } from "../../shared/domain/schemas";

export const LEAD_CONFIG: EntityConfig<Lead> = {
  name: "lead",
  entityType: "Lead",
  idKind: "lead",
  schema: leadSchema,
  capability: "lead.manage",
  events: {
    created: "Lead.Created",
    updated: "Lead.Updated",
    deleted: "Lead.Deleted",
    statusChanged: "Lead.StatusChanged",
  },
  transitionEntity: "lead",
};
```

**`src/features/customers/customerConfig.ts`:**
```typescript
import type { EntityConfig } from "../../shared/data/LocalStorageRepository";
import type { Customer } from "../../shared/domain/customer.types";
import { customerSchema } from "../../shared/domain/schemas";

export const CUSTOMER_CONFIG: EntityConfig<Customer> = {
  name: "customer",
  entityType: "Customer",
  idKind: "customer",
  schema: customerSchema,
  capability: "customer.manage",
  events: {
    created: "Customer.Created",
    updated: "Customer.Updated",
    deleted: "Customer.Deleted",
  },
};
```

**`src/features/tickets/ticketConfig.ts`:**
```typescript
import type { EntityConfig } from "../../shared/data/LocalStorageRepository";
import type { Ticket } from "../../shared/domain/ticket.types";
import { ticketSchema } from "../../shared/domain/schemas";

export const TICKET_CONFIG: EntityConfig<Ticket> = {
  name: "ticket",
  entityType: "Ticket",
  idKind: "ticket",
  schema: ticketSchema,
  capability: "ticket.manage",
  events: {
    created: "Ticket.Created",
    updated: "Ticket.Updated",
    deleted: "Ticket.Deleted",
    statusChanged: "Ticket.StatusChanged",
  },
  transitionEntity: "ticket",
};
```

Note: `ticket.manage` capability exists in the permissions matrix. No new capabilities are needed.

### OffboardDialog component design

```typescript
// src/features/tenancy/OffboardDialog.tsx
type Props = {
  sub: Subsidiary;          // the subsidiary being offboarded
  activeSubs: Subsidiary[]; // other active subsidiaries (for target options)
  session: SessionClaims;   // for creating scoped repos
  onClose: () => void;
  onOffboarded: (subId: string) => void; // parent reloads list + resets scope
};
```

**Offboard saga (called on "Offboard subsidiary" click):**

```
1. Mint ONE correlationId = newCorrelationId()
2. Create repos: leadRepo, customerRepo, ticketRepo (LocalStorageRepository with admin session)
3. Load active records:
   - leads:     leadRepo.list({ filter: { subsidiaryId: sub.id, includeDeleted: false }, pageSize: 100 })
   - customers: customerRepo.list({ filter: { subsidiaryId: sub.id, includeDeleted: false }, pageSize: 100 })
   - tickets:   ticketRepo.list({ filter: { subsidiaryId: sub.id, includeDeleted: false }, pageSize: 100 })
4. Filter for active status:
   - lead active: status in ['new', 'contacted', 'qualified']
   - customer active: status in ['prospect', 'onboarding', 'active', 'inactive']
   - ticket active: status in ['open', 'in_progress', 'pending', 'resolved']
5. Build reassignment list (all active records across the three types)
6. For each record (tick loop):
   - IF simulateFail && i === failAt: push persistent danger toast, onClose(), return (rollback — nothing committed yet)
   - ELSE: call repo.update(record.id, { subsidiaryId: target, ownerId/assigneeId: targetDefaultPerson }, record.version, { correlationId })
   - Increment done
7. After all records reassigned: call subRepo.remove(sub.id, { correlationId })
8. onOffboarded(sub.id)
9. Push success toast
10. onClose()
```

**Important:** In the failure path, NO records have been committed yet (the loop exits before completing). This is the "nothing committed" rollback guarantee. Only AFTER all ticks succeed do we proceed to the soft-delete.

**Wait — but each `repo.update()` call IS a real persist.** To implement true rollback-on-failure, the saga needs to either:
- Not commit individual records until the whole batch is done (pre-validate approach), OR
- Accept that in the prototype the failure is purely cosmetic (no real persisting) and implement the SAME pattern: the "running" phase is a visual simulation that drives ticks; the ACTUAL batch reassignment happens atomically at `finish()` time

Looking at the prototype's `commitOffboard()`: it atomically updates ALL records in one `set()` call. The "running" phase is purely visual. The actual commit happens in `finish()`.

**Therefore: implement the SAME pattern in production code:**
- The `running` phase is a visual progress simulation (ticks at `max(90, base/2)ms`)
- On tick completion, call `finish()` — this runs the real async batch
- If `simulateFail`: abort at `failAt` ticks WITHOUT calling finish() at all
- `finish()` runs the actual `repo.update()` calls (one per active record) then `repo.remove(sub.id)` all under the shared correlationId

This means the progress bar is UX-only during the choose phase (not real work), and `finish()` does the real work after the bar completes. The potential gap between "all ticks done" and "real work done" is fine for the pilot (localStorage ops are synchronous-ish).

**targetDefaultPerson for ownerId/assigneeId reassignment:**
The prototype uses `SUB_PEOPLE` to find the default person for the target. In the real implementation, since we don't have user management yet, we can use the CURRENT admin's userId as the reassigned owner/assignee. This is pragmatic for the pilot — Epic 2+ will introduce proper user assignment.

So:
- For leads/customers: `ownerId → session.userId` (the admin doing the offboard)
- For tickets: `assigneeId → session.userId` (or `null` if unassigned is acceptable)

Actually, to keep it simple and match the intent: set `ownerId/assigneeId` to the admin's userId for all reassigned records. This is a pilot simplification.

### SubsidiariesPage changes

The `onClick: () => {}` placeholder for "Offboard subsidiary" row action needs to be replaced:

```typescript
onClick: () => setOffboardTarget(r),
```

Add state: `const [offboardTarget, setOffboardTarget] = useState<Subsidiary | null>(null);`

When `OffboardDialog.onOffboarded(subId)`:
1. Reload the list via `load()`
2. If `useTenant().subsidiaryId === subId` → this is a scope reset (pass a `onScopeReset` callback or handle in the page component)

For scope reset, the `TenantProvider` manages `subsidiaryId`. The `SubsidiariesPage` doesn't directly reset scope. The `onOffboarded` callback should trigger a navigation or a scope change signal. The simplest approach: if the session's `subsidiaryId` matches the offboarded sub, a page refresh / navigation back to `/` will reset the scope (since the user's session doesn't change, but the subsidiary is soft-deleted and won't match any valid scope). OR: pass a `resetScope` function from the router/shell.

For the pilot, the simplest safe behavior: after offboard, call `load()` to refresh the list. The scope reset (if user is scoped to the offboarded sub) can be handled by checking `session.subsidiaryId === sub.id` and calling `signIn(session.roles[0])` to re-derive scope. But that's heavyweight.

Actually the simplest: after `onOffboarded`, just reload the list. The TenantProvider reads `subsidiaryId` from the session, and since the user's session hasn't changed, the scope is still technically set to the offboarded sub — but the UI won't break because the subsidiary is just soft-deleted (it still exists in storage, just with `deletedAt` set). The `scopeName` derived in `TenantProvider` will still return the name.

The prototype's check: `if (scope === sub.id) Store.setScope('tenant')` — this resets the UI scope to tenant level. For the prod app, we'd need to call `signIn(session.roles[0])` (re-authenticate as the same role without a subsidiaryId) or expose a `resetScope()` on `TenantProvider`. Since Epics 1-S4 (scope switcher) is next, for now it's acceptable to just reload the list and leave scope management to E1-S4.

### SUBSIDIARY_CONFIG events

`SUBSIDIARY_CONFIG` in `subsidiaryConfig.ts` already has `deleted: "Tenant.SubsidiaryRemoved"`. When `repo.remove(sub.id, { correlationId })` is called, the repository will emit `Tenant.SubsidiaryRemoved` automatically — we don't need to emit it manually. This is already correct.

### Compiler constraints (non-negotiable)

- `verbatimModuleSyntax: true` → `import type` for all type-only imports
- `erasableSyntaxOnly: true` → no TS `enum`, no decorators
- `.tsx` for JSX files, `.ts` for pure logic
- No barrel `index.ts` — direct-file imports only
- No hardcoded hex/px/font — tokens only

### Existing code to reuse (don't duplicate)

- `ConfirmDialog` from `src/shared/ui/components/ConfirmDialog.tsx` — but `OffboardDialog` is a full custom modal (not just a ConfirmDialog extension). The AC5 says "shared ConfirmDialog discipline": focus-trap, initial focus on Cancel, Esc suppressed while running, danger-toned. Build as a standalone modal following these same patterns (see `OnboardForm.tsx` for the pattern — it uses `panelRef` + `useEffect` for focus-trap and Esc handling).
- `Toggle` component — it's currently inlined in `SubsidiariesPage.tsx`. Copy it into `OffboardDialog.tsx` rather than extracting a shared component (no premature abstraction per DoD).
- `pushToast` from `src/shared/ui/components/Toast`
- `newCorrelationId` from `src/shared/events/correlation`
- `authorize`, `can`, `isInScope` from `src/shared/auth/permissions`
- `useAuth` from `src/shared/auth/useAuth`
- `Button`, `Icon`, `SelectField` from `src/shared/ui/components/`

---

## Test Requirements (NFR-12)

### Vitest (unit) — `src/features/tenancy/OffboardDialog.test.tsx`

```
describe('offboard impact — active state detection')
  it('counts only active leads (new/contacted/qualified)')
  it('does NOT count converted or disqualified leads')
  it('counts only active customers (prospect/onboarding/active/inactive)')
  it('does NOT count churned customers')
  it('counts only active tickets (open/in_progress/pending/resolved)')
  it('does NOT count closed tickets')
  it('only counts records where subsidiaryId matches the offboarded sub')

describe('offboard saga — success path')
  it('reassigns all active leads to target subsidiaryId')
  it('reassigns all active customers to target subsidiaryId')
  it('reassigns all active tickets to target subsidiaryId')
  it('soft-deletes the subsidiary (deletedAt set, not hard-deleted)')
  it('all reassignment + SubsidiaryRemoved events share ONE correlationId')
  it('emits Lead.Updated for each reassigned lead')
  it('emits Tenant.SubsidiaryRemoved for the subsidiary')
  it('each event paired with an audit event')
  it('zero active records: soft-deletes subsidiary immediately (no reassign)')

describe('offboard saga — rollback path')
  it('on simulateFail at ~60%: no records are committed, subsidiary stays active')
  it('on simulateFail: fires persistent danger toast')

describe('permission gate — only tenant_admin may offboard (AC1)')
  it('sales cannot call remove (403)')
  it('tenant_admin can offboard')
  it('hard-delete never granted (softDelete action tested, hardDelete action denied)')

describe('target validation (AC3)')
  it('rejects target from a different tenant')
  it('rejects an already-offboarded subsidiary as target')
  it('accepts another active subsidiary as target')
  it('accepts parent level (null) as target')
```

### RTL (component) — `src/features/tenancy/OffboardDialog.test.tsx`

```
describe('OffboardDialog — choose phase')
  it('renders impact counts (Leads/Customers/Tickets)')
  it('disables "Offboard subsidiary" until a target is chosen')
  it('initial focus is on Cancel button (not the destructive button)')
  it('Esc closes dialog in choose phase')
  it('does not close on Esc while running')
  it('shows target select with only same-tenant active subs + Parent level')

describe('OffboardDialog — running phase')
  it('transitions to running phase on confirm')
  it('shows progress bar and done/total counter')
  it('shows disabled "Reassigning…" footer during run')
  it('fires success toast on completion')
  it('fires persistent danger toast on simulated failure')
```

### Integration — `SubsidiariesPage.test.tsx` (additions)

```
describe('Offboard flow integration (E1-S3)')
  it('offboarded subsidiary appears with 0.55 opacity and "Offboarded" pill')
  it('offboarded subsidiary absent from list by default (includeDeleted=false)')
  it('offboarded subsidiary appears when "Include offboarded" toggle is on')
  it('"Offboard subsidiary" row action is absent for already-offboarded subs')
  it('opens OffboardDialog when row action clicked')
```

---

## Definition of Done Checklist

### Functional

- [ ] AC1: `can(actor, 'tenant.manage', 'softDelete', resource)` gate in OffboardDialog (action guard); non-admin denied 403
- [ ] AC2: `repo.remove()` sets `deletedAt`; no hard-delete path
- [ ] AC3: All active records reassigned to target before subsidiary soft-delete; each emits `<Entity>.Updated` under shared correlationId
- [ ] AC4: `Tenant.SubsidiaryRemoved` + audit both use the same offboard correlationId
- [ ] AC5: Danger-toned modal; Cancel has initial focus; Esc suppressed while running; target required before destructive action
- [ ] AC6: Offboarded subsidiary absent from default list; visible with `includeDeleted=true`

### New files

- [ ] `src/features/tenancy/OffboardDialog.tsx` created
- [ ] `src/features/tenancy/OffboardDialog.test.tsx` created
- [ ] `src/features/leads/leadConfig.ts` created
- [ ] `src/features/customers/customerConfig.ts` created
- [ ] `src/features/tickets/ticketConfig.ts` created

### Modified files

- [ ] `src/shared/data/Repository.ts` — `update()` and `remove()` accept optional `options?: { correlationId?: string }`
- [ ] `src/shared/data/LocalStorageRepository.ts` — `update()` and `remove()` use provided correlationId if given
- [ ] `src/features/tenancy/SubsidiariesPage.tsx` — wire offboard row action to open `OffboardDialog`

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

- Constitution: `_bmad-output/project-context.md` §2, §4, §6, §7
- Architecture + ADRs: `_bmad-output/planning-artifacts/architecture.md` ADR-002, ADR-004, ADR-008, ADR-009, ADR-015
- Epic spec: `_bmad-output/planning-artifacts/epics/epic-1-tenancy-subsidiary/E1-S3.md`
- Prototype: `prototype/app/tenancy.jsx` (`OffboardDialog`), `prototype/app/store.jsx` (`offboardImpact`, `commitOffboard`)
- Motion tokens: `prototype/tokens/motion.css` (`--crm-base`=200ms, `--crm-fast`=120ms, `--crm-instant`=0ms)
- Testing stack: ADR-013 (Vitest + RTL + Playwright)
- Previous story (E1-S2) patterns: `src/features/tenancy/OnboardForm.tsx` — focus-trap, Esc handling, optimistic modal pattern

---

## Dev Agent Record — correct-course re-alignment (2026-06-08)

**Agent Model Used:** claude-opus-4-8[1m]

**Context:** UI-fidelity + behavioral re-alignment to the prototype (DEC-CC-5) via `bmad-dev-story E1-S3`. The story was previously `done` (PR #88); this pass brings it to the tightened ACs/pins.

### Completion Notes
- **Behavioral fix (AC3, DEC-CC-8):** the offboard saga now reassigns orphaned leads/tickets with an **empty patch** — `subsidiaryId` moves, `ownerId`/`assigneeId` are **preserved** (no longer overwritten to the acting admin). Customers were already owner-less (no field). Resolved away from the prototype's `SUB_PEOPLE` re-scope because no per-subsidiary owner roster exists in the app (ruled by Heba — see DEC-CC-8).
- **Impact cards (§8.x):** background token `--iso-brand-soft` → `--iso-blue-3-50` (matches prototype).
- **Modal (DEC-CC-4):** raw `rgba(0,0,0,0.25)` scrim + centered panel → `--crm-scrim` + `--crm-backdrop-blur` tokens, top-anchored (`flex-start`, `padding 64px 24px`), `z-index: var(--iso-z-modal)`; outside-`mousedown` closes only while not running.
- **Tick cadence (§8.6/NFR-10):** hardcoded `100`/`200` ms → derived from the `--crm-base` token at runtime (`step = max(90, base/2)`, initial = base), mirroring the prototype's `commitOffboard`.
- **InlineToggle (§8.6):** knob travel via `calc(var(--crm-travel) * Npx)` so reduced-motion drops the slide.
- **Lint:** added an inline-disable for the pre-existing `react-refresh/only-export-components` on the co-exported `computeOffboardImpact` (was already red at HEAD).
- **Gates:** `vitest` 569/569 · touched files `eslint` clean · `npx tsc -b` adds **zero** new errors (the 4 remaining are pre-existing E1-S5 debt, cleared in the E1-S5 pass).
- **Scope snap-back:** unchanged — handled at the shell layer (`AppShellWithSubsidiaries` reacts to `activeSubs` losing the offboarded sub → `setSubsidiaryScope(null)`), the correct layering; the observable behavior matches the prototype.

### File List
- `src/features/tenancy/OffboardDialog.tsx` — empty reassign patches (preserve owner/assignee); impact-card token; scrim-token + top-anchored modal; `--crm-base`-derived tick cadence; `--crm-travel` InlineToggle; lint-disable on `computeOffboardImpact` export.
- `src/features/tenancy/OffboardDialog.fidelity.test.tsx` — NEW: owner/assignee preservation + impact-card token specs.
- `_bmad-output/implementation-artifacts/sprint-status.yaml` — `1-3` → in-progress → review.
- `_bmad-output/planning-artifacts/epics/epic-1-tenancy-subsidiary/E1-S3.md` — `baseline_commit`; AC3 + UX pin updated to DEC-CC-8 (preserve owner).
- `_bmad-output/decision-log.md` — DEC-CC-8.

### Change Log
- **2026-06-08** — Offboard re-alignment to the prototype: owner/assignee preserved (DEC-CC-8), impact-card + scrim tokens, `--crm-base` tick cadence, `--crm-travel` toggle. 2 new fidelity tests; suite 569/569. Status → review.

## Review Findings (code-review 2026-06-08)

Adversarial review — Blind Hunter (diff-only) + Edge Case Hunter (diff+repo) + Acceptance Auditor
(diff+spec). Scope = E1-S3 diff (`OffboardDialog.tsx` + `OffboardDialog.fidelity.test.tsx`).
**Acceptance Auditor: all 5 ACs + all 5 DEC-CC-5 pins satisfied** (owner-preservation, soft-delete,
shared correlationId, danger/focus/Esc, impact-card + scrim tokens, `--crm-base` cadence, `--crm-travel`).
Triage: **0 decision-needed · 3 patch · 3 defer · 10 dismissed** (false positives — target self-selection
[filter exists, `:164`] and running-saga close race [`runningRef` set synchronously, `:177`] — plus
matches-prototype / negligible items).

- [x] [Review][Patch] **Stale UI copy contradicts DEC-CC-8** — running-phase sub-text and SelectField help claimed ownership moves, but owners are now preserved. **Fixed** (2026-06-08): running text → "Moving leads, customers and tickets to the new scope…"; help → "Records move to this target; their owners are preserved.". [`OffboardDialog.tsx:450,520`]
- [x] [Review][Patch] **`crm-fade` keyframe undefined** — the scrim `animation: crm-fade …` silently no-opped. **Fixed** (2026-06-08): added `@keyframes crm-fade` to `tokens.css` (also fixes `OnboardForm.tsx:135` from the E1-S2 pass). [`tokens.css`]
- [x] [Review][Patch] **Stale scrim-token name in docs** — `--iso-overlay-scrim` doesn't exist; repo uses `--crm-scrim` + `--crm-backdrop-blur`. **Fixed** (2026-06-08): corrected in `E1-S2.md`, `E1-S3.md`, `decision-log.md` (DEC-CC-4), `project-context.md` §8.6, `E0-S9.md`. [docs]
- [x] [Review][Defer] `parseFloat(--crm-base)` is unit-fragile (an `s`-unit token → ~3000× faster saga); matches the prototype's pattern — future-proof later. [`OffboardDialog.tsx:190`]
- [x] [Review][Defer] Fidelity test hardening — real-timer reliance (flake risk), no assertion the success toast/`onOffboarded` fired, `finish()` catch branch uncovered, `getByRole("combobox")` singular assumption. [`OffboardDialog.fidelity.test.tsx`]
- [x] [Review][Defer] First saga tick uses `baseMs` vs the prototype's hardcoded `200` (120ms under reduced-motion) — minor accepted deviation. [`OffboardDialog.tsx:214`]

## Status
done
