---
baseline_commit: 12eed23
---

# Story 0.10: Flag/config provider + Noop external ports

Status: review

- **Story ID:** E0-S10 (`0-10-flag-config-provider-noop-external-ports`)
- **Epic:** E0 — Platform Guidelines & Standards (the governing contract) · **Feature:** 0.6 — Conformance, Flags & Testing Harness
- **Cut:** Pilot · **Depends on:** E0-S5 (auth context = flag evaluation context) · **ADRs:** ADR-011, ADR-012 · **Constitution:** §1, §9

## Story

As the platform,
feature flags and config resolve through one OpenFeature-shaped provider and all external/out-of-scope systems sit behind Noop ports with flags off,
so that no vendor SDK leaks into call sites and capabilities can be toggled per tenant/subsidiary.

## Acceptance Criteria

1. **AC1 — OpenFeature-shaped hooks.** `useFlag`/`useConfig` are OpenFeature-shaped; the **evaluation context is the auth context** (E0-S5). A static provider serves the pilot, swapping to Unleash in production behind the same interface (ADR-011).
   *Files:* `src/shared/config/FlagProvider.tsx`, `src/shared/config/useFlag.ts`, `src/shared/config/useConfig.ts` · *Seam:* flag/config provider · *Schema/Map:* n/a.
2. **AC2 — Most-specific-wins, deny-wins, cycle-proof (flag H).** Resolution precedence is `subsidiary > tenant > system`; conflicts resolve deny-wins; evaluation is cycle-proof.
   *Touches:* `src/shared/config/FlagProvider.tsx` · *Seam:* flag/config provider · *Schema/Map:* precedence rules.
3. **AC3 — External-system flags hard-off behind Noop ports (ADR-012).** Odoo/Unifonic/Cloud integrations are hard-off behind Noop ports; **no vendor SDK is referenced at any call site**.
   *Touches:* `src/shared/config/ports/{ErpSyncPort,MessagingPort,CloudPort}` (+ Noop adapters) · *Seam:* Ports & Adapters · *Schema/Map:* port interfaces.
4. **AC4 — Out-of-scope engines = port interfaces only.** Billing, multi-cloud, and AI-agent engines exist as port interfaces only (no implementations).
   *Touches:* `src/shared/config/ports/*` · *Seam:* Ports & Adapters · *Schema/Map:* port interfaces.

## Tasks / Subtasks

### Task 1 — `src/shared/config/FlagProvider.tsx` (AC1, AC2)

- [ ] Create the `FlagProvider` React context and provider component.
- [ ] Define the flag/config shape:
  ```ts
  type FlagValue = boolean;
  type ConfigValue = string | number | boolean;

  type FlagDefinition = {
    system?: FlagValue;
    tenant?: Record<string, FlagValue>;       // keyed by tenantId
    subsidiary?: Record<string, FlagValue>;   // keyed by subsidiaryId
  };

  type ConfigDefinition = {
    system?: ConfigValue;
    tenant?: Record<string, ConfigValue>;
    subsidiary?: Record<string, ConfigValue>;
  };
  ```
- [ ] Implement **most-specific-wins, deny-wins** resolution:
  - Check `subsidiary` level first (most specific). If defined, use it.
  - Fall back to `tenant` level.
  - Fall back to `system` level.
  - Deny-wins: if ANY applicable level is `false`, the result is `false`.
  - Default: `false` (deny-wins when no definition found).
- [ ] Implement **cycle-proof** evaluation: maintain a `Set<string>` of keys currently being resolved; if a key appears again during resolution, short-circuit and return `false` (no infinite loops).
- [ ] Evaluation context = `SessionClaims` from `useAuth()`. Extract `tenantId` and `subsidiaryId` from session.
- [ ] Static pilot flag store: `PILOT_FLAGS: Record<string, FlagDefinition>` and `PILOT_CONFIG: Record<string, ConfigDefinition>`. Initial values: all external-system flags default `false`.
- [ ] External-system flag keys (AC3): `'erp.sync.enabled'`, `'messaging.enabled'`, `'cloud.enabled'`. All default `false` at system level.
- [ ] Export `FlagContext` and `FlagProvider`.

