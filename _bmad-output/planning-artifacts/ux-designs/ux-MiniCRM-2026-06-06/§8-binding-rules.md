# §8 Binding Rules — UX/Interaction Addendum (paste into project-context.md §8)

> **How to use this file.** These are the BINDING interaction/motion rules distilled from the UX
> spines ([DESIGN.md](DESIGN.md) · [EXPERIENCE.md](EXPERIENCE.md)). Fold the block below into
> `_bmad-output/project-context.md` as **§8.5–§8.9** (appended after the existing §8.4). They
> govern **E0-S9** and every UI story. Rules here are as binding as the rest of §8: if a pattern is
> defined, you use it as-is. The full rationale and per-component detail live in the spines.
>
> **Token-source note (DEC-UX-1):** the "Claude Design tokens" named in §8.4/NFR-10 and the
> **iSolution Design System** are the *same token layer*. All visual values come from the iSolution
> DS, referenced by token name. The only authored visual layer is **motion** (the DS owns no motion).

---

## §8.5 Design principles (binding intent)

1. **Clarity over chrome** — motion/elevation/ornament must make a state change legible or be removed.
2. **Audit-as-feature legibility** — the Activity timeline is a designed product surface, distinct from the raw Audit/Events log.
3. **Scope always visible** — active tenant/subsidiary shown in the AppShell at all times; empty scope reads as empty, not broken.
4. **Deny-wins, felt gracefully** — every 404/422/role/state denial resolves to a calm blocked/empty state offering the next legal action; cross-tenant 404 never leaks existence.
5. **Optimistic but honest** — mutations apply instantly; failures roll back with the most visible motion in the app plus a plain toast.

## §8.6 Motion tokens (authored — DS owns no motion)

Defined in DESIGN.md; **realized in `prototype/tokens/motion.css` as `--crm-*` tokens (DEC-UX-8/9)** —
product code references those token names, never raw ms/curves. `instant 0ms` (`--crm-instant`,
optimistic apply) · `fast 120ms` (`--crm-fast`: hover, focus, **pill tone change**, toast enter) ·
`base 200ms` (`--crm-base`: skeleton→ready, dialog/switcher enter, route, saga step) · `slow 320ms`
(`--crm-slow`: **rollback snap-back — deliberately the slowest, so reversal is seen**). Easing:
`--crm-ease-standard` moves, `--crm-ease-decelerate` (= DS `--iso-ease-out`) enters,
`--crm-ease-accelerate` exits. **`prefers-reduced-motion: reduce` is honored everywhere**: the
`--crm-travel` scalar drops to 0 and base/slow flatten to 120ms; no travel/transform/snap-back;
opacity cross-fades survive at `fast`; all state still changes and all feedback still fires. No
decorative motion. Elevation (DS values) is reserved for transient overlays only; the saga inspector
is in-page and does **not** elevate. **Derived step-cadence values** beyond the four duration tokens
(e.g. the saga step advance `base + 60ms`, compensation `base + 80ms`, scope re-query `base + 220ms`,
the optimistic-undo window `~700ms`, the offboard per-record tick `max(90, base/2)`) are **JS timing
constants**, not CSS style tokens — define them as **named constants** derived from the `--crm-*`
durations; **never inline raw `ms` (or raw opacity) literals in components** (NFR-10).

## §8.7 Four-state behavior (NFR-9/UC-1) — binds the `<QueryStateBoundary>`

- `isPending → Skeleton` mirroring the real layout (never a bare spinner); resolve cross-fades to
  content at `base`/`decelerate`.
- `isError → ErrorState` (contained panel, not a toast/takeover) with **[Retry] → `refetch()`**;
  inline pending on retry; no error-toast spam on repeated failure.
- `empty → EmptyState` = illustration + scope-framed line + **the page's primary action**, which is
  the **first focus stop**; no disabled dead button if the role can't perform it.
- else `ready`.
- **Mutation** errors use the toast/rollback path (§8.8), **not** `ErrorState`.

## §8.8 Mutation, transition & status feedback (ADR-007, UC-3, Pattern 4/5) — BINDING

- **Optimistic apply** paints at `instant` (0ms); `version` pre-incremented locally.
- **Rollback** (real or fault-injected) snaps the optimistic change *back* at `slow` (320ms) +
  a toast: generic "rolled back"; **409 → distinct "record changed, refresh"**; **422 → rollback +
  inline field errors**. Reduced-motion: revert instant, toast still fires.
- **Illegal transition / customer-state gate → 422:** the **StatusPill NEVER changes tone**; feedback
  is **inline at the transition control** as *rule + next legal step* (not a toast, not a tone flicker);
  no `*.StatusChanged` event, no audit record. (UC-3 / DEC-UX-6)
- **Legal transition:** StatusPill cross-fades its tone token at `fast`. Tone comes **only** from
  `STATUS_TONE` (§3.3) → tone tokens; pill text is the enum label, never a literal; tone change is
  the pill's only animation.
- **ConfirmDialog** required for all destructive + convert actions: focus-trap, initial focus on the
  **safe** control, `Esc` cancels, destructive button tone-tokened `danger` and not default-focused.
  **Convert** hands off to the saga inspector (no double-confirm).

## §8.9 Saga inspector, Activity timeline, toast & notifications

- **Conversion saga inspector** = `DetailPage` variant (no new layout, no modal — NFR-10), reads
  `WorkflowInstance` (`steps`/`currentStep`/`completedSteps`/`status`). Steps render done(`success`)
  / current(`info`, advancing at `base`) / pending(`neutral`). On **failure**: status → "Rolling
  back…", **completed steps visibly reverse top-down** at `base`, end `failed` with **no half-made
  customer**, lead back at `qualified`, **[Try again]** offered. Success links both timelines via the
  shared `correlationId`.
- **Activity timeline** = a record's `DomainEvent`s reverse-chronologically (actor + relative time
  with absolute on hover + human sentence); interleaves lineage + lifecycle on a customer; gated by
  view-record permission (viewer sees it in scope). **It is NOT the Audit/Events log** — that is a
  separate top-level surface of raw `AuditEvent` `before/after`, gated by §6.2 (viewer = none).
- **Toast** = own-action outcome only (not a feed): enter `fast`, success auto-dismiss ~4s,
  **error/409 do not auto-dismiss**, always manually dismissible, max 3 stacked, `aria-live`
  polite/assertive by tone.
- **In-app notifications** (AppShell bell) = projected from `DomainEvent`s by the shared Notifications
  kernel, scoped to recipient tenant/subsidiary (UC-5), never bespoke writes; persist until read;
  the notifications list itself obeys the four states.

## §8.10 Accessibility & interaction floor (contrast inherited from the DS)

- **Status never by color alone** — StatusPill always carries the text label.
- **Focus order on resolve:** ready → first control in main region; empty → primary action; error →
  [Retry]. Dialogs/switcher trap focus and restore to trigger on close.
- **Tables** fully keyboard-operable (arrow-navigate, `Enter` opens row, row actions in tab order,
  keyboard sort/filter/paginate) — nothing pointer-only.
- **Forms** label every field, follow visual tab order, associate errors via `aria-describedby` and
  announce them, move focus to the first errored field on a 422 backstop.
- **`prefers-reduced-motion`** honored everywhere; accessibility never costs the user feedback.
- Responsive down to tablet (NFR-10).

---

*Source: ux-MiniCRM-2026-06-06. Spines win on conflict with any mock. Visual values: iSolution DS.*
