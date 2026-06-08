# min-crm — Engineering Guidelines (Standardization Constitution)

**This is the single source of truth for how min-crm is built.** Every agent and every developer follows it. It exists to remove ambiguity: if a pattern is defined here, you use it as-is — you do **not** invent an alternative. Deviations require an explicit entry in `decision-log.md` with a reason.

This file is the canonical content for `_bmad-output/project-context.md`. BMAD agents read project-context on every workflow, so these rules bind generation, not just review.

**Context:** min-crm is **Product A** on the iSolution Platform Boilerplate. It consumes shared-platform capabilities and must not duplicate them. Pilot persistence is `localStorage`; the seams target a real multi-tenant backend.

---

## 1. Architectural layering (non-negotiable)

Three layers, one dependency direction:

```
PRODUCT LAYER  (min-crm owns)         features/leads, features/tickets, CRM dashboards/shell
      │  depends on ↓ (never upward)
SHARED PLATFORM (boilerplate)         Customer, Sales Journey, Tasks, Notifications,
                                      Identity&Access, Tenant&Subsidiary, Config&Flags,
                                      Audit, Event Bus, Data layer
      │  talks to ↓ via ports only
EXTERNAL SYSTEMS (pluggable, OFF)     Odoo, Unifonic, Cloud — behind interfaces + flags
```

Rules:
- Product code depends on the shared layer; the shared layer **never** imports product code.
- External systems are reached only through a port interface guarded by a feature flag. In the pilot all external flags are **off**.
- `Customer` is a **shared** capability. The CRM consumes it; it does not define or own the customer model.
- Anything reusable across products goes in `src/shared` and is documented here. Treat changes to shared as API changes.

---

## 2. Entity standards

### 2.1 Base entity — every persisted entity extends this
```ts
// shared/data/types.ts
export type ID = string; // UUID v4, prefixed by type: "lead_…", "tkt_…", "cust_…"

export interface BaseEntity {
  id: ID;
  tenantId: ID;          // customer tenant — REQUIRED on every record
  subsidiaryId: ID | null; // null = parent-level record
  createdAt: string;     // ISO 8601
  updatedAt: string;     // ISO 8601
  createdBy: ID;         // userId
  updatedBy: ID;         // userId
  version: number;       // optimistic concurrency, starts at 1
  deletedAt: string | null; // soft delete; null = active
}
```
Rules:
- **Tenant scope is mandatory.** No entity exists without `tenantId`. Subsidiary-scoped entities also carry `subsidiaryId`.
- IDs are type-prefixed UUIDs (`lead_…`, `cust_…`, `tkt_…`, `usr_…`, `tnt_…`, `sub_…`).
- Timestamps are ISO 8601 UTC strings. Never store `Date` objects.
- Deletes are **soft** by default (`deletedAt`). Hard delete only via an explicit admin action that emits an audit event.
- `version` increments on every update; mismatched version on write → `409 CONFLICT` (see §5).

### 2.2 Canonical entities (pilot scope)
```ts
export interface Tenant extends BaseEntity { name: string; status: TenantStatus; }
export interface Subsidiary extends BaseEntity { name: string; parentSubsidiaryId: ID | null; }
export interface User extends BaseEntity { email: string; displayName: string; roles: Role[]; }

// SHARED capability — consumed by CRM, not owned by it
export interface Customer extends BaseEntity {
  name: string; primaryEmail: string; phone?: string;
  status: CustomerStatus; convertedFromLeadId: ID | null;
  taxRegistrationNumber?: string; // DEC-CC-2: required to activate (see §3.2 gate)
  contactAddress?: string;        // DEC-CC-2: required to activate (see §3.2 gate)
}

// PRODUCT — Sales Journey (lead portion)
export interface Lead extends BaseEntity {
  name: string; email: string; phone?: string; company?: string;
  source: LeadSource; status: LeadStatus; ownerId: ID; notes?: string;
}

// PRODUCT — Ticketing (on shared Tasks/Workflow)
export interface Ticket extends BaseEntity {
  customerId: ID; subject: string; description: string;
  status: TicketStatus; priority: TicketPriority; assigneeId: ID | null;
}
```
Out of pilot scope (seams only, not built): Subscription, Billing, Multi-cloud, embedded AI Agent.

