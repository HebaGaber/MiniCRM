# Conformance Audit — PRD min-crm vs. Engineering Constitution

**Auditor:** conformance auditor
**Date:** 2026-06-06
**Scope:** Does the PRD faithfully lift the constitution (`project-context.md`) as NFR-1…NFR-12, and does it bake UC-1…UC-5 + TC into every story correctly?
**Files audited:**
- PRD: `_bmad-output/planning-artifacts/prds/prd-MiniCRM-2026-06-06/prd.md`
- Constitution: `_bmad-output/project-context.md`

**Verdict:** Substantially faithful. The 12 NFRs are accurate lifts and the four signature contracts (4-beat, dual streams, 404-not-403, optimistic+rollback, STATUS_TONE-only) are all preserved. The defects are in UC *inheritance* on individual stories — several mutating stories omit UC-3, a status-change story omits UC-3's own AC, and the conversion story over-claims UC-3 vs. needing it; plus one genuine permission-matrix contradiction and a verbatim-claim overstatement.

---

## 1. CONTRACT FIDELITY — NFR-1…NFR-12 vs. Constitution §1–§10

| NFR | Constitution § | Faithful? | Notes |
|---|---|---|---|
| NFR-1 layering | §1 | Yes | One-direction deps, shared-never-imports-product, `Customer` shared-consumed-not-owned — all present (prd:140). |
| NFR-2 base entity | §2.1 | Yes | All 9 BaseEntity fields enumerated incl. `version` starts at 1, soft delete (prd:141). |
| NFR-3 status | §3 | Yes | Single source, no hardcoded strings, 422 reject, emits StatusChanged, DEC-1 + Flag-C named (prd:142). |
| NFR-4 repo / 4-beat | §4 | Yes | **4-beat `authorize→mutate→emit→audit` preserved** (prd:143). |
| NFR-5 API parity | §5 | Yes | `/api/v1`, plural nouns, Page<T>, error envelope, Idempotency-Key (prd:144). |
| NFR-6 authZ / 2 gates | §6 | Yes | **404-not-403 rule preserved**; scope from auth context never props (prd:145). |
| NFR-7 dual streams | §7 | Yes | **Dual event streams, exactly-one-each, one correlationId, canonical names** preserved (prd:146). |
| NFR-8 logging/PII | §7.4 | Yes | Structured JSON, mask emails/phones, no tokens (prd:147). |
| NFR-9 4 states / optimistic | §8.1 | Yes | **Optimistic + snapshot-and-rollback preserved**; fault-injection toggle (prd:148). |
| NFR-10 UI inventory / tokens | §8 | Yes | **STATUS_TONE-only colors preserved**; fixed inventory; ConfirmDialog for destructive/convert (prd:149). |
| NFR-11 folders / naming | §9 | Yes | Folder tree and naming conventions reproduced (prd:150). |
| NFR-12 testing | §10 / ADR-013 | Yes | Vitest/RTL/Playwright; covers transitions, Zod, 4 states, rollback, cross-tenant E2E (prd:151). |

### [low] NFR-3 narrows §3.2 to "status.ts" but constitution enforces transitions "in the service layer"
- **Location:** prd:142 vs. constitution §3.2 (line 102: "state machines — enforced in the service layer") and §3 line 89.
- **Problem:** NFR-3 says statuses are "defined once in `shared/domain/status.ts` with allowed transitions." The constitution defines the *data* in status.ts but states transitions are *enforced* in the service layer. NFR-3's phrasing is fine, and E0-S1 AC(d) restores the `canTransition` helper "the service layer uses," so this is covered downstream — flagging only because the NFR sentence alone could read as "status.ts enforces."
- **Fix:** None required; E0-S1 AC(d) closes it. Optionally add "enforced in the service/use-case layer" to NFR-3.

### [low] NFR-5 omits the explicit `/{id}/transition` endpoint and 201+Location/204 codes
- **Location:** prd:144 vs. constitution §5.3 (lines 196–205).
- **Problem:** NFR-5 says "standard methods/codes" generically; the constitution's §5.3 table names a dedicated `POST /{id}/transition` action and specific success codes (201+Location on create, 204 on delete). The localStorage adapter story E0-S4 AC(f) says "REST-shaped envelopes and status codes (NFR-5)" but neither NFR-5 nor any story names the transition endpoint or 201/204 explicitly.
- **Fix:** Add the transition endpoint and create/delete success codes to NFR-5 or E0-S4's ACs so the adapter contract is unambiguous.

