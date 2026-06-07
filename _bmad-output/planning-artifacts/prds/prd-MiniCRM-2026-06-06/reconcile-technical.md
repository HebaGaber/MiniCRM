# Technical Reconciliation — PRD vs. Technical-Architecture Research

**PRD:** `_bmad-output/planning-artifacts/prds/prd-MiniCRM-2026-06-06/prd.md` (§4.2 ADR baseline, §5 resolved flags, Epic 6)
**Source research:** `_bmad-output/planning-artifacts/research/technical-min-crm-technical-architecture-feasibility-research-2026-06-06.md` (ADR-001…013, Conflict Register F-1…F-8)
**Date:** 2026-06-06

## Verdict

The baseline is carried forward faithfully on the substance. ADR-001…013 summaries in §4.2 match the research's intent without distortion; the client stack, optimistic-rollback + fault-injection, event outbox/CQRS-lite, OIDC, flags, and testing decisions are all reflected (NFRs + Epic 0/5/6 stories). Epic 6 faithfully reproduces the research's "single most important caveat" / ADR-005 (server-side trust boundary as a dedicated build, not a swap, with the cross-tenant E2E as its gate). The discrepancies below are mostly around F-6 wording (over-commit) and dropped *production deployment* guidance (F-3), plus minor lost rationale.

## Gaps / Discrepancies

### 1. F-6 over-committed: PRD says Postgres "confirmed"; research says "ratify (pending)" — SEVERITY: Medium
- **Source:** F-6 is a register item — "Ratify **Postgres** as the isolation primitive." The ADR list header states every ADR is "**Accepted (proposed)** pending architecture-phase ratification," and F-6 is flagged in the research's own "resolve first (widest blast radius)" trio (F-1, F-2, F-6). The research recommends, it does not confirm.
- **PRD:** §5 F-6 reads "Production DB → PostgreSQL **(confirmed)**" and §11 Open Question 1 says "Postgres is **confirmed** for production." The PRD does retain the boilerplate-mandate caveat and routes it to the architecture phase, which softens this.
- **Assessment:** The word "confirmed" over-states a still-proposed/ratify-pending decision. The accompanying caveat keeps it from being a hard contradiction, but the framing claims more certainty than the research grants. Recommend "recommended / ratify-pending" to match.

### 2. Production deployment decision (F-3: SPA on Vercel + backend OFF-Vercel, no BYOC) dropped — SEVERITY: Medium
- **Source:** Topic 7 + F-3 + ADR-010 consequence are explicit and load-bearing: Vercel offers **no BYOC**, multi-region is Pro/Enterprise only, Functions default to `iad1`; therefore a residency/isolation-sensitive backend **must not** live on Vercel Functions — it belongs on a region-pinnable cloud, with the SPA staying on Vercel. F-3 is a named register item.
- **PRD:** Carries only the *pilot* deployment fact (Vercel preview deploys as a DoD/TC gate). The production-deployment constraint (backend off-Vercel, no-BYOC rationale, region-pinnable cloud) appears nowhere — not in §4.2, not in Epic 6, not in Open Questions. ADR-010's summary in §4.2 keeps the residency/Posture-A/Silo half but drops its "backend lives off-Vercel" consequence.
- **Assessment:** A material production decision and its driving constraint are dropped. Epic 6 specifies RLS/outbox/OIDC but is silent on where the backend runs. Recommend adding the off-Vercel/region-pinnable-cloud constraint to Epic 6 (or §4.2 ADR-010).

### 3. F-3 absent from §5 / §11 open-questions reconciliation — SEVERITY: Low
- **Source:** Research's "resolve first" set is F-1, F-2, F-6; F-3 is a standing register item to ratify in architecture.
- **PRD:** §5 resolves F-2 and F-6; F-1 is fully absorbed into Epic 6 (good). F-3 is neither resolved nor listed as an open question, so it silently disappears from the flag-tracking chain.
- **Assessment:** Not distorted, just untracked. Couples with Gap 2. Add F-3 as an Open Question or fold its constraint into Epic 6.

### 4. ADR-003 indexing performance rationale flattened — SEVERITY: Low
- **Source:** ADR-003 carries a "non-negotiable" quantified rule: `tenant_id`-leading indexes or ~120ms seq-scan vs ~1.2ms (two orders of magnitude at 1M rows / 10K tenants); "index review is a prod gate."
- **PRD:** §4.2 ADR-003 summary keeps the rule ("`tenant_id` leads every primary access index") but drops the magnitude/benchmark and the "index review is a prod gate" consequence; Epic 6 (E6-S1) restates the rule but not the gate.
- **Assessment:** Decision intent preserved; the enforcement teeth (a prod gate) are lost. Acceptable for a by-reference summary, but worth a one-line note in Epic 6.

### 5. Production performance success metric (p95 list query < 50ms) dropped — SEVERITY: Low
- **Source:** Research success metrics include "p95 list query < 50ms at representative tenant scale (validates RLS indexing)."
- **PRD:** §9 carries the four-state, 0-leak, dual-event, transition, and repo-swap metrics (matching the research's other four) but omits the p95/RLS-indexing metric.
- **Assessment:** Defensible — it is a production (Epic 6) metric and the pilot has no Postgres — but it is the validation hook for ADR-003 and is currently unmeasured anywhere. Optionally attach to Epic 6.

### 6. ADR-006 "Zustand if needed" nuance — faithfully preserved (no gap) — SEVERITY: None
- **Source/PRD:** Research "Context + Zustand only if cross-feature UI state emerges; not Redux" is carried verbatim-in-intent in ADR-006 summary and Non-Goals. No discrepancy; noted for completeness.

## Items confirmed accurately carried (no action)
- ADR-001/002 Pool + RLS, hybrid-to-Silo, tenant=boundary / subsidiary=scoping — accurate (§4.2, Epic 6).
- ADR-004 Repository seam, Strangler-Fig, composition-root swap — accurate (NFR-4, E0-S3/S4, E6-S2).
- ADR-005 server-side trust boundary as dedicated build + cross-tenant E2E gate + 404 — faithfully reflected (Epic 6 framing matches the research's "single most important caveat" exactly).
- ADR-007 optimistic onMutate/onError/onSettled + fault-injection toggle — accurate (NFR-9, E0-S4(g), E0-S11(c)).
- ADR-008 in-process bus + append-only log → transactional outbox + CQRS-lite, not event sourcing, correlationId threaded — accurate (NFR-7, E0-S7, E5-S2, E6-S4).
- ADR-009 OIDC Auth Code + PKCE, claims shape, IdP→Role normalization layer — accurate (NFR-6, E0-S5, E6-S4).
- ADR-011 OpenFeature-shaped, auth-context evaluation, most-specific-wins, deny-wins, Noop ports OFF — accurate (E0-S10).
- ADR-012 Ports & Adapters seams only for external/out-of-scope engines — accurate (Non-Goals, E0-S10).
- ADR-013 Vitest + RTL + Playwright incl. cross-tenant isolation E2E + rollback test — accurate (NFR-12, E0-S11).
- F-2 residency → tenant-grain with `[CONFIRM with customer]`, Silo seam retained — consistent with research (build Posture A, confirm tenant grain).
