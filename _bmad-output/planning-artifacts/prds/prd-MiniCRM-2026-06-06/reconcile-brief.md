---
title: "Reconciliation: PRD vs Brief + Addendum"
prd: _bmad-output/planning-artifacts/prds/prd-MiniCRM-2026-06-06/prd.md
sources:
  - _bmad-output/planning-artifacts/briefs/brief-MiniCRM-2026-06-06/brief.md
  - _bmad-output/planning-artifacts/briefs/brief-MiniCRM-2026-06-06/addendum.md
created: 2026-06-06
---

# Reconciliation — what the PRD dropped, distorted, or under-carried

Overall the PRD carries forward the brief §1–§8 and addendum §A–§H with high fidelity. The two-audience framing, the S1–S5 → Epic 1–5 mapping, the technical baseline (ADR-001…013), the two-sided success metrics, the constraints, the conversion saga (addendum C), tenant/subsidiary modeling (addendum D), and the conflict register (addendum G) are all present. The role matrix (addendum A) is reproduced **verbatim** (rows, columns, footnotes ¹/² all match). The glossary (addendum H) is lifted in full. Gaps below are mostly dropped concrete details and a few soft distortions — none structural.

---

## Gap 1 — Deployment direction (Vercel + region-pinnable backend) is largely dropped
**Severity: Medium**

- **Source:** Brief §6 has an explicit "Deployment" bullet: "SPA on **Vercel** (CDN, preview deploys per PR); production backend off-Vercel on a region-pinnable cloud (Vercel offers no BYOC)." Brief §8 lists **Vercel deploy** as a non-negotiable fixed-stack constraint. Addendum §E row 7 and §G F-3 ("Backend off-Vercel — carried") reinforce it. This is the residency/BYOC rationale tying F-2 residency to deployment topology.
- **PRD coverage:** No ADR row for deployment (the ADR table is ADR-001…013, but the brief's deployment direction is not surfaced as its own line). "Vercel" appears only implicitly via "preview deploy green" in TC/§10. The Vercel-as-fixed-constraint and the off-Vercel-backend / no-BYOC residency rationale are **not carried** into §4, §5, or §8. F-3 (backend off-Vercel) is absent from the §5 flag resolutions and §11 open questions.
- **Why it matters:** The no-BYOC point is the load-bearing reason residency (F-2) is hard at subsidiary grain; dropping it weakens the F-2 narrative the PRD does keep.

## Gap 2 — Flag/config provider tooling path (static → Unleash; OpenFeature) under-specified
**Severity: Low**

- **Source:** Brief §6 and addendum §E row 6 / §F ADR-011: "**OpenFeature-shaped** provider (static pilot → **Unleash**)." The concrete graduation target (Unleash) is named.
- **PRD coverage:** NFR / ADR-011 and E0-S10 keep "OpenFeature-shaped," evaluation context = auth context, most-specific-wins, deny-wins, Noop ports OFF — all good. But the **static → Unleash** production path is dropped (ADR-011 row says only "OpenFeature-shaped … external flags hard-off behind Noop ports").
- **Why it matters:** Minor; a named graduation target that architecture would otherwise re-derive.

## Gap 3 — Config-inheritance precedence arrow notation is distorted
**Severity: Low**

- **Source:** Brief §6 writes the inheritance as `subsidiary → tenant → default`. Addendum §D and §G flag H write `subsidiary > tenant > system` with "deny-wins, deterministic/cycle-proof."
- **PRD coverage:** PRD consistently uses `subsidiary > tenant > system` (Glossary, ADR-011, E0-S10) and adds "cycle-proof (flag H)." This actually **reconciles** the brief's looser `→ default` to the addendum's `> system`, which is the correct authoritative form — so this is a resolved inconsistency, not a true loss. Noting only because the brief's wording differs.
- **Why it matters:** Negligible; PRD chose the stronger source.

## Gap 4 — Customer lifecycle transition nuance ("churned terminal-ish") slightly hardened
**Severity: Low**

- **Source:** Addendum §B defines `CUSTOMER_TRANSITIONS` with `active → churned`, `inactive → churned`, and labels churned "**terminal-ish**" (deliberately hedged). The §G F-1 resolution and §B require `CUSTOMER_TRANSITIONS` authored + `STATUS_TONE.customer` entries for `prospect`/`onboarding`.
- **PRD coverage:** E3-S2 lists `active ↔ inactive` reactivation and `active/inactive → churned` and states "churned terminal" (PRD §6) — dropping the source's "-ish" hedge. E0-S1 correctly requires `CUSTOMER_TRANSITIONS` (DEC-1) and `STATUS_TONE.customer` prospect/onboarding. The transition set matches addendum §B exactly.
- **Why it matters:** Minor framing tightening; the hedge in the source implied churned might later allow a path out. Worth a one-word confirm with the customer, but the transition map itself is faithful.

## Gap 5 — Brief's open-question framing of `CUSTOMER_TRANSITIONS` as "🔴 highest priority / blocks S3-S4" softened
**Severity: Low**

- **Source:** Brief Open Questions #1 flags the missing `CUSTOMER_TRANSITIONS` as 🔴 **highest priority**, noting constitution §3.1 still lists 3 states and that both must be defined **before building S3/S4**. Addendum §G F-1 echoes "flagged as must-author."
- **PRD coverage:** Captured correctly but **demoted in salience** — folded into E0-S1 as a normal AC ("CUSTOMER_TRANSITIONS (newly authored, DEC-1)") with a `[NOTE FOR PM]` that the constitution already reflects DEC-1. It is no longer surfaced as a top open question (§11 lists F-6, F-2, widget choice, ticket triage — not this). The sequencing dependency (must precede S3/S4) is implicit in epic ordering but not stated as a risk.
- **Why it matters:** The PRD treats it as resolved-by-Epic-0, which is reasonable, but the brief's explicit "blocks S3/S4 if not authored first" urgency is lost.

---

## Notes on PRD additions (checked for grounding)
- Epic 6 (Server-Side Trust Boundary) and its sub-stories E6-S1…S4 — **grounded** in brief §5/§6 "single most important caveat" and ADR-005/008/009.
- NFR-1…NFR-12 numbering, UC-1…UC-5, TC, SM-C1…C3 counter-metrics — **grounded**; these are structural restatements of constitution contracts and brief §7, not new scope. Counter-metrics (SM-C1/C2/C3) are a reasonable PRD-level elaboration of the brief's "deliberately small / don't skip conformance" intent.
- Open Question #4 (untriaged ticket `new` state) — **grounded** in domain research (referenced), consistent with brief's "tickets enter as `open`."
- No ungrounded scope additions found.
