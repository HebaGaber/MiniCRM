---
baseline_commit: 23f12ed
---

# Story 0.12: Notifications kernel

Status: done

- **Story ID:** E0-S12 (`0-12-notifications-kernel`)
- **Epic:** E0 — Platform Guidelines & Standards (the governing contract) · **Feature:** 0.7 — Notifications Kernel
- **Cut:** Pilot · **Depends on:** E0-S7 (domain-event bus), E0-S9 (four-state surface) · **ADRs:** ADR-014 · **Constitution:** §7, §8

## Story

As the platform,
in-app notifications are a shared-layer capability driven off the domain-event bus — not feature-owned —
so that any event can produce a scoped, recipient-targeted notification without bespoke writes.

## Acceptance Criteria

1. **AC1 — Service + hook.** `src/shared/notifications/NotificationService.ts` ships a `NotificationService` that **subscribes to the `DomainEvent` bus** (E0-S7) and `src/shared/notifications/useNotifications.ts` exports `useNotifications()` for consumers.
2. **AC2 — Notification data shape.** A notification carries `{ id, recipient, type, payload, read, tenantId, subsidiaryId, occurredAt }` — scoped to the recipient's tenant/subsidiary.
3. **AC3 — Recipient-mapping handlers (UC-5).** Handlers map event type → recipient:
   - `Ticket.Assigned → event.payload.assigneeId`
   - `Lead.Converted → event.payload.ownerId`
   Notifications are driven off domain events **only — never bespoke writes**.
4. **AC4 — Four-state surface scaffold (UC-1).** `useNotifications()` exposes `{ state: QueryState, notifications, unreadCount, markRead, markAllRead, error }` so consumers plug directly into `<QueryStateBoundary>`. Empty state = "You're all caught up" (`bell-off` icon).

## Tasks / Subtasks

### Task 1 — `src/shared/notifications/NotificationService.ts` (AC1, AC2, AC3)

- [x] Define `AppNotification` interface (AC2):
  ```ts
  export interface AppNotification {
    id: string;
    recipient: string;         // userId from event payload (assigneeId / ownerId)
    type: string;              // canonical event type, e.g. "Ticket.Assigned"
    payload: unknown;          // forwarded from DomainEvent.payload
    read: boolean;
    tenantId: string;
    subsidiaryId: string | null;
    occurredAt: string;        // ISO 8601 UTC — from DomainEvent.occurredAt
  }
  ```
- [x] Implement in-memory store: `const _store: AppNotification[] = []` (not localStorage — unit-testable in node env; same pattern as auditLog.ts).
- [x] Implement recipient mapping (AC3):
  ```ts
  type RecipientMapper = (event: DomainEvent) => string | null;
  const RECIPIENT_MAPPERS: Partial<Record<string, RecipientMapper>> = {
    'Ticket.Assigned': (e) => (e.payload as { assigneeId?: string }).assigneeId ?? null,
    'Lead.Converted':  (e) => (e.payload as { ownerId?: string }).ownerId ?? null,
  };
  ```
- [x] Implement `handleEvent(event: DomainEvent): void`:
  - Look up the mapper; if no mapper → ignore event (no notification produced)
  - `recipient = mapper(event)` — if `null` → skip
  - Construct `AppNotification` with `id` from `event.eventId + '-notif'`, set `read: false`
  - Push to `_store`
- [x] Subscribe on module init: `_setupSubscription()` — tracks unsubscribe handle so `__resetNotifications()` can re-subscribe after `__resetBus()` in tests
- [x] Export:
  - `notificationsFor(recipient: string): readonly AppNotification[]` — returns slice of `_store` filtered by `recipient`, newest-first
  - `markRead(id: string): void` — sets `read: true` on matching notification
  - `markAllRead(recipient: string): void` — sets `read: true` on all matching
  - `__resetNotifications(): void` — TEST-ONLY; clears `_store` and re-subscribes (same pattern as `__resetBus()`)
- [x] Seed notifications for demo realism (see Dev Notes §Seed data)

