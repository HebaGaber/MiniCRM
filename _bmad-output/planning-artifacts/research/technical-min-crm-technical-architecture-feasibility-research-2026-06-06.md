---
stepsCompleted: [1, 2, 3, 4, 5, 6]
inputDocuments: ['_bmad-output/project-context.md']
workflowType: 'research'
lastStep: 6
research_type: 'technical'
research_topic: 'min-crm Technical Architecture & Feasibility'
research_goals: 'Evaluate technical feasibility, architecture options, and implementation approaches for min-crm (Product A on the iSolution Platform Boilerplate). Recommend a target per topic — multi-tenant isolation, pilot→production seam, client architecture, audit/event bus, authN/Z, config & flags, deployment — with trade-offs, an ADR-ready list, and explicit flags wherever a recommendation conflicts with the fixed stack (TS/React/localStorage/Vercel) or project-context.'
user_name: 'Heba'
date: '2026-06-06'
web_research_enabled: true
source_verification: true
---

# Research Report: technical

**Date:** 2026-06-06
**Author:** Heba
**Research Type:** technical

---

## Research Overview

This report evaluates the **technical feasibility, architecture options, and implementation approaches** for **min-crm** — Product A on the iSolution Platform Boilerplate — across seven decision areas. For each area it recommends a target, lays out the trade-offs, and gives a short rationale, so the architecture phase inherits a decision rather than re-debating it.

It does **not** cover domain vocabulary (handled in the sibling domain-research doc), and it treats the out-of-scope systems (multi-cloud provisioning, subscription/billing, embedded AI agent) only as interface seams — their engines are not designed.

**Binding constraints** (from `_bmad-output/project-context.md`): TypeScript/React, localStorage pilot, Vercel deploy; three-layer architecture (Product → Shared Platform → External, dependencies never flow upward); `BaseEntity` with mandatory `tenantId` + `subsidiaryId`, soft-delete, optimistic `version`; the Repository contract (§4) and REST contract (§5) as the seam targets; one mutation → one audit event + one domain event sharing a `correlationId` (§7); tenant/subsidiary scoping derived server-side from the token, never client-trusted (§6).

**Steering inputs (from {{user_name}}):**
- **Production target = Open / greenfield** — no committed cloud/DB; recommend the strongest general-purpose target and note portability trade-offs.
- **Data residency = research it** — treat residency as a design seam; present both region-pinning and hard-per-tenant postures; flag for the architecture phase to pin with the customer.

---

## Technical Research Scope Confirmation

**Research Topic:** min-crm Technical Architecture & Feasibility
**Research Goals:** Evaluate technical feasibility, architecture options, and implementation approaches; recommend a target per topic with trade-offs; produce an ADR-ready list; flag conflicts with the fixed stack or project-context.

**Technical Research Scope:**

- Architecture Analysis — multi-tenant isolation models, three-layer mapping, system architecture
- Implementation Approaches — pilot→production seam, repository/adapter patterns, optimistic update + rollback
- Technology Stack — React/TS state & data-fetching libraries, routing, OIDC client, flag mechanisms (with specific versions)
- Integration Patterns — Repository contract, REST API contract, event bus / outbox, AuthProvider seam, external-system ports
- Performance & Operational Considerations — scalability of isolation models, Vercel SPA constraints, backend placement, data residency

**Research Methodology:**

- Current web data (June 2026) with rigorous source verification
- Multi-source validation for load-bearing claims (RLS patterns, TanStack Query, OIDC/RBAC, Vercel limits, residency)
- Confidence levels for uncertain information
- Explicit conflict flags wherever a recommendation conflicts with the fixed stack (TS/React/localStorage/Vercel) or project-context

**Scope Confirmed:** 2026-06-06

---

## Technology Stack Analysis

This section locks the concrete libraries, versions, and platform facts behind Topics 3 (client architecture), 6 (config & flags), and the technology side of Topics 1 (isolation primitive) and 7 (deployment). The fixed stack — TypeScript/React/localStorage/Vercel — is treated as given; everything here either sits **inside** that stack or is a **production seam** that activates after the pilot.

### Programming Languages

