# min-crm — Constitution Decision Log

Per `project-context.md`: *"Deviations require an explicit entry in `decision-log.md` with a reason."*
This file records amendments to the standardization constitution (`project-context.md`).

## 2026-06-07 — Prototype reconciliation (correct-course)

Context: the Claude Design prototype (`prototype/`) was adopted as the realized UX source of truth.
Four prototype-vs-constitution conflicts were escalated (not silently overwritten) and ruled on by
Heba. Full analysis: `_bmad-output/planning-artifacts/sprint-change-proposal-2026-06-07.md` §4.

- **DEC-CC-1 — Ticket creation granted to every role.** (Conflict C-1; ruled *adopt prototype*.)
  §6.2 amended: ticket **create** is now allowed for `tenant_admin`, `sales`, `support`, **and
  `viewer`** — tickets are the one entity anyone in scope may raise. Ticket **edit/assign** unchanged
  (admin/support write; sales/viewer read). **Reason:** matches the prototype's "anyone can raise a
  ticket" model; low risk (create only; edit/assign still gated). **Affects:** §6.2 matrix, E4-S1 AC1.

- **DEC-CC-2 — Customer activation gate + two new Customer fields.** (Conflict C-3; ruled *adopt*.)
  §2.2 `Customer` gains optional `taxRegistrationNumber?` and `contactAddress?`; §3.2 gains an
  **activation precondition**: `onboarding → active` is rejected `422` (inline, no pill change, no
  event) unless **both** fields are set. **Reason:** a coherent, valuable business rule realized in
  the prototype; treated as a logged shared-API change to the `Customer` entity (a shared capability).
  `CUSTOMER_TRANSITIONS` is structurally unchanged (precondition on a legal edge, not a new edge).
  **Affects:** §2.2, §3.2, E0-S2 (entity fields), E3-S2 (gate AC), E3-S3 (form/detail fields).

- **DEC-CC-3 — `RecordPager` + side-by-side view added to the §8.3 inventory.** (Conflict C-4; ruled
  *add to inventory*; NFR-10 exception.) §8.3 inventory gains `RecordPager` (prev/next respecting
  list order, "N of M", Side/Full toggle, Close, keyboard nav) and a per-user **Side view** layout
  hosted on the DetailPage template. **Reason:** valuable navigation the prototype proved; approved
  as an inventory extension (not a per-screen one-off). **No other** new layouts permitted.
  **Affects:** §8.3, E0-S9.

- **C-2 — Support editing customers: NO CHANGE (kept constitution).** The prototype grants `support`
  write on customers; the constitution keeps **`support = read`** on customer fields (§6.2). Support
  still reads customers and may drive customer status transitions for onboarding. **Reason:** preserve
  the role boundary; the prototype's wider grant is the divergence to *not* build. No constitution or
  AC change; recorded here for traceability. **Surfaced in E3-S3 AC6** so the divergence is not
  silently rebuilt from the "build identical to the prototype" instruction.

## 2026-06-07 — Pass-2 readiness reconciliation follow-ups

Recorded after the Pass-2 implementation-readiness check
(`_bmad-output/planning-artifacts/implementation-readiness-report-2026-06-07.md`).

- **DEC-CC-4 — Modal overlay scrim is a token, not a raw value (NFR-10/§8.4 reaffirmed).** The
  prototype renders the `ModalShell`/`ConfirmDialog` scrim as the literal `rgba(15,22,38,0.42)` +
  `blur(2px)`. Per NFR-10/§8.4 ("no hardcoded hex/px") and DESIGN.md ("No hex in this repo"), the
  shared component MUST reference **DS scrim/blur tokens** (realized as `--crm-scrim` +
  `--crm-backdrop-blur` in `src/shared/ui/tokens.css`); add them to the token layer if the DS does not expose them. The literal above is recorded **only**
  as the realized target value — it is not to be inlined in components. **Affects:** E0-S9 (UX block).
