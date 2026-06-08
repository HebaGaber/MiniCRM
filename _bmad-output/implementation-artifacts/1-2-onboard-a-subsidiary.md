---
id: E1-S2
title: Onboard a subsidiary
baseline_commit: 4bb9544e36839054dc7db4edc7303409bcee70b7
status: review
---

# E1-S2 — Onboard a subsidiary

> **Backfilled implementation artifact.** The onboard surface was originally built and
> merged (PR #87) without an implementation artifact, and sprint-status still showed
> `1-2` as `backlog`. This file is created during the **correct-course UI-fidelity
> re-alignment** (`bmad-dev-story E1-S2`, 2026-06-08) that brought the code up to the
> tightened "UX & Behavior" ACs (DEC-CC-5). Authoritative spec:
> `_bmad-output/planning-artifacts/epics/epic-1-tenancy-subsidiary/E1-S2.md`.

## Story
As a tenant admin, I add a subsidiary node, so that a child unit can operate in isolation within my tenant.

## Acceptance Criteria (summary — full text in the epic story file)
- AC1 tenant_admin-only (route + action guard) · AC2 `Repository<Subsidiary>.create` under tenant scope, Zod-validated · AC3 one `Tenant.SubsidiaryAdded` + one audit on a shared correlationId · AC4 inherits tenant config · AC5 `EntityForm` four states + optimistic create/rollback.
- **UX & Behavior (from prototype) — DEC-CC-5 fidelity pins** (the focus of this re-alignment): empty-state `network` icon + "Northwind Trading" scope line; full two-sentence subtitle; deterministic `D MMM YYYY` date; info-strip `--iso-blue-3-50`; OutcomePicker dashed `flask-conical` segmented control; rollback toast `"Couldn't onboard — rolled back."`; DEC-CC-4 scrim token + top-anchored modal; `--crm-travel` Toggle.

## Tasks / Subtasks
- [x] **Shared infra** — widen `DataTable.EmptyConfig` with `icon?` + `scopeLine?` and plumb both to `<EmptyState>` (also unblocks E1-S5).
- [x] **Empty state (§8.7)** — `SubsidiariesPage` passes `icon: "network"` + `scopeLine: "Northwind Trading"`.
- [x] **Subtitle** — restore the dropped second sentence ("Offboarding reassigns active records before a subsidiary leaves.").
- [x] **Created column** — deterministic `en-GB` `D MMM YYYY` (`CREATED_FMT`), replacing locale-dependent `toLocaleDateString()`.
- [x] **Toggle (§8.6)** — knob travel via `calc(var(--crm-travel) * Npx)` so reduced-motion drops the slide.
- [x] **OnboardForm info-strip** — background token `--iso-blue-3-50` (was `--iso-brand-soft`).
- [x] **OnboardForm modal (DEC-CC-4)** — scrim via `--crm-scrim` + `--crm-backdrop-blur`, top-anchored (`flex-start`, `padding 64px 24px`, `overflow auto`), `z-index: var(--iso-z-modal)`; backdrop closes on outside `mousedown`.
- [x] **OutcomePicker** — dashed `--iso-blue-3-300` strip, `flask-conical` accent icon, "Simulate server response" label, segmented Success / Server-error toggle (`outcome-success`/`outcome-fail` testids preserved).
- [x] **Rollback toast** — title `"Couldn't onboard — rolled back."` (trailing period); body + Retry unchanged (persists by default — danger tone).
- [x] **Lint** — added the repo's `react-hooks/set-state-in-effect` inline-disable convention to the mount-load effect (was a pre-existing lint error noted in the 1-4 artifact).

## Dev Agent Record

### Agent Model Used
claude-opus-4-8[1m]

### Debug Log References
- RED: `SubsidiariesPage.fidelity.test.tsx` — 5/5 failing before changes (default `inbox` icon, missing scope line, locale date, plain-button OutcomePicker, no toast period).
- GREEN: 23/23 (5 fidelity + 18 existing E1-S2); full suite 567/567.

### Completion Notes List
- `DataTable.EmptyConfig` now carries `icon`/`scopeLine` → `<EmptyState>` (which already supported both); backward-compatible (optional, default `inbox`). Reused by E1-S5's QueryStateBoundary pass next.
- Empty state matches the prototype: `network` icon + "Northwind Trading" scope line + auto-focused primary action; the four states (loading/empty/error/ready) are preserved.
- Created date is now locale-deterministic via an explicit `en-GB` `Intl.DateTimeFormat` ("8 Jun 2026" form), not the CI/viewer locale's slash format.
- OnboardForm modal restructured to the prototype `ModalShell` shape: single scrim+flex container (DEC-CC-4 tokens, no raw `rgba`), panel top-anchored with `crm-pop`. Removed the now-unused `Button` import.
- OutcomePicker rebuilt as the dashed flask-conical segmented control; `data-testid` hooks kept so existing tests are unaffected.
- Rollback toast title gained the trailing period to match the prototype; persistence is implicit (danger toasts do not auto-dismiss).
- **Gates:** `vitest` 567/567 · touched files `eslint` clean · `npx tsc -b` adds **zero** new errors (the 4 remaining are pre-existing E1-S5 debt: `useRollup.ts:82-83`, `permissions.test.ts:64`, and an unused import in `AppShellWithSubsidiaries.test.tsx:7` — to be cleared in the E1-S5 re-alignment).

### File List
- `src/shared/ui/components/DataTable.tsx` — `EmptyConfig` gains `icon`/`scopeLine`; passed to `<EmptyState>`.
- `src/features/tenancy/SubsidiariesPage.tsx` — empty `icon`/`scopeLine`; full subtitle; `CREATED_FMT` date; `--crm-travel` Toggle; lint-disable on mount-load effect.
- `src/features/tenancy/OnboardForm.tsx` — scrim-token + top-anchored modal; info-strip token; rebuilt OutcomePicker; rollback toast period; removed unused `Button` import.
- `src/features/tenancy/SubsidiariesPage.fidelity.test.tsx` — NEW: 5 DEC-CC-5 fidelity specs.
- `_bmad-output/implementation-artifacts/1-2-onboard-a-subsidiary.md` — NEW: this artifact.
- `_bmad-output/implementation-artifacts/sprint-status.yaml` — `1-2` → in-progress → review.
- `_bmad-output/planning-artifacts/epics/epic-1-tenancy-subsidiary/E1-S2.md` — `baseline_commit` added to frontmatter (DEC-CC-5 pins were added in the prior correct-course pass).

## Change Log
- **2026-06-08** — UI-fidelity re-alignment to the prototype (DEC-CC-5): empty-state icon + scope line, subtitle, deterministic date, info-strip token, scrim token + top-anchored modal, dashed flask-conical OutcomePicker, rollback toast period, `--crm-travel` Toggle, shared `DataTable.EmptyConfig` widening. 5 new fidelity tests; suite 567/567. Status → review.

## Review Findings (code-review 2026-06-08)

Adversarial review — Blind Hunter (diff-only) + Edge Case Hunter (diff+repo) + Acceptance Auditor
(diff+spec). **Acceptance Auditor: all 5 ACs + all 8 DEC-CC-5/DEC-CC-4 pins satisfied.** Triage:
**0 decision-needed · 1 patch (fixed) · 3 defer · 8 dismissed.** Dismissed = the Blind Hunter's three
diff-only "High" flags, all cleared by the repo-access layer (focus-trap + Esc intact in unchanged code;
`onMouseDown` outside-click is correct + prototype-aligned; `--iso-z-modal: 900` exists, same pattern as
ConfirmDialog) + the `eslint-disable` is a real, used rule (lint green) + reduced-motion toggle matches the
prototype and conveys state via `aria-checked` + track color + lucide-class/literal nitpicks.

- [x] [Review][Patch] **Date assertion/format brittle across month + timezone.** The fidelity test regex `[A-Z][a-z]{2}` rejected `en-GB` September → "Sept" (4 chars, modern ICU), and `CREATED_FMT` had no `timeZone` (day could shift by viewer TZ). **Fixed** (2026-06-08): regex → `[A-Z][a-z]{2,3}`; formatter → `timeZone: "UTC"` (fully deterministic). [`SubsidiariesPage.tsx:25-30`, `SubsidiariesPage.fidelity.test.tsx`]
- [x] [Review][Defer] No "Invalid Date" guard in the Created cell — unreachable via `repo.create` (createdAt always valid ISO); defensive only. [`SubsidiariesPage.tsx`]
- [x] [Review][Defer] OutcomePicker uses raw `px` literals (matches the prototype's realized values) rather than spacing tokens — §8.6/NFR-10 token-debt, applies prototype-wide. [`OnboardForm.tsx` OutcomePicker]
- [x] [Review][Defer] Segmented OutcomePicker buttons lack `aria-pressed` (state conveyed visually); minor a11y, matches the prototype; dev-only fault-injection control. [`OnboardForm.tsx` OutcomePicker]

## Status
review