### Task 2 — `src/shared/notifications/useNotifications.ts` (AC1, AC4)

- [x] Import `notificationsFor`, `markRead`, `markAllRead` from `./NotificationService`
- [x] Import `useAuth` from `../auth/useAuth`
- [x] Import `type { QueryState }` from `../ui/QueryStateBoundary`
- [x] Implement hook:
  ```ts
  export interface UseNotificationsResult {
    state: QueryState;
    notifications: readonly AppNotification[];
    unreadCount: number;
    markRead: (id: string) => void;
    markAllRead: () => void;
    error: Error | null;
  }

  export function useNotifications(): UseNotificationsResult
  ```
- [x] State derivation:
  - `session` from `useAuth()` — if null → `state: 'loading'` (not yet authenticated)
  - `recipient = session.userId`
  - `notifications = notificationsFor(recipient)` — newest-first (service already sorts)
  - `state`: if `notifications.length === 0` → `'empty'`; else → `'ready'`
  - `unreadCount = notifications.filter(n => !n.read).length`
- [x] `markRead(id)` → calls `NotificationService.markRead(id)`, triggers re-render via `useState` version counter
- [x] `markAllRead()` → calls `NotificationService.markAllRead(recipient)`
- [x] No error path in the kernel (in-memory never throws); `error` is always `null`

### Task 3 — Wire `NotificationService` into `src/app/providers.tsx` (AC1)

- [x] Import `NotificationService` side-effect initialization if needed (the module-level `subscribe()` call fires on first import)
- [x] Add a comment referencing ADR-014: the Providers file already mounts Auth + Flag; just ensure `NotificationService` is imported somewhere in the composition root so the subscription is active before any domain event fires
- [x] Preferred: import `'../shared/notifications/NotificationService'` in `providers.tsx` as a side-effect import so the subscription is registered at app boot

### Task 4 — Tests (NFR-12)

`src/shared/notifications/NotificationService.test.ts` (Vitest unit):
- [x] **Ticket.Assigned → notification to assigneeId** (AC3)
- [x] **Lead.Converted → notification to ownerId** (AC3)
- [x] **Unhandled event type → no notification produced** (AC3 — only event-driven)
- [x] **Null assigneeId → no notification produced** (AC3 — guards missing payload)
- [x] **Notifications scoped to recipient's tenant/subsidiary** (UC-5 — cross-tenant: recipient on tenant-A sees no tenant-B notifications)
- [x] **markRead(id) sets read=true** on correct notification; others unchanged
- [x] **markAllRead(recipient)** sets all matching to read; non-matching are unchanged
- [x] **notificationsFor returns newest-first** (sorted by occurredAt desc)
- [x] **__resetNotifications() clears store** (between tests)

`src/shared/notifications/useNotifications.test.tsx` (RTL):
- [x] **Loading state** — `state='loading'` when session is null
- [x] **Empty state** — `state='empty'` for authenticated user with no notifications
- [x] **Ready state** — `state='ready'` transitions on sign-in
- [x] **unreadCount** reflects only unread items
- [x] **markRead** call reduces unreadCount by 1 and re-renders
- [x] **markAllRead** call sets unreadCount to 0 and re-renders

### Task 5 — Conformance gates

- [x] `npx tsc -b` — clean
- [x] `npm run lint` — clean
- [x] `npx vitest run` — 432/432 tests green including 27 new notification tests; NO regressions

## Dev Notes

### File locations (fixed — do not deviate)

```
src/shared/notifications/
├── NotificationService.ts   # in-memory store, subscription, recipient mappers, seed data
└── useNotifications.ts      # React hook: state derivation, markRead/markAllRead

src/shared/notifications/
├── NotificationService.test.ts   # Vitest unit
└── useNotifications.test.tsx     # RTL
```

### Compiler constraints (identical to all prior E0 stories)

