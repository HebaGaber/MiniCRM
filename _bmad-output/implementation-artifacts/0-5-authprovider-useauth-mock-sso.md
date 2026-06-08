---
baseline_commit: 257050d
---

# Story 0.5: AuthProvider + useAuth() + mock SSO

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

- **Story ID:** E0-S5 (`0-5-authprovider-useauth-mock-sso`)
- **Epic:** E0 — Platform Guidelines & Standards (the governing contract) · **Feature:** 0.3 — Auth & RBAC Kernel
- **Cut:** Pilot · **Depends on:** E0-S7 (event/audit bus — `done`, committed at baseline) · **ADRs:** ADR-009 · **Constitution:** §6, §7
- **Unblocks:** **E0-S6** (route/action guards read claims via `useAuth()` and reuse this story's auth-event seam for `Auth.RoleDenied`), **E0-S4** (`LocalStorageRepository` scoping reads tenant/subsidiary from the auth context this story establishes), **E1-S4** (subsidiary switcher mutates active scope), and **every feature screen/mutation in Epics 1–5** (all tenant/subsidiary scoping derives from this seam — never from props or client input).

## Story

As the platform,
I want identity to flow through one `AuthProvider` that exposes session claims via `useAuth()` and writes auth-lifecycle events to the dual event/audit streams,
so that tenant/subsidiary scope and roles come from a single seam that later swaps mock SSO for OIDC without touching a single call site.

## Acceptance Criteria

1. **AC1 — Session claims + `useAuth()`.** The session exposes claims `{ userId, tenantId, subsidiaryId | null, roles: Role[], exp }` (ADR-009 canonical shape). `useAuth()` returns the current session plus helpers (at minimum `isAuthenticated`, `signIn`, `signOut`). A consumer rendered **inside** `<AuthProvider>` reads the claims; a consumer rendered **outside** the provider throws (or is otherwise guarded) — the hook never silently returns `undefined`.
   *Files:* `src/shared/auth/AuthProvider.tsx`, `src/shared/auth/useAuth.ts` · *Seam:* auth context · *Shape:* claims.

2. **AC2 — Tenant-admin roll-up scope (subsidiaryId = null).** `tenant_admin` carries `subsidiaryId = null`, the agreed signal that relaxes the subsidiary filter so the repository (E0-S4) returns **all** tenant rows (roll-up). Subsidiary-pinned roles (`sales`, `support`, `viewer`) carry a **concrete** `subsidiaryId`. The role→scope mapping is owned here (data, not per-screen logic).
   *Files:* `src/shared/auth/AuthProvider.tsx` · *Seam:* auth context consumed by `LocalStorageRepository` scoping (E0-S4) · *Shape:* claims.

3. **AC3 — Audited auth events (UC-2).** Each auth-lifecycle action emits **exactly one** `DomainEvent` to the bus **and exactly one** `AuditEvent` to the append-only log, sharing **one** `correlationId` (minted via `newCorrelationId()`). This story owns emission of **`Auth.LoggedIn`, `Auth.LoginFailed`, `Auth.LoggedOut`**; it also exposes the reusable auth-event seam that **E0-S6 uses to emit `Auth.RoleDenied`** (do **not** fire `Auth.RoleDenied` from the provider — there is no denial here). All four type names already exist in the canonical `eventTypes.ts` registry; use them verbatim.
   *Files:* `src/shared/auth/AuthProvider.tsx` (+ imports `shared/events/bus.ts`, `shared/events/auditLog.ts`, `shared/events/correlation.ts`) · *Seam:* auth context + event/audit bus · *Shape:* canonical `Auth.*` event types.

4. **AC4 — OIDC seam (ADR-009).** `AuthProvider` is the **single** seam for future OIDC (Auth Code + PKCE). Mock SSO sits behind the same interface so swapping the identity source touches **only** the provider internals, not consumers. No consumer reads role/tenant/subsidiary from anywhere but `useAuth()`. The mock’s seedable identity (the per-role claims/scope/identity map) is an internal detail of the provider, not exported call-site coupling.
   *Files:* `src/shared/auth/AuthProvider.tsx` · *Seam:* auth context.

## Inherited Universal Conformance (subset)

- **UC-2 — Dual events, one correlationId.** Auth lifecycle events hit both streams on a shared `correlationId`; prove it with the E0-S7 conformance helper.
- **TC — Traceability.** story → spec → code → test → `Closes #`; preview green; `sprint-status.yaml`; passes `bmad-code-review`.

## Tasks / Subtasks

- [x] **Task 1 — Create the auth kernel directory + claims/identity model** (AC: 1, 2, 4)
  - [x] Create the **new** `src/shared/auth/` directory (currently only `data/`, `domain/`, `events/`, `ui/` exist under `src/shared`).
  - [x] Define the canonical **`SessionClaims`** type in `AuthProvider.tsx` (or a colocated `auth.types.ts` if you prefer — keep it inside `shared/auth/`): `{ userId: ID; tenantId: ID; subsidiaryId: ID | null; roles: Role[]; exp: string }`. **`import type { ID } from '../domain/types'`** and **`import type { Role } from '../domain/status'`** — do **not** redefine either (Role is the single source: `"tenant_admin" | "sales" | "support" | "viewer"`). → Placed in colocated `auth.types.ts`.
  - [x] Encode the **mock identity map** as internal provider data (one entry per canonical `Role`). Source the values from the prototype + the epic UX section (see Dev Notes "Role → claims map"). Mint stable, type-prefixed IDs (`tnt_…`, `sub_…`, `usr_…`) per §2.1 — deterministic constants are fine for the mock (e.g. `usr_sara`), they need not be random.
  - [x] **`tenant_admin` → `subsidiaryId: null`** (roll-up, AC2); `sales`/`viewer` → the EU subsidiary id; `support` → the US subsidiary id.

- [x] **Task 2 — `AuthProvider.tsx` (React context provider + mock SSO)** (AC: 1, 2, 4)
  - [x] Implement an `AuthProvider` React component holding session state (`SessionClaims | null`), exposing context value `{ session, isAuthenticated, signIn, signOut }`.
  - [x] `signIn(roleId)` resolves the role to canonical claims via the identity map, sets the session, and emits `Auth.LoggedIn` (Task 4). Unknown/invalid role → emit `Auth.LoginFailed` and leave session `null` (do not throw to the UI).
  - [x] `signOut()` emits `Auth.LoggedOut` (with the about-to-be-cleared claims as context) then clears the session to `null`.
  - [x] **OIDC seam (AC4):** keep the mock identity resolution behind a single private function so a future OIDC implementation replaces only that internal — the context value shape and `useAuth()` API stay identical. Add a short comment marking the seam. → `resolveMockIdentity()` is the single seam, commented "OIDC SEAM".
  - [x] **React 19 / TSX:** this is the **first** React component file in `src/` beyond the Vite scaffold (`App.tsx`). Use a typed `createContext` and the React 19 provider idiom; default the context to a sentinel (e.g. `undefined`) so the hook can detect "outside provider" (AC1). → context in colocated `authContext.ts` so `AuthProvider.tsx` exports only the component (eslint `react-refresh/only-export-components` is an error; `allowConstantExport` does not cover a `createContext()` call).

- [x] **Task 3 — `useAuth.ts` hook** (AC: 1)
  - [x] Export `useAuth()` returning the context value. If called **outside** an `AuthProvider`, **throw** a clear error (e.g. `"useAuth must be used within <AuthProvider>"`) — never return `undefined` (AC1 guard).
  - [x] Expose helpers off the returned value: `isAuthenticated: boolean`, `session: SessionClaims | null`, `signIn`, `signOut`. (Keep convenience getters minimal; consumers derive tenant/subsidiary from `session`.)

- [x] **Task 4 — Auth event emission (dual streams, one correlationId)** (AC: 3)
  - [x] Add an internal `emitAuthEvent(...)` helper in the provider that, for one auth action: mints `const correlationId = newCorrelationId()`, calls `bus.publish(domainEvent)` **then** `auditLog.append(auditEvent)` with the **same** `correlationId`.
  - [x] **DomainEvent** (`bus.ts` shape): `{ eventId: newId('...')`-style or a fresh id, `type: "Auth.LoggedIn" | "Auth.LoginFailed" | "Auth.LoggedOut"`, `tenantId, subsidiaryId, actorId: userId, occurredAt: new Date().toISOString(), payload, correlationId }`. **`type` must be a canonical registry name** — `bus.publish` throws otherwise (it already does; that's the AC3 free-form guard). → `eventId`/audit-`id` minted as bare `crypto.randomUUID()` (infra-stream ids, not entity ids — mirrors `correlation.ts`).
  - [x] **AuditEvent** (`auditLog.ts` shape): `{ id, tenantId, subsidiaryId, actorId, action: "auth.login" | "auth.login_failed" | "auth.logout", entityType: "User" (or "Session"), entityId: userId, occurredAt, before/after (optional), correlationId }`. Remember `AuditEvent.action` is a **lowercase dotted verb** and `DomainEvent.type` is the **PascalCase registry name** — they are different fields by design (E0-S7 Reconciliation 2).
  - [x] **`Auth.LoginFailed` edge:** there is no established session, so there is no real `tenantId`/`userId`. Use an explicit anonymous/unknown sentinel for `actorId`/`tenantId` (document the choice); do **not** fabricate a real tenant. See Open Question 3. → `actorId = "usr_anonymous"`, `tenantId = "tnt_northwind"` (single pilot tenant), `entityType = "Session"`.
  - [x] Do **not** emit `Auth.RoleDenied` here — that fires from E0-S6's guards (which depend on this story). Just make the emission seam reusable enough that E0-S6 can call it. → `emitAuthEvent`/`AuthEmission` shape is reusable; `Auth.RoleDenied` NOT fired here.

- [x] **Task 5 — Tests (NFR-12, Vitest + RTL)** (AC: 1–4)
  - [x] **Decision required first (Open Question 1):** this is the **first** story whose ACs require **React Testing Library** (`useAuth()` inside/outside provider; a consumer reading claims). RTL + jsdom are **not** installed (E0-S1 review removed jsdom as premature; E0-S11 owns the full harness). **Default action:** add `@testing-library/react`, `@testing-library/dom`, and `jsdom` as **devDependencies**, and run the auth specs under jsdom via a **per-file docblock** (`// @vitest-environment jsdom` at the top of `AuthProvider.test.tsx`) so the existing **node-env** specs (events/domain/data — 153 tests) are untouched. Do **not** flip the global Vitest environment. → **Heba confirmed the default**; deps added; vitest `include` widened to `.test.{ts,tsx}`; global env stays `node`.
  - [x] `AuthProvider.test.tsx` (**jsdom**): a consumer rendered inside `<AuthProvider>` reads claims after `signIn('tenant_admin')`; `tenant_admin` yields `subsidiaryId === null` (AC2); a subsidiary role yields a concrete `subsidiaryId`; `useAuth()` rendered **outside** the provider **throws** (AC1).
  - [x] **Auth events (AC3)** — reuse the **E0-S7 conformance helper** `expectOneOpOneEventOneAudit(operation)` from `src/shared/events/conformance.ts` to prove `signIn` / `signOut` each emit **exactly 1 domain event + 1 audit event with one shared correlationId**. Assert the emitted `DomainEvent.type` is the right `Auth.*` name and the `AuditEvent.action` is the right dotted verb. (Call `__resetBus()` / `__resetAuditLog()` between specs so streams don't leak.)
  - [x] Assert `signIn` with an **invalid role** emits `Auth.LoginFailed` (1 event + 1 audit) and leaves `isAuthenticated === false`.
  - [x] `npm test` green (no regression to the 153 existing tests); `npx tsc -b` clean; `npm run lint` clean. → 161 tests pass (153 + 8 new).

- [x] **Task 6 — Conformance gates + DoD self-check** (AC: all)
  - [x] `npx tsc -b`, `npm run lint` (`eslint .`), `npm test` all green. **Confirm `tsx` files compile** under the app tsconfig (this is the first non-scaffold `.tsx` in `src/shared`). → all green; `.tsx` compiles under the app tsconfig.
  - [x] Self-check against DoD (§10) — note which items now apply (this story establishes the auth context that tenant/subsidiary scoping derives from; emits one audit + one domain event per auth action §7) vs which are N/A (no Repository wiring yet — E0-S4; no route/action guard — E0-S6; no four-state UI — the login *screen* is deferred, see Open Question 2). → see Completion Notes.

## Review Findings

> `bmad-code-review` (2026-06-08) — adversarial layers: Blind Hunter + Edge Case Hunter + Acceptance Auditor. Gates green after fixes: `tsc -b` clean · `eslint` clean · `vitest` 162/162. **1 decision-needed → patched, 2 patch, 3 defer, 7 dismissed. All actionable findings applied.**

- [x] [Review][Decision→Patch] **Dual-stream emission is not atomic — `publish()` before `append()`** — `emitAuthEvent` called `publish()` then `append()` ([AuthProvider.tsx:124-148](../../src/shared/auth/AuthProvider.tsx#L124-L148)). Per the bus contract, a throwing subscriber makes `publish()` raise an `AggregateError` *after* delivery, so `append()` never ran → a `DomainEvent` with **no matching `AuditEvent`** (UC-2 atomicity broken) and the throw escaped `signIn`/`signOut`. **Resolved (Heba's call): swapped to append-before-publish** so the compliance record is written before any subscriber fault can surface — both stream records now exist regardless. Comment documents this as the reference emission pattern for E0-S6/E0-S4/Epics 1–5.
- [x] [Review][Patch] **Prototype-chain role ids mint a bogus authenticated session** [src/shared/auth/AuthProvider.tsx:84-85](../../src/shared/auth/AuthProvider.tsx#L84-L85) — `roleId in MOCK_IDENTITIES` and `ROLE_ALIASES[roleId]` walked the prototype chain, so `signIn("constructor" | "toString" | "__proto__" | "valueOf" | "hasOwnProperty")` resolved a non-null `role`, the `role === undefined` guard missed, and it returned claims `{ userId: undefined, roles: ["constructor"], … }` → emitted `Auth.LoggedIn` with `isAuthenticated === true`. **Fixed:** both lookups guarded with `Object.hasOwn(...)` (mirrors [status.ts:97](../../src/shared/domain/status.ts#L97)); added a regression spec proving inherited keys stay unauthenticated.
- [x] [Review][Patch] **NFR-12 "full claims set" not fully asserted — `exp` was untested** [src/shared/auth/AuthProvider.test.tsx:65-69](../../src/shared/auth/AuthProvider.test.tsx#L65-L69) — **Fixed:** added `expect(result.current.session?.exp).toBe("2099-12-31T23:59:59.000Z")` so all five claims are asserted.
- [x] [Review][Defer] **`signIn` while already authenticated silently swaps the session with no `Auth.LoggedOut`** [src/shared/auth/AuthProvider.tsx:164-191](../../src/shared/auth/AuthProvider.tsx#L164-L191) — deferred: not reachable in current scope (login screen deferred to E0-S9; no re-auth path exists yet). Harden when shell wiring lands.
- [x] [Review][Defer] **`exp` is a static far-future constant, never validated by `isAuthenticated`** [src/shared/auth/AuthProvider.tsx:45](../../src/shared/auth/AuthProvider.tsx#L45) — deferred: mock-acceptable; real expiry handling lands with OIDC (the seam's job).
- [x] [Review][Defer] **`signIn` returns `void` — no programmatic failure signal to the caller on an unknown role** [src/shared/auth/auth.types.ts:41](../../src/shared/auth/auth.types.ts#L41) — deferred: intentional "does not throw to the UI"; the deferred login screen (E0-S9) will need a way to surface the failure.

**Dismissed (7, noise/false-positive/spec-justified):** `crypto.randomUUID` undefined (empirically present in node24+jsdom; repo-wide accepted risk per [correlation.ts](../../src/shared/events/correlation.ts)) · `AuthEventType` union not linked to the registry (currently aligned; `tsc` + `publish`-throws guard drift) · `sessionRef` duplicates `useState` (intentional React 19 StrictMode double-emit guard, documented) · `usr_anonymous` sentinel on failed login (documented OQ3 decision) · email/`displayName` absent from claims (§6.1 claims shape deliberately omits them) · `Auth.RoleDenied` not emitted (spec-justified — E0-S6) · provider not mounted in shell (spec-justified — later shell wiring).

## Dev Notes

### What this story IS (and is NOT)

**IS:** the **auth kernel seam** (ADR-009) — one `AuthProvider` React context, a `useAuth()` hook, and a **mock SSO** that resolves a picked role into canonical session **claims** (`userId/tenantId/subsidiaryId/roles/exp`), plus emission of the auth-lifecycle events (`Auth.LoggedIn/LoginFailed/LoggedOut`) to the dual streams on one `correlationId`. This is the **single source of tenant/subsidiary scope and roles** for the entire app.

**IS NOT:**
- **The route/action guards or the permission matrix** — that's **E0-S6** (`permissions.ts`, `guards.tsx`, the `can()` predicate, `Auth.RoleDenied`). This story only provides the claims they read and the event seam they reuse.
- **The repository scoping** — that's **E0-S4**; here the claims are produced, not yet consumed by persistence.
- **The full login screen UI** — see **Open Question 2**. The prototype login screen (`login.jsx`) uses shared components (`Button`, `Wordmark`, `Icon`, `TextField`) and design tokens that **don't exist until E0-S9** (build order: S5 → … → S9). **Default scope: build the provider + hook + mock `signIn`/`signOut` logic and the role→claims/scope/identity data — defer the pixel-perfect two-panel login *screen* to the E0-S9-era / a shell story.** The UX section below is the spec for the *eventual* screen and the authoritative source for the claims/scope/identity values you encode now.

### 🚨 Source of truth + two reconciliations (constitution wins)

`_bmad-output/project-context.md` **§6** (auth/session model) and **§7** (events) are canonical; ADR-009 (architecture.md:250-260) ratifies the claims shape. As with E0-S2/S3/S7, **the constitution wins over prototype/epic drift** unless a `decision-log.md` entry says otherwise.

- **🚨 Reconciliation A — role ids: prototype `sales_agent`/`support_agent` → canonical `sales`/`support`.** The prototype (`config.jsx`) and the epic UX table use `sales_agent`, `support_agent`. The **canonical `Role`** (constitution §3.1, already authored at `src/shared/domain/status.ts:21`) is `"tenant_admin" | "sales" | "support" | "viewer"`. **Claims must carry the canonical `Role` values.** The mock `signIn` may accept the prototype-style ids as input *labels*, but it maps them to canonical roles for the `roles[]` claim (`sales_agent → "sales"`, `support_agent → "support"`). [Source: project-context.md §3.1; src/shared/domain/status.ts:21]
- **🚨 Reconciliation B — `AuditEvent.action` vs `DomainEvent.type` (carried from E0-S7).** Audit uses a lowercase dotted verb (`"auth.login"`); the domain event uses the PascalCase registry name (`"Auth.LoggedIn"`). Different fields, different conventions — don't unify them. [Source: project-context.md §7.1/§7.2; 0-7 Reconciliation 2]

### Role → claims map (the data this story owns)

Derived from `prototype/app/config.jsx` (`ROLES`, `fixedScope`), `prototype/app/shell.jsx:263` (`USER_OF`), and the E0-S5 epic UX table. Encode **canonical `Role`** keys; the prototype id is shown only for traceability.

| Canonical `Role` | Prototype id | Display name (`USER_OF`) | `subsidiaryId` (claim) | Landing scope |
|---|---|---|---|---|
| `tenant_admin` | `tenant_admin` | Sara Khan | **`null`** (roll-up — AC2) | Whole tenant |
| `sales` | `sales_agent` | Marco Ruiz | EU subsidiary (`sub_eu`) | EU |
| `support` | `support_agent` | Lena Bauer | US subsidiary (`sub_us`) | US |
| `viewer` | `viewer` | Ivo Petrov | EU subsidiary (`sub_eu`) | EU |

- **Tenant:** single tenant for the pilot — Northwind Trading (`prototype/app/config.jsx` `TENANT = { id: 'northwind', … }`). Use a stable `tnt_…` id (e.g. `tnt_northwind`).
- **Subsidiaries:** `eu` (Frankfurt) / `us` (Chicago) / `apac` (Singapore) from `config.jsx SUBSIDIARIES`; mint `sub_eu`, `sub_us`, `sub_apac`.
- **`exp`:** an ISO 8601 expiry (mock can set far-future). Constitution stores timestamps as ISO 8601 strings, never `Date` (§2.1). If you prefer an epoch number for `exp` (OIDC convention), document it — but keep the rest ISO strings.
- **`userId` = the audit/event `actorId`** used by notifications, audit, and timelines — mint stable `usr_…` ids (e.g. `usr_sara`, `usr_marco`, `usr_lena`, `usr_ivo`).

### Architecture compliance (guardrails)

- **File locations are fixed by the source tree** ([architecture.md:790-796]): `src/shared/auth/{AuthProvider.tsx, useAuth.ts}` — a **new** `src/shared/auth/` directory. `permissions.ts`, `guards.tsx`, `permissions.test.ts` in that listing are **E0-S6 — do not create them.** **No barrel `index.ts`** (E0-S1/S2/S3/S7 established direct-file imports). [Source: architecture.md#Source-Tree:790-796]
- **ADR-009 (the ADR for this story):** one `AuthProvider`; claims `{ userId(sub), tenantId, subsidiaryId|null, roles: Role[], exp }`; established **once at the shell**, exposed via `useAuth()`; **tenant/subsidiary scoping everywhere derives from this context — never from props or client input.** Mock SSO now → OIDC Auth Code + PKCE later behind the *same* interface (+ an IdP→`Role` normalization layer at swap time, not now). [Source: architecture.md#ADR-009:250-260]
- **Two gates are E0-S6, not here.** ADR-009's route-guard/action-guard/404-not-403 enforcement is E0-S6. This story produces the claims those gates consume. Don't build guards or the `can()` predicate. [Source: architecture.md:262-270]
- **UC-2 dual-stream discipline (carried from E0-S7):** one auth action → exactly one `DomainEvent` + one `AuditEvent`, one `correlationId`. Use `newCorrelationId()` from `shared/events/correlation.ts`; publish via `bus.publish`; append via `auditLog.append`. Prove it with `conformance.ts`'s `expectOneOpOneEventOneAudit`. [Source: project-context.md §7.2/§7.3; src/shared/events/*]
- **NFR-1 one-way dependency:** `src/shared/auth` is shared-layer; it may import sibling shared modules (`domain/`, `events/`) but **nothing from `src/features/*`**. `shared/events` does **not** import `shared/auth` — keep the dependency direction auth → events, never the reverse. [Source: project-context.md §1]

### Using the E0-S7 event/audit kernel (already on disk, committed at baseline)

The kernel this story emits into is implemented and committed (`src/shared/events/`). Import surfaces you'll use:
- `import { publish } from '../events/bus'` — `publish(event: DomainEvent): void`; **throws** if `event.type` isn't canonical. `DomainEvent` shape: `{ eventId, type, tenantId, subsidiaryId, actorId, occurredAt, payload, correlationId }`. [src/shared/events/bus.ts:21-30]
- `import { append } from '../events/auditLog'` — `append(event: AuditEvent): void`; runs `before/after` through `redact()` and stores a frozen copy. `AuditEvent` shape: `{ id, tenantId, subsidiaryId, actorId, action, entityType, entityId, occurredAt, before?, after?, correlationId }`. [src/shared/events/auditLog.ts:28-40]
- `import { newCorrelationId } from '../events/correlation'` — fresh unprefixed UUID. [src/shared/events/correlation.ts:19]
- The four `Auth.*` names are **already** in the registry — `Auth.LoggedIn`, `Auth.LoginFailed`, `Auth.LoggedOut`, `Auth.RoleDenied`. [src/shared/events/eventTypes.ts:39-43]
- Test helper: `import { expectOneOpOneEventOneAudit } from '../events/conformance'` (+ `recordEmissions`, `assertOneOpOneEventOneAudit`). [src/shared/events/conformance.ts:34-86]
- Test resets: `__resetBus()` (bus.ts), `__resetAuditLog()` (auditLog.ts).

### 🚨 Compiler constraints — same ones every prior E0 story hit (don't relearn the hard way)

[tsconfig.app.json] sets `"verbatimModuleSyntax": true` and `"erasableSyntaxOnly": true` (`target es2023`, `lib ["ES2023","DOM"]`).
- **`import type` for type-only imports** — `ID` (types.ts), `Role` (status.ts), and any `SessionClaims`/React type imports that are types must use `import type`. A plain `import` of a type fails `verbatimModuleSyntax`.
- **No TS `enum`** — if you enumerate anything, use a `const` map + derived union (mirror `ID_PREFIXES`, types.ts:43-54). Not relevant unless you add a lookup.
- **This story DOES emit JS/JSX** (a runtime React provider) — that's expected, unlike the type-only E0-S3. `.tsx` files are new to `src/shared`; verify they build under the app tsconfig (React 19 JSX runtime is configured for the Vite scaffold — `App.tsx` compiles, so the toolchain is ready).
- **ESLint has no `argsIgnorePattern`** — don't leave unused params named `_x`; drop unused params instead (E0-S3/S7 hit this). [0-3 / 0-7 Debug Log]

### Testing (NFR-12) — the RTL/jsdom decision is the crux

- **Vitest is wired** (`vitest ^4.1.8`, **node** env, `"test": "vitest run"`). The existing 153 tests run in node and **must stay green**.
- **RTL + jsdom are NOT installed** and were deliberately deferred (E0-S1 review removed jsdom as premature; E0-S11 owns the full harness). But **E0-S5's ACs require RTL** (render a consumer inside/outside the provider). This is the **first** story to hit that wall. **Default action (Open Question 1):** add `@testing-library/react` + `@testing-library/dom` + `jsdom` as devDeps and scope them to the auth specs with a **per-file** `// @vitest-environment jsdom` docblock — leaving the global env as node so nothing else changes. Confirm with Heba vs. deferring all RTL assertions to E0-S11 (which would leave AC1's inside/outside-provider behavior only partially tested now).
- **You can test most of AC2/AC3 without RTL** — `signIn`/`signOut` claim derivation and event emission are testable by calling the provider's logic directly / via the conformance helper; only the "rendered consumer reads claims / hook throws outside provider" assertions strictly need RTL. Split the spec so the node-testable parts don't depend on jsdom if you want to minimize the jsdom surface.
- Reset bus + audit streams between specs (`__resetBus()`, `__resetAuditLog()`).

### Previous-story intelligence (E0-S1/S2/S3/S7)

- **`Role` exists** at `src/shared/domain/status.ts:21` (`"tenant_admin" | "sales" | "support" | "viewer"`) — `import type { Role }`; do **not** redefine, and **map the prototype `*_agent` ids onto it** (Reconciliation A). [src/shared/domain/status.ts]
- **`ID` + `User` exist** — `ID` at `types.ts:16`; the `User` entity (`{ email, displayName, roles: Role[] }`) at `tenant.types.ts`. The mock identity map mirrors `User.roles: Role[]`; claims `userId`/`tenantId`/`subsidiaryId` are `ID`s. [src/shared/domain/types.ts, tenant.types.ts]
- **`newId(kind)`** mints type-prefixed UUIDs (`usr_`, `tnt_`, `sub_` are in `ID_PREFIXES`). For the *mock*, deterministic constant ids (`usr_sara`) are acceptable and more testable than random — but they must keep the §2.1 prefix shape. [src/shared/domain/types.ts:43-63]
- **Verbatim-from-constitution + log reconciliations** is the house play (E0-S2: 3, E0-S3: 2, E0-S7: 4): copy §6/§7 exactly, apply only the explicitly-flagged reconciliations, raise genuine ambiguity as Open Questions rather than inventing. [0-2/0-3/0-7 dev notes]
- **E0-S7 ships the dual-stream machinery and its UC-2 helper** — reuse them; do not re-implement event/audit plumbing. The `Auth.*` names are already registered. [0-7 File List; eventTypes.ts:39-43]
- **`crypto.randomUUID()` secure-context caveat** (deferred-work.md) applies transitively if you mint random ids — prefer deterministic mock ids and you sidestep it for fixtures.

### Git intelligence

- Branch **`story/E0-S5-authprovider-useauth-mock-sso` is already checked out** (branch-per-story). Baseline = `257050d` (frontmatter `baseline_commit`), which includes the committed E0-S7 events kernel.
- **No `src/shared/auth/` directory and no `AuthProvider.tsx`/`useAuth.ts` exist** — everything in this story is **NEW**; nothing to preserve or regress. `App.tsx`/`main.tsx` are the untouched Vite scaffold (the provider is not yet mounted in the app shell — wiring it into `src/app` is a later shell concern, not this story's AC).
- Module/test shape to mirror: `7b0aeb3` (E0-S2 types), `429feba` (E0-S3 repository), and the committed E0-S7 events kernel.

### Web research (latest tech)

- **React 19.2.6** (package.json) — use the React 19 context idiom: typed `createContext<AuthContextValue | undefined>(undefined)`, render `<AuthContext.Provider>` (or the React-19 `<AuthContext>` shorthand), and detect "outside provider" by the `undefined` sentinel in `useAuth`. No new state library — `useState`/`useCallback` suffice for the mock.
- **No external auth dependency.** Do **not** add `oidc-client-ts`, `react-oidc-context`, `jose`, or any SSO SDK — the pilot is a **mock** behind the ADR-009 seam; the real OIDC client is Epic 6 (design-only). The only new deps in play are the **test** ones (RTL + jsdom — Open Question 1), and only if Heba approves.

### Project Structure Notes

- Stack: React 19.2.6 + TypeScript ~6.0.2 + Vite 8, Vitest 4.1.8, npm. [package.json]
- Naming (§9 + source tree): components `PascalCase.tsx` (`AuthProvider.tsx`), hooks `useThing.ts` (`useAuth.ts`), tests mirror source casing (`AuthProvider.test.tsx`). One module per file; no barrel. [architecture.md:790-796; project-context.md §9]
- This is the first `src/shared` React/TSX story — keep it lint-clean under the flat ESLint config (`eslint.config.js`).

### Definition of Done (scoped for the auth-kernel story) — constitution §10

**Applicable & in-scope:** meets ACs; passes `bmad-code-review`; reuses shared modules (no new auth/event plumbing — imports `events/*`, `domain/*`); **tenant + subsidiary scope is established here via the auth context** (the thing every later story derives scope from — `subsidiaryId=null` = roll-up); event names come from the single §7.2 registry (free-form rejected by `bus.publish`); **every auth action emits one audit + one domain event (§7)** and this story proves it with the UC-2 helper; `tsc -b` + `eslint` + tests green; traceable chain (`Closes #<issue>`).
**N/A here (bind consuming stories):** the four UI states + login *screen* (deferred — Open Question 2 / E0-S9); route/action guards, the permission matrix, `Auth.RoleDenied` emission, 404-not-403 (E0-S6); Repository scoping + REST codes + Zod (E0-S4); the structured log line (E0-S8); mounting the provider in the app shell (later shell wiring).

### References

- [Source: _bmad-output/planning-artifacts/epics/epic-0-platform-guidelines/E0-S5.md] — story spec, ACs, UX & behavior (claims/scope/identity), test requirements
- [Source: _bmad-output/planning-artifacts/epics/epic-0-platform-guidelines/epic-0.md#Feature-0.3] — epic context; build order S5+S6, S5 depends on S7, S5 unblocks S6 + S4
- [Source: _bmad-output/planning-artifacts/epics/epic-0-platform-guidelines/E0-S6.md] — the consumer of this seam (guards, `can()`, `Auth.RoleDenied`) — defines the boundary of what is NOT in S5
- [Source: project-context.md#6] — §6.1 session/claims model, §6.2 permission matrix (E0-S6), §6.3 enforcement (two gates — E0-S6)
- [Source: project-context.md#7] — §7.1 `AuditEvent`, §7.2 `DomainEvent` + canonical `Auth.*` names, §7.3 naming rules
- [Source: project-context.md#3.1] — canonical `Role` (`tenant_admin`/`sales`/`support`/`viewer`) — basis for Reconciliation A
- [Source: architecture.md#ADR-009:250-270] — one `AuthProvider`, claims shape, mock→OIDC seam, scoping derives from context, two-gate/404-not-403 (the enforcement is E0-S6)
- [Source: src/shared/domain/status.ts:21] — `Role` type to import (do not redefine)
- [Source: src/shared/domain/types.ts] — `ID`, `newId`, `ID_PREFIXES` (`usr_`/`tnt_`/`sub_`)
- [Source: src/shared/domain/tenant.types.ts] — `User` entity (`roles: Role[]`) the claims mirror
- [Source: src/shared/events/{bus,auditLog,correlation,eventTypes,conformance}.ts] — the dual-stream kernel + UC-2 helper this story emits into and tests with
- [Source: prototype/app/config.jsx] — `ROLES`, `fixedScope` (eu/us), `TENANT`, `SUBSIDIARIES` — mock claims/scope source
- [Source: prototype/app/shell.jsx:263] — `USER_OF` per-role display-name/actor identity map
- [Source: prototype/app/login.jsx] — the eventual login *screen* spec (deferred — needs E0-S9 components)
- [Source: _bmad-output/implementation-artifacts/0-7-audit-log-domain-event-bus-shared-correlationid.md] — event/audit kernel contract, UC-2 helper, reconciliations, compiler-constraint lessons
- [Source: _bmad-output/implementation-artifacts/deferred-work.md] — `crypto.randomUUID()` secure-context caveat (only bites if you mint random mock ids)
- [Source: tsconfig.app.json] — `verbatimModuleSyntax`, `erasableSyntaxOnly` (no enum; `import type`)
- PRD: prd.md §6 E0-S5 · ADR(s): ADR-009 · Inherited UC: UC-2 (dual events), TC (traceability)

## Open Questions (for Heba — do not block implementation; default actions noted)

1. **RTL/jsdom test dependency (the real decision).** E0-S5's ACs require React Testing Library (render a consumer inside/outside `<AuthProvider>`), but RTL + jsdom were deliberately **deferred** (E0-S1 review; E0-S11 owns the harness). **Default action:** add `@testing-library/react` + `@testing-library/dom` + `jsdom` as devDeps and scope them via a per-file `// @vitest-environment jsdom` docblock on `AuthProvider.test.tsx` (global env stays node — 153 existing tests untouched). **Alternative:** defer the render-based assertions to E0-S11 and test only the non-RTL parts now (claims derivation + event emission via the conformance helper), accepting partial AC1 coverage. *Confirm which.*
2. **Login-screen scope.** The epic UX section describes a full two-panel login *screen*, but its shared components (`Button`, `Wordmark`, `Icon`, `TextField`) + design tokens don't exist until **E0-S9** (build order S5 → … → S9), and the modules-touched list is only `AuthProvider.tsx` + `useAuth.ts`. **Default action:** scope E0-S5 to the **auth kernel** (provider + hook + mock `signIn`/`signOut` + claims/scope/identity data + events); **defer the pixel-perfect login screen** to the E0-S9-era/shell story. *Confirm the screen is out of scope for S5.*
3. **`Auth.LoginFailed` actor/tenant on a failed login.** There's no established session at failure time, so `tenantId`/`actorId` are unknown. **Default action:** emit with an explicit anonymous sentinel (e.g. `actorId = "usr_anonymous"`, `tenantId = tnt_northwind` since the pilot is single-tenant) and document it; do not fabricate a real user. In the mock, login fails only on an unknown role id. *Confirm the sentinel approach (and whether `Auth.LoginFailed` even needs to be reachable in the mock, or just wired for the OIDC future).*

## Dev Agent Record

### Agent Model Used

Claude Opus 4.8 (1M context) — `bmad-dev-story` workflow.

### Debug Log References

- `npx tsc -b` → clean (exit 0); `.tsx` compiles under the app tsconfig (first non-scaffold `.tsx` in `src/shared`).
- `npm run lint` (`eslint .`) → clean. Note: `react-refresh/only-export-components` is configured as **error** (with `allowConstantExport`, which does NOT cover a `createContext()` call) — this is why the context lives in its own `authContext.ts`, keeping `AuthProvider.tsx`'s only export the component.
- `npm test` (`vitest run`) → **161 passed** (8 test files). 153 pre-existing node-env specs unchanged + 8 new auth specs. The auth spec runs under jsdom via a per-file `// @vitest-environment jsdom` docblock; the global Vitest env stays `node`.

### Completion Notes List

- **Open Questions resolved.** OQ1 (RTL/jsdom): Heba confirmed the default — added `@testing-library/react`, `@testing-library/dom`, `jsdom` as devDeps; scoped to the auth spec via the per-file jsdom docblock (global env stays node); widened `vitest.config.ts` `include` to `src/**/*.test.{ts,tsx}` so `.tsx` specs are discovered. OQ2 (login screen): took the documented default — scoped to the auth kernel; the pixel-perfect login *screen* is deferred to the E0-S9-era/shell story. OQ3 (`Auth.LoginFailed` actor/tenant): took the documented default — `actorId = "usr_anonymous"`, `tenantId = "tnt_northwind"` (single pilot tenant), `entityType = "Session"`; no real user fabricated.
- **File split rationale.** Story named `AuthProvider.tsx` + `useAuth.ts`; the story explicitly blesses a colocated `auth.types.ts`. Added `authContext.ts` for the same reason (lint constraint above). No barrel `index.ts` (E0-S1/S2/S3/S7 convention). `permissions.ts`/`guards.tsx` deliberately NOT created — they are E0-S6.
- **Reconciliation A applied.** `signIn` accepts the prototype-style ids (`sales_agent`, `support_agent`) as input labels and maps them onto the canonical `Role` for the `roles[]` claim (canonical ids resolve to themselves). Claims always carry canonical `Role` values (imported from `domain/status.ts`, not redefined).
- **Reconciliation B preserved.** `DomainEvent.type` is the PascalCase registry name (`Auth.LoggedIn`); `AuditEvent.action` is the lowercase dotted verb (`auth.login`) — kept as distinct fields.
- **UC-2 discipline.** Each auth action emits exactly one `DomainEvent` (canonical type, validated by `bus.publish`) + one `AuditEvent`, sharing one `newCorrelationId()`. Emission is kept OUT of the `useState` updater (a ref mirrors the latest claims for `signOut`) so React 19 StrictMode double-invocation can't double-emit. Proven with the E0-S7 `expectOneOpOneEventOneAudit` helper.
- **AC4 seam.** Mock identity resolution is isolated to the private `resolveMockIdentity()` (the only identity-source-specific code, marked "OIDC SEAM"); the mock identity/scope map is internal provider data, not exported. The context value shape and `useAuth()` API are identical for mock SSO now and OIDC later.
- **DoD §10 self-check.** **Applies & met:** meets ACs; reuses shared modules (imports `events/*`, `domain/*` — no new auth/event plumbing); establishes the tenant/subsidiary auth context that later stories derive scope from (`subsidiaryId=null` = roll-up); event names come from the single §7.2 registry (free-form rejected by `bus.publish`); every auth action emits one audit + one domain event (§7), proven by the UC-2 helper; `tsc -b` + `eslint` + tests green. **N/A here (bind consuming stories):** four UI states + login screen (deferred — E0-S9); route/action guards, permission matrix, `Auth.RoleDenied`, 404-not-403 (E0-S6); Repository scoping + REST codes (E0-S4); structured log line (E0-S8); mounting the provider in the app shell (later shell wiring). `bmad-code-review` + preview-green + `Closes #` are the open traceability items for review.

### File List

- `src/shared/auth/auth.types.ts` (new) — `SessionClaims` + `AuthContextValue` types.
- `src/shared/auth/authContext.ts` (new) — typed `AuthContext` (`undefined` sentinel for the AC1 guard).
- `src/shared/auth/AuthProvider.tsx` (new) — provider component, mock identity map + `resolveMockIdentity` (OIDC seam), `emitAuthEvent` dual-stream helper.
- `src/shared/auth/useAuth.ts` (new) — `useAuth()` hook with the outside-provider throw guard.
- `src/shared/auth/AuthProvider.test.tsx` (new) — jsdom-scoped RTL specs (AC1–AC4, Reconciliation A, UC-2).
- `vitest.config.ts` (modified) — `include` widened to `src/**/*.test.{ts,tsx}`; comment updated for the per-file jsdom opt-in.
- `package.json` / `package-lock.json` (modified) — added devDeps `@testing-library/react`, `@testing-library/dom`, `jsdom`.

## Change Log

| Date       | Change                                                                 |
|------------|------------------------------------------------------------------------|
| 2026-06-07 | Story context created (ready-for-dev): ADR-009 auth kernel — `AuthProvider` + `useAuth()` + mock SSO; canonical claims `{userId,tenantId,subsidiaryId,roles,exp}`; tenant_admin roll-up (`subsidiaryId=null`); `Auth.LoggedIn/LoginFailed/LoggedOut` emitted to the dual streams on one correlationId (reusing the E0-S7 kernel + UC-2 helper). Reconciliations A (role-id `*_agent`→canonical) & B (audit `action` vs domain `type`) logged. 3 Open Questions raised (RTL/jsdom dep, login-screen scope, LoginFailed sentinel). |
| 2026-06-08 | Implemented (status → review): `auth.types.ts`, `authContext.ts`, `AuthProvider.tsx` (mock SSO + `resolveMockIdentity` OIDC seam + `emitAuthEvent` dual-stream), `useAuth.ts` (outside-provider throw). All 3 Open Questions resolved (OQ1 confirmed by Heba — RTL+jsdom added, scoped per-file). Added RTL+jsdom devDeps; widened `vitest.config.ts` include to `.test.{ts,tsx}`. New `AuthProvider.test.tsx` (8 specs, jsdom). `tsc -b` + `eslint` clean; `npm test` 161 passed (153 + 8, no regressions). |
