---
title: "Product Brief: min-crm"
status: draft
created: 2026-06-06
updated: 2026-06-06
owner: Heba
inputs:
  - _bmad-output/brainstorming/brainstorming-session-2026-06-06.md
  - _bmad-output/planning-artifacts/research/domain-crm-domain-vocabulary-research-2026-06-06.md
  - _bmad-output/planning-artifacts/research/technical-min-crm-technical-architecture-feasibility-research-2026-06-06.md
  - _bmad-output/project-context.md
---

# Product Brief: min-crm

## Executive Summary

**min-crm is a lightweight, multi-tenant CRM — lead management, lead-to-customer conversion, and ticketing — built as "Product A" on the iSolution Platform Boilerplate.** It is deliberately small in features and deliberately exhaustive in conformance: every screen and operation exercises a shared-platform capability the right way, so the codebase reads as a *reference implementation*, not a demo.

The product has two audiences and therefore two deliverables. The **end user** (a sales or support team inside a tenant org) gets a working CRM that runs the full journey: a tenant onboards subsidiaries, sales captures and qualifies leads, a qualified lead converts into a customer, and support works tickets against that customer — all role-gated, tenant-isolated, and recorded on an immutable activity timeline. The **iSolution team** gets the pilot's real payoff: proof that the boilerplate's layering holds and that the spec-driven, AI-accelerated delivery method produces familiar, copy-pasteable, standardized output the next product team can inherit.

This brief synthesizes four settled inputs — the brainstorm, the domain and technical research, and `project-context.md` (the engineering constitution) — into the foundation the PRD expands. Pinned decisions are carried forward, not re-opened; scoping calls are flagged inline and in the decision log.

## 1. Problem & Vision

**The product problem.** Small B2B teams need one place to run the commercial journey — capture leads, qualify them, convert the good ones into customers, and support those customers — without the weight (and price) of an enterprise CRM. Today that work is scattered across spreadsheets, inboxes, and disconnected tools; the lineage from "lead we got in March" to "customer with three open tickets" is lost, and there is no clean tenant/subsidiary boundary for an org that operates as a parent with child units.

**The method problem (the real reason this pilot exists).** iSolution is proving a *way of building*: a shared-platform boilerplate plus a spec-driven, AI-accelerated delivery method (Epic → Feature → Story, governed by a fixed engineering constitution). A method is only proven by shipping something real through it. min-crm is that something — a fixture chosen because the lead → convert → customer → ticket journey naturally exercises **every** shared capability at least once.

**Vision.** A working CRM whose hidden plumbing *is* the demo. The immutable audit/event log, surfaced as a per-record activity timeline, doubles as a headline user feature and the compliance backbone — collapsing the usual "boring infra vs. user value" tradeoff. If the pilot succeeds, the next iSolution product team starts from a proven path: the same shared layer, the same DoD, the same traceable story → spec → code → test chain — and builds faster with less rework because the standards are structural, not aspirational.

## 2. Product Framing — Product A on a Shared Platform

min-crm sits in the **product layer** and consumes shared-platform capabilities through interfaces; it never duplicates or owns them. Dependencies flow one direction only (Product → Shared Platform → External), and external systems are reached solely through flagged ports.

| Layer | What lives here (for the pilot) |
|---|---|
| **Product (min-crm owns)** | `features/leads`, `features/tickets`, the conversion saga, CRM shell + dashboards |
| **Shared Platform (boilerplate, consumed)** | Customer, Sales Journey, Tasks/Workflow, Notifications, Identity & Access, Tenant & Subsidiary, Config & Flags, Audit, Event Bus, Data layer |
| **External Systems (ports only, OFF)** | Odoo, Unifonic, Cloud — behind port interfaces + feature flags, all hard-off in the pilot |

Key framing rules carried from the constitution: **`Customer` is a shared capability** the CRM consumes, not defines. Every external integration is a Ports & Adapters seam with a Noop adapter in the pilot — *we design the seam, not the engine*. No call site references a vendor SDK directly.

## 3. Users & Roles

Four roles, confirmed by domain research as a clean mapping onto industry CRM archetypes (Manager is folded into `tenant_admin`). Every row is implicitly tenant/subsidiary-scoped; out-of-tenant access returns `404` (never leaks existence); deny-wins.

| Role | Who they are | Core capability |
|---|---|---|
| **tenant_admin** | Org administrator | Manage tenant/subsidiaries, users, config; onboard/offboard subsidiaries; cross-subsidiary roll-up; full data access |
| **sales** | Salesperson | Create/edit leads, **convert** leads to customers, edit customers; read tickets |
| **support** | Support agent | Create/edit/assign tickets on customers; read customers; (no lead access by default) |
| **viewer** | Read-only stakeholder | View leads, customers, tickets within scope; no create/edit/delete |

