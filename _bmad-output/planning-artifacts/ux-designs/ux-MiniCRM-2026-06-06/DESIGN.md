---
name: min-crm
status: final
updated: 2026-06-06
inherits: iSolution Design System (Claude Design tokens)
# This spine is INTENTIONALLY THIN. min-crm consumes the iSolution Design System for all
# visual values (color, type, spacing, radius, elevation, components). It does NOT re-derive
# or re-color. The only values authored here are MOTION — the one layer the DS does not own.

# --- Consumed from the iSolution DS (by reference, not redefined) ---
colors: "{ds.color.*}"          # all hues, neutrals, surfaces — from the DS. No hex in this repo.
typography: "{ds.type.*}"       # families, scale, weights — from the DS.
rounded: "{ds.radius.*}"        # corner radii — from the DS.
spacing: "{ds.space.*}"         # spacing scale — from the DS.
elevation: "{ds.shadow.*}"      # shadow/elevation ramp — from the DS.

# --- Authored here (DEC-UX-2): motion tokens. Functional + light polish (DEC-UX-3). ---
# REALIZED in prototype/tokens/motion.css (DEC-UX-8/9). Durations unchanged; easing values updated
# to the realized curves; reduced-motion reconciled to the realized rule. Token names are --crm-*.
motion:
  source: "prototype/tokens/motion.css"   # realized source of record (DEC-UX-8)
  duration:
    instant: 0ms        # --crm-instant · optimistic apply (the mutation is already done)
    fast: 120ms         # --crm-fast · hover, focus ring, pill tone change, toast enter
    base: 200ms         # --crm-base · skeleton→ready, dialog/switcher enter, route, saga step
    slow: 320ms         # --crm-slow · rollback snap-back (deliberately the slowest — must be SEEN)
  easing:
    standard: "cubic-bezier(0.4, 0, 0.2, 1)"          # --crm-ease-standard · moves (on-screen)
    decelerate: "var(--iso-ease-out)"                 # --crm-ease-decelerate = cubic-bezier(0.22,1,0.36,1) · enters
    accelerate: "cubic-bezier(0.4, 0, 1, 1)"          # --crm-ease-accelerate · exits
  travel: "--crm-travel (1; → 0 under reduced-motion) — transform-distance scalar"
  reduced: "When prefers-reduced-motion: reduce — --crm-travel collapses to 0 and base/slow flatten
    to 120ms (fast stays 120ms, instant stays 0ms). No transforms, slide, or snap-back travel;
    opacity cross-fades survive; all state changes and all feedback still fire (DEC-UX-9)."

# --- Status tone → DS tone tokens. Mapping is OWNED by §3.3 STATUS_TONE; never recolored here. ---
tone:
  source: "shared/domain/status.ts → STATUS_TONE"
  map:
    neutral: "{ds.color.tone.neutral}"
    info:    "{ds.color.tone.info}"
    success: "{ds.color.tone.success}"
    warning: "{ds.color.tone.warning}"
    danger:  "{ds.color.tone.danger}"

components: "{ds.components.*}"  # the iSolution DS components back the §8.3 inventory.
---

# min-crm — Visual Identity (Design Spine)

> **Read this first.** min-crm's visual identity **is** the iSolution Design System. This file
> does not restate the DS — it records *which* DS tokens we consume and the one thing the DS
> does not provide: **motion**. For all color, type, spacing, radius, and elevation values, go to
> the iSolution DS. No hardcoded hex / px / font appears anywhere in this product (NFR-10, §8.4).
> Behavior, states, and interaction live in the peer spine: [EXPERIENCE.md](EXPERIENCE.md).

## Brand & Style

min-crm is an **operational tool for internal CRM agents** (sales, support, tenant admins) — not
a marketing surface. The aesthetic the DS already encodes is honored as-is; min-crm's contribution
to "feel" is behavioral restraint: **clarity over chrome** (see EXPERIENCE.md → Design Principles).
Density is comfortable-to-dense (data tables are the primary surface); never decorative.

## Colors

Consumed entirely from `{ds.color.*}`. **Status color is special:** it flows *only* through
`STATUS_TONE` (§3.3) → the five tone tokens above → DS tone colors. A screen never picks a status
color directly, and no entity status maps to a tone except through `STATUS_TONE`. This is the
single rule that keeps lead/ticket/customer/priority pills consistent across the app.

## Typography · Layout & Spacing · Shapes

Inherited unchanged from `{ds.type.*}`, `{ds.space.*}`, `{ds.radius.*}`. No overrides.

## Elevation & Depth

Inherited from `{ds.shadow.*}`. Usage convention (behavioral, not new values): resting surfaces
flat; **only transient overlays raise** — `ConfirmDialog`, `Toast`, the tenant/subsidiary switcher
popover, and active row menus. The saga inspector is an *in-page* `DetailPage` variant and does
**not** elevate (it is not a modal — NFR-10 forbids a new layout).

## Motion (authored — the layer on top of the DS)

The only visual values this spine defines (DEC-UX-2). Philosophy: **motion must mean something.**
Every animation maps to a state change the user needs to perceive; nothing moves for decoration.

| Token | Value | Used for |
|---|---|---|
| `motion.duration.instant` | 0ms | Optimistic apply — the mutation result paints immediately, no transition. |
| `motion.duration.fast` | 120ms | Hover, focus ring, StatusPill tone change, toast enter, filter-chip add/remove. |
| `motion.duration.base` | 200ms | Skeleton→ready cross-fade, dialog/switcher enter, route transition, saga step advance. |
| `motion.duration.slow` | 320ms | **Rollback snap-back** — deliberately the slowest, so a reverted optimistic write is *seen*, not missed. |

Easing: `standard` for moves, `decelerate` for entering elements, `accelerate` for exits.
**`prefers-reduced-motion: reduce` is honored** per the `motion.reduced` rule above — opacity
cross-fades survive (at `fast`); all travel/transform/snap-back is removed, state still changes
instantly and legibly. **Realized (DEC-UX-8/9): these tokens now live in `prototype/tokens/motion.css`**
as `--crm-instant/--crm-fast/--crm-base/--crm-slow` + `--crm-ease-standard/-decelerate/-accelerate`
+ the `--crm-travel` scalar; product code references those token names, never raw ms/curves. *If the*
*iSolution DS later ships motion tokens, defer to them.*

## Do's and Don'ts

- ✅ Reference DS tokens by name; let the DS own every color/type/space/radius value.
- ✅ Drive every status color through `STATUS_TONE` → tone token.
- ✅ Reserve elevation for transient overlays; keep data surfaces flat.
- ✅ Animate only state changes the user must perceive; make rollback the most visible motion.
- ❌ No hardcoded hex / px / font (NFR-10). ❌ No per-screen status colors. ❌ No decorative motion.
- ❌ No new elevation values, no modal for the saga inspector, no motion that ignores `reduced`.
