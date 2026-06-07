---
title: "Product Brief Addendum: min-crm"
status: draft
created: 2026-06-06
updated: 2026-06-06
note: "Downstream detail extracted from the four inputs — for the PRD and architecture phases to lift. Not part of the 1–2 page brief."
---

# Addendum — min-crm

Depth that earned a place but does not fit the brief. Source artifacts in brackets.

## A. Reconciled Role → Permission Matrix (PRD-ready)

All rows implicitly tenant/subsidiary-scoped; out-of-tenant access returns `404`; deny-wins. [domain-research §6.6, constitution §6.2]

| Capability | tenant_admin | sales | support | viewer |
|---|:--:|:--:|:--:|:--:|
| Manage tenant/subsidiaries, users, config | ✅ | — | — | — |
| Onboard/offboard subsidiaries | ✅ | — | — | — |
| Cross-subsidiary roll-up view | ✅ | — | — | — |
| Leads — create / edit / convert | ✅ | ✅ | — | view |
| Leads — view | ✅ | ✅ | —¹ | ✅ |
| Customers — create / edit | ✅ | ✅ | — | view |
| Customers — view | ✅ | ✅ | ✅ | ✅ |
| Tickets — create / edit / assign | ✅ | —² | ✅ | — |
| Tickets — view | ✅ | ✅ | ✅ | ✅ |
| View audit / events | ✅ | own | own | — |
| Delete (soft) / export | ✅ | restricted | restricted | — |

¹ Pilot decision (flag E): support is **lead-blind**. ² Pilot decision (flag F): sales is **read-only** on tickets. Both least-privilege; relax later if needed.

## B. Status Sets & Transitions

**Lead** `new / contacted / qualified / disqualified / converted` [constitution §3.2 — confirmed by domain-research §6.2]
- `new → contacted | disqualified` · `contacted → qualified | disqualified` · `qualified → converted | disqualified` · `disqualified → contacted` (revive) · `converted → ∅` (terminal, read-only).

**Customer (DEC-1 — NEW, overrides constitution §3.1):** `prospect / onboarding / active / inactive / churned`
- `prospect → onboarding` · `onboarding → active` · `active → inactive` · `inactive → active` (reactivate) · `active → churned` · `inactive → churned` (churned terminal-ish).
- Conversion saga lands the Customer in `prospect`. **`CUSTOMER_TRANSITIONS` must be authored in `shared/domain/status.ts`** and the `CustomerStatus` union updated; add `STATUS_TONE.customer` entries for `prospect`/`onboarding`.
- **Ticket-creation gate:** tickets allowed only when customer is `active` (or `onboarding`).

**Ticket** `open / in_progress / pending / resolved / closed` [constitution §3.2 — confirmed by domain-research §6.4]
- Two-step close is intentional. **Flag C:** constitution allows `closed → open`; recommend `closed` terminal (reopen only `resolved → open`). **Flag D:** "SLA clock pauses while `pending`" — vocabulary only; SLA timers out of pilot scope.

## C. Lead → Customer Conversion (the Reference Saga) — DEC-2