### Task 2 — `src/shared/config/useFlag.ts` (AC1, AC2)

- [ ] `useFlag(key: string, defaultValue?: boolean): boolean`
- [ ] Reads evaluation context from `useAuth()` (session claims). If no session, return `defaultValue ?? false`.
- [ ] Calls the resolver from `FlagProvider` context with `{key, tenantId, subsidiaryId}`.
- [ ] Must call `useContext(FlagContext)` — throws if outside provider.
- [ ] External-system flags always resolve `false` in the pilot static store.

### Task 3 — `src/shared/config/useConfig.ts` (AC1)

- [ ] `useConfig<T extends ConfigValue>(key: string, defaultValue: T): T`
- [ ] Same resolution logic as `useFlag` but for config values (string | number | boolean).
- [ ] Falls back to `defaultValue` when key is not defined at any level.

### Task 4 — Port interfaces + Noop adapters (AC3, AC4)

Create `src/shared/config/ports/`:

#### `ErpSyncPort.ts`
```ts
// AC3: Odoo ERP sync — port interface + Noop. Flags-off in pilot (ADR-012).
export interface ErpSyncPort {
  syncLead(leadId: string): Promise<void>;
  syncCustomer(customerId: string): Promise<void>;
}

export const NoopErpSyncAdapter: ErpSyncPort = {
  syncLead: async () => { /* noop */ },
  syncCustomer: async () => { /* noop */ },
};
```

#### `MessagingPort.ts`
```ts
// AC3: Unifonic SMS/messaging — port interface + Noop. Flags-off in pilot (ADR-012).
export interface MessagingPort {
  sendSms(to: string, body: string): Promise<void>;
  sendEmail(to: string, subject: string, body: string): Promise<void>;
}

export const NoopMessagingAdapter: MessagingPort = {
  sendSms: async () => { /* noop */ },
  sendEmail: async () => { /* noop */ },
};
```

#### `CloudPort.ts`
```ts
// AC3: Cloud storage/services — port interface + Noop. Flags-off in pilot (ADR-012).
export interface CloudPort {
  uploadFile(key: string, data: Blob): Promise<string>;
  deleteFile(key: string): Promise<void>;
}

export const NoopCloudAdapter: CloudPort = {
  uploadFile: async () => '',
  deleteFile: async () => { /* noop */ },
};
```

#### `BillingPort.ts` (AC4 — interface only, no implementation)
```ts
// AC4: Billing engine — out-of-scope for pilot. Interface only, no implementation (ADR-012).
export interface BillingPort {
  createInvoice(tenantId: string, amount: number, currency: string): Promise<string>;
  voidInvoice(invoiceId: string): Promise<void>;
}
```

#### `MultiCloudPort.ts` (AC4 — interface only)
```ts
// AC4: Multi-cloud routing — out-of-scope for pilot. Interface only (ADR-012).
export interface MultiCloudPort {
  routeRequest(region: string, payload: unknown): Promise<unknown>;
}
```

#### `AiAgentPort.ts` (AC4 — interface only)
```ts
// AC4: AI-agent engine — out-of-scope for pilot. Interface only (ADR-012).
export interface AiAgentPort {
  processQuery(tenantId: string, query: string): Promise<string>;
}
```

### Task 5 — Tests (NFR-12)

`src/shared/config/FlagProvider.test.tsx`:

**Vitest unit tests:**
- `subsidiary > tenant > system` precedence: subsidiary value wins over tenant and system
- `deny-wins`: if subsidiary=true but tenant=false, result is false
- `deny-wins` at system level: system=false beats anything higher
- Cyclic flag definitions are rejected/short-circuited (no infinite loop)
- Evaluation context uses auth context (tenantId, subsidiaryId from session)
- External flags default off (`erp.sync.enabled`, `messaging.enabled`, `cloud.enabled` → false)
- `useFlag` with no session → returns `false`
- `useConfig` falls back to defaultValue when key undefined

**RTL component test:**
- A component that reads `useFlag('some.feature')` and renders the flagged/unflagged branch correctly
- A component that reads `useConfig('some.setting', 'default')` and renders the config value

**Noop port tests:**
- `NoopErpSyncAdapter.syncLead()` resolves without throwing
- `NoopMessagingAdapter.sendSms()` resolves without throwing
- `NoopCloudAdapter.uploadFile()` resolves to empty string

**Import guard test:**
- Assert no vendor SDK (Unleash, LaunchDarkly, etc.) is imported in `src/shared/config/`

### Task 6 — Wire FlagProvider into app providers (AC1)

- [ ] In `src/app/providers.tsx` (or wherever `AuthProvider` is mounted), wrap children with `<FlagProvider>` INSIDE `<AuthProvider>` so `useAuth()` works inside `FlagProvider`.
- [ ] If `providers.tsx` does not yet exist, check `src/main.tsx` for existing provider setup.

### Task 7 — Conformance gates

- [ ] `npx tsc -b` — clean
- [ ] `npm run lint` — clean
- [ ] `npm run test:run` — all tests green including new config tests
- [ ] No vendor SDK imported anywhere in `src/shared/config/`

## Dev Notes

### File locations (fixed — do not deviate)

```
src/shared/config/
├── FlagProvider.tsx           # Provider + static flag store + resolver
├── useFlag.ts                 # OpenFeature-shaped flag hook
├── useConfig.ts               # OpenFeature-shaped config hook
└── ports/
    ├── ErpSyncPort.ts         # Interface + NoopErpSyncAdapter
    ├── MessagingPort.ts       # Interface + NoopMessagingAdapter
    ├── CloudPort.ts           # Interface + NoopCloudAdapter
    ├── BillingPort.ts         # Interface only (no Noop — out-of-scope engine)
    ├── MultiCloudPort.ts      # Interface only
    └── AiAgentPort.ts         # Interface only
```

### Compiler constraints (same as all prior E0 stories)

`tsconfig.app.json` sets `verbatimModuleSyntax: true` and `erasableSyntaxOnly: true` (target: es2023).
- **`import type` for type-only imports.**
- **No TS `enum`.** Use string-literal unions.
- **No bare `React` global** — React 19, ESM; always `import React from 'react'` or use named imports.
- Components must be `.tsx` (not `.ts`); pure logic (no JSX) uses `.ts`.

### Resolution algorithm detail

```
resolve(key, tenantId, subsidiaryId):
  seen = new Set()
  return resolveInner(key, tenantId, subsidiaryId, seen)

resolveInner(key, tenantId, subsidiaryId, seen):
  if seen.has(key): return false   // cycle detected → deny-wins
  seen.add(key)

  def = PILOT_FLAGS[key]
  if !def: return false            // undefined → deny-wins (false by default)

  levels = []
  if subsidiaryId && def.subsidiary?.[subsidiaryId] !== undefined:
    levels.push(def.subsidiary[subsidiaryId])
  if tenantId && def.tenant?.[tenantId] !== undefined:
    levels.push(def.tenant[tenantId])
  if def.system !== undefined:
    levels.push(def.system)

  // Most-specific-wins: levels[0] is the most specific defined level
  // Deny-wins: if ANY level is false, return false
  if levels.length === 0: return false
  if levels.some(v => v === false): return false
  return levels[0]
```

**Important nuance:** "most-specific-wins" applies when levels do NOT conflict. When they conflict (e.g., subsidiary=true, tenant=false), deny-wins means `false`.