**Nothing dropped, softened, or contradicted at the NFR level on the four signature contracts.** All four are intact.

---

## 2. UC INHERITANCE — story-by-story walk (E0-S1 … E6-S4)

Rule set applied (from constitution + UC defs prd:188–193):
- Mutates → **UC-2** (dual events). Any status change → **UC-3**. Conversion → **UC-4**. Data view → **UC-1**. Anything scoped → **UC-5**.

| Story | Claimed UCs | Mutates? | Status chg? | Convert? | Data view? | Verdict |
|---|---|---|---|---|---|---|
| E0-S1 | TC | no (pure defs) | defines maps | — | no | OK |
| E0-S2 | TC | no (type defs) | — | — | no | OK |
| E0-S3 | UC-5, TC | no (interface) | — | — | no | OK |
| E0-S4 | UC-2, UC-3, UC-5, TC | yes | yes (enforces) | — | — | OK |
| E0-S5 | UC-2, TC | yes (auth events) | — | — | — | OK |
| E0-S6 | UC-2, UC-5, TC | emits RoleDenied | — | — | — | OK |
| E0-S7 | UC-2, TC | yes | — | — | — | OK |
| E0-S8 | TC | no | — | — | no | OK |
| E0-S9 | UC-1, TC | no | — | — | renders states | OK |
| E0-S10 | TC | no | — | — | no | OK |
| E0-S11 | UC-1…UC-5, TC | harness | — | — | — | OK (codifies all) |
| E1-S1 | UC-1, UC-5, TC | no (read/scope) | — | — | yes | OK |
| E1-S2 | UC-1, UC-2, UC-5, TC | yes | — | — | yes (EntityForm) | OK |
| E1-S3 | UC-1, UC-2, UC-5, TC | yes (soft-del+reassign) | — | — | yes | OK |
| E1-S4 | UC-5, TC | sets scope only | — | — | switcher | **see [medium] below** |
| E1-S5 | UC-1, UC-5, TC | no (read model) | — | — | yes | OK |
| E2-S1 | UC-1, UC-2, UC-5, TC | yes (create) | — | — | yes | OK |
| E2-S2 | UC-1, UC-5, TC | no | — | — | yes | OK |
| E2-S3 | UC-2, UC-3, UC-5, TC | yes | yes | — | — | OK |
| E2-S4 | UC-1, UC-5, TC | edit/transition actions | **yes (transition actions)** | — | yes | **see [high] below** |
| E3-S1 | UC-1…UC-5, TC | yes | yes (lead→converted, cust=prospect) | yes | yes | **UC-3 over-claim — see [medium]** |
| E3-S2 | UC-2, UC-3, UC-5, TC | yes | yes | — | — | OK |
| E3-S3 | UC-1, UC-5, TC | no | — | — | yes | OK |
| E4-S1 | UC-1, UC-2, UC-5, TC | yes (create) | — | — | yes | OK |
| E4-S2 | UC-2, UC-3, UC-5, TC | yes | yes | — | — | OK |
| E4-S3 | UC-2, UC-5, TC | yes (assign) | no | — | — | OK |
| E4-S4 | UC-1, UC-5, TC | no | — | — | yes | OK |
| E5-S1 | UC-1, UC-5, TC | no | — | — | yes | OK |
| E5-S2 | UC-1, UC-5, TC | no (read model) | — | — | yes | OK |
| E5-S3 | UC-1, UC-5, TC | no (consumes events) | — | — | yes | OK |
| E6-S1 | UC-2, UC-3, UC-5, TC | yes | yes | — | — | OK |
| E6-S2 | TC | no (infra swap) | — | — | no | OK |
| E6-S3 | UC-5, TC | no (E2E) | — | — | — | OK |
| E6-S4 | UC-2, TC | infra | — | — | no | OK |