[brainstorm Concept #4; domain-research §2]
- Modeled as a persisted, resumable, compensating **workflow instance** with UI-inspectable state — not an inline function. Graduates the Tasks/Workflow seam from stub to built.
- **Guard:** legal only from `qualified`. A `converted` lead is terminal/read-only. Disqualified/uncontacted leads cannot convert. Re-conversion blocked.
- **Field-map contract (explicit, reviewable — not implicit copy):** carry name, company, contact details, source, owner, and qualification (BANT) data. Activity history is *linked*, not duplicated.
- **Lineage (bidirectional):** set `Customer.convertedFromLeadId` and `Lead.convertedToCustomerId`; append a conversion event to both timelines. Lineage (how the record traveled) is distinct from audit (who did what, when).

## D. Tenant → Subsidiary Modeling

[technical-research Architecture §Data; domain-research §4]
- Two-level hierarchy: `tenant` (parent, the security boundary) → `subsidiary` (child scoping dimension). `subsidiaryId = null` = parent-level record (tenant-wide config, shared customers).
- **Roll-up** = parent-level read model aggregating subsidiary data; a read concern, never a cross-boundary write. `tenant_admin` (token `subsidiary_id = null`) relaxes the subsidiary filter.
- **Config/flag inheritance:** most-specific-wins precedence `subsidiary > tenant > system`, deny-wins, deterministic/cycle-proof. Store as `(tenantId, subsidiaryId|null, key, value)` rows (prod) / static keyed object (pilot). [flag H]
- **Onboard** = insert `Subsidiary` row + emit `Tenant.SubsidiaryAdded` (data op, no infra). **Offboard** = soft-delete subtree + **reassign orphaned records** + emit `Tenant.SubsidiaryRemoved` (flag I).

## E. Per-Topic Recommendation Matrix [technical-research]

| # | Topic | Target | Trade-off accepted |
|---|---|---|---|
| 1 | Multi-tenant isolation | Pool: shared Postgres + RLS, hybrid-to-Silo seam | Logical (not physical) isolation by default |
| 2 | Pilot→production seam | `Repository<T>` + adapter; Strangler-Fig swap | Trust-boundary is a real server-side build |
| 3 | Client architecture | TanStack Query v5 + React Router v7 (SPA) + RHF v7 + Zod v4 + Context/Zustand | React Router v7 over TanStack Router |
| 4 | Audit + event bus | Pilot in-process bus + append-only log; prod transactional outbox + CQRS-lite | At-least-once → idempotent consumers |
| 5 | AuthN/Z | One `AuthProvider`; mock → OIDC + PKCE; claims `{sub, tenant_id, subsidiary_id, roles, exp}` | Per-IdP role-claim normalization needed |
| 6 | Config & flags | OpenFeature-shaped `useFlag`/`useConfig`; static → Unleash; most-specific-wins | External flags hard-off do nothing until adapters exist |
| 7 | Deployment | SPA on Vercel; backend off-Vercel on region-pinnable cloud | Vercel no-BYOC for residency cases |

## F. ADR-Style Decision List (Accepted-proposed, pending architecture ratification) [technical-research]

- **ADR-001** Pool (shared Postgres + RLS) with hybrid-to-Silo capability.
- **ADR-002** `tenant_id` = isolation boundary; `subsidiary_id` = in-tenant scoping dimension.
- **ADR-003** Mandatory RLS indexing: `tenant_id` leads every primary access index.
- **ADR-004** Persistence behind a single `Repository<T>`; localStorage/HTTP swappable at composition root.
- **ADR-005** Server-side trust boundary is a dedicated build, not a swap; cross-tenant isolation E2E is the gate; cross-tenant reads return `404`.
- **ADR-006** Client stack: TanStack Query v5 + React Router v7 (SPA) + RHF v7 + Zod v4 + Context (Zustand if needed); not Redux.
- **ADR-007** Optimistic mutations via `onMutate/onError/onSettled`; fault-injection toggle in the localStorage adapter.
- **ADR-008** Audit + domain events: in-process bus + append-only log (pilot) → transactional outbox + CQRS-lite read models (prod); `correlationId` threaded through audit, events, logs; not event sourcing.
- **ADR-009** One `AuthProvider`, mock SSO → OIDC Auth Code + PKCE; claims `{sub, tenant_id, subsidiary_id|null, roles[], exp}`; production role-normalization layer.
- **ADR-010** Residency: build for Posture A (region-pinned Pool); retain Silo routing for Posture B. Open: confirm tenant-grain.
- **ADR-011** Flags/config: OpenFeature-shaped, evaluation context = auth context, most-specific-wins inheritance; external flags hard-off behind Noop ports.
- **ADR-012** External systems + out-of-scope engines (multi-cloud, billing, AI agent) are Ports & Adapters seams only.
- **ADR-013** Testing stack: Vitest + RTL + Playwright (closes DoD §10 chain).

## G. Conflict / Clarification Register — resolution status [technical-research F-1…F-8; domain-research A–K]

| ID | Item | Status in this brief |
|---|---|---|
| F-1 / A,B | Trust boundary client-side in pilot; Customer lifecycle undefined | Resolved: trust boundary = own epic; Customer lifecycle = 5-state (DEC-1). `CUSTOMER_TRANSITIONS` flagged as must-author. |
| F-2 | Residency grain | Open — confirm tenant-grain with customer. |
| F-3 | Backend off-Vercel | Carried — SPA on Vercel, backend elsewhere. |
| F-4 | No test runner | Resolved — adopt Vitest/RTL/Playwright. |
| F-6 | Production DB | Carried — Postgres recommended; confirm no boilerplate mandate. |
| F-7 | Pilot rollback untestable | Resolved — fault-injection toggle. |
| F-8 | IdP role claims | Carried — normalization layer in prod AuthProvider. |
| C | `closed → open` | Flagged — recommend `closed` terminal. |
| D | SLA pause-on-pending | Out of pilot scope; documented vocabulary. |
| E | Support → lead access | Resolved — support lead-blind (least-privilege). |
| F | Sales → ticket access | Resolved — sales read-only on tickets. |
| G | Lineage direction | Resolved — bidirectional. |
| H | Config inheritance precedence | Carried — `subsidiary > tenant > system`, deny-wins. |
| I | Offboard record reassignment | Carried — reassign orphaned records on offboard. |
| J | BANT fields | Resolved — `qualified` is a manual judgment call in pilot; BANT documented. |
| K | `qualified` double-duty | Accepted simplification — documented (collapses MQL/SQL). |

## H. Domain Glossary

Lift §6.1 of `domain-crm-domain-vocabulary-research-2026-06-06.md` verbatim into the PRD — Lead, Lead source/owner, Lifecycle Stage vs Lead Status, MQL/SQL, BANT, Qualification, Conversion, Lineage vs Audit trail, Customer, Ticket, Priority vs Severity, FRT, Resolution Time, SLA pause, Assignee, Tenant, Subsidiary, Roll-up, Inheritance/override, Offboarding, RBAC.