- **E3-S3 customer create/edit formalized.** The `CustomerForm` create/edit (the only way to set the
  DEC-CC-2 `taxRegistrationNumber`/`contactAddress` that back the E3-S2 activation gate) is now an
  explicit AC (E3-S3 AC5) carrying **UC-2**, gated by **C-2** (admin/sales write; support/viewer read,
  AC6). No constitution change — this closes a gap where the load-bearing edit mutation lived only in
  E3-S3's UX prose.

## 2026-06-08 — UI-fidelity correct-course (E1) + sign-in flow fix (E0)

Triggered by a correct-course run (`_bmad-output/planning-artifacts/sprint-change-proposal-2026-06-08.md`).
Two threads: (a) the implemented E1 tenancy UI diverged from `prototype/` in concrete, listed ways —
ACs were tightened to pin the prototype unambiguously (code to be re-aligned via `bmad-dev-story`); and
(b) the E0-S5/E0-S6 sign-in flow was broken (login never landed in the app) — fixed in code this pass.
The prototype + `prototype/tokens` + project-context §8.5–§8.10 remain the UI source of truth; conflicts
were escalated for ruling (below), not silently overwritten.

- **DEC-CC-5 — E1 tenancy UI pinned to the prototype.** The "UX & Behavior (from prototype)" ACs of
  **E1-S2/S3/S4/S5** were tightened to pin the divergences found in the audit (exact copy strings,
  empty-state **icon + scope-framed line** per §8.7, **date format**, info-strip/scrim **tokens** not raw
  values, motion **constants derived from `--crm-*`** per §8.6/NFR-10, sidebar nav **grouping + per-item
  icons**, and the behavioral fixes below). **Reason:** the prototype is the realized UI SoT (CLAUDE.md §7);
  the prior ACs were underspecified, which let the code drift. No constitution change. **Behavioral pins
  (not cosmetic):** (1) **E1-S3** offboard re-scopes orphaned `ownerId`/`assigneeId` to the **target
  subsidiary's default owner**, *not* the acting admin; and snaps the active scope back to tenant via
  `setSubsidiaryScope(null, …)` when the offboarded sub was the current scope. (2) **E1-S5** the empty
  state fires on `grandTotal === 0` **regardless of subsidiary count** (an all-zero-records tenant shows
  empty, not an all-zeros table); the eyebrow shows the **role label + scope display name**, not the raw
  role id + `tenantId`. **Shared-infra gap:** `DataTable.EmptyConfig` and `QueryStateBoundary.EmptyConfig`
  must carry `icon` + `scopeLine` so every E1 empty state can render the prototype icon and the §8.7 scope
  line (currently they cannot). **Affects:** E1-S2/S3/S4/S5 ACs; `DataTable`/`QueryStateBoundary` types.
  **Reaffirms DEC-CC-4** (modal scrim must be a DS token — neither the prototype's `rgba(15,22,38,0.42)`
  nor the impl's `rgba(0,0,0,0.25)` is to be inlined) and **§8.3** (prefer a shared `PageHeader`/`Card`
  over the hand-rolled page headers in `SubsidiariesPage`/`RollupPage`).

- **DEC-CC-6 — Roll-up is visible to every role, scoped (conflict C-5; ruled *keep constitution/spec*).**
  The prototype gates the Roll-up nav to `tenant_admin` only (`config.jsx:43`); the encoded permission
  matrix (`permissions.ts` `rollup.view`) and **E1-S5 AC3** grant `sales`/`support`/`viewer` a
  **scope-limited** roll-up (own subsidiary + parent-level). The implementation follows the matrix/AC3.
  **Ruled (Heba, 2026-06-08): keep the spec** — the prototype's admin-only nav is the stale artifact and
  is not to be rebuilt. §6.2 gains an explicit **roll-up row** (admin tenant-wide; others scoped); the
  contradictory **E1-S5 AC1 "tenant_admin-only"** phrasing is corrected to match AC3; **E1-S4** nav
  role-gating keeps the roll-up entry visible to all roles (gated by `rollup.view`). **Reason:** the
  scoped roll-up is the explicitly designed UJ-5 behavior, and it keeps the default post-sign-in landing
  (`/rollup`) reachable for every role. **Affects:** §6.2 (new row), E1-S5 AC1, E1-S4 nav AC.

