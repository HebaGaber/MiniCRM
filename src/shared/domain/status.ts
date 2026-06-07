// Single source of truth for every status literal, legal transition, and pill
// tone in the application. No feature may hardcode a status string or invent a
// transition — it imports from here. (NFR-3 single status source; NFR-1: this
// shared-layer module imports nothing from src/features/*.)
//
// Canonical source: _bmad-output/project-context.md §3 (copied verbatim).
// Status changelog: CustomerStatus expanded 3→5 states with CUSTOMER_TRANSITIONS
// added (DEC-1); ticket `closed` is terminal — reopen only via `resolved → open`
// (Flag C). Any further status change requires a decision-log entry.

// ── §3.1 Definitions ───────────────────────────────────────────────────────
// String-literal unions only — no TS `enum` (it emits runtime code and is
// rejected by `erasableSyntaxOnly: true`; see tsconfig.app.json).

export type TenantStatus   = "active" | "suspended";
export type CustomerStatus = "prospect" | "onboarding" | "active" | "inactive" | "churned"; // DEC-1: 5-state lifecycle
export type LeadStatus     = "new" | "contacted" | "qualified" | "disqualified" | "converted";
export type LeadSource     = "web" | "referral" | "event" | "outbound" | "import";
export type TicketStatus   = "open" | "in_progress" | "pending" | "resolved" | "closed";
export type TicketPriority = "low" | "medium" | "high" | "urgent";
export type Role           = "tenant_admin" | "sales" | "support" | "viewer";

// ── §3.2 Allowed transitions (state machines — enforced in the service layer) ─

export const LEAD_TRANSITIONS: Record<LeadStatus, LeadStatus[]> = {
  new:          ["contacted", "disqualified"],
  contacted:    ["qualified", "disqualified"],
  qualified:    ["converted", "disqualified"],
  disqualified: ["contacted"],          // can be revived
  converted:    [],                      // terminal
};

// DEC-1: conversion lands the customer in `prospect`; onboarding workflow walks it to `active`
export const CUSTOMER_TRANSITIONS: Record<CustomerStatus, CustomerStatus[]> = {
  prospect:   ["onboarding"],
  onboarding: ["active"],
  active:     ["inactive", "churned"],
  inactive:   ["active", "churned"],     // reactivation allowed
  churned:    [],                         // terminal
};

export const TICKET_TRANSITIONS: Record<TicketStatus, TicketStatus[]> = {
  open:        ["in_progress", "pending", "closed"],
  in_progress: ["pending", "resolved", "open"],
  pending:     ["in_progress", "resolved"],
  resolved:    ["closed", "open"],       // reopen allowed from resolved
  closed:      [],                        // Flag C: terminal (reopen only via resolved → open)
};

// ── §3.3 Status → UI tone mapping (read by the StatusPill component ONLY) ─────
// tone ∈ neutral | info | success | warning | danger.
// Scope is the four pill-rendered categories. TenantStatus, LeadSource, and
// Role are NOT pill-rendered and intentionally have no tone here.

export const STATUS_TONE = {
  lead:   { new:"neutral", contacted:"info", qualified:"success", disqualified:"danger", converted:"success" },
  ticket: { open:"info", in_progress:"warning", pending:"neutral", resolved:"success", closed:"neutral" },
  priority:{ low:"neutral", medium:"info", high:"warning", urgent:"danger" },
  customer:{ prospect:"info", onboarding:"warning", active:"success", inactive:"neutral", churned:"danger" },
} as const;

// ── canTransition — structural legality check (the single transition gate) ────

/** Entities that own a transition state machine. TenantStatus has no map. */
export type TransitionEntity = "lead" | "customer" | "ticket";

/**
 * Returns whether `to` is a legal next status for `from` in the given entity's
 * transition map. This is the single helper the service/repository layer (the
 * 4-beat *mutate* beat, E0-S4) calls before any state move.
 *
 * CONTRACT (enforcement lands in E0-S4; this story guarantees the boolean):
 * - A status change not present in the map is rejected with **422 UNPROCESSABLE**
 *   (UC-3) when invoked via `POST /{resource}/{id}/transition`. State is NEVER
 *   changed via `PATCH status`. Every *accepted* change emits a
 *   `<Entity>.StatusChanged` event (ADR-008, downstream).
 *
 * STRUCTURAL LEGALITY ONLY — no business preconditions:
 * - DEC-CC-2 customer activation gate: `onboarding → active` additionally
 *   requires `taxRegistrationNumber` and `contactAddress`. That is an
 *   action-guard precondition enforced later in the service layer (E3-S2),
 *   NOT here — `canTransition('customer','onboarding','active')` returns `true`.
 * - The ticket customer-state gate (tickets only against active/onboarding
 *   customers) is likewise an action-guard precondition, not part of this check.
 */
export function canTransition(entity: TransitionEntity, from: string, to: string): boolean {
  const map: Record<string, string[]> =
    entity === "lead"       ? LEAD_TRANSITIONS
    : entity === "customer" ? CUSTOMER_TRANSITIONS
    : entity === "ticket"   ? TICKET_TRANSITIONS
    :                         {};
  // `Object.hasOwn` so inherited keys ("toString", "constructor", …) miss the
  // map and resolve to `false` instead of throwing — this is what makes the
  // "unknown status → rejected (no throw)" contract hold. The explicit `ticket`
  // branch with an empty-object default likewise rejects an out-of-domain
  // entity rather than silently validating it against the ticket map.
  const allowed = Object.hasOwn(map, from) ? map[from] : undefined;
  return allowed !== undefined && allowed.includes(to);
}
