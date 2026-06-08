# Sprint Change Proposal — 2026-06-08

**Workflow:** `bmad-correct-course` · **Author:** Heba (with the dev agent) · **Mode:** Batch
**Trigger:** two threads in one correct-course run —
1. **UI fidelity (E1):** the implemented tenancy UI (E1-S2/S3/S4/S5) diverges from `prototype/` in concrete, listed ways. Goal: pin the prototype unambiguously in the "UX & Behavior (from prototype)" ACs so a `bmad-dev-story` re-run aligns the code.
2. **Sign-in flow (E0):** E0-S5/E0-S6 sign-in is broken — roles load but login never lands in the app; the user appears redirected back to `/sign-in`. Goal: fix in code this pass + add a test.

**UI source of truth:** `prototype/screenshots/` + `prototype/tokens/` + project-context **§8.5–§8.10**. Conflicts were **escalated for ruling, not silently overwritten.**

---

## 1. Issue Summary

### 1a. Sign-in flow (E0-S5 AuthProvider/mock SSO, E0-S6 route guard) — **fixed in code**
The session machinery was sound — `AuthProvider` sits above `BrowserRouter`, `signIn()` set the session, `/sign-in` was already public, and `RequireAuth` already checked `session === null`. The single defect: **after a successful `signIn()`, nothing navigated off `/sign-in`** — `SignInPage` never called `navigate()` and the `/sign-in` route did not bounce an already-authenticated user into the app. The session was set in context but the URL stayed at `/sign-in`, so the user appeared "stuck / redirected back." Separately, the session lived only in React state, so a reload returned to `/sign-in` ("never persists").

### 1b. UI fidelity (E1 tenancy) — **ACs tightened; code to be re-aligned**
A prototype-vs-implementation audit found concrete divergences across E1-S2/S3/S4/S5: dropped empty-state icons + scope lines, missing copy, locale-dependent dates, raw color/scrim values instead of tokens, hardcoded motion timings, swapped sidebar icons, a flattened nav, and two **behavioral** bugs (offboard re-scopes orphans to the wrong owner; roll-up empty-state predicate). The "UX & Behavior" ACs were too loose to prevent the drift. Full evidence: the audit table reproduced in §4c.

---

## 2. Impact Analysis

| Artifact | Impact |
|---|---|
| **E0-S5** | +AC5 (session establishment, `sessionStorage` persistence, post-login landing) + test req. |
| **E0-S6** | +AC7 (public `/sign-in`, recognize session before redirect, `from` round-trip; distinct from out-of-tenant 404). |
| **E1-S2/S3/S4/S5** | "UX & Behavior" ACs tightened with explicit fidelity pins; **E1-S5 AC1** corrected (contradicted AC3); **E1-S5 AC4** empty-predicate pinned; **E1-S3 AC3** owner re-scope pinned. |
| **project-context.md §6.2** | New **roll-up** permission row (admin tenant-wide; others scoped) + DEC-CC-6 note. |
| **decision-log.md** | New 2026-06-08 section: **DEC-CC-5/6/7** + pre-existing-gate flag. |
| **Code (this pass)** | `src/shared/auth/AuthProvider.tsx`, `src/app/router.tsx`, `src/test-setup.ts`, new `src/app/SignInFlow.test.tsx`. |
| **Code (E1, deferred to dev-story)** | `SubsidiariesPage`, `OffboardDialog`, `AppShell`, `RollupPage`/`useRollup`, `DataTable`/`QueryStateBoundary` empty-config types. |

**Technical:** `vitest` **562/562 green** (incl. 3 new sign-in specs). ⚠️ **`tsc -b` is RED on the branch independent of this fix** — 4 pre-existing errors in E1 code (see §4d).

---

## 3. Recommended Approach

**Direct Adjustment** (no rollback, no MVP change), split by thread per Heba's ruling:
- **Sign-in (E0):** implemented now on `fix/e0-s5-sign-in` with a regression test — Minor scope, Developer-direct.
- **UI fidelity (E1):** ACs tightened + decisions logged now; **code re-aligned by a `bmad-dev-story` re-run** per story. Moderate scope.

---

## 4. Detailed Change Proposals

### 4a. Sign-in flow — code changes (applied)
- **`AuthProvider.tsx`:** persist the established session to `sessionStorage` (`mincrm.auth.session`); lazy-restore on mount **silently** (no `Auth.LoggedIn` re-emit; malformed/expired blob ignored); clear on `signOut`; keep persisted scope in sync on `setSubsidiaryScope`. Storage access guarded (degrades to in-memory, never throws).
- **`router.tsx`:** `SignInPage` redirects to `from` (default `/` → `/rollup`) once `isAuthenticated`; `RequireAuth` stamps `state={{ from: location }}` on its redirect so sign-in returns the user where they were headed; never loops back to `/sign-in`.
- **`test-setup.ts`:** clear `sessionStorage` in the global `afterEach` (guarded for node-env) so a `signIn()` in one spec can't leak a restored session into the next.
- **`SignInFlow.test.tsx` (new):** unauth → bounced to public `/sign-in`; pick "Tenant Admin" → lands on `/rollup` off `/sign-in` + session persisted; reload (fresh mount) stays signed in.

