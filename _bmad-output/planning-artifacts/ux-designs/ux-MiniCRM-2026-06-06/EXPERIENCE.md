---
name: min-crm
status: final
updated: 2026-06-06
design: DESIGN.md          # visual identity peer spine — tokens referenced as {motion.*}, {tone.*}, {ds.*}
sources:
  - project-context.md §3 (STATUS_TONE + transitions), §6.2 (RBAC), §8 (UI inventory, four-state rule)
  - prd UJ-1…UJ-5, NFR-9, NFR-10
  - architecture Patterns 2,4,5,6,7,8; ADR-007 (fault injection)
binds: project-context §8 (governs E0-S9 and every UI story)
---

# min-crm — Experience Spine (Interaction & Motion Standards)

> **What this is.** The principles + interaction/motion layer on top of the iSolution Design
> System. Visual values live in [DESIGN.md](DESIGN.md) and the DS; *behavior* lives here. The
> distilled BINDING rules are in [§8-binding-rules.md](§8-binding-rules.md) for folding into
> `project-context.md §8`. **This spine wins on conflict with any mock.**

---

## 1. Design Principles

A small, opinionated set. Every interaction decision below traces to one of these. When two pull
against each other, the earlier wins.

1. **Clarity over chrome.** The data table is the product. Motion, elevation, and ornament earn
   their place only by making a state change legible. If an animation doesn't help the user *know
   what happened*, it's removed. (Drives the motion philosophy in DESIGN.md.)

2. **Audit-as-feature legibility.** "Who did what, when" is a first-class user value, not back-office
   plumbing. The **Activity timeline** is a designed product surface — chronological, actor- and
   time-stamped, readable at a glance — and is kept visually and conceptually distinct from the raw
   **Audit/Events log** (compliance view). Provenance is never hidden behind a developer affordance.

3. **Scope is always visible.** A user must never be unsure which tenant/subsidiary they're acting
   in. The active scope lives in the AppShell header at all times; changing it is a deliberate,
   confirmed-by-data-change act; empty results read as "this scope is empty," never as "broken."

4. **Deny-wins, felt gracefully.** The system rejects a lot by design — out-of-scope records 404,
   illegal transitions 422, role gates, customer-state gates. None of these are dead ends. Every
   denial resolves to a **graceful blocked/empty state with the next legal action**, phrased as
   what *can* happen, not just what can't. A 404 for a cross-tenant record reads as "not found in
   this scope," never leaking that it exists elsewhere (§6.2).

5. **Optimistic, but honest.** Mutations apply instantly (optimistic), yet the system never lies:
   when a write fails or is rejected, the **rollback is the most visible motion in the app** and is
   always paired with a plain-language toast. The user trusts the UI because reversal is loud.

---

## 2. Foundation

- **Form factor:** Web app, desktop-first, **responsive down to tablet** (NFR-10). No mobile or
  native surface in pilot. Primary input: keyboard + pointer; full keyboard paths required (§7).
- **UI system:** The **iSolution Design System** backs every component. min-crm assembles screens
  *only* from the fixed §8 inventory — no new page layouts, no one-off components (NFR-10). This
  spine specifies the **behavioral delta** on top of the DS components; visual specs stay in the DS.
- **Data layer reality:** state is `localStorage` in the pilot behind the `Repository<T>` seam;
  every mutation is optimistic with snapshot-and-rollback, and a **fault-injection toggle** (ADR-007)
  forces error paths so rollback/error UX is exercised before a backend exists. The UX must look
  identical whether the failure is injected or real.

---

## 3. Information Architecture

Surfaces derive from the five journeys; every stated need maps to one, and each is built from the
fixed page templates (`ListPage`, `DetailPage`, `EntityForm`, `Dashboard`).

