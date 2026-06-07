---
title: min-crm
status: final
created: 2026-06-06
updated: 2026-06-06
owner: Heba
inputs:
  - _bmad-output/planning-artifacts/briefs/brief-MiniCRM-2026-06-06/brief.md
  - _bmad-output/planning-artifacts/briefs/brief-MiniCRM-2026-06-06/addendum.md
  - _bmad-output/planning-artifacts/briefs/brief-MiniCRM-2026-06-06/.decision-log.md
  - _bmad-output/planning-artifacts/research/domain-crm-domain-vocabulary-research-2026-06-06.md
  - _bmad-output/planning-artifacts/research/technical-min-crm-technical-architecture-feasibility-research-2026-06-06.md
  - _bmad-output/project-context.md
---

# PRD: min-crm

*Lightweight multi-tenant CRM — Product A on the iSolution Platform Boilerplate.*

## 0. Document Purpose

This PRD is for the architecture, UX, and delivery owners who expand min-crm into solution design, story specs, and code. It synthesizes the settled Phase-1 artifacts — the product brief and its addendum, the domain and technical research, and the engineering constitution (`project-context.md`) — into one decision-ready foundation. Settled decisions are carried forward, not re-debated.

**How to read it.** §1–§3 establish vision, users, and a verbatim glossary the rest of the document and all downstream artifacts must use exactly. §4 lifts the constitution's contracts as **binding non-functional requirements (NFR-1…NFR-12)** and adopts the ADR baseline by reference. §5 records the resolved flags. **§6 is the core: Epic → Feature → Story.** Epic 0 is the governing standards contract — its Universal Conformance ACs (UC-1…UC-5) and Traceability hook (TC) are the Definition of Done baked into *every* other story, not a separate workstream. §7–§12 cover non-goals, MVP boundary, the two-sided success metrics, traceability model, open questions, and the assumptions index.

The constitution is **fixed**. Where this PRD states a contract as an NFR, it is lifting an existing constitutional rule — not inventing one. Deviations require a decision-log entry (see `.decision-log.md` at this workspace root).

## 1. Vision

min-crm is a small, multi-tenant CRM that runs the full commercial thread for a B2B team — capture a lead, qualify it, convert the good ones into customers, and support those customers with tickets — without the weight or price of an enterprise CRM. It is deliberately small in features and deliberately exhaustive in conformance: every screen and every operation exercises a shared-platform capability *the right way*, so the codebase reads as a **reference implementation**, not a demo.

The product carries two audiences and therefore two deliverables. The **end user** — a sales or support team inside a tenant org — gets a working CRM that runs the journey end to end: a tenant onboards subsidiaries, sales captures and qualifies leads, a qualified lead converts into a customer, and support works tickets against that customer — all role-gated, tenant-isolated, and recorded on an immutable activity timeline. The **iSolution team** gets the pilot's real payoff: proof that the boilerplate's layering holds and that the spec-driven, AI-accelerated method (Epic → Feature → Story, governed by a fixed constitution) produces familiar, copy-pasteable, standardized output the next product team can inherit and build on faster, with less rework.

The vision's signature move: the hidden plumbing **is** the demo. The immutable audit/event log, surfaced as a per-record activity timeline, is simultaneously a headline user feature and the compliance backbone — collapsing the usual "boring infra vs. user value" tradeoff. The 2-week pilot is the **production frontend running on a localStorage adapter** — not a throwaway prototype. Success is two-sided: the product flows must work, *and* the method must be proven (speed, low rework, clean handoff, intact traceability, and a 0-change repository swap from localStorage to a real backend).

## 2. Users & Roles

### 2.1 Jobs To Be Done

- **As a tenant admin**, I need to stand up my org's structure (subsidiaries, users) and trust that every team only sees its own data, so I can run a parent-with-child-units business on one CRM with a clean isolation boundary.
- **As a salesperson**, I need to capture leads, judge which are worth pursuing, and convert the qualified ones into customers without losing the lineage of how a "lead we got in March" became "a customer with three open tickets."
- **As a support agent**, I need to work tickets against real customers, with the customer's history one click away, and never be able to open a ticket against a customer who isn't ready for one.
- **As a read-only stakeholder**, I need to see what's happening within my scope without the risk of changing anything.
- **As the iSolution platform team (the builder)**, I need a real product shipped through the method so I can measure whether the boilerplate and the spec-driven flow actually deliver speed, conformance, and clean handoff.

### 2.2 Roles & Permission Matrix *(lifted verbatim from brief addendum §A — PRD-ready)*

Four roles, confirmed by domain research as a clean mapping onto industry CRM archetypes (Manager folds into `tenant_admin`). **All rows are implicitly tenant/subsidiary-scoped; out-of-tenant access returns `404` (never leaks existence); deny-wins.**

| Capability | tenant_admin | sales | support | viewer |
|---|:--:|:--:|:--:|:--:|
| Manage tenant/subsidiaries, users, config | ✅ | — | — | — |
| Onboard/offboard subsidiaries | ✅ | — | — | — |
| Cross-subsidiary roll-up view | ✅ | — | — | — |
| Leads — create / edit / convert | ✅ | ✅ | — | view |
| Leads — view | ✅ | ✅ | —¹ | ✅ |
| Customers — create / edit | ✅ | ✅ | — | view |
| Customers — view | ✅ | ✅ | ✅ | ✅ |
| Tickets — create / edit / assign | ✅ | —² | ✅ | — |
| Tickets — view | ✅ | ✅ | ✅ | ✅ |
| View audit / events | ✅ | own | own | — |
| Delete (soft) / export | ✅ | restricted | restricted | — |

¹ Pilot decision (flag E): support is **lead-blind**. ² Pilot decision (flag F): sales is **read-only** on tickets. Both least-privilege; relax later if needed.

Enforcement is **two-gate** (route guard + action guard), always derived from auth context — never from props or client input (NFR-6).

> **Reconciliation note.** This is the addendum-§A matrix: the **finer-grained reconciliation** of constitution §6.2, confirmed against domain research. It refines §6.2 (adding the onboard/offboard, roll-up, and per-action rows) without contradicting it; where the constitution is coarser, this matrix is the authoritative cell-level contract Epic 0 (E0-S6) encodes and unit-tests.

### 2.3 Key User Journeys

FRs and stories reference these by ID inline.

- **UJ-1. Dana, the tenant admin, stands up a second subsidiary and trusts the wall between them.**
  Dana administers "Northwind Group." Already authenticated via mock SSO with `tenant_admin` and `subsidiary_id = null`. From the AppShell she opens Subsidiaries, adds "Northwind East," and the system creates the subsidiary node and emits `Tenant.SubsidiaryAdded`. She uses the tenant/subsidiary switcher to drop into Northwind East and sees an empty leads list — none of the parent or sibling data bleeds through. **Climax:** the switcher header confirms her active scope and the data visibly changes. **Edge case:** if she tries to open a record by ID that belongs to another tenant, she gets a 404, not a permission error.

- **UJ-2. Sam, in sales, takes a web lead from new to qualified.**
  Sam captures a lead that arrived via the web form, assigns himself as owner, and works it: `new → contacted`, then a judgment call to `qualified`. The list filters by status and owner. **Climax:** the lead's status pill turns "success" green and the activity timeline shows every step, each stamped with who and when. **Edge case:** Sam tries to skip straight from `new → qualified`; the system rejects the illegal transition with a 422 and the pill never changes.

- **UJ-3. Sam converts a qualified lead and watches it become a prospect customer.**
  From the qualified lead's detail page, Sam clicks Convert (through a confirm dialog). The **conversion saga** runs visibly: it carries the field-map contract across, creates a Customer in `prospect`, marks the lead `converted` (now read-only), and writes bidirectional lineage. **Climax:** both the lead and the new customer timelines show a linked conversion event sharing one correlationId. **Edge case:** a transient failure mid-saga rolls back cleanly (compensating step) and the lead stays `qualified` — no half-made customer.

