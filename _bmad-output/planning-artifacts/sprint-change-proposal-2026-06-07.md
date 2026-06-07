---
title: Sprint Change Proposal — Reconcile the Claude Design prototype into story ACs
date: 2026-06-07
owner: Heba
author: correct-course (BMad)
mode: batch
status: approved — conflicts ratified 2026-06-07 (C-1 adopt · C-2 keep · C-3 adopt · C-4 adopt)
scope_guard: "Backlog stories only (all E0–E5 are backlog). Epic 6 (server-side, no UI) untouched."
sources:
  - prototype/prototype-behavior.md (current-state, evidence-graded; code = source of truth)
  - prototype/tokens/motion.css · prototype/tokens/colors_and_type.css
  - prototype/screenshots/* (visual oracle)
  - _bmad-output/project-context.md (constitution — BINDING)
  - _bmad-output/planning-artifacts/ux-designs/ux-MiniCRM-2026-06-06/{DESIGN,EXPERIENCE,§8-binding-rules,.decision-log}.md
  - _bmad-output/planning-artifacts/architecture.md
  - _bmad-output/planning-artifacts/epics/** (E0–E5)
classification: Moderate (backlog AC enrichment + UX-spine consistency; 4 conflicts escalated for decision)
---

# Sprint Change Proposal — Prototype → Story-AC reconciliation

## Section 1 — Issue Summary

The **Claude Design prototype** (`prototype/`, `prototype-behavior.md`, `prototype/tokens/*`, `prototype/screenshots/*`)
is now built and is, per the change brief, the **UX source of truth** alongside the UX spine
(DESIGN.md / EXPERIENCE.md / §8) and the constitution.

The pilot stories (E0–E5) were written **architecture-first**: they nail the seams, the 4-beat,
the event/audit split, the status maps, the four-state contract, and RBAC — but they were
authored **before** the prototype settled the concrete UX (exact fields & order, columns,
filter/sort controls, empty/error/loading microcopy, motion choreography, the saga inspector
layout, the customer-state gates, the dashboard widget). As a result an implementer reading a
story today would build a *conformant* screen that is **not pixel-/behavior-identical** to the
prototype.

This proposal closes that gap **without weakening the architecture**: every story keeps its stable
ID and its existing implementation-ready ACs; we **append** a *"UX & Behavior (from prototype)"*
block capturing the realized UX, update the UX spine/decision-log for the interactions the
prototype settled, and **escalate (not silently overwrite) the handful of places the prototype
contradicts the constitution** for Heba's decision.

**Evidence discipline (inherited from `prototype-behavior.md` §0.2):** the prototype's JSX is the
behavioral source of truth; screenshots are cited as a *visual oracle* by filename. Two known
drifts are honored — the **`PREVIEW STATE` segmented control** visible in named screenshots is
**disabled in current code** (`StateSwitcher` returns `null`; screens render their real
store-derived state), and the **old KPI-card dashboard** in `01-scope.png` / `01-flows.png` is
**dead** (overwritten by the conversion-funnel `dashboard.jsx`). Enrichment follows the code, not
the drifted frames.

## Section 2 — Impact Analysis

| Artifact | Impact |
|---|---|
| **Stories (E0–E5)** | ~22 UI-bearing stories get an appended **UX & Behavior (from prototype)** block. Stable IDs preserved. No existing AC text deleted. |
| **UX spine** (DESIGN.md / §8-binding-rules / EXPERIENCE.md) | **Consistency edits**: motion *easing* values realized in `prototype/tokens/motion.css` differ from the spine's `[ASSUMPTION]` curves; reduced-motion rule realized differently; OQ3 dashboard widget settled = **conversion funnel**. |
| **Decision-log** | New entries: DEC-UX-7 (OQ3 = conversion funnel), DEC-UX-8 (motion easing realized → point at `prototype/tokens/motion.css`), DEC-UX-9 (reduced-motion realized rule). |
| **Constitution** (`project-context.md`) | **No silent edits.** Four conflicts (C-1…C-4) are escalated; constitution wins until Heba rules. If Heba adopts any, a decision-log entry + a §-amendment follows. |
| **Epic 6** | Untouched (server-side, no UI) — per scope guard. |
| **Architecture / code** | None in this change (planning-layer only). |

---

## Section 3 — GAP REPORT (per epic, per story)

Legend: **[ENRICH]** = additive UX detail to append · **[CONFLICT]** = prototype contradicts the
constitution/transition-map/role-matrix (escalated, see §4) · **[SETTLED]** = prototype resolved an
open question (consistency update).

### Epic 0 — Platform Guidelines (UI-bearing stories only)

- **E0-S1 / S2 / S3 / S4 / S6 / S7 / S8 / S10 / S11** — non-UI kernels. **No UX block.** (E0-S6 is
  where the role-matrix conflicts C-1/C-2 land — see §4; the *grant table*, not a screen.)
- **E0-S5 — mock SSO.** [ENRICH] Prototype realizes a **two-panel SSO** with a **4-role demo picker**
  (cards: Tenant admin / Sales agent / Support agent / Viewer — icon, label, description, radio),
  a fixed email (`sara.khan@northwind.com`, not an input), an "Active scope on landing" strip, and
  the **"Continue with SSO"** CTA that sets role+scope and lands on Dashboard. Per-role landing
  scope (admin→whole tenant, sales→EU, support→US, viewer→EU) and the per-role identity map
  (admin→Sara Khan, sales→Marco Ruiz, support→Lena Bauer, viewer→Ivo Petrov). Login is **single
  ready state** (no four-state). Current story has none of this concrete UX.
- **E0-S9 — component inventory.** [ENRICH] The biggest gap. Prototype realizes the concrete
  behavior of every shared component: `AppShell` (collapsing 248↔64px sidebar with role-gated
  grouped nav, topbar = ScopeSwitcher · decorative ⌘K search · NotificationsBell · UserMenu);
  `DataTable` (keyboard rows, `aria-sort`, active-row brand-soft + inset bar, internal four states);
  `StatusPill` (TONES map, dot/icon + **always a text label**, tone-only color); `Toast`
  (bottom-center, max-3, success auto-dismiss ~4s, danger/error persist); `ConfirmDialog`/`ModalShell`
  (overlay `rgba(15,22,38,0.42)`+blur, `crm-pop` enter, focus-trap, safe-control default focus);
  `EmptyState`/`ErrorState`/`Skeleton` (skeleton mirrors layout, ErrorState = `cloud-off` panel +
  Retry). [CONFLICT C-4] Prototype also ships a **`RecordPager`** (Gmail-style prev/next + "N of M"
  + Side/Full view toggle, keyboard `↑↓←→ j k Esc`) and a **side-by-side list+detail view** —
  components/layouts **not in the §8.3 inventory**; NFR-10 forbids inventing layouts.
- **E0-S12 — notifications kernel.** [ENRICH] The realized surfaces the scaffold must support:
  **topbar bell** (unread `--iso-danger` badge, dropdown newest-first, per-item unread dot, "Mark
  all as read", "View all →"), **dashboard notifications card**, and a full **Notifications page** —
  all reading one model, newest-first, unread tinted `--iso-blue-3-50`, persist-until-read, empty =
  "You're all caught up" (`bell-off`), four states.

### Epic 1 — Tenancy & Subsidiary

- **E1-S1 — tenant context / isolation.** [ENRICH] The **scope re-query skeleton** (`setScope` sets
  `scopeLoading` then clears after ~`base`+220ms — every scoped screen shows the loading state on a
  scope change) and the **404 `NotFoundView`** (calm "Not found in this workspace", `compass` glyph,
  eyebrow "404 · not found", body explains the record isn't in `<scopeName>`, single **"Back to
  <scopeName>"** — *never a permission warning*, cross-tenant 404 never leaks existence). Current AC
  states the rule; prototype provides the exact surface + copy.
- **E1-S2 — onboard subsidiary.** [ENRICH] `OnboardForm` modal: fields **Subsidiary name** (req),
  **Parent** (select: "Top-level (no parent)" + active subs); info strip "inherits the tenant
  configuration by default."; optimistic create; OutcomePicker Success/Server-error → on error the
  row is removed ~700ms + **persistent danger toast "Couldn't onboard — rolled back"** + Retry.
- **E1-S3 — offboard subsidiary.** [ENRICH] `OffboardDialog` (danger ConfirmDialog): **impact
  preview** (counts of *active* Leads/Customers/Tickets that must move — terminal states excluded),
  required **"Reassign active records to"** (another active sub or "Parent level (shared)"),
  **"Simulate a mid-batch failure"** toggle, progress bar `done/total` ~`max(90, base/2)`/record.
  Success toast `"<sub> offboarded. N active records reassigned to <target>."`; mid-batch fault at
  ~60% → **nothing committed**, persistent danger toast `"Reassignment failed mid-batch — rolled
  back. No records moved. <sub> is still active."` + **Try again**, dialog closes. Initial focus =
  **safe** Cancel; `Esc` **suppressed while running**.
- **E1-S4 — switcher.** [ENRICH] `ScopeSwitcher` chip = tenant over scope; **locked (`lock` icon,
  title "Scope is fixed for your role")** for scopeFixed roles; admin chevron opens dropdown:
  **"Whole tenant (roll-up)"** (`layers`) then each active sub (`building-2` + region subline,
  check on active), `crm-pop` at `base`/`decelerate`. Offboarded subs vanish; if current scope
  offboarded → snap to tenant.
- **E1-S5 — roll-up.** [ENRICH] `RollupPage` read-only aggregate table: columns **Subsidiary ·
  Leads · Customers · Tickets · Total** (tabular numerals), **"Tenant total"** footer (grand total
  in brand color), header **"Read-only"** lock pill. Tenant scope lists every active sub + **"Parent
  level (shared)"** row; single-sub scope shows that sub + parent with copy "Sibling subsidiaries
  are not shown." Empty "Nothing to roll up yet"; error "Can't load roll-up" + retry. Footer link
  "open a record from another workspace ↗" → the **404** view (edge-case hook).

### Epic 2 — Leads

- **E2-S1 — capture.** [ENRICH] `LeadForm` modal fields **in order**: Name (req), Company, Email
  (format-validated if present), Phone, **Source** (req select: Web/Referral/Event/Outbound/Import),
  **Owner** (req select, 4 lead owners), **BANT note** (textarea, help "budget, authority, need,
  timing. Free text, not a score."). Submit disabled until valid; focus jumps to first errored
  field; inline errors with `alert-circle`. Optimistic create → status `new`, toast **"Lead
  captured · <name> created in status 'new'"**, redirect to detail; Server-error path removes draft
  ~700ms + persistent rollback toast + Retry.
- **E2-S2 — list/filter.** [ENRICH] Columns **Name (avatar+name) · Company · Source · Status (pill)
  · Owner · Updated (right-aligned)**. **Dropdown** FilterBar: Status (all lead statuses) · Owner ·
  **Clear** link when active. Sort any column header (asc/desc, default `updated desc`), live count
  **"X of Y · sorted by <col> ↑/↓"**, free-text over name/company/owner, **URL-reflected**
  (`?tab=leads&q=&status=&owner=&sortCol=&sortDir=&page=`). 25/page numeric pager w/ ellipses.
  Kebab row actions: write → Open / "Assign to me" / Delete(danger); read-only → Open. Five states:
  loading / empty ("No leads in this scope yet" + scope line, create CTA auto-focused if role can
  create) / **filtered-empty** ("No matches" + "Clear filters") / error / ready. *(Drift: `01-edge.png`
  shows old chip filters + "Columns" button — superseded by dropdowns; no Columns button.)*
- **E2-S3 — lifecycle.** [ENRICH] The **`ChangeStatusControl`**: button **disabled when terminal**
  (title "<Status> is terminal — read-only"); dropdown lists **only legal next states** as pills
  with `→` under "Move this lead to"; **illegal states shown but locked** (`lock`, `cursor:not-allowed`,
  under "Not available from <Status>"); attempting one → inline **warning panel** with *rule + next
  legal step* — **no pill tone change, no toast, no event** (422 discipline). Legal move appends a
  timeline sentence + pill tone cross-fade at `fast`.
- **E2-S4 — detail + timeline.** [ENRICH] Header: breadcrumb (Leads › name), back, title, **lead
  pill**, role-gated **Edit** (ghost) · **Change status** · **Convert** (primary, only when
  `qualified`); read-only roles → **"Read-only"** pill. Two-column body: left = details grid (Name,
  Company, Email, Phone, Source, Owner) + **BANT note** block + **Activity** card (`RecordTimeline`,
  "Newest first"); right = Owner ("Single owner") + Meta (Scope, Created, Last updated, Lead ID).
  Timeline entries = bold actor + sentence + relative time (absolute on hover) + connector;
  conversion entries carry a green **"Lineage"** tag.

### Epic 3 — Conversion & Customer

- **E3-S1 — conversion saga.** [ENRICH] `ConversionInspector` = **DetailPage variant, in-page, not
  elevated**. Entry = ConfirmDialog ("Convert this lead? … creates a customer in prospect, links
  lineage both ways, and locks the lead as converted." / confirm **"Start conversion"**). Five
  ordered steps **Guard · Create customer · Link lineage · Lock lead · Emit**, each pending(neutral)
  → current(info, spinner, advancing ~`base`+60ms) → done(success, check); connector turns green.
  Right rail = **field map** (Name, Company, Email, Phone, Source, Owner, BANT note) + note "Activity
  history is **linked**, not copied". Overall pill **Converting… (info) → Converted (success)** or
  **Rolling back… (warning) → Failed (danger)**. Success: header **"Open customer"**, panel
  "Customer <name> created in prospect…", toast "Lead converted · Customer '<name>' created in
  prospect." **Failure** (`Simulate fault` selector: at create-customer / at link-lineage / 409 at
  lock-lead): steps **reverse top-down** ("Reversing", warning) ~`base`+80ms → **Failed**, **no
  half-made customer**, lead **still `qualified`**, header **"Try again"**; generic toast
  *"Conversion failed — rolled back. No customer was created; the lead is still qualified."* (oracle:
  `saga-failed.png`), **409** toast *"Record changed — conversion stopped. This lead changed while
  converting. Refresh and try again."* Ineligible entry → calm EmptyState "This lead can't be
  converted" + reason (no saga). Oracle: `saga-done.png`, `saga-failed.png`.
- **E3-S2 — onboarding + activation gate.** [ENRICH] transitions via `ChangeStatusControl`.
  [CONFLICT C-3] Prototype **gates `onboarding → active` on a precondition**: the customer must have
  **both a Tax registration number and a Contact address**; otherwise inline 422 *"Add a tax
  registration number and contact address before activating this customer. Edit the customer to fill
  it in, then activate."* — **no pill change, no event**. The constitution's `CUSTOMER_TRANSITIONS`
  treats `onboarding→[active]` as **unconditional**, and §2.2 `Customer` has **no** such fields.
- **E3-S3 — customer list/detail.** [ENRICH] List columns **Account (building+name) · Status (pill)
  · Primary email · Phone**. Detail: header pill + role-gated Edit/Change status (read-only →
  "Read-only"). Left = details grid (Name, Primary email, Phone, **Tax registration number**,
  **Contact address** [C-3]) + **tabbed card**: **Activity** (`RecordTimeline` interleaving lineage
  + status + ticket lifecycle; lineage="Lineage", ticket="Ticket" tags) / **Tickets** (count badge,
  "New ticket for this customer" if allowed, list w/ status+priority pills). Right rail = **Lineage**
  card ("Converted from lead <name>" green button → originating lead, or 404 if out of scope; else
  "No originating lead — created directly.") + Owner + Meta. Oracle: `cust-detail.png`.

### Epic 4 — Ticketing & Timeline

- **E4-S1 — create + customer-state gate.** [ENRICH] `TicketForm` fields: **Customer** (req select —
  in-scope customers labeled "<name> · <Status>"), **Subject** (req), **Description** (textarea),
  **Priority** (req: Low/Medium/High/Urgent). Customer-state gate: picking a non-`active`/non-`onboarding`
  customer → inline **warning panel** + **disabled submit** ("This customer is <status>. A ticket can
  be opened only when the customer is active or onboarding — move the customer to active first.").
  Info strip "New tickets open in status 'open' and inherit the customer's subsidiary. The assignee
  defaults to that subsidiary's support agent — reassign from the ticket." On create: inherits
  `subsidiaryId`, **default assignee = sub's support person**, audit `ticket.create`, **notifies the
  assignee** if not the actor. [CONFLICT C-1] Prototype's **"New ticket" CTA is available to *every*
  role** (`canCreate('ticket')===true`, incl. sales & viewer) — contradicts E4-S1 AC1
  (support/tenant_admin only; sales read-only; viewer denied) and constitution §6.2.
- **E4-S2 — lifecycle.** [ENRICH] `ChangeStatusControl` (legal-only + locked illegal, 422 inline).
  Detail header = status pill + **priority pill**. **`pending` = "SLA paused"** chip on the details
  card + transition sentence "moved this ticket to pending (SLA paused)". Tones per `STATUS_TONE`;
  each accepted move logs `ticket.transition`.
- **E4-S3 — assign.** [ENRICH] `AssignControl` dropdown = support users **in the ticket's scope**
  (parent-scope tickets see all); choosing reassigns, logs `ticket.assign`, notifies new assignee,
  toast **"Ticket reassigned · <user> was notified."** Detail right rail = Assignee card ("Single
  assignee").
- **E4-S4 — timeline + audit log.** [ENRICH] **Activity timeline** = `RecordTimeline`, newest-first,
  kind tags ("Lineage" green / "Ticket" info); interleaves lineage + lifecycle on a customer.
  **Audit log** (`AuditLog`, top-level "Audit & events") = **dark "Raw audit log" banner** stating
  the matrix gate ("All records across the tenant" admin / "Only records you acted on" agents) +
  **"Compliance"** tag; columns **Timestamp (tabular) · Actor · Action (tone pill+icon) · Record &
  change (`before`→`after` code chips, before neutral / after green-soft) · Scope**; Action+Entity
  dropdown filters, "N records" count; viewer = none (nav hidden). Oracle: `audit.png`.

### Epic 5 — Dashboard & Notifications

- **E5-S1 — shell.** [ENRICH] Realized layout = **two columns** under a header eyebrow "<ROLE> ·
  <SCOPE>" + title "Dashboard" + line "A cross-subsidiary read of the tenant. Widgets are derived
  and read-only." (admin) — **left = widget column, right = Notifications card**. Re-queries on
  scope change via `scopeLoading`. Oracle: `dashboard.png`.
- **E5-S2 — read-model widget.** [SETTLED — OQ3] The prototype **chose the conversion funnel** (not
  the per-subsidiary roll-up). Five derived, read-only stages with horizontal bars + counts —
  **New · Contacted · Qualified · Converted · Active customers** — scope-aware, **"Derived ·
  read-only"** lock pill, footer "Aggregated across every subsidiary" (tenant) / "Scoped to <scope>
  — sibling subsidiaries are not counted." + a labeled placeholder slot ("More widgets — later
  stories. Only the conversion funnel ships now."). Empty "No activity in this scope yet". Oracle:
  `dashboard.png` (New 4 · Contacted 4 · Qualified 3 · Converted 1 · Active 6). → DEC-UX-7.
- **E5-S3 — inbox/bell.** [ENRICH] Three surfaces, one model (bell dropdown · dashboard card · full
  page): newest-first, unread tinted `--iso-blue-3-50` + dot, "Mark as read"/"Mark all as read",
  relative time (absolute on hover), persist-until-read, empty "You're all caught up" (`bell-off`),
  four states. Bell badge = unread count in `--iso-danger`.

### Cross-cutting (motion / tokens / states) — for every UI story

- [SETTLED] **Motion tokens are realized in `prototype/tokens/motion.css`** with the *named* tokens
  `--crm-instant 0` · `--crm-fast 120` · `--crm-base 200` · `--crm-slow 320` and easings
  `--crm-ease-standard` / `--crm-ease-decelerate` (= DS `--iso-ease-out`) / `--crm-ease-accelerate`,
  plus a `--crm-travel` scalar. **Durations match the spine; easing curves differ** from DESIGN.md's
  `[ASSUMPTION]` values → DEC-UX-8. Reduced-motion realized as base/slow→120ms, travel→0 → DEC-UX-9.
- [ENRICH] Every enriched block names the binding motion beats: optimistic apply `instant`; pill
  tone cross-fade `fast`; skeleton→ready / dialog & switcher enter / saga step `base`; **rollback
  snap-back `slow`**.

---

## Section 4 — CONFLICTS (constitution wins until Heba decides)

> These are the items the prototype **contradicts** in the constitution / a transition map / the
> role matrix. Per the change brief they were **escalated, not silently overwritten**.
>
> **RATIFIED 2026-06-07 (Heba):** **C-1 adopt** · **C-2 keep constitution** · **C-3 adopt** ·
> **C-4 adopt**. Constitution amendments logged in `_bmad-output/decision-log.md` as **DEC-CC-1**
> (ticket create = all roles), **DEC-CC-2** (customer activation gate + `taxRegistrationNumber`/
> `contactAddress`), **DEC-CC-3** (`RecordPager` + Side-view added to the §8.3 inventory). Affected
> stories updated; conflict tags flipped from `⚠️` to `✅ RESOLVED`.

### C-1 — Ticket creation role gate (role matrix)
- **Prototype:** "New ticket" is available to **every role** (`canCreate('ticket') === true` for
  admin, sales, support, **and viewer**). Tickets are "the one entity anyone can raise."
- **Constitution §6.2** *(Tickets: create/edit/assign)*: tenant_admin ✅, **sales = read**, support ✅,
  **viewer = read**. **E4-S1 AC1** is explicit: create = support/tenant_admin only; *sales read-only
  (flag F)*; viewer denied.
- **Decision:** keep the constitution (support/admin only) **or** amend §6.2 + E4-S1 to let all roles
  create tickets.

### C-2 — Support editing customers (role matrix)
- **Prototype:** `canWrite` customers = **admin / sales / support** (support can edit customers and
  drive their status).
- **Constitution §6.2** *(Customers: edit)*: tenant_admin ✅, sales ✅, **support = read**, viewer =
  read.
- **Decision:** keep the constitution (support read-only on customers) **or** amend §6.2 to grant
  support customer-edit (note: support still needs *read* + the customer-state transition for
  onboarding regardless — clarify which capability you intend).

### C-3 — Customer activation gate + two new Customer fields (entity + transition map)
- **Prototype:** adds **`taxRegistrationNumber`** and **`contactAddress`** to the customer, and
  gates **`onboarding → active`** on *both* being present (inline 422 otherwise).
- **Constitution:** §2.2 `Customer` has **neither field**; §3.2 `CUSTOMER_TRANSITIONS` makes
  `onboarding→[active]` **unconditional**; E3-S2 has no precondition. `Customer` is a **shared**
  capability (§1) — adding fields is a **shared-API change**.
- **Decision:** adopt (add the two fields + an activation precondition gate, logged as a shared-API
  change, analogous to the ticket customer-state gate) **or** keep the constitution (drop the gate +
  fields from the prototype's behavior). *Recommend adopt — it is a coherent, valuable business
  rule — but it must be a logged constitution amendment, not implicit.*

### C-4 — `RecordPager` + side-by-side ("Side view") (fixed inventory / NFR-10)
- **Prototype:** a Gmail-style **`RecordPager`** (prev/next chevrons, "N of M · <noun>", Side/Full
  toggle, Close; keyboard `↑↓←→ j k Esc`) and a **side-by-side list+detail** layout persisted in
  `localStorage('crm-view-mode')`.
- **Constitution §8.2/§8.3:** the **fixed** template set is ListPage/DetailPage/EntityForm/Dashboard
  and the §8.3 component inventory — **no RecordPager, no split-view layout**; NFR-10 forbids
  inventing new layouts/one-off components.
- **Decision:** add `RecordPager` + the side-view mode to the §8.3 inventory (approve as an
  inventory extension, update E0-S9) **or** drop them from scope to honor NFR-10.

### Minor / defaulted (not escalated unless you object)
- **C-5 (minor):** ticket detail shows a static **"Channel: Email"** field; `Ticket` (§2.2) has no
  `channel`. **Default applied:** treat as a decorative/static label (no entity field) in
  enrichment. Flip to a real field on request.
- **Default assignee on create (E4-S1):** prototype defaults the new ticket's assignee to the
  subsidiary's support agent and notifies them. Captured as enrichment; consistent with single
  `assigneeId` — flag if you'd rather tickets start unassigned.

---

## Section 5 — CONSISTENCY changes (settled by the prototype — applied to the UX spine)

1. **DEC-UX-7 — OQ3 resolved = conversion funnel.** E5-S2's "funnel OR roll-up" open question is
   settled by the prototype to the **conversion funnel** (5 stages). Logged; E5-S2 enriched to the
   funnel; per-subsidiary roll-up remains available as the separate **E1-S5 Roll-up** surface.
2. **DEC-UX-8 — Motion easing realized.** DESIGN.md frontmatter + §8.6 easing curves were tagged
   `[ASSUMPTION]`; the prototype realized them in `prototype/tokens/motion.css`
   (`standard cubic-bezier(0.4,0,0.2,1)`, `decelerate = --iso-ease-out`, `accelerate cubic-bezier(0.4,0,1,1)`).
   Spine updated to **reference `prototype/tokens/motion.css`** as the realized source; durations
   unchanged (match).
3. **DEC-UX-9 — Reduced-motion realized.** `motion.css` collapses `--crm-travel→0` and flattens
   `base`/`slow` to `120ms` (fast stays 120, instant 0) — all state changes/feedback still fire.
   Spine's `motion.reduced` rule reconciled to the realized behavior.

Tokens continue to point at `prototype/tokens/*` (motion authored; color/type consumed from the DS).

---

## Section 6 — Recommended approach & handoff

**Recommended path: Direct Adjustment (additive AC enrichment) + UX-spine consistency, with 4
conflicts escalated.** No rollback, no MVP re-scope — the architecture stories are sound; they were
simply UX-thin.

- **Scope classification: Moderate** — backlog AC enrichment + spine/decision-log updates (no code),
  plus 4 constitution conflicts requiring an owner decision before any are folded back.
- **Sequence:** (1) apply additive enrichment + spine consistency now (this proposal's edits);
  (2) collect C-1…C-4 decisions; (3) for each *adopted* conflict, fold a logged amendment into
  `project-context.md` + the affected story AC and the decision-log.
- **Routed to:** Heba (PO/owner) for C-1…C-4 and OQ3 ratification → then Dev for implementation
  against the enriched stories. No PM/Architect re-plan needed.
- **Success criteria:** an implementer building any E0–E5 screen from the enriched story reproduces
  the prototype's fields/columns/controls/states/microcopy/motion **without consulting the
  prototype**, and no screen silently violates the constitution.

---

*Deliverables produced alongside this proposal: enriched story files (UX & Behavior blocks),
updated DESIGN.md / §8-binding-rules.md / EXPERIENCE.md + decision-log, and this gap report +
conflict list.*