---

## 3. Statuses system (single source — no ad-hoc strings)

All statuses are TypeScript enums/literals defined once in `shared/domain/status.ts`. UI never hardcodes a status string; it imports from here. Each status has (a) allowed transitions and (b) a semantic tone for the status pill.

### 3.1 Definitions
```ts
export type TenantStatus   = "active" | "suspended";
export type CustomerStatus = "prospect" | "onboarding" | "active" | "inactive" | "churned"; // DEC-1: 5-state lifecycle
export type LeadStatus     = "new" | "contacted" | "qualified" | "disqualified" | "converted";
export type LeadSource     = "web" | "referral" | "event" | "outbound" | "import";
export type TicketStatus   = "open" | "in_progress" | "pending" | "resolved" | "closed";
export type TicketPriority = "low" | "medium" | "high" | "urgent";
export type Role           = "tenant_admin" | "sales" | "support" | "viewer";
```

### 3.2 Allowed transitions (state machines — enforced in the service layer)
```ts
export const LEAD_TRANSITIONS: Record<LeadStatus, LeadStatus[]> = {
  new:          ["contacted", "disqualified"],
  contacted:    ["qualified", "disqualified"],
  qualified:    ["converted", "disqualified"],
  disqualified: ["contacted"],          // can be revived
  converted:    [],                      // terminal
};

// DEC-1: conversion lands the customer in `prospect`; onboarding workflow walks it to `active`
export const CUSTOMER_TRANSITIONS: Record<CustomerStatus, CustomerStatus[]> = {
  prospect:   ["onboarding"],
  onboarding: ["active"],
  active:     ["inactive", "churned"],
  inactive:   ["active", "churned"],     // reactivation allowed
  churned:    [],                         // terminal
};

export const TICKET_TRANSITIONS: Record<TicketStatus, TicketStatus[]> = {
  open:        ["in_progress", "pending", "closed"],
  in_progress: ["pending", "resolved", "open"],
  pending:     ["in_progress", "resolved"],
  resolved:    ["closed", "open"],       // reopen allowed from resolved
  closed:      [],                        // Flag C: terminal (reopen only via resolved → open)
};
```
Rule: a status change that isn't in the transition map is rejected with `422 UNPROCESSABLE` and is **never** silently allowed. Every accepted change emits a `*.StatusChanged` event (§7).

> **DEC-CC-2 — Customer activation gate (2026-06-07, prototype reconciliation).** The `onboarding → active` transition carries an additional **precondition**: the customer must have **both** `taxRegistrationNumber` **and** `contactAddress` set (§2.2). A move to `active` without both is rejected `422` with inline feedback (*"Add a tax registration number and contact address before activating this customer."*) — **no pill change, no `*.StatusChanged` event** — exactly like the ticket customer-state gate. This is a precondition on a legal edge, not a new edge; `CUSTOMER_TRANSITIONS` is structurally unchanged. See `_bmad-output/decision-log.md`.

### 3.3 Status → UI tone mapping (used by the StatusPill component only)
```ts
export const STATUS_TONE = {
  // tone ∈ neutral | info | success | warning | danger
  lead:   { new:"neutral", contacted:"info", qualified:"success", disqualified:"danger", converted:"success" },
  ticket: { open:"info", in_progress:"warning", pending:"neutral", resolved:"success", closed:"neutral" },
  priority:{ low:"neutral", medium:"info", high:"warning", urgent:"danger" },
  customer:{ prospect:"info", onboarding:"warning", active:"success", inactive:"neutral", churned:"danger" },
} as const;
```

> **Status changelog (deviations from the original constitution, logged):** `CustomerStatus` expanded 3→5 states with `CUSTOMER_TRANSITIONS` added (DEC-1, from the product brief); ticket `closed` made terminal — reopen only via `resolved → open` (Flag C). Any further status change requires a decision-log entry.

