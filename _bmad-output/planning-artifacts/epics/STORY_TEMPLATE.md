# Universal Story Template — Epic 1–5

> **How to use:** Copy this template when creating a new feature story. Every Epic 1–5
> story inherits these Universal Conformance ACs and the DoD checklist. Fill in the
> `{{STORY_*}}` placeholders and add story-specific ACs below the universal set.
>
> **Authoritative standard:** `_bmad-output/project-context.md` § 10 — Definition of Done.
> This template is a living checklist derived from that standard; the constitution wins on
> any conflict.

---

## Story Header

```yaml
id: "{{STORY_ID}}"            # e.g. E1-S1
title: "{{STORY_TITLE}}"
epic: "{{EPIC_NAME}}"
feature: "{{FEATURE_NAME}}"
cut: pilot
status: backlog
depends_on: []               # list story IDs
inherits_uc: [UC-1, UC-2, UC-3, UC-4, UC-5, TC]
adrs: []                     # list relevant ADRs
constitution_refs: ["§10"]
```

---

## Story

As {{role}},
{{capability / what I want}},
so that {{business value}}.

---

## Story-Specific Acceptance Criteria

> Add story-specific ACs here (numbered from 1). The Universal Conformance ACs below
> are inherited on every story and do NOT need to be repeated in the ACs list — they
> are automatically part of every story's DoD.

1. **AC1 — {{Title}}.** {{Description}}
   *Files:* `{{path}}` · *Seam:* {{seam}} · *Schema/Map:* {{schema_or_map}}.

---

## Universal Conformance ACs (inherited — do not modify per story)

These five conformance constraints are verified by `bmad-code-review` on every story.

- **UC-1 — Four UI states (E0-S9).** Every data-backed view has exactly four states:
  `loading` (skeleton mirroring the layout) · `empty` (illustration + primary action) ·
  `error` (contained panel + [Retry] → `refetch()`) · `ready` (content).
  Gate: `<QueryStateBoundary>` used; no manual four-way branching.

- **UC-2 — Dual event + correlationId (E0-S7).** Every mutation emits exactly one
  `DomainEvent` + one `AuditEvent` sharing one `correlationId`.
  Gate: `expectOneOpOneEventOneAuditAsync` helper in every mutation test.

- **UC-3 — Illegal-transition 422 (E0-S1/S4).** An illegal status transition is
  rejected (422) and the `StatusPill` does NOT change — an inline message shows the
  next legal step.
  Gate: test asserts `RepositoryError(422)` on every illegal transition path.

- **UC-4 — Conversion-only-from-qualified (E0-S1).** A lead can only be converted
  when its status is `qualified`; any other status rejects the conversion attempt.
  Gate: transition map test asserts `qualified → converted` is the only conversion path.

- **UC-5 — Tenant isolation / 404 (E0-S4/S6).** Out-of-tenant access returns 404,
  never 403. Scoping comes from the auth context only — never from props or URL.
  Gate: cross-tenant test asserts 404 (or null on `get`) for all cross-tenant operations.

---

## Inherited TC — Traceability

- Story → spec → code → test → GitHub issue (`Closes #<issue>` in PR body)
- `sprint-status.yaml` updated to `done` by dev agent on completion
- Preview deploy green before merge
- Passes `bmad-code-review`

---

## Architecture — components, seams & modules touched

- **New files:** (list)
- **Modified files:** (list)
- **Seams used:** (Repository<T>, EventBus, AuditLog, StatusPill, QueryStateBoundary, …)
- **ADRs:** (list)

---

## Test Requirements (NFR-12)

- **Vitest (unit):** (describe what unit-level tests are needed)
- **RTL (component):** four states · optimistic rollback · form validation
- **Playwright (E2E):** (any user-journey test needed; cross-tenant or lifecycle)

---

## Dev Notes

> Fill in file paths, algorithm details, previous story intelligence, and compiler
> constraints. Compiler rules are non-negotiable for every story:
>
> - `verbatimModuleSyntax: true` → `import type` for type-only imports
> - `erasableSyntaxOnly: true` → no TS `enum`, no decorators
> - No bare `React` global — `import React from 'react'` or named imports
> - `.tsx` for JSX files, `.ts` for pure logic
> - No barrel `index.ts` — direct-file imports only

---

## Definition of Done Checklist

Copy this checklist into the story's completion notes.

### Functional
- [ ] Meets all story-specific ACs
- [ ] Statuses only from `src/shared/domain/status.ts`; illegal transitions rejected with 422; `StatusPill` shows inline message with next legal step (UC-3)
- [ ] Every mutation emits exactly 1 `DomainEvent` + 1 `AuditEvent` sharing one `correlationId` (UC-2)
- [ ] Tenant + subsidiary scoping enforced via auth context; out-of-tenant access returns 404 (UC-5)

### UI (if story includes views)
- [ ] All four states present: `loading` (skeleton) · `empty` (illustration + action) · `error` (message + retry) · `ready` (UC-1)
- [ ] `<QueryStateBoundary>` used — no manual four-way branching
- [ ] Tokens only — no hardcoded hex / px / font
- [ ] Optimistic apply at instant; rollback snap-back + toast on error (ADR-007)
- [ ] Status displayed only via `<StatusPill tone={STATUS_TONE[status]} label={status} />`

### Quality gates
- [ ] `npx tsc -b` clean
- [ ] `npm run lint` clean
- [ ] `npm run test:run` — all Vitest tests green (no regressions; covers ACs + UC-2 helper)
- [ ] Passes `bmad-code-review`

### Traceability (TC)
- [ ] Story → spec → code → test → GitHub issue (`Closes #<issue>`)
- [ ] `sprint-status.yaml` updated to `done`
- [ ] Preview deploy green before merge

---

## References

- Constitution: `_bmad-output/project-context.md`
- Architecture + ADRs: `_bmad-output/planning-artifacts/architecture.md`
- UI source of truth: `prototype/screenshots/` + `prototype/tokens/`
- Testing stack: ADR-013 (Vitest + RTL + Playwright)
- Optimistic rollback: ADR-007
- Repository seam: ADR-004
