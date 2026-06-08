---
baseline_commit: 2936359
---

# Story 0.8: Structured logger

Status: done

- **Story ID:** E0-S8 (`0-8-structured-logger`)
- **Epic:** E0 — Platform Guidelines & Standards (the governing contract) · **Feature:** 0.4 — Event, Audit & Logging Kernel
- **Cut:** Pilot · **Depends on:** E0-S7 (correlationId minter + shared `redact()`) · **ADRs:** ADR-008 · **Constitution:** §7.4

## Story

As the platform,
I want all logging to emit structured JSON with tenant/actor context and a `correlationId`, with PII masked,
so that operations are traceable end-to-end without leaking sensitive data.

## Acceptance Criteria

1. **AC1 — Structured JSON shape.** The logger emits JSON `{ ts, level, tenantId, subsidiaryId, actorId, msg, correlationId, ...extra }` (§7.4 verbatim). Context (tenant/subsidiary/actor/correlationId) is threaded from a caller-supplied context object, not from `useAuth()` or any React hook — the logger is a pure shared-layer module.
   - `ts`: ISO 8601 UTC timestamp (`new Date().toISOString()`)
   - `level`: one of `"error" | "warn" | "info" | "debug"`
   - `tenantId`, `subsidiaryId`, `actorId`: from the log context (string IDs; `subsidiaryId` may be `null`)
   - `msg`: the human-readable message string
   - `correlationId`: the active operation's correlationId (same one on the DomainEvent and AuditEvent for that action)
   - Extra fields: any additional key/value pairs passed by the caller, passed through `redact()` before emission
   *File:* `src/shared/events/logger.ts`

2. **AC2 — PII masking (NFR-8).** The `msg` string and any extra fields are run through `redact()` (imported from `src/shared/events/auditLog.ts`) before the log record is emitted. No tokens, passwords, emails (unmasked), phones (unmasked), or PII bodies ever appear in output.
   *File:* `src/shared/events/logger.ts`

3. **AC3 — Levels.** The logger exposes `error`, `warn`, `info`, `debug` methods. Each produces a record with the correct `level` field value. In production the output sink is `console.error` / `console.warn` / `console.log` / `console.log` respectively (no external log library).
   *File:* `src/shared/events/logger.ts`

## Inherited Universal Conformance (subset)

- **TC — Traceability.** story → spec → code → test → `Closes #`; sprint-status.yaml updated; passes `bmad-code-review`.
- **NFR-1 one-way dependency:** `src/shared/events/logger.ts` imports only from siblings in `src/shared/events/` and `src/shared/domain/`. Never from `src/features/*` or `src/app/*`.
- **NFR-8:** structured JSON + PII masking (this story *is* NFR-8).
- **NFR-12:** Vitest tests for all ACs.

## Tasks / Subtasks

- [x] **Task 1 — Create `src/shared/events/logger.ts`** (AC: 1, 2, 3)
  - [x] Define `LogContext` interface: `{ tenantId: string; subsidiaryId: string | null; actorId: string; correlationId: string }`.
  - [x] Define `LogLevel` type: `"error" | "warn" | "info" | "debug"` (string-literal union, no `enum`).
  - [x] Define `LogRecord` interface (the emitted shape): `{ ts: string; level: LogLevel; tenantId: string; subsidiaryId: string | null; actorId: string; msg: string; correlationId: string; [key: string]: unknown }`.
  - [x] Implement `emit(level: LogLevel, ctx: LogContext, msg: string, extra?: Record<string, unknown>): void`:
    - Build the `LogRecord` from `ctx`, adding `ts` (`new Date().toISOString()`), `level`, and `msg`.
    - Run `extra` through `redact()` before merging into the record (AC2).
    - Also run `msg` through `redact()` to strip any accidentally-included PII (AC2).
    - Output via `console.error` (error), `console.warn` (warn), `console.log` (info/debug).
    - Serialize to JSON with `JSON.stringify(record)`.
  - [x] Export four convenience methods:
    ```ts
    export const logger = {
      error(ctx: LogContext, msg: string, extra?: Record<string, unknown>): void,
      warn(ctx: LogContext, msg: string, extra?: Record<string, unknown>): void,
      info(ctx: LogContext, msg: string, extra?: Record<string, unknown>): void,
      debug(ctx: LogContext, msg: string, extra?: Record<string, unknown>): void,
    };
    ```
  - [x] No external dependencies — only `import { redact } from './auditLog'`.
  - [x] `import type` for any type-only imports; no `enum` (`erasableSyntaxOnly` on).