### Evaluation context

```ts
// In useFlag / useConfig:
const { session } = useAuth();
// session is null when not authenticated → return defaultValue
const tenantId = session?.tenantId ?? null;
const subsidiaryId = session?.subsidiaryId ?? null;
```

### Provider wiring

The `FlagProvider` must be INSIDE `<AuthProvider>` so it can call `useAuth()`:

```tsx
// src/app/providers.tsx or src/main.tsx
<AuthProvider>
  <FlagProvider>
    {children}
  </FlagProvider>
</AuthProvider>
```

However, `FlagProvider` should NOT call `useAuth()` directly (it would make testing harder). Instead, accept `session` as a prop OR use the context pattern where the provider receives the static store and hooks handle evaluation. Preferred pattern:

```tsx
// FlagProvider — provides the resolver context
// useFlag/useConfig — reads both FlagContext and useAuth()
```

### No barrel index.ts

All prior stories use direct-file imports. Keep that pattern:
```ts
import { useFlag } from '../../shared/config/useFlag';
import { NoopErpSyncAdapter } from '../../shared/config/ports/ErpSyncPort';
```

### Architecture compliance

1. **NFR-1 layering:** `src/shared/config/*` imports only from `src/shared/auth/*` and `src/shared/domain/*`. Never from `src/features/*` or `src/app/*`.
2. **No vendor SDK:** `FlagProvider` is a homegrown OpenFeature-*shaped* implementation. It does NOT import the `@openfeature/web-sdk` package or any Unleash/LaunchDarkly SDK. The "shaped to OpenFeature" requirement means the API mirrors OpenFeature's hook signatures; the implementation is bespoke.
3. **External system flags are OFF (false) in PILOT_FLAGS at system level.** No Noop adapter should be invoked unless the flag is explicitly enabled (and in the pilot, no flag enables them).
4. **Port interfaces are pure TypeScript interfaces** — no class, no decorator, no third-party type extending.

### Previous story intelligence (E0-S9 — UI kernel, in review)

From the prior stories in this repo:
- **No `enum`**: string-literal unions everywhere.
- **`import type`**: for type-only symbols. Runtime values (functions, components) use plain `import`.
- **`verbatimModuleSyntax: true`**: means `import type` is required for interface-only imports.
- **No barrel `index.ts`**: direct-file imports only.
- **Testing:** Vitest + RTL + jsdom. `vite.config.ts` already has `test: { environment: 'jsdom', globals: true, setupFiles: ['./src/test-setup.ts'] }`.

### Checking existing main.tsx / providers setup

Before creating `FlagProvider` wiring, check `src/main.tsx` to see current provider structure. E0-S5 added `AuthProvider`; this story adds `FlagProvider` inside it.

## Definition of Done

- Meets all 4 ACs
- `npx tsc -b` clean
- `npm run lint` clean
- `npm run test:run` — all tests green (no regressions)
- `useFlag('erp.sync.enabled')` returns `false` with no session
- Noop adapters resolve without throwing
- No vendor SDK import in `src/shared/config/`
- Passes `bmad-code-review`
- Traceable chain (`Closes #<issue>`)

## References

- [Source: _bmad-output/planning-artifacts/epics/epic-0-platform-guidelines/E0-S10.md] — story spec & ACs
- [Source: architecture.md §ADR-011] — OpenFeature-shaped flags, resolution rules
- [Source: architecture.md §ADR-012] — External ports + Noop + flags-off
- [Source: src/shared/auth/auth.types.ts] — SessionClaims (tenantId, subsidiaryId, roles)
- [Source: src/shared/auth/useAuth.ts] — useAuth() hook
- [Source: _bmad-output/planning-artifacts/architecture.md:692-718] — Mermaid diagram showing S_CONFIG and EXTERNAL
- PRD: prd.md §6 E0-S10 · ADR(s): ADR-011, ADR-012 · Inherited UC: TC · Constitution: §1, §9