- **DEC-CC-7 — Mock sign-in establishes, persists, and lands a session (E0-S5/E0-S6).** The sign-in flow
  was broken: `signIn` set the session in context but nothing navigated off `/sign-in`, so the user
  appeared "stuck / redirected back." Fixed **in code this pass**: (1) `AuthProvider` now **persists** the
  established session to **`sessionStorage`** (`mincrm.auth.session`) and restores it on mount **silently**
  (no `Auth.LoggedIn` re-emit on reload), clearing it on `signOut`; a reload keeps the user signed in.
  (2) `/sign-in` is a **public route**; `RouteGuard`/`RequireAuth` **recognize an authenticated session**
  before redirecting, and an unauthenticated visit carries `from` so sign-in returns the user there;
  (3) on sign-in the app **redirects to the app home** (`/` → `/rollup`). **Reason:** the E0-S5 contract
  ("session established at the shell, lands on Dashboard") was unmet end-to-end. **Scope note:** `sessionStorage`
  is the auth kernel's own session store — the CLAUDE.md "persist only via `Repository<T>`" rule governs
  tenant-scoped *entity* persistence, not the auth seam's session; OIDC (AC4) later replaces this store
  behind the same seam. **Affects:** `src/shared/auth/AuthProvider.tsx`, `src/app/router.tsx`,
  `src/app/SignInFlow.test.tsx`, E0-S5 + E0-S6 ACs.

- **DEC-CC-8 — Offboard preserves the existing owner; no per-subsidiary owner roster (E1-S3).** The
  prototype's `commitOffboard` re-scopes orphaned records to the **target subsidiary's default person**
  (`SUB_PEOPLE[targetId]` — lead/customer owner → that sub's sales rep, ticket assignee → its support
  rep). That static roster has **no equivalent in this app**: subsidiary IDs are runtime-generated (not
  the prototype's `eu`/`us`/`apac` keys), only the mock identities exist, and **`Customer` has no owner
  field at all**. The prior code wrongly reassigned orphaned leads/tickets to the **acting admin**
  (`session.userId`). **Ruled (Heba, 2026-06-08): preserve the existing owner** — the offboard saga moves
  only `subsidiaryId`; each record's `ownerId`/`assigneeId` is carried over untouched (consistent with
  customers, which already had no owner patch). **Reason:** build-safe, fabricates no identity data,
  removes the admin-assignment bug, and still satisfies the story goal ("data stays owned and visible").
  This is a **deviation from the prototype's owner-reassignment**, recorded here rather than silently
  built; if a per-subsidiary owner seam is wanted later, revisit with a real roster. **Affects:** E1-S3
  AC3 + UX pin; `src/features/tenancy/OffboardDialog.tsx` (lead/ticket reassign patches → `{}`).

- **Pre-existing gate (flagged, NOT fixed here):** `tsc -b` is **red on the branch independent of the
  sign-in fix** — 4 errors in E1 code: `src/features/dashboard/useRollup.ts:82-83` (repo generic not
  extending `BaseEntity`; `string | null` filter value), `src/shared/auth/permissions.test.ts:64`
  (expected-matrix type missing `"rollup.view"`), and an unused `beforeEach` import in
  `src/app/AppShellWithSubsidiaries.test.tsx:7`. The sign-in fix adds **zero** new type errors
  (`vitest` 562/562 green). These belong to the **E1 `bmad-dev-story` re-alignment** and must be cleared
  there so the `tsc -b` gate is green before E1 merges.