### [high] E2-S4 (Lead detail + activity timeline) performs transitions but does NOT claim UC-3 (or UC-2)
- **Location:** prd:330–332.
- **Problem:** AC(a) gives the DetailPage "edit/transition actions." Performing an edit is a mutation (needs UC-2) and a transition is a status change (needs UC-2 + UC-3). The story inherits only `UC-1, UC-5, TC`. By the PRD's own rule (any mutation → UC-2; any status change → UC-3), this story silently needs UC-2 and UC-3 it doesn't claim. (One could argue transitions are "performed by E2-S3," but the AC explicitly puts transition actions on this screen.)
- **Fix:** Either (a) add `UC-2, UC-3` to E2-S4's inherited set, or (b) reword AC(a) to "links to the E2-S3 transition action" so the mutation provably lives in E2-S3, not here. Recommend (a) for safety.

### [medium] E1-S4 (Switcher) writes scope state but claims no UC-2; acceptable, but the boundary is fuzzy
- **Location:** prd:296–298.
- **Problem:** Selecting a subsidiary "sets `X-Subsidiary-Id` scope." This is view-state, not a persisted entity mutation, so omitting UC-2 is defensible. But the story ships a UI surface (the switcher) without claiming UC-1 four-states. The switcher itself isn't a *data-backed view* (it lists the token's own subsidiaries from auth context), so UC-1 is arguably not required — flagging as a boundary call for the architect to confirm.
- **Fix:** Confirm the switcher's subsidiary list is sourced from auth claims (no async fetch). If it fetches, add UC-1.

### [medium] E3-S1 (Conversion saga) claims UC-3 but UC-3 does not strictly apply; the real guard is UC-4
- **Location:** prd:344, inherited set `UC-1, UC-2, UC-3, UC-4, UC-5`.
- **Problem:** UC-3 = "illegal transition outside the transition map → 422." The conversion moves the lead `qualified → converted` (a legal LEAD_TRANSITIONS edge) and creates a customer in `prospect` (a create, not a transition). The lead-side legality ("only from qualified, re-conversion blocked") is precisely **UC-4**, which is already claimed. So UC-3 is over-claimed here unless the saga also exposes a generic transition path. This is the inverse defect of E2-S4: a UC claimed where it doesn't cleanly apply. Low harm (extra coverage), but it muddies the "named subset is exact" discipline the PRD asserts (prd:182, 186).
- **Fix:** Drop UC-3 from E3-S1 (UC-4 covers conversion legality), or add an AC clarifying which generic status transition on E3-S1 triggers UC-3.

### [low] E0-S5 mutates auth state but only emits audit via UC-2 — no DomainEvent counterpart for some auth events
- **Location:** prd:234; constitution §7.2 canonical list (lines 275–280) does list `Auth.*` as domain events.
- **Problem:** UC-2 requires *one AuditEvent + one DomainEvent*. Auth events (`Auth.LoggedIn` etc.) are in the canonical domain-event registry, so pairing is possible and the claim is consistent. No defect — noted to confirm the auth kernel emits the domain-event half, not audit-only.
- **Fix:** None; verify in E0-S5/E0-S7 implementation.

---

## 3. STATUS MACHINE CONSISTENCY — story maps vs. §3.2

| Map | Constitution §3.2 | PRD story | Match? |
|---|---|---|---|
| LEAD | new→{contacted,disqualified}; contacted→{qualified,disqualified}; qualified→{converted,disqualified}; disqualified→{contacted}; converted→{} | E0-S1, E2-S3 (`new→qualified` illegal; `disqualified→contacted` revive) | **Exact** (prd:209, 328) |
| CUSTOMER (DEC-1) | prospect→{onboarding}; onboarding→{active}; active→{inactive,churned}; inactive→{active,churned}; churned→{} | E3-S2 AC(b): "prospect→onboarding→active, active↔inactive, active/inactive→churned, churned terminal" | **Exact** (prd:350) |
| TICKET (Flag C) | open→{in_progress,pending,closed}; in_progress→{pending,resolved,open}; pending→{in_progress,resolved}; resolved→{closed,open}; closed→{} | E0-S1, E4-S2: "closed terminal, reopen only resolved→open" | **Exact** (prd:209, 374) |

### [low] UJ-4 narrative implies a happy-path `open → in_progress → resolved → closed` that omits the legal `open → pending` and `pending → resolved` edges
- **Location:** prd:82 (UJ-4) vs. §3.2 TICKET_TRANSITIONS.
- **Problem:** Narrative only, not an AC. It walks `open → in_progress → resolved → closed`, all legal. No illegal transition is implied. E4-S2 AC(a) correctly binds the full map. No defect — confirming UJ-4 implies no illegal transition.
- **Fix:** None.

