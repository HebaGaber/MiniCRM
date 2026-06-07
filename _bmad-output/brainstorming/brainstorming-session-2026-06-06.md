---
stepsCompleted: [1, 2]
inputDocuments: []
session_topic: 'Multi-tenant mini CRM (leads → customer → ticketing) as a product on a shared-platform boilerplate — architecture model, product differentiation/positioning, and lifecycle/workflow design'
session_goals: 'A sharper product concept, an architecture approach, and a defensible MVP scope'
selected_approach: 'user-selected (AI-recommended arc, confirmed)'
techniques_used: ['First Principles Thinking', 'Cross-Pollination', 'Role Playing / Persona Journey', 'Resource Constraints']
ideas_generated: []
context_file: ''
---

# Brainstorming Session Results

**Facilitator:** Heba
**Date:** 2026-06-06

## Session Overview

**Topic:** Multi-tenant mini CRM (leads → customer → ticketing), built as a product on a shared-platform boilerplate. Stack: TS/React/localStorage, deployed on Vercel.

**Goals:** Sharper product concept · Architecture approach · Defensible MVP scope

### Three Threads
1. **Architecture model** — multi-tenancy on a shared-platform boilerplate; tenant isolation under a localStorage constraint; what "shared platform" means for a product.
2. **Differentiation & positioning** — what makes this a product people choose, not just an internal tool.
3. **Lifecycle & workflow** — designing the lead → customer → ticket journey as a coherent experience.

### Session Setup
Hybrid approach: browse the full technique library with AI-curated recommendations highlighted.

## Technique Selection

**Approach:** User-Selected (confirmed the AI-recommended progressive arc)

**Selected Techniques (in sequence):**
1. **First Principles Thinking** — strip "CRM" to fundamentals; attack concept + positioning.
2. **Cross-Pollination** — borrow multi-tenant/product patterns from other domains to find differentiation.
3. **Role Playing / Persona Journey** — walk the lead→customer→ticket lifecycle as tenant-admin and end-customer.
4. **Resource Constraints** — force ruthless MVP scope under real constraints (localStorage, boilerplate, solo build).

**Selection Rationale:** A funnel from concept → differentiation → workflow → buildable scope, mapping directly onto the three session outcomes.

## Ideas Generated

### Technique 1 — First Principles Thinking

**[Concept #1]: Vehicle, Not Destination**
*Concept:* The true deliverable is the boilerplate-proof + method-proof. The CRM is a test fixture that exercises every shared capability (tenant → lead → convert → customer → ticket) at least once, so the next team inherits a proven path.
*Novelty:* Features are valuable in proportion to how much architecture they demonstrate, not user value alone. Two customers exist: the end-user (wants invisible plumbing) and the iSolution team (wants visible, copy-pasteable plumbing).

**[Concept #2]: The Universal 4-Beat Use-Case**
*Concept:* Every application-layer operation follows `authorize → mutate(repo) → emit(event) → audit`, no exceptions. Cross-cutting concerns are guaranteed by the shape of the use-case, not developer diligence.
*Novelty:* Isolation, observability, and compliance become structurally impossible to forget — step 4 of a template the AI fills in. Makes the method teachable.

**[Concept #3]: Audit-as-Feature (Plumbing IS the Delight)**
*Concept:* The immutable event/audit log, rendered per-record as an activity timeline, serves compliance and the most-loved user feature simultaneously.
*Novelty:* Collapses the "boring infra vs. user value" tradeoff into one artifact; the hidden seam becomes the demo centerpiece.

**[Concept #4]: Conversion = The Reference Saga**
*Concept:* Lead→Customer conversion is a persisted, resumable, compensating workflow instance (not an inline function), with UI-inspectable state. Decision: option (b) saga/compensating chosen over optimistic/idempotent.
*Novelty:* The riskiest operation becomes the teaching centerpiece for "how we do anything multi-step." Graduates the Workflow seam from stub to built.

**[Concept #5]: Guidelines-as-Epic (The Standards Track)**
*Concept:* One epic (Epic 0) is dedicated to cross-track guidelines/standards — a governing contract every other story must conform to, tracked/demoed/gated like any deliverable.
*Novelty:* Standards become auditable, not wiki-rot. The educational goal is enforced structurally.

**[Concept #6]: "Top-Notch on Minimum" = a Universal Definition of Done**
*Concept:* A single DoD checklist (from Epic 0) every story inherits: entity standard, 4-beat, tenant-tagged, audited, event-emitted, RBAC-gated, Claude Design tokens, activity-timeline surface. Minimum features, maximum conformance.
*Novelty:* Decouples "done" from "lots of features" — output reads as a reference implementation, not a demo.

**[Concept #7]: Customer Lifecycle State Machine — `prospect → onboarding → active`**
*Concept:* Conversion saga lands a Customer in `prospect`; an onboarding workflow walks it `onboarding → active`. Tickets gated by lifecycle state (business rule proving status-gating).
*Novelty:* Onboarding becomes a real state + workflow (proving Tasks/Workflow a second time), not a flag.

**[Concept #8]: Dashboards as Event-Log Read Models (composed shell, epic-owned widgets)**
*Concept:* Three dashboards — conversion funnel, tickets-by-status, per-subsidiary roll-up — each a read model over the domain event log. One Dashboard shell composes three widgets; each widget is a story owned by its home epic (funnel→Epic 2, tickets→Epic 3, roll-up→Epic 1).
*Novelty:* Proves the event-log→read-model seam once per widget while keeping "one seam, one slice" intact and avoiding a dumping-ground analytics epic.

### Reference Architecture — "One Seam, One Slice"
Every seam earns its place by carrying exactly one thin slice of real user value. UI (Claude Design tokens) → Application (4-beat use-cases) → Domain (entities + state machines) → Cross-cutting (TenantContext, RBAC, Audit, EventBus, FeatureFlags, Logger — all tenant-tagged) → Repository seam (LocalStorageRepo now → HttpRepo later, keys partitioned `t:{tid}:s:{sid}:...`) → Persistence (localStorage). TenantContext threads top-to-bottom on every call.

### Proposed Epic → Feature → Story Structure
- **Epic 0 — Platform Guidelines & Standards Track** (F0.1 Entity/Status, F0.2 4-Beat, F0.3 Saga, F0.4 Tenancy, F0.5 RBAC, F0.6 Audit/Event/Timeline, F0.7 Repository seam, F0.8 UI, F0.9 Flags/Config inheritance, F0.10 Universal DoD)
- **Epic 1 — Tenancy & Customer Management** (F1.1 Tenant context/isolation, F1.2 Customer CRUD, F1.3 Subsidiary onboard/offboard, F1.4 Roll-up + tenant switcher, F1.5 RBAC/roles)
- **Epic 2 — Lead Flow to Customer Onboarding** (F2.1 Lead capture, F2.2 List/filter/pipeline, F2.3 Conversion saga, F2.4 Customer onboarding `prospect→onboarding→active`)
- **Epic 3 — Ticketing** (T3.1 Create ticket tied to customer, T3.2 Lifecycle state machine, T3.3 Assignment + RBAC, T3.4 Activity timeline / audit-as-feature)
- **Dashboards** (distributed widgets): conversion funnel (Epic 2), tickets-by-status (Epic 3), per-subsidiary roll-up (Epic 1), composed in one Dashboard shell.

