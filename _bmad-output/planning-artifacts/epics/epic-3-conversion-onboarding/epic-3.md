---
id: E3
title: Conversion Saga & Customer Onboarding
cut: pilot
realizes: [UJ-3, UJ-4 (setup)]
features:
  - "3.1 — Lead → Customer Conversion Saga"
  - "3.2 — Customer Onboarding Workflow"
  - "3.3 — Customer List & Detail"
stories: [E3-S1, E3-S2, E3-S3]
depends_on: [E0-S1, E0-S2, E2-S2]
---

# Epic E3 — Conversion Saga & Customer Onboarding

**Cut:** Pilot (production frontend on localStorage adapter).
**Goal.** Turn a `qualified` lead into a living customer record and walk it to `active`. This epic delivers the codebase's **reference saga** (DEC-2): a persisted, resumable, compensating `WorkflowInstance` for lead→customer conversion — proving the Tasks/Workflow seam — plus the **customer onboarding workflow** (DEC-1) that reuses the same seam a second time. Conversion lineage is established (Customer back-traces to its originating lead), and conversion is treated as **audit-as-feature**: multiple 4-beat mutations under one shared `correlationId`, surfacing a linked conversion event on both timelines (the UJ-3 climax).
**Realizes:** UJ-3 (lead→customer conversion) and the setup half of UJ-4 (onboarding to `active`). · **Inherits:** Epic 0 (UC-1…UC-5, TC).

> ## ⚠️ HARD PREREQUISITE — Epic 0 kernels MUST land first
> **E0-S1 (`CUSTOMER_TRANSITIONS` + status map kernel) and E0-S2 (`WorkflowInstance` type + `WorkflowRunner` engine) MUST be merged before any Epic 3 work begins.** Epic 3 is the *first consumer* of the workflow engine: the conversion saga (E3-S1) and onboarding (E3-S2) are both `WorkflowInstance`s — they cannot be built against a non-existent engine, and the saga is explicitly **NOT** an inline function (DEC-2). E3-S2 is gated illegal-move-422 by `CUSTOMER_TRANSITIONS` (E0-S1). **Do not start Epic 3 until both kernels are green.**

## Features & stories

### Feature 3.1 — Lead → Customer Conversion Saga
Convert a `qualified` lead into a `prospect` customer through a persisted, resumable, compensating saga (DEC-2). The reference saga: 5 enumerated steps, each idempotent, each with a named compensation; UI-inspectable on a `DetailPage` variant.
- **E3-S1** — Convert a qualified lead via the reference saga → [E3-S1.md](E3-S1.md)

### Feature 3.2 — Customer Onboarding Workflow
Walk a customer `prospect → onboarding → active` (with `active ↔ inactive` reactivation and `→ churned` terminal) via a `customer_onboarding` `WorkflowInstance` — proving the Tasks/Workflow seam a second time.
- **E3-S2** — Walk a customer prospect → onboarding → active → [E3-S2.md](E3-S2.md)

### Feature 3.3 — Customer List & Detail
Customer `ListPage` + `DetailPage` with conversion lineage (link back to the originating lead), the activity timeline (ADR-016), and a related Tickets tab feeding Epic 4.
- **E3-S3** — Customer list/detail with lineage + timeline → [E3-S3.md](E3-S3.md)

## Dependencies & sequencing
- **Hard prerequisites (must land first):** **E0-S1** (`CUSTOMER_TRANSITIONS`, status map, `canTransition`) and **E0-S2** (`WorkflowInstance` + `shared/workflow/WorkflowRunner.ts`). See the prominent note above.
- **Upstream:** **E2-S2** (lead qualification → a lead can reach `qualified`) supplies the only legal conversion input (UC-4). Customer entity types/Zod schemas (E0 `customer.types.ts`/`schemas.ts`).
- **Build order within epic:** **E3-S1** (saga) establishes the customer record + lineage + onboarding workflow seam usage → **E3-S2** (onboarding workflow, reuses the seam) → **E3-S3** (list/detail surfaces the customer + lineage + timeline). S3 can begin in parallel once a customer record shape exists, but its lineage view depends on S1.
- **Downstream / unblocks:** **Epic 4** (Tickets — the related Tickets tab in E3-S3 feeds it; customer-state gate `active`/`onboarding`). **UJ-4** runtime relies on `active` customers produced here.
- **Field-map contract:** `{ name, company, contactDetails(email/phone), source, ownerId, bantNote }` is **reviewed-not-extended** (PRD §12 assumption locked); activity history is **linked, not duplicated** (lineage pointers, not a copy).

## References
- PRD §6 Epic 3 (Features 3.1–3.3); §12 field-map assumption.
- Architecture: Pattern 2 (Conversion saga step table, DEC-2), Pattern 3 (Onboarding workflow, DEC-1), Pattern 4 (status transitions); ADR-004 (Repository seam + 4-beat), ADR-007 (optimistic + fault-injection), ADR-008 (dual streams + correlationId), ADR-016 (timeline split), ADR-003/DEC-1 (`CUSTOMER_TRANSITIONS`).
- Constitution: project-context.md §2 (entities), §3 (statuses), §4 (CRUD), §7 (events), §8 (UI).