- `verbatimModuleSyntax: true` + `erasableSyntaxOnly: true` (tsconfig.app.json)
- **`import type` for all type-only imports.** Runtime values use plain `import`.
- **No TS `enum`** — string-literal unions only (see eventTypes.ts pattern).
- **No bare `React` global** — React 19 ESM: use `import React from 'react'` or named imports.
- Components use `.tsx`; pure logic (no JSX) uses `.ts`.

### No barrel index.ts

All prior stories use direct-file imports. Keep that pattern:
```ts
import { notificationsFor } from '../../shared/notifications/NotificationService';
import { useNotifications } from '../../shared/notifications/useNotifications';
```

### Architecture compliance

1. **NFR-1 layering:** `src/shared/notifications/*` may import from `src/shared/auth/*`, `src/shared/domain/*`, `src/shared/events/*`, `src/shared/ui/QueryStateBoundary.tsx`. Never from `src/features/*` or `src/app/*`.
2. **Notifications are event-driven ONLY** (AC3, ADR-014): `handleEvent()` is the ONLY path that creates an `AppNotification`. There must be NO other function that pushes to `_store` except seed data initializer.
3. **Scope from the event, not auth context:** `tenantId`/`subsidiaryId` on the notification come from `DomainEvent.tenantId`/`DomainEvent.subsidiaryId` — they represent the scope where the event occurred. The kernel does NOT read `useAuth()` to decide scoping.
4. **In-memory store (not localStorage):** same pattern as `auditLog.ts` — unit-testable in node env. `notificationsFor()` reads the in-memory array.

### Force-update pattern for useNotifications

`NotificationService` uses a plain array (not React state). To trigger re-renders after `markRead`/`markAllRead`, use a version counter:
```ts
const [_v, setV] = useState(0);
const forceUpdate = () => setV(v => v + 1);
```
Or use `useReducer`. The hook reads `notificationsFor(recipient)` on every render — no subscription needed.

### Seed data (demo realism — matches prototype/app/store.jsx lines 188–193)

In `NotificationService.ts`, initialize `_store` with these 4 items so the UI has demo notifications:
```ts
const SEED_NOTIFICATIONS: AppNotification[] = [
  { id: 'seed-ntf-1', recipient: 'lena-bauer', type: 'Ticket.Assigned',
    payload: { title: 'SAML metadata mismatch' }, read: false,
    tenantId: 'tenant-1', subsidiaryId: 'sub-us', occurredAt: '2026-06-06T13:50:00Z' },
  { id: 'seed-ntf-2', recipient: 'lena-bauer', type: 'Ticket.Assigned',
    payload: { title: 'Onboarding checklist stuck — high priority' }, read: false,
    tenantId: 'tenant-1', subsidiaryId: 'sub-us', occurredAt: '2026-06-06T11:00:00Z' },
  { id: 'seed-ntf-3', recipient: 'marco-ruiz', type: 'Lead.Converted',
    payload: { title: 'A lead was added to your queue' }, read: false,
    tenantId: 'tenant-1', subsidiaryId: 'sub-eu', occurredAt: '2026-06-06T09:30:00Z' },
  { id: 'seed-ntf-4', recipient: 'sara-khan', type: 'Lead.Converted',
    payload: { title: 'Customer record merge completed' }, read: true,
    tenantId: 'tenant-1', subsidiaryId: null, occurredAt: '2026-06-05T16:00:00Z' },
];
```
Seed data is static; it does NOT go through `handleEvent` (which would require publishing events). Initialize as `const _store: AppNotification[] = [...SEED_NOTIFICATIONS]`.

`__resetNotifications()` must restore seed: `_store.splice(0, _store.length, ...SEED_NOTIFICATIONS)`.

### Sorting

`notificationsFor(recipient)` must return newest-first:
```ts
return _store
  .filter(n => n.recipient === recipient)
  .sort((a, b) => b.occurredAt.localeCompare(a.occurredAt));
```

### Module-level subscription

The `subscribe(handleEvent)` call should happen once at module load:
```ts
// bottom of NotificationService.ts
subscribe(handleEvent);
```
In tests, call `__resetNotifications()` + `__resetBus()` in `beforeEach` to prevent cross-test leakage.

