---
id: E0
title: Platform Guidelines & Standards (the governing contract)
cut: pilot
realizes: [NFR-1, NFR-2, NFR-3, NFR-4, NFR-5, NFR-6, NFR-7, NFR-8, NFR-9, NFR-10, NFR-11, NFR-12]
features:
  - "0.1 — Domain & Status Kernel"
  - "0.2 — Repository Seam & Data Kernel"
  - "0.3 — Auth & RBAC Kernel"
  - "0.4 — Event, Audit & Logging Kernel"
  - "0.5 — UI Kernel & Component Inventory"
  - "0.6 — Conformance, Flags & Testing Harness"
  - "0.7 — Notifications Kernel"
stories: [E0-S1, E0-S2, E0-S3, E0-S4, E0-S5, E0-S6, E0-S7, E0-S8, E0-S9, E0-S10, E0-S11, E0-S12]
depends_on: []
---

# Epic E0 — Platform Guidelines & Standards (the governing contract)

**Cut:** Pilot — ships first.
**Goal.** Build the shared kernels that make NFR-1…NFR-12 *structurally* true, and codify the Universal Conformance ACs + Definition of Done that every subsequent story inherits. Ships the `src/shared` foundation that Epics 1–5 compose against.
**Realizes:** NFR-1…NFR-12 · **Inherits:** itself defines UC-1…UC-5 + TC (the DoD every other story inherits).

## Pilot framing
- **Product A consumes shared capabilities.** min-crm is the first product on the iSolution Platform Boilerplate. Every feature in Epics 1–5 imports from `src/shared/*`; the shared layer never imports `src/features/*` (NFR-1, one-way dependency).
- **Pilot = the production frontend on a localStorage adapter.** The same REST-shaped contracts, 4-beat use case, two-gate authZ, dual-event bus, and four UI states run in the pilot; only the persistence adapter (`LocalStorageRepository`) swaps for a server-backed `Repository<T>` later (ADR-004 composition-root swap). Nothing else changes.
- **External systems = Noop ports, flags OFF.** Odoo/Unifonic/Cloud and out-of-scope engines (billing, multi-cloud, AI agent) exist only as port interfaces with Noop adapters behind hard-off flags (ADR-012). No vendor SDK is referenced at any call site.

## Features & stories

### Feature 0.1 — Domain & Status Kernel
`shared/domain/status.ts`, `*.types.ts` — single source for statuses, transitions, tone, and entity types. Realizes NFR-2, NFR-3; unblocks S2–S4. **PREREQUISITE for Epic 3 & Epic 4** (`CUSTOMER_TRANSITIONS` was the blocker).
- **E0-S1** — Author status enums, transition maps, and tone → [E0-S1.md](E0-S1.md)
- **E0-S2** — Author `BaseEntity` and canonical entity types (incl. `WorkflowInstance` saga state) → [E0-S2.md](E0-S2.md)

### Feature 0.2 — Repository Seam & Data Kernel
The `Repository<T>` seam + the localStorage adapter honoring the 4-beat and REST contract. Realizes NFR-4, NFR-5, NFR-9; ADR-004/007.
- **E0-S3** — Define `Repository<T>` + `Page<T>` + `ListQuery` → [E0-S3.md](E0-S3.md)
- **E0-S4** — Implement `LocalStorageRepository` honoring the 4-beat + REST contract → [E0-S4.md](E0-S4.md)

### Feature 0.3 — Auth & RBAC Kernel
`AuthProvider`, two-gate authZ, and the ADR-015 permission predicate model. Realizes NFR-6; ADR-009/015.
- **E0-S5** — `AuthProvider` + `useAuth()` + mock SSO → [E0-S5.md](E0-S5.md)
- **E0-S6** — Route guard + action guard from the permission matrix (ADR-015 predicates) → [E0-S6.md](E0-S6.md)

### Feature 0.4 — Event, Audit & Logging Kernel
Dual event/audit streams on one `correlationId` + structured logging with PII masking. Realizes NFR-7, NFR-8; ADR-008.
- **E0-S7** — Audit log + domain event bus with shared `correlationId` → [E0-S7.md](E0-S7.md)
- **E0-S8** — Structured logger → [E0-S8.md](E0-S8.md)

### Feature 0.5 — UI Kernel & Component Inventory
Fixed component inventory, page templates, four-state boundary, design tokens. Realizes NFR-9, NFR-10.
- **E0-S9** — Build the shared component inventory + page templates → [E0-S9.md](E0-S9.md)

### Feature 0.6 — Conformance, Flags & Testing Harness
Flag/config provider, Noop ports, testing stack, and the codified Universal DoD. Realizes NFR-12; ADR-011/012/013.
- **E0-S10** — Flag/config provider + Noop external ports → [E0-S10.md](E0-S10.md)
- **E0-S11** — Testing harness + Universal DoD codified → [E0-S11.md](E0-S11.md)

### Feature 0.7 — Notifications Kernel
In-app notifications as a shared-layer capability driven off the domain-event bus. Realizes ADR-014.
- **E0-S12** — Notifications kernel → [E0-S12.md](E0-S12.md)

## Dependencies & sequencing
- **Build order:** S1+S2 → S3+S4 → S5+S6 → S7+S8 → S9 → S10+S12 → S11.
- **S1+S2 are PREREQUISITES for Epics 3 & 4** — `CUSTOMER_TRANSITIONS` (E0-S1) and the `WorkflowInstance` saga entity (E0-S2) unblock the conversion saga (E3-S1) and onboarding workflow (E3-S2).
- **E0-S12 (Notifications) PRECEDES E4-S3 and E5-S3**, which consume the `NotificationService` / `useNotifications()` it ships; E0-S12 itself depends on E0-S7 (the bus).
- **E0-S11 publishes the Universal Conformance ACs + DoD checklist** as the story template every Epic 1–5 story inherits; it lands last so it can wire the cross-tenant isolation E2E and architecture-fitness test against the completed kernels.
- This epic depends on nothing; it ships first and gates all downstream epics.

## References
- PRD §6 Epic 0; NFR-1…NFR-12 (§4); §2.2 permission matrix; §9 SM-*.
- ADRs: 001–016 (esp. 004, 007, 008, 009, 011, 012, 013, 014, 015, 016).
- Constitution: project-context.md §1–§10.