```
AppShell  (persistent: nav rail + tenant/subsidiary switcher + notifications bell)
├─ Leads            ListPage → DetailPage (+ Activity timeline tab) → EntityForm     UJ-2
│   └─ Convert       ConfirmDialog → Saga inspector (DetailPage variant)             UJ-3
├─ Customers        ListPage → DetailPage (+ Activity timeline, + Tickets tab)        UJ-3/4
│   └─ Onboarding    transition control (prospect→onboarding→active)                  UJ-4
├─ Tickets          ListPage → DetailPage (+ Activity timeline)                       UJ-4
├─ Subsidiaries     ListPage → DetailPage (tenant_admin only)                         UJ-1
├─ Dashboard        Dashboard (one read-model widget; role-scoped roll-up)            UJ-5
└─ Audit / Events   raw compliance log (separate from Activity timeline; RBAC-gated)  §6.2
```

**Closure note:** the Activity timeline is a *tab/section on a DetailPage*, not a top-level surface;
the Audit/Events log *is* a top-level surface (distinct from the timeline — DEC-UX-5). Every UI
surface inherits the four-state rule (§5).

---

## 4. Voice & Tone (microcopy)

Operational, plain, blame-free. Brand voice lives in DESIGN.md; this is the functional register.

| Situation | Pattern | Example |
|---|---|---|
| Empty list (legal scope) | State the scope + offer the primary action | "No leads in Northwind East yet." + **[New lead]** |
| Empty by denial (no rows you may see) | Same calm framing, no permission jargon | "Nothing here in your scope." |
| Error (load) | Plain cause + retry verb | "Couldn't load leads." + **[Retry]** |
| Generic mutation failure | Action-level, blame-free | "Couldn't save. Your changes were rolled back." |
| 409 conflict | Distinct, directive | "This record changed since you opened it. Refresh to see the latest." |
| 422 illegal transition | Name the rule, not the error code | "A lead can't go from New straight to Qualified. Move it to Contacted first." |
| 422 customer-state gate | State the precondition | "Tickets open once the customer is Onboarding or Active. This one is Prospect." |
| Destructive confirm | Name the object + consequence | "Delete this lead? It's hidden from lists but kept in the audit trail." |
| Convert confirm | Name the outcome | "Convert Acme Co to a customer? This locks the lead and starts onboarding." |

Never surface raw codes (404/409/422) or stack traces to the user. Never blame the user ("you
entered an invalid…"); describe the rule and the next legal step.

---

## 5. State Patterns — the four states (NFR-9 / UC-1)

Every data-backed view handles **loading · empty · error · ready** via the shared
`<QueryStateBoundary>` (Pattern 6). DoD check is "did you use the boundary?" — not a hand-rolled
ladder. Mapping is fixed:

| TanStack state | Component | Behavior & motion |
|---|---|---|
| `isPending` | `Skeleton` | Skeleton mirrors the *real* layout (table rows / form fields / cards) at correct counts and widths — never a spinner over a blank page. |
| `isError` | `ErrorState` | Message (voice §4) + **[Retry]** calling `refetch()`. Retry shows inline pending on the button, not a full reset to skeleton. |
| `data.length === 0` | `EmptyState` | Illustration + one-line scope framing + **primary action** (the thing this surface creates). Empty is an invitation, not an error (Principle 4). |
| else | `ready` | The real view. |

### 5.1 Skeleton → ready transition
On resolve, **cross-fade** skeleton→content at `{motion.duration.base}` with `decelerate` easing —
no layout jump (skeleton already holds the geometry). Under `prefers-reduced-motion`, the content
replaces the skeleton with an opacity fade at `{motion.duration.fast}`, no movement.

### 5.2 Empty-with-primary-action affordance
The `EmptyState` primary action is the *same* action as the page header's primary action (one
mental model). It is keyboard-focusable and is the **first focus stop** when a view resolves empty,
so a keyboard user lands on "what to do next." If the user's role can't perform that action, the
EmptyState shows the calm framing **without** a disabled button (Principle 4 — no dead affordances).

### 5.3 Error + retry behavior
`ErrorState` is a contained panel in the view region (not a toast, not a full-page takeover — the
AppShell and scope header stay put). **[Retry]** re-runs the query; on repeated failure the message
persists (no error toast spam). Errors that originate from a *mutation* (not a load) use the toast
path in §6.2, not `ErrorState`.

---

## 6. Interaction Primitives

### 6.1 Optimistic mutation + rollback (ADR-007, Pattern 5) — the signature interaction