- [x] **Task 2 — Tests** `src/shared/events/logger.test.ts` (AC: 1, 2, 3) (NFR-12)
  - [x] Helper: capture `console.error/warn/log` output by replacing the methods temporarily and restoring after each test.
  - [x] **AC1 shape:** calling `logger.info(ctx, "msg")` emits a JSON string containing `ts`, `level: "info"`, `tenantId`, `subsidiaryId`, `actorId`, `msg: "msg"`, `correlationId` — all present and correct.
  - [x] **AC2 PII masking:** extra fields containing an email produce `a***@example.com` in output; extra fields containing `{ password: "secret" }` → value is `[REDACTED]`; `msg` containing an email is masked in the emitted record.
  - [x] **AC3 levels:** `logger.error` → `level: "error"` via `console.error`; `logger.warn` → `level: "warn"` via `console.warn`; `logger.info` → `level: "info"` via `console.log`; `logger.debug` → `level: "debug"` via `console.log`.
  - [x] **No PII leakage:** assert that unmasked email/phone/token/password never appears in the emitted string (for each: verify the raw value is NOT present, the masked form IS present).
  - [x] **`correlationId` matches:** the record's `correlationId` equals the one supplied in `ctx`.
  - [x] Restore console methods after each test (use `beforeEach`/`afterEach`).

- [x] **Task 3 — Conformance gates + DoD self-check** (AC: all)
  - [x] `npx tsc -b` — clean (no `enum`; `import type` for type-only imports).
  - [x] `npm run lint` (`eslint .`) — clean; no unused variables or params.
  - [x] `npm run test` — all tests green (306 passed, 24 new logger tests, no regressions).
  - [x] Self-check against DoD (§10).

## Dev Notes

### What this story is (and is NOT)

This is the **structured logger module** (ADR-008, §7.4): a single `logger.ts` that emits structured JSON with the correct shape and PII masking. It is **not** a log aggregator, not a React hook, not tied to any auth provider. It is a pure shared-layer utility that callers supply context to.

