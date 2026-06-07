# Adversarial Review — PRD: min-crm (2026-06-06)

Reviewer stance: cynical, hunting for what is vague, hand-wavy, self-congratulatory, untestable, or quietly contradictory. Praise is not my job.

**Verdict:** A polished, citation-heavy PRD that *reads* like it is rigorous, but a meaningful slice of its "binding" rigor is slogan, not spec — the conversion saga, the "0-change swap" proof, several success metrics, and the inherited Universal ACs all lean on phrasing that a tester cannot mechanically convert into pass/fail without inventing the missing definitions. The document's biggest risk is that it *feels* done.

---

## CRITICAL

### C-1. [critical] §6 E3-S1 — The conversion saga is a buzzword pile, not a buildable spec.
The story demands a "persisted, resumable, compensating, UI-inspectable workflow instance — not an inline function." Every one of those adjectives is unspecified:
- **Persisted where / what shape?** There is no `Saga`/`WorkflowInstance` entity in E0-S2's canonical type list. A persisted, resumable saga needs a durable state record (saga id, current step, step status, payload snapshot, compensation log). It is not in the domain kernel. So E3-S1 depends on a type that Epic 0 never authored.
- **Resumable from what trigger?** There is no server, no background runner, no scheduler in the pilot (it is a localStorage SPA). "Resumable" implies a process that can crash and be restarted — by whom, on what event, on next page load? Unspecified. In a single-tab localStorage SPA, "resumable" is close to meaningless unless defined as "on reload, detect an in-flight saga record and offer to continue," which the PRD never says.
- **Compensating steps are never enumerated.** AC (f) says a mid-saga failure "compensates/rolls back cleanly — no half-made customer." But the saga has multiple writes (create Customer, set two lineage fields, mark lead converted, emit 3 events). Which steps have compensations? If the Customer row is created and *then* the lead-update fails, the compensation must delete/soft-delete the orphan customer. None of this is specified, so "compensating" is untestable as written.
- **"UI-inspectable state"** — inspectable *where*? No screen, no component, no story ships a saga-state viewer. NFR-10's fixed UI inventory has no "saga inspector." So either this AC is unbuildable within the fixed inventory, or it is decoration.

**Fix:** Either (a) add a `ConversionSaga` entity to E0-S2 with explicit fields, enumerate the ordered steps and each step's compensation, define what "resumable" means in a single-tab SPA (e.g. "on mount, the Convert page detects an `in_progress` saga record for the lead and resumes/rolls back"), and add the inspector surface to NFR-10 / a story; or (b) drop the buzzwords and spec it honestly as "an atomic multi-write use case with snapshot-and-rollback on failure" — which is all the pilot can actually test.

### C-2. [critical] §8.2 / Epic 6 — The pilot quietly depends on the thing it claims is walled off.
The PRD insists Epic 6 (server-side trust boundary) is "explicitly out of the pilot cut," "production-only," "a dedicated build, not a swap." Yet the pilot's headline product success metric **SM-P3 ("0 cross-tenant leaks") is validated against E6-S3** — a story inside Epic 6. SM-P3 is listed under **Primary — Product**, i.e. a pilot success criterion, but its named validator lives in the explicitly-out-of-scope epic. Two readings, both bad:
- If SM-P3 is a *pilot* metric, then the pilot does depend on Epic 6 work (the isolation E2E), contradicting the wall.
- If SM-P3 is only met by Epic 6, then a *pilot-cut* success metric cannot be satisfied during the pilot, and the "primary product success" list overstates what the 2-week cut proves.

