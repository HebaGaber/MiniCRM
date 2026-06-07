---
id: E2
title: Leads — Capture → Qualify
cut: pilot
realizes: [UJ-2]
features:
  - "2.1 — Lead Capture"
  - "2.2 — Lead List & Filter"
  - "2.3 — Qualification State Machine"
stories: [E2-S1, E2-S2, E2-S3, E2-S4]
depends_on: [E0, E1]
---

# Epic E2 — Leads: Capture → Qualify

**Cut:** Pilot (Slice S1).
**Goal.** Capture a lead with a source and a single owner; list and filter leads by status/owner; walk a lead through its qualification lifecycle (`new → contacted → qualified | disqualified`, with `disqualified → contacted` revive) under the `LEAD_TRANSITIONS` guard; and surface the lead's full history on a detail page with an audit-as-feature activity timeline. Realizes UJ-2.
**Realizes:** UJ-2 · **Inherits:** Epic 0 (UC-1…UC-5, TC).

This epic is the **first end-to-end proof of the Sales Journey**: it is where the
`LEAD_TRANSITIONS` map (E0-S1), the `Repository<T>` 4-beat (E0-S4), the action guard
(E0-S6), and the dual-event bus (E0-S7) first combine on a real product entity. It proves
status transitions (legal moves allowed, illegal `new → qualified` rejected with `422` and
pill unchanged), the **4-beat** (authorize → mutate → emit → audit) on every write, and the
**four UI states** across capture (`EntityForm`), list (`ListPage`), and detail (`DetailPage`)
surfaces. The activity timeline applies **ADR-016**: it reads the `DomainEvent` stream
(record-view-gated, `viewer` included) and is DISTINCT from the matrix-gated Audit/Events log
of E4-S4.

## Features & stories

### Feature 2.1 — Lead Capture
Capture a lead with a source and exactly one owner; create it in `new`, Zod-validated, emitting `Lead.Created` + audit.
- **E2-S1** — Capture a lead → [E2-S1.md](E2-S1.md)

### Feature 2.2 — Lead List & Filter
Find leads by status and owner with free-text search, sort, and pagination — tenant/subsidiary scoped.
- **E2-S2** — List and filter leads → [E2-S2.md](E2-S2.md)

### Feature 2.3 — Qualification State Machine
Move a lead through its lifecycle under the transition guard, and see/act on its full history.
- **E2-S3** — Walk a lead through its lifecycle → [E2-S3.md](E2-S3.md)
- **E2-S4** — Lead detail + activity timeline → [E2-S4.md](E2-S4.md)

## Dependencies & sequencing
- **Depends on Epic 0** kernels: `LEAD_TRANSITIONS` + `canTransition` (E0-S1 / ADR-003-status / NFR-3), `Repository<T>` seam + 4-beat (E0-S4 / ADR-004), the action guard / `can()` predicate (E0-S6 / ADR-015), dual events + audit + correlationId (E0-S7 / ADR-008), and the four-state UI inventory `ListPage`/`DetailPage`/`EntityForm`/`StatusPill`/`DataTable`/`QueryStateBoundary` (E0-S8/S9 / UC-1, NFR-10). Reuses the shared **ActivityTimeline** pattern (ADR-016) consumed here in `features/leads` and again in `features/tickets` (E4-S4).
- **Depends on Epic 1** for tenant/subsidiary scope (E1-S1, UC-5): all lead CRUD and lists are scoped via the repository scope seam.
- **Build order:** E2-S1 (capture — establishes the Lead entity + create path) → E2-S2 (list/filter — needs leads to list) → E2-S3 (transition state machine — needs leads to move) → E2-S4 (detail + timeline — composes the create/edit/transition mutations and renders the event stream).
- **Unblocks:** Epic 3 conversion (a `qualified` lead is the only legal entry to the conversion saga, UC-4) and feeds the dashboard/notifications in Epic 5.

## Location map (architecture)
- `src/features/leads/*` — `LeadForm.tsx` (EntityForm), `LeadsListPage.tsx`, `LeadDetailPage.tsx`, `ActivityTimeline.tsx`, `lead.service.ts`, hooks.
- Key shared deps: `shared/domain/status.ts` (`LEAD_TRANSITIONS`, `STATUS_TONE`), `shared/domain/lead.types.ts` + `schemas.ts` (Zod), `shared/data/*` (repository + 4-beat), `shared/auth/permissions.ts` (guard), `shared/events/*` (bus + audit), `shared/ui/*` (templates + components).

## References
- PRD §6 Epic 2; UJ-2; NFR-3 (status maps), NFR-4 (4-beat), NFR-5 (REST + `POST /{id}/transition`), NFR-7 (dual events), NFR-9/10 (four states + tokens).
- ADRs: ADR-003 (status source + transition maps), ADR-004 (repository seam + 4-beat), ADR-008 (dual events + correlationId), ADR-015 (permission predicates), ADR-016 (activity-timeline vs audit-log split).
- Constitution: project-context.md §2 (entities), §3 (statuses), §4 (CRUD), §5 (API parity), §6 (auth), §7 (events), §8 (UI).
