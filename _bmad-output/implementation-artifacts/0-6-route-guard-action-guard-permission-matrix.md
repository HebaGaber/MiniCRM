---
baseline_commit: fe648a1
---

# Story 0.6: Route guard + action guard from the permission matrix (ADR-015 predicates)

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

- **Story ID:** E0-S6 (`0-6-route-guard-action-guard-permission-matrix`)
- **Epic:** E0 — Platform Guidelines & Standards (the governing contract) · **Feature:** 0.3 — Auth & RBAC Kernel
- **Cut:** Pilot · **Depends on:** E0-S5 (claims via `useAuth()` — `done`) · E0-S7 (event/audit bus for `Auth.RoleDenied` — `done`) · **ADRs:** ADR-009, ADR-015 · **Constitution:** §6, §6.2, §6.3
- **Unblocks:** **E0-S4** (`LocalStorageRepository`'s 4-beat *authorize* beat consumes `can()`/`authorize()`), and **every guarded screen + mutation in Epics 1–5** (no feature invents its own access logic). The cross-tenant isolation E2E (**E0-S11**) exercises the denial + out-of-tenant 404 paths this story ships.

## Story

As the platform,
I want two authorization gates — a **route guard** for screen access and an **action guard** for per-mutation access on a specific record — that both delegate to **one** `can()` predicate driven by a single data-encoded permission matrix with ADR-015 predicate semantics,
so that no feature invents its own access logic, **deny always wins**, and a record outside the caller's tenant is disclosed as `404`, never `403`.

## Acceptance Criteria

1. **AC1 — Two gates, one predicate.** A **route guard** decides screen access; an **action guard** decides per-mutation access on a specific record within the caller's tenant/subsidiary. Both delegate to one `can(actor, capability, action, resource)` predicate — neither gate re-implements access logic.
   *Files:* `src/shared/auth/guards.tsx`, `src/shared/auth/permissions.ts` · *Seam:* authZ guards · *Schema/Map:* Grant table.

2. **AC2 — Deny-wins, default deny.** Conflicting or absent grants resolve to **deny**: the default grant for any unlisted `(capability, role)` cell is `deny`, and an explicit `deny` in any of a multi-role actor's roles wins over another role's grant for that capability. (Among *non-deny* grants, multi-role resolves most-permissive per ADR-015 — see Reconciliation C.)
   *Files:* `src/shared/auth/permissions.ts` · *Seam:* `can()` predicate · *Schema/Map:* Grant table.

3. **AC3 — §2.2 matrix encoded as data, cell-tested.** The §2.2 permission matrix (as **amended** — DEC-CC-1) is encoded as a `Grant` table (`Capability × Role → Grant`) and unit-tested cell-by-cell. **Ticket `create` is `allow` for all four roles** (`tenant_admin`/`sales`/`support`/`viewer`) per **DEC-CC-1**, while ticket **edit/assign** stays `allow` for `tenant_admin`/`support` and `view` for `sales`/`viewer`. **Customer `create/edit`** is `allow` for `tenant_admin`/`sales`, `view` for `support`/`viewer` (C-2 kept).
   *Files:* `src/shared/auth/permissions.ts`, `src/shared/auth/permissions.test.ts` · *Seam:* `can()` predicate · *Schema/Map:* Grant table (incl. amended ticket-create row, DEC-CC-1).

4. **AC4 — Out-of-tenant → 404 (UC-5).** Access to a record outside the caller's tenant resolves to a **not-found** outcome (existence is never disclosed), not a role-denial; the action guard never reveals that an out-of-scope record exists. Subsidiary visibility follows ADR-002 (a subsidiary-pinned actor sees their own subsidiary + parent-level `null` records; `tenant_admin` with `subsidiaryId === null` rolls up the whole tenant).
   *Files:* `src/shared/auth/guards.tsx`, `src/shared/auth/permissions.ts` · *Seam:* authZ guards · *Schema/Map:* n/a.

5. **AC5 — Denied action audited (UC-2).** A denied in-tenant action emits **exactly one** `Auth.RoleDenied` `DomainEvent` and **exactly one** `AuditEvent`, sharing **one** `correlationId` (UC-2). A `granted` or a `notFound` (out-of-scope) outcome emits **nothing**.
   *Files:* `src/shared/auth/permissions.ts` (+ imports `shared/events/bus.ts`, `shared/events/auditLog.ts`, `shared/events/correlation.ts`) · *Seam:* `can()` + event/audit bus · *Schema/Map:* `Auth.RoleDenied`.

6. **AC6 — ADR-015 predicate model (DELTA).** Encode predicates: `Grant ∈ allow | deny | view | own | restricted`.
   - `view` ⇒ read actions only; **any** mutation is `false`.
   - `own` ⇒ `isOwned(actor, resource)` = (`resource.ownerId | resource.assigneeId | resource.actorId === actor.userId`).
   - `restricted` ⇒ `isOwned(actor, resource) AND action ∈ RESTRICTED_SAFE` where `RESTRICTED_SAFE = { softDelete, export }`.
   - **Hard-delete is NEVER granted by `restricted`** — it is `tenant_admin`-only (whose cell is `allow`). Concretely: "View audit/events" → `own` (sales/support), `allow` (tenant_admin), `deny` (viewer); "Delete(soft)/export" → `restricted` (sales/support), `allow` (tenant_admin), `deny` (viewer).
   *Files:* `src/shared/auth/permissions.ts`, `src/shared/auth/permissions.test.ts` · *Seam:* `can()` predicate · *Schema/Map:* Grant table + predicates.

## Inherited Universal Conformance (subset)

- **UC-2 — Dual events, one correlationId.** A denial emits `Auth.RoleDenied` on both streams with a shared `correlationId`; prove it with the E0-S7 conformance helper `expectOneOpOneEventOneAudit`.
- **UC-5 — Tenant scope, out-of-tenant → 404.** Cross-tenant access is disclosed as a not-found outcome, never `403`.
- **TC — Traceability.** story → spec → code → test → `Closes #`; preview green; `sprint-status.yaml`; passes `bmad-code-review`.

## Tasks / Subtasks

- [x] **Task 1 — `permissions.ts`: types, the Grant table, and the pure predicates** (AC: 1, 2, 3, 6)
  - [x] Create the **new** file `src/shared/auth/permissions.ts`. Define `Grant = "allow" | "deny" | "view" | "own" | "restricted"` and the `Capability`/`Action` string-literal unions (no TS `enum` — `erasableSyntaxOnly` is on; mirror the const-map-not-enum pattern in [eventTypes.ts](../../src/shared/events/eventTypes.ts) and [types.ts](../../src/shared/domain/types.ts#L43)).
  - [x] Encode the **§2.2 matrix as data**: `MATRIX: Record<Capability, Partial<Record<Role, Grant>>>`. Use the **capability rows + grants table in Dev Notes** verbatim. A cell that is absent (no entry) is the **default deny** (AC2) — do **not** write `deny` into every empty cell; absence *is* deny, and the resolver treats `undefined` as the default.
  - [x] `RESTRICTED_SAFE = new Set<Action>(["softDelete", "export"])` — hard-delete is intentionally NOT in here (AC6).
  - [x] `isReadAction(action): boolean` — `true` only for the read action(s) (see the `Action` union in Dev Notes); every other action is a mutation.
  - [x] `isOwned(actor, resource): boolean` — `resource.ownerId === actor.userId || resource.assigneeId === actor.userId || resource.actorId === actor.userId` (ADR-015). Guard against `undefined` fields so a resource missing all three ownership keys is **not** owned.
  - [x] `can(actor, capability, action, resource): boolean` — the **single pure predicate** (no side effects — it is cell-tested in isolation). Resolve the cell grant per role via `Object.hasOwn(MATRIX[capability] ?? {}, role)` (NOT `in`/bracket access — inherited prototype keys must MISS the map; mirror [status.ts:97](../../src/shared/domain/status.ts#L97) and [AuthProvider.tsx:89](../../src/shared/auth/AuthProvider.tsx#L89)). Multi-role resolution (Reconciliation C): explicit `deny` in any role → `false` (deny-wins); otherwise permit if **any** non-deny grant evaluates `true` (most-permissive). All-absent → `false` (default deny).
  - [x] `actor` type = the canonical `SessionClaims` from [auth.types.ts](../../src/shared/auth/auth.types.ts) — **do not redefine** the claims shape. `resource` type = the ADR-015 `OwnedResource` (see Dev Notes): scope fields (`tenantId`, `subsidiaryId`) + optional ownership fields (`ownerId`, `assigneeId`, `actorId`) + optional `id`/`entityType` for the denial audit reference.

- [x] **Task 2 — `permissions.ts`: scope + outcome + the audited gate** (AC: 2, 4, 5)
  - [x] `isInScope(actor, resource): boolean` — `false` (→ notFound) when `resource.tenantId !== actor.tenantId` (the hard boundary, AC4). Within the tenant, apply ADR-002 subsidiary visibility: `actor.subsidiaryId === null` (tenant_admin roll-up) sees everything; a pinned actor sees `resource.subsidiaryId === actor.subsidiaryId || resource.subsidiaryId === null`. A sibling-subsidiary record is out-of-scope → notFound (existence not disclosed within the tenant either).
  - [x] `resolveOutcome(actor, capability, action, resource): AuthZOutcome` — **pure, no emission**. `"notFound"` if `!isInScope`; else `"granted"` if `can(...)`; else `"denied"`. (`AuthZOutcome = "granted" | "denied" | "notFound"`.) This is what the **UI guards** call to render (no side effects during render).
  - [x] `authorize(actor, capability, action, resource): AuthZOutcome` — the **audited gate** (the one consumed by E0-S4's 4-beat *authorize* beat): call `resolveOutcome`; if `"denied"`, emit `Auth.RoleDenied` (Task 3); return the outcome. `"granted"`/`"notFound"` emit nothing (AC5). **Out-of-tenant does NOT emit `Auth.RoleDenied`** — it is a not-found, not a role denial (AC4 vs AC5).
  - [x] Export `can`, `isOwned`, `isReadAction`, `isInScope`, `resolveOutcome`, `authorize`, `MATRIX`, `RESTRICTED_SAFE`, and the `Capability`/`Action`/`Grant`/`OwnedResource`/`AuthZOutcome` types.

- [x] **Task 3 — `Auth.RoleDenied` emission (dual streams, one correlationId)** (AC: 5)
  - [x] Add an internal `emitRoleDenied(actor, capability, action, resource)` helper that **copies the E0-S5 reference emission pattern verbatim**: mint `const correlationId = newCorrelationId()`; **`append()` the `AuditEvent` FIRST, THEN `publish()` the `DomainEvent`** (append-before-publish — see [AuthProvider.tsx:141-165](../../src/shared/auth/AuthProvider.tsx#L141) and its rationale: a throwing subscriber makes `publish` raise *after* delivery, so writing the audit first guarantees both records exist; this is the documented pattern consuming stories copy). Do **not** export a duplicate generic emitter — `emitAuthEvent` in `AuthProvider.tsx` is module-private; copy the shape here (AC5 lists `permissions.ts` as the toucher).
  - [x] **DomainEvent** (`bus.ts` shape): `{ eventId: crypto.randomUUID(), type: "Auth.RoleDenied", tenantId: actor.tenantId, subsidiaryId: actor.subsidiaryId, actorId: actor.userId, occurredAt: new Date().toISOString(), payload: { capability, action }, correlationId }`. `"Auth.RoleDenied"` already exists in the canonical [eventTypes.ts](../../src/shared/events/eventTypes.ts#L43) registry — use it verbatim (`bus.publish` throws on a free-form name; that is the guard).
  - [x] **AuditEvent** (`auditLog.ts` shape): `{ id: crypto.randomUUID(), tenantId, subsidiaryId, actorId, action: "auth.role_denied", entityType: resource.entityType ?? "Authorization", entityId: resource.id ?? actor.userId, occurredAt, correlationId }`. Remember `AuditEvent.action` is a **lowercase dotted verb** (`"auth.role_denied"`) while `DomainEvent.type` is the PascalCase registry name (`"Auth.RoleDenied"`) — different fields by design (E0-S7 Reconciliation 2; E0-S5 Reconciliation B). `eventId`/audit-`id` are bare `crypto.randomUUID()` (infra-stream ids, not entity ids — mirrors [correlation.ts](../../src/shared/events/correlation.ts) and E0-S5).

- [x] **Task 4 — `guards.tsx`: the two React gates** (AC: 1, 4)
  - [x] Create the **new** file `src/shared/auth/guards.tsx`. Both gates read claims via `useAuth()` (never props) and delegate to the pure `permissions.ts` predicates — **no access logic in the components**.
  - [x] **`<RouteGuard capability fallback?>`** — screen gate. Unauthenticated (`!isAuthenticated`/`session === null`) → render `fallback` (blocked). Authenticated → allowed iff the capability is *openable* for the role (any non-deny grant; a `view`/`own` screen grant still opens the screen — row-level filtering happens downstream). Implement openability as `can(session, capability, "read", selfResource)` where `selfResource` is a synthetic in-own-scope, self-owned resource (so `own` cells resolve true for the owner) — this keeps **one** predicate (AC1) rather than a second code path. Render `children` when allowed, else `fallback`.
  - [x] **`<ActionGuard capability action resource>`** — per-record mutation gate, **render-prop**: `children: (allowed: boolean) => ReactNode`. Compute `resolveOutcome(session, capability, action, resource)`; `allowed = outcome === "granted"`. A `denied` OR `notFound` outcome → `allowed === false` (a control on an out-of-scope record is simply disabled — the 404/existence-non-disclosure is enforced at the data layer / `authorize`, AC4). Unauthenticated → `allowed === false`.
  - [x] **Render purity:** the UI guards do **NOT** emit `Auth.RoleDenied` (no side effects during render — emitting in render would double-fire under React 19 StrictMode, exactly the trap [AuthProvider.tsx:179](../../src/shared/auth/AuthProvider.tsx#L179) documents). The **authoritative audited denial is `authorize()`**, fired when a mutation is actually attempted (E0-S4's authorize beat). The client gates are a UX convenience (ADR-009: "the client copy is demoted to a UX convenience"); they decide visibility/enablement only.
  - [x] If a `createContext()` is needed (it is not for this design — the gates are self-contained), put it in a sibling `*.ts` module, not `guards.tsx`, to keep `react-refresh/only-export-components` happy (mirrors why [authContext.ts](../../src/shared/auth/authContext.ts) is split out).

- [x] **Task 5 — Tests (NFR-12)** (AC: 1–6)
  - [x] **`permissions.test.ts`** (node env — pure functions, no DOM; this file is `.test.ts`, NOT `.tsx`): the **cell-by-cell matrix test** — enumerate **every** `(capability, role)` cell and assert the predicate outcome against fixtures (owned vs not-owned, read vs mutate, soft vs hard delete). Concretely assert:
    - **Default deny:** an unlisted `(capability, role)` cell → `can(...) === false`.
    - **`view`:** read → `true`, any mutation (`create`/`edit`/etc.) → `false`.
    - **`own`:** owned resource → `true`, not-owned → `false`.
    - **`restricted`:** owned + `softDelete`/`export` → `true`; owned + `hardDelete` → **`false`** (hard-delete denied for sales/support); not-owned + `softDelete` → `false`.
    - **Hard-delete is `tenant_admin`-only:** `can(admin, "record.deleteExport", "hardDelete", res) === true`; for sales/support/viewer → `false`.
    - **DEC-CC-1 ticket create = allow for ALL FOUR roles** (`tenant_admin`/`sales`/`support`/`viewer`); ticket **edit/assign** = `allow` admin/support, `view` (mutation → false) for sales/viewer.
    - **Customer create/edit (C-2):** `allow` for `tenant_admin`/`sales`; `view` (→ false on mutate) for `support`/`viewer`.
    - **"View audit/events":** `own` for sales/support, `allow` for tenant_admin, `deny` for viewer.
    - **Multi-role (Reconciliation C):** an actor with `[sales, viewer]` → most-permissive among non-deny; an actor whose roles include a cell with explicit `deny` → denied (deny-wins).
  - [x] **`permissions.test.ts` — scope + audit:** `isInScope`/`resolveOutcome` return `"notFound"` for a cross-tenant resource and for a sibling-subsidiary resource (pinned actor); `tenant_admin` (subsidiaryId null) is in-scope for any tenant subsidiary; parent-level (`subsidiaryId: null`) resource is in-scope for a pinned actor (AC4). Use `expectOneOpOneEventOneAudit` (import from [conformance.ts](../../src/shared/events/conformance.ts)) to prove `authorize(...)` on a **denied** action emits exactly 1 `Auth.RoleDenied` + 1 audit (`action: "auth.role_denied"`) on a shared `correlationId` (AC5); and assert `authorize` on a **granted** and on a **notFound** outcome emits **nothing** (capture via `recordEmissions` and assert `events.length === 0 && audits.length === 0`). Call `__resetBus()`/`__resetAuditLog()` in `beforeEach`.
  - [x] **`guards.test.tsx`** (**jsdom** — add `// @vitest-environment jsdom` docblock at the top, exactly like [AuthProvider.test.tsx:1](../../src/shared/auth/AuthProvider.test.tsx#L1); do NOT flip the global env): render `<RouteGuard>` inside `<AuthProvider>` and prove it **renders** the screen for an allowed role and **blocks** (renders fallback) for a denied role (AC1 route-guard RTL). Render `<ActionGuard>` and prove the mutation control is **permitted on an owned record** and **disabled on a not-owned record** for an `own`/`restricted` role (AC1 action-guard RTL). Drive role via `useAuth().signIn(...)` (use `act`).
  - [x] `npx tsc -b` clean; `npm run lint` clean; **all existing tests still green** (no regression to the current suite) + the new specs pass. Confirm `.tsx` compiles under the app tsconfig.

- [x] **Task 6 — Conformance gates + DoD self-check** (AC: all)
  - [x] `npx tsc -b`, `npm run lint` (`eslint .`), and the test run all green.
  - [x] Self-check against DoD (§10): note which items apply (uses the shared auth/event modules — no duplication; statuses N/A; **one audit + one domain event per denial** §7; `can()` is the single access predicate) vs N/A (no Repository wiring — E0-S4; no four-state data view — these are guards/predicates, not a data screen; the login/blocked *screen* UI polish is the E0-S9-era shell concern).

## Review Findings

> `bmad-code-review` (2026-06-08) — adversarial layers: Blind Hunter (diff-only) + Edge Case Hunter (diff + repo) + Acceptance Auditor (diff + spec + constitution/ADRs). **Acceptance Auditor: NO AC violations — AC1–AC6 fully met, MATRIX matches §6.2+DEC-CC-1 cell-by-cell, dual-stream `Auth.RoleDenied` + 404-not-403 correct.** No blocking / HIGH findings. Gates green after fixes: `tsc -b` clean · `eslint` clean · `vitest` **249/249**. Triage: **0 decision-needed, 3 patch (applied), 2 defer, 4 dismissed.**

- [x] [Review][Patch] **`ActionGuard` notFound→disabled path was untested** [src/shared/auth/guards.test.tsx] — the gate collapses `denied` and `notFound` to a disabled control, but every ActionGuard spec used an in-scope resource, so the security-relevant non-disclosure branch (out-of-scope record → disabled, never revealing existence — AC4) was unproven. **Fixed:** added an RTL spec rendering `<ActionGuard>` with an owned-but-cross-tenant resource and asserting the control is disabled.
- [x] [Review][Patch] **`RouteGuard` docstring claimed "any non-deny grant opens" but a `restricted` cell resolves closed** [src/shared/auth/guards.tsx] — `can(read)` returns false for `restricted` (`read ∉ RESTRICTED_SAFE`), contradicting the doc's enumeration. Behavior is correct for every real route capability (route rows carry only `allow`/`view`/`own`/`deny`; `restricted` is a per-record action grant on `record.deleteExport`, never a screen). **Fixed:** rewrote the docstring to state the precise screen-grant semantics and explain why `restricted` is intentionally not a route grant — zero behavioral change.
- [x] [Review][Patch] **Empty `roles: []` and `assigneeId: null` boundaries unlocked by tests** [src/shared/auth/permissions.test.ts] — both are handled correctly (default deny; `null` never equals a userId) but had no fixture. **Fixed:** added a no-roles actor → denies everything spec and an `assigneeId: null` → not-owned assertion (the realistic unassigned-ticket shape).
- [x] [Review][Defer] **Session `exp` expiry is never validated by the gates/predicates** [src/shared/auth/permissions.ts] — deferred: pre-existing and already tracked. `isAuthenticated`/`session` come from the E0-S5 kernel, where `exp` is a static far-future mock constant; real expiry handling is the OIDC swap's job (Epic 6). Already logged in `deferred-work.md` from the E0-S5 review — not re-litigated here.
- [x] [Review][Defer] **`authorize()` propagates a subscriber `AggregateError` instead of returning the outcome** [src/shared/auth/permissions.ts] — deferred: matches the ratified E0-S5 reference emission pattern (append-before-publish guarantees the audit record exists; a throwing subscriber is an exceptional fault the bus contract deliberately surfaces rather than swallows — E0-S7). No `Auth.RoleDenied` subscribers exist in the pilot. Harden (clone/freeze/isolate handler faults) when event handlers are no longer fully trusted — same call as the E0-S7 bus deferred item.

**Dismissed (4, noise/false-positive/spec-justified):** `isInScope` null-subsidiary roll-up "keyed on claim not role" (it IS the ADR-002-ratified roll-up signal — `subsidiaryId` is the scoping key by design; the mock only issues `null` to `tenant_admin`) · `crypto.randomUUID` secure-context (repo-wide accepted risk, `deferred-work.md` from E0-S2; consistent with `correlation.ts`/`AuthProvider`) · `isOwned` matches on `undefined === undefined` (type-guaranteed: `SessionClaims.userId` is non-optional and always minted) · prototype-key test doesn't truly lock the row-level `Object.hasOwn` guard (the guard is correct in code; the test still proves the user-facing default-deny outcome — contorting it adds no real coverage).

## Dev Notes

### What this story IS (and is NOT)

**IS:** the **two-gate authZ kernel** (ADR-009 §6.3, ADR-015) — a single data-encoded permission `MATRIX` (`Capability × Role → Grant`), the pure `can()` predicate with the five-grant predicate model (`allow`/`deny`/`view`/`own`/`restricted`), the tenant/subsidiary scope check that yields the 404-not-403 outcome, the audited `authorize()` gate that emits `Auth.RoleDenied`, and the two React gates (`<RouteGuard>`, `<ActionGuard>`) that consume the predicate. This is the **single source of access logic** for the whole app.

**IS NOT:**
- **The repository / 4-beat wiring** — that's **E0-S4**. This story ships `can()`/`authorize()`; E0-S4's *authorize* beat calls `authorize()` on every mutation. Here the predicate is produced and tested, not yet wired into persistence.
- **The login / blocked-screen UI polish** — the prototype's pixel-perfect blocked/empty states and the shared UI inventory (`EmptyState`, `ErrorState`, tokens) land with the **E0-S9-era shell**. `<RouteGuard>`'s `fallback` is a minimal placeholder here (a later story supplies the designed blocked state per §8.5 "deny-wins, felt gracefully"). Mount/route wiring is also a later shell concern (`<RouteGuard>` is not yet placed in a router — mirrors E0-S5's provider not being mounted).
- **A server-side trust boundary** — the pilot gates run client-side (ADR-009 "acceptable only because auth is mocked"; the real gate is Epic 6 / E6-S1, design-only). The E0-S11 cross-tenant E2E asserts 0 leaks against this logical isolation.

### 🚨 Source of truth + reconciliations (constitution wins)

`_bmad-output/project-context.md` **§6.2** (permission matrix, as amended by **DEC-CC-1**) and **§6.3** (two gates, 404-not-403) are canonical; **ADR-015** (architecture.md) ratifies the predicate model. As with E0-S2/S3/S5/S7, the constitution wins over prototype/epic drift unless a `decision-log.md` entry says otherwise.

- **🚨 Reconciliation A — `AuditEvent.action` vs `DomainEvent.type` (carried from E0-S5/S7).** Audit uses a lowercase dotted verb (`"auth.role_denied"`); the domain event uses the PascalCase registry name (`"Auth.RoleDenied"`). Different fields, different conventions — don't unify. [Source: project-context.md §7.1/§7.2; 0-7 Reconciliation 2; 0-5 Reconciliation B]
- **🚨 Reconciliation B — copy the reference emission pattern, don't share a private one.** E0-S5's `emitAuthEvent` is **module-private** in `AuthProvider.tsx` (not exported), and AC5 lists `permissions.ts` as the emission toucher. So **copy** the append-before-publish shape into `permissions.ts` (E0-S5 explicitly documents this as "the reference emission pattern consuming stories copy"). Do **not** refactor/export `emitAuthEvent` out of the `done` E0-S5 (that would modify a shipped story for no AC). [Source: AuthProvider.tsx:141-165; 0-5 AC3]
- **🚨 Reconciliation C — multi-role resolution (AC2 ⊕ ADR-015).** AC2 says "conflicting or absent grants resolve to deny"; ADR-015 says "most-permissive across roles." Reconcile: **explicit `deny` in any role wins** (AC2 conflict → deny); **absence is default-deny** (not a conflicting deny); among the **non-deny** grants, permit if **any** evaluates true (ADR-015 most-permissive). In the pilot every session is **single-role** (`roles: [role]` — see [AuthProvider.tsx:96-102](../../src/shared/auth/AuthProvider.tsx#L96)), so this only matters if multi-role claims ever appear; implement it correctly anyway and test both branches. ADR-015's illustrative `actor.roles[0]` is the single-role degenerate case. [Source: E0-S6 AC2; architecture.md ADR-015 "Multi-role resolution"]

### 🚨 The §2.2 permission matrix as a Grant table (encode this verbatim)

Capabilities are the §2.2 rows (amended by DEC-CC-1) plus the AC6 delta rows. **Absent cell = default deny — leave it out of the table, don't write `"deny"`.** Explicit `"deny"` is used only where the matrix shows a hard `—` you want to assert as an *explicit* deny (viewer audit). Either is fine for correctness (resolver treats absent as deny); prefer explicit `deny` only for the viewer audit cell so the intent reads clearly.

| `Capability` (suggested key) | §2.2 row | tenant_admin | sales | support | viewer |
|---|---|---|---|---|---|
| `tenant.manage` | Manage tenant/subsidiaries, users | `allow` | — (deny) | — (deny) | — (deny) |
| `lead.manage` | Leads: create/edit/convert | `allow` | `allow` | — (deny) | `view` |
| `customer.manage` | Customers: create/edit (C-2) | `allow` | `allow` | `view` | `view` |
| `ticket.create` | Tickets: **create** (DEC-CC-1) | `allow` | `allow` | `allow` | `allow` |
| `ticket.manage` | Tickets: edit/assign | `allow` | `view` | `allow` | `view` |
| `audit.view` | View audit/events | `allow` | `own` | `own` | `deny` |
| `record.deleteExport` | Delete(soft)/export + hard-delete | `allow` | `restricted` | `restricted` | `deny` |

**Why one `record.deleteExport` capability covers hard-delete too (AC6):** with `tenant_admin = allow`, `can(admin, "record.deleteExport", "hardDelete", res)` → `allow` → `true` (admin *can* hard-delete — §2.1 "hard delete only via an explicit admin action"). With sales/support = `restricted`, `hardDelete ∉ RESTRICTED_SAFE` → `false` (denied), while `softDelete`/`export` on an **owned** record → `true`. viewer = `deny` → `false`. This satisfies both "hard-delete is denied for all roles incl. sales/support" **and** "hard-delete is tenant_admin only" with no extra row. Document this in a code comment.

### `Action` union (suggested)

```ts
type Action =
  | "read"        // the ONE read action — isReadAction() true only for this
  | "create" | "edit" | "convert" | "assign" | "transition"
  | "softDelete" | "hardDelete" | "export";
```
`RESTRICTED_SAFE = new Set<Action>(["softDelete", "export"])`. `isReadAction(a) => a === "read"`.

### `OwnedResource` / actor types (ADR-015)

```ts
import type { SessionClaims } from "./auth.types";   // the actor — DO NOT redefine claims
import type { ID } from "../domain/types";

// ADR-015 OwnedResource, enriched with scope (for the 404 check) + identity (for the audit ref).
export interface OwnedResource {
  tenantId: ID;                 // hard boundary (AC4 / isInScope)
  subsidiaryId: ID | null;      // ADR-002 visibility
  ownerId?: ID;                 // leads/customers they own
  assigneeId?: ID | null;       // tickets assigned to them
  actorId?: ID;                 // audit/domain records they produced
  id?: ID;                      // audit entityId on a denial (optional)
  entityType?: string;          // audit entityType on a denial (optional)
}
```
A real `BaseEntity` (lead/customer/ticket) structurally satisfies this (it has `tenantId`/`subsidiaryId`/`id`); pass it straight in. Tests pass minimal fixtures.

### Reference predicate (ADR-015 — adapt, keep `can` pure)

```ts
function evalGrant(grant, actor, action, resource): boolean {
  switch (grant) {
    case "allow":      return true;
    case "view":       return isReadAction(action);
    case "own":        return isOwned(actor, resource);
    case "restricted": return isOwned(actor, resource) && RESTRICTED_SAFE.has(action);
    default:           return false; // "deny"
  }
}
// can(): deny-wins + most-permissive (Reconciliation C), Object.hasOwn cell lookup, default deny.
```

### Existing code this story reads (do NOT modify — all `done`/`review`)

- [auth.types.ts](../../src/shared/auth/auth.types.ts) — `SessionClaims { userId, tenantId, subsidiaryId|null, roles: Role[], exp }`. The **actor** type. `useAuth()` returns `{ session, isAuthenticated, signIn, signOut }`.
- [useAuth.ts](../../src/shared/auth/useAuth.ts) — throws outside `<AuthProvider>`; guards consume `session`.
- [AuthProvider.tsx](../../src/shared/auth/AuthProvider.tsx) — the **reference emission pattern** (append-before-publish, `Object.hasOwn` lookup, single-role claims). Copy the emission shape; do not edit this file.
- [status.ts](../../src/shared/domain/status.ts#L21) — `Role = "tenant_admin" | "sales" | "support" | "viewer"` (the single source; import the type, don't redefine).
- [bus.ts](../../src/shared/events/bus.ts) — `publish(DomainEvent)`; throws on a non-canonical `type`. [auditLog.ts](../../src/shared/events/auditLog.ts) — `append(AuditEvent)`. [correlation.ts](../../src/shared/events/correlation.ts) — `newCorrelationId()`. [eventTypes.ts](../../src/shared/events/eventTypes.ts#L43) — `"Auth.RoleDenied"` is already registered.
- [conformance.ts](../../src/shared/events/conformance.ts) — `expectOneOpOneEventOneAudit` / `recordEmissions` for the AC5 test. `__resetBus`/`__resetAuditLog` for `beforeEach`.

### Previous-story intelligence (E0-S5, E0-S7)

- **RTL is already wired** (E0-S5): `@testing-library/react`, `@testing-library/dom`, `jsdom` are devDependencies; vitest `include` is `src/**/*.test.{ts,tsx}`; the global env stays `node` and RTL specs opt into jsdom via a **per-file** `// @vitest-environment jsdom` docblock. Reuse this exactly — do **not** flip the global env, do **not** add deps.
- **`Object.hasOwn` for all map lookups** (E0-S5 review Patch + status.ts): `signIn("constructor")` minted a bogus session with `in`/bracket access. Your `MATRIX[capability]?.[role]` lookup has the same trap — use `Object.hasOwn` so inherited keys miss. Add a regression test (a bogus capability/role string is default-denied).
- **Append-before-publish is non-negotiable** (E0-S5 review Decision→Patch): `publish` re-raises an `AggregateError` *after* delivering to subscribers, so a publish-first order can leave a `DomainEvent` with no matching `AuditEvent`. Append first.
- **`crypto.randomUUID()` secure-context caveat** is a repo-wide accepted risk (deferred-work.md) — bare global, no polyfill; consistent with E0-S5/correlation.ts. Do not re-litigate.

### Folder / naming (§9)

`src/shared/auth/permissions.ts`, `src/shared/auth/permissions.test.ts`, `src/shared/auth/guards.tsx`, `src/shared/auth/guards.test.tsx`. Components `PascalCase` (`RouteGuard`, `ActionGuard`); the shared-layer module imports siblings (`domain/`, `events/`, `auth/`) only — **never** `src/features/*` (NFR-1), and never the reverse.

### References

- [Source: _bmad-output/planning-artifacts/epics/epic-0-platform-guidelines/E0-S6.md] — the epic story + ACs + test requirements.
- [Source: _bmad-output/project-context.md#6.2] — roles & permission matrix; DEC-CC-1 (ticket create = all roles).
- [Source: _bmad-output/project-context.md#6.3] — enforcement: two gates, 404-not-403, audited auth events.
- [Source: _bmad-output/planning-artifacts/architecture.md] — ADR-009 (two gates, deny-wins, 404-not-403) + ADR-015 (`Grant`/`isOwned`/`can` predicate model, `RESTRICTED_SAFE`, multi-role most-permissive).
- [Source: _bmad-output/implementation-artifacts/0-5-authprovider-useauth-mock-sso.md] — claims shape, reference emission pattern, RTL harness.

## Dev Agent Record

### Agent Model Used

claude-opus-4-8 (1M context)

### Debug Log References

- `npx tsc -b` → clean. `npm run lint` (`eslint .`) → clean. `npx vitest run` → **247/247 passing** (162 pre-existing + 85 new: 78 in `permissions.test.ts`, 7 in `guards.test.tsx`). No regressions.
- One green-phase fix: RTL renders accumulated in `document.body` across the guard specs (vitest config has no `globals: true`, so RTL auto-cleanup isn't registered) → duplicate `data-testid` collisions. Resolved by an explicit `afterEach(cleanup)` in `guards.test.tsx` (documented inline).

### Completion Notes List

- **AC1 — two gates, one predicate.** `<RouteGuard>` (screen) and `<ActionGuard>` (per-record mutation) in `guards.tsx` both read claims via `useAuth()` and delegate to the single `can()` / `resolveOutcome()` predicate in `permissions.ts`. The components hold no access logic.
- **AC2 — deny-wins, default deny.** `can()` resolves the actor's roles against `MATRIX`: an explicit `"deny"` in any role wins; an absent cell is default-deny (`Object.hasOwn` lookup so inherited prototype keys miss); among non-deny grants, most-permissive wins (Reconciliation C — reconciles AC2 with ADR-015's multi-role rule). Pilot sessions are single-role, so this degenerates to one cell lookup but is implemented + tested for both branches.
- **AC3 — §2.2 matrix as data, cell-tested.** `MATRIX` encodes the §2.2 rows amended by DEC-CC-1; `permissions.test.ts` enumerates **every** `(capability, role)` cell against an independent expectation oracle (asserts MATRIX encodes §2.2) and against `can()` behavior (owned/not-owned, read/mutate, soft/hard-delete). DEC-CC-1 ticket-create = allow for all four roles; ticket edit/assign denied to sales/viewer (view); customer create/edit allow tenant_admin/sales, view support/viewer (C-2).
- **AC4 — out-of-tenant → notFound, never 403.** `isInScope()` makes `tenantId` the hard boundary (cross-tenant → notFound) and applies ADR-002 subsidiary visibility (admin roll-up; pinned sees own-sub + parent-level `null`; sibling-sub → notFound). `resolveOutcome()` returns notFound before any role check, so a denial never discloses an out-of-scope record's existence; `authorize()` emits no `Auth.RoleDenied` on notFound.
- **AC5 — denied action audited (UC-2).** `authorize()` emits exactly one `Auth.RoleDenied` `DomainEvent` + one `AuditEvent` (`action: "auth.role_denied"`) on one `correlationId`, copying the E0-S5 append-before-publish reference pattern. Proven with the E0-S7 `expectOneOpOneEventOneAudit` helper; granted/notFound outcomes emit nothing (asserted via `recordEmissions`).
- **AC6 — ADR-015 predicate model.** `Grant ∈ allow|deny|view|own|restricted`; `view` = read-only; `own` = `isOwned`; `restricted` = `isOwned && action ∈ {softDelete, export}`. Hard-delete is never in `RESTRICTED_SAFE` (denied for sales/support) and is permitted only by tenant_admin's `allow` cell (§2.1) — covered by one `record.deleteExport` row, with the rationale documented in code.
- **Scope boundaries honored:** the UI gates are a pure client-side UX convenience (ADR-009) and emit nothing during render (React 19 StrictMode double-fire trap avoided); the authoritative audited denial is `authorize()`, wired into mutations by E0-S4. No Repository wiring, no router mount, no designed blocked-screen UI (E0-S9-era) — consistent with the story scope. No deps added; RTL/jsdom harness reused from E0-S5 (global env stays `node`, guard spec opts into jsdom per-file).

### File List

- `src/shared/auth/permissions.ts` (new) — Grant table (`MATRIX`), `Capability`/`Action`/`Grant`/`OwnedResource`/`AuthZOutcome` types, `RESTRICTED_SAFE`, pure predicates (`can`, `isOwned`, `isReadAction`, `isInScope`, `resolveOutcome`), and the audited `authorize()` gate emitting `Auth.RoleDenied`.
- `src/shared/auth/permissions.test.ts` (new) — cell-by-cell matrix oracle + predicate semantics + scope + denial-audit specs (node env, 78 tests).
- `src/shared/auth/guards.tsx` (new) — `<RouteGuard>` (screen gate) + `<ActionGuard>` (per-record render-prop gate).
- `src/shared/auth/guards.test.tsx` (new) — RTL specs for both gates (jsdom per-file, 7 tests).
- `_bmad-output/implementation-artifacts/0-6-route-guard-action-guard-permission-matrix.md` (story doc — Tasks checked, Dev Agent Record, Status → review).
- `_bmad-output/implementation-artifacts/sprint-status.yaml` (status transitions: ready-for-dev → in-progress → review).

### Change Log

- 2026-06-08 — E0-S6 implemented: two-gate authZ kernel (route + action guards) over the ADR-015 data-encoded permission matrix; `Auth.RoleDenied` dual-stream audit; out-of-tenant → 404. tsc/eslint clean; 247/247 tests pass. Status → review.
