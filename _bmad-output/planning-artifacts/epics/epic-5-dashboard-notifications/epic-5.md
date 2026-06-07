---
id: E5
title: Dashboard Shell, Read-Model Widget & Notifications
cut: pilot
realizes: [UJ-5]
features:
  - "5.1 — Dashboard Shell"
  - "5.2 — Read-Model Widget"
  - "5.3 — In-App Notifications"
stories: [E5-S1, E5-S2, E5-S3]
depends_on: [E0-S12, E3-S1, E4-S3]
---

# Epic E5 — Dashboard Shell, Read-Model Widget & Notifications

**Cut:** Pilot (production frontend on localStorage adapter).
**Goal.** Give every user a role-scoped landing dashboard, prove the **event-log → read-model seam** (CQRS-lite, ADR-008) with exactly **ONE** aggregate widget computed from the `DomainEvent` log — never a cross-boundary write — and surface **in-app notifications** driven off domain events (`Ticket.Assigned`, `Lead.Converted`). This epic is the integration capstone: it reads from streams the earlier epics emit and demonstrates that derived views and notifications fall out of the event log rather than bespoke writes. Code lives in `src/features/dashboard/*` (`DashboardPage.tsx`, `widgets/ReadModelWidget.tsx`, `NotificationsInbox.tsx`).
**Realizes:** UJ-5 (role-scoped dashboard + read-model widget + in-app notifications). · **Inherits:** Epic 0 (UC-1…UC-5, TC).

> ## ⚠️ E5-S3 CONSUMES — does NOT IMPLEMENT — notifications (ADR-014)
> **Per ADR-014, the Notifications capability is a shared kernel that lives in `src/shared/notifications` (E0-S12).** E5-S3 was **RE-SCOPED**: it now **CONSUMES** that kernel. `NotificationsInbox.tsx` wires `useNotifications()` and renders the bell/inbox surface; recipient mapping and the event-bus subscription (`Ticket.Assigned → assigneeId`, `Lead.Converted → lead ownerId`) **already live in `shared/notifications` (E0-S12)**. E5-S3 ships **no notification logic of its own** — no bus subscription, no recipient mapping, no bespoke writes.

## Features & stories

### Feature 5.1 — Dashboard Shell
A role-scoped, tenant-scoped dashboard template that a user lands on. Intentionally **thin** — the read-model substance lives in E5-S2; this story is the shell + four-state container scoped to role and tenant/subsidiary.
- **E5-S1** — Role-scoped dashboard shell → [E5-S1.md](E5-S1.md)

### Feature 5.2 — Read-Model Widget
Exactly **ONE** aggregate widget — conversion funnel **OR** per-subsidiary roll-up — computed from the event log into a read model (CQRS-lite, ADR-008). Scope-aware: admin sees cross-subsidiary, subsidiary user sees own only. Remaining widgets are explicitly later stories (non-goal for pilot).
- **E5-S2** — One read-model widget fed from the event log → [E5-S2.md](E5-S2.md)

### Feature 5.3 — In-App Notifications
Surface in-app notifications driven off domain events — **CONSUMING** the E0-S12 Notifications kernel (ADR-014). `NotificationsInbox.tsx` wires `useNotifications()` + the bell/inbox surface; scoped to the recipient's tenant/subsidiary.
- **E5-S3** — Notifications inbox/bell consuming the shared kernel → [E5-S3.md](E5-S3.md)

## Dependencies & sequencing
- **Hard prerequisite (must land first):** **E0-S12** (Notifications kernel — `NotificationService` + `useNotifications()` + four-state surface scaffold). E5-S3 consumes it directly and cannot be built against a non-existent kernel (ADR-014).
- **Upstream domain events (notification sources):** **E4-S3** supplies `Ticket.Assigned`; **E3-S1** supplies `Lead.Converted`. The read-model widget (E5-S2) consumes the `DomainEvent` log produced across Epics 2–4 (lead/customer/ticket streams).
- **Inherits:** Epic 0 kernels — `QueryStateBoundary` (UC-1, E0-S9), `AuthProvider`/scope (UC-5, ADR-009), the domain-event bus + audit log (E0-S7), `Dashboard` template (`shared/ui/templates/Dashboard`).
- **Build order within epic:** **E5-S1** (shell — role/tenant-scoped container, four states) → **E5-S2** (drop the ONE read-model widget into the shell, fed from the event log) → **E5-S3** (wire the notifications inbox/bell consuming E0-S12). S3 can proceed in parallel once E0-S12 + the source events (E3-S1, E4-S3) are green.
- **Open Question 3 (deferred to sprint planning):** the widget choice in E5-S2 — **conversion funnel** vs **per-subsidiary roll-up** — is OQ3, decided at sprint planning. Either way it is computed read-side from the event log (ADR-008), respects scope, and ships exactly one widget.
- **Read-model contract (ADR-008):** the widget is derived from the `DomainEvent` log into a read model — a **CQRS-lite read seam, NEVER a cross-boundary write**. This is not event-sourcing; it is a projection for display.

## References
- PRD §6 Epic 5 (Features 5.1–5.3); UJ-5; Open Question 3 (widget choice).
- Architecture: ADR-008 (dual streams / CQRS-lite read-model seam, one `correlationId`, not event-sourcing), ADR-014 (Notifications = shared kernel; E5-S3 consumes it), ADR-009 (auth scope, 404-not-403), ADR-002 (`tenant_id` isolation / `subsidiary_id` in-tenant scope).
- Constitution: project-context.md §6 (auth), §7 (events), §8 (UI), §9 (folders).
