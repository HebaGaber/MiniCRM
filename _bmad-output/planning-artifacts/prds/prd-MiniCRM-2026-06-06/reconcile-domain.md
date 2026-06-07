# Reconcile: PRD ↔ Domain-Vocabulary Research

**PRD:** `prd-MiniCRM-2026-06-06/prd.md` §3 Glossary + §6 stories
**Source:** `domain-crm-domain-vocabulary-research-2026-06-06.md` §6.1 Glossary + §6.2–6.6 reconciled rules
**Reconciled:** 2026-06-06

## Verdict

The PRD §3 Glossary is a faithful verbatim lift of research §6.1 for 24 of 26 entries. The one
*intentional* deviation (Customer → 5-state DEC-1) is handled cleanly and annotated. Two entries
carry **unannounced verbatim drift** (the research's `⚠️` status markers were silently edited/dropped,
not declared as deviations). All nine reconciled rules from §6.2–6.6 are reflected in the PRD body.
No dropped or distorted rule found; the discrepancies are confined to glossary-annotation hygiene.

---

## Gaps / Discrepancies

### D1 — SLA pause glossary definition silently altered (verbatim-glossary drift)
**Severity: Medium** (glossary discipline; the PRD explicitly forbids non-verbatim edits to §3)
- **Source (§6.1):** "*SLA pause* — The resolution/response clock **stops while a ticket is `pending`** (awaiting customer/3rd party). **⚠️ not yet encoded.**"
- **PRD (§3):** "...awaiting customer/3rd party). **Documented vocabulary; timers out of pilot scope (flag D).**"
- **Nature:** The trailing status clause was rewritten. The substantive definition (clock stops while `pending`) is preserved verbatim; only the editorial status marker changed. The replacement text is *more accurate* for the PRD (flag D resolved SLA timers as out-of-scope vocabulary), and flag D is correctly carried in story E4-S2 and §7/§8. But §3's own rule says the table is "lifted verbatim" with deviations requiring a decision-log entry — this edit is undeclared. Low-risk, but it is drift relative to the stated verbatim contract.

### D2 — Inheritance/override glossary trailing note dropped (verbatim-glossary drift)
**Severity: Medium** (same glossary-discipline class as D1)
- **Source (§6.1):** "*Inheritance / override* — ...Precedence `subsidiary > tenant > system`, **deny-wins**. **⚠️ precedence not yet specified in constitution.**"
- **PRD (§3):** "...Precedence `subsidiary > tenant > system`, **deny-wins**." (trailing `⚠️` clause removed)
- **Nature:** Definition body is verbatim; the "⚠️ precedence not yet specified" status flag was dropped. Again defensible — the PRD *does* now specify precedence (E0-S10 AC-b, ADR-011, flag H) so the warning is stale — but the removal is undeclared under the verbatim contract. Consistent with D1; both are the research's `⚠️` provenance markers being scrubbed without a deviation note.

### D3 — Customer 5-state deviation: clean, but the only declared one (confirmation)
**Severity: Low / informational** (no defect; confirms intended behavior)
- **Source (§6.1):** "*Customer* — ...Status `active / inactive / churned` (⚠️ see §6.5-C)."
- **PRD (§3):** "*Customer* — ...Status `prospect / onboarding / active / inactive / churned` (DEC-1; supersedes the research note's 3-state aside)."
- **Nature:** This is the intentional DEC-1 deviation and it is handled **cleanly**: the PRD annotates it inline ("DEC-1; supersedes the research note's 3-state aside"), it resolves research conflict-flags A/B (which the research itself flagged 🔴 High and said "cannot ship undefined"), and it is consistently propagated to E0-S1 (`CUSTOMER_TRANSITIONS` newly authored), E3-S2 (`prospect → onboarding → active`, reactivation, churned terminal), and NFR-3. Confirmed: this is the only *intentional* glossary deviation, and it is the correct resolution of the research's biggest open conflict. D1 and D2 are *un*intentional drift by contrast — they should arguably be annotated the same way (or a decision-log note added) to keep the verbatim contract honest.

### D4 — Reconciled-rules coverage check: all nine present (confirmation, no gap)
**Severity: Low / informational**
Verified each research reconciliation is faithfully reflected in the PRD body:
- **Lead two-axis simplification / qualified = MQL+SQL (§6.2, flag K):** Glossary MQL/SQL + Lead Status verbatim; story E2-S3 AC-d ("`qualified` is a manual judgment call, flag J/K"). ✅
- **BANT as manual judgment (flags J/K):** E2-S1 AC-e ("BANT captured as a free judgment note — no scoring engine, flag J"); §8.2 ("BANT as structured fields … manual judgment note only"). ✅
- **Conversion-only-from-`qualified` guard (§6.2, §2.4):** UC-4 + E3-S1 AC-a (re-conversion blocked; `converted` terminal/read-only). ✅
- **Ticket `closed` terminal recommendation (flag C):** NFR-3, E0-S1 AC-b, E4-S2 AC-a ("`closed` is terminal — reopen only `resolved → open`, Flag C"). PRD **adopts** the research recommendation (research had `closed → open` as the conflicting prior standard). ✅
- **SLA-pause-as-vocabulary (flag D):** Glossary SLA pause + E4-S2 AC-c ("`pending` documented as SLA-pause state — no timer engine, flag D"). ✅ (see D1 re: glossary annotation)
- **Priority-not-severity (§6.4):** Glossary Priority/Severity verbatim; E4-S1 AC-d ("severity is not a field, vocabulary only"). ✅
- **Roll-up as read-only (§4.2):** Glossary Roll-up verbatim ("Never a cross-boundary write"); E1-S5 AC-b, E5-S2 AC-b. ✅
- **Config precedence subsidiary>tenant>system deny-wins (flag H):** E0-S10 AC-b, ADR-011, NFR-6 deny-wins. ✅ (see D2 re: glossary annotation)
- **Offboard reassignment (flag I):** E1-S3 AC-c ("reassign orphaned leads/customers/tickets per the documented reassignment rule") + AC-b soft-delete. ✅

No rule was dropped or distorted. Flags E (support lead-blind) and F (sales read-only on tickets)
also correctly carried in §2.2 footnotes and E2-S1/E4-S1.

---

## Summary table

| ID | Discrepancy | Source | PRD | Severity |
|---|---|---|---|:--:|
| D1 | SLA pause def: `⚠️ not yet encoded` → `flag D` rewrite | §6.1 | §3 | Med |
| D2 | Inheritance def: `⚠️ precedence not specified` note dropped | §6.1 | §3 | Med |
| D3 | Customer 5-state (DEC-1) — intentional, cleanly annotated | §6.1 / §6.5-A/B | §3 | Low (confirm) |
| D4 | All 9 reconciled rules present and faithful | §6.2–6.6 | §6 | Low (confirm) |

**Net:** Glossary is verbatim except the one declared DEC-1 deviation (clean) and two undeclared
`⚠️`-marker edits (D1, D2 — cosmetic-but-contract-violating). All business rules reconciled in the
research are correctly reflected. Recommend annotating D1/D2 or adding a decision-log note so the
"§3 is verbatim" claim holds literally.
