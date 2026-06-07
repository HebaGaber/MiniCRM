---
id: E1
title: Tenancy & Subsidiary
cut: pilot
realizes: [UJ-1]
features:
  - "1.1 — Tenant Context & Isolation"
  - "1.2 — Subsidiary Onboard / Offboard"
  - "1.3 — Tenant/Subsidiary Switcher"
  - "1.4 — Parent Roll-up Read Model"
stories: [E1-S1, E1-S2, E1-S3, E1-S4, E1-S5]
depends_on: [E0]
---

# Epic E1 — Tenancy & Subsidiary

**Cut:** Pilot (Slice S1).
**Goal.** Tenant context + isolation threaded top-to-bottom, subsidiary onboard/offboard, the tenant/subsidiary switcher, and the parent roll-up read model. Realizes UJ-1.
**Realizes:** UJ-1 · **Inherits:** Epic 0 (UC-1…UC-5, TC).

This epic is the **prime exerciser of cross-tenant isolation** (SM-P3). It builds on the
E0-S11 isolation scaffold and is where the isolation contract bites hardest: every story
must hold against the `e2e/cross-tenant-isolation.spec.ts` suite, and the repository scope
seam (ADR-002) is the single chokepoint that all five stories thread through.

## Features & stories

### Feature 1.1 — Tenant Context & Isolation
Thread `TenantContext` from auth claims into the repository and enforce scope on every list/read/write.
- **E1-S1** — Thread TenantContext and enforce isolation → [E1-S1.md](E1-S1.md)

### Feature 1.2 — Subsidiary Onboard / Offboard
Add and offboard subsidiary nodes as data operations (no infra), with config inheritance and orphan reassignment.
- **E1-S2** — Onboard a subsidiary → [E1-S2.md](E1-S2.md)
- **E1-S3** — Offboard a subsidiary (soft-delete + reassign orphans) → [E1-S3.md](E1-S3.md)

### Feature 1.3 — Tenant/Subsidiary Switcher
Switch active subsidiary scope from the AppShell; the visible data set changes to match.
- **E1-S4** — Switcher in AppShell → [E1-S4.md](E1-S4.md)

### Feature 1.4 — Parent Roll-up Read Model
A parent-level read model aggregating subsidiary data (read-only; never a cross-boundary write).
- **E1-S5** — Cross-subsidiary roll-up (read model) → [E1-S5.md](E1-S5.md)

## Dependencies & sequencing
- **Depends on Epic 0** kernels: `Repository<T>` seam + 4-beat (E0-S4 / ADR-004), `AuthProvider` + claims + two gates (E0-S5 / ADR-009), permission predicates (E0-S6 / ADR-015), dual events + audit + correlationId (E0-S7 / ADR-008), four-state UI + `EntityForm`/`ConfirmDialog` (E0-S8/S9 / UC-1), config precedence (E0-S10 / ADR-011), and the **cross-tenant isolation E2E scaffold (E0-S11)**.
- **Build order:** E1-S1 first (it establishes the scope-resolution seam every other story relies on) → E1-S2 (onboard) → E1-S3 (offboard, depends on S2) → E1-S4 (switcher, depends on S1 scope plumbing) → E1-S5 (roll-up, depends on S1 + subsidiary data).
- **Unblocks:** Epics 2–5 (all feature CRUD inherits the tenant/subsidiary scope established here, UC-5).

## Location map (architecture)
- `app/providers.tsx` — `TenantContext`.
- `shared/ui/components/AppShell` — switcher.
- `features/dashboard` — roll-up read model.
- Key shared deps: data scoping (ADR-002), auth (ADR-009/015).

## References
- PRD §6 Epic 1; UJ-1; NFR-6; SM-P3.
- ADRs: ADR-002 (scope boundary), ADR-004 (repository seam + 4-beat), ADR-008 (dual events), ADR-009 (auth claims + two gates), ADR-011 (config precedence), ADR-015 (permission predicates).
- Constitution: project-context.md §1 (layering), §5.2 (`X-Subsidiary-Id` contract), §6 (auth), §4 (CRUD/soft-delete).