**On optimistic apply:** the result paints at `{motion.duration.instant}` (0ms) — the row updates,
the pill changes tone, the form closes, the toast is *not* shown yet. The UI behaves as if the
write already succeeded. `version` is pre-incremented locally.

**On `onError` (real or fault-injected):**
1. **Rollback snap-back** — the optimistic change visibly reverts using `{motion.duration.slow}`
   (320ms, the slowest motion in the app, by design). The reverting element (row value, pill tone,
   reordered row) animates *back* to its prior state so the user perceives the reversal rather than
   a silent flip. This is the one place motion is deliberately unhurried (Principle 5).
2. **Toast** appears in concert with the snap-back (§6.2): generic → "Couldn't save. Your changes
   were rolled back."; **409 → the distinct** "This record changed since you opened it. Refresh…";
   **422 → rollback + inline field errors** at the form (Zod already surfaced them client-side; the
   server 422 is a backstop — see §6.3).
3. `onSettled` invalidates the query so the next paint is server-truth.

Under `prefers-reduced-motion`: no travel — the value reverts instantly; the toast still fires (the
toast, not the motion, is the guarantee the user is informed).

### 6.2 Illegal transition (422, UC-3) — the pill does NOT change

A status move not in the transition map (`LEAD_/CUSTOMER_/TICKET_TRANSITIONS`), or a blocked
customer-state gate for tickets, returns **422** via `POST /{resource}/{id}/transition`. Then:
- **The StatusPill never changes tone.** Because the transition control is its own action (not a
  free-text edit), the optimistic apply is *suppressed* for transitions that fail client-side
  validation, and any server 422 reverts with **no tone animation at all** (DEC-UX-6). The pill is
  the source of truth for legal state; it must never flicker to an illegal value.
