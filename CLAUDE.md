# CLAUDE.md — min-crm

min-crm is a multi-tenant mini CRM (lead management → lead-to-customer → ticketing), built as **Product A on the iSolution Platform Boilerplate**. Stack: TypeScript, React (Vite), localStorage (behind a repository seam), deploy on Vercel. This is the **production frontend on a localStorage adapter**, not a throwaway.

## Authoritative docs (open for detail — don't duplicate here)
- Standard / constitution (source of truth on any conflict): `_bmad-output/project-context.md`
- Stories (id, ACs, depends_on): `_bmad-output/planning-artifacts/epics/`
- Architecture + ADRs: `_bmad-output/planning-artifacts/architecture.md`
- UI source of truth: `prototype/screenshots/` + `prototype/tokens/`; interaction/motion rules in project-context §8.5–§8.10

## Non-negotiable rules (apply on every story)
1. **Layering:** `src/features/*` → `src/shared/*` → external ports. Never import upward. External systems (Odoo/Unifonic/cloud) stay behind ports and are OFF in the pilot.
2. **Entities** extend `BaseEntity` (`id, tenantId, subsidiaryId, createdAt/By, updatedAt/By, version, deletedAt`). Every record is tenant-scoped (subsidiary-scoped where applicable). Soft-delete by default.
3. **Persistence only via `Repository<T>`** — never call `localStorage` from feature code. Scope (tenant + subsidiary) is read from the auth context inside the repository; never passed by callers or trusted from the client.
4. **4-beat for every mutation:** authorize → mutate → emit (one domain event) → audit (one audit record), sharing one `correlationId`. No silent writes.
5. **Statuses come only from `src/shared/domain/status.ts`** (enums + transition maps + STATUS_TONE). An illegal transition is rejected (422) and the StatusPill does NOT change — show an inline message with the next legal step. Customer is 5-state (prospect→onboarding→active→inactive→churned); ticket `closed` is terminal (reopen only via resolved→open).
6. **RBAC = two gates** (route + action) from the permission matrix; `own`/`restricted` predicates per ADR-015; hard-delete never granted. Out-of-tenant access returns **404, never 403**. Deny-wins.
7. **UI:** assemble only from the shared component inventory — no new layouts. Every data view has four states: loading / empty / error / ready. Status shows only via `StatusPill` (tone from STATUS_TONE, always labelled). **No hardcoded hex/px/font — tokens only**, from `prototype/tokens`. Match the prototype screen and the §8.5–§8.10 motion/interaction rules (optimistic apply at instant; rollback snap-back at slow + toast).
8. **Activity timeline** (per-record, gated by record-view permission, viewer included) is distinct from the **Audit/Events log** (matrix-gated, viewer = none).

## Folder structure
`src/app` (shell, routing, providers) · `src/shared/{data,domain,auth,events,ui,config}` · `src/features/{leads,customers,tickets,dashboard}`

## How to work in this repo
- Implement one story at a time against its story file. **Reuse the shared kernels** (status, entities, Repository, auth, events, UI) — do not redefine them.
- Run `npm run test:run` before committing; `npm run dev` to view locally (http://localhost:5173).
- Definition of Done: meets the story's ACs · uses shared modules (no duplicated tenant/auth/repo/UI/status/event patterns) · scope enforced via auth context · statuses/transitions correct · one audit + one domain event per mutation · four UI states present · tests pass · PR body `Closes #<issue>`.
- This file is the fast reference; `_bmad-output/project-context.md` is the full standard and wins on any conflict.