---

## 4. CRUD guideline

All persistence goes through the repository contract. **Feature code never touches `localStorage` directly.**

### 4.1 Repository contract
```ts
// shared/data/Repository.ts
export interface ListQuery {
  filter?: Record<string, string | number | boolean>;
  q?: string;             // free-text search
  page?: number;          // 1-based
  pageSize?: number;      // default 25, max 100
  sort?: string;          // "field" | "-field" (desc)
}
export interface Page<T> { data: T[]; total: number; page: number; pageSize: number; }

export interface Repository<T extends BaseEntity> {
  list(q?: ListQuery): Promise<Page<T>>;
  get(id: ID): Promise<T | null>;
  create(input: Omit<T, keyof BaseEntity>): Promise<T>;
  update(id: ID, patch: Partial<Omit<T, keyof BaseEntity>>, version: number): Promise<T>;
  remove(id: ID): Promise<void>;       // soft delete
}
```

### 4.2 Mandatory CRUD rules
1. **Tenant + subsidiary scoping is applied inside the repository**, read from the auth context — never passed by the caller, never trusted from the client. localStorage key: `crm:{tenantId}:{subsidiaryId|_parent}:{entity}`.
2. **Validate before persist** (schema + business rules). Invalid → `422` with field details. Never persist partial/invalid state.
3. **Create**: server sets `id`, all `BaseEntity` audit fields, `version = 1`. Emits `<Entity>.Created`.
4. **Update**: requires the caller's `version`; mismatch → `409`. Bumps `version`, sets `updatedAt/By`. Emits `<Entity>.Updated` (and `<Entity>.StatusChanged` if status moved).
5. **Delete**: soft by default (sets `deletedAt`). Lists exclude soft-deleted unless `filter.includeDeleted=true`. Emits `<Entity>.Deleted`.
6. **Every mutation emits exactly one audit event and the matching domain event** (§7) — in the same logical operation. No silent writes.
7. **List** always returns `Page<T>`; default `pageSize=25`. Sorting and filtering use the standard params (§5.4).
8. **UI states**: every data view handles loading / empty / error explicitly (§8). Mutations are optimistic with rollback on failure.

---

## 5. API guideline (the contract the repository seam targets)

The pilot is localStorage, but the repository mimics this contract exactly so swapping to a backend is mechanical. Backend implementers and the localStorage adapter both honor this.

### 5.1 Base & versioning
- Base path: `/api/v1`. Breaking changes bump the version (`/api/v2`).
- Resources are plural nouns: `/leads`, `/customers`, `/tickets`, `/customers/{id}/tickets`.

### 5.2 Tenant context propagation
- Auth context (tenant, subsidiary, user, roles) is derived **server-side from the access token** (§6). 
- The client may send `X-Subsidiary-Id` to scope within its tenant; the server validates it belongs to the token's tenant. Tenant id is **never** taken from a client header for authorization.

### 5.3 Methods & status codes
| Action | Method | Path | Success |
|---|---|---|---|
| List | GET | `/leads` | 200 `Page<T>` |
| Read | GET | `/leads/{id}` | 200 / 404 |
| Create | POST | `/leads` | 201 + `Location` |
| Update | PATCH | `/leads/{id}` | 200 |
| Delete | DELETE | `/leads/{id}` | 204 |
| Transition | POST | `/leads/{id}/transition` | 200 |

Error codes: `400` malformed, `401` unauthenticated, `403` unauthorized (role/tenant), `404` not found / wrong tenant, `409` version conflict, `422` validation/illegal transition, `429` rate limit, `500` server.

### 5.4 Query params (lists)
`?q=&status=&ownerId=&page=1&pageSize=25&sort=-updatedAt` — unknown filters are ignored, not errored.

