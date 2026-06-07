---
baseline_commit: 429feba
---

# Story 0.7: Audit log + domain event bus with shared correlationId

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

- **Story ID:** E0-S7 (`0-7-audit-log-domain-event-bus-shared-correlationid`)
- **Epic:** E0 — Platform Guidelines & Standards (the governing contract) · **Feature:** 0.4 — Event, Audit & Logging Kernel
- **Cut:** Pilot · **Depends on:** E0-S1 (entity/status vocabulary — `done`) · **ADRs:** ADR-008 · **Constitution:** §7
- **Unblocks:** **E0-S4** (the 4-beat *emit*/*audit* beats publish to this bus + audit log), **E0-S5/E0-S6** (`Auth.*` events), **E0-S8** (reuses this story's redaction/masking helper), **E0-S12** (NotificationService subscribes to this bus), and **every mutation in Epics 1–5** (UC-2 inherits this story's one-op→one-event+one-audit guarantee and its test helper).

## Story

As the platform,
I want every operation to emit exactly one canonical `DomainEvent` and write exactly one immutable `AuditEvent` on a shared `correlationId`,
so that activity timelines, audit/compliance logs, and notifications all derive from one trustworthy, append-only stream — and free-form or malformed event names are impossible.

## Acceptance Criteria

1. **AC1 — Event & audit shapes (constitution §7.1/§7.2 verbatim).** Define `DomainEvent<P>` and `AuditEvent` **exactly as written in constitution §7.1/§7.2** (architecture data-dictionary line 526: "*exactly as defined*"). See **Reconciliations 1–3** — the epic's `ts`/`type`-on-both wording is un-logged drift; the constitution wins.
   - `DomainEvent<P = unknown>`: `{ eventId: ID; type: string; tenantId: ID; subsidiaryId: ID | null; actorId: ID; occurredAt: string; payload: P; correlationId: string }`
   - `AuditEvent`: `{ id: ID; tenantId: ID; subsidiaryId: ID | null; actorId: ID; action: string; entityType: string; entityId: ID; occurredAt: string; before?: unknown; after?: unknown; correlationId: string }`
   - `DomainEvent` lives in `src/shared/events/bus.ts`; `AuditEvent` lives in `src/shared/events/auditLog.ts`. Both `import type { ID } from '../domain/types'` (E0-S2 — do **not** redefine `ID`). Both are tenant-tagged and carry `correlationId`.
   *Files:* `src/shared/events/bus.ts`, `src/shared/events/auditLog.ts`.

2. **AC2 — Append-only audit log.** `auditLog` exposes **append + read only** — there is **no** update or delete method, and the stored records are never mutated in place. Concretely: an `append(event)` that pushes an immutable copy, and read accessors (e.g. `all()` / a scoped query) that return **defensive copies/frozen records** so a caller cannot retroactively edit a stored record. Attempting to mutate a returned record must not change what a subsequent read returns.
   *File:* `src/shared/events/auditLog.ts`.

3. **AC3 — Canonical event-type registry (free-form rejected at publish time).** `eventTypes.ts` exports the canonical registry — the **verbatim §7.2 list** — plus an `isEventType()` guard and a string-literal union type. `bus.publish()` **rejects** any event whose `type` is not in the registry (throws a clear error; nothing is dispatched to subscribers and no audit is written by the bus). The registry enforces the `PascalCaseEntity.PastTenseAction` shape *by enumeration* (only listed names pass). Canonical names (§7.2, copy exactly):
   ```
   Lead.Created  Lead.Updated  Lead.StatusChanged  Lead.Converted  Lead.Deleted
   Customer.Created  Customer.Updated  Customer.Deleted
   Ticket.Created  Ticket.Updated  Ticket.StatusChanged  Ticket.Assigned  Ticket.Deleted
   Tenant.SubsidiaryAdded  Tenant.SubsidiaryRemoved
   Auth.LoggedIn  Auth.LoginFailed  Auth.LoggedOut  Auth.RoleDenied
   ```
   See **Open Question 1** — §7.2 omits `Customer.StatusChanged`/`Customer.Converted` even though §3.2 + `CUSTOMER_TRANSITIONS` + E3-S2 imply they're needed. Author **§7.2 verbatim** (do not silently add); the gap is flagged for Heba, not for the dev to invent.
   *Files:* `src/shared/events/eventTypes.ts`, `src/shared/events/bus.ts`.

4. **AC4 — One op → one event + one audit, same correlationId (UC-2) + assertable test helper.** A single operation produces **exactly one** `DomainEvent` (published to the bus) and **exactly one** `AuditEvent` (appended to the log) sharing **one** `correlationId`. Ship a **reusable, importable test helper** (not a throwaway in one spec) that records what an operation emits and **asserts**: exactly 1 domain event, exactly 1 audit event, and `domainEvent.correlationId === auditEvent.correlationId`. Every downstream mutation story (E0-S4, Epics 1–5) imports this helper to prove UC-2.
   *Files:* `src/shared/events/correlation.ts` (`newCorrelationId()`), `src/shared/events/conformance.ts` (the helper), exercising `bus.ts` + `auditLog.ts`.

5. **AC5 — Redaction of secrets/PII in `before`/`after`.** Audit `before`/`after` snapshots pass through a redaction step that **strips secret-bearing keys** (e.g. `password`, `token`, `secret`, `apiKey`, `authorization`) and **masks emails/phones** (`a***@x.com`) per §7.4. The redaction primitive is authored here and **exported for E0-S8 to reuse** (epic AC5: "shared with E0-S8 masking") — do not write two divergent maskers.
   *File:* `src/shared/events/auditLog.ts` (exports the `redact()` helper E0-S8 imports).

## Inherited Universal Conformance (subset)

- **UC-2 — Dual events, one correlationId.** This story **defines** the guarantee and ships its test helper (AC4); every mutation downstream inherits it.
- **NFR-7 / NFR-8** — dual streams sharing one `correlationId`; the same `correlationId` is later stamped on the structured log line (E0-S8).
- **TC — Traceability.** story → spec → code → test → `Closes #`; preview green; `sprint-status.yaml`; passes `bmad-code-review`.

## Tasks / Subtasks

- [x] **Task 1 — Create the events kernel directory + `correlation.ts`** (AC: 4)
  - [x] Create the **new** `src/shared/events/` directory (currently only `data/`, `domain/`, `ui/` exist under `src/shared`).
  - [x] `src/shared/events/correlation.ts`: export `newCorrelationId(): string` returning a fresh UUID v4 via `crypto.randomUUID()` (the platform global already used by `newId`; **do not** route through `newId` — `types.ts:59-62` explicitly separates them). Unprefixed UUID is fine — `correlationId` is not an entity ID. **No new dependency.**
  - [x] Note the secure-context caveat (see deferred-work.md): `crypto.randomUUID()` needs a secure context in browsers — same risk already accepted for `newId`; no extra handling here.

- [x] **Task 2 — Canonical event-type registry** `src/shared/events/eventTypes.ts` (AC: 3)
  - [x] Export a `const` array/`Set` of the **verbatim §7.2 names** (list in AC3) — a `const` literal + derived union type, mirroring the `ID_PREFIXES` pattern (`types.ts:43-54`). **No TS `enum`** (`erasableSyntaxOnly` on).
  - [x] Export `type EventType = (typeof EVENT_TYPES)[number]` (string-literal union).
  - [x] Export `isEventType(s: string): s is EventType`.
  - [x] Do **not** add `Customer.StatusChanged`/`Customer.Converted` (Open Question 1) — author §7.2 exactly.

- [x] **Task 3 — Domain event bus** `src/shared/events/bus.ts` (AC: 1, 3)
  - [x] Define and export `interface DomainEvent<P = unknown>` per AC1 (§7.2 verbatim). `import type { ID } from '../domain/types'`.
  - [x] Implement a **synchronous in-process pub/sub** (ADR-008 pilot): `subscribe(handler: (e: DomainEvent) => void): () => void` (returns an unsubscribe fn) and `publish(event: DomainEvent): void`.
  - [x] `publish` **validates `event.type` against the registry first** (`isEventType`); a non-canonical type **throws** before any handler runs (free-form rejected — AC3). On success, dispatch synchronously to all current subscribers.
  - [x] Provide a test reset hook (e.g. clear subscribers) so specs don't leak state; mark it clearly as test-only.
  - [x] Keep generic — no entity-specific logic; E0-S12 will `subscribe`, E0-S4 will `publish`.

- [x] **Task 4 — Append-only audit log + redaction** `src/shared/events/auditLog.ts` (AC: 1, 2, 5)
  - [x] Define and export `interface AuditEvent` per AC1 (§7.1 verbatim). `import type { ID } from '../domain/types'`.
  - [x] Implement an **append-only** store: `append(event: AuditEvent): void` and read accessors (e.g. `all(): readonly AuditEvent[]`). **No `update`/`delete`/`clear` in the public production API.** Returned records are frozen/defensive copies (AC2) — mutating a returned object must not affect stored state.
  - [x] **Storage (see Reconciliation 4 + Open Question 2):** back the store so it is unit-testable in the Vitest **node** environment (no `localStorage` there). Recommended: an internal in-memory append-only array as the canonical pilot store, with localStorage write-through **only when `typeof localStorage !== 'undefined'`** (honoring ADR-008's "append-only localStorage stream" in the browser without breaking node tests). Provide a clearly test-only `__resetAuditLog()` reset (kept out of the production append-only contract).
  - [x] Export `redact(snapshot: unknown): unknown` (AC5): strip secret-bearing keys (`password`, `token`, `secret`, `apiKey`, `authorization`, …) and mask email/phone values (`a***@x.com`) per §7.4, recursively. `append` runs `before`/`after` through `redact` before storing. Export it for **E0-S8** reuse.

- [x] **Task 5 — UC-2 conformance test helper** `src/shared/events/conformance.ts` (AC: 4)
  - [x] Export a reusable helper that records emissions during an operation and asserts **1 domain event + 1 audit event + identical `correlationId`** (e.g. `recordEmissions(fn)` returning `{ events, audits }`, plus `expectOneOpOneEventOneAudit(...)` or equivalent). It must be **importable from non-test code paths** (lives in `src/shared/events`, not in a `__tests__` folder) so E0-S4 and every Epic 1–5 mutation spec can import it.
  - [x] Implement by subscribing to `bus` and wrapping `auditLog.append` (or by accepting captured arrays) — keep it framework-light; it asserts via thrown `Error`s or returns a result the caller asserts on. Do **not** hard-couple it to Vitest internals if avoidable.

- [x] **Task 6 — Tests (NFR-12, Vitest)** (AC: 1–5)
  - [x] `eventTypes.test.ts`: registry **accepts** each canonical name; **rejects** free-form/malformed (`"lead.created"` lowercase, `"Foo.Bar"`, `"LeadCreated"`, `""`). `isEventType` narrows correctly.
  - [x] `bus.test.ts`: `publish` of a canonical event reaches subscribers; `publish` of a non-canonical `type` **throws** and dispatches to **no** subscriber; `subscribe` returns a working unsubscribe.
  - [x] `auditLog.test.ts`: `append` then read returns the record; **append-only** — there is no update/delete in the API and a mutation of a returned record does not change stored state (AC2); `redact` strips secret keys and masks email/phone in `before`/`after` (AC5).
  - [x] `conformance.test.ts`: a simulated "one operation" (publish 1 event + append 1 audit with one `newCorrelationId()`) **passes** the helper; injecting two events, zero audits, or mismatched correlationIds **fails** it (prove the helper actually catches violations).
  - [x] `npm test` green (no regression to E0-S1/S2/S3's 91 tests); `npx tsc -b` clean; `npm run lint` clean.

- [x] **Task 7 — Conformance gates + DoD self-check** (AC: all)
  - [x] `npx tsc -b` (no `enum`; `import type` for `ID`), `npm run lint` (`eslint .`), `npm test` all green.
  - [x] Self-check against DoD (§10) — note which items are N/A for an events-kernel story (no UI, no auth context yet, no Repository) vs which now apply (this story *is* the event/audit emission machinery §7).

## Dev Notes

### What this story is (and is NOT)
The **event/audit/correlation kernel** (ADR-008) — the dual-stream machinery that the 4-beat use case (E0-S4) emits into and that notifications (E0-S12) subscribe to. Unlike E0-S1/S2/S3 (type-only modules), **this story ships runtime**: a pub/sub bus, an append-only audit store, a canonical-name registry with publish-time enforcement, a `correlationId` minter, a redaction helper, and a reusable UC-2 test helper.

**It is NOT:** the 4-beat orchestration itself (that's E0-S4's `mutate()` wrapper, which *calls* `bus.publish` + `auditLog.append`), the structured logger (E0-S8 — it reuses this story's `redact()`), the entity `Repository`/localStorage adapter (E0-S4), any UI/timeline (Epics 2–5), or notification projection (E0-S12). Build order: **S7 ships before S4** — so this kernel **must not depend on the Repository or on `getAuthContext()`** (neither exists yet). It deals in events/audits handed to it.

### 🚨 Source of truth — copy §7.1/§7.2 VERBATIM; four reconciliations + one open question
`_bmad-output/project-context.md` **§7** is canonical. Architecture data-dictionary **line 526** reinforces: "`AuditEvent` / `DomainEvent` **exactly as defined**." The **constitution wins** over the epic file's drift (no decision-log entry authorizes the drift) — same rule E0-S3 applied. [Source: project-context.md §7; architecture.md:526]

- **🚨 Reconciliation 1 — timestamp field is `occurredAt`, NOT `ts`.** Epic AC1 says "`ts`"; constitution §7.1/§7.2 both use **`occurredAt: string`** (ISO 8601 UTC). `ts` is the **structured-log-line** field (§7.4 / architecture:530 → E0-S8), conflated into the epic AC. Use `occurredAt` on both event shapes. [Source: project-context.md §7.1, §7.2; architecture.md:530]
- **🚨 Reconciliation 2 — `AuditEvent` discriminator is `action`, `DomainEvent`'s is `type`.** Epic AC1 lists "`type`" for both. Constitution: `AuditEvent.action: string` (e.g. `"lead.convert"`) and `DomainEvent.type: string` (e.g. `"Lead.Created"`). They are **different fields with different conventions** (audit action = lowercase dotted verb; domain type = the canonical PascalCase registry name). Keep both verbatim. [Source: project-context.md §7.1, §7.2]
- **🚨 Reconciliation 3 — id fields differ: `AuditEvent.id` vs `DomainEvent.eventId`.** Not a typo to "fix." `eventId` is the production outbox idempotency key (ADR-008: "at-least-once → idempotent consumers keyed on `eventId`"). Keep `id` on audit, `eventId` on domain. [Source: project-context.md §7.1, §7.2; architecture.md:370-372]
- **🚨 Reconciliation 4 — audit persistence: own the localStorage stream directly, with an in-memory fallback.** ADR-008 (pilot) says the audit log is "an append-only **localStorage** stream," but build order puts E0-S7 **before** E0-S4 (the entity Repository). The audit log is its **own** stream — **not** entity persistence via `Repository<T>` — so `auditLog.ts` may touch `localStorage` **directly** (it is shared infra, not `src/features/*` code; §4's "feature code never touches localStorage" does not bind shared infra). Because the Vitest env is **node** (no `localStorage`, and E0-S1 review **removed** jsdom as premature), back the store with an **in-memory array** by default and write through to `localStorage` only when present. [Source: architecture.md#ADR-008:357-364; E0-S3 dev notes — "no jsdom"; project-context.md §4]

### The exact shapes to author (from §7.1/§7.2 — verbatim)
```ts
// src/shared/events/bus.ts
import type { ID } from '../domain/types';

export interface DomainEvent<P = unknown> {
  eventId: ID;            // prod outbox idempotency key (ADR-008)
  type: string;           // canonical registry name, e.g. "Lead.Created"
  tenantId: ID;
  subsidiaryId: ID | null;
  actorId: ID;
  occurredAt: string;     // ISO 8601 UTC  (NOT "ts" — Reconciliation 1)
  payload: P;
  correlationId: string;
}

// src/shared/events/auditLog.ts
import type { ID } from '../domain/types';

export interface AuditEvent {
  id: ID;                 // (NOT eventId — Reconciliation 3)
  tenantId: ID;
  subsidiaryId: ID | null;
  actorId: ID;
  action: string;         // lowercase dotted verb, e.g. "lead.convert" (NOT "type" — Reconciliation 2)
  entityType: string;
  entityId: ID;
  occurredAt: string;     // ISO 8601 UTC
  before?: unknown;       // redacted (AC5)
  after?: unknown;        // redacted (AC5)
  correlationId: string;
}
```

### Architecture compliance (guardrails)
- **File locations are fixed by the source tree** ([architecture.md:797-802]): `src/shared/events/{bus.ts, auditLog.ts, eventTypes.ts, correlation.ts}` — a **new** `src/shared/events/` directory. `logger.ts` in that listing is **E0-S8, not this story** — do not create it. `conformance.ts` (the AC4 helper) and any `redact` location are story-justified additions to that module folder; keep them inside `src/shared/events/`. **No barrel `index.ts`** (E0-S1/S2/S3 established direct-file imports). [Source: architecture.md#Source-Tree:797-802]
- **ADR-008 (the ADR for this story):** two tenant-tagged immutable streams; one mutation → exactly one of each, one `correlationId`; **not** event sourcing (entities remain the source of truth). Pilot = synchronous in-process pub/sub + append-only localStorage audit. The production outbox/CQRS-lite is **design-only** (Epic 6) — **do not build it**; just keep `eventId` so the seam is honored. [Source: architecture.md#ADR-008:357-373]
- **The 4-beat is E0-S4, not here** — but author these primitives to slot into it exactly. The reference shape ([architecture.md:540-561]): `bus.publish(domainEvent(result, correlationId))` then `auditLog.append(auditEvent(result, correlationId))`, both **after** a successful mutate; a failed authorize emits **no** domain event (denials → `Auth.RoleDenied` audited only). Your `publish`/`append` are the two calls beats 3 and 4 make. [Source: architecture.md:540-561]
- **`correlationId` discipline (Pattern 7):** minted **once at the start of the user action** and threaded through domain event + audit + (later) log line. This story provides the minter (`newCorrelationId`) and the two sinks; the *threading* happens in E0-S4. [Source: architecture.md#Pattern-7:640-645]
- **Activity-timeline vs Audit-log split (ADR-016):** the timeline reads the **`DomainEvent`** stream (`entityType + entityId`, scoped); the raw audit log reads **`AuditEvent`** (`before/after`). Two surfaces, two streams — which is exactly why this story keeps them as **separate** structures with separate fields. Access gating is E0-S6/E4-S4's job, not here. [Source: architecture.md#ADR-016:470-487]
- **NFR-1 one-way dependency:** shared-layer module; imports **nothing** from `src/features/*`. Only import is the sibling `import type { ID } from '../domain/types'`. [Source: project-context.md §1]
- **No tenant/auth coupling:** events/audits carry `tenantId`/`subsidiaryId`/`actorId` as **data on the record** (set by the caller/E0-S4 from auth context). This kernel does **not** call `getAuthContext()` or `useAuth()` (E0-S5, not built). Do not import auth. [Source: architecture.md:543-544]

### 🚨 Compiler constraints — same ones E0-S1/S2/S3 hit (don't relearn the hard way)
[tsconfig.app.json] sets `"verbatimModuleSyntax": true` and `"erasableSyntaxOnly": true` (`target es2023`, `lib ["ES2023","DOM"]`, `@types/node` present so `crypto`/`localStorage` globals type-resolve).
- **`import type` for types** — `ID` is a type: `import type { ID } from '../domain/types'`. A plain `import` fails `verbatimModuleSyntax`.
- **No TS `enum`** — the registry is a `const` array + derived union (mirror `ID_PREFIXES` at `types.ts:43-54`), never `enum EventType {…}` (breaks `erasableSyntaxOnly`).
- Unlike E0-S3 this module **does emit JS** (runtime functions) — that's expected and correct here.

### Testing (NFR-12) — what works in this repo
- **Vitest is already wired** (`vitest ^4.1.8`, node environment, `"test": "vitest run"`). **Add no test deps.** Do **not** add jsdom/RTL/`localStorage` polyfills — E0-S1 review explicitly removed them as premature; E0-S11 owns the full harness. This is why the audit store **must** have an in-memory path (Reconciliation 4): node has no `localStorage`. [Source: E0-S3 dev notes; 0-1 Review Findings]
- Reset bus subscribers and audit store between tests (use the test-only reset hooks) so specs don't leak state.
- The **conformance helper (AC4) is production test infrastructure**, not a one-off: it must live in `src/shared/events/` and be importable by E0-S4 and every Epic 1–5 mutation spec. Write its own spec that proves it **fails** on violations (2 events / 0 audits / mismatched correlationId), not just passes on the happy path.

### Previous-story intelligence (E0-S1/S2/S3 — `done`/`review`)
- **`ID` exists** at `src/shared/domain/types.ts:16` — `import type { ID } from '../domain/types'`; do not redefine. `newId`/`ID_PREFIXES` show the `const`-map-not-enum pattern to mirror for the registry. [src/shared/domain/types.ts:43-63]
- **`types.ts:59` already names this story:** "`newId` … is NOT `newCorrelationId()` (that's events/correlation.ts, E0-S7)." Honor that contract — `correlation.ts` exports `newCorrelationId`, kept distinct from `newId`.
- **Verbatim-from-constitution + log reconciliations** is the established play (E0-S2 three reconciliations, E0-S3 two): copy §7 exactly, apply only the explicitly-flagged reconciliations, raise genuinely ambiguous gaps as Open Questions rather than inventing. [0-2 / 0-3 dev notes]
- **Compile-time test pattern** (`// @ts-expect-error`-guarded negatives caught by `tsc -b`) carries over for the type-shape assertions; combine with normal runtime Vitest specs for the bus/audit/registry behavior. [src/shared/domain/types.test.ts]
- **ESLint has no `argsIgnorePattern`** — don't leave unused params named `_x`; drop unused params instead (E0-S3 hit this). [0-3 Debug Log]
- **Deferred item now relevant here:** `crypto.randomUUID()` needs a secure context in browsers ([deferred-work.md]). `newCorrelationId` uses the same global — same accepted risk, no new mitigation in this story; just be aware.

### Git intelligence
- Branch `story/E0-S7-audit-log-domain-event-bus-with` is **already checked out** (branch-per-story). Baseline = `429feba feat(E0-S3)` (frontmatter `baseline_commit`).
- **No `src/shared/events/` directory and no `bus.ts`/`auditLog.ts`/`eventTypes.ts`/`correlation.ts` exist** — everything in this story is **NEW**; nothing to preserve or regress. The `Prototype/` assets are illustrative UI only, not a code source.
- Implementation commits to mirror for module/test shape: `bbb246b` (E0-S1 status), `7b0aeb3` (E0-S2 types), `429feba` (E0-S3 repository).

### Web research
- **N/A — zero external dependencies.** This story uses only TypeScript, the `crypto` platform global (already in use), and the already-wired Vitest. No library/version research applies (mirrors E0-S3). Do **not** add `uuid`, an event-emitter lib, or any pub/sub package — a synchronous in-process pub/sub is a few lines and ADR-008 specifies in-process for the pilot.

### Project Structure Notes
- Stack: React 19 + TypeScript ~6.0.2 + Vite 8, Vitest 4.1.8, npm. [package.json]
- Naming: the source tree pins lowerCamel filenames for this module (`bus.ts`, `auditLog.ts`, `eventTypes.ts`, `correlation.ts`) — match it exactly (note `auditLog.ts`, not `audit-log.ts`). Tests mirror source casing (`bus.test.ts`, etc.). [architecture.md:797-802; project-context.md §9]
- No React in this story — plain `.ts`. ESLint flat config applies; keep lint-clean.

### Definition of Done (scoped for an events-kernel story) — constitution §10
**Applicable & now in-scope:** meets ACs; passes `bmad-code-review`; reuses shared types (`ID` from E0-S2, no redefinition); statuses/event names come from the single sources (§7.2 registry — illegal/free-form names **rejected**, the kernel-level analogue of "illegal transitions rejected"); **every mutation emits one audit + one domain event (§7)** — this story is the machinery that makes that true and ships the test helper proving it; `tsc -b` + `eslint` + tests green; traceable chain (`Closes #<issue>`).
**N/A for this story** (bind the consuming stories): tenant-scope *enforcement* via auth context (E0-S4/S5/S6 — here `tenantId` is data on the record, not enforced), the four UI states (no UI — E0-S9), REST status codes (E0-S4 adapter), Zod validation (E0-S4), the structured **log line** + PII masking *in logs* (E0-S8 — this story ships only the reusable `redact()` it will import).

### References
- [Source: _bmad-output/planning-artifacts/epics/epic-0-platform-guidelines/E0-S7.md] — story spec & ACs (note `ts`→`occurredAt` Reconciliation 1, `type`→`action` Reconciliation 2)
- [Source: _bmad-output/planning-artifacts/epics/epic-0-platform-guidelines/epic-0.md#Feature-0.4] — epic context; build order S7+S8, S7 before S4 (S7 unblocks S4)
- [Source: project-context.md#7] — §7.1 `AuditEvent`, §7.2 `DomainEvent` (**copy verbatim**), §7.2 canonical event-type list, §7.3 naming rules, §7.4 PII masking (the `redact` shared with E0-S8)
- [Source: project-context.md#3.2] — "every accepted change emits a `*.StatusChanged` event" (basis for Open Question 1)
- [Source: architecture.md#ADR-008:357-373] — dual streams, in-process bus + append-only audit, one correlationId, `eventId` idempotency, not-event-sourcing, prod outbox is design-only
- [Source: architecture.md:540-561] — the 4-beat reference shape (E0-S4) this kernel's `publish`/`append` slot into
- [Source: architecture.md#Pattern-7:640-645] — correlationId minted at action start, threaded through all three streams
- [Source: architecture.md#ADR-016:470-487] — Activity-timeline (DomainEvent) vs Audit-log (AuditEvent) split — why two separate structures
- [Source: architecture.md#Source-Tree:797-802] — `src/shared/events/{bus,auditLog,eventTypes,correlation}.ts` locations; `logger.ts` is E0-S8; no barrel
- [Source: architecture.md:520-530] — data-dictionary: "Audit/event shapes exactly as defined" (526); log line uses `ts` (530, E0-S8)
- [Source: src/shared/domain/types.ts] — `ID` to import (do not redefine); `ID_PREFIXES`/`newId` const-map-not-enum pattern; `:59` separates `newId` from `newCorrelationId`
- [Source: _bmad-output/implementation-artifacts/0-3-define-repository-page-listquery.md] — previous-story learnings (Vitest wiring, no new deps/jsdom, `import type`, no enum, ESLint unused-param)
- [Source: _bmad-output/implementation-artifacts/deferred-work.md] — `crypto.randomUUID()` secure-context caveat (applies to `newCorrelationId`)
- [Source: tsconfig.app.json] — `verbatimModuleSyntax`, `erasableSyntaxOnly` (no enum; `import type`)
- PRD: prd.md §6 E0-S7 · ADR(s): ADR-008 · Inherited UC: UC-2 (dual events), TC (traceability)

## Open Questions (for Heba — do not block implementation; default actions noted)

1. **Registry gap — `Customer.StatusChanged` / `Customer.Converted` are absent from §7.2's canonical list, yet §3.2 ("every accepted change emits a `*.StatusChanged` event") + `CUSTOMER_TRANSITIONS` + E3-S2 ("walk a customer prospect→onboarding→active") will need them.** Lead has `Lead.StatusChanged` + `Lead.Converted`; Customer does not. **Default action for this story:** author the registry **verbatim per §7.2** (do not invent names — free-form is rejected by design). **Decision needed before E3-S2:** add `Customer.StatusChanged` (and possibly `Customer.Converted`) to the constitution §7.2 list via a `decision-log.md` entry, after which the registry is extended. Flagging now so E3-S2 isn't blocked by a publish-time rejection. *(Mirrors how E0-S3's Reconciliation 1 was confirmed by you.)*
2. **Audit-log pilot storage — confirm in-memory-default + localStorage-write-through (Reconciliation 4).** ADR-008 says "append-only localStorage stream," but E0-S7 ships before the Repository (E0-S4) and Vitest runs in node (no `localStorage`, jsdom removed as premature). **Default action:** in-memory append-only array as the canonical store, writing through to `localStorage` only when present, with a test-only reset. Confirm this is acceptable vs. requiring localStorage-backed-only (which would force a test-env storage shim now).
3. **`correlationId` format.** **Default action:** unprefixed UUID v4 from `crypto.randomUUID()` (not type-prefixed — it's not an entity ID; `WorkflowInstance.correlationId` is just `string`). Confirm you don't want a `cor_`-style prefix for log-grepping legibility.

## Dev Agent Record

### Agent Model Used

claude-opus-4-8[1m] (Claude Opus 4.8, 1M context) — bmad-dev-story workflow.

### Debug Log References

- `npx tsc -b` — clean (no `enum`, `import type { ID }` for the type-only import; this module also emits runtime JS, which is expected here unlike E0-S3).
- `npm test` — **142 passed** (91 prior E0-S1/S2/S3 + 51 new across 4 new spec files); no regressions.
- `npm run lint` (`eslint .`) — clean. No unused params (ESLint has no `argsIgnorePattern` — carried the E0-S3 lesson; dropped the unused `_rest` capture name is still referenced in the replacer signature, kept positional).

### Completion Notes List

- **AC1 — shapes verbatim (§7.1/§7.2):** `DomainEvent<P=unknown>` in `bus.ts`, `AuditEvent` in `auditLog.ts`, both `import type { ID } from '../domain/types'` (E0-S2, not redefined). All four reconciliations applied: `occurredAt` not `ts` (R1), `AuditEvent.action` vs `DomainEvent.type` (R2), `AuditEvent.id` vs `DomainEvent.eventId` (R3).
- **AC2 — append-only:** `auditLog` exposes only `append` + `all` (+ exported `redact`, + test-only `__resetAuditLog`). No update/delete/clear. Stored and returned records are **frozen deep copies** (`structuredClone` + recursive `Object.freeze`) — verified that mutating an input after append, and mutating a returned record (throws in strict ESM), both leave stored state unchanged.
- **AC3 — registry enforced at publish:** `eventTypes.ts` exports the verbatim 19-name §7.2 list as a `const` array + derived `EventType` union + `isEventType` guard (Set-backed). `bus.publish` validates `isEventType(event.type)` **first** and throws before any handler runs; nothing is dispatched and no audit is written by the bus.
- **AC4 — UC-2 helper:** `conformance.ts` ships `recordEmissions(fn)` / `assertOneOpOneEventOneAudit` / `expectOneOpOneEventOneAudit`. Framework-light (plain `Error`s, no Vitest coupling), observes via the real public APIs (`subscribe` + `all()` diff), lives in `src/shared/events/` so E0-S4 and Epics 1–5 can import it. Its spec proves it **fails** on 2-events / 0-audits / mismatched-correlationId, not just the happy path.
- **AC5 — redaction (shared with E0-S8):** `redact()` recursively drops secret-bearing key values (`password`/`token`/`secret`/`apiKey`/`authorization`, case-insensitive → `[REDACTED]`) and masks emails (`a***@x.com`). **Quality refinement:** phone masking is **whole-value only** (not embedded-substring) so it cannot mangle ISO 8601 timestamps or ids that live inside `before`/`after` snapshots — added a regression test for that. `append` runs `before`/`after` through `redact` before storing; `redact` is pure (input untouched) and exported for E0-S8.
- **Open Questions (unchanged — defaults taken, flagged for Heba):** (1) `Customer.StatusChanged`/`Customer.Converted` deliberately **absent** (authored §7.2 verbatim; decision-log entry needed before E3-S2). (2) in-memory-default + localStorage-write-through storage adopted. (3) unprefixed UUID v4 for `correlationId`.
- **DoD self-check (§10):** *Applies & met* — meets ACs; reuses `ID` (no redefinition); event names from the single §7.2 registry with free-form **rejected** (the kernel analogue of "illegal transitions rejected"); this story *is* the one-op→one-audit+one-event machinery and ships the proving helper; `tsc -b` + `eslint` + tests green. *N/A here (bind consumers):* tenant-scope enforcement via auth context (E0-S4/S5/S6 — `tenantId` is data on the record here), the four UI states (E0-S9), REST codes/Zod (E0-S4), the structured log line + in-log PII masking (E0-S8 — this story ships only the reusable `redact()`).

### File List

- `src/shared/events/correlation.ts` (new) — `newCorrelationId()`
- `src/shared/events/eventTypes.ts` (new) — `EVENT_TYPES`, `EventType`, `isEventType`
- `src/shared/events/bus.ts` (new) — `DomainEvent`, `subscribe`, `publish`, `__resetBus`
- `src/shared/events/auditLog.ts` (new) — `AuditEvent`, `append`, `all`, `redact`, `__resetAuditLog`
- `src/shared/events/conformance.ts` (new) — `recordEmissions`, `assertOneOpOneEventOneAudit`, `expectOneOpOneEventOneAudit`
- `src/shared/events/eventTypes.test.ts` (new)
- `src/shared/events/bus.test.ts` (new)
- `src/shared/events/auditLog.test.ts` (new)
- `src/shared/events/conformance.test.ts` (new)
- `_bmad-output/implementation-artifacts/sprint-status.yaml` (modified) — E0-S7 → in-progress → review

### Review Findings

_bmad-code-review (2026-06-07). All 5 ACs verified SATISFIED by the Acceptance Auditor; gates re-run green (142 tests, `tsc -b`, `eslint`). Findings below are robustness/hardening beyond the literal ACs — none block acceptance, but two need a call from Heba._

- [x] [Review][Patch] PII/secret masking precision (Decision 1 → "Patch precision now", 2026-06-07) — Tighten `redact`'s phone heuristic ([auditLog.ts:236](../../src/shared/events/auditLog.ts#L236)) to stop over-masking 7–15-digit *numeric identifiers* (zip+4 `"12345-6789"` → `"***89"`, 7-digit order IDs); mask 16+ digit runs (card PANs that currently slip past the `<= 15` ceiling); and add **value-based** secret detection so a token under a generic key (`{ data: "Bearer eyJ…" }`, JWT-shaped values) is redacted, not just key-name matches ([auditLog.ts:280](../../src/shared/events/auditLog.ts#L280)). This masker is reused by E0-S8. [blind+edge]
- [x] [Review][Patch] Conformance helper — correlationId filtering (Decision 2 → "Add correlationId filtering", 2026-06-07) — In `assertOneOpOneEventOneAudit` ([conformance.ts:698](../../src/shared/events/conformance.ts#L698)), filter captured audits by the operation's domain-event correlationId so an unrelated in-window append can no longer validate the wrong audit or trip a false "got 2"; preserve the existing correlationId-mismatch detection. (Async/nesting support intentionally out of scope for this patch.) [blind+edge]
- [x] [Review][Patch] Audit `append` must be crash-safe — a **cyclic** `before`/`after` overflows `redact`'s unguarded recursion (`RangeError`), and a **function/symbol** value (which `redact` passes through untouched) throws `DataCloneError` in `structuredClone`; either path makes `append` **throw and drop the audit entirely** — and in the 4-beat the domain event has already published, so the result is 1 event / 0 audits (a silent UC-2 break). Add a seen-set/depth guard in `redact` and a safe-clone fallback so an audit is always recorded. [auditLog.ts:270-307](../../src/shared/events/auditLog.ts#L270-L307), [auditLog.ts:326](../../src/shared/events/auditLog.ts#L326) [blind+edge]
- [x] [Review][Patch] Isolate subscriber errors in `bus.publish` — the dispatch loop has no try/catch ([bus.ts:512](../../src/shared/events/bus.ts#L512)); a single throwing handler aborts delivery to **all later subscribers** and propagates out of `publish`, breaking the publishing mutation. Wrap each `handler(event)` so one bad subscriber can't starve the rest (the `[...subscribers]` snapshot already handles (un)subscribe-during-dispatch). [bus.ts:506-515](../../src/shared/events/bus.ts#L506-L515) [blind+edge]
- [x] [Review][Defer] localStorage write-through silently diverges on a `bigint` payload — `persist()` does `JSON.stringify(store)` which throws on bigint; the `catch` swallows it, so the durable mirror silently desyncs from memory. In-memory is the pilot source of truth, so this only bites the browser persistence path. [auditLog.ts:310-318](../../src/shared/events/auditLog.ts#L310-L318) — deferred, revisit with real persistence (E0-S4 / backend). [blind+edge]
- [x] [Review][Defer] `publish` hands the same mutable event to every handler despite the `DomainEvent` "immutable" doc claim — a subscriber can mutate `payload`/`correlationId` for later subscribers (and after the audit was appended). [bus.ts:506-515](../../src/shared/events/bus.ts#L506-L515) — deferred, low risk under the synchronous single-trust pilot; revisit if handlers become untrusted. [blind+edge]

**Dismissed as noise (6):** email mask keeps the domain by design (matches AC5 `a***@x.com`); `all()` redundant clone+freeze is a pilot micro-opt with no correctness impact; explicit-`undefined` `before`-key shape nit; tests assert only top-level freeze but `deepFreeze` is verified recursive; `publish` error interpolates the raw type (not rendered → no real injection); `crypto.randomUUID()` secure-context is an already-documented accepted risk (deferred-work.md, from E0-S2).

**Non-finding callout:** the omission of `Customer.StatusChanged` / `Customer.Converted` from the registry is correct (authored §7.2 verbatim) and is already tracked as **Open Question 1** — it will block E3-S2 at publish time until a `decision-log.md` entry extends §7.2. No action in this story.

## Change Log

| Date       | Change                                                                 |
|------------|------------------------------------------------------------------------|
| 2026-06-07 | Story context created (ready-for-dev): ADR-008 event/audit/correlation kernel — bus, append-only audit log + redaction, canonical registry, `newCorrelationId`, UC-2 conformance helper. Reconciliations 1–4 logged (occurredAt/action/eventId/storage); 3 Open Questions raised. |
| 2026-06-07 | Implemented E0-S7 (Tasks 1–7). New `src/shared/events/` kernel: `correlation.ts`, `eventTypes.ts` (verbatim §7.2 registry + publish-time enforcement), `bus.ts` (sync in-process pub/sub), `auditLog.ts` (append-only + frozen defensive copies + shared `redact()`), `conformance.ts` (UC-2 helper). 4 spec files added; 142 tests pass (51 new, no regressions); `tsc -b` + `eslint` clean. Phone masking made whole-value-only to avoid mangling timestamps in audit snapshots. Status → review. |
| 2026-06-07 | `bmad-code-review`: all 5 ACs verified satisfied (Acceptance Auditor + re-run gates). 2 decisions resolved → patches; 4 patches applied: (1) crash-safe `append` (cycle guard in `redact`, function/symbol drop, `Date`→ISO, safe-clone fallback) so the audit write never throws/loses a record; (2) `bus.publish` isolates subscriber failures (delivers to all, AggregateError after); (3) `redact` masking precision — no longer over-masks numeric ids, masks 13–19-digit PANs, masks value-borne bearer/JWT secrets; (4) conformance helper filters audits by the op's correlationId. 11 tests added; **153 pass**, `tsc -b` + `eslint` clean. 2 findings deferred (localStorage bigint divergence, mutable published event), 6 dismissed. Status → done. |