- **UJ-4. Priya, in support, can only open a ticket once the customer is ready.**
  The new customer is walked `prospect → onboarding → active` by the onboarding workflow. Priya opens the customer, files a ticket, assigns it to herself, and works it `open → in_progress → resolved → closed`. **Climax:** the customer's activity timeline interleaves the ticket lifecycle with the conversion lineage — one continuous story. **Edge case:** Priya tries to file a ticket while the customer is still `prospect`; the action is blocked by the customer-state gate.

- **UJ-5. Dana reads the funnel across her whole org.**
  Dana opens the dashboard shell; one read-model widget (conversion funnel or per-subsidiary roll-up) aggregates her subsidiaries' data from the event log. **Climax:** she sees a cross-subsidiary roll-up no single-subsidiary user can see. A ticket assignment fires an in-app notification to its assignee. **Edge case:** a subsidiary user opening the same dashboard sees only their own scope.

### 2.4 Non-Users (v1)

- Marketing-automation operators (no lead-scoring engine, no behavioral event stream in the pilot).
- External end customers / requesters (no customer-facing portal; tickets are internal-agent-operated).
- Billing/subscription admins, multi-cloud provisioners, AI-agent operators (seams only — OFF).

## 3. Glossary

*Lifted verbatim from `domain-…research §6.1`. Downstream workflows and readers must use these terms exactly. FRs, UJs, stories, and SMs use Glossary terms verbatim; introducing a synonym anywhere is a discipline violation.*