### 5.5 Envelopes
```jsonc
// success (single)            { "data": { ...entity } }
// success (list)              { "data": [ ... ], "meta": { "total": 0, "page": 1, "pageSize": 25 } }
// error                       { "error": { "code": "VALIDATION", "message": "…", "details": [ { "field": "email", "issue": "required" } ] } }
```
- Mutations are **idempotent where possible**; `POST /create` accepts an optional `Idempotency-Key` header.
- Timestamps in responses are ISO 8601 UTC. IDs are the prefixed UUIDs from §2.

---

## 6. Authentication & authorization guideline

### 6.1 Session model
- Pilot uses a **mock SSO** that issues a signed session object; production swaps in real SSO (OIDC) behind the same `AuthProvider` interface.
- The session/token carries claims: `{ userId, tenantId, subsidiaryId|null, roles: Role[], exp }`.
- Auth context is established once at the app shell and exposed via `useAuth()`. **Tenant/subsidiary scoping everywhere derives from this context, never from props or client input.**

### 6.2 Roles & permission matrix
| Capability | tenant_admin | sales | support | viewer |
|---|---|---|---|---|
| Manage tenant/subsidiaries, users | ✅ | — | — | — |
| Leads: create/edit/convert | ✅ | ✅ | — | read |
| Customers: edit | ✅ | ✅ | read | read |
| Tickets: **create** (DEC-CC-1) | ✅ | ✅ | ✅ | ✅ |
| Tickets: edit/assign | ✅ | read | ✅ | read |
| View audit/events | ✅ | own | own | — |
| Cross-subsidiary roll-up: **view** (DEC-CC-6) | ✅ tenant-wide | scoped | scoped | scoped |

> **DEC-CC-1 (2026-06-07, prototype reconciliation):** ticket **creation** is granted to **every role** (incl. `sales` and `viewer`) — tickets are the one entity anyone in scope may raise. Ticket **edit/assign** is unchanged (admin/support write; sales/viewer read). Customer **edit** stays `support = read` (C-2 ruled "keep constitution"). See `_bmad-output/decision-log.md`.

> **DEC-CC-6 (2026-06-08, prototype reconciliation — conflict C-5):** the cross-subsidiary roll-up (`rollup.view`, E1-S5) is **visible to every role**, not admin-only: `tenant_admin` sees **tenant-wide** aggregates; `sales`/`support`/`viewer` see a **scope-limited** roll-up (own subsidiary + parent-level only — never sibling-subsidiary counts, enforced by the E1-S1 scope filter). The prototype's admin-only nav gate (`prototype/app/config.jsx:43` `roles: ['tenant_admin']`) is the **stale artifact** and is *not* to be rebuilt; the encoded matrix (`permissions.ts` `rollup.view`) and E1-S5 AC3 win. See `_bmad-output/decision-log.md`.

### 6.3 Enforcement rules
1. **Two gates, always:** a route guard (can this role open the screen?) and an action guard (can this role perform this mutation on this record, in this tenant/subsidiary?).
2. Every repository/API call is authorized against the auth context. A record outside the caller's tenant returns `404` (not `403`) to avoid leaking existence.
3. Auth events (`Auth.LoggedIn`, `Auth.LoginFailed`, `Auth.LoggedOut`, `Auth.RoleDenied`) are audited (§7).
4. No client-trust: roles, tenant, subsidiary are validated server-side (in the pilot, inside the shared auth/data layer).

---

## 7. Event logging guideline

Two distinct streams. Both are tenant-tagged and immutable.

### 7.1 Audit log — "who did what, when" (compliance)
```ts
export interface AuditEvent {
  id: ID; tenantId: ID; subsidiaryId: ID | null;
  actorId: ID; action: string;          // e.g. "lead.convert"
  entityType: string; entityId: ID;
  occurredAt: string;                   // ISO 8601 UTC
  before?: unknown; after?: unknown;    // redacted of secrets
  correlationId: string;
}
```
- **Immutable**: append-only; never updated or deleted.
- Every mutation, auth event, status transition, and conversion writes one audit record.
- Redact secrets/PII per §7.4 before storing `before/after`.