**It is NOT:** the 4-beat orchestration (E0-S4 owns *when* to log), the correlationId minter (E0-S7's `correlation.ts`), the audit log (E0-S7's `auditLog.ts`), the domain event bus (E0-S7's `bus.ts`), any UI component. This story only authors the logging primitive — downstream stories will call `logger.info(ctx, "Lead created", { leadId })` in their use-case implementations.

### Exact log record shape from §7.4 (verbatim)

```
{ ts, level, tenantId, subsidiaryId, actorId, msg, correlationId, ...extra }
```

**Note:** the log line uses `ts` (not `occurredAt`). This is correct and intentional — `occurredAt` is the event/audit field (Reconciliations 1 from E0-S7); `ts` is the log-line timestamp (architecture.md:530 explicitly lists `ts` for the log record). Do not "fix" this.

### Architecture compliance guardrails

- **File location is fixed:** `src/shared/events/logger.ts` (architecture.md:801). Do not create `src/shared/logging/` or `src/shared/logger.ts`.
- **No barrel `index.ts`** — E0-S1/S2/S3/S7 established direct-file imports; keep that pattern.
- **ADR-008:** the `correlationId` is minted once per user action (E0-S4/Pattern 7) and threaded through DomainEvent, AuditEvent, and the log line. The logger does not mint its own `correlationId` — the caller provides the one minted at action start.
- **NFR-1:** `logger.ts` must import nothing from `src/features/*` or `src/app/*`. The only import is `import { redact } from './auditLog'`.
- **No auth coupling:** the logger accepts tenant/actor context as plain data, not via `useAuth()` or `getAuthContext()`. This keeps it usable in node test environments and in non-React code.
- **No external logging library:** ADR-008 specifies in-process for the pilot. Use `console.error/warn/log`. No pino, winston, loglevel, or similar.

### Compiler constraints (same as E0-S1/S2/S3/S7 — don't relearn)

`tsconfig.app.json` sets `verbatimModuleSyntax: true` and `erasableSyntaxOnly: true` (`target: es2023`).
- **`import type` for type-only imports.** If you import only a type, use `import type { ... }`.
- **No TS `enum`.** Use a string-literal union: `type LogLevel = "error" | "warn" | "info" | "debug"`.
- The logger emits runtime JS (it calls `console.*`) — unlike E0-S3 which was type-only, this module is expected to emit JS. `tsc -b` should still be clean.

### Testing — what works in this repo (from E0-S7 learnings)

- **Vitest already wired** (vitest ^4.1.8, node environment, `"test": "vitest run"`). No test deps to add.
- **Node has no `localStorage`** — irrelevant for this story (the logger uses `console.*`).
- **No jsdom/RTL** needed — this is a plain TS module; no React or DOM.
- **Spy/replace `console` methods** in tests — capture what was logged and assert on it. Use `beforeEach`/`afterEach` to restore.
- **Recommended test pattern:**
  ```ts
  let captured: string[] = [];
  const origLog = console.log;
  beforeEach(() => {
    captured = [];
    console.log = (msg: string) => { captured.push(msg); };
  });
  afterEach(() => {
    console.log = origLog;
  });
  ```
  Then assert `JSON.parse(captured[0])` has the expected shape.
- Do NOT import Vitest-internal `vi.spyOn` if avoidable — plain replacement is framework-light and portable.

### Previous-story intelligence (E0-S7 — `done`)

- **`redact(snapshot: unknown): unknown`** is exported from `src/shared/events/auditLog.ts:127`. Import it: `import { redact } from './auditLog'`. It is pure (does not mutate its input) and recursively handles objects, arrays, and string values.
- **`newCorrelationId()`** is at `src/shared/events/correlation.ts:19`. The logger does NOT call this — the caller provides the correlationId.
- **Pattern to mirror:** the no-`enum`, `const`-array + derived union shape from `eventTypes.ts` (for the `LogLevel` union this is simpler — just a `type`).
- **ESLint has no `argsIgnorePattern`** — drop unused params entirely (don't name them `_x`).
- **`structuredClone`** is available (ES2022, node env) — you can use it if needed, but `JSON.stringify` + `JSON.parse` is simpler for the log record.
- **Prior compile warnings:** `import type` for type-only symbols; plain `import` for runtime values (`redact` is a runtime value, so a plain `import { redact }` is correct).

### Git intelligence

- Baseline commit: `2936359` (E0-S4 LocalStorageRepository).
- `src/shared/events/` already exists with 9 files from E0-S7. `logger.ts` and `logger.test.ts` do **not exist yet** — they are the only new files this story creates.
- Prior commit style: `feat(E0-S7): Audit log + domain event bus with shared correlationId` — match this pattern.

### Web research

**N/A — zero external dependencies.** Console output + TypeScript + Vitest already in place. No library/version research needed.

### Project structure notes

- Stack: React 19 + TypeScript ~6.0.2 + Vite 8, Vitest 4.1.8, npm.
- Naming: `logger.ts` (lowerCamel, matching `auditLog.ts`, `eventTypes.ts`) as specified at architecture.md:801.
- Test file: `logger.test.ts` (same naming pattern as `bus.test.ts`, `auditLog.test.ts`).
- ESLint flat config applies; keep lint-clean.

### Definition of Done (scoped for a logger story) — constitution §10

**Applicable & met when:**
- Meets all 3 ACs
- `tsc -b` clean (no enum; `import type` for type-only imports)
- `npm run lint` clean
- `npm run test` all green (153 existing + new logger tests)
- `redact()` reused from E0-S7 (no second masker defined)
- Passes `bmad-code-review`
- Traceable chain (`Closes #<issue>`)

**N/A for this story:** tenant-scope enforcement (logger accepts context as data, not enforced here), four UI states (no UI), REST status codes (no HTTP here), the 4-beat orchestration (E0-S4 owns that), the Repository/localStorage (not touched).

### References

- [Source: _bmad-output/planning-artifacts/epics/epic-0-platform-guidelines/E0-S8.md] — story spec & ACs
- [Source: project-context.md §7.4] — log shape verbatim: `{ ts, level, tenantId, subsidiaryId, actorId, msg, correlationId }`; "never log" passwords/tokens/PII bodies; mask emails/phones
- [Source: architecture.md:530] — data-dictionary confirms `ts` for the log line (not `occurredAt`)
- [Source: architecture.md#ADR-008:357-373] — one correlationId across event + audit + log
- [Source: architecture.md#Pattern-7:640-645] — correlationId minted at action start, threaded into log lines; JSON; emails/phones masked
- [Source: architecture.md:801] — `src/shared/events/logger.ts` (E0-S8)
- [Source: src/shared/events/auditLog.ts:127] — `redact()` export to reuse
- [Source: src/shared/events/correlation.ts:19] — `newCorrelationId()` (caller provides this, logger does not mint)
- [Source: _bmad-output/implementation-artifacts/0-7-audit-log-domain-event-bus-shared-correlationid.md] — E0-S7 learnings; ESLint argsIgnorePattern absent; no jsdom; `import type` for type-only; no enum
- PRD: prd.md §6 E0-S8 · ADR(s): ADR-008 · Inherited UC: TC · Constitution: §7.4

## Dev Agent Record

### Agent Model Used

claude-sonnet-4-6 — bmad-dev-story workflow.

### Debug Log References

- `npx tsc -b` — clean (no `enum`; plain `import { redact }` for runtime import; `import type` pattern honored for type-only imports in tests).
- `npm run test` — **306 passed** (282 prior baseline + 24 new in `logger.test.ts`); no regressions.
- `npm run lint` (`eslint .`) — clean.
- Post-review patches: `npx tsc -b` clean, `npm run test` **310 passed** (4 additional tests), `eslint` clean.

### Completion Notes List

- **AC1 — Structured JSON shape (§7.4 verbatim):** `LogContext` (`tenantId`, `subsidiaryId|null`, `actorId`, `correlationId`), `LogRecord` (`ts`, `level`, `tenantId`, `subsidiaryId`, `actorId`, `msg`, `correlationId`, `...extra`), and `LogLevel` type all authored. `ts` is ISO 8601 from `new Date().toISOString()` — correctly `ts` not `occurredAt` (the log-line timestamp convention; architecture.md:530 confirms).
- **AC2 — PII masking:** `emit()` runs `msg` and `extra` through `redact()` (imported from `auditLog.ts` — single shared masker, no second one defined). Emails masked to `a***@domain.com`; `password`/`token`/`secret`/`apiKey`/`authorization` keys redacted to `[REDACTED]`; tested with nested objects.
- **AC3 — Levels:** `logger.error` → `console.error`; `logger.warn` → `console.warn`; `logger.info` / `logger.debug` → `console.log`. Each produces exactly one line per call with the correct `level` field.
- **No external dependencies:** only `import { redact } from './auditLog'`. No pino/winston/loglevel.
- **NFR-1 honored:** `logger.ts` imports nothing from `src/features/*` or `src/app/*`.
- **DoD self-check (§10):** Meets all 3 ACs; reuses `redact()` from E0-S7; `tsc -b` + `eslint` + tests all green; no new layout/component/status/event-name invented; traceable chain ready for `Closes #<issue>`. N/A items: tenant-scope enforcement (logger accepts context as data), four UI states, REST codes, 4-beat orchestration.

### File List

- `src/shared/events/logger.ts` (new) — `LogContext`, `LogLevel`, `LogRecord`, `logger` (error/warn/info/debug)
- `src/shared/events/logger.test.ts` (new) — 32 tests across AC1/AC2/AC3 + edge cases + review patches
- `_bmad-output/implementation-artifacts/0-8-structured-logger.md` (new) — story file
- `_bmad-output/implementation-artifacts/sprint-status.yaml` (modified) — E0-S8 → ready-for-dev → in-progress → done

### Review Findings

_bmad-code-review (2026-06-08). All 3 ACs verified SATISFIED by the Acceptance Auditor. 3 patches applied; 2 deferred; 3 dismissed as noise._

- [x] [Review][Patch] Fix `...redactedExtra` spread order — caller-supplied extra keys were spread AFTER fixed fields, letting callers silently overwrite `level`, `ts`, `correlationId`. Moved spread BEFORE fixed fields so core fields always win. Added 3 new tests (`logger.test.ts`) proving `level`, `ts`, and `correlationId` survive `extra` injection. [logger.ts:59-68, logger.test.ts] [blind+edge]
- [x] [Review][Patch] Crash-safe `JSON.stringify` — unguarded call could throw on BigInt or other non-serializable values in `extra`, silently losing the log line. Wrapped in try-catch: on failure, emits a core-fields-only record with `serializationError: true`. Test added for BigInt extra. [logger.ts:70, logger.test.ts] [blind+edge]
- [x] [Review][Patch] Add correlationId-injection adversarial test — no test verified that `extra: { correlationId: "injected" }` cannot overwrite `ctx.correlationId`. Test added (proves the patch in finding 1 covers this case). [logger.test.ts] [edge]
- [x] [Review][Defer] ctx field runtime validation (tenantId/actorId empty string not caught) — not specified in ACs; pilot trusts internal callers. Revisit if a validation story is created. [logger.ts:62-64] — deferred, pre-existing architectural gap for the pilot
- [x] [Review][Defer] correlationId not validated as non-empty string — same reason as above; not in ACs. [logger.ts:66] — deferred, pre-existing architectural gap for the pilot

**Dismissed (3):** `as string` cast on `redact(msg)` is safe (msg is always string → maskString always returns string); test capture helpers single-arg assumption is correct (emit always passes one JSON string to console); level isolation test is sequential (if-else chain in emit() already guarantees single-path routing — adequately covered).

## Change Log

| Date       | Change |
|------------|--------|
| 2026-06-08 | Story context created (ready-for-dev): structured logger — `logger.ts` emitting §7.4 JSON shape; PII masking via shared `redact()`; 4 levels; no external deps. Single new file in existing `src/shared/events/`. |
| 2026-06-08 | Implemented E0-S8 (Tasks 1–3). New `src/shared/events/logger.ts`: `LogContext`, `LogLevel`, `LogRecord` interfaces; `logger.{error,warn,info,debug}` convenience API; `emit()` runs `msg` + `extra` through shared `redact()`; `console.error/warn/log` sinks. 24 new tests in `logger.test.ts`; 306 total pass; `tsc -b` + `eslint` clean. Status → review. |
| 2026-06-08 | `bmad-code-review`: all 3 ACs verified SATISFIED. 3 patches applied: (1) spread order fixed — extra keys can no longer overwrite core fields; (2) crash-safe `JSON.stringify` — BigInt/unserializable extra falls back to core-fields-only record; (3) correlationId-injection adversarial test added. 4 additional tests; **310 pass**, `tsc -b` + `eslint` clean. 2 findings deferred (ctx validation); 3 dismissed. Status → done. |