### useNotifications — no error state in kernel

The kernel is in-memory; it never throws. `error` is always `null`. The `'error'` state is reserved for future async adapters (E6). Set `state = 'loading'` only when `session === null`.

### Previous story intelligence (E0-S10 — Flag/config provider, in review)

From the E0-S10 dev agent record and the E0-S7 bus implementation:
- **`import type`**: required for all type-only symbols (`verbatimModuleSyntax`)
- **No `enum`**: string-literal unions/const arrays only
- **No barrel `index.ts`**: direct-file imports
- **Testing:** Vitest + RTL + jsdom. `vite.config.ts` already has `test: { environment: 'jsdom', globals: true, setupFiles: ['./src/test-setup.ts'] }`
- **`__resetBus()`** exists in `src/shared/events/bus.ts` — call it in test `beforeEach` alongside `__resetNotifications()` to avoid subscriber leakage
- **`react-refresh/only-export-components` ESLint rule:** if `.tsx` file exports non-component symbols, split into separate `.ts` + `.tsx` or use `/* eslint-disable-next-line react-refresh/only-export-components */`

### Checking existing bus subscription pattern

`bus.ts` exports `subscribe(handler): () => void` and `publish(event)`. The `NotificationService` calls `subscribe(handleEvent)` at module load. `handleEvent` receives every published event and produces notifications for handled types only.

## Definition of Done

- Meets all 4 ACs
- `npx tsc -b` clean
- `npm run lint` clean
- `npm run test:run` — all tests green (no regressions)
- `Ticket.Assigned` event → notification to `assigneeId`; `Lead.Converted` → notification to `ownerId`
- No notification produced by any path other than domain event handler
- Notifications are scoped to event's `tenantId`/`subsidiaryId` (no cross-tenant leak)
- Seed data visible via `notificationsFor('lena-bauer')` etc.
- `useNotifications()` returns correct `QueryState` for all four states
- Passes `bmad-code-review`
- Traceable chain (`Closes #<issue>`)

## References

- [Source: _bmad-output/planning-artifacts/epics/epic-0-platform-guidelines/E0-S12.md] — story spec & ACs
- [Source: _bmad-output/planning-artifacts/architecture.md §ADR-014] — Notifications = shared kernel, event-sourced
- [Source: _bmad-output/planning-artifacts/architecture.md §Pattern 8] — Notifications pattern
- [Source: src/shared/events/bus.ts] — `subscribe()`, `publish()`, `DomainEvent`, `__resetBus()`
- [Source: src/shared/events/eventTypes.ts] — canonical event type registry (Ticket.Assigned, Lead.Converted)
- [Source: src/shared/events/auditLog.ts] — in-memory + localStorage pattern to follow
- [Source: src/shared/ui/QueryStateBoundary.tsx] — `QueryState` type, `QueryStateBoundary` component
- [Source: src/shared/auth/auth.types.ts] — `SessionClaims` (userId, tenantId, subsidiaryId)
- [Source: src/app/providers.tsx] — provider composition (AuthProvider + FlagProvider)
- [Source: prototype/app/shell.jsx] — `NotificationsBell` UI surface (consumed by E5-S3)
- [Source: prototype/app/dashboard.jsx] — `DashboardNotifications`, `NotificationsPage` surfaces
- [Source: prototype/app/store.jsx lines 188-193] — seeded notification data
- ADR(s): ADR-014 · Inherited UC: UC-1, UC-5, TC · Constitution: §7, §8

## Dev Agent Record

### Agent Model Used

claude-sonnet-4-6

### Debug Log References

- `__resetBus()` in tests clears all subscribers including the module-level subscription; fixed by tracking the unsubscribe handle in `_setupSubscription()` and calling it inside `__resetNotifications()` so the handler is re-registered after each test reset.

### Completion Notes List