### 7.2 Domain events — "something happened" (event bus)
```ts
export interface DomainEvent<P = unknown> {
  eventId: ID; type: string;            // "<Entity>.<PastTenseAction>"
  tenantId: ID; subsidiaryId: ID | null;
  actorId: ID; occurredAt: string;
  payload: P; correlationId: string;
}
```
Canonical event types (extend only by adding here):
```
Lead.Created, Lead.Updated, Lead.StatusChanged, Lead.Converted, Lead.Deleted
Customer.Created, Customer.Updated, Customer.Deleted
Ticket.Created, Ticket.Updated, Ticket.StatusChanged, Ticket.Assigned, Ticket.Deleted
Tenant.SubsidiaryAdded, Tenant.SubsidiaryRemoved
Auth.LoggedIn, Auth.LoginFailed, Auth.LoggedOut, Auth.RoleDenied
```

### 7.3 Naming & rules
- Event type = `PascalCaseEntity.PastTenseAction`. No free-form names.
- One operation → one audit record + one domain event, sharing a `correlationId`.
- Events feed the Events Log screen and dashboards (Epic 5).

### 7.4 Structured logging & PII
- App logs are structured JSON: `{ ts, level, tenantId, subsidiaryId, actorId, msg, correlationId, ... }`.
- **Never log** passwords, tokens, full PII bodies. Mask emails/phones in logs (`a***@x.com`).
- Log levels: `error` (action failed), `warn` (degraded/denied), `info` (state change), `debug` (dev only).

---

## 8. UI templates & component standards

Screens are assembled from a fixed set of page templates and shared components. **Do not invent new page layouts or one-off components** — extend the shared set and document it here.

### 8.1 Required states (every data-backed view)
`loading` (skeleton) · `empty` (illustration + primary action) · `error` (message + retry) · `ready`. Shipping a view without all four is a DoD failure.

### 8.2 Page templates
**List page** (`<ListPage>`):
```
[ Page header: title · primary action ]
[ Toolbar: search (q) · filters (status/owner) · sort ]
[ DataTable: columns, StatusPill for status, row actions ]
[ Pagination ]
states: loading→table skeleton · empty→empty-state · error→retry
```
**Detail page** (`<DetailPage>`):
```
[ Header: entity name · StatusPill · actions (edit, transition, delete-confirm) ]
[ Two-column: main fields | side meta (owner, timestamps, audit link) ]
[ Related tab(s): e.g. Customer → Tickets ]
```
**Form page / modal** (`<EntityForm>`): controlled inputs · inline validation · disabled submit until valid · optimistic save + rollback toast on error.
**Dashboard** (`<Dashboard>`): stat callouts + simple charts fed by the events/aggregates; role-scoped.

### 8.3 Shared component inventory (use these, don't reinvent)
`AppShell` (nav + tenant/subsidiary switcher) · `DataTable` · `StatusPill` (driven by §3.3) · `Toolbar` · `FilterBar` · `EntityForm` fields (`TextField`, `SelectField`, `DateField`) · `ConfirmDialog` (required for any destructive/convert action) · `Toast` (operation outcomes) · `EmptyState` · `ErrorState` · `Skeleton` · **`RecordPager`** (DEC-CC-3).

> **DEC-CC-3 — `RecordPager` + side-by-side view added to the inventory (2026-06-07, prototype reconciliation; NFR-10 exception logged).** `RecordPager` is a sticky detail-view bar exposing prev/next (respecting the active list filter/sort order), "N of M · <noun>", a **Side/Full view toggle**, and Close; it is keyboard-operable (`↑/←/k` prev, `↓/→/j` next, `Esc` close; suppressed in inputs). The **Side view** renders the list beside the detail panel (open row highlighted), persisted per-user. These extend the fixed inventory **by approval** (they are *not* a per-screen one-off): the DetailPage template hosts them; no other new layouts are permitted. See `_bmad-output/decision-log.md`.