| Term | Definition (as min-crm should use it) |
|---|---|
| **Lead** | A potential customer who has not yet been qualified+converted. Product-layer entity (Sales Journey). |
| **Lead source** | Channel a lead originated from: `web / referral / event / outbound / import`. Reporting/attribution dimension. |
| **Lead owner** | The single `sales` (or `tenant_admin`) user responsible for the lead (`ownerId`). |
| **Lifecycle Stage** | A contact's *relationship* to the company (Lead→MQL→SQL→Customer); mostly forward-only. min-crm collapses this into Lead + Customer status. |
| **Lead Status** | *Sales-activity* state during qualification: `new / contacted / qualified / disqualified / converted`. Can cycle (disqualified→contacted). |
| **MQL / SQL** | Marketing-Qualified (machine/score-qualified) vs Sales-Qualified (human-qualified). min-crm collapses both into a single `qualified`. |
| **BANT** | Lightweight qualification framework: **B**udget, **A**uthority, **N**eed, **T**imeline. Recommended qualification vocabulary for min-crm. |
| **Lead scoring** | Ranking by demographic/firmographic fit + behavioral intent. *Vocabulary only — not built in pilot.* |
| **Qualification** | Confirming a lead is worth pursuing (BANT met) → moves `contacted → qualified`. |
| **Conversion** | Transforming a `qualified` Lead into a Customer; terminal for the lead, creates lineage (`Customer.convertedFromLeadId`). Implemented as a saga. |
| **Lineage** | *How a record traveled/transformed* (Lead→Customer). Distinct from audit. |
| **Audit trail** | *Who did what, when, why* — immutable `AuditEvent` per mutation (§7 constitution). |
| **Customer** | A converted/active account. **Shared-platform** entity; CRM consumes it. Status `prospect / onboarding / active / inactive / churned` (DEC-1; supersedes the research note's 3-state aside). |
| **Ticket** | A customer support request. Product-layer entity on shared Tasks/Workflow. Linked to exactly one Customer. |
| **Priority** | How *urgently* a ticket is handled (Impact × Urgency): `low / medium / high / urgent`. |
| **Severity** | How *bad the issue is technically*. **Vocabulary only — not a field** in pilot. |
| **First Response Time (FRT)** | Submission → first meaningful reply. SLA metric. |
| **Resolution Time** | Submission → final closure. SLA metric. |
| **SLA pause** | The resolution/response clock **stops while a ticket is `pending`** (awaiting customer/3rd party). ⚠️ not yet encoded. *[PRD: documented vocabulary only — SLA timers out of pilot scope, flag D.]* |
| **Assignee** | The single `support` user working a ticket (`assigneeId`). |
| **Tenant** | Top-level customer org (parent node). `tenantId` mandatory on every record. Status `active / suspended`. |
| **Subsidiary** | Child org node under a tenant. Records carry `subsidiaryId` (null = parent-level). |
| **Roll-up** | Parent-level (tenant) **read model** aggregating subsidiary data. Never a cross-boundary write. |
| **Inheritance / override** | Subsidiary inherits tenant config/roles; may override. Precedence `subsidiary > tenant > system`, **deny-wins**. ⚠️ precedence not yet specified in constitution. *[PRD: specified here + in NFR-6/E0-S10, flag H.]* |
| **Offboarding** | Removing a subsidiary/user via **soft-delete** (`deletedAt`) + record reassignment + retention, never hard-delete. |
| **RBAC** | Role-Based Access Control: roles `tenant_admin / sales / support / viewer` → permissions on actions/resources, always tenant-scoped. |

> **Glossary additions beyond research §6.1, used by this PRD** (added in the same pass, per Glossary discipline):
> - **Conversion saga** — the persisted, resumable, compensating workflow instance that performs Conversion (DEC-2). UI-inspectable state, not an inline function.
> - **Onboarding workflow** — the workflow that walks a Customer `prospect → onboarding → active` (DEC-1), built on shared Tasks/Workflow.
> - **Activity timeline** — the per-record *product* surface that renders the record's **domain events** (status changes, lineage, assignments) in time order ("audit-as-feature"); visible with permission to view the record. **Distinct from the Audit/Events log** — the raw, matrix-gated compliance view of `AuditEvent` records (E4-S4).
> - **correlationId** — the single id shared by the one audit record and the one domain event emitted by a single mutation (NFR-7).
> - **Repository seam** — the single `Repository<T>` interface whose adapter (localStorage now, HTTP later) is swapped at the composition root with zero feature-code change (NFR-4, ADR-004).
> - **Port (Noop)** — an external-system interface guarded by a feature flag; in the pilot every external port's flag is OFF and its adapter is a Noop.

## 4. Binding Platform Contracts (NFRs) & Adopted Technical Baseline

These are **not aspirational quality attributes** — they are the constitution's contracts lifted as binding, system-wide NFRs. They bind generation and review of every story in §6. Epic 0 builds the kernels that make them true; every other epic conforms.

### 4.1 Cross-cutting NFRs (constitution-lifted)

- **NFR-1 — Three-layer architecture.** Product (`features/*`) → Shared Platform (`src/shared`) → External (ports). Dependencies flow one direction only; the shared layer never imports product code. `Customer` is a shared capability the CRM consumes, never owns. *(Constitution §1)*
- **NFR-2 — Base entity standard.** Every persisted entity extends `BaseEntity`: `id` (type-prefixed UUID), `tenantId` (required), `subsidiaryId | null`, `createdAt/updatedAt` (ISO 8601 UTC), `createdBy/updatedBy`, `version` (optimistic, starts at 1), `deletedAt | null` (soft delete). *(Constitution §2)*
- **NFR-3 — Single status source + state machines.** All statuses are defined once in `shared/domain/status.ts` with allowed transitions and a tone mapping. UI never hardcodes a status string. A change not in the transition map is rejected `422` and never silently allowed; every accepted change emits `<Entity>.StatusChanged`. Includes DEC-1 `CUSTOMER_TRANSITIONS` and Flag-C terminal `closed`. *(Constitution §3; DEC-1; Flag C)*
- **NFR-4 — Repository seam (4-beat use case).** All persistence goes through `Repository<T>`; feature code never touches `localStorage` directly. Every use case follows the 4-beat shape: **authorize → mutate → emit → audit**. The localStorage adapter mirrors the REST contract exactly so the swap to `HttpRepository` is mechanical (Strangler-Fig, injected at the composition root). *(Constitution §4–§5; ADR-004)*
- **NFR-5 — API contract parity.** The pilot adapter honors the REST contract: base `/api/v1`, plural-noun resources, `GET/POST/PATCH/DELETE` plus `POST /{resource}/{id}/transition` for status changes; success codes `200`/`201 + Location`/`204`; error codes `400/401/403/404/409/422/429/500`; list returns `Page<T>`; error envelope carries field-level `details`; `Idempotency-Key` accepted on create. Even though there is no server in the pilot, the adapter returns these shapes/codes. *(Constitution §5)*
- **NFR-6 — AuthN/Z, two gates, deny-wins.** Auth context (`{userId, tenantId, subsidiaryId|null, roles[], exp}`) is established once at the shell via `useAuth()`. Every screen has a route guard; every mutation has an action guard. Tenant/subsidiary scoping is **always** derived from auth context, never from props or client input. A record outside the caller's tenant returns **`404`** (not `403`). Auth events are audited. *(Constitution §6; ADR-009)*
- **NFR-7 — Dual event streams, one correlationId.** Every mutation emits **exactly one** immutable `AuditEvent` ("who did what, when") **and exactly one** `DomainEvent` ("something happened"), sharing a single `correlationId`. Event types are `PascalCaseEntity.PastTenseAction` from the canonical list; no free-form names. No silent writes. *(Constitution §7)*
- **NFR-8 — Structured logging & PII discipline.** App logs are structured JSON carrying `correlationId`; passwords/tokens/full PII are never logged; emails/phones masked. *(Constitution §7.4)*
- **NFR-9 — Four UI states, optimistic mutations.** Every data-backed view explicitly handles **loading / empty / error / ready**. Shipping a view without all four is a DoD failure. Mutations are optimistic with snapshot-and-rollback; a fault-injection toggle in the localStorage adapter makes rollback testable before a backend exists. *(Constitution §8.1; ADR-007)*
- **NFR-10 — Fixed UI inventory & design tokens.** Screens are assembled only from the page templates (`ListPage`, `DetailPage`, `EntityForm`, `Dashboard`) and the shared component inventory (`AppShell`, `DataTable`, `StatusPill`, `Toolbar`, `FilterBar`, form fields, `ConfirmDialog`, `Toast`, `EmptyState`, `ErrorState`, `Skeleton`). No new page layouts or one-off components. Claude Design tokens only — no hardcoded hex/px/font; status colors come only from `STATUS_TONE`. Destructive and convert actions go through `ConfirmDialog`. Keyboard-accessible; responsive to tablet. *(Constitution §8)*
- **NFR-11 — Folder structure & naming.** `src/app`, `src/shared/{data,domain,auth,events,ui,config}`, `src/features/{leads,customers,tickets,dashboard}`. Cross-feature code moves to `shared`. Naming per constitution §9. *(Constitution §9)*
- **NFR-12 — Testing harness.** Vitest + React Testing Library + Playwright. Coverage of transition maps, Zod schemas, the four UI states, optimistic rollback, and a cross-tenant isolation E2E. Closes the DoD test-chain gap. *(ADR-013)*

### 4.2 Adopted Technical Baseline (ADR-001…013 — by reference)

Adopted from `technical-…research` / brief addendum §F as the technical baseline. **Referenced, not re-derived**; the architecture phase ratifies and details.

| ADR | Decision (summary) |
|---|---|
| ADR-001 | Pool: shared Postgres + RLS, with hybrid-to-Silo routing capability. |
| ADR-002 | `tenant_id` = isolation boundary; `subsidiary_id` = in-tenant scoping dimension. |
| ADR-003 | Mandatory RLS indexing: `tenant_id` leads every primary access index. Production validation hook: p95 list query < 50 ms; index review is a production gate. |
| ADR-004 | Persistence behind one `Repository<T>`; localStorage/HTTP swappable at composition root. |
| ADR-005 | **Server-side trust boundary is a dedicated build, not a swap** (Epic 6); cross-tenant isolation E2E is its gate; cross-tenant reads → `404`. |
| ADR-006 | Client stack: TanStack Query v5 + React Router v7 (SPA) + RHF v7 + Zod v4 + Context (Zustand if needed); **not** Redux. |
| ADR-007 | Optimistic mutations via `onMutate/onError/onSettled`; fault-injection toggle in the localStorage adapter. |
| ADR-008 | Audit + domain events: in-process bus + append-only log (pilot) → transactional outbox + CQRS-lite read models (prod); `correlationId` threaded throughout; not event sourcing. |
| ADR-009 | One `AuthProvider`, mock SSO → OIDC Auth Code + PKCE; claims `{sub, tenant_id, subsidiary_id|null, roles[], exp}`; production role-normalization layer. |
| ADR-010 | Residency: build for Posture A (region-pinned Pool); retain Silo routing for Posture B. **Resolved: tenant-grain** (see §5, F-2). |
| ADR-011 | Flags/config: OpenFeature-shaped, evaluation context = auth context, most-specific-wins (`subsidiary > tenant > system`), deny-wins; external flags hard-off behind Noop ports. |
| ADR-012 | External systems + out-of-scope engines (multi-cloud, billing, AI agent) are Ports & Adapters seams only. |
| ADR-013 | Testing stack: Vitest + RTL + Playwright. |

> **Deployment (per-topic matrix #7, carried from brief §6/§8).** The SPA deploys to **Vercel** (CDN, preview deploy per PR — wired in E0-S11). The **production backend runs off-Vercel on a region-pinnable cloud** (Vercel offers no BYOC) — this constraint is load-bearing for the F-2 residency posture and is an **Epic 6** concern. Backend placement is confirmed during architecture (see §11, Open Question 5).

## 5. Resolved Flags & Decisions

Carried decisions (DEC-1, DEC-2, DEC-3, Flags C–K) are recorded in `.decision-log.md` and reflected throughout. The two still-open flags are resolved here:

- **F-2 — Data residency grain → tenant-grain (recommended default; `[CONFIRM with customer]`).** Residency is enforced at the **tenant** grain, which keeps the Pool (shared Postgres + RLS) model intact (ADR-001/010). Subsidiary-grain residency would fracture the two-level Pool and force per-subsidiary data placement; the Silo routing seam (ADR-001) is retained so a single flagged tenant can be moved to a dedicated DB if a contract later demands it. The architecture phase must confirm tenant-grain with the customer before the production build; it flips to subsidiary-grain only if a contract requires per-subsidiary placement.
- **F-6 — Production DB → PostgreSQL (adopted; ratify in architecture).** RLS is the chosen isolation primitive (ADR-001/003) and is Postgres-native, so **Postgres is the adopted production DB** — adopted pending architecture ratification, like every ADR in §4.2 ("Accepted-proposed, pending architecture ratification"). **No iSolution Platform Boilerplate DB mandate is recorded in any settled artifact.** Architecture must confirm no future mandate conflicts before Epic 6; if a non-Postgres mandate surfaces, ADR-001's RLS approach must be revisited (Open Question 1).
- **F-3 — Backend off-Vercel (carried).** The production backend runs off-Vercel on a region-pinnable cloud (see §4.2 Deployment note). Carried into Epic 6; backend placement confirmed in architecture (Open Question 5).

## 6. Epics, Features & Stories

**Reading model.** Epic 0 defines the governing contract and the **Universal Conformance ACs (UC-1…UC-5) + Traceability hook (TC)**. Every story in Epics 1–5 **inherits** these — they are listed once below and referenced per story (with the applicable subset named explicitly), rather than copied verbatim. Story-specific ACs are listed in full. Each story carries the traceability chain **story → spec → code → test → issue (`Closes #`)**.

Story IDs are stable (`E<epic>-S<n>`); they survive reorganization so downstream specs, code, and tests can reference them.

### Universal Conformance ACs (defined in Epic 0; inherited by every story)

- **UC-1 — Four UI states.** Every data-backed view this story ships handles `loading` (skeleton), `empty` (illustration + primary action), `error` (message + retry), and `ready`. *(NFR-9)*
- **UC-2 — Dual events, one correlationId.** Every mutation this story performs emits exactly one `AuditEvent` + one `DomainEvent` (canonical type) sharing one `correlationId`; assertable in tests. No silent writes. *(NFR-7)*
- **UC-3 — Illegal transitions rejected `422`.** Any status change outside the relevant transition map is rejected with `422 UNPROCESSABLE` and never silently applied. *(NFR-3)*
- **UC-4 — Conversion guard.** Where conversion is in play, it is legal **only from `qualified`**; a `converted` lead is terminal/read-only; re-conversion is blocked. *(DEC-2)*
- **UC-5 — Tenant/subsidiary scoping; out-of-tenant → `404`.** All reads/writes are scoped from auth context (never client input); a record outside the caller's tenant returns `404`, not `403`. *(NFR-6)*
- **TC — Traceability.** Story links to its spec, its code, and its tests, and closes a GitHub issue (`Closes #<issue>`). Preview deploy green; marked done in `sprint-status.yaml`; passes `bmad-code-review`. *(Constitution §10)*

---

### Epic 0 — Platform Guidelines & Standards *(the governing contract)*

**Goal.** Build the shared kernels that make NFR-1…NFR-12 structurally true, and codify the Universal Conformance ACs + DoD that every subsequent story inherits. Epic 0 is **not** a parallel workstream — its conformance items *are* the Definition of Done baked into every other story. It ships the `src/shared` foundation against which Epics 1–5 are pure product code.

> **Pilot framing.** Epic 0 establishes that min-crm is **Product A** consuming shared capabilities (NFR-1), that external systems are **Noop ports with flags OFF** (ADR-011/012), and that the pilot is the **production frontend on a localStorage adapter** — the adapter mirrors the REST contract so the later swap is mechanical (NFR-4/NFR-5).

#### Feature 0.1 — Domain & Status Kernel

**Description:** Author `shared/domain/status.ts` and `shared/domain/*.types.ts` as the single source for entity types, status enums, transition maps, and tone mapping. This realizes NFR-2 and NFR-3 and unblocks S2–S4.

- **E0-S1 — Author status enums, transition maps, and tone.**
  *As the platform, all statuses and their legal transitions are defined once so no feature hardcodes a status or invents a transition.*
  **ACs:** (a) `LeadStatus`, `CustomerStatus` (5-state, DEC-1), `TicketStatus`, `TicketPriority`, `LeadSource`, `Role`, `TenantStatus` defined as literals; (b) `LEAD_TRANSITIONS`, **`CUSTOMER_TRANSITIONS` (newly authored, DEC-1)**, and `TICKET_TRANSITIONS` with **`closed` terminal — reopen only `resolved → open` (Flag C)**; (c) `STATUS_TONE` includes `customer.prospect`/`onboarding`; (d) a `canTransition(entity, from, to)` helper the service layer uses; (e) illegal transition → `422` (UC-3); (f) unit tests cover every legal and a sample of illegal transitions per map (NFR-12). *Inherits: TC.*
  **Notes:** `[NOTE FOR PM]` Constitution §3.1/§3.2 already reflect DEC-1 + Flag C; this story makes the runtime match.

- **E0-S2 — Author `BaseEntity` and canonical entity types.**
  *As the platform, every persisted entity extends `BaseEntity` with mandatory tenant scope and audit fields.*
  **ACs:** (a) `BaseEntity` per NFR-2; (b) `Tenant`, `Subsidiary`, `User`, `Customer` (shared), `Lead`, `Ticket` types; (c) `Customer` carries `convertedFromLeadId`, `Lead` carries `convertedToCustomerId` (bidirectional lineage, flag G); (d) type-prefixed UUID helper (`lead_`, `cust_`, `tkt_`, `wf_`, …); (e) **`WorkflowInstance` (saga) entity** on shared Tasks/Workflow: `{ id (wf_…), type, status, currentStep, steps[], completedSteps[], correlationId, payload, ... } extends BaseEntity` — the persisted state the conversion saga (E3-S1) and onboarding workflow (E3-S2) read/resume from. *Inherits: TC.*

  > **`E0-S1` is a prerequisite for Epic 3** — `CUSTOMER_TRANSITIONS` (DEC-1) was the brief's 🔴-highest-priority gap ("cannot ship undefined"). Epic 3 (S3) and Epic 4 (S4) MUST NOT start until E0-S1 and E0-S2 land.

#### Feature 0.2 — Repository Seam & Data Kernel

**Description:** The single `Repository<T>` contract and the `LocalStorageRepository` adapter that mirrors the REST contract, applies tenant/subsidiary scoping from auth context, and supports fault injection. Realizes NFR-4, NFR-5, NFR-9, ADR-004/007.

- **E0-S3 — Define `Repository<T>` + `Page<T>` + `ListQuery`.**
  *As a feature author, I depend only on `Repository<T>`, never on `localStorage`.*
  **ACs:** (a) interface per constitution §4.1; (b) `list` returns `Page<T>` with default `pageSize=25`, max 100; (c) standard query params (`q/status/ownerId/page/pageSize/sort`), unknown filters ignored not errored. *Inherits: UC-5, TC.*

- **E0-S4 — Implement `LocalStorageRepository` honoring the 4-beat + REST contract.**
  *As the platform, the pilot adapter behaves like the production API so the later swap is mechanical.*
  **ACs:** (a) key scheme `crm:{tenantId}:{subsidiaryId|_parent}:{entity}`; (b) tenant/subsidiary scoping read from auth context **inside** the repository, never from the caller (UC-5); (c) create sets `id`/audit fields/`version=1`; update requires caller `version`, mismatch → `409`; delete is soft (`deletedAt`); (d) validate-before-persist with Zod, invalid → `422` + field details; (e) every mutation runs **authorize → mutate → emit → audit** (UC-2); (f) returns REST-shaped envelopes and status codes (NFR-5); (g) **fault-injection toggle** forces error paths (ADR-007). *Inherits: UC-2, UC-3, UC-5, TC.*

#### Feature 0.3 — Auth & RBAC Kernel

**Description:** One `AuthProvider`, `useAuth()`, mock SSO, and the two-gate guard system enforcing the §2.2 matrix. Realizes NFR-6, ADR-009.

- **E0-S5 — `AuthProvider` + `useAuth()` + mock SSO.**
  *As the app, auth context is established once at the shell and exposed everywhere.*
  **ACs:** (a) session claims `{userId, tenantId, subsidiaryId|null, roles[], exp}`; (b) `tenant_admin` carries `subsidiaryId = null` (relaxes the subsidiary filter for roll-up); (c) `Auth.LoggedIn/LoginFailed/LoggedOut/RoleDenied` audited (UC-2); (d) `AuthProvider` is the seam for future OIDC (ADR-009). *Inherits: UC-2, TC.*

- **E0-S6 — Route guard + action guard from the permission matrix.**
  *As the platform, every screen and every mutation is gated by role and tenant scope.*
  **ACs:** (a) route guard decides screen access; action guard decides per-mutation access on a record in the caller's tenant/subsidiary; (b) deny-wins; (c) the §2.2 matrix is encoded as data and unit-tested cell-by-cell; (d) out-of-tenant access → `404` (UC-5); (e) denied action emits `Auth.RoleDenied` (UC-2). *Inherits: UC-2, UC-5, TC.*

#### Feature 0.4 — Event, Audit & Logging Kernel

**Description:** The dual event streams, in-process bus, append-only audit log, and structured logger — all `correlationId`-threaded. Realizes NFR-7, NFR-8, ADR-008.

- **E0-S7 — Audit log + domain event bus with shared correlationId.**
  *As the platform, one mutation produces exactly one audit record and one domain event sharing a correlationId.*
  **ACs:** (a) `AuditEvent` and `DomainEvent` shapes per constitution §7; (b) append-only audit (never updated/deleted); (c) canonical event-type registry enforced (`PascalCaseEntity.PastTenseAction`); free-form names rejected; (d) one operation → one audit + one domain event, same `correlationId` — assertable test helper (UC-2); (e) secrets/PII redacted in `before/after`. *Inherits: UC-2, TC.*

- **E0-S8 — Structured logger.**
  *As an operator, logs are structured JSON I can correlate.*
  **ACs:** (a) JSON `{ts, level, tenantId, subsidiaryId, actorId, msg, correlationId, …}`; (b) emails/phones masked, no tokens/passwords/PII bodies (NFR-8); (c) levels `error/warn/info/debug`. *Inherits: TC.*

#### Feature 0.5 — UI Kernel & Component Inventory

**Description:** The fixed page templates, shared components, four-state pattern, `StatusPill` driven by `STATUS_TONE`, and Claude Design tokens. Realizes NFR-9, NFR-10.

- **E0-S9 — Build the shared component inventory + page templates.**
  *As a feature author, I assemble screens from shared components and never invent layouts.*
  **ACs:** (a) `AppShell` (nav + tenant/subsidiary switcher), `DataTable`, `StatusPill` (tone only from `STATUS_TONE`), `Toolbar`, `FilterBar`, `EntityForm` fields, `ConfirmDialog`, `Toast`, `EmptyState`, `ErrorState`, `Skeleton`; (b) `ListPage`/`DetailPage`/`EntityForm`/`Dashboard` templates; (c) **four-state harness** any data view plugs into (UC-1); (d) no hardcoded hex/px/font — tokens only; (e) destructive/convert actions require `ConfirmDialog`; (f) keyboard-accessible, responsive to tablet. *Inherits: UC-1, TC.*

#### Feature 0.6 — Conformance, Flags & Testing Harness

**Description:** The OpenFeature-shaped flag/config provider with Noop ports OFF, the testing harness, and the codified Universal DoD. Realizes NFR-12, ADR-011/012/013.

- **E0-S10 — Flag/config provider + Noop external ports.**
  *As the platform, capabilities are flag-gated and every external system is a Noop port with its flag OFF in the pilot.*
  **ACs:** (a) `useFlag`/`useConfig`, OpenFeature-shaped, evaluation context = auth context; **static provider in the pilot → Unleash in production** behind the same interface (ADR-011); (b) most-specific-wins `subsidiary > tenant > system`, deny-wins, cycle-proof (flag H); (c) external-system flags (Odoo/Unifonic/Cloud) hard-off behind Noop ports — no vendor SDK referenced at any call site (ADR-012); (d) out-of-scope engines (billing, multi-cloud, AI agent) exist as port interfaces only. *Inherits: TC.*

- **E0-S11 — Testing harness + Universal DoD codified.**
  *As the team, the DoD is structural and the test chain is closed.*
  **ACs:** (a) Vitest + RTL + Playwright wired with a sample of each test type; (b) the **cross-tenant isolation E2E** scaffold exists (asserts 0 leaks) — pilot-level, against the localStorage adapter (UC-5, SM-P3); (c) optimistic-rollback test using the fault-injection toggle; (d) the Universal Conformance ACs + DoD checklist published as the story template every Epic 1–5 story inherits (TC); (e) `sprint-status.yaml` + preview-deploy gate wired; (f) **architecture-fitness test** asserting no `src/features/*` module imports `localStorage` or a concrete repository (NFR-4, SM-M5 pilot proxy). *Inherits: UC-1…UC-5, TC.*

---

### Epic 1 — Tenancy & Subsidiary (S1) *(pilot)*

**Goal.** Tenant context + isolation threaded top-to-bottom, subsidiary onboard/offboard, the tenant/subsidiary switcher, and the parent roll-up read model. Realizes UJ-1. **Every story inherits Epic 0 (UC-1…UC-5, TC).**

#### Feature 1.1 — Tenant Context & Isolation

- **E1-S1 — Thread `TenantContext` and enforce isolation.**
  *As any user, I only ever see data in my tenant/subsidiary scope.*
  **ACs:** (a) `TenantContext` derived from auth claims and consumed by the repository (UC-5); (b) every list/read/write is scoped without the caller passing scope; (c) **out-of-tenant access by ID → `404`** (UJ-1 edge case); (d) `tenant_admin` (`subsidiaryId=null`) sees the whole tenant; a subsidiary user sees only their subsidiary + parent-level (`subsidiaryId=null`) records. *Inherits: UC-1, UC-5, TC.*

#### Feature 1.2 — Subsidiary Onboard / Offboard

- **E1-S2 — Onboard a subsidiary.**
  *As a tenant admin, I add a subsidiary node so a child unit can operate in isolation.*
  **ACs:** (a) `tenant_admin`-only (route + action guard); (b) inserts a `Subsidiary` row (data op, no infra); (c) emits **`Tenant.SubsidiaryAdded`** + audit, one correlationId (UC-2); (d) new subsidiary inherits tenant config (precedence per E0-S10); (e) `EntityForm` four states (UC-1). *Inherits: UC-1, UC-2, UC-5, TC.*

- **E1-S3 — Offboard a subsidiary (soft-delete + reassign orphans).**
  *As a tenant admin, I offboard a subsidiary without orphaning or hard-deleting its records.*
  **ACs:** (a) `tenant_admin`-only; (b) **soft-delete** the subsidiary subtree (`deletedAt`), never hard-delete (flag I); (c) **reassignment rule:** before the soft-delete commits, every active (`deletedAt = null`) lead/customer/ticket owned by the subsidiary is reassigned to a **target chosen by the admin in the offboard dialog** — either another active subsidiary in the same tenant, or parent level (`subsidiaryId = null`); the reassignment sets `subsidiaryId` (and re-scopes `ownerId`/`assigneeId` to the target where the prior owner is being offboarded), and each reassigned record emits its own `<Entity>.Updated` + audit under the offboard `correlationId`; (d) emits **`Tenant.SubsidiaryRemoved`** + audit, sharing that `correlationId` (UC-2); (e) `ConfirmDialog` required (destructive); (f) soft-deleted records excluded from lists unless `includeDeleted=true`. *Inherits: UC-1, UC-2, UC-5, TC.*

#### Feature 1.3 — Tenant/Subsidiary Switcher

- **E1-S4 — Switcher in `AppShell`.**
  *As a tenant admin, I switch active subsidiary scope and the data visibly changes.*
  **ACs:** (a) switcher in `AppShell`; (b) selecting a subsidiary sets the active subsidiary scope in auth context — the pilot adapter validates it belongs to the token's tenant, mirroring the production `X-Subsidiary-Id` header contract (constitution §5.2, NFR-6); the scope is **never** trusted as a raw client value for cross-tenant authorization; (c) the visible data set changes to match (UJ-1 climax); (d) non-admins see only their own scope (no switcher choices beyond it). *Inherits: UC-5, TC.*

#### Feature 1.4 — Parent Roll-up Read Model

- **E1-S5 — Cross-subsidiary roll-up (read model).**
  *As a tenant admin, I see aggregate counts across my subsidiaries.*
  **ACs:** (a) `tenant_admin`-only; (b) a **parent-level read model** aggregating subsidiary data — never a cross-boundary write (Glossary: Roll-up); (c) a subsidiary user opening the same surface sees only their own scope (UJ-5 edge case); (d) four states (UC-1). *Inherits: UC-1, UC-5, TC.*

---

### Epic 2 — Leads: Capture → Qualify (S2) *(pilot)*

**Goal.** Lead capture (source + single owner), list/filter, and the qualification state machine with guards and the activity timeline. Realizes UJ-2. Proves the Sales Journey, status transitions, the 4-beat, and four UI states. **Inherits Epic 0.**

#### Feature 2.1 — Lead Capture

- **E2-S1 — Capture a lead.**
  *As a salesperson, I capture a lead with a source and a single owner.*
  **ACs:** (a) `sales`/`tenant_admin` only (UC-5 + matrix); (b) Zod-validated `EntityForm`, invalid → `422` + field details; (c) `source ∈ web/referral/event/outbound/import`, exactly one `ownerId`; (d) creates `Lead` in `new`, emits **`Lead.Created`** + audit (UC-2); (e) BANT captured as a free judgment note — no scoring engine (flag J); (f) four states (UC-1). *Inherits: UC-1, UC-2, UC-5, TC.*

#### Feature 2.2 — Lead List & Filter

- **E2-S2 — List and filter leads.**
  *As a salesperson, I find leads by status and owner.*
  **ACs:** (a) `ListPage` with `DataTable` + `StatusPill` (tone from `STATUS_TONE`); (b) filter by `status`/`ownerId`, free-text `q`, sort, pagination (`Page<T>`); (c) scoped to tenant/subsidiary (UC-5); (d) four states incl. empty-with-primary-action (UC-1). *Inherits: UC-1, UC-5, TC.*

#### Feature 2.3 — Qualification State Machine

- **E2-S3 — Walk a lead through its lifecycle.**
  *As a salesperson, I move a lead `new → contacted → qualified | disqualified`, with revive.*
  **ACs:** (a) only `LEAD_TRANSITIONS` moves allowed; **illegal transition (e.g. `new → qualified`) → `422`** and pill unchanged (UJ-2 edge case, UC-3); (b) `disqualified → contacted` revive allowed; (c) each accepted change emits **`Lead.StatusChanged`** + audit, one correlationId (UC-2); (d) `qualified` is a manual judgment call (flag J/K). *Inherits: UC-2, UC-3, UC-5, TC.*

- **E2-S4 — Lead detail + activity timeline.**
  *As a salesperson, I see the lead's full history and act on it.*
  **ACs:** (a) `DetailPage` with `StatusPill`; **edit and transition actions invoke the guarded mutations** (E0-S6 action guard), so each emits its audit + domain event (UC-2) and any status move obeys the transition map (UC-3); (b) **activity timeline** renders the lead's **domain events** in time order (audit-as-feature) — this is the per-record product surface, **distinct from the matrix-gated Audit/Events log** (see E4-S4); (c) four states (UC-1). *Inherits: UC-1, UC-2, UC-3, UC-5, TC.*

---

### Epic 3 — Conversion Saga & Customer Onboarding (S3) *(pilot)*

**Goal.** The Lead→Customer **conversion saga** (DEC-2) and the customer onboarding workflow `prospect → onboarding → active` (DEC-1). Realizes UJ-3, UJ-4 (setup). Proves the reference saga, Tasks/Workflow, lineage, and audit-as-feature. **Inherits Epic 0.**

#### Feature 3.1 — Lead → Customer Conversion Saga

- **E3-S1 — Convert a qualified lead via the reference saga.**
  *As a salesperson, I convert a `qualified` lead into a `prospect` customer through a persisted, resumable, compensating saga.*
  **ACs:** (a) **conversion legal only from `qualified`** — disqualified/uncontacted/`new` cannot convert; re-conversion blocked (UC-4); (b) saga is a persisted `WorkflowInstance` (E0-S2) — **not an inline function** (DEC-2) — with **enumerated, ordered steps**, each idempotent and each with a named compensation:
    1. **guard** — assert lead is `qualified` and not already converted *(comp: none)*;
    2. **create-customer** — create `Customer` in `prospect` from the field-map *(comp: soft-delete the customer)*;
    3. **link-lineage** — set `Customer.convertedFromLeadId` + `Lead.convertedToCustomerId` *(comp: clear both pointers)*;
    4. **lock-lead** — transition lead to `converted` (terminal/read-only) *(comp: `Lead.StatusChanged` back to `qualified`)*;
    5. **emit** — write the conversion events to both timelines *(comp: the prior steps' compensations already emit the reversing canonical events — `Customer.Deleted`, `Lead.StatusChanged` — no new event type is invented, per NFR-7)*;
  (c) **resumable**: an interrupted saga reloads from `WorkflowInstance.currentStep` and continues; **idempotent**: re-running a completed step is a no-op; (d) carries the explicit **field-map contract** (name, company, contact details, source, owner, BANT note); activity history is **linked, not duplicated**; (e) emits **`Lead.Converted`** + `Customer.Created` + their audit records — the saga is **multiple mutations under one shared `correlationId`** (each mutation individually conformant to UC-2; the `correlationId` ties the saga together, satisfying NFR-7's per-mutation rule across the saga); a linked conversion event appears on **both** timelines (UJ-3 climax); (f) a mid-saga failure runs the compensations in reverse from the failed step, leaving **no half-made customer** and the lead back at `qualified` (UJ-3 edge case; tested via the fault-injection toggle); (g) **UI-inspectable**: saga state is rendered on a `DetailPage` variant (no new layout — NFR-10) showing steps, current step, and outcome; (h) `ConfirmDialog` required (convert action, NFR-10). *Inherits: UC-1, UC-2, UC-3, UC-4, UC-5, TC.*

#### Feature 3.2 — Customer Onboarding Workflow

- **E3-S2 — Walk a customer `prospect → onboarding → active`.**
  *As a salesperson/admin, I run the onboarding workflow that activates a new customer.*
  **ACs:** (a) only `CUSTOMER_TRANSITIONS` moves allowed; illegal → `422` (UC-3); (b) `prospect → onboarding → active`, with `active ↔ inactive` reactivation and `active/inactive → churned` (churned terminal); (c) built on shared Tasks/Workflow (proves the seam a second time); (d) each accepted change emits **`Customer.Updated`** (+ `StatusChanged` semantics) + audit, one correlationId (UC-2). *Inherits: UC-2, UC-3, UC-5, TC.*

#### Feature 3.3 — Customer List & Detail

- **E3-S3 — Customer list/detail with lineage + timeline.**
  *As a user, I view customers and trace each back to its originating lead.*
  **ACs:** (a) `ListPage` + `DetailPage`, `StatusPill` with `customer` tones incl. `prospect`/`onboarding`; (b) detail shows lineage (link to originating lead) and the **activity timeline**; (c) related **Tickets** tab (feeds Epic 4); (d) four states; scoped (UC-1, UC-5). *Inherits: UC-1, UC-5, TC.*

---

### Epic 4 — Ticketing & Activity Timeline (S4) *(pilot)*

**Goal.** Ticket creation **gated on customer state**, the ticket lifecycle state machine, single-assignee assignment, and the per-record activity timeline. Realizes UJ-4. Proves ticketing on shared Tasks, status-gating as a business rule, and audit-as-feature. **Inherits Epic 0.**

#### Feature 4.1 — Ticket Creation (customer-state gated)

- **E4-S1 — Create a ticket against an eligible customer.**
  *As a support agent, I open a ticket against a customer, but only when the customer is ready.*
  **ACs:** (a) `support`/`tenant_admin` only; **sales is read-only on tickets** (flag F); (b) **customer-state gate: ticket creation allowed only when the customer is `active` or `onboarding`** — blocked for `prospect`/`inactive`/`churned` (UJ-4 edge case); (c) ticket links to exactly one `Customer` and inherits its tenant/subsidiary; (d) `priority ∈ low/medium/high/urgent`; severity is not a field (vocabulary only); (e) creates `Ticket` in `open`, emits **`Ticket.Created`** + audit (UC-2); (f) four states (UC-1). *Inherits: UC-1, UC-2, UC-5, TC.*

#### Feature 4.2 — Ticket Lifecycle & Assignment

- **E4-S2 — Walk a ticket through its lifecycle.**
  *As a support agent, I move a ticket through `open / in_progress / pending / resolved / closed`.*
  **ACs:** (a) only `TICKET_TRANSITIONS` moves allowed; **`closed` is terminal — reopen only `resolved → open`** (Flag C); illegal → `422` (UC-3); (b) two-step close intentional (`resolved` reopenable, then `closed`); (c) `pending` documented as the SLA-pause state — no timer engine (flag D); (d) each accepted change emits **`Ticket.StatusChanged`** + audit, one correlationId (UC-2). *Inherits: UC-2, UC-3, UC-5, TC.*

- **E4-S3 — Assign a ticket to a single assignee.**
  *As a support agent, I assign a ticket to one support user.*
  **ACs:** (a) single `assigneeId` (a `support` user); (b) emits **`Ticket.Assigned`** + audit, one correlationId (UC-2); (c) assignment triggers the in-app notification (feeds Epic 5); (d) group/queue routing is out of scope (extension point). *Inherits: UC-2, UC-5, TC.*

#### Feature 4.3 — Activity Timeline (audit-as-feature)

- **E4-S4 — Unified per-record activity timeline.**
  *As any scoped user, I read one record's full story — lineage, status changes, assignments — in time order.*
  **ACs:** (a) the **Activity timeline** renders a record's **`DomainEvent`s** chronologically — it is the per-record *product* surface, gated by permission to **view that record** (so `viewer` sees it within scope); (b) on a customer it **interleaves conversion lineage with the ticket lifecycle** (UJ-4 climax); (c) the **Audit/Events log** is a **separate, raw compliance view** (full `AuditEvent` `before/after`) gated by the §2.2 "View audit/events" row (`tenant_admin` = all, `sales`/`support` = own, **`viewer` = none**) — so the matrix is not violated; (d) four states (UC-1). *Inherits: UC-1, UC-5, TC.*
  **Notes:** `[NOTE FOR PM]` This story formalizes a distinction the matrix alone left ambiguous: the **Activity timeline** (a curated domain-event view, visible with record-view permission) ≠ the **Audit/Events log** (raw audit records, matrix-gated). Logged as a deviation/clarification in `.decision-log.md`. The Glossary entries for *Audit trail* and *Lineage*, and the **Activity timeline** addition, reflect this.

---

### Epic 5 — Dashboard Shell, Read-Model Widget & Notifications (S5) *(pilot)*

**Goal.** A dashboard shell, **one** read-model widget fed from the event log, and in-app notifications driven off domain events. Realizes UJ-5. Proves the event-log → read-model seam and Notifications. **Inherits Epic 0.**

#### Feature 5.1 — Dashboard Shell

- **E5-S1 — Role-scoped dashboard shell.**
  *As a user, I land on a dashboard scoped to my role and tenant.*
  **ACs:** (a) `Dashboard` template, role-scoped; (b) four states (UC-1); (c) scoped to tenant/subsidiary (UC-5). *Inherits: UC-1, UC-5, TC.*

#### Feature 5.2 — Read-Model Widget

- **E5-S2 — One read-model widget (conversion funnel or per-subsidiary roll-up).**
  *As a tenant admin, I see one aggregate widget computed from the event log.*
  **ACs:** (a) exactly one widget — conversion funnel **or** per-subsidiary roll-up; (b) computed from the **event log → read model** (CQRS-lite seam, ADR-008), never a cross-boundary write; (c) roll-up respects scope: admin sees cross-subsidiary, subsidiary user sees own only (UJ-5 edge case); (d) four states (UC-1); (e) remaining widgets are explicitly later stories (non-goal for pilot). *Inherits: UC-1, UC-5, TC.*

#### Feature 5.3 — In-App Notifications

- **E5-S3 — In-app notifications from domain events.**
  *As a support agent, I'm notified in-app when a ticket is assigned to me (or a lead I own converts).*
  **ACs:** (a) notifications driven off `DomainEvent`s (e.g. `Ticket.Assigned`, `Lead.Converted`) — not bespoke writes (UJ-5); (b) scoped to the recipient's tenant/subsidiary (UC-5); (c) consumes the shared Notifications capability (NFR-1); (d) four states for the notifications surface (UC-1). *Inherits: UC-1, UC-5, TC.*

---

### Epic 6 — Server-Side Trust Boundary *(PRODUCTION — NOT in the 2-week pilot)*

**Goal.** Re-implement scoping, validation, and authorization **server-side** with Postgres RLS, swap `LocalStorageRepository` → `HttpRepository` at the composition root with **zero feature-code change**, and prove isolation with a cross-tenant E2E gate. **This is a dedicated build, not a swap (ADR-005).** It is explicitly out of the pilot cut.

> **Why its own epic.** In the pilot, scoping/validation/authorization run **client-side in the localStorage adapter** — acceptable *only* because auth is mocked. Production must re-implement them server-side; that is net-new engineering, not an adapter swap (brief §6 "single most important caveat").

#### Feature 6.1 — Server-Side Enforcement + RLS

- **E6-S1 — Server-side scoping/validation/authorization with Postgres RLS.**
  *As the platform, the trust boundary lives on the server, not the client.*
  **ACs:** (a) tenant/subsidiary scoping, validation, and authorization enforced server-side; (b) Postgres **RLS** with `tenant_id` leading every primary access index (ADR-001/002/003); (c) cross-tenant reads → `404` (ADR-005); (d) residency at **tenant-grain** (§5, F-2), Silo routing retained for a flagged tenant (ADR-010). *Inherits: UC-2, UC-3, UC-5, TC.*

#### Feature 6.2 — Repository Swap (0-change proof)

- **E6-S2 — Swap to `HttpRepository` at the composition root.**
  *As the team, I prove the repository swap requires zero feature-code change.*
  **ACs:** (a) `HttpRepository` implements `Repository<T>` against the REST contract (NFR-5); (b) injected at the composition root (Strangler-Fig, ADR-004); (c) **0 changes to feature code** — the diff touches only the composition root + adapter (success metric SM-M5); (d) feature tests pass unchanged. *Inherits: TC.*

#### Feature 6.3 — Cross-Tenant Isolation Gate

- **E6-S3 — Cross-tenant isolation E2E (the acceptance gate).**
  *As the platform, isolation is proven before production ships.*
  **ACs:** (a) Playwright E2E asserts **0 cross-tenant leaks** across all entities (SM-P3); (b) this E2E is the **gate** for Epic 6 sign-off (ADR-005); (c) attempts to read another tenant's record return `404`. *Inherits: UC-5, TC.*

#### Feature 6.4 — Production Eventing & Auth

- **E6-S4 — Transactional outbox, CQRS-lite read models, OIDC.**
  *As the platform, eventing and auth graduate to production shapes behind the same seams.*
  **ACs:** (a) in-process bus → **transactional outbox + CQRS-lite read models**; at-least-once delivery with idempotent consumers (ADR-008); (b) `correlationId` preserved end-to-end; (c) mock SSO → **OIDC Auth Code + PKCE** behind the same `AuthProvider`; IdP→`Role` normalization layer (ADR-009); (d) read-model widgets (Epic 5) re-point to the outbox-fed read models with no UI change. *Inherits: UC-2, TC.*

## 7. Non-Goals (Explicit)

- **Not** an enterprise CRM — no opportunity/account/contact split, no lead-scoring engine, no SLA timer engine, no marketing automation.
- **Not** building the out-of-scope engines: subscription/billing, multi-cloud provisioning, embedded AI agent — **seams (port interfaces) only**, no engine (ADR-012).
- **Not** integrating external connectors (Odoo, Unifonic, Cloud) — **Noop ports, flags OFF** in the pilot (ADR-011/012).
- **Not** a throwaway prototype — the pilot frontend *is* the production frontend; only the persistence adapter is swapped later (NFR-4).
- **Not** owning `Customer` — it is a **shared** capability the CRM consumes (NFR-1).
- **Not** shipping the server-side trust boundary in the 2-week cut — it is Epic 6, production-only (ADR-005).
- **Not** using Redux (ADR-006); **not** event sourcing (ADR-008); **not** hardcoding any status string, color, or layout (NFR-3/NFR-10).

## 8. MVP Scope

### 8.1 In Scope (the 2-week pilot cut — Epics 0–5)

- The full vertical thread: **tenant → onboard subsidiary → capture lead → qualify → convert (saga) → customer onboarded to `active` → ticket opened and worked** — every step role-gated, tenant-tagged, audited, event-emitting, and on an activity timeline.
- Epic 0 shared kernels (domain/status, repository seam, auth/RBAC, events/audit/logging, UI inventory, flags/Noop ports, testing harness, codified DoD).
- Two-level tenancy + subsidiary onboard/offboard + switcher + parent roll-up (Epic 1).
- Leads capture/list/filter/qualify + timeline (Epic 2).
- Conversion saga + customer onboarding `prospect → active` (Epic 3).
- Ticketing lifecycle gated on customer state + assignment + activity timeline (Epic 4).
- Dashboard shell + one read-model widget + in-app notifications (Epic 5).
- Persistence: **localStorage adapter** mirroring the REST contract; fault-injection toggle.

### 8.2 Out of Scope for MVP

- **Server-side trust boundary, Postgres/RLS, OIDC, transactional outbox, CQRS-lite read models** — Epic 6, production (ADR-005). `[NOTE FOR PM]` Highest-stakes deferred item; must be ratified and scheduled before any production exposure.
- The production backend and any external connector (Odoo/Unifonic/Cloud) — Noop ports OFF.
- SLA timer engine; severity field; group/queue ticket routing; lead-scoring engine; BANT as structured fields (manual judgment note only) — all documented vocabulary/extension points.
- Remaining dashboard widgets beyond the one read-model widget — later stories.
- Subscription/billing, multi-cloud, embedded AI agent — seams only.

## 9. Success Metrics — Product AND Method

*Two-sided by design: the product flows must work AND the method must be proven (brief §7). Each SM cross-references what it validates.*

**Primary — Product (the core flows work)**
- **SM-P1** — The full thread runs end-to-end: tenant onboards a subsidiary → lead captured → qualified → converted → customer onboarded to `active` → ticket opened and worked. Target: 100% of the thread demonstrable. Validates Epics 1–4, UJ-1…UJ-4.
- **SM-P2** — 100% of data views pass the four-state DoD gate (loading/empty/error/ready). Validates UC-1 / NFR-9.
- **SM-P3** — **0 cross-tenant leaks** in the isolation test suite. In the **pilot** this is asserted by the cross-tenant isolation E2E built in **E0-S11** against the localStorage adapter (logical isolation; **not** a security boundary — scoping runs client-side, acceptable only because auth is mocked, brief §6 caveat). The **real security boundary** and its definitive 0-leak gate are **E6-S3** (production, server-side + RLS). Validates UC-5 / NFR-6.
- **SM-P4** — Every mutation emits exactly one audit record + one domain event sharing a `correlationId` (assertable in tests). Validates UC-2 / NFR-7.
- **SM-P5** — Illegal status transitions rejected (never silently allowed); conversion legal only from `qualified`. Validates UC-3, UC-4 / NFR-3.

**Secondary — Method (the reason for the pilot)**
- **SM-M1 — Delivery speed:** stories move story → spec → code → test → done within the 2-week window at ~one story per member (headcount-mapped per DEC-3).
- **SM-M2 — Rework rate:** few/zero stories reopened for standards violations (DoD is structural). Target: ~0.
- **SM-M3 — Handoff quality:** any developer picking up any story finds the same patterns (4-beat use case, shared components, repository seam) — no bespoke alternatives.
- **SM-M4 — Traceability:** intact, auditable chain story → spec → code → test → issue (`Closes #`) for every shipped story (TC).
- **SM-M5 — Repository-swap proof:** swapping the repository adapter requires **0** changes to **feature code** — defined as everything under `src/features/*` (excludes the `src/app` composition root and the `src/shared/data` adapters, which are *expected* to change). Fully demonstrated at **E6-S2** (the actual localStorage→HTTP swap, production). **Pilot proxy:** an architecture-fitness test (E0-S11) asserts that no `src/features/*` module imports `localStorage` or a concrete repository — so the 0-change property is enforced structurally from day one, not just claimed at swap time (NFR-4).

**Counter-metrics (do not optimize)**
- **SM-C1** — *Feature count / surface area.* Do **not** grow features to look productive; the product is deliberately small. Counterbalances SM-P1 — breadth would dilute the reference-implementation purpose.
- **SM-C2** — *Raw delivery speed.* Do **not** optimize SM-M1 by skipping conformance (UC-1…UC-5); a fast story that violates the DoD is a failure, not a win. Counterbalances SM-M1.
- **SM-C3** — *Bespoke cleverness.* Do **not** reward novel one-off solutions; sameness (copy-pasteable conformance) is the goal. Counterbalances any incentive to "improve" by deviating from shared patterns.

## 10. Traceability Model (story → spec → code → test → issue)

Every story in §6 is a node in one chain, ready to map onto a GitHub issue:

- **Story** — the stable `E<epic>-S<n>` ID in this PRD.
- **Spec** — the architecture/UX phase expands each story into a spec referencing its story ID.
- **Code** — the implementing PR references the story ID and lives in the NFR-11 folder for its feature.
- **Test** — Vitest/RTL/Playwright tests assert the story's ACs, including the inherited UC-1…UC-5 (NFR-12).
- **Issue** — the PR `Closes #<issue>`; the issue carries the story ID. Preview deploy green; `sprint-status.yaml` updated; passes `bmad-code-review` (Constitution §10 DoD = TC).

This chain *is* SM-M4; it is asserted, not assumed.

## 11. Open Questions

1. **F-6 boilerplate DB mandate** — Postgres is confirmed for production (RLS depends on it), but the architecture phase must confirm **no future iSolution-boilerplate DB mandate** conflicts before Epic 6. If a non-Postgres mandate surfaces, ADR-001's RLS approach is revisited. *(Owner: architecture; revisit: before Epic 6 kickoff.)*
2. **F-2 residency confirmation** — tenant-grain residency is the recommended default; **confirm with the customer** before the production build. Flips to subsidiary-grain only if a contract requires per-subsidiary data placement (would fracture the Pool). *(Owner: architecture + customer; revisit: before Epic 6 kickoff.)*
3. **Read-model widget choice** — E5-S2 ships exactly one of {conversion funnel, per-subsidiary roll-up}. Pick during sprint planning based on which better demonstrates the event-log → read-model seam. *(Owner: PM/sprint planning.)*
4. **Untriaged ticket state** — domain research notes min-crm has no `new` ticket state (tickets enter as `open`). Confirmed acceptable for pilot; revisit only if a triage queue is later needed. *(Owner: PM; non-blocking.)*
5. **Production backend placement** — the backend runs off-Vercel on a region-pinnable cloud (Vercel offers no BYOC); the specific cloud/region is not pinned. Confirm with the customer alongside F-2 residency. *(Owner: architecture + customer; revisit: before Epic 6 kickoff.)* *(Carries F-3.)*

## 12. Assumptions Index

- **§4.2 / §5 (F-6):** `[ASSUMPTION]` No iSolution Platform Boilerplate DB mandate exists — none is recorded in any settled artifact. → Open Question 1.
- **§5 (F-2):** `[ASSUMPTION]` Tenant-grain residency is acceptable to the customer (recommended default, pending confirmation). → Open Question 2.
- **§6 Epic 3 (E3-S1):** `[ASSUMPTION]` The field-map carry-set (name, company, contact details, source, owner, BANT note) is sufficient for the pilot; architecture reviews but does not extend it (brief §5 "field-map contract reviewed, not extended").
- **§6 Epic 0 (E0-S11) / DEC-3:** `[ASSUMPTION]` One notional owner per story; the team maps owners to stories by actual headcount — no fixed N.
- **§9 (SM-M1):** `[ASSUMPTION]` The "~one story per member in 2 weeks" cadence is a target for measuring the method, not a fixed scope commitment.