_Confidence: High._ The stack is fixed at **TypeScript** end-to-end (project-context §2, §9). This is the correct and uncontested choice: every project-context contract (`BaseEntity`, `Repository<T>`, status enums + transition maps, event interfaces) is already expressed as TS types, so the language is doing real work — the transition maps and envelope shapes are compile-time-enforceable rather than convention.
- **Target:** TypeScript 5.x in `strict` mode, `noUncheckedIndexedAccess` on. The status enums and `LEAD_TRANSITIONS`/`TICKET_TRANSITIONS` maps (§3) should be `as const` and exhaustively switched so an added status is a compile error, not a runtime gap.
- **Production seam:** if the backend is a different language (Node/TS keeps the contracts shared; Go/Java/Python would re-declare them), the REST contract (§5) is the language-neutral boundary. **No conflict** — the contract is JSON, not TS.
- _Source: [project-context.md §2/§3/§9]; [TanStack Query overview](https://tanstack.com/query/v5/docs/framework/react/overview)._

### Development Frameworks and Libraries

_Confidence: High for the client; the picks below are the current 2026 mainstream._ React is fixed. The open decisions are server-state, client-state, routing, forms, and validation.

| Concern | Recommendation | Version (Jun 2026) | Why |
|---|---|---|---|
| **Server state / data-fetching** | **TanStack Query** | v5.x | Purpose-built for server state: caching, request dedupe, retries, background refetch, and — critically for §4.8 — first-class **optimistic updates with rollback** (`onMutate`/`onError`/`onSettled`). It explicitly is *not* a Redux replacement; it owns the async/server half only. |
| **Client/UI state** | **Zustand** (or React Context for the few truly-global slices: auth, tenant, flags) | Zustand 4.x | App is small-to-medium; auth/tenant/flags are read-mostly and fit Context + `useAuth()` (§6.1 already mandates `useAuth()`). Reach for Zustand only if cross-feature UI state appears. **Avoid Redux Toolkit** — overkill at this size given TanStack Query owns server state. |
| **Routing** | **React Router v7** (library/SPA mode) | v7.x | 12M+ weekly downloads, the SPA-default, CDN-hostable static SPA — matches the Vercel pilot exactly. TanStack Router has superior type-safety but its advantage is strongest in heavier apps; React Router v7's ecosystem + Vercel fit wins for this size. **Flagged trade-off** below. |
| **Forms** | **React Hook Form** | v7.x | Uncontrolled inputs → minimal re-renders; integrates with the `<EntityForm>` controlled-input + inline-validation + disabled-until-valid rules (§8.2). |
| **Validation** | **Zod** | v4.x via `@hookform/resolvers` | TS-first schema validation; one schema generates both the TS type and the runtime check, satisfying §4.2 "validate before persist → 422 with field details". The same Zod schemas can validate inbound API payloads server-side later — the schema is portable across the seam. |

- **Routing trade-off (flag):** React Router v7 "framework mode" (loaders, actions, SSR) is **not** what we want — the pilot is a static SPA on Vercel with a localStorage repository, so use **library/declarative mode** only. If the architecture phase later wants type-safe search-param-driven list filtering (the §5.4 `?q=&status=&page=` params), TanStack Router is the stronger fit and is a reasonable swap. Not a project-context conflict either way.
- _Sources: [TanStack Query — does it replace Redux](https://tanstack.com/query/v5/docs/react/guides/does-this-replace-client-state); [TanStack Router vs React Router v7 (pkgpulse, 2026)](https://www.pkgpulse.com/blog/tanstack-router-vs-react-router-v7-2026); [New Stack — when to use each](https://thenewstack.io/next-js-react-router-tanstack-when-to-use-each/); [Zod v4 + RHF v7](https://tecktol.com/zod-react-hook-form/); [RHF resolvers](https://github.com/react-hook-form/resolvers)._

### Database and Storage Technologies

_Confidence: High on the pilot, Medium-High on the production target (greenfield → recommend, don't mandate)._
- **Pilot storage:** `localStorage`, accessed **only** through the Repository adapter (§4.1). Key scheme is fixed by project-context: `crm:{tenantId}:{subsidiaryId|_parent}:{entity}`. This is a deliberate constraint, not a recommendation — see Topic 2 for the seam.
- **Production target:** **PostgreSQL** as the isolation primitive. RLS (row-level security) is the 2026 mainstream pattern for multi-tenant SaaS isolation, and it maps directly onto the mandatory `tenantId`/`subsidiaryId` columns already on every `BaseEntity`. Critical performance fact carried into Topic 1: **`tenant_id` must be the leading column of every primary access index** — benchmarks show RLS without the composite index running ~120ms (seq scan) vs ~1.2ms with it (1M rows / 10K tenants), a two-orders-of-magnitude penalty.
- **Why Postgres for greenfield:** the project-context contracts (soft-delete via `deletedAt`, optimistic `version`, append-only audit log) are all relational-natural; RLS lets tenant isolation be enforced once at the DB layer instead of in every query; managed options (Supabase/Neon/RDS/Cloud SQL) keep it portable. **No project-context conflict** — §4.2 already says scoping is applied inside the repository from auth context, which is exactly what an RLS `SET app.tenant_id` session variable formalizes.
- _Sources: [AWS Prescriptive Guidance — RLS](https://docs.aws.amazon.com/prescriptive-guidance/latest/saas-multitenant-managed-postgresql/rls.html); [Postgres RLS multi-tenancy (Fritzsche)](https://ricofritzsche.me/mastering-postgresql-row-level-security-rls-for-rock-solid-multi-tenancy/); [Permit.io RLS guide](https://www.permit.io/blog/postgres-rls-implementation-guide)._

### Development Tools and Platforms

_Confidence: High._
- **Build/dev:** **Vite** (the repo already contains `vite.config.ts`, `tsconfig.app.json`) — fast HMR, native TS, the standard React SPA bundler in 2026. Static `dist/` output is exactly what Vercel serves.
- **Lint/format:** the repo already has `eslint.config.js` (flat config). Add type-aware rules.
- **Testing (recommend, not yet present):** **Vitest** (Vite-native unit) + **React Testing Library** for components + **Playwright** for the four-state UI flows (§8.1) and transition rules (§3.2). The DoD (§10) requires the story→spec→code→**test** chain, so a test runner is a gap to close.
- **Package manager:** repo has `package-lock.json` → **npm**. Keep it.
- _Source: repo files (`vite.config.ts`, `eslint.config.js`, `package-lock.json`); [TanStack Query overview](https://tanstack.com/query/v5/docs/framework/react/overview)._

### Config, Flags & Auth Libraries

_Confidence: High._
- **Feature flags:** the 2026 mainstream is **OpenFeature** (vendor-neutral SDK spec) with a swappable provider, or **Unleash** (open-source server + `@unleash/proxy-client-react`). **Recommendation for the pilot:** a tiny in-repo `FlagProvider` exposing `useFlag(key)` backed by a static per-tenant config object (all external-system flags — Odoo, Unifonic — hardcoded **off** per §1), but shaped to the **OpenFeature client interface** so the production swap to Unleash/OpenFeature is a provider change, not a call-site change. Detailed in Topic 6.
- **Auth (production seam):** **react-oidc-context** (wrapping **oidc-client-ts**) is the current recommended React OIDC path, using **Authorization Code Flow + PKCE** (implicit flow is deprecated). The pilot uses a **mock `AuthProvider`** issuing the §6.1 claims object; production swaps in the OIDC provider behind the same `AuthProvider` interface. Detailed in Topic 5.
- _Sources: [OpenFeature React SDK](https://openfeature.dev/docs/reference/sdks/client/web/react/); [Unleash React guide](https://docs.getunleash.io/guides/implement-feature-flags-in-react); [react-oidc-context](https://github.com/authts/react-oidc-context); [Auth Code + PKCE for SPAs](https://hceris.com/oauth-authorization-code-flow-pkce-for-react/)._

### Cloud Infrastructure and Deployment

_Confidence: High on Vercel facts; residency flagged as a seam per your steering._
- **Pilot:** Vercel serves the static Vite SPA from CDN — zero backend, localStorage persistence, ideal for the pilot.
- **Key Vercel constraints carried into Topic 7:** Functions default to **iad1 (Washington DC)**; multi-region deployment is **Pro/Enterprise only**; Functions cap at **250 MB unzipped** and **4.5 MB request body**; and — load-bearing for residency — **Vercel offers no BYOC (Bring Your Own Cloud)**, so teams with hard data-residency/compliance needs "may need more control over infrastructure than Vercel provides."
- **Implication (flag):** the SPA on Vercel is fine, but a **residency-sensitive backend should not live on Vercel Functions** — it belongs on a cloud where the region (and for hard residency, the per-tenant store) can be pinned. Detailed in Topic 7.
- _Sources: [Vercel Functions limits](https://vercel.com/docs/functions/limitations); [Vercel function regions](https://vercel.com/docs/functions/configuring-functions/region); [Vercel alternatives / residency (Northflank)](https://northflank.com/blog/best-vercel-alternatives-for-scalable-deployments)._

### Technology Adoption Trends

- **Server-state vs global-state split is now standard:** the 2026 consensus is TanStack Query for server state + a light client-state store (Zustand/Context), with Redux reserved for genuinely complex client state — directly supporting the §4.8 optimistic-update mandate.
- **PKCE-only for SPAs:** implicit flow is retired; Authorization Code + PKCE is the default — the production auth seam must assume this.
- **RLS is the default multi-tenant isolation pattern** for shared-Postgres SaaS, with database-per-tenant reserved for hard isolation/residency — the exact trade-off space for Topic 1.
- **Vendor-neutral flag SDKs (OpenFeature)** are displacing SDK lock-in — favors the provider-shaped pilot flag layer.

---
## Integration Patterns Analysis

This section resolves the **contract seams** — the boundaries that must stay stable so the pilot can become production by swapping implementations, not rewriting features. It covers **Topic 2** (pilot→production seam), **Topic 5** (AuthProvider/OIDC), and the transport for **Topic 4** (event bus / outbox). The unifying principle from project-context: *features depend on interfaces (`Repository<T>`, `AuthProvider`, the event bus), never on concrete implementations* (§1, §4.1, §6.1).

### API Design Patterns — the REST contract is already the seam

_Confidence: High._ project-context §5 fixes a **REST + JSON** contract (plural-noun resources, `PATCH` for update, `POST /{id}/transition` for state machine moves, `Page<T>` envelopes, `409` on version conflict, `422` on illegal transition). This is the right choice for a CRM of this size and the right seam target — **not GraphQL/gRPC**:
- REST maps 1:1 onto the `Repository<T>` methods (`list/get/create/update/remove`), so the localStorage adapter and a future HTTP adapter implement the *same* five methods. GraphQL would put a resolver/schema layer between the repository interface and the wire, adding a translation the contract doesn't need.
- The `POST /{id}/transition` endpoint is the correct way to expose the §3.2 state machines — transitions are operations, not field edits, so modeling them as a sub-resource action (not a `PATCH status`) keeps the transition guard server-authoritative.
- **No conflict.** The only thing to confirm in architecture: the optional `Idempotency-Key` on create (§5.5) pairs naturally with the outbox `event_id` dedup below.
- _Source: [project-context §5]; [Adapter pattern for REST versioning](https://kumarreddy-b.medium.com/using-adapter-pattern-to-solve-rest-api-versioning-issues-5a2874340f39)._

### System Interoperability — the Repository/Adapter seam (Topic 2)

_Confidence: High; this is a well-established frontend pattern._ The repository-with-swappable-adapter pattern is the documented, mainstream way to keep a localStorage pilot swappable for an HTTP backend: features depend on the `Repository<T>` **interface**; you ship a `LocalStorageRepository` now and an `HttpRepository` later, injected at the composition root. The business logic that depends on the interface never changes.

**What stays IDENTICAL across the swap** (the contract surface):
- The `Repository<T>` method signatures (§4.1) and `ListQuery`/`Page<T>` shapes.
- All entity types and `BaseEntity` (§2), the status enums + transition maps (§3), Zod validation schemas.
- Every feature/component call site (`leadsRepo.list({status:'new'})` is unchanged).
- The audit + domain event emission contract (§7) — one mutation → one audit + one domain event sharing `correlationId`.
- The auth context shape from `useAuth()` (§6.1) and the route/action guards.

**What CHANGES (swapped behind the interface):**
| Concern | Pilot (localStorage) | Production (HTTP) |
|---|---|---|
| Persistence | `crm:{tenantId}:{subsidiaryId\|_parent}:{entity}` keys | SQL rows under RLS |
| Tenant/subsidiary scoping | applied **in the adapter** from `useAuth()` context | enforced **server-side** from the JWT (defense-in-depth; client still scopes for UX) |
| `version` conflict (409) | adapter compares in-memory `version` | DB optimistic-lock / `WHERE version = ?` |
| Validation | Zod in adapter before write | Zod/equivalent server-side (client still validates for UX) |
| Event emission | in-process bus writes to a localStorage audit log | **transactional outbox** in the same DB txn (below) |
| Latency / errors | synchronous, never fails on network | async; TanStack Query handles ret/rollback |

**Critical seam caveat to flag for architecture:** in the pilot, scoping/validation/authorization run **client-side inside the adapter** — this is acceptable *only because it's a pilot with mock auth*. project-context §4.2/§6.3 already say the production rule is server-side enforcement. So the swap is **not purely mechanical for the security-critical checks**: those must be *re-implemented* server-side, with the client copy demoted to a UX convenience. The data-shape swap is mechanical; the trust-boundary swap is a real build. **This is the single most important thing the architecture phase must not gloss over.**
- _Sources: [Repository pattern with swappable adapters (Codeminer42)](https://blog.codeminer42.com/scalable-frontend-2-common-patterns-d2f28aef0714/); [Repository pattern with TypeScript](https://dev.to/aouahib/the-repository-pattern-with-typescript-3ibn); [Repository + Adapter in React](https://javascript.plainenglish.io/building-a-better-react-application-with-repository-and-adapter-design-patterns-3e089f43fbc8)._

### Integration Security Patterns — AuthProvider & OIDC seam (Topic 5)

_Confidence: High._ project-context §6 already defines the seam: one `AuthProvider` interface, a mock SSO in the pilot, real OIDC in production, both yielding the same claims object `{ userId, tenantId, subsidiaryId|null, roles: Role[], exp }`.

**Claims shape (recommended, aligned to §6.1 + 2026 OIDC conventions):**
```jsonc
{
  "sub": "usr_…",            // standard OIDC subject = userId
  "tenant_id": "tnt_…",      // tenant scope — presence means membership
  "subsidiary_id": "sub_…",  // or null = parent-level user
  "roles": ["sales"],        // Role[] from §3.1
  "exp": 1730000000
}
```
Key findings that shape the production target:
- **`tenant_id` belongs in the token, verified server-side.** Presence of the claim = tenant membership; every authorization decision is tenant-aware "by construction."
- **Role claims are NOT standardized across IdPs** (Azure AD / Okta / Keycloak format them differently). → **Build a normalization layer** in the production `AuthProvider` that maps the IdP's role/group claim onto min-crm's fixed `Role` union (§3.1). This is the one piece of real work the OIDC swap adds beyond config.
- **PKCE, public client, no secret, silent renew** (from Topic 2 stack research) — the SPA never holds a client secret.
- **Server-side tenant consistency check:** the §5.2 rule (client may send `X-Subsidiary-Id`, server validates it belongs to the token's tenant; tenant id **never** taken from a client header) matches the 2026 best practice of comparing a client-sent scope header against the JWT claim. **Reinforce:** subsidiary-from-header is allowed *after validation*; tenant-from-header is never trusted.

**Enforcement model (both gates, §6.3):** route guard (can this role open the screen?) + action guard (can this role mutate this record in this tenant/subsidiary?). In production this is enforced server-side; RLS (Topic 1) provides the *data-layer* backstop so a missed guard still can't cross tenants. A record outside the caller's tenant returns **404, not 403** (§6.3) to avoid leaking existence — confirm the HTTP adapter + backend both honor this.
- _Sources: [tenant_id claim convention](https://granit-fx.dev/dotnet/infrastructure/multi-tenancy/claims-convention/); [OIDC + RBAC with Keycloak](https://docs.kuadrant.io/0.11.0/authorino/docs/user-guides/oidc-rbac/); [WorkOS multi-tenant guide](https://workos.com/blog/developers-guide-saas-multi-tenant-architecture); [react-oidc-context](https://github.com/authts/react-oidc-context)._

### Event-Driven Integration — bus now, outbox later (Topic 4 transport)

_Confidence: High._ project-context §7 mandates two streams (immutable **audit log** + **domain event bus**), both tenant-tagged, one operation → one of each, sharing a `correlationId`. The seam:
- **Pilot:** an in-process synchronous **event bus** (publish/subscribe) in `shared/events`. Each repository mutation, in the same logical operation, appends one `AuditEvent` (append-only localStorage stream) and publishes one `DomainEvent` to in-memory subscribers (dashboards, Events Log screen). `correlationId` is generated at the start of the user action and threaded through.
- **Production target:** the **transactional outbox pattern**. The state change *and* the event row are written in **one DB transaction** → no lost events even if the broker is down; a separate worker publishes to the broker (Kafka/SQS/etc.). Key facts to design around:
  - Outbox gives **at-least-once, not exactly-once** delivery → **consumers must be idempotent**, keyed on the unique `event_id` (we already have `eventId` in `DomainEvent` and `id` in `AuditEvent`, §7). The §5.5 `Idempotency-Key` on create dovetails here.
  - **`correlationId` is the trace key** across the whole lifecycle — generate it at the API edge (or carry it from the client), stamp it on the audit record, the domain event, *and* structured logs (§7.4), so one user action is traceable end-to-end through audit → events → logs.
  - **Tenant-tagging flows automatically**: `tenantId`/`subsidiaryId` are on `BaseEntity`, copied onto both the `AuditEvent` and `DomainEvent` at emit time from the same auth context — so every event, log line, and outbox row is tenant-scoped without extra plumbing.
- **CQRS-lite note:** the Events Log screen and dashboards (§7.3, Epic 5) are read models fed by the event stream — a light read-side projection, not full event sourcing. Recommend **not** adopting event sourcing as the system of record (the entities are the source of truth; events are a side-effect stream). Flag: if the architecture phase wants full auditability/replay, event sourcing is the heavier alternative — out of scope for the pilot.
- _Sources: [Transactional outbox (microservices.io)](https://microservices.io/patterns/data/transactional-outbox.html); [Outbox trade-offs (2025)](https://www.softwarecraftsperson.com/posts/2025-10-08-transactional-outbox-pattern/); [AWS outbox guidance](https://docs.aws.amazon.com/prescriptive-guidance/latest/cloud-design-patterns/transactional-outbox.html); [Confluent outbox course](https://developer.confluent.io/courses/microservices/the-transactional-outbox-pattern/)._

### External-System Ports (scope-guard seams only)

_Confidence: High; design intent, not engine design._ project-context §1 puts Odoo, Unifonic, and Cloud behind **port interfaces guarded by feature flags, all OFF in the pilot**. The integration pattern is **Ports & Adapters (Hexagonal)**: min-crm defines the port (e.g. `MessagingPort.send(...)`, `ErpSyncPort.push(...)`); a `NoopAdapter` (or a recording mock) backs it in the pilot; a real Unifonic/Odoo adapter is wired only when the flag flips. Per the scope guard, **we design the seam, not the engine** — multi-cloud provisioning, billing, and the embedded AI agent are likewise port interfaces only. No call site references a vendor SDK directly; everything goes through the port + flag.
- _Source: [project-context §1]; [WorkOS multi-tenant guide](https://workos.com/blog/developers-guide-saas-multi-tenant-architecture)._

---
## Architectural Patterns and Design

This section resolves the keystone decision — **Topic 1, multi-tenant data isolation** — and the data/deployment architecture around it, including the **data-residency** posture flagged for research.

### System Architecture Patterns — the isolation models (Topic 1)

_Confidence: High; this is a mature, well-documented design space._ The industry names three canonical isolation models (AWS/Azure terminology in parentheses):

| Model | a.k.a. | Isolation | Cost/Ops | Migrations | Residency fit | Noisy-neighbor |
|---|---|---|---|---|---|---|
| **Shared DB + RLS** | **Pool** | Logical (row-level) | Lowest | One migration, all tenants | Region pinning only | Possible (shared resources) |
| **Schema-per-tenant** | **Bridge** | Medium (schema boundary) | Medium | Run per schema — gets painful at scale | Region pinning; per-tenant backup easy | Reduced |
| **DB-per-tenant** | **Silo** | Strong (physical) | Highest (fleet automation) | Run per DB — heaviest | **Per-tenant residency native** | None |

The 2026 consensus: **start Pool (shared DB + RLS) and graduate high-value/high-compliance tenants to Silo via a hybrid ("dynamic multi-tenancy") strategy.** Schema-per-tenant (Bridge) is the awkward middle — it carries most of the migration pain of Silo without the full isolation, so it's rarely the long-term target; it's mainly a stepping stone for legacy systems.

**Recommended production target for min-crm: Pool (shared Postgres + RLS) as the default, architected so the repository layer can route a flagged tenant to a Silo DB later — without changing feature code.**

Rationale:
1. **It's the smallest delta from project-context.** Every entity already carries `tenantId`/`subsidiaryId` (§2); §4.2 already mandates scoping "inside the repository from auth context." RLS is the database formalization of a rule the codebase already follows. The localStorage key scheme `crm:{tenantId}:{subsidiaryId|_parent}:{entity}` is literally a Pool model in miniature — the pilot is *already* Pool.
2. **Lowest cost/ops for a pilot-stage product** with an unknown tenant count — no per-tenant provisioning fleet to automate on day one.
3. **The hybrid escape hatch covers the hard cases.** When a tenant needs hard residency or hard isolation (Topic 7), the repository resolves that tenant's connection to a dedicated Silo DB. Because features depend on `Repository<T>`, this routing is invisible above the data layer.
4. **Greenfield → Postgres makes RLS a first-class primitive** (your steering input). RLS centralizes isolation enforcement at the DB so a missed `WHERE tenant_id` in app code still can't leak across tenants — defense-in-depth behind the §6.3 guards.

**The non-negotiable performance rule (carry into architecture):** with RLS, **`tenant_id` must be the leading column of every primary access index**, or queries fall back to sequential scans (~120ms vs ~1.2ms at 1M rows / 10K tenants — two orders of magnitude). Composite indexes `(tenant_id, …)` are mandatory, not optional.

- _Sources: [Tenant isolation: pool/silo/bridge (Just After Midnight)](https://www.justaftermidnight247.com/insights/tenant-isolation-in-saas-pool-silo-and-bridge-models-explained/); [DB-per-tenant vs shared schema (Asad Ali)](https://asadali.dev/blog/multi-tenant-saas-practical-comparison-database-per-tenant-vs-shared-schema/); [Multitenancy patterns & trade-offs (Bytebase)](https://www.bytebase.com/blog/multi-tenant-database-architecture-patterns-explained/); [AWS multi-tenant guidance](https://aws.amazon.com/solutions/guidance/multi-tenant-architectures-on-aws/)._

### Data Architecture Patterns — mapping onto the tenant → subsidiary hierarchy

_Confidence: High._ project-context models a **two-level hierarchy**: `Tenant` (the customer) → `Subsidiary` (with its own `parentSubsidiaryId` allowing a sub-tree), and `BaseEntity.subsidiaryId = null` means a **parent-level record**. The mainstream pattern for this is **hierarchical data within a Pool model**: `tenant_id` is the hard isolation boundary; `subsidiary_id` is a *scoping/filtering* dimension **inside** that boundary, not a second isolation boundary.

How each requirement maps onto Pool + RLS:

- **Isolation per subsidiary** → *not* physical isolation; it's **row scoping** within the tenant. RLS enforces `tenant_id` (the security boundary); the repository/query layer adds `subsidiary_id` filtering derived from the `X-Subsidiary-Id` request scope (validated against the token's tenant, §5.2). A subsidiary user sees only their subsidiary's rows; this is an *authorization* rule layered on top of RLS, not a separate database.
- **Roll-up to parent** → a **parent-level user** (token `subsidiary_id = null`, role `tenant_admin`) queries with the subsidiary filter relaxed, so RLS returns *all* the tenant's rows across subsidiaries → natural roll-up. Records with `subsidiaryId = null` are tenant-wide (shared `Customer` records, tenant config). This is exactly why the schema separates the two columns.
- **Config/role inherit-or-override** → model config as a **resolved chain**: subsidiary value → falls back to parent/tenant value → falls back to system default (the same inheritance shape recommended for feature flags in Topic 6). Roles are assigned at the level the user belongs to; a `tenant_admin` at parent level implicitly governs subsidiaries (per the §6.2 matrix). Recommend storing config/flags as `(tenantId, subsidiaryId|null, key, value)` rows and resolving most-specific-wins at read time.
- **Onboard a subsidiary** → in Pool, this is a **data operation, not infrastructure**: insert a `Subsidiary` row, emit `Tenant.SubsidiaryAdded` (§7 canonical event). No schema/DB to provision. Cheap and instant — a major Pool advantage.
- **Offboard a subsidiary** → **soft-delete** the subtree (`deletedAt`, per §2) + emit `Tenant.SubsidiaryRemoved`; lists already exclude soft-deleted (§4.2). Hard delete / data export is an explicit admin action emitting an audit event. (In a Silo, offboarding means decommissioning a DB — far heavier; another reason Pool is the right default.)

**Flag for architecture:** if a *subsidiary* (not just a tenant) ever needs hard residency or hard isolation, the two-level Pool assumption breaks — you'd need Silo at the subsidiary grain, which the hierarchy doesn't currently anticipate. Confirm residency requirements are at **tenant** grain (the common case) before committing.

- _Sources: [Hierarchical multi-tenant data models](https://thinkaicorp.com/scaling-the-heights-of-multi-tenant-saas-with-hierarchical-data-models/); [Sub-tenancy architecture (Springer)](https://link.springer.com/article/10.1007/s11704-016-5081-x); [SaaS multi-tenant data modeling (Flightcontrol)](https://www.flightcontrol.dev/blog/ultimate-guide-to-multi-tenant-saas-data-modeling); [WorkOS multi-tenant guide](https://workos.com/blog/developers-guide-saas-multi-tenant-architecture)._

### Security Architecture Patterns

_Confidence: High._ Defense-in-depth, three layers, all already implied by project-context:
1. **Edge/identity** — OIDC + PKCE; JWT carries `tenant_id`/`subsidiary_id`/`roles` (Topic 5). Tenant never trusted from a header.
2. **Application** — the §6.3 two-gate model (route guard + action guard); transition guards (§3.2) reject illegal status moves with `422`; cross-tenant reads return `404` to avoid existence leaks.
3. **Data** — **RLS as the backstop**: even if an app-layer guard is missed, the DB policy prevents cross-tenant rows from being returned. This is the core security argument for Pool-with-RLS over a naive shared schema.

PII/secret redaction (§7.4) applies to audit `before/after` and structured logs — masking emails/phones — and must be enforced at the event-emission seam, not per-screen.

- _Sources: [Postgres RLS recommendations (AWS)](https://docs.aws.amazon.com/prescriptive-guidance/latest/saas-multitenant-managed-postgresql/rls.html); [OIDC + RBAC (Kuadrant/Keycloak)](https://docs.kuadrant.io/0.11.0/authorino/docs/user-guides/oidc-rbac/)._

### Scalability and Performance Patterns

_Confidence: High._
- **Pool scales horizontally** for a CRM workload; the binding constraint is index design (`tenant_id`-leading composites), not the model. Connection pooling (PgBouncer/built-in) handles concurrency.
- **Read models** for the Events Log + dashboards (§7.3) keep heavy aggregate queries off the transactional path (CQRS-lite, Topic 4).
- **Client-side**, TanStack Query's cache + dedupe + background refetch is the main perf lever; the `Page<T>` contract (default `pageSize=25`, max 100, §4.1/§5.4) bounds payloads.
- **Silo graduation** is the escape valve for a tenant whose volume causes noisy-neighbor effects — move that one tenant, leave the rest Pooled.

### Deployment and Operations Architecture (Topic 7 preview)

_Confidence: High on constraints; residency posture presented as a seam per your steering._
- **Pilot:** static Vite SPA on Vercel CDN, no backend, localStorage. Clean fit.
- **Production backend placement:** **not** Vercel Functions for anything residency- or isolation-sensitive — Vercel offers **no BYOC**, multi-region is Pro/Enterprise only, and Functions default to `iad1`. The backend (Postgres + API + outbox worker) belongs on a cloud where region and per-tenant store are controllable (managed Postgres: Supabase/Neon/RDS/Cloud SQL; API on the same cloud). The SPA can *stay* on Vercel and call that API cross-origin — clean split.
- **Two residency postures (your "research it" input):**
  - **Posture A — Region pinning (lighter):** one Pool Postgres in a named region (e.g. EU or KSA). Satisfies "data must stay in region X." Shared-DB isolation survives. Simplest; covers most B2B SaaS residency clauses.
  - **Posture B — Hard per-tenant residency:** a tenant legally requires its data in a specific country / its own store → that tenant is promoted to a **Silo DB** in the required region; the repository routes it by `tenantId`. Pool tenants stay co-located. This is the hybrid/dynamic-multi-tenancy model and is the reason to keep the Silo escape hatch in the repository design even if no tenant needs it on day one.
- **Recommendation:** **design for Posture A, keep the seam for Posture B.** Flag residency grain (tenant vs subsidiary) for the architecture phase to confirm with the customer — it's the one open input that could change the Topic 1 default.
- _Sources: [Vercel Functions limits](https://vercel.com/docs/functions/limitations); [Vercel regions](https://vercel.com/docs/functions/configuring-functions/region); [Residency via Silo & dynamic multi-tenancy](https://isitdev.com/multi-tenant-saas-architecture-cloud-2025/); [Pool/silo/bridge & residency](https://www.justaftermidnight247.com/insights/tenant-isolation-in-saas-pool-silo-and-bridge-models-explained/)._

### Integration and Communication Patterns (architecture-level recap)

The three-layer dependency rule (§1) is enforced architecturally by **Hexagonal / Ports & Adapters**: Product → Shared Platform via interfaces; Shared Platform → External Systems via flagged ports. Combined with the Repository seam (Topic 2), the AuthProvider seam (Topic 5), and the event bus→outbox seam (Topic 4), every cross-layer boundary in min-crm is an interface with a pilot adapter and a production adapter. This is what makes "pilot → production" a swap rather than a rewrite — *for everything except the trust-boundary checks, which are a genuine server-side build* (flagged in Topic 2).

---
## Implementation Approaches and Technology Adoption

This section covers the hands-on patterns the build will use: optimistic mutations (§4.8), the four required UI states (§8.1), the per-tenant feature-flag mechanism (**Topic 6**), and the pilot→production adoption strategy.

### Optimistic Update + Rollback (§4.8 mandate)

_Confidence: High; this is TanStack Query's documented core pattern._ project-context §4.8 and §8.2 require mutations to be **optimistic with rollback on failure**. TanStack Query's `useMutation` implements this exactly with a three-callback contract:
1. **`onMutate`** — `cancelQueries()` (stop in-flight refetches overwriting the optimistic state), snapshot current data with `getQueryData()`, apply the optimistic change with `setQueryData()`, and **return the snapshot** as context.
2. **`onError`** — roll back by calling `setQueryData()` with the snapshot from context. This is where the §8.2 **rollback toast** fires.
3. **`onSettled`** — `invalidateQueries()` to reconcile with the server regardless of outcome.

This maps cleanly onto min-crm's contract:
- The optimistic write should also **pre-increment `version`** locally so the UI reflects §2's optimistic-concurrency model; a `409` in `onError` triggers rollback **and** a "record changed, please refresh" toast (distinct from a generic failure).
- A `422` (validation / illegal transition, §3.2/§5) rolls back and surfaces field errors — the Zod schema already produced them client-side, so the server `422` should rarely be the first signal.
- **In the pilot**, the localStorage adapter is synchronous and effectively never fails on transport — so rollback is exercised mainly via *simulated* failures (invalid transition, version bump). **Recommend building a fault-injection toggle in the localStorage adapter** so the rollback path is actually testable before a real backend exists. _(Flag: without this, the §8.1/§4.8 error/rollback paths ship untested in the pilot — a DoD §10 risk.)_
- _Source: [TanStack Query — Optimistic Updates](https://tanstack.com/query/v5/docs/react/guides/optimistic-updates); [Mutations guide](https://tanstack.com/query/v5/docs/framework/react/guides/mutations)._

### The Four UI States (§8.1) — wiring to TanStack Query

_Confidence: High._ §8.1 makes `loading / empty / error / ready` a DoD gate for every data view. TanStack Query exposes these directly: `isPending → Skeleton`, `isError → ErrorState` (with `refetch()` as the retry, §8.2), `data.length === 0 → EmptyState` (illustration + primary action), else `ready → DataTable`. **Recommendation:** encode this as a single shared `<QueryStateBoundary>` wrapper (or a `renderQueryStates` helper) so no screen re-implements the branching and the DoD check becomes "did you use the boundary?" rather than a manual four-way audit. This fits the §8.3 "use shared components, don't reinvent" rule.

### Feature Flags & Config — per-tenant mechanism (Topic 6)

_Confidence: High._ project-context §1 requires external-system flags (Odoo, Unifonic, Cloud) **OFF in the pilot**, behind ports. The mechanism must be **per-tenant** and inherit down the hierarchy.

**Recommended design:**
- **Interface:** expose `useFlag(key): boolean` and `useConfig(key): T` from `shared/config`, shaped to the **OpenFeature client-SDK** contract (evaluate-by-key, context-aware) so the pilot's static provider can be swapped for **Unleash/OpenFeature** in production without touching call sites.
- **Evaluation context = the auth context** (`tenantId`, `subsidiaryId`, `roles` from `useAuth()`), so a flag can be resolved per tenant/subsidiary/role — the SDK pattern of binding an evaluation context to all child evaluations.
- **Resolution = most-specific-wins inheritance** (same chain as config, Topic 1 data architecture): `subsidiary value → parent/tenant value → system default`. Store as `(tenantId, subsidiaryId|null, key, value)` rows (prod) / a static keyed object (pilot).
- **Pilot provider:** a static in-repo map with **all external-system flags hardcoded `false`**; the `NoopAdapter` ports (Topic 3) sit behind them. Flipping a flag in the pilot does nothing until a real adapter exists — which is the intended seam behavior.
- **Production target:** Unleash (open-source server + `@unleash/proxy-client-react`) or any OpenFeature provider — gradual rollout, per-tenant segmentation, A/B all become config, not code.
- _Sources: [OpenFeature React SDK](https://openfeature.dev/docs/reference/sdks/client/web/react/); [Unleash React guide](https://docs.getunleash.io/guides/implement-feature-flags-in-react); [Best React feature-flag libs 2025 (Reflag)](https://reflag.com/blog/feature-flags-react)._

### Technology Adoption Strategy — pilot → production

_Confidence: High._ The migration is **interface-by-interface, not big-bang** — a Strangler-Fig-style incremental cutover applied to the repository/seam layer:
- The Strangler Fig pattern replaces a system incrementally behind a façade that routes old vs new, delivering value per increment with reduced risk. Here the "façade" is the **dependency-injection composition root**: each `Repository<T>` (leads, customers, tickets) can be swapped from `LocalStorage*` to `Http*` **one entity at a time**, or all at once via config — feature code is untouched either way.
- **Sequence recommendation:** (1) stand up Postgres + RLS + the REST API honoring §5; (2) swap `AuthProvider` mock → OIDC; (3) swap repositories to `Http*`; (4) move event emission to the outbox; (5) flip external-system flags only when their adapters exist. Each step is independently shippable and reversible (flip the injected implementation back).
- **What this buys:** the pilot is not throwaway — it's the production frontend with a different adapter set. The only genuine *new build* (not a swap) is the **server-side trust boundary** (scoping/validation/authorization/RLS), flagged repeatedly above.
- _Sources: [Strangler Fig (AWS)](https://docs.aws.amazon.com/prescriptive-guidance/latest/cloud-design-patterns/strangler-fig.html); [Strangler Fig (Azure)](https://learn.microsoft.com/en-us/azure/architecture/patterns/strangler-fig); [Strangler Fig & microfrontends](https://www.leanderhoedt.dev/blog/strangler-fig)._

### Testing and Quality Assurance

_Confidence: High; gap relative to DoD §10._ The repo has no test runner yet, but DoD §10 requires the story→spec→code→**test**→issue chain and `bmad-code-review`.
- **Unit:** Vitest — transition maps (§3.2: assert every illegal transition is rejected), Zod schemas, config/flag resolution chain, repository adapter behavior.
- **Component:** React Testing Library — assert all four UI states render (§8.1) and optimistic rollback fires on simulated failure.
- **E2E:** Playwright — the lead→customer conversion flow, ticket lifecycle, tenant/subsidiary switching, and a **cross-tenant isolation test** (a user from tenant A must get `404` on tenant B's record, §6.3).
- **The fault-injection toggle** (above) is what makes the error/rollback paths testable pre-backend.

### Deployment and Operations Practices

_Confidence: High._
- **Pilot:** Vercel preview deploys per PR (DoD §10 requires "preview deploy green") — Vercel's native Git integration covers this directly.
- **Production:** SPA stays on Vercel; backend (Postgres + API + outbox worker) on a region-pinnable cloud (Topic 7). CI runs Vitest/Playwright + `bmad-code-review` as the stage gate.
- **Observability:** structured JSON logs (§7.4) with `tenantId`/`subsidiaryId`/`correlationId` on every line make per-tenant tracing and incident response possible; `correlationId` ties a log line to its audit record and domain event.

### Risk Assessment and Mitigation

| Risk | Severity | Mitigation |
|---|---|---|
| Trust-boundary checks (scoping/validation/authz) only client-side in pilot, mistaken for "done" | **High** | Treat server-side enforcement + RLS as a *separate epic*, not a swap. Cross-tenant E2E test as a gate. |
| RLS without `tenant_id`-leading indexes | High | Index review mandatory before prod load; benchmark at representative scale. |
| Rollback/error paths untested because localStorage never fails | Medium | Fault-injection toggle in the localStorage adapter. |
| IdP role claims don't match `Role` union | Medium | Normalization layer in production `AuthProvider`. |
| Residency requirement emerges at subsidiary grain | Medium | Confirm tenant-grain residency in architecture; keep Silo seam. |
| Vercel no-BYOC blocks a residency-bound backend | Medium | Backend off-Vercel from the start; SPA-only on Vercel. |
| Outbox at-least-once → duplicate events | Low | Idempotent consumers keyed on `eventId`/`Idempotency-Key`. |

## Technical Research Recommendations

### Implementation Roadmap
1. **Pilot foundation** — Vite SPA, shared layer (`Repository`, `AuthProvider` mock, event bus, flag provider, UI inventory), localStorage adapters, all four UI states, optimistic+rollback with fault injection.
2. **Backend foundation** — Postgres + RLS (tenant-leading indexes), REST API per §5, server-side scoping/validation/authz (the real build).
3. **Auth cutover** — mock `AuthProvider` → OIDC (PKCE) + role normalization.
4. **Repository cutover** — `LocalStorage*` → `Http*`, entity by entity.
5. **Events to outbox** — transactional outbox + worker + read models for Events Log/dashboards.
6. **External seams** — flip Odoo/Unifonic ports only when adapters + flags are ready.
7. **Residency** — Posture A (region-pinned Pool) default; Silo routing for any hard-residency tenant.

### Technology Stack Recommendations (consolidated)
TypeScript 5 (strict) · React + Vite · TanStack Query v5 (server state + optimistic/rollback) · React Router v7 (SPA mode) · React Hook Form v7 + Zod v4 · Context (+Zustand if needed) · OpenFeature-shaped flags (→ Unleash) · react-oidc-context + PKCE (→ prod) · PostgreSQL + RLS (Pool, hybrid-to-Silo seam) · transactional outbox · Vitest/RTL/Playwright · Vercel (SPA) + region-pinnable cloud (backend).

### Skill Development Requirements
Postgres RLS + index design; OIDC/PKCE + claims normalization; transactional outbox/event-driven basics; TanStack Query mutation/caching model. Front-end React/TS skills already align with the stack.

### Success Metrics and KPIs
- 100% of data views pass the four-state DoD gate (§8.1).
- 0 cross-tenant leaks in the isolation E2E suite.
- Every mutation emits exactly one audit + one domain event sharing `correlationId` (§7) — assertable in tests.
- p95 list query < 50ms at representative tenant scale (validates RLS indexing).
- Repository swap requires **0** changes to feature code (validates the seam).

---
# Synthesis: Decisions the Architecture Phase Can Inherit

## Executive Summary

min-crm is technically feasible **as specified** — the fixed stack (TypeScript/React/localStorage/Vercel) and the contracts already written into `project-context.md` are coherent, current, and require no reversal. The central insight of this research is that **project-context already encodes most of the right architecture**: every entity carries `tenantId`/`subsidiaryId`, persistence is funneled through one `Repository<T>` interface, auth flows through one `AuthProvider`, and every mutation emits one audit + one domain event. The pilot's localStorage key scheme `crm:{tenantId}:{subsidiaryId|_parent}:{entity}` is, in miniature, a **Pool (shared-DB) multi-tenant model** — so the production target is a continuation of the pilot's shape, not a pivot.

The recommended production isolation model is therefore **Pool: shared PostgreSQL with Row-Level Security**, with the `Repository` layer architected so a high-compliance or high-volume tenant can be **routed to a dedicated Silo database later** (a hybrid / "dynamic multi-tenancy" strategy). RLS becomes the database-level backstop behind the §6.3 authorization gates; `tenant_id` is the hard isolation boundary and `subsidiary_id` is a scoping dimension *inside* it — which is exactly what the two-level `tenant → subsidiary` hierarchy needs (per-subsidiary scoping, parent roll-up, inherit-or-override config, cheap row-level onboard/offboard).

The pilot→production path is a **Strangler-Fig, interface-by-interface swap**, not a rewrite: the same React frontend ships to production with a different adapter set injected at the composition root. The **one genuine new build** — and the single most important caveat in this report — is the **server-side trust boundary**: scoping, validation, and authorization run client-side inside the pilot adapter (acceptable only because the pilot uses mock auth), and must be *re-implemented* server-side (plus RLS) for production. Treating that as a "swap" rather than a dedicated epic is the primary project risk.

**Key Technical Findings:**
- The fixed stack is sound; **no fixed-stack reversal is recommended**. The conflicts found are *seam clarifications*, not contradictions (see Conflict Register).
- Pool + RLS is the smallest-delta, lowest-ops production isolation model and maps directly onto the existing schema; Silo is the escape hatch for hard residency/isolation; Bridge (schema-per-tenant) is the awkward middle and is **not** recommended.
- The mandatory RLS performance rule: **`tenant_id` must lead every primary access index** (~120ms → ~1.2ms at scale).
- TanStack Query v5 satisfies the §4.8 optimistic-update-with-rollback mandate natively; the four §8.1 UI states wire to its query states via one shared boundary component.
- Data residency is a **design seam**: build for Posture A (region-pinned Pool); keep the Silo seam for Posture B (hard per-tenant residency). Confirm residency is at **tenant** grain.

**Technical Recommendations (top 5):**
1. Adopt **Pool (shared Postgres + RLS), hybrid-to-Silo** as the production isolation target; index `tenant_id`-leading everywhere.
2. Keep **every cross-layer boundary an interface** (Repository, AuthProvider, event bus, flags, external ports) with a pilot adapter and a production adapter — the swap is then mechanical for data, deliberate for trust.
3. Lock the **client stack**: TanStack Query v5 + React Router v7 (SPA) + React Hook Form v7 + Zod v4 + Context/Zustand.
4. Plan the **server-side trust boundary (scoping/validation/authz + RLS) as its own epic**, with a cross-tenant isolation E2E test as the gate.
5. Treat **residency and the OIDC role-claim normalization** as named seams to confirm with the customer/IdP during architecture.

## Table of Contents

1. Technical Research Scope Confirmation *(above)*
2. Technology Stack Analysis *(above)*
3. Integration Patterns Analysis — contract seams *(above)*
4. Architectural Patterns and Design — isolation keystone *(above)*
5. Implementation Approaches and Technology Adoption *(above)*
6. **Per-Topic Recommendation Matrix** *(below)*
7. **ADR-Style Decision List** *(below)*
8. **Conflict & Clarification Register** *(below)*
9. Research Methodology and Source Documentation *(below)*
10. Conclusion and Next Steps *(below)*

## Per-Topic Recommendation Matrix

| # | Topic | Recommended Target | Primary Trade-off Accepted | Confidence |
|---|---|---|---|---|
| 1 | Multi-tenant isolation | **Pool: shared Postgres + RLS**, hybrid-to-Silo seam | Logical (not physical) isolation by default; mitigated by RLS + Silo escape hatch | High |
| 2 | Pilot→production seam | **Repository/Adapter** behind `Repository<T>`; Strangler-Fig swap | Trust-boundary checks are a real server-side build, not a swap | High |
| 3 | Client architecture | **TanStack Query v5** + React Router v7 (SPA) + RHF v7 + Zod v4 + Context/Zustand | React Router v7 over TanStack Router (ecosystem vs max type-safety) | High |
| 4 | Audit log + event bus | Pilot **in-process bus + append-only log**; prod **transactional outbox** + CQRS-lite read models | At-least-once delivery → idempotent consumers required | High |
| 5 | AuthN/Z | One **`AuthProvider`**; mock now → **OIDC + PKCE**; claims `{sub, tenant_id, subsidiary_id, roles, exp}` | Per-IdP role-claim normalization layer needed | High |
| 6 | Config & feature flags | **OpenFeature-shaped** `useFlag`/`useConfig`; static pilot provider → Unleash; most-specific-wins inheritance | External flags hard-off in pilot do nothing until adapters exist (intended) | High |
| 7 | Deployment | **SPA on Vercel**; backend (Postgres+API+outbox) on a **region-pinnable cloud, off-Vercel** | Vercel no-BYOC → backend cannot live on Vercel for residency cases | High |

## ADR-Style Decision List

> Format: each entry is ready to drop into `decision-log.md` / an ADR template as **Accepted (proposed)** pending architecture-phase ratification. Context and consequences are compressed; rationale lives in the cited body sections above.

**ADR-001 — Production multi-tenant isolation: Pool (shared Postgres + RLS) with hybrid-to-Silo capability.**
*Context:* tenant→subsidiary hierarchy, greenfield prod, residency TBD. *Decision:* shared Postgres; RLS keyed on `tenant_id`; repository can route a flagged tenant to a dedicated Silo DB. *Consequences:* lowest ops; logical isolation by default; requires `tenant_id`-leading indexes; Silo path must exist in the repository even if unused. *Rejected:* Bridge/schema-per-tenant (migration pain without full isolation); Silo-for-all (premature cost). *Refs:* §Architectural Patterns.

**ADR-002 — `tenant_id` is the isolation boundary; `subsidiary_id` is an in-tenant scoping dimension.** *Decision:* RLS enforces tenant; subsidiary filtering is an authorization layer above RLS; parent-level users (`subsidiary_id=null`, `tenant_admin`) relax the filter for roll-up. *Consequences:* onboard subsidiary = insert row + `Tenant.SubsidiaryAdded`; offboard = soft-delete subtree + `Tenant.SubsidiaryRemoved`; no infra per subsidiary. *Constraint:* breaks if residency is required at subsidiary grain (see ADR-010).

**ADR-003 — Mandatory RLS indexing rule.** *Decision:* every table with tenant data has `tenant_id` as the leading column of its primary access indexes. *Consequence:* ~2-orders-of-magnitude query-time difference; index review is a prod gate.

**ADR-004 — Persistence behind a single `Repository<T>` interface; localStorage and HTTP are swappable adapters injected at the composition root.** *Decision:* feature code depends only on the interface; swap is per-entity, Strangler-Fig. *Consequence:* pilot is not throwaway; data-shape swap is mechanical.

**ADR-005 — Server-side trust boundary is a dedicated build, not a swap.** *Decision:* scoping, validation, and authorization (and RLS) are re-implemented server-side for production; the pilot's client-side copies are demoted to UX-only. *Consequence:* planned as its own epic; cross-tenant isolation E2E test is the acceptance gate; cross-tenant reads return `404` not `403`.

**ADR-006 — Client stack.** *Decision:* TanStack Query v5 (server state) + React Router v7 in SPA/library mode + React Hook Form v7 + Zod v4 (one schema → type + runtime validation) + React Context for auth/tenant/flags (Zustand only if cross-feature UI state emerges); **not** Redux. *Consequence:* optimistic-update/rollback (§4.8) and four UI states (§8.1) are first-class.

**ADR-007 — Optimistic mutations via `useMutation` onMutate/onError/onSettled; build a fault-injection toggle into the localStorage adapter.** *Decision:* snapshot+rollback pattern; pilot simulates failures so error/rollback paths are tested before a backend exists. *Consequence:* distinguishes `409` (version) from `422` (validation/transition) on rollback.

**ADR-008 — Audit + domain events: in-process bus + append-only log in the pilot; transactional outbox + CQRS-lite read models in production.** *Decision:* state change and event row written in one DB transaction; worker publishes; consumers idempotent on `eventId`. *Decision:* `correlationId` generated at the action edge and stamped on audit record, domain event, and structured logs. *Consequence:* tenant-tagging flows automatically from `BaseEntity`; **not** full event sourcing.

**ADR-009 — Auth: one `AuthProvider`, mock SSO → OIDC Authorization Code + PKCE; claims `{sub, tenant_id, subsidiary_id|null, roles[], exp}`; production AuthProvider includes an IdP→`Role` normalization layer.** *Consequence:* tenant never trusted from a client header; subsidiary-from-header only after server validation.

**ADR-010 — Data residency: build for Posture A (region-pinned Pool); retain Silo routing for Posture B (hard per-tenant residency).** *Open question:* confirm residency grain is **tenant**, not subsidiary, with the customer. *Consequence:* backend lives off-Vercel on a region-pinnable cloud.

**ADR-011 — Feature flags & config: OpenFeature-shaped `useFlag`/`useConfig`, evaluation context = auth context, most-specific-wins inheritance (`subsidiary → tenant → default`); external-system flags hard-off in the pilot behind Noop ports.** *Production:* swap static provider for Unleash/OpenFeature without touching call sites.

**ADR-012 — External systems (Odoo, Unifonic, Cloud) and out-of-scope engines (multi-cloud, billing, AI agent) are Ports & Adapters seams only.** *Decision:* define ports + flags; Noop adapters in the pilot; no vendor SDK referenced at any call site; engines are out of scope.

**ADR-013 — Testing stack (closing a DoD §10 gap): Vitest + React Testing Library + Playwright.** *Decision:* unit (transitions, schemas, flag resolution), component (four states + rollback), E2E (conversion, ticket lifecycle, tenant switch, cross-tenant isolation). *Consequence:* satisfies the story→spec→code→test chain.

## Conflict & Clarification Register

> No recommendation **reverses** the fixed stack (TS/React/localStorage/Vercel) or project-context. The items below are points where a recommendation **adds a constraint, exposes a seam, or needs a decision** the architecture phase must ratify. Flagged explicitly per the research mandate.

| ID | Type | Where it touches the fixed stack / project-context | Resolution needed in architecture |
|---|---|---|---|
| **F-1** | **Seam clarification (highest priority)** | §4.2/§6.3 say scoping/validation/authz are enforced in the repository/server. In the pilot these run **client-side**. | Ratify that production re-implements these server-side + RLS as a dedicated epic; client copies are UX-only. Not a localStorage conflict — a trust-boundary clarification. |
| **F-2** | Open question (residency) | project-context names data residency as a must-have but doesn't pin grain. | Confirm residency is **tenant-grain** (Pool survives) vs **subsidiary-grain** (breaks the two-level Pool; needs Silo at subsidiary). |
| **F-3** | Platform limit (Vercel) | Vercel is fixed for the SPA; project-context targets a "real multi-tenant backend." | Confirm the **backend lives off-Vercel** (no BYOC, multi-region Pro/Ent only). SPA-on-Vercel is unaffected. |
| **F-4** | Stack addition (testing) | DoD §10 requires a test chain; repo has **no test runner**. | Ratify Vitest/RTL/Playwright (ADR-013). Additive, no conflict. |
| **F-5** | Library choice latitude | project-context fixes React/TS but not the data/routing libraries. | Ratify ADR-006 picks; note React Router v7 vs TanStack Router latitude if type-safe URL-driven filters become a priority. |
| **F-6** | Production DB choice (greenfield) | project-context says "seams target a real backend" without naming a DB. | Ratify **Postgres** as the isolation primitive (RLS depends on it). If iSolution boilerplate later mandates a different DB, re-evaluate ADR-001/003. |
| **F-7** | Pilot testability gap | §8.1/§4.8 require error/rollback states; localStorage never fails on transport. | Ratify the **fault-injection toggle** (ADR-007) so those paths aren't shipped untested. |
| **F-8** | Auth integration detail | §6.1 fixes the claims object; IdP role claims aren't standardized. | Ratify the **role-normalization layer** in the production AuthProvider (ADR-009). |

## Research Methodology and Source Documentation

**Scope & framework.** Seven decision areas evaluated against the fixed constraints in `project-context.md`, each producing a target + trade-offs + rationale, plus an ADR list and conflict register. Two steering inputs from the requester shaped Topics 1 and 7: production target = greenfield; residency = research-and-flag.

**Verification.** Load-bearing claims (RLS patterns & performance, isolation-model trade-offs, residency strategies, TanStack Query optimistic/rollback API, OIDC/PKCE + multi-tenant claims, outbox semantics, Vercel limits, library currency) were verified against current (2025–2026) sources, favoring vendor docs and prescriptive cloud guidance. Confidence is High across topics; the only Medium-confidence areas are explicitly the *open decisions* (residency grain, future iSolution DB mandate), surfaced as register items rather than asserted.

**Primary sources by topic:**
- *Isolation/data:* [AWS RLS prescriptive guidance](https://docs.aws.amazon.com/prescriptive-guidance/latest/saas-multitenant-managed-postgresql/rls.html), [Postgres RLS multi-tenancy (Fritzsche)](https://ricofritzsche.me/mastering-postgresql-row-level-security-rls-for-rock-solid-multi-tenancy/), [Pool/silo/bridge models](https://www.justaftermidnight247.com/insights/tenant-isolation-in-saas-pool-silo-and-bridge-models-explained/), [DB-per-tenant vs shared schema](https://asadali.dev/blog/multi-tenant-saas-practical-comparison-database-per-tenant-vs-shared-schema/), [Bytebase multi-tenant patterns](https://www.bytebase.com/blog/multi-tenant-database-architecture-patterns-explained/), [hierarchical data models](https://thinkaicorp.com/scaling-the-heights-of-multi-tenant-saas-with-hierarchical-data-models/), [WorkOS multi-tenant guide](https://workos.com/blog/developers-guide-saas-multi-tenant-architecture).
- *Client stack:* [TanStack Query overview](https://tanstack.com/query/v5/docs/framework/react/overview), [Optimistic Updates](https://tanstack.com/query/v5/docs/react/guides/optimistic-updates), [does-it-replace-Redux](https://tanstack.com/query/v5/docs/react/guides/does-this-replace-client-state), [TanStack Router vs React Router v7](https://www.pkgpulse.com/blog/tanstack-router-vs-react-router-v7-2026), [Zod v4 + RHF](https://tecktol.com/zod-react-hook-form/).
- *Seams/events/auth:* [Transactional outbox (microservices.io)](https://microservices.io/patterns/data/transactional-outbox.html), [Outbox trade-offs](https://www.softwarecraftsperson.com/posts/2025-10-08-transactional-outbox-pattern/), [Repository/Adapter pattern](https://blog.codeminer42.com/scalable-frontend-2-common-patterns-d2f28aef0714/), [tenant_id claim convention](https://granit-fx.dev/dotnet/infrastructure/multi-tenancy/claims-convention/), [OIDC+RBAC](https://docs.kuadrant.io/0.11.0/authorino/docs/user-guides/oidc-rbac/), [react-oidc-context](https://github.com/authts/react-oidc-context), [Strangler Fig (AWS)](https://docs.aws.amazon.com/prescriptive-guidance/latest/cloud-design-patterns/strangler-fig.html).
- *Flags/deploy:* [OpenFeature React SDK](https://openfeature.dev/docs/reference/sdks/client/web/react/), [Unleash React](https://docs.getunleash.io/guides/implement-feature-flags-in-react), [Vercel Functions limits](https://vercel.com/docs/functions/limitations), [Vercel regions](https://vercel.com/docs/functions/configuring-functions/region).

**Limitations.** This report evaluates options and recommends targets; it does not produce schemas, API specs, or code — those are architecture-phase outputs. Out-of-scope engines (multi-cloud, billing, AI agent) are treated as seams only. Residency grain and any future iSolution-boilerplate DB mandate are unresolved inputs flagged for the architecture phase.

## Conclusion and Next Steps

**Summary.** min-crm is feasible on the fixed stack with no reversals. project-context already pre-commits the hard parts (tenant-scoped entities, single Repository/AuthProvider seams, dual event streams), which makes Pool+RLS the natural production isolation target and a Strangler-Fig adapter swap the natural migration. The defining risk is mistaking the **server-side trust boundary** for a swap when it is a build.

**Strategic impact.** Adopting these decisions lets the architecture phase start from a ratified baseline: one isolation model, one set of seams, one client stack, one event strategy — and a short list of genuinely open questions (residency grain, DB mandate, IdP claims) rather than an open-ended design space.

**Next steps for the architecture run:**
1. Ratify ADR-001…013 (or amend with `decision-log.md` entries where you diverge).
2. Resolve register items **F-1, F-2, F-6** first — they have the widest blast radius.
3. Feed the recommendation matrix into the solution-design workflow (`bmad-create-architecture`).
4. Produce the concrete artifacts this report intentionally omits: Postgres schema + RLS policies, the OpenAPI spec for §5, and the shared-layer interface signatures.

---

**Technical Research Completion Date:** 2026-06-06
**Research Period:** Current comprehensive technical analysis (2025–2026 sources)
**Source Verification:** All load-bearing claims cited with current sources
**Technical Confidence Level:** High — open decisions surfaced as register items, not asserted

_This document is an options-and-targets technical reference for min-crm. It is intended to be adopted by the architecture workflow as a ratified decision baseline._