### 8.4 Design & accessibility rules
- Use Claude Design tokens (color/type/spacing/radius). **No hardcoded hex, px, or font values** in components.
- Status colors come only from `STATUS_TONE` → tone tokens; never pick colors per-screen.
- Destructive and convert actions always go through `ConfirmDialog`.
- Tables and forms are keyboard-accessible; inputs have labels; focus states visible. Responsive down to tablet.

---


> **§8.5–§8.10 below are the binding UX/interaction rules folded in from the bmad-ux spec (DEC-UX-1: iSolution DS and "Claude Design tokens" are the same token layer; the only authored visual layer is motion). They bind E0-S9 and every UI story.**

## §8.5 Design principles (binding intent)

1. **Clarity over chrome** — motion/elevation/ornament must make a state change legible or be removed.
2. **Audit-as-feature legibility** — the Activity timeline is a designed product surface, distinct from the raw Audit/Events log.
3. **Scope always visible** — active tenant/subsidiary shown in the AppShell at all times; empty scope reads as empty, not broken.
4. **Deny-wins, felt gracefully** — every 404/422/role/state denial resolves to a calm blocked/empty state offering the next legal action; cross-tenant 404 never leaks existence.
5. **Optimistic but honest** — mutations apply instantly; failures roll back with the most visible motion in the app plus a plain toast.

## §8.6 Motion tokens (authored — DS owns no motion)

Defined in DESIGN.md. `instant 0ms` (optimistic apply) · `fast 120ms` (hover, focus, **pill tone
change**, toast enter) · `base 200ms` (skeleton→ready, dialog/switcher enter, route, saga step) ·
`slow 320ms` (**rollback snap-back — deliberately the slowest, so reversal is seen**). Easing:
`standard` moves, `decelerate` enters, `accelerate` exits. **`prefers-reduced-motion: reduce` is
honored everywhere**: no travel/transform/snap-back; opacity cross-fades survive at `fast`; all
state still changes and all feedback still fires. No decorative motion. Elevation (DS values) is
reserved for transient overlays only; the saga inspector is in-page and does **not** elevate.
**Derived step-cadence values** beyond the four duration tokens (saga step `base + 60ms`,
compensation `base + 80ms`, scope re-query `base + 220ms`, optimistic-undo `~700ms`, offboard tick
`max(90, base/2)`) are **JS timing constants** — define them as named constants derived from the
`--crm-*` durations; **never inline raw `ms`/opacity literals in components** (NFR-10). The modal
overlay scrim is a **DS token** (`--crm-scrim` + `--crm-backdrop-blur`), never a raw `rgba()`/`px`
(DEC-CC-4).

## §8.7 Four-state behavior (NFR-9/UC-1) — binds the `<QueryStateBoundary>`

- `isPending → Skeleton` mirroring the real layout (never a bare spinner); resolve cross-fades to
  content at `base`/`decelerate`.
- `isError → ErrorState` (contained panel, not a toast/takeover) with **[Retry] → `refetch()`**;
  inline pending on retry; no error-toast spam on repeated failure.
- `empty → EmptyState` = illustration + scope-framed line + **the page's primary action**, which is
  the **first focus stop**; no disabled dead button if the role can't perform it.
- else `ready`.
- **Mutation** errors use the toast/rollback path (§8.8), **not** `ErrorState`.

## §8.8 Mutation, transition & status feedback (ADR-007, UC-3, Pattern 4/5) — BINDING

- **Optimistic apply** paints at `instant` (0ms); `version` pre-incremented locally.
- **Rollback** (real or fault-injected) snaps the optimistic change *back* at `slow` (320ms) +
  a toast: generic "rolled back"; **409 → distinct "record changed, refresh"**; **422 → rollback +
  inline field errors**. Reduced-motion: revert instant, toast still fires.
- **Illegal transition / customer-state gate → 422:** the **StatusPill NEVER changes tone**; feedback
  is **inline at the transition control** as *rule + next legal step* (not a toast, not a tone flicker);
  no `*.StatusChanged` event, no audit record. (UC-3 / DEC-UX-6)
