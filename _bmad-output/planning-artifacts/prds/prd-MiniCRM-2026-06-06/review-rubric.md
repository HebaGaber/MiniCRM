# PRD Quality Review — min-crm

## Overall verdict

This is an unusually disciplined chain-top PRD: the Epic 0 governing-contract pattern (UC-1…UC-5 + TC inherited by every story) and the verbatim Glossary give downstream UX, architecture, and story creation an exceptionally clean source to extract from. Done-ness clarity and downstream usability — the two dimensions the rubric flags as mattering most here — are both genuinely strong, with testable consequences (`422`, `404`, `409`, "exactly one audit + one domain event") rather than adjectives. The main risks are concentrated and known rather than structural: the production trust boundary (Epic 6) is honestly deferred but is the load-bearing caveat of the whole "0-change swap" thesis, and a few decision tensions (which read-model widget, residency grain) are parked in Open Questions where they belong. Nothing here reads as theater.

## Decision-readiness — strong

A decision-maker can act on this. Trade-offs are stated as decisions with what was given up, not smoothed to neutral. §5 (F-2) names the residency choice and its cost explicitly: tenant-grain is chosen because "subsidiary-grain residency would fracture the two-level Pool and force per-subsidiary data placement," with the Silo seam retained as the escape hatch — a real trade, honestly priced. The permission matrix §2.2 makes two deliberately restrictive calls and labels them: support is "lead-blind" (flag E) and sales is "read-only on tickets" (flag F), each tagged "least-privilege; relax later if needed" rather than hedged.

Open Questions §11 are actually open and owned: each carries an Owner and a revisit point (e.g. OQ-1 "Owner: architecture; revisit: before Epic 6 kickoff"). OQ-3 (read-model widget choice) is a genuine deferred pick, not a rhetorical question. The `[NOTE FOR PM]` at §8.2 lands on the real tension — "Highest-stakes deferred item; must be ratified and scheduled before any production exposure" — not a safe checkpoint.

### Findings
- **low** Residency confirmation depends on an unconfirmed customer assumption (§5 F-2, §12) — the choice is sound but `[CONFIRM with customer]` and the `[ASSUMPTION]` that tenant-grain "is acceptable to the customer" both ride on a conversation that hasn't happened. *Fix:* none needed for chain-top; ensure architecture phase treats OQ-2 as a hard gate before Epic 6, as already stated.

## Substance over theater — strong

The content is earned. The Glossary (§3) is lifted verbatim from domain research and each term does work downstream — `Lifecycle Stage` vs `Lead Status` distinguishes "relationship" from "sales-activity state," and the PRD records where min-crm deliberately collapses the model ("collapses both into a single `qualified`"). The NFRs (§4.1) are the opposite of NFR theater: each cites a constitution section and carries product-specific thresholds (`pageSize=25, max 100`; `version` starts at 1; ISO 8601 UTC; `422`/`404`/`409` codes), not "must be scalable/secure."

The Vision (§1) could not swap into another PRD — its signature move ("the hidden plumbing **is** the demo"; "the immutable audit/event log, surfaced as a per-record activity timeline, is simultaneously a headline user feature and the compliance backbone") is specific to this product's two-sided bet. JTBD §2.1 stays at five and the fifth (the iSolution platform team) is the builder-audience that the whole method-metric arc (SM-M1…M5) serves — not a padding persona. No innovation-theater differentiation section exists.

## Strategic coherence — strong

There is a clear thesis and the features serve it. The bet is stated in §1: "deliberately small in features and deliberately exhaustive in conformance … the codebase reads as a reference implementation, not a demo," validated two-sidedly (product flows work AND the method is proven). Prioritization follows the thesis rather than ease — Epic 0 (the shared kernels and DoD) is built first precisely because conformance is the product, and the counter-metrics enforce this: SM-C1 ("Do not grow features to look productive") and SM-C3 ("sameness … is the goal") actively police against the easy-wins failure mode.

