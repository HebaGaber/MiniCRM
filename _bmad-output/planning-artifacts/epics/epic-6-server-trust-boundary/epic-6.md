---
id: E6
title: Server-Side Trust Boundary
cut: "design-only (NOT in 2-week pilot)"
realizes: [UJ-platform-isolation, UJ-production-readiness]
features:
  - "6.1 — Server-Side Enforcement + RLS"
  - "6.2 — Repository Swap (0-change proof)"
  - "6.3 — Cross-Tenant Isolation Gate"
  - "6.4 — Production Eventing & Auth"
stories: [E6-S1, E6-S2, E6-S3, E6-S4]
depends_on: [E0-S3, E0-S4, E0-S11, E0-S12, E5]
---

# Epic E6 — Server-Side Trust Boundary

> ## ⚠️ DESIGN-ONLY — NOT IN THE 2-WEEK PILOT CUT (ADR-005)
> **This entire epic is a PRODUCTION target, detailed here as implementation-ready design — it is explicitly NOT built during the 2-week pilot.** In the pilot, scoping / validation / authorization run **client-side** inside the localStorage adapter — acceptable **only** because auth is mocked. Production must **re-implement** these server-side: this is **net-new engineering, a dedicated build, NOT an adapter swap** (brief §6, the "single most important caveat"). Every story below carries the same banner.

**Cut:** DESIGN-ONLY — not in the 2-week pilot cut.
**Goal.** Re-implement scoping, validation, and authorization **server-side** with **Postgres RLS**, swap `LocalStorageRepository` → `HttpRepository` at the composition root with **ZERO feature-code change**, and **prove isolation** with a cross-tenant E2E gate.
**Realizes:** UJ-platform-isolation, UJ-production-readiness · **Inherits:** Epic 0 (UC-1…UC-5, TC).

## Why its own epic (the rationale)
In the pilot, the trust boundary lives in the **client** (the localStorage adapter enforces tenant/subsidiary scoping, Zod validation, and the `can()` authorization predicate). That is acceptable **only** because authentication is mocked and there is no real network boundary to cross. **Production cannot trust the client.** Scoping, validation, and authorization must be **re-implemented on the server** behind Postgres RLS — this is **net-new engineering**, not flipping an adapter. The seam established in Epic 0 (`Repository<T>` + composition-root injection, ADR-004) is what makes the *frontend* swap trivial; the *server* behind it is a full build. Hence Epic 6 stands alone (ADR-005).

## ⚠️ Open-Questions GATE — confirm with customer BEFORE kickoff
This epic is **GATED** by three PRD Open Questions; none of E6-S1…S4 may start until all three are resolved with the customer:
- **OQ1 — Boilerplate DB mandate.** Is Postgres (the boilerplate's mandated DB) confirmed, and may we apply RLS? (Drives ADR-001/002/003.)
- **OQ2 — Tenant-grain residency.** Confirm residency is enforced at **tenant grain** (§5, F-2) and which tenants are flagged for Silo routing (ADR-010).
- **OQ5 — Backend cloud / region.** Which cloud + region(s) host the backend? (Drives Silo routing + residency.)

## E6-S3 is the REAL security gate (vs E0-S11)
- **E0-S11** (pilot) is a **logical** cross-tenant proxy assertion — it is **NOT a security boundary**; it only proves the client adapter keys data correctly.
- **E6-S3** is the **definitive 0-leak security gate** against the real server + RLS. **E6-S3 passing is the acceptance gate for Epic 6 sign-off** (ADR-005). Production does not ship until E6-S3 is green.

## Features & stories
### Feature 6.1 — Server-Side Enforcement + RLS
Re-implement scoping, validation, and authorization on the server with Postgres RLS; cross-tenant reads return 404; residency at tenant grain.
- **E6-S1** — Server-side scoping/validation/authorization with Postgres RLS → [E6-S1.md](E6-S1.md)

### Feature 6.2 — Repository Swap (0-change proof)
Inject `HttpRepository` at the composition root with zero feature-code change.
- **E6-S2** — Swap to HttpRepository at the composition root → [E6-S2.md](E6-S2.md)

### Feature 6.3 — Cross-Tenant Isolation Gate
Playwright E2E that proves 0 cross-tenant leaks — the production acceptance gate.
- **E6-S3** — Cross-tenant isolation E2E (the acceptance gate) → [E6-S3.md](E6-S3.md)

### Feature 6.4 — Production Eventing & Auth
Graduate eventing and auth to production shapes behind the same seams.
- **E6-S4** — Transactional outbox, CQRS-lite read models, OIDC → [E6-S4.md](E6-S4.md)

## Dependencies & sequencing
- **Blocked until OQ1/OQ2/OQ5 are confirmed** with the customer (see GATE above).
- **Depends on:** the Epic 0 seam — **E0-S3/E0-S4** (`Repository<T>` + composition-root injection, ADR-004) and the **E0-S11** pilot isolation proxy (superseded as a *security* check by E6-S3); **E0-S12** notifications kernel (ADR-014); **Epic 5** read-model widgets (re-pointed in E6-S4).
- **Build order:** E6-S1 (server + RLS) → E6-S2 (swap the adapter onto the live server) → E6-S3 (prove isolation; the sign-off gate) → E6-S4 (production eventing + OIDC behind the same seams). E6-S4 may proceed in parallel with E6-S3 once E6-S1 lands.
- **Hard production gate (ADR-003):** p95 list query < 50ms with `tenant_id`-leading indexes; index review is a hard gate within E6-S1.

## References
- PRD §6 Epic 6; ADR-001/002/003/004/005/008/009/010; Constitution project-context.md §1, §4, §5, §6, §7.