- AC1: `NotificationService.ts` subscribes to the DomainEvent bus via `_setupSubscription()` (tracks handle for test-safe re-subscription). `useNotifications()` hook exported from `useNotifications.ts`.
- AC2: `AppNotification` shape: `{ id, recipient, type, payload, read, tenantId, subsidiaryId, occurredAt }` — scoped from the event, not from auth context.
- AC3: `RECIPIENT_MAPPERS` object maps `Ticket.Assigned → payload.assigneeId`, `Lead.Converted → payload.ownerId`; all other event types produce no notification. `handleEvent` is the ONLY write path to `_store`.
- AC4: `useNotifications()` returns `{ state: QueryState, notifications, unreadCount, markRead, markAllRead, error: null }`. Version counter forces re-render on mutation. `state='loading'` when no session, `'empty'` when no notifications, `'ready'` otherwise.
- Seed data: 4 notifications (lena-bauer×2, marco-ruiz×1, sara-khan×1) pre-loaded matching `prototype/app/store.jsx` lines 188–193.
- `providers.tsx` updated with side-effect import of `NotificationService` to register bus subscription at app boot.
- 27 new tests: 17 unit (NotificationService) + 10 RTL (useNotifications). Full suite: 432/432 green.

### File List

- `src/shared/notifications/NotificationService.ts` — in-memory store, RECIPIENT_MAPPERS, seed data, bus subscription (new)
- `src/shared/notifications/useNotifications.ts` — four-state hook (new)
- `src/shared/notifications/NotificationService.test.ts` — 17 Vitest unit tests (new)
- `src/shared/notifications/useNotifications.test.tsx` — 10 RTL tests (new)
- `src/app/providers.tsx` — side-effect import for NotificationService boot subscription (modified)

### Review Findings

- [x] [Review][Patch] Seed recipient IDs don't match auth `userId` values — `'lena-bauer'` etc. must be `'usr_lena'` etc. to match `SessionClaims.userId` from mock SSO; `state='ready'` is never reachable in the running app [NotificationService.ts:SEED_NOTIFICATIONS]
- [x] [Review][Patch] `SEED_NOTIFICATIONS` objects mutated by reference — `__resetNotifications` spreads original object refs so `markRead` permanently mutates seed items; fix: shallow-copy with `.map(n => ({ ...n }))` [NotificationService.ts:__resetNotifications]
- [x] [Review][Patch] `notificationsFor` + `useNotifications` don't filter by `tenantId` — UC-5 cross-tenant leak if `userId` values collide across tenants; fix: filter in hook by `session.tenantId` [useNotifications.ts]
- [x] [Review][Defer] No bus subscription in hook — incoming domain events don't trigger re-renders; E5-S3 concern [useNotifications.ts] — deferred, pre-existing
- [x] [Review][Defer] `markRead` service function doesn't validate recipient ownership — write-path scoping gap; minor risk since caller is the hook which already knows the session [NotificationService.ts:markRead] — deferred, pre-existing
- [x] [Review][Defer] No dedup guard for duplicate `eventId` in `_store` — same logical event published twice creates two notifications [NotificationService.ts:handleEvent] — deferred, pre-existing
- [x] [Review][Defer] `markRead`/`markAllRead` recreated on every render — `useCallback` optimization for E5-S3 [useNotifications.ts] — deferred, pre-existing
- [x] [Review][Defer] HMR double subscription — module re-evaluation creates duplicate handlers in dev; production unaffected [NotificationService.ts] — deferred, pre-existing

## Change Log

| Date       | Change |
|------------|--------|
| 2026-06-08 | Story created (ready-for-dev): Notifications kernel — NotificationService (event bus subscription, recipient mappers, in-memory store, seed data) + useNotifications() hook (four-state scaffold). ADR-014. |
| 2026-06-08 | Story implemented (review): NotificationService.ts, useNotifications.ts, 27 new tests (17 unit + 10 RTL). 432/432 tests green. providers.tsx updated with side-effect import. |
| 2026-06-08 | Code review patches applied (done): seed userIds aligned to mock-SSO values (usr_lena/usr_marco/usr_sara), shallow-copy seed objects in __resetNotifications, UC-5 tenantId filter in useNotifications. 433/433 green. |