Success Metrics validate the thesis rather than measuring activity — there is no DAU/MAU tell; instead SM-P3 ("0 cross-tenant leaks"), SM-P4 (exactly-one-audit-one-event), and SM-M5 (0-change repository swap) each test a specific claim. Counter-metrics are present and named against the metrics they counterbalance. MVP scope kind is coherent: a platform/reference-implementation cut whose scope logic (vertical thread across all seams, breadth held flat) matches the thesis.

## Done-ness clarity — strong

This is the dimension that matters most downstream, and it holds up under unforgiving reading. Almost every AC carries a testable consequence. Examples: E0-S4(c) "update requires caller `version`, mismatch → `409`"; E2-S3(a) "illegal transition (e.g. `new → qualified`) → `422` and pill unchanged"; E4-S1(b) "ticket creation allowed only when the customer is `active` or `onboarding` — blocked for `prospect`/`inactive`/`churned`"; E3-S1(f) "a mid-saga failure compensates/rolls back cleanly — no half-made customer; lead stays `qualified` … uses fault-injection toggle." The Universal Conformance ACs are themselves expressed as testable gates ("assertable in tests," "never silently applied"). NFR-9/UC-1's four UI states are a binary DoD ("Shipping a view without all four is a DoD failure"). SM-P2 makes this measurable at 100%.

I found no instances of "handles X gracefully," "reasonable performance," or "user-friendly." The few soft spots are pointed to rather than waved away.

### Findings
- **medium** "Documented reassignment rule" is referenced but not defined (E1-S3(c)) — "reassign orphaned leads/customers/tickets per the documented reassignment rule" leaves the actual rule (reassign to whom? parent tenant? a designated admin?) unspecified, so an engineer cannot tell what "done" is for the most consequential part of offboarding. *Fix:* state the reassignment target inline (e.g. "reassigned to the parent-level scope, `subsidiaryId=null`, owner set to the offboarding `tenant_admin`") or cite the artifact that defines it.
- **low** Onboarding event semantics are slightly loose (E3-S2(d)) — "emits `Customer.Updated` (+ `StatusChanged` semantics)" mixes a canonical event type with parenthetical "semantics," ambiguous against NFR-7's "no free-form names" / canonical registry. *Fix:* name the exact event(s) emitted on a customer status change (e.g. `Customer.StatusChanged`) consistent with the registry in E0-S7.
- **low** Activity-timeline ordering for same-instant events is unstated (E2-S4, E4-S4) — "in time order" is testable at second granularity but conversion emits multiple events sharing one `correlationId` "at once"; tie-break ordering on the timeline isn't specified. *Fix:* note a deterministic tie-break (e.g. audit before domain, or by event sequence) so the rendered order is assertable.

## Scope honesty — strong

Omissions are explicit, not inferred. §7 Non-Goals does real work, naming each exclusion with its governing decision ("Not building the out-of-scope engines … seams (port interfaces) only, no engine (ADR-012)"; "Not shipping the server-side trust boundary in the 2-week cut — it is Epic 6"). §2.4 Non-Users is equally concrete (no customer-facing portal; billing/AI-agent operators are "seams only — OFF"). The Assumptions Index §12 round-trips: each inline `[ASSUMPTION]` (F-6, F-2, field-map carry-set, one-owner-per-story, cadence) is indexed and points to its Open Question or source where applicable.

Open-items density is appropriate to the stakes: four Open Questions and five assumptions on a green-light-to-build pilot, with the two highest-stakes items (Epic 6 deferral, residency) both explicitly gated to "before Epic 6 kickoff" rather than blocking the pilot cut. De-scoping is done out loud (E5-S2(e) "remaining widgets are explicitly later stories (non-goal for pilot)"). No silent de-scopes detected.

## Downstream usability — strong