**No story implies an illegal transition.** All three maps in stories match §3.2 exactly.

---

## 4. TRACEABILITY — TC chain + story-ID set

### TC wiring
- **Wired:** §10 (prd:496–506) defines story→spec→code→test→issue and ties it to §10 DoD + `Closes #`, `sprint-status.yaml`, `bmad-code-review`, preview-deploy green. Matches constitution §10 (lines 349–359). UC/TC definition at prd:193 reproduces the DoD bullets faithfully. **TC is genuinely wired.**

### Story-ID set — contiguity & uniqueness
Enumerated IDs: E0-S1…S11 (11), E1-S1…S5 (5), E2-S1…S4 (4), E3-S1…S3 (3), E4-S1…S4 (4), E5-S1…S3 (3), E6-S1…S4 (4). Total **34 stories**.

- **No duplicates.** Every `E<n>-S<n>` is unique.
- **Contiguous within each epic** (S-numbers run 1..k with no gaps) for E0–E6.

### [medium] Two ACs reference success metrics whose IDs are defined but one TC artifact is asserted, not yet creatable
- **Location:** E5-S3/E4-S3 reference "feeds Epic 5" notification; E6-S2 cites SM-M5, E6-S3 cites SM-P3 — all defined in §9. Consistent.
- **Problem:** None on IDs. The only traceability soft spot: TC requires `Closes #<issue>` but no story carries an actual issue number (expected — issues are created downstream). This is by design (prd:498 "ready to map onto a GitHub issue").
- **Fix:** None; flagging that SM-M4 ("intact chain for every shipped story") is unverifiable until issues exist — out of PRD scope.

**Traceability: clean. Contiguous, unique, TC wired.**

---

## 5. PERMISSION MATRIX — story role-gates vs. §2.2 (and §2.2 vs. constitution §6.2)

### Story gates vs. PRD §2.2 — all consistent
- E1-S2/E1-S3/E1-S5 `tenant_admin`-only (onboard/offboard/roll-up) → matches §2.2 rows "Onboard/offboard subsidiaries" and "Cross-subsidiary roll-up view" (admin-only). **OK** (prd:288, 292, 304).
- E2-S1 leads create = `sales`/`tenant_admin` → matches "Leads — create/edit/convert" (admin✅ sales✅). **OK** (prd:316).
- E4-S1 tickets create = `support`/`tenant_admin`, "sales read-only on tickets" (flag F) → matches §2.2 Tickets create row (sales —²). **OK** (prd:368).
- E4-S4 timeline: "viewer sees timelines within scope; sales/support = own" → matches §2.2 "View audit/events" (admin✅ sales own support own viewer —). **Minor tension below.**
- Support lead-blind (flag E) → §2.2 "Leads — view" gives support —¹. No story grants support any lead access. **OK.**

### [high] CONTRADICTION: Constitution §6.2 grants `viewer` READ on tickets/customers/leads; PRD §2.2 grants viewer "view" but the constitution row for Tickets-viewer says "read" while §6.2 has NO audit/events for viewer — consistent — BUT §6.2 grants `support` READ on Customers and `sales` READ on Tickets, which PRD §2.2 splits into separate view rows. The real contradiction is narrower — see exact cells:
- **Location:** constitution §6.2 (lines 229–236) vs. PRD §2.2 (prd:50–62).
- **Constitution §6.2 "Leads: create/edit/convert" → viewer = `read`.** PRD §2.2 "Leads — create/edit/convert" → viewer = `view`, and adds a separate "Leads — view" row = viewer ✅. Consistent in spirit.
- **The genuine mismatch:** Constitution §6.2 has **no `viewer` column entry for "View audit/events"** beyond `—` (viewer cannot view audit/events). PRD §2.2 keeps viewer `—` on audit/events (prd:61) — **consistent**. BUT E4-S4 AC(c) says "`viewer` sees timelines within scope" (prd:384). The activity timeline renders `AuditEvent`s + `DomainEvent`s (E4-S4 AC(a)). Since viewer is `—` on "View audit/events" in BOTH matrices, **granting viewer the audit/event-backed timeline contradicts the permission matrix.**
- **Problem:** E4-S4 lets `viewer` read a surface built from audit+domain events, while both §2.2 and §6.2 deny viewer audit/event visibility.
- **Fix:** Either (a) carve out that the *activity timeline* is a domain-event projection distinct from the raw "audit/events" capability and explicitly permit viewer in §2.2, or (b) remove viewer from E4-S4 AC(c). This needs an explicit decision-log entry per constitution line 3.