Two minor decision points the domain research surfaced are resolved conservatively for the pilot (least-privilege): **support is lead-blind** and **sales is read-only on tickets**. Both are easy to relax later and are recorded in the decision log (flags E/F). The full reconciled permission matrix lives in the addendum for the PRD to lift verbatim.

## 4. MVP Scope

**The smallest slice that still demonstrates the full layering** is the single end-to-end thread: **tenant → (onboard subsidiary) → capture lead → qualify → convert → customer → ticket**, with every step role-gated, tenant-tagged, audited, event-emitting, and surfaced on an activity timeline.

**IN (built):**
- **Leads** — capture (source + single owner), list/filter, qualification gate (`new → contacted → qualified | disqualified`, revive allowed). `qualified` is a manual judgment call; BANT is documented vocabulary, not a scoring engine.
- **Lead → Customer conversion** — built as the **full reference saga** (persisted, resumable, compensating, UI-inspectable). Legal only from `qualified`; `converted` lead becomes terminal/read-only; bidirectional lineage.
- **Customer lifecycle** — **`prospect → onboarding → active → inactive → churned`**. Conversion lands the customer in `prospect`; an onboarding workflow walks it to `active`, proving Tasks/Workflow a second time.
- **Ticketing** — create ticket tied to a customer (gated on customer `active`/`onboarding`), lifecycle state machine `open / in_progress / pending / resolved / closed`, single assignee, priority `low / medium / high / urgent`. Severity and SLA timers are vocabulary only.
- **Two-level tenancy** — `tenant → subsidiary`; subsidiary onboard/offboard (soft-delete + record reassignment); tenant/subsidiary switcher; parent roll-up read model.
- **RBAC** — the four roles, two-gate enforcement (route guard + action guard) from auth context.
- **Audit + events** — every mutation emits exactly one audit record + one domain event sharing a `correlationId`; rendered as a per-record **activity timeline** (audit-as-feature).
- **In-app notifications** — driven off domain events (e.g. ticket assigned, lead converted).

**OUT (seams only — interface + flag, no engine):** subscription/billing, multi-cloud provisioning, embedded AI agent. Plus the external connectors (Odoo, Unifonic, Cloud) behind Noop ports.

## 5. The 2-Week Pilot Cut

Structured as a coherent vertical slice — the stories *as they should be*, one clear owner each; the team maps owners to stories by actual headcount. **Epic 0 (Platform Guidelines & Standards) is the governing contract every other story inherits**, so its conformance items (entity standard, the 4-beat use-case `authorize → mutate → emit → audit`, tenancy, RBAC, audit/event/timeline, repository seam, UI inventory, universal DoD) are not a separate workstream — they are the definition of done baked into each story below.

| # | Story (ships) | Demonstrates | Stubbed / seam |
|---|---|---|---|
| **S1** | Tenant context + isolation + subsidiary onboard, with tenant/subsidiary switcher | Tenancy, `TenantContext` threaded top-to-bottom, RBAC gates | Offboard reassignment rule documented; residency seam |
| **S2** | Lead capture → list/filter → qualify (state machine + guards) | Sales Journey, status transitions, 4-beat, four UI states | Lead scoring (vocabulary only) |
| **S3** | Lead → Customer **conversion saga** + customer onboarding `prospect → active` | The reference saga, Tasks/Workflow, lineage, audit-as-feature | Field-map contract reviewed, not extended |
| **S4** | Ticket create→lifecycle→assign, gated on customer state, with activity timeline | Ticketing on shared Tasks, status-gating business rule, audit timeline | SLA timers (vocabulary); group/queue routing |
| **S5** | Dashboard shell + one read-model widget (conversion funnel or per-subsidiary roll-up) + in-app notifications | Event-log → read-model seam, Notifications | Remaining dashboard widgets are later stories |

**What is explicitly NOT in the 2-week cut:** the server-side trust boundary (a separate epic — see §6), the production backend, OIDC, the transactional outbox, and any external connector. The pilot is the production frontend with a localStorage adapter set — not a throwaway.

## 6. Adopted Technical Direction

Carried forward from the technical-architecture research so the architecture phase inherits decisions rather than re-debating them. Full ADR list (ADR-001–013) and the per-topic matrix are in the addendum.

