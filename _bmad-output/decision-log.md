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
  shared component MUST reference a **DS scrim/blur token** (`--iso-overlay-scrim` + a blur token);
  add them to the token layer if the DS does not expose them. The literal above is recorded **only**
  as the realized target value — it is not to be inlined in components. **Affects:** E0-S9 (UX block).
- **E3-S3 customer create/edit formalized.** The `CustomerForm` create/edit (the only way to set the
  DEC-CC-2 `taxRegistrationNumber`/`contactAddress` that back the E3-S2 activation gate) is now an
  explicit AC (E3-S3 AC5) carrying **UC-2**, gated by **C-2** (admin/sales write; support/viewer read,
  AC6). No constitution change — this closes a gap where the load-bearing edit mutation lived only in
  E3-S3's UX prose.