### [medium] PRD §2.2 adds rows/columns not present in constitution §6.2 (expansion without a logged deviation)
- **Location:** PRD §2.2 (prd:50–62) vs. constitution §6.2 (lines 229–236).
- **Problem:** PRD §2.2 is labeled "lifted verbatim from brief addendum §A" (prd:46) — i.e., it is lifted from the *brief*, not the constitution. It is **richer** than constitution §6.2: it adds "Onboard/offboard subsidiaries," "Cross-subsidiary roll-up view," separate "view" rows per entity, "Delete (soft)/export," and the flag E/F footnotes. Constitution §6.2 is the coarser 5-row version. These do not *contradict* §6.2 (the finer matrix is a superset), but the PRD claims the constitution is "fixed" and NFRs only "lift" it (prd:26). The matrix is lifted from the brief addendum, which is a legitimate source — but the relationship to §6.2 should be stated so a reader doesn't think §6.2 was silently expanded.
- **Fix:** Add a one-line note in §2.2 reconciling it with constitution §6.2 (e.g., "expands §6.2 with brief-addendum §A detail; no row contradicts §6.2"). Confirm the addendum is a settled artifact.

### [low] §6.2 "Customers: edit" gives `support` = read; PRD §2.2 "Customers — view" gives support ✅, "create/edit" gives support — 
- **Location:** constitution line 233 vs. prd:57–58. **Consistent** (support can view, not edit). No defect.

### [low] "Tickets — view" gives `viewer` ✅ in PRD §2.2 (prd:60); constitution §6.2 "Tickets: create/edit/assign" gives viewer = read
- **Consistent** (viewer reads tickets). No defect.

---

## Findings summary (by severity)

| Severity | Count | Findings |
|---|---|---|
| **critical** | 0 | — |
| **high** | 2 | E2-S4 missing UC-2/UC-3 on transition actions; E4-S4 grants `viewer` an audit/event-backed timeline that §2.2/§6.2 deny |
| **medium** | 4 | E1-S4 switcher UC-1 boundary; E3-S1 over-claims UC-3 (UC-4 is the real guard); §2.2 expands §6.2 without a reconciling note; SM-M4 chain unverifiable pre-issues (informational) |
| **low** | 6 | NFR-3 "service-layer enforcement" wording; NFR-5 omits transition endpoint + 201/204 codes; UJ-4 narrative happy-path; E0-S5 auth domain-event pairing; two consistent matrix cells confirmed |

**Most important findings (priority order):**
1. **[high] E2-S4** performs edit/transition mutations but inherits only UC-1/UC-5/TC — silently needs UC-2 and UC-3 (prd:330–332).
2. **[high] E4-S4** grants `viewer` the activity timeline, which is built from AuditEvents+DomainEvents, while both PRD §2.2 and constitution §6.2 deny viewer audit/event visibility — needs a decision-log entry (prd:384 vs. prd:61 / constitution line 235).
3. **[medium] E3-S1** over-claims UC-3; the conversion-legality guard is UC-4 (already claimed). Trim UC-3 to keep the "named subset is exact" discipline (prd:344).
4. **[medium] §2.2** is lifted from the brief addendum and is a superset of constitution §6.2; add a reconciling note since the PRD asserts NFRs only "lift" the fixed constitution (prd:46 vs. prd:26).
5. **[low] NFR-5** does not name the `POST /{id}/transition` endpoint or the 201+Location/204 success codes from constitution §5.3; tighten the adapter contract (prd:144).

**The four signature contracts are all intact:** 4-beat use-case (NFR-4), dual event streams + one correlationId (NFR-7), 404-not-403 (NFR-6), optimistic+rollback (NFR-9), STATUS_TONE-only colors (NFR-10). All three status maps (LEAD/CUSTOMER/TICKET) match §3.2 exactly. Story IDs are contiguous and unique (34 stories). TC is genuinely wired in §10.