- **Isolation (production target):** **Pool — shared PostgreSQL + Row-Level Security**, with the repository able to route a flagged tenant to a dedicated **Silo** DB later (hybrid / dynamic multi-tenancy). `tenant_id` is the isolation boundary; `subsidiary_id` is an in-tenant scoping dimension. **Mandatory rule:** `tenant_id` leads every primary access index. The pilot's localStorage key scheme `crm:{tenantId}:{subsidiaryId|_parent}:{entity}` is already Pool-in-miniature.
- **Pilot → production seam:** one `Repository<T>` interface; `LocalStorageRepository` now, `HttpRepository` later, injected at the composition root — a **Strangler-Fig, interface-by-interface swap**, not a rewrite. The REST contract (§5 of the constitution) is the seam target.
- **⚠️ The single most important caveat:** scoping/validation/authorization run **client-side in the pilot adapter** (acceptable only because auth is mocked). Production must **re-implement them server-side + RLS** — this is a **dedicated build, planned as its own epic**, not a swap. A cross-tenant isolation E2E test is its acceptance gate.
- **Client stack:** TypeScript 5 (strict) · React + Vite · **TanStack Query v5** (server state + optimistic update/rollback) · React Router v7 (SPA mode) · React Hook Form v7 + **Zod v4** (one schema → type + runtime validation) · React Context for auth/tenant/flags (Zustand only if needed). **Not** Redux.
- **Optimistic mutations:** snapshot-and-rollback on every mutation, plus a **fault-injection toggle** in the localStorage adapter so the error/rollback paths are testable before a backend exists.
- **Events:** in-process bus + append-only audit log in the pilot → **transactional outbox + CQRS-lite read models** in production; `correlationId` threaded through audit, events, and logs.
- **Auth:** one `AuthProvider`; mock SSO now → **OIDC Authorization Code + PKCE** later; production adds an IdP→`Role` normalization layer.
- **Flags/config:** **OpenFeature-shaped** provider (static pilot → Unleash); most-specific-wins inheritance (`subsidiary → tenant → default`); external-system flags hard-off behind Noop ports.
- **Deployment:** SPA on **Vercel** (CDN, preview deploys per PR); production backend off-Vercel on a region-pinnable cloud (Vercel offers no BYOC).
- **Testing (closes a DoD gap):** **Vitest + React Testing Library + Playwright** — transition maps, schemas, four UI states, optimistic rollback, and a cross-tenant isolation E2E.

## 7. Success Metrics — Product AND Method

This is a pilot to measure a method, so success is two-sided.

**Product (the core flows actually work):**
- The full thread runs end-to-end: tenant onboards a subsidiary → lead captured → qualified → converted → customer onboarded to `active` → ticket opened and worked.
- 100% of data views pass the four-state DoD gate (loading / empty / error / ready).
- 0 cross-tenant leaks in the isolation test suite.
- Every mutation emits exactly one audit record + one domain event sharing a `correlationId` (assertable in tests).
- Illegal status transitions are rejected (never silently allowed); conversion is legal only from `qualified`.

**Method (the reason for the pilot):**
- **Delivery speed** — stories move story → spec → code → test → done within the 2-week window at ~one story per member.
- **Rework rate** — few stories reopened for standards violations; because the DoD is structural, this targets zero.
- **Handoff quality** — a developer picking up any story finds the same patterns (4-beat use-case, shared components, repository seam) — no bespoke alternatives.
- **Traceability** — an intact, auditable chain from story → spec → code → test → issue (`Closes #<issue>`) for every shipped story.
- **Repository-swap proof** — swapping a repository adapter requires **0** changes to feature code.

## 8. Constraints

- **Fixed stack:** TypeScript / React / **localStorage** (pilot persistence) / **Vercel** deploy. Non-negotiable.
- **Claude Design tokens are the UI source of truth** — no hardcoded hex/px/font values; status colors come only from the `STATUS_TONE` map via tone tokens.
- **Work structure:** Epic → Feature → Story, with **Epic 0** as the governing standards track every story conforms to.
- **The constitution (`project-context.md`) is fixed** — its layering, entity standard, contracts, dual event streams, RBAC model, UI inventory, and universal DoD bind all work. Deviations require an explicit decision-log entry.
- **One deliberate deviation logged this session:** `CustomerStatus` expands from the constitution's 3-state set to the 5-state lifecycle (DEC-1).

## Open Questions / Flags for the PRD & Architecture

1. **`CUSTOMER_TRANSITIONS` is undefined** (🔴 highest priority). The 5-state lifecycle is adopted (DEC-1) but the transition map does not yet exist in `shared/domain/status.ts`, and constitution §3.1 still lists 3 states. Define both before building S3/S4.
2. **Server-side trust boundary = its own epic**, not a swap (technical research F-1). Must be ratified and scheduled for production.
3. **Data residency grain** — confirm residency is at **tenant** grain (Pool survives) vs **subsidiary** grain (breaks the two-level Pool) with the customer (F-2).
4. **`closed` reopen** — constitution allows `closed → open`; industry treats `closed` as terminal. Recommend making `closed` terminal (reopen only `resolved → open`); confirm in the PRD (domain flag C).
5. **Production DB** — Postgres is recommended as the isolation primitive (RLS depends on it); confirm no future iSolution-boilerplate DB mandate conflicts (F-6).
