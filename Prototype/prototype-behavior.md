# min-crm — Prototype Behavior (Current State)

**Scope:** `./prototype` only — the Claude Design output (`app/*.jsx`, `tokens/*.css`, `screenshots/*.png`).
**Purpose:** Document the *actual realized* UX & behavior of the prototype, organized by module so it maps to the epics. This is a **current-state** record, not a proposal — nothing here recommends changes.
**Generated:** 7 Jun 2026 · BMad `document-project` (deep-dive, scoped).

> **Read this as evidence-graded.** The primary source of truth for behavior is the JSX in `app/`. Screenshots in `screenshots/` are cited as visual evidence by filename. Where a screenshot disagrees with current code, the code wins and the discrepancy is flagged inline (see [§0.2](#02-screenshot-provenance--known-drift)).

---

## 0. How the prototype is built (read first)

### 0.1 Architecture of the prototype
- **Pure client-side React 18 UMD + Babel-in-browser.** No build step. `Shell.html` loads React/ReactDOM/Babel-standalone/lucide from unpkg, then the `app/*.jsx` files as `<script type="text/babel">`.
- **Load order matters** (`Shell.html:69-86`): `config → store → components_core → components_data → shell → templates → dashboard → shared_records → forms → tenancy → leads → conversion → customers → tickets → audit → gallery → login → app`. Each file assigns its exports onto `window`, so later files override earlier ones (see drift note on `DashboardPage`).
- **One in-memory external store** (`store.jsx`), surfaced via `React.useSyncExternalStore`. Persistence is in-memory only — no `localStorage`, no backend. A page refresh re-seeds.
- **Scope-aware, single-tenant seed.** Tenant = "Northwind Trading" with subsidiaries `eu` (Frankfurt), `us` (Chicago), `apac` (Singapore, nested under `eu`), plus a synthetic `parent` ("Parent level / shared") bucket.
- **"Server" is faked** through `setTimeout` + an in-form **OutcomePicker** ("Simulate server response: Success / Server error") and **Simulate fault** selectors. There is no network.

### 0.2 Screenshot provenance / known drift
The `screenshots/` set spans more than one design iteration. Two families exist:
- **Numbered frames** (`01-*`, `02-*`, `03-*`, `04-*`) are **early iterations**. They show UI the current code no longer renders: chip-style filter bars ("All / Assigned to me / Open / At risk"), a "Columns" button, and the **old KPI-card dashboard**. `01-roles.png` actually depicts the **Component inventory/gallery**, and `01-scope.png` / `01-flows.png` depict the **old KPI dashboard** — their filenames do not reliably indicate content.
- **Named frames** (`dashboard.png`, `cust-detail.png`, `saga-done.png`, `saga-failed.png`, `ticket-gate.png`, `sideview.png`, `audit*.png`) are **closer to the current build**.

Two drifts apply to **every named screenshot**, because they predate the latest code:
1. **Preview-state segmented control** ("PREVIEW STATE · Loading / Empty / Error / Ready") is visible in the screenshots' page headers. In current code this control is **disabled**: `StateSwitcher` returns `null` (`templates.jsx:15-17`, comment: *"preview-state control removed — screens render their real state"*). Screens now render their *real* store-derived state only.
2. **Dashboard** in `01-scope.png` / `01-flows.png` is the KPI-card version (`templates.jsx` `DashboardPage`), which is **overwritten** at load time by the conversion-funnel version (`dashboard.jsx`, loaded later). `dashboard.png` shows the funnel version — the one that actually renders.

---

## 1. Shell / Login (Epic 0 — shell)

### 1.1 Login — mock SSO (`login.jsx`)
A two-panel SSO sign-in. Left panel is the system's **single decorative gradient** (`--iso-gradient-blue`) with the wordmark, the headline *"The CRM your agents actually trust."*, and three principle chips: **Scope always visible · Audit-as-feature · Deny-wins, felt gracefully**. Footer: `Northwind Trading · 3 subsidiaries · ISO 27001`.

Right panel = **role picker (demo)**. Four selectable role cards, each with icon, label, description, and a radio check:

| Role | Icon | Description | Landing scope |
|---|---|---|---|
| Tenant admin | `shield-check` | Full access · can switch subsidiary or view the roll-up | Whole tenant (roll-up) |
| Sales agent | `user-plus` | Leads, customers & tickets · pinned to one subsidiary | EU subsidiary |
| Support agent | `life-buoy` | Tickets & customers · pinned to one subsidiary | US subsidiary |
| Viewer | `eye` | Read-only · view leads, customers, tickets & timelines | EU subsidiary |

- **Email field** is hardcoded (`sara.khan@northwind.com`) and not rendered as an input — only the role selection drives sign-in.
- An info strip echoes **"Active scope on landing: <scope>"** for the selected role.
- Primary CTA: **"Continue with SSO"** (`building-2` lead icon). On click → `signIn(roleId)`: sets the role, sets scope (`fixedScope` for pinned roles, else `tenant`), lands on Dashboard.
- **States:** single ready state. No loading/empty/error on login.

### 1.2 App shell layout (`app.jsx`, `shell.jsx`)
CSS grid: `[logo | topbar]` row (64px) over `[sidebar | main]`. Sidebar width animates `248px ↔ 64px` (collapsed) via `transition: grid-template-columns var(--crm-base) var(--crm-ease-standard)`. App background `--iso-blue-3-50`.

**Sidebar (`Sidebar`)** — role-gated, grouped nav. Groups: **Workspace** and **Tenancy**, plus a pinned-to-bottom **Build** group with a "Components" gallery entry. Active item paints `--iso-brand` background, white text; nav items transition `color` at `--crm-fast`. Collapse toggle is the hamburger by the wordmark. Evidence: `dashboard.png`, `sideview.png`, `01-edge.png` (Leads active), `ticket-gate.png` (Tickets active).

**Topbar (`Topbar`)** — left to right:
- **ScopeSwitcher** (see [§2.1](#21-scope-switcher-shelljsx)).
- **Search box** — placeholder *"Search records, tickets, people…"* with a `⌘K` hint chip. **Non-functional** (decorative; focus only toggles border/focus-ring). Evidence: every shell screenshot.
- **NotificationsBell** — bell with unread count badge (`--iso-danger`), opens a dropdown of the current user's notifications (newest first), "Mark all as read", per-item unread dot, and a "View all notifications →" footer. `dashboard.png`/`cust-detail.png` show the badge "2".
- **UserMenu** — avatar + name + role, dropdown with email, **"Switch role (demo)"** (live role switch without re-login), "View all notifications", and "Sign out".

**Per-user identity mapping** (used for notifications/audit/timeline actor): `tenant_admin → Sara Khan`, `sales_agent → Marco Ruiz`, `support_agent → Lena Bauer`, `viewer → Ivo Petrov`. (Note: the audit/timeline `actor` map in `app.jsx` `ACTOR_OF` maps `viewer → Sara Khan`, while shell `USER_OF` maps `viewer → Ivo Petrov`; viewer is read-only so this rarely surfaces.)

### 1.3 Record navigation (Gmail-style) (`app.jsx`, `shared_records.jsx` `RecordPager`)
When a record is opened from a list, the list's **ordered, filtered/sorted ids** are carried so the detail view supports **prev/next paging** that respects the active filter/sort. The **RecordPager** sticky bar exposes: prev/next chevrons, `"N of M · <noun>"`, a **Side/Full view toggle**, and a Close (`x`) button.
- **Keyboard nav** (only when a record is open and no modal): `↑`/`←`/`k` = prev, `↓`/`→`/`j` = next, `Esc` = close. Suppressed while focus is in an input/textarea/select.
- **Side view** renders the list (left, scrollable, with the open row highlighted) beside the detail panel (right). Persisted in `localStorage('crm-view-mode')`. Evidence: `sideview.png` (`2 of 4 · Leads`, Lina Fält open beside the scoped list).

---

## 2. Tenancy (Epic — tenancy)

### 2.1 Scope switcher (`shell.jsx`)
- Chip shows tenant name over the current scope name. For **scopeFixed roles** (sales/support/viewer) the chip is **disabled** and shows a `lock` icon with title *"Scope is fixed for your role"*. For admin it shows `chevrons-up-down` and opens a dropdown.
- Dropdown options: **"Whole tenant (roll-up)"** (`layers` icon) then each **active** subsidiary (`building-2`, region as subline). Active option carries a check. Dropdown enters with `crm-pop` at `--crm-base`/`decelerate`.
- **Switching scope** calls `Store.setScope`, which sets `scopeLoading: true`, then clears it after `~--crm-base + 220ms` — this is the **skeleton→data re-query** every scoped screen honors.
- Offboarded subsidiaries disappear from the switcher (`activeSubs`). If the current scope is offboarded, scope snaps back to `tenant`.

### 2.2 Subsidiaries list (`tenancy.jsx` `SubsidiariesPage`) — admin only
- **Columns:** Name (icon + name; offboarded rows render at 0.55 opacity with an "Offboarded" pill), Parent (parent name or "Top-level"), Region, Created (right-aligned).
- **Toolbar:** a (non-wired) search + an **"Include offboarded"** toggle that reveals soft-deleted subsidiaries.
- **Row actions:** active rows → "Offboard subsidiary" (`log-out`, danger tone); offboarded rows → "Offboarded — read only" (`lock`, inert).
- **Primary action:** "Onboard subsidiary".
- **States:** `loading` (skeleton via shared `DataTable`), `empty` (icon `network`, "No subsidiaries yet", primary action auto-focused), `error` (retry), `ready`. Empty only triggers when no active subs and "include offboarded" off.

### 2.3 Onboard subsidiary (`OnboardForm` modal)
- **Fields:** Subsidiary name (required), Parent (select: "Top-level (no parent)" + each active sub). Info strip: *"inherits the tenant configuration by default."*
- **Optimistic create:** row appears immediately. **OutcomePicker** (Success / Server error). On "Server error" the optimistic row is removed after ~700ms and a **persistent danger toast** with **Retry** fires ("Couldn't onboard — rolled back").
- Focus trap, first-field autofocus, `Esc` cancels.

### 2.4 Offboard subsidiary (`OffboardDialog` — batch reassign saga)
The marquee tenancy edge flow.
- **Impact preview:** counts of **active** records that must move — Leads / Customers / Tickets (only non-terminal records count; `ACTIVE_STATES` excludes converted/churned/closed).
- **Required field:** "Reassign active records to" — another **active** subsidiary or **"Parent level (shared)"**.
- **Simulate a mid-batch failure** toggle.
- **Run:** phase `choose → running`. A progress bar ticks `done / total` at ~`max(90, base/2)` per record. On success → `commitOffboard` (soft-deletes the sub, reassigns each active record's `subsidiaryId` and re-scopes its `owner`/`assignee` to the target subsidiary's default person), success toast `"<sub> offboarded. N active records reassigned to <target>."`. If the current scope was the offboarded sub, scope resets to tenant.
- **Mid-batch fault:** at ~60% the run aborts, **nothing is committed**, a **persistent danger toast** fires (`"Reassignment failed mid-batch — rolled back. No records moved. <sub> is still active."`) with **Try again**, and the dialog closes.
- **ConfirmDialog discipline:** danger-toned modal; initial focus is on the **safe** Cancel control (never the destructive button); `Esc` is **suppressed while running**.

### 2.5 Cross-subsidiary roll-up (`RollupPage`) — admin only
- **Read-only aggregate table.** Columns: Subsidiary, Leads, Customers, Tickets, Total (tabular numerals). A **"Tenant total"** footer row sums everything; grand total in brand color.
- In `tenant` scope it lists every active subsidiary **plus a "Parent level (shared)" row**. In a single-subsidiary scope it shows only that sub + parent, with copy *"Sibling subsidiaries are not shown."*
- A **"Read-only"** lock pill sits in the header.
- **States:** loading (row skeletons), empty ("Nothing to roll up yet"), error ("Can't load roll-up" + retry), ready.
- **Edge-case hook:** a footer link *"open a record from another workspace ↗"* deliberately routes to the **404 / Not-found** view.

### 2.6 404 / Not found in this workspace (`NotFoundView`)
A calm, centered not-found: `compass` glyph, eyebrow *"404 · not found"*, heading **"Not found in this workspace"**, body explaining the record isn't part of `<scopeName>` (may belong to another subsidiary/tenant). Copy is explicit: *"This is a calm not-found — never a permission warning."* — i.e. **cross-tenant 404 never leaks existence**. Single primary action: **"Back to <scopeName>"**. Also reached when a customer's originating-lead link points outside scope (`app.jsx:111`).

---

## 3. Leads (Epic — leads)

### 3.1 Leads list (shared `ListPage` via `ENTITY.leads`, `templates.jsx`)
- **Columns:** Name (avatar + name), Company, Source (capitalized), Status (lead `Pill`), Owner, Updated (right-aligned). Evidence: `01-edge.png`.
- **Filters / sort:** a `FilterBar` of **dropdown** filters — Status (all lead statuses), Owner, plus a **Clear** link when any filter/search is active. Sort by any column header (toggles asc/desc, default `updated desc`). A live count *"X of Y · sorted by <col> ↑/↓"*. Free-text search matches name/company/owner. **URL-reflected state** (`?tab=leads&q=&status=&owner=&sortCol=&sortDir=&page=`) via `history.replaceState`.
  - *Drift:* `01-edge.png` shows the **earlier chip filters** ("All / Assigned to me / Open") + a "Columns" button; current code renders dropdown `FilterSelect`s and no Columns button.
- **Pagination:** 25/page, numeric pager with ellipses.
- **Row actions (kebab):** with write access → Open / "Assign to me" / Delete(danger); read-only → Open only.
- **States:** `loading` (re-query skeleton on scope change too), `empty` ("No leads in this scope yet" + scope line; create CTA auto-focused if the role can create), `filtered-empty` ("No matches" + "Clear filters"), `error` (retry), `ready`.

### 3.2 Capture / edit lead (`LeadForm` modal, `leads.jsx`)
- **Fields:** Name (required), Company, Email (format-validated if present), Phone, Source (required select: Web/Referral/Event/Outbound/Import), Owner (required select — one of the four lead owners), **BANT note** (free-text textarea; help text: *"budget, authority, need, timing. Free text, not a score."*).
- **Validation:** submit disabled until valid; on a failed submit, focus jumps to the first errored field; inline field errors with `alert-circle`.
- **Create is optimistic** → status `new`, toast *"Lead captured · <name> created in status 'new'"*, then redirect to the new lead's detail. **OutcomePicker** "Server error" path removes the draft after ~700ms and fires a persistent rollback toast with Retry.
- **Edit** updates in place + appends an "updated the lead details" timeline event + success toast.
- Focus trap + first-field autofocus + `Esc`.

### 3.3 Lead detail (`LeadDetail`)
- **Header:** breadcrumb (Leads › name), back button, title, **lead status pill**, and role-gated actions: **Edit** (ghost, write only), **Change status** control, and **Convert** (primary, only when `status === 'qualified'`). Read-only roles see a **"Read-only"** pill instead.
- **Body (two-column):** left = Lead details grid (Name, Company, Email, Phone, Source, Owner) + **BANT note** block; below it an **Activity** card (`RecordTimeline`, "Newest first"). Right = Owner card ("Single owner") + Meta card (Scope, Created, Last updated, Lead ID).
- **Change-status control** (`shared_records.jsx`, see [§9.2](#92-change-status-control-shared)) offers only legal next states; illegal targets are shown locked.

### 3.4 Lead status state machine (`store.jsx` `TRANSITIONS.lead`)
```
new          → contacted, disqualified
contacted    → qualified, disqualified
qualified    → converted, disqualified
disqualified → contacted            (revive)
converted    → (terminal)
```
Tones (pill): new `neutral`, contacted/qualified `info`, disqualified `danger`, converted `success`. Each accepted transition appends a sentence to the lead's timeline. Illegal transition → no pill change, no event, inline "rule + next legal step" (422 semantics).

---

## 4. Conversion saga (Epic — conversion)

The conversion inspector is a **DetailPage variant — not a modal** (`conversion.jsx` `ConversionInspector`). Entered from a lead's **Convert** action, which first raises a **ConfirmDialog** ("Convert this lead? … creates a customer in prospect, links lineage both ways, and locks the lead as converted." / confirm = "Start conversion").

### 4.1 The five ordered steps (`STEPS`)
1. **Guard** — assert lead is qualified & not already converted.
2. **Create customer** — new customer in `prospect` from the field map.
3. **Link lineage** — link customer ↔ lead both directions.
4. **Lock lead** — move lead to `converted` (read-only).
5. **Emit** — finalize; write **one linked conversion entry to *both* timelines**.

Each step advances one tick per `~--crm-base + 60ms`. Per-step status renders as **pending (neutral) → current (info, spinner) → done (success, check)**; the connector line turns green as steps complete. Overall pill cycles **Converting… (info) → Converted (success)** or **Rolling back… (warning) → Failed (danger)**.

### 4.2 Field map panel
Right rail lists the Lead→customer field map (Name, Company, Email, Phone, Source, Owner, BANT note) and the note: *"Activity history is **linked**, not copied — the lead's timeline stays its own and the customer references it."* Evidence: `saga-done.png`, `saga-failed.png`.

### 4.3 Success (`saga-done.png`)
On commit (`Store.commitConversion`): customer created in `prospect` with two-way lineage (`originatingLead`, `originatingLeadId`, lead's `convertedTo`), lead locked to `converted`, **one shared `correlationId`-style conversion entry** appended to both timelines, an **audit `conversion` record** logged, and the lead owner notified if they aren't the actor. Pill → **Converted**; header offers **"Open customer"**; success panel confirms *"Customer <name> created in prospect…"*. Toast: *"Lead converted · Customer '<name>' created in prospect."*

### 4.4 Failure / rollback (`saga-failed.png`)
A **"Simulate fault"** selector (visible until done) injects a fault: **at create-customer**, **at link-lineage**, or **409 at lock-lead**.
- On fault, phase → `rolling-back`: completed steps **reverse top-down** (each shows "Reversing", warning tone) at `~base + 80ms` per step, landing on **Failed** with **no half-made customer** and the **lead still `qualified`**.
- A red panel states the rollback; header offers **"Try again"** (resets cursor and re-runs).
- **Toasts:** generic fault → persistent danger *"Conversion failed — rolled back. No customer was created; the lead is still qualified."* (matches `saga-failed.png`). **409** path → distinct persistent danger *"Record changed — conversion stopped. This lead changed while converting. Refresh and try again."*

### 4.5 Eligibility block (no saga)
If entered for an ineligible lead (already converted, or not qualified), the inspector shows a calm **EmptyState** ("This lead can't be converted") with the precise reason and either **"Open linked customer"** (if already converted with a link) or **"Back to lead"** — never starting a saga. The saga runtime persists across remounts via `Store.getSaga/setSaga/clearSaga`.

---

## 5. Customers (Epic — customers)

### 5.1 Customers list (shared `ListPage` via `ENTITY.customers`)
- **Columns:** Account (building icon + name), Status (customer `Pill`), Primary email, Phone.
- **Filters/sort:** Status + Owner dropdowns, search over name/email, column sort, 25/page, URL-reflected. Same four+filtered-empty states as Leads.
- Create CTA "New customer" (role-gated).

### 5.2 Create / edit customer (`CustomerForm` modal, `customers.jsx`)
- **Fields:** Name (required), Primary email (required, validated), Phone, Owner (required), **Tax registration number**, **Contact address**. Info strip: *"Tax registration number and contact address are optional for a prospect, but **both are required to activate** the customer."*
- Optimistic create → status `prospect`; OutcomePicker Success/Server-error rollback (persistent toast + Retry), same pattern as leads. Edit appends a timeline event.

### 5.3 Customer detail (`CustomerDetail`) — `cust-detail.png`
- **Header:** breadcrumb, back, title, **customer status pill**, role-gated **Edit** + **Change status** (read-only roles → "Read-only" pill).
- **Body (two-column):** left = Customer details grid (Name, Primary email, Phone, Tax registration number, Contact address) + a **tabbed card**:
  - **Activity** tab → `RecordTimeline`, which **interleaves conversion lineage + status changes + ticket lifecycle** in one stream; lineage entries carry a "Lineage" tag, ticket entries a "Ticket" tag.
  - **Tickets** tab → count badge, "New ticket for this customer" (if `canCreate ticket`), and a list of the customer's tickets (subject, assignee, priority + status pills) that link to ticket detail; empty state otherwise.
- **Right rail:** **Lineage** card — if converted, a green "Converted from lead <name>" button that opens the originating lead (or routes to **404** if the lead is out of scope); else *"No originating lead — created directly."* Then Owner ("Account owner") and Meta cards. Evidence: `cust-detail.png` (Helix Labs, Active, "Converted from lead Avery Stone", owner Marco Ruiz).

### 5.4 Customer status state machine + activation gate (`TRANSITIONS.customer`)
```
prospect   → onboarding
onboarding → active
active     → inactive, churned
inactive   → active, churned        (reactivation)
churned    → (terminal)
```
Tones: prospect `neutral`, onboarding `info`, active `success`, inactive `warning`, churned `danger`.
- **Activation gate (422):** moving to `active` is blocked unless the customer has **both** a tax registration number **and** a contact address. The block surfaces inline in the change-status control as *"Add a <tax registration number and contact address> before activating this customer. Edit the customer to fill it in, then activate."* — **no pill change, no event** until satisfied.

---

## 6. Tickets (Epic — tickets)

### 6.1 Tickets list (shared `ListPage` via `ENTITY.tickets`) — `ticket-gate.png`
- **Columns:** Subject, Customer, Status (ticket `Pill`), **Priority** (priority pill), Assignee.
- **Filters/sort:** Status + Assignee + **Priority** dropdowns (priority filter is tickets-only), search over subject/customer/assignee, sort, 25/page, URL-reflected.
- Create CTA **"New ticket"** is available to **every role** (`canCreate('ticket') === true`), including viewer/sales — tickets are the one entity anyone can raise. Evidence: `ticket-gate.png` (admin Tickets list, 11 of 11, mixed statuses/priorities).

### 6.2 Create ticket — customer-state gate (`TicketForm` modal)
- **Fields:** Customer (required select — only customers in scope, each labeled `"<name> · <Status>"`), Subject (required), Description (textarea), Priority (required: Low/Medium/High/Urgent).
- **Customer-state gate:** a ticket may be opened **only when the chosen customer is `active` or `onboarding`** (`TICKET_GATE`). Picking a customer in any other state shows an inline **warning panel** with the reason (*"This customer is <status>. A ticket can be opened only when the customer is active or onboarding — move the customer to active first."*) and **disables submit**.
- Info strip: *"New tickets open in status 'open' and inherit the customer's subsidiary. The assignee defaults to that subsidiary's support agent — reassign from the ticket."*
- On create: ticket inherits the customer's `subsidiaryId`, defaults assignee to that sub's support person, logs a `ticket.create` audit record, and **notifies the assignee** (if not the actor). OutcomePicker rollback path same as other forms.

### 6.3 Ticket detail (`TicketDetail`)
- **Header:** breadcrumb, back, title, **status pill + priority pill**, role-gated **Assign** control + **Change status** (read-only → "Read-only" pill).
- **Pending = SLA paused:** when status is `pending`, the details card shows an **"SLA paused"** chip, and the pending transition sentence reads *"moved this ticket to pending (SLA paused)"*.
- **Body:** left = details grid (Subject, Customer, Priority, Status, Channel="Email") + Description + Activity timeline. Right = Assignee card ("Single assignee"), a **Customer** card linking to the customer detail, and Meta.
- **Assign control** (`AssignControl`): dropdown of support users **in the ticket's scope** (parent-scope tickets see all). Choosing reassigns, logs a `ticket.assign` audit record, notifies the new assignee, and toasts *"Ticket reassigned · <user> was notified."*

### 6.4 Ticket status state machine (`TRANSITIONS.ticket`)
```
open        → in_progress, pending, closed
in_progress → pending, resolved, open
pending     → in_progress, resolved
resolved    → closed, open          (reopen)
closed      → (terminal)
```
Tones: open `neutral`, in_progress `info`, pending `warning`, resolved `success`, closed `neutral`. Every accepted ticket transition logs a `ticket.transition` audit record.

---

## 7. Audit & events (Epic — audit)

### 7.1 Audit log (`audit.jsx` `AuditLog`) — `audit.png`
A **raw, immutable, before/after compliance table** — deliberately distinct from the per-record Activity timeline.
- **Dark "Raw audit log" banner** stating the matrix gate (*"All records across the tenant"* for admin, *"Only records you acted on"* for agents) + a **"Compliance"** tag. Evidence: `audit.png`.
- **Columns:** Timestamp (absolute, tabular), Actor, Action (tone-coded pill with icon), **Record & change** (record label + `before` → `after` rendered as code chips, before in neutral, after in green-soft), Scope.
- **Filters:** Action + Entity dropdowns (derived from the visible rows); a live "N records" count.
- **States:** loading (row skeletons), empty (admin: "No audit records yet"; agent: "No records you acted on"), error (retry), ready.

### 7.2 Matrix gate (`Store.auditFor`)
- **tenant_admin** → all audit rows.
- **sales_agent / support_agent** → only rows where they are the `actor`.
- **viewer** → none (and the Audit nav item is hidden for viewer entirely — see [§10](#10-config--roles--nav-epic--config)).

### 7.3 Action taxonomy (`ACTION_META`)
`permission.change` (warning), `lead.create`/`ticket.create` (neutral), `lead.transition`/`customer.transition`/`ticket.transition` (info, `repeat`), `ticket.assign` (info), `subsidiary.offboard` (danger), `conversion` (success, `git-merge`). Seeded rows + live rows from conversions, ticket create/transition/assign.

---

## 8. Dashboard (Epic — dashboard) + Notifications

### 8.1 Realized dashboard = conversion funnel (`dashboard.jsx` `DashboardPage`) — `dashboard.png`
> **This is the version that renders.** `dashboard.jsx` loads after `templates.jsx` and overwrites `window.DashboardPage`.
- **Layout:** two columns. Left = **Conversion funnel** widget + a clearly-labeled placeholder slot ("More widgets — later stories. Only the conversion funnel ships now."). Right = **Notifications** surface.
- **Conversion funnel:** five derived, **read-only** stages with horizontal bars and counts — **New, Contacted, Qualified, Converted, Active customers** — scoped to the active scope, with a **"Derived · read-only"** lock pill and a footer line (*"Aggregated across every subsidiary"* in tenant scope, else *"Scoped to <scope> — sibling subsidiaries are not counted."*). Evidence: `dashboard.png` (New 4, Contacted 4, Qualified 3, Converted 1, Active customers 6).
- **States:** loading (bar skeletons), empty ("No activity in this scope yet" when scope has zero leads+customers), error ("Can't load dashboard data" + retry), ready. Re-queries on scope change via `scopeLoading`.

### 8.2 Old KPI dashboard (`templates.jsx` `DashboardPage`) — NOT rendered
Defines four KPI cards (Open leads, Active customers, Open tickets, At-risk accounts), a "Pipeline by stage" chart placeholder, and a "Recent activity" timeline. **Overwritten at load** and never shown. Evidence of this dead variant: `01-scope.png` (KPIs 11/6/7/2), `01-flows.png` (empty KPI state with dashes). Documented only to explain the screenshot drift.

### 8.3 Notifications (`dashboard.jsx` `DashboardNotifications`, `NotificationsPage`; bell in `shell.jsx`)
- **Three surfaces, one model:** the topbar **bell** dropdown, the **dashboard** notifications card, and the full **"Notifications" page** (reached via bell/user-menu "View all"). All read `Store.notificationsFor(user)`, newest first, unread tinted `--iso-blue-3-50`.
- Per-item "Mark as read" + "Mark all as read"; relative time ("X min ago"), absolute on hover. Notifications **persist until read**.
- Seeded notifications target Lena Bauer (ticket assigned/high-priority), Marco Ruiz (lead added), Sara Khan (merge completed). New ones are generated by conversion (owner notified) and ticket create/assign.
- **Empty:** "You're all caught up" (`bell-off`).

---

## 9. Shared record surfaces & component behavior

### 9.1 Activity timeline (`RecordTimeline`, `shared_records.jsx`)
A **designed product surface** (audit-as-feature), distinct from the raw audit log. Newest-first vertical timeline; each entry = bold actor + sentence + relative time (absolute on hover) + connector line. **Kind tags** distinguish `conversion` ("Lineage", green) and `ticket` ("Ticket", info) entries from plain status entries. Empty state per record type. Per-record timelines are seeded with realistic histories (`buildLeadTimeline`/`buildCustomerTimeline`/`buildTicketTimeline`).
> Note: the **lead/customer/ticket detail Activity tabs use `RecordTimeline`** (store-driven). The generic `templates.jsx` `ActivityTimeline` (a static 4-event demo list) is only used by the dead KPI dashboard and the generic `DetailPage` (also unused by the wired modules).

### 9.2 Change-status control (shared) (`ChangeStatusControl`)
The single state-machine UI for leads/customers/tickets:
- Button **disabled when the status is terminal** (title: *"<Status> is terminal — read-only"*).
- Dropdown lists **only legal next states** ("Move this <entity> to") as pills with `→`.
- **Illegal states are shown but locked** (`lock` icon, `cursor: not-allowed`, under a "Not available from <Status>" header). Attempting one surfaces an inline **warning panel** with the rule + next legal step (or the gate reason for the customer-activation gate) — **no pill tone change, no toast, no event** (422 discipline).

### 9.3 Four-state contract (`components_core.jsx` / `components_data.jsx`)
Every data view honors **loading → empty → error → ready**:
- **Skeleton** (`crm-skel`) mirrors the real layout — never a bare spinner.
- **EmptyState** = brand-soft icon + title + optional **scope line** + body + (optional, auto-focused) primary action.
- **ErrorState** = contained panel (`cloud-off` glyph) + **Retry** — not a toast/takeover.
- **DataTable** renders all four internally; keyboard-operable rows (`tabIndex`, Enter/Space open), sortable headers with `aria-sort`, active-row highlight (brand-soft + inset brand bar).
- Mutation failures use the **toast/rollback** path, not ErrorState.

### 9.4 Toasts (`pushToast` / `ToastHost`)
Bottom-center stack, **max 3**. **Success auto-dismisses (~4s); danger/error persist** (manually dismissible). Optional action button (e.g. "Retry"). Tone icon: success `check-circle`, danger `rotate-ccw`, warning `alert-triangle`. Toasts are **own-action outcomes**, not a feed.

### 9.5 Modals & confirm dialogs (`ModalShell`, `ConfirmDialog`)
Overlay `rgba(15,22,38,0.42)` + `blur(2px)`, panel enters with `crm-pop`. **Focus-trapped**, `Esc` cancels, click-outside cancels. `ConfirmDialog` focuses the **safe** control by default; destructive confirm is `danger`-toned and never default-focused. Required for delete + convert (convert hands off to the saga inspector, no double-confirm).

### 9.6 Component gallery (`gallery.jsx`, reached via sidebar "Components")
"Component inventory" page showing every shared component with its states/variants. Evidence: `01-roles.png` — StatusPill **DOT variant** (Draft/Open/Won/At risk/Blocked) and **ICON variant** (Draft/In progress/Resolved/SLA risk/Denied), plus the Button section ("Hover steps one tone darker; press two darker. No scale-down…").

---

## 10. Config / roles / nav (Epic — config)

### 10.1 Roles (`config.jsx` `ROLES`)
| Role | scopeFixed | fixedScope | write | color |
|---|---|---|---|---|
| tenant_admin | false | — (tenant) | true | brand |
| sales_agent | true | eu | true | blue-3-400 |
| support_agent | true | us | true | green-400 |
| viewer | true | eu | false | n-600 |

### 10.2 Per-module capability (`canWrite` / `canCreate`)
- **viewer** → read-only everywhere (`canWrite` always false).
- **Leads:** write = admin or sales (**support is lead-blind**).
- **Tickets:** write = admin or support (**sales is read-only on tickets**); **create = everyone**.
- **Customers:** write = admin/sales/support.
- Create otherwise follows write (except tickets, which everyone can create).

### 10.3 Nav gating (`NAV` / `navFor` / `canAccess`)
| Nav item | Group | Roles that see it |
|---|---|---|
| Dashboard | Workspace | all four |
| Leads | Workspace | admin, sales, viewer (**not support**) |
| Customers | Workspace | all four |
| Tickets | Workspace | all four |
| Subsidiaries | Tenancy | admin only |
| Roll-up | Tenancy | admin only |
| Audit & events | Tenancy | admin, sales, support (**not viewer**) |

- **Live role switch** (`app.jsx` `switchRole`): if the new role can't access the current nav, it redirects to Dashboard; an open detail collapses to its list. Switching also resets scope to the role's fixed scope (or tenant for admin).
- **Role-gated affordances on screens:** write roles see Edit / Change status / Convert / Assign / Delete; read-only roles see a **"Read-only"** pill in place of the primary actions; the scope switcher locks for `scopeFixed` roles; roll-up and dashboard widgets carry "Read-only" / "Derived · read-only" pills.

### 10.4 Static tenancy config
Tenant `northwind` = "Northwind Trading". Subsidiaries (static list): EU/Frankfurt, US/Chicago, APAC/Singapore. The store seed adds APAC's parent (`eu`) and the synthetic `parent` bucket for shared records.

---

## 11. Tokens & motion (realized values)

### 11.1 Motion layer (`tokens/motion.css`) — the only authored visual layer
| Token | Value | Meaning in the prototype |
|---|---|---|
| `--crm-instant` | `0ms` | optimistic apply (mutation already done) |
| `--crm-fast` | `120ms` | hover, focus, **pill tone change**, toast enter, filter/nav color |
| `--crm-base` | `200ms` | skeleton→ready, dialog/switcher enter (`crm-pop`/`crm-fade`), route, **each saga step**, scope re-query |
| `--crm-slow` | `320ms` | **rollback snap-back — deliberately the slowest, so reversal is seen** |
| `--crm-ease-standard` | `cubic-bezier(0.4,0,0.2,1)` | moves (things already on screen) |
| `--crm-ease-decelerate` | `var(--iso-ease-out)` = `cubic-bezier(0.22,1,0.36,1)` | enters |
| `--crm-ease-accelerate` | `cubic-bezier(0.4,0,1,1)` | exits |
| `--crm-travel` | `1` (→ `0` under reduced-motion) | transform-distance scalar |

- **`prefers-reduced-motion: reduce`** collapses `--crm-travel` to 0 and flattens `base`/`slow` to `120ms` — **no physical travel/snap-back, but timings, opacity cross-fades, state changes, and all feedback still fire.**
- Saga steps actually read `--crm-base` at runtime (`getComputedStyle`) to time their ticks, and `Store.setScope` reads it to time the re-query skeleton.

### 11.2 Design-system tokens (`tokens/colors_and_type.css`) — consumed, not authored
- **Color:** three blue ramps + neutrals + semantic red/green/yellow. Product code uses **semantic aliases only** — `--iso-brand` (#003CA4), `--iso-accent` (#459DDE), `--iso-link` (#0068C4), `--iso-success`/`-soft`, `--iso-warning`/`-soft`, `--iso-danger`/`-soft`, `--iso-fg*`, `--iso-border*`, `--iso-bg`/`-subtle`/`-muted`. App background is `--iso-blue-3-50` (#f5f9fd).
- **Status-pill tones** (`components_core.jsx` `TONES`): the five-tone map (neutral/info/success/warning/danger) is the **only** source of a pill's color; pills always carry a text label (status never by color alone) and a dot or icon.
- **Type:** Product Sans (display/body), Inter (UI/numerical/eyebrow), IBM Plex Sans Arabic (RTL). Headings use display weights; eyebrows are 10px uppercase Inter with `0.08em` tracking.
- **Radii:** xs 3 / sm 4 / md 5 / lg 8 / xl 12 / full 9999.
- **Shadows:** `xs`–`xl`, plus `--iso-shadow-modal`, `--iso-shadow-focus` (brand ring) and `--iso-shadow-focus-danger`. **Elevation is reserved for transient overlays** (dropdowns/modals/toasts); the saga inspector is in-page and does not elevate.
- **Z-index:** dropdown 100 · sticky 200 · overlay 800 · modal 900 · toast 1000.

---

## 12. Edge-case screen index (evidence map)

| Edge case | Where (code) | Screenshot evidence |
|---|---|---|
| Saga failure + top-down rollback | `conversion.jsx` rollback driver | `saga-failed.png` |
| Saga success + lineage | `conversion.jsx` done phase | `saga-done.png` |
| Ticket customer-state gate | `tickets.jsx` `TicketForm`; `store.jsx` `canOpenTicketFor` | `ticket-gate.png` (Tickets list context) |
| Scope switching / locked scope | `shell.jsx` `ScopeSwitcher`; `app.jsx` | `01-scope.png` (old dashboard), shell of every shot |
| Role gating / read-only | `config.jsx`; per-module headers | `01-roles.png` (gallery), read-only pills in details |
| 404 / not found in workspace | `tenancy.jsx` `NotFoundView` | (rendered; reached via roll-up "another workspace" link) |
| Empty state (scoped) | shared `EmptyState`; `01-modal.png` | `01-modal.png` ("No tickets in this scope yet") |
| Offboard batch reassign + mid-batch rollback | `tenancy.jsx` `OffboardDialog` | (rendered; impact + progress) |
| Customer activation gate (422) | `store.jsx` `transitionCustomer`; `ChangeStatusControl` | (inline panel in change-status) |
| Side-by-side record view | `app.jsx` side mode; `RecordPager` | `sideview.png` |
| Raw audit before/after | `audit.jsx` | `audit.png`, `audit2.png`–`audit4.png` |
| Customer detail w/ lineage + interleaved timeline | `customers.jsx` | `cust-detail.png` |
| Funnel dashboard | `dashboard.jsx` | `dashboard.png` |

---

*End of current-state document. No changes are proposed here.*
