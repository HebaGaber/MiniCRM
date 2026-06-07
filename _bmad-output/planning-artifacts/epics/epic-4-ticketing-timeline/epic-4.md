---
id: E4
title: Ticketing & Activity Timeline
cut: pilot
realizes: [UJ-4]
features:
  - "4.1 — Ticket Creation (customer-state gated)"
  - "4.2 — Ticket Lifecycle & Assignment"
  - "4.3 — Activity Timeline (audit-as-feature)"
stories: [E4-S1, E4-S2, E4-S3, E4-S4]
depends_on: [E0, E3]
---

# Epic E4 — Ticketing & Activity Timeline

**Cut:** Pilot.
**Goal.** Ticket creation **gated on customer state**, the ticket lifecycle state machine, single-assignee assignment, and the per-record activity timeline. Realizes UJ-4. Proves ticketing on shared Tasks, status-gating as a business rule, and audit-as-feature.
**Realizes:** UJ-4 · **Inherits:** Epic 0 (UC-1…UC-5, TC).

This epic is where two governing patterns bite: **status-gating as a business rule** (a ticket may only be opened against an `active`/`onboarding` customer — an action-guard precondition, `422` when violated) and **audit-as-feature formalized as the ADR-016 split** — the per-record `ActivityTimeline.tsx` (DomainEvent stream, record-view gated, `viewer` included within scope) versus the raw `AuditLogPanel.tsx` (AuditEvent `before/after`, §2.2 matrix-`own` gated via E0-S6). E4-S4 makes DEC-4 concrete. E4-S3 **consumes the E0-S12 Notifications kernel** (architecture delta): `NotificationService` maps `Ticket.Assigned → assigneeId` — tickets never write notifications directly.

## Features & stories

### Feature 4.1 — Ticket Creation (customer-state gated)
Open a ticket against an eligible customer — only when the customer is ready (`active` or `onboarding`).
- **E4-S1** — Create a ticket against an eligible customer → [E4-S1.md](E4-S1.md)

### Feature 4.2 — Ticket Lifecycle & Assignment
Walk a ticket through its lifecycle state machine and assign it to a single support user.
- **E4-S2** — Walk a ticket through its lifecycle → [E4-S2.md](E4-S2.md)
- **E4-S3** — Assign a ticket to a single assignee (consumes E0-S12 notifications) → [E4-S3.md](E4-S3.md)

### Feature 4.3 — Activity Timeline (audit-as-feature)
A unified per-record activity timeline (DomainEvent stream) plus the separate, matrix-gated raw Audit/Events log.
- **E4-S4** — Unified per-record activity timeline → [E4-S4.md](E4-S4.md)

## Dependencies & sequencing
- **Depends on Epic 0** kernels: `Repository<T>` seam + 4-beat (E0-S4 / ADR-004), auth claims + two gates (E0-S5 / ADR-009), permission predicates incl. the ADR-015 `own` predicate (E0-S6), dual events + audit + correlationId (E0-S7 / ADR-008), four-state UI + `EntityForm`/`ConfirmDialog`/`DetailPage` (E0-S8/S9 / UC-1), the status maps incl. `TICKET_TRANSITIONS` Flag-C terminal `closed` (E0-S3 / NFR-3), and **the E0-S12 Notifications kernel** (consumed by E4-S3 / ADR-014).
- **Depends on Epic 3** — customers must exist to ticket against, and the customer-state gate (E4-S1) reads the `CustomerStatus` produced by the conversion saga (E3-S1) and onboarding lifecycle (E3-S2).
- **Build order:** E4-S1 first (ticket entity + customer-state gate + `Ticket.Created`) → E4-S2 (lifecycle transitions via `POST /tickets/{id}/transition`) → E4-S3 (assignment + notification, depends on S1 ticket and E0-S12 kernel) → E4-S4 (timeline + audit panel, reads the DomainEvents/AuditEvents the prior stories emit).
- **Unblocks:** Epic 5 dashboard widgets/notifications inbox (E5-S3 also consumes E0-S12 and surfaces the `Ticket.Assigned` notifications produced here).

## Architecture delta & decisions formalized
- **E4-S3 CONSUMES the E0-S12 Notifications kernel** (ADR-014): `NotificationService` subscribes to the `DomainEvent` bus and maps `Ticket.Assigned → assigneeId`. Tickets do **not** write notifications directly.
- **E4-S4 applies ADR-016 formally and formalizes DEC-4:** `ActivityTimeline.tsx` (DomainEvent, record-view gated) vs `AuditLogPanel.tsx` (raw AuditEvent, §2.2 matrix-`own` gated via E0-S6) — keeping the per-record product surface distinct from the compliance view so the §2.2 matrix is never violated.

## Location map (architecture)
- `src/features/tickets/*` — ticket feature: list/detail/create, lifecycle transition, assignment.
- `src/features/tickets/ActivityTimeline.tsx` — per-record DomainEvent timeline (record-view gated).
- `src/features/tickets/AuditLogPanel.tsx` — raw AuditEvent compliance view (matrix-`own` gated).
- `src/shared/domain/{ticket.types.ts,status.ts,schemas.ts}` — `Ticket`/`TicketStatus`/`TicketPriority`, `TICKET_TRANSITIONS`, Zod.
- `src/shared/notifications/NotificationService.ts` — `Ticket.Assigned → assigneeId` mapping (consumed by E4-S3).

## References
- PRD §6 Epic 4 (E4-S1…E4-S4); UJ-4; §2.2 permission matrix ("View audit / events" row); SM-P1, SM-P4, SM-P5.
- ADRs: ADR-004 (repository seam + 4-beat), ADR-008 (dual events + correlationId), ADR-009 (auth/two gates/404-not-403), ADR-014 (Notifications shared kernel — E4-S3 consumes), ADR-015 (permission predicates incl. `own`), ADR-016 (Activity-timeline vs Audit/Events-log split; formalizes DEC-4).
- Constitution: project-context.md §2 (entities), §3 (statuses + `TICKET_TRANSITIONS`/Flag C), §4 (CRUD), §6 (auth/matrix), §7 (events), §8 (UI).
