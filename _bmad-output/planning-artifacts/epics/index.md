---
title: min-crm — Sharded Epics & Stories
status: ready-for-implementation
created: 2026-06-06
owner: Heba
inputDocuments:
  - _bmad-output/planning-artifacts/prds/prd-MiniCRM-2026-06-06/prd.md
  - _bmad-output/planning-artifacts/prds/prd-MiniCRM-2026-06-06/.decision-log.md
  - _bmad-output/planning-artifacts/architecture.md
  - _bmad-output/planning-artifacts/briefs/brief-MiniCRM-2026-06-06/addendum.md
  - _bmad-output/project-context.md
---

# min-crm — Epics & Stories (sharded)

Implementation-ready, architecture-informed expansion of the PRD's Epic → Feature → Story spine.
Story IDs are **stable** (`E<epic>-S<n>`) and survive reorganization. Each story is its own file,
ready to become a GitHub **Epic → Feature → Story** sub-issue (`Closes #`).

**Pilot = the production frontend on the localStorage adapter.** Epics 0–5 are the 2-week pilot cut.
**Epic 6 is PRODUCTION / DESIGN-ONLY — not in the pilot cut** (ADR-005); its stories are generated
for completeness and flagged accordingly.

## Universal Conformance ACs (defined in Epic 0; inherited by every story)

Listed once here; each story names the applicable subset rather than copying them verbatim.

- **UC-1 — Four UI states.** Every data-backed view handles `loading`/`empty`/`error`/`ready` via the shared `<QueryStateBoundary>`. *(NFR-9)*
- **UC-2 — Dual events, one correlationId.** Every mutation emits exactly one `AuditEvent` + one `DomainEvent` (canonical type) sharing one `correlationId`. No silent writes. *(NFR-7)*
- **UC-3 — Illegal transitions rejected `422`.** Status changes outside the transition map are rejected `422 UNPROCESSABLE`, never silently applied. *(NFR-3)*
- **UC-4 — Conversion guard.** Conversion is legal only from `qualified`; a `converted` lead is terminal/read-only; re-conversion blocked. *(DEC-2)*
- **UC-5 — Tenant/subsidiary scoping; out-of-tenant → `404`.** All reads/writes scoped from auth context; out-of-tenant record → `404`, not `403`. *(NFR-6)*
- **TC — Traceability.** Story links spec → code → test and closes a GitHub issue. Preview deploy green; marked done in `sprint-status.yaml`; passes `bmad-code-review`. *(Constitution §10)*

## Epic index

| Epic | Title | Cut | Stories | Folder |
|---|---|---|---|---|
| **E0** | Platform Guidelines & Standards (governing contract) | Pilot | E0-S1…E0-S12 | [epic-0-platform-guidelines/](epic-0-platform-guidelines/epic-0.md) |
| **E1** | Tenancy & Subsidiary | Pilot | E1-S1…E1-S5 | [epic-1-tenancy-subsidiary/](epic-1-tenancy-subsidiary/epic-1.md) |
| **E2** | Leads: Capture → Qualify | Pilot | E2-S1…E2-S4 | [epic-2-leads-capture-qualify/](epic-2-leads-capture-qualify/epic-2.md) |
| **E3** | Conversion Saga & Customer Onboarding | Pilot | E3-S1…E3-S3 | [epic-3-conversion-onboarding/](epic-3-conversion-onboarding/epic-3.md) |
| **E4** | Ticketing & Activity Timeline | Pilot | E4-S1…E4-S4 | [epic-4-ticketing-timeline/](epic-4-ticketing-timeline/epic-4.md) |
| **E5** | Dashboard Shell, Read-Model Widget & Notifications | Pilot | E5-S1…E5-S3 | [epic-5-dashboard-notifications/](epic-5-dashboard-notifications/epic-5.md) |
| **E6** | Server-Side Trust Boundary | **DESIGN-ONLY (not pilot)** | E6-S1…E6-S4 | [epic-6-server-trust-boundary/](epic-6-server-trust-boundary/epic-6.md) |

## Architecture deltas applied (vs. PRD baseline)

- **ADD E0-S12 — Notifications kernel** (`src/shared/notifications`, ADR-014): `NotificationService` + `useNotifications()` subscribing to the domain-event bus; four-state notifications surface scaffold. **E4-S3 and E5-S3 CONSUME it.**
- **E0-S6** encodes the permission matrix using **ADR-015** predicates: `own = isOwned(actor, resource)`; `restricted = isOwned AND action ∈ {softDelete, export}`; **hard-delete is never granted**; deny-wins default.
- **ADR-016** split kept: **Activity timeline** (DomainEvent, record-view permission, `viewer` included) vs **Audit/Events log** (raw `AuditEvent`, §2.2-gated `own`/`restricted`, `viewer = none`).

## Sequencing & dependency spine

```
Epic 0 (kernels) ──ships first──┐
   E0-S1 (status maps incl. CUSTOMER_TRANSITIONS) ─┐  PREREQUISITES for Epic 3 & Epic 4
   E0-S2 (entities incl. WorkflowInstance) ────────┘
   E0-S7 (event bus) ──→ E0-S12 (Notifications kernel) ──→ E4-S3, E5-S3
Epic 0 build order: S1+S2 → S3+S4 → S5+S6 → S7+S8 → S9 → S10+S12 → S11
Epics 1–5 are pure product code on the Epic-0 kernels (each inherits UC-1…UC-5 + TC).
Epic 6 = DESIGN-ONLY (production trust boundary); revisit Open Questions 1/2/5 before kickoff.
```

Hard prerequisites (marked in the story files):
- **E0-S1 + E0-S2 precede Epic 3 and Epic 4** (`CUSTOMER_TRANSITIONS` / `WorkflowInstance`).
- **E0-S12 precedes E4-S3 and E5-S3** (Notifications kernel).
- **E6-S2** (repo swap) depends on **E0-S3/S4** (the seam) and is proven only in production.

## Traceability model

Every story is a node in `story → spec → code → test → issue (Closes #)`. The story file's
**References** block is ready to paste into a GitHub issue body. This chain *is* success metric SM-M4.