- **Legal transition:** StatusPill cross-fades its tone token at `fast`. Tone comes **only** from
  `STATUS_TONE` (§3.3) → tone tokens; pill text is the enum label, never a literal; tone change is
  the pill's only animation.
- **ConfirmDialog** required for all destructive + convert actions: focus-trap, initial focus on the
  **safe** control, `Esc` cancels, destructive button tone-tokened `danger` and not default-focused.
  **Convert** hands off to the saga inspector (no double-confirm).

## §8.9 Saga inspector, Activity timeline, toast & notifications

- **Conversion saga inspector** = `DetailPage` variant (no new layout, no modal — NFR-10), reads
  `WorkflowInstance` (`steps`/`currentStep`/`completedSteps`/`status`). Steps render done(`success`)
  / current(`info`, advancing at `base`) / pending(`neutral`). On **failure**: status → "Rolling
  back…", **completed steps visibly reverse top-down** at `base`, end `failed` with **no half-made
  customer**, lead back at `qualified`, **[Try again]** offered. Success links both timelines via the
  shared `correlationId`.
- **Activity timeline** = a record's `DomainEvent`s reverse-chronologically (actor + relative time
  with absolute on hover + human sentence); interleaves lineage + lifecycle on a customer; gated by
  view-record permission (viewer sees it in scope). **It is NOT the Audit/Events log** — that is a
  separate top-level surface of raw `AuditEvent` `before/after`, gated by §6.2 (viewer = none).
- **Toast** = own-action outcome only (not a feed): enter `fast`, success auto-dismiss ~4s,
  **error/409 do not auto-dismiss**, always manually dismissible, max 3 stacked, `aria-live`
  polite/assertive by tone.
- **In-app notifications** (AppShell bell) = projected from `DomainEvent`s by the shared Notifications
  kernel, scoped to recipient tenant/subsidiary (UC-5), never bespoke writes; persist until read;
  the notifications list itself obeys the four states.

## §8.10 Accessibility & interaction floor (contrast inherited from the DS)

- **Status never by color alone** — StatusPill always carries the text label.
- **Focus order on resolve:** ready → first control in main region; empty → primary action; error →
  [Retry]. Dialogs/switcher trap focus and restore to trigger on close.
- **Tables** fully keyboard-operable (arrow-navigate, `Enter` opens row, row actions in tab order,
  keyboard sort/filter/paginate) — nothing pointer-only.
- **Forms** label every field, follow visual tab order, associate errors via `aria-describedby` and
  announce them, move focus to the first errored field on a 422 backstop.
- **`prefers-reduced-motion`** honored everywhere; accessibility never costs the user feedback.
- Responsive down to tablet (NFR-10).

## 9. Folder structure & naming

```
src/
  app/                # shell, routing, providers (Auth, Tenant, Notifications)
  shared/
    data/             # Repository, localStorage adapter, types
    domain/           # status.ts (enums + transitions + tone), entity types
    auth/             # AuthProvider, useAuth, guards, permission matrix
    events/           # audit + domain event bus, logger
    ui/               # the component inventory (§8.3)
    config/           # feature flags
  features/
    leads/   customers/   tickets/   dashboard/
```
Naming: components `PascalCase.tsx`; hooks `useThing.ts`; services `thing.service.ts`; types `thing.types.ts`. One feature folder per domain; cross-feature code must move to `shared`.

---

## 10. Definition of Done (per story) — aligned to the boilerplate gate model

A story is Done only when **all** hold:
- Meets acceptance criteria; passes `bmad-code-review`.
- Uses shared modules (no duplication of tenant/auth/repo/UI/status/event patterns).
- Tenant + subsidiary scoping enforced via auth context (not props/client).
- Statuses use §3 definitions and transition rules; illegal transitions rejected.
- Every mutation emits one audit event + one domain event (§7).
- All four UI states present for any data view (§8.1).
- Traceable chain intact: **story → spec → code → test → issue** (`Closes #<issue>`).
- Preview deploy green; story marked done in `sprint-status.yaml`; stage gate signed off.