### 4b. Sign-in flow — AC tightenings (applied)
- **E0-S5 AC5** (DEC-CC-7): establish + persist + land; silent restore; storage-scope note.
- **E0-S6 AC7** (DEC-CC-7): public `/sign-in`; recognize session before redirect; `from` round-trip; distinct from out-of-tenant 404.

### 4c. UI fidelity — AC tightenings (applied; oracle = prototype/tokens/§8.5–§8.10)
Each story gained a **"Correct-course fidelity pins (DEC-CC-5)"** block; behavioral fixes also amended the ACs:

- **E1-S2 (Onboard):** empty-state `network` icon + "Northwind Trading" scope line (needs `DataTable.EmptyConfig.icon`/`scopeLine`); full two-sentence subtitle; `"12 Jan 2026"` date (no `toLocaleDateString`); info-strip `--iso-blue-3-50`; OutcomePicker `flask-conical` + dashed `--iso-blue-3-300` segmented toggle; rollback toast `"Couldn't onboard — rolled back."` (trailing period, persistent, Retry); modal scrim DS token (DEC-CC-4) + top-anchored; Toggle uses `--crm-travel`.
- **E1-S3 (Offboard):** **[behavioral, AC3]** orphan `ownerId`/`assigneeId` → **target subsidiary's default owner** (`SUB_PEOPLE[targetId]`), not the acting admin; **[behavioral]** scope snap-back via `setSubsidiaryScope(null,…)` when the offboarded sub is the active scope; tick cadence a named `--crm-base`-derived constant (not hardcoded `100`/`200`); impact-card `--iso-blue-3-50`; scrim DS token; exact toast strings + safe-Cancel focus + Esc-suppressed-while-running.
- **E1-S4 (Switcher):** sidebar **two groups** (Workspace / Tenancy); icons **Subsidiaries=`network`**, **Roll-up=`layers`** (currently swapped); roll-up nav visible to **all roles** via `rollup.view` (DEC-CC-6, prototype nav stale); dropdown copy/icons pinned; `scopeLoading` skeleton at a `--crm-base+220ms` named constant, scope-keyed query caches.
- **E1-S5 (Roll-up):** **[AC1 corrected]** gated by `rollup.view` — admin tenant-wide, others scoped (was the contradictory "tenant_admin-only"); **[AC4 pinned]** empty fires on `grandTotal === 0` regardless of sub count; eyebrow = role **label** + scope **display name** (not raw id + `tenantId`); empty `layers` icon + scope line; table layout/copy already match (pinned to keep).

### 4d. Pre-existing gate — flagged, NOT fixed here
`tsc -b` is red on the branch with this fix **stashed** (i.e. not caused by it). 4 errors, all E1:
- `src/features/dashboard/useRollup.ts:82-83` — repo generic not extending `BaseEntity`; `string | null` filter value not assignable.
- `src/shared/auth/permissions.test.ts:64` — expected-matrix type missing `"rollup.view"`.
- `src/app/AppShellWithSubsidiaries.test.tsx:7` — unused `beforeEach` import.

These belong to the **E1 `bmad-dev-story` re-alignment** and must be cleared so `tsc -b` is green before E1 merges.

---

## 5. Implementation Handoff

- **Sign-in (Minor — Developer-direct, DONE):** code + test applied on `fix/e0-s5-sign-in`; `vitest` 562/562 green; changed files lint clean and add no `tsc` errors. **Next:** open a PR (`Closes #<E0-S5/E0-S6 issue>`); the pre-existing `tsc -b` red (§4d) should be resolved on the E1 track, or split so CI's typecheck gate is not blocked by E1 debt.
- **UI fidelity (Moderate — DEV via `bmad-dev-story`):** re-run `bmad-dev-story` per story (E1-S2 → E1-S3 → E1-S4 → E1-S5) against the tightened ACs; also widen `DataTable.EmptyConfig`/`QueryStateBoundary.EmptyConfig` to carry `icon` + `scopeLine`, and clear the §4d `tsc -b` errors. Re-run `bmad-code-review` after each.
- **Rulings captured:** **C-5 → keep spec** (DEC-CC-6, §6.2 row added); **C-6 → DS scrim token** (reaffirms DEC-CC-4); **C-7 → prefer shared `PageHeader`/`Card`** (§8.3) over hand-rolled headers.

### Success criteria
Sign-in: pick a role → land in the app; reload stays signed in; tests green. E1: each story's code matches the pinned ACs; empty states show the prototype icon + scope line; the two behavioral bugs fixed; `tsc -b` green; `bmad-code-review` clean.