## Dev Agent Record

### Agent Model Used

claude-sonnet-4-6

### Debug Log References

- `tsconfig.app.json`: added `"node"` to `types` array to fix pre-existing E0-S9 TS2591 errors in `tokens.lint.test.ts`
- FlagProvider split into 3 files to satisfy `react-refresh/only-export-components` ESLint rule
- RTL tests scoped with `within(container)` to avoid DOM leakage between tests

### Completion Notes List

- AC1: `useFlag(key)` + `useConfig(key, default)` OpenFeature-shaped; evaluation context = `SessionClaims` from `useAuth()` (E0-S5)
- AC2: `resolveFlag` implements subsidiary > tenant > system (most-specific-wins) + deny-wins + cycle-proof via `seen: Set<string>` default param
- AC3: `ErpSyncPort`, `MessagingPort`, `CloudPort` — interfaces + Noop adapters; pilot flags hard-off (`system: false`)
- AC4: `BillingPort`, `MultiCloudPort`, `AiAgentPort` — interface only, no implementation
- Provider composition: `FlagProvider` wired inside `AuthProvider` in `src/app/providers.tsx` + `src/main.tsx`
- 40 tests across unit (pure resolveFlag/resolveConfig), hook (with/without session), Noop adapters, RTL component branches, and vendor-SDK import guard

### File List

- `src/shared/config/FlagProvider.tsx` — provider component (new)
- `src/shared/config/flagContext.ts` — React context + `useFlagContext` hook (new)
- `src/shared/config/flagStore.ts` — types, PILOT_FLAGS/PILOT_CONFIG, `resolveFlag`, `resolveConfig` (new)
- `src/shared/config/useFlag.ts` — OpenFeature-shaped flag hook (new)
- `src/shared/config/useConfig.ts` — OpenFeature-shaped config hook (new)
- `src/shared/config/ports/ErpSyncPort.ts` — interface + NoopErpSyncAdapter (new)
- `src/shared/config/ports/MessagingPort.ts` — interface + NoopMessagingAdapter (new)
- `src/shared/config/ports/CloudPort.ts` — interface + NoopCloudAdapter (new)
- `src/shared/config/ports/BillingPort.ts` — interface only (new)
- `src/shared/config/ports/MultiCloudPort.ts` — interface only (new)
- `src/shared/config/ports/AiAgentPort.ts` — interface only (new)
- `src/shared/config/FlagProvider.test.tsx` — 40 tests (new)
- `src/app/providers.tsx` — AuthProvider + FlagProvider composition (new)
- `src/main.tsx` — added Providers wrapper (modified)
- `tsconfig.app.json` — added `"node"` to types (modified)

### Review Findings

- [x] [Review][Patch] Add useFlag/useConfig tests with active session (AC1 coverage) — fixed: added 5 new tests with signIn + act()
- [x] [Review][Patch] Fix RTL tests to use useFlag/useConfig instead of useFlagContext with hardcoded nulls — fixed: RTL tests now use useFlag/useConfig + within(container) scoping
- [x] [Review][Patch] Fix import guard — replaced silent-skip ?raw import with fs.readFileSync — fixed: uses readFileSync over all 5 source files
- [x] [Review][Defer] Misleading test comment (test comment accurately says "deny-wins: system=false beats..." — dismissed, no code defect)
- [x] [Review][Defer] resolveConfig lacks deny-wins — AC2 deny-wins applies to flags only per spec, config values use most-specific-wins only

## Change Log

| Date       | Change |
|------------|--------|
| 2026-06-08 | Story created (ready-for-dev): Flag/config provider (OpenFeature-shaped, most-specific-wins, deny-wins, cycle-proof) + Noop external ports (ErpSync, Messaging, Cloud) + interface-only out-of-scope engines (Billing, MultiCloud, AiAgent). ADR-011 + ADR-012. |