For a chain-top PRD this is the make-or-break dimension and it is built for extraction. Story IDs are stable and contiguous (`E0-S1…S11`, `E1-S1…S5`, … `E6-S1…S4`), explicitly promised to "survive reorganization." The inheritance model is the standout: UC-1…UC-5 + TC are defined once and each story names its applicable subset ("*Inherits: UC-2, UC-3, UC-5, TC.*"), so a story-creation workflow can resolve every inherited AC mechanically. Cross-references resolve — UJ edge cases are wired to the ACs that satisfy them (UJ-2 edge case → E2-S3(a)/UC-3; UJ-4 edge case → E4-S1(b)), and SMs cross-reference the stories that validate them (SM-P3 → E6-S3, SM-M5 → E6-S2).

Each UJ has a named protagonist carrying context inline (Dana/tenant admin, Sam/sales, Priya/support), with a stated Climax and Edge case — no floating UJs. Domain nouns are used identically across NFRs, ACs, and SMs because the Glossary is enforced as "discipline" and the PRD even records its own additions (Conversion saga, correlationId, Repository seam) "in the same pass, per Glossary discipline." Sections largely stand alone via Glossary terms rather than "see above."

### Findings
- **low** A few ACs reference shared concepts by prose rather than Glossary term — e.g. E1-S3(c) "documented reassignment rule" and E3-S2(c) "shared Tasks/Workflow" (the latter appears as bare prose, not a Glossary entry). *Fix:* add "Tasks/Workflow (shared)" to the Glossary or NFR-1's shared-capability list so the term resolves the same way `Repository seam` and `Customer` do.

## Shape fit — strong

The shape matches the product. As a chain-top, multi-stakeholder B2B CRM, UJs with named protagonists are correctly load-bearing (§2.3) and the constitution-as-NFR lift (§4.1) plus ADR-by-reference baseline (§4.2) is the right move for a reference implementation whose payoff is conformance traceability. The Epic → Feature → Story structure with an Epic 0 governing contract is fit-for-purpose for feeding architecture and story creation, and the document is neither over-formalized (the UJ count is five and each drives ACs) nor under-formalized (every NFR has a downstream-testable consequence). Epic 6 being carved out as production-only, with its own "Why its own epic" justification, correctly keeps the pilot cut honest. No forcing into a mismatched template detected.

## Mechanical notes

- **ID continuity:** Story IDs contiguous and unique across all epics (E0-S1…S11, E1-S1…S5, E2-S1…S4, E3-S1…S3, E4-S1…S4, E5-S1…S3, E6-S1…S4). UC-1…UC-5, TC, NFR-1…NFR-12, ADR-001…013, SM-P1…P5 / SM-M1…M5 / SM-C1…C3 all contiguous. Open Questions numbered 1–4.
- **Cross-refs:** Spot-checked references resolve — DEC-1/DEC-2/Flag C/F/G/H/I/J/K referenced consistently; SM-P3↔E6-S3, SM-M5↔E6-S2, UJ edge cases↔ACs all land. `.decision-log.md` referenced for DEC/Flag provenance (not verified against that file in this review).
- **Glossary drift:** Domain nouns consistent (Lead, Customer, Ticket, Subsidiary, Roll-up, Conversion saga, correlationId). Minor: "Tasks/Workflow" used in prose (E3-S2c, Epic 3/4 goals) without a Glossary entry; "activity timeline" lowercased in ACs vs Glossary "Activity timeline" — cosmetic.
- **Assumptions Index roundtrip:** All five index entries (§12) trace to inline use (F-6/§4.2-§5, F-2/§5, field-map/E3-S1, one-owner/DEC-3, cadence/SM-M1); F-6 and F-2 correctly point to Open Questions 1 and 2. No orphan index entries; no obvious un-indexed inline `[ASSUMPTION]`.
- **Required sections:** All present for a chain-top build PRD — Vision, Users/Roles/JTBD/UJs/Non-Users, Glossary, NFRs + baseline, resolved flags, Epics/Features/Stories, Non-Goals, MVP scope, Success Metrics with counter-metrics, Traceability model, Open Questions, Assumptions Index.