- **Inline feedback at the action origin:** the message appears adjacent to the transition control
  (the status dropdown / Convert button), phrased as the *rule + next legal step* (voice §4), not a
  toast and not a tone change. Focus stays on the control; the offered next action (e.g. "Move to
  Contacted") is reachable in one tab.
- No `*.StatusChanged` event, no audit record (Pattern 4) — a rejected move is a non-event.

### 6.3 StatusPill — tone transition on a *legal* change

Tone comes only from `STATUS_TONE` (§3.3) → `{tone.*}` tokens; the pill never picks a color.
On an **accepted** transition (the optimistic-apply path), the pill cross-fades its tone token at
`{motion.duration.fast}` (e.g. lead `contacted` info → `qualified` `{tone.success}` — the UJ-2
climax "turns success green"). Per-tone treatment is uniform shape/size; **only the tone token
differs** — `neutral · info · success · warning · danger`. The pill text is the status label from
the enum (never a literal). Tone change is the *only* StatusPill animation; nothing else moves.

### 6.4 ConfirmDialog — destructive & convert actions

Required for every destructive (delete) and convert action (NFR-10, §8.4). Behavior:
- Opens at `{motion.duration.base}` with a backdrop; **focus traps** to the dialog, initial focus on
  the **safe** control (Cancel), `Esc` cancels, the destructive/convert button is visually the tone
  it implies (`danger` for delete) and is **not** the default-focused element.
- Copy names the object and the consequence (voice §4).
- **Convert is special** — confirming does not just close the dialog; it **hands off to the saga
  inspector** (§6.5). The dialog's confirm button enters a pending state, then the view transitions
  to the inspector. No double-confirm.

### 6.5 Conversion saga inspector (E3-S1, Pattern 2) — progress & compensation

Rendered on a **`DetailPage` variant** (no new layout, no modal — NFR-10), in-page, not elevated.
It reads the `WorkflowInstance` (`steps`, `currentStep`, `completedSteps`, `status`).

**Step list** (the 5 ordered steps: guard · create-customer · link-lineage · lock-lead · emit),
each rendered as a row with a state glyph:
- **done** (`completedSteps`) — `{tone.success}` check, settled.
- **current** (`currentStep`, while `status: running`) — `{tone.info}`, an active indicator
  advancing at `{motion.duration.base}`; the label reads the present-tense action.
- **pending** — `{tone.neutral}`, dimmed.

**On success** (`status: completed`): the final step settles to success; a success toast fires
("Acme Co converted — customer created"); the inspector offers links to **both** the new customer
and the (now read-only) lead. A linked conversion event lands on **both** Activity timelines sharing
the saga `correlationId` (UJ-3 climax).

**On failure** (`status: compensating → failed`, e.g. fault-injected):
- The failed step flips to `{tone.danger}`.
- The status header changes to **"Rolling back…"** and the **completed steps reverse**, top-down,
  each animating from done → undone at `{motion.duration.base}` so the compensation is *witnessed*
  (this is the saga-scale echo of the rollback-is-loud principle). Steps that compensate show their
  reversing action label.
- End state: `status: failed`, **no half-made customer**, the lead back at `qualified`, a clear
  message ("Conversion failed and was rolled back. The lead is unchanged.") + a **[Try again]**
  affordance. The lead's pill never left `qualified`.
- *[ASSUMPTION] the inspector polls/streams `WorkflowInstance` state; advance cadence assumed at*
  *`{motion.duration.base}` per step — no NFR fixes it.*

### 6.6 Activity timeline (E4-S4) — distinct from the Audit log

The timeline renders a record's **`DomainEvent`s** in reverse-chronological order, each entry =
**actor + relative time (with absolute on hover/focus) + a human sentence** ("Sam moved this lead to
Contacted", "Conversion linked this customer to lead #…"). On a customer it **interleaves conversion
lineage with the ticket lifecycle** as one continuous story (UJ-4 climax). It is gated by permission
to *view the record* (so `viewer` sees it within scope). It is **not** the raw Audit/Events log —
that is a separate top-level surface showing full `AuditEvent` `before/after`, gated by the §6.2
"View audit/events" row (`viewer` = none). The timeline is product; the audit log is compliance
(Principle 2 / DEC-UX-5). New events fade in at `{motion.duration.fast}`; no auto-scroll hijack.

### 6.7 Toast / in-app notifications (E5-S3, Pattern 8)

Two related but separate channels:

**Toast (operation outcome — `Toast` component).**
- *Appearance:* enters at `{motion.duration.fast}` (`decelerate`) in a fixed corner region;
  tone-tokened by outcome (`success` / `danger` / `info`). One concern per toast.
- *Dwell:* success ~4s auto-dismiss; **error/409 toasts do not auto-dismiss** — the user must
  acknowledge (rollback information is too important to vanish). *[ASSUMPTION] 4s pilot default.*
- *Dismissal:* always manually dismissible (× + `Esc` dismisses the most recent); exits at
  `{motion.duration.fast}` with `accelerate`. Max 3 stacked; older collapse. `aria-live="polite"`
  for success, `assertive` for errors.
- *Scope:* toasts report *the current user's own action's* result. They are not a feed.

**In-app notifications (notifications bell in AppShell).**
- Driven off `DomainEvent`s by the shared Notifications kernel (e.g. `Ticket.Assigned` → assignee;
  `Lead.Converted` → lead owner), **scoped to the recipient's tenant/subsidiary** (UC-5) — never a
  bespoke write. A new notification animates the bell badge at `{motion.duration.fast}`.
- The bell opens a scoped, four-state list (it too obeys §5). Notifications persist until read; a
  toast is ephemeral. The two never duplicate the same beat for the actor who caused it.

---

## 7. Accessibility Floor (behavioral; visual contrast inherited from the DS)

Contrast, color, and focus-ring *appearance* come from the iSolution DS. This section owns
*behavior*. min-crm targets WCAG 2.1 AA via the DS; status is **never** conveyed by tone alone — the
StatusPill always carries a text label (color-blind safe by construction).

- **Focus order:** logical and DOM-ordered. On view resolve: ready → first interactive control in
  the main region; empty → the primary action (§5.2); error → **[Retry]**. ConfirmDialog and the
  switcher popover **trap focus** and restore it to the trigger on close.
- **Keyboard — tables (`DataTable`):** arrow keys move the active cell/row; `Enter` opens the row's
  DetailPage; row actions reachable via a per-row actions control in tab order (no pointer-only menu);
  sort/filter controls in the `Toolbar`/`FilterBar` are standard focusable controls; pagination is
  keyboard-operable. No interaction is pointer-only.
- **Keyboard — forms (`EntityForm`):** every field has a programmatic label; `Tab` order follows
  visual order; inline validation errors are associated via `aria-describedby` and announced; submit
  is disabled until valid (§8 template) but the disabled reason is discoverable; on a 422 backstop,
  focus moves to the **first errored field**.
- **Transitions & dialogs:** the transition control is a labeled control; a 422 message is associated
  with it via `aria-describedby` and announced `assertive` (§6.2). Convert/delete confirms are
  reachable and dismissible by keyboard alone.
- **Motion:** `prefers-reduced-motion: reduce` is honored everywhere (DESIGN.md `motion.reduced`):
  no travel/transform/snap-back; opacity cross-fades survive; **all state still changes and all
  feedback still fires** — accessibility never costs the user information.
- **Live regions:** toasts and the 422 inline message use `aria-live`; the saga inspector announces
  step transitions and the final outcome politely.

---

## 8. Key Flows (named-protagonist journeys, with the climax beat)

**UJ-1 — Dana stands up a subsidiary and trusts the wall.** Dana (tenant_admin, scope = null) opens
Subsidiaries, adds "Northwind East" (`ConfirmDialog`-free create via `EntityForm`; emits
`Tenant.SubsidiaryAdded`), then uses the **switcher** to drop into Northwind East. **Climax:** the
AppShell scope header changes and the leads list visibly re-populates to empty — the data *proves*
the wall (Principle 3). The switch is the moment scope becomes tangible. **Edge:** opening another
tenant's record by ID → calm "Not found in this scope" (404, no existence leak — Principle 4).

**UJ-2 — Sam takes a web lead new → qualified.** Sam captures the lead (`EntityForm`, optimistic
create), works the `DataTable` filtered by status+owner, and transitions `new → contacted →
qualified` via the pill's transition control. **Climax:** the StatusPill cross-fades to
`{tone.success}` green at `{motion.duration.fast}` and the Activity timeline shows each step stamped
with who+when (Principle 2). **Edge:** Sam tries `new → qualified` directly → **422, pill never
changes**, inline "Move it to Contacted first" beside the control (§6.2).

**UJ-3 — Sam converts a qualified lead.** From the lead DetailPage Sam clicks **Convert** →
`ConfirmDialog` ("…locks the lead and starts onboarding") → hands off to the **saga inspector**
(§6.5). The 5 steps advance; a customer is created in `prospect`; the lead locks to `converted`.
**Climax:** a linked conversion event appears on **both** the lead's and the customer's timelines,
sharing one `correlationId`. **Edge (fault-injected):** mid-saga failure → "Rolling back…", the
completed steps **visibly reverse**, end state `failed`, **no half-made customer**, lead back at
`qualified`, **[Try again]** offered.

**UJ-4 — Priya can only open a ticket once the customer is ready.** The customer is walked
`prospect → onboarding → active` (transition controls obey `CUSTOMER_TRANSITIONS`). Priya opens the
customer, files a ticket (`EntityForm`), assigns herself, works it `open → in_progress → resolved →
closed`. **Climax:** the customer's Activity timeline interleaves the ticket lifecycle with the
conversion lineage — one continuous story (§6.6). **Edge:** filing a ticket while the customer is
`prospect` → blocked by the customer-state gate, **422**, inline "Tickets open once the customer is
Onboarding or Active" — no ticket created, nothing half-done (Principle 4).

**UJ-5 — Dana reads the funnel across her org.** Dana opens the `Dashboard`; one read-model widget
(conversion funnel / per-subsidiary roll-up) aggregates from the event log (four states apply).
**Climax:** she sees a cross-subsidiary roll-up no single-subsidiary user can see (scope made
visible as *capability*, Principle 3). A `Ticket.Assigned` fires an in-app notification to its
assignee via the bell (§6.7). **Edge:** a subsidiary user on the same dashboard sees only their own
scope — same surface, scoped data, no leak.