Compounding this: in the pilot, scoping/auth/validation run **client-side in the localStorage adapter** (Epic 6's own "Why its own epic" note admits this is "acceptable *only* because auth is mocked"). So the pilot's isolation guarantee is enforced by client code the user's own browser controls — a "0 cross-tenant leaks" claim that is trivially defeatable by anyone with devtools. Calling that a proven product success metric is over-claiming.

**Fix:** Split SM-P3 into SM-P3a (pilot: "the localStorage adapter's scoping E2E shows 0 leaks *given the mocked-auth threat model*") and SM-P3b (production/Epic 6: "server-enforced isolation E2E"). State explicitly that pilot isolation is not a security boundary. Move E0-S11's "cross-tenant isolation E2E scaffold" into the pilot scope honestly and stop citing E6-S3 for a primary pilot metric.

### C-3. [critical] §9 SM-M5 / E6-S2 — The "0-change repository swap" is a slogan the PRD cannot honor on its own terms.
The marquee method claim is "0-change repository swap from localStorage to a real backend" (Vision §0/§1, SM-M5, E6-S2 AC-c). But:
- The PRD *itself* says the pilot enforces **scoping, validation, and authorization inside the localStorage adapter** (E0-S4, Epic 6 note). Epic 6 says these must be **re-implemented server-side** as "net-new engineering, not an adapter swap." So the trust boundary move is explicitly *not* zero-change — yet the same trust logic currently lives in feature-adjacent client code paths. If the localStorage adapter is doing authorization, then removing it for an HttpRepository is not "diff touches only the composition root + adapter" unless every guard already lives strictly behind `Repository<T>` — which contradicts NFR-6's two-gate model where *action guards live in use cases / feature code*.
- "0 changes to feature code" is asserted as a success metric but the proof (E6-S2) sits in the out-of-scope epic, so SM-M5 is **unmeasurable within the pilot**. It is an aspiration dressed as a metric.

**Fix:** Define precisely what "feature code" excludes (guards? validation? event wiring?) and reconcile with NFR-6. Acknowledge SM-M5 is a *production-phase* metric, not a pilot outcome, and move it out of the headline method-proof claims for the 2-week cut.

---

## HIGH

### H-1. [high] §6 "inherits Epic 0" — inheritance is used to dodge stating real testable conditions.
The reading model says each story "inherits" UC-1…UC-5 "with the applicable subset named explicitly." But several stories inherit ACs that are then never grounded in the story's actual surface:
- **E1-S4 (switcher)** inherits UC-5 but its own AC (b) invents `X-Subsidiary-Id` as a *header* — in a localStorage SPA with no HTTP. That is contract cosplay: there is no wire to put a header on. Is it stored, or is it theater? Untestable as written.
- **E5-S1 (dashboard shell)** is essentially nothing but inherited ACs: "Dashboard template, four states, scoped." There is no story-specific behavior. This is a placeholder masquerading as a story; it will be marked "done" by virtue of inheriting other stories' work.
- Many stories list "four states (UC-1)" for views that have no meaningful empty/error distinction (e.g. a notifications surface, a switcher). The DoD gate (SM-P2: "100% of data views pass four-state") will be claimed green on views where empty/error are trivial or fabricated, inflating the metric.

**Fix:** For each inherited UC, require the story to state the *concrete* artifact that satisfies it (which view's empty state, which mutation's correlationId assertion). Kill or merge content-free stories like E5-S1. Define which views are genuinely "data-backed" so SM-P2 isn't gamed.

### H-2. [high] §6 E4-S1 — The customer-state ticket gate contradicts the journey and the glossary.
AC (b): "ticket creation allowed only when the customer is `active` or `onboarding`." But:
- **UJ-4** narrates Priya filing a ticket after the customer reaches **`active`**, and the edge case is "tries to file while `prospect`; blocked." UJ-4 never mentions `onboarding` being ticket-eligible. The story silently widens the gate to `onboarding` with no journey support and no rationale.
- The Vision/UJ-4 phrasing "only once the customer is ready" is fuzzy; "ready" is defined three different ways across the doc (UJ-4 implies `active`; E4-S1 says `active` or `onboarding`; the glossary's onboarding workflow walks `prospect → onboarding → active`). A tester cannot tell whether opening a ticket on an `onboarding` customer is a pass or a fail.

**Fix:** Pick one definition of "ready," state it once (glossary + E4-S1 + UJ-4 must agree), and justify whether `onboarding` is eligible. As written the gate is testable only after someone resolves the contradiction by fiat.

### H-3. [high] §9 Method metrics (SM-M1…M4) are aspirational and largely unfalsifiable.
- **SM-M1 "~one story per member in 2 weeks"** — hedged into meaninglessness by Assumption §12 ("a target… not a fixed scope commitment") and by DEC-3's "no fixed N." A metric with no denominator and no commitment cannot pass or fail.
- **SM-M2 "rework rate ~0"** — "few/zero stories reopened for standards violations." Who decides a reopen counts as "standards" vs "normal iteration"? No baseline, no instrument. With a small N (one pilot), this is anecdote, not measurement.
- **SM-M3 "handoff quality"** — "any developer finds the same patterns." Measured how? By vibe. There is no rubric, no sampling method, no pass threshold.
- **SM-M4 "traceability intact"** — the only genuinely measurable one (the `Closes #` chain either exists or doesn't), and even it relies on humans maintaining `sprint-status.yaml` and issue links faithfully.

These are the *reason for the pilot* (per §1) yet four of five are unfalsifiable. A method-proof pilot whose method metrics can't fail isn't proving anything.

**Fix:** Give each method metric an instrument and a threshold (e.g. SM-M2: "# of PRs reverted/reopened citing a UC violation, captured as a GitHub label; target ≤1"). If a metric can't be instrumented in a 1-team pilot, demote it from "success metric" to "qualitative retrospective note."

### H-4. [high] §9 Counter-metrics are stated as principles, not metrics.
SM-C1/C2/C3 are "do not optimize X" exhortations with no number, no detector, no review gate. A real counter-metric has a measurable ceiling ("if cyclomatic novelty / # of one-off components > 0, fail review"). As written they are virtue statements — "don't be clever," "don't pad features" — that cannot catch a violation. They counterbalance nothing measurable.

**Fix:** Turn each into a checkable gate: SM-C1 → "feature count frozen at the §8.1 list; any new entity/page requires a decision-log entry." SM-C3 → "bmad-code-review flags any component outside the NFR-10 inventory; count must be 0."

### H-5. [high] §4 NFR-7 vs §6 stories — "exactly one audit + exactly one domain event per mutation" collides with multi-write stories.
NFR-7 / UC-2 mandate **exactly one** AuditEvent and **exactly one** DomainEvent per mutation, same correlationId. But:
- **E3-S1 AC (e)** emits **`Lead.Converted` + `Customer.Created`** (two domain events) "+ audit" sharing one correlationId. That is two domain events for the conversion. Is conversion "one mutation" (violating "exactly one DomainEvent") or several mutations (then they shouldn't share one correlationId under a strict reading)? The doc wants both and the rule can't hold both.
- **E3-S2 AC (d)** emits "`Customer.Updated` (+ `StatusChanged` semantics)" — is that one event or two? "(+ … semantics)" is hand-waving around the one-event rule.

**Fix:** Define correlationId scope explicitly: one correlationId per *user-initiated operation* (which may span multiple mutations, each with its own audit+domain event pair), vs. "exactly one per mutation." The conversion saga forces this distinction; resolve it in NFR-7 rather than leaving each story to fudge it.

---

## MEDIUM

### M-1. [medium] §6 UC-2 "assertable in tests" is asserted but the assertion helper is hand-waved.
E0-S7 AC (d) promises an "assertable test helper" for one-audit-one-domain-event. Good — but no story defines what counts as "one mutation" for the helper to scope its assertion (see H-5). Without that boundary the helper can't be written. The plumbing-as-demo claim rests on this helper actually existing and being correct.

**Fix:** Specify the helper's contract (given an operation closure, assert exactly N audit + N domain events with matching correlationId) and define operation granularity.

### M-2. [medium] §6 E1-S3 — "reassign orphaned records per the documented reassignment rule" cites a rule that is not in the PRD.
Offboarding soft-deletes a subsidiary and "reassign[s] orphaned leads/customers/tickets per the documented reassignment rule." There is no such rule anywhere in the document or glossary. Reassign to whom — the parent? Another subsidiary? The admin? This is the single most consequential data-integrity operation in Epic 1 and it points at a document that doesn't exist.

**Fix:** Write the reassignment rule inline (target scope, owner reassignment, what happens to in-flight tickets) or cite the artifact that contains it.

### M-3. [medium] §6 UC-4 / E3-S1 "re-conversion blocked" is under-specified at the boundary.
UC-4 says a `converted` lead is "terminal/read-only; re-conversion blocked." But the lead status enum (glossary) includes `converted` as a normal status and Lead Status "can cycle (disqualified→contacted)." What enforces that `converted` is terminal — the transition map (LEAD_TRANSITIONS) or the saga guard? If LEAD_TRANSITIONS still allows `converted → contacted` (revive), the "terminal" claim is false. E0-S1 lists LEAD_TRANSITIONS as authored but never states `converted` is terminal in the map.

**Fix:** State explicitly in E0-S1 that `converted` has no outbound transitions, and that UC-4 is enforced by the transition map (not just saga code).

### M-4. [medium] §4 NFR-5 / §6 E1-S4 — REST-contract cosplay in a serverless pilot is asserted as parity but never validated against a real contract.
NFR-5 says the localStorage adapter "honors the REST contract" and "returns these shapes/codes." But there is **no published REST contract document** referenced — no OpenAPI spec, no endpoint list beyond "`/api/v1`, plural nouns." "Mirrors the REST contract exactly" (NFR-4) is unverifiable when the contract being mirrored isn't written down. The `Idempotency-Key on create` and `X-Subsidiary-Id` header behaviors have no consumer in a localStorage adapter, so "parity" is self-graded.

**Fix:** Reference or commit the REST/OpenAPI contract the adapter mirrors; otherwise SM-M5's "mechanical swap" has nothing to be mechanical *against*.

### M-5. [medium] §1 / §0 "the plumbing IS the demo" and "audit-as-feature" — earned only if the timeline is actually load-bearing, which the stories under-build.
The signature claim is that the activity timeline is "simultaneously a headline user feature and the compliance backbone." But the timeline stories (E2-S4, E3-S3, E4-S4) only require rendering events "in time order" with four states. No filtering, no actor/role attribution display rules beyond "follows the matrix," no diff/before-after rendering, no pagination for a long history. A compliance backbone that can't filter or page is a list. The slogan over-claims relative to the spec'd surface.

**Fix:** Either add the features that make "compliance backbone" true (filter, before/after, export, pagination) or soften the claim to "a chronological activity feed derived from the audit log."

### M-6. [medium] §5 F-2 / §11 — A "resolved flag" that still says `[CONFIRM with customer]` is not resolved.
§5 is titled "Resolved Flags & Decisions" and F-2 is presented as resolved to tenant-grain, but the same line carries `[CONFIRM with customer]` and Open Question 2 re-opens it. It is simultaneously resolved, assumed, and open. That is three states for one decision.

**Fix:** Move F-2 to Open Questions outright, or mark it "provisionally resolved pending customer confirmation" and stop listing it under settled decisions.

### M-7. [medium] §2.2 Permission matrix — footnoted ambiguities and untestable cells.
- "Leads — view: support — ¹" with footnote "support is lead-blind" — the cell shows `—` but the dual nature (the row above shows `view` for viewer) makes the support row visually ambiguous; a developer encoding "the matrix as data, cell-by-cell" (E0-S6) has to interpret footnotes, not data.
- "View audit/events: sales/support = `own`" — "own" is undefined. Own records? Records they touched? Records they own as `ownerId`/`assigneeId`? E4-S4 AC (c) repeats "own" without defining it. Untestable.
- "Delete (soft)/export: restricted" — "restricted" is not a permission value. Restricted to what?

**Fix:** Replace `own` and `restricted` with explicit predicates (e.g. `own = AuditEvent.actorId == userId OR record.ownerId == userId`). The matrix must be encodable without prose interpretation, since E0-S6 unit-tests it cell-by-cell.

---

## LOW

### L-1. [low] §0 / §6 "structural DoD" — earned phrase, but partly rhetorical.
Calling the DoD "structural" implies it can't be bypassed. But TC requires "passes `bmad-code-review`" — a review step that is a human/agent judgment, not a structural gate. A DoD that includes a subjective review is not purely structural.

**Fix:** Distinguish the structural gates (tests, four-state lint, preview-deploy green) from the judgment gate (code review) so "structural DoD" isn't oversold.

### L-2. [low] §6 E5-S3 / E4-S3 — Notifications "consume the shared Notifications capability (NFR-1)" but no Notifications kernel is built in Epic 0.
Epic 0's six features build domain, repo, auth, events, UI, flags/testing. There is no Notifications kernel. E5-S3 then "consumes the shared Notifications capability" that was never authored, and E4-S3 "triggers the in-app notification." Either notifications are an ad-hoc feature build (contradicting "consume shared capability") or a kernel is missing from Epic 0.

**Fix:** Add a minimal Notifications capability to Epic 0, or state E5-S3 builds it (and stop calling it "shared/consumed").

### L-3. [low] §3 Glossary — "Conversion saga" definition smuggles the unbuilt machinery.
The glossary defines Conversion saga as "the persisted, resumable, compensating workflow instance… UI-inspectable state, not an inline function." Putting the unspecified claims (see C-1) into the *glossary* and declaring the glossary "verbatim, must be used exactly" elevates undefined buzzwords to binding vocabulary. Now every downstream artifact must repeat terms that aren't specified.

**Fix:** Keep the glossary definition descriptive ("the workflow that performs Conversion; see E3-S1 for its contract") and put the binding behavior in E3-S1 once C-1 is fixed.

### L-4. [low] §6 E2-S3 vs Glossary — "revive" path naming/scope mismatch.
E2-S3 allows `disqualified → contacted` (revive). Glossary says Lead Status "can cycle (disqualified→contacted)." Consistent — but E2-S3 AC (a)'s illegal example is `new → qualified`, while the glossary also implies `new → disqualified` may be legal; the full LEAD_TRANSITIONS map is never shown, so reviewers can't confirm the state machine. The transition maps are the spine of UC-3 and are never printed.

**Fix:** Print the three transition maps (LEAD/CUSTOMER/TICKET) explicitly in E0-S1 or an appendix; UC-3 is untestable against an unstated map.

### L-5. [low] §1 "0-change repository swap from localStorage to a real backend" — phrasing overstates even the intended claim.
The intended claim (E6-S2) is "0 changes to *feature* code; the diff touches the composition root + adapter." The Vision drops "feature" and says "0-change repository swap," which a reader takes as "no changes at all." That's false on the doc's own terms (Epic 6 is net-new server engineering).

**Fix:** Always qualify as "0-change to feature code."

---

## Severity counts
- **Critical:** 3 (C-1, C-2, C-3)
- **High:** 5 (H-1…H-5)
- **Medium:** 7 (M-1…M-7)
- **Low:** 5 (L-1…L-5)
- **Total:** 20 findings

## Bottom line
The PRD's discipline is real in the parts that are mechanical (transition maps, dual-event helper, traceability chain) and theatrical in the parts that carry the marketing weight (the saga, the 0-change swap, the method metrics, "the plumbing IS the demo"). The three criticals all share one root cause: the document narrates capabilities (resumable saga, server-grade isolation, zero-change swap) that physically cannot be demonstrated in a single-tab, mocked-auth, localStorage pilot, then lists them as *primary* proofs. Fix by honestly partitioning pilot-provable claims from production-only claims, and by replacing buzzword ACs with enumerated steps, entities, and instruments.
