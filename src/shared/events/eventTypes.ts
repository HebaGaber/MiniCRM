// The canonical domain-event-type registry (project-context.md §7.2, copied
// VERBATIM). This is the single source of truth for legal `DomainEvent.type`
// values: `bus.publish()` rejects any type not listed here (AC3), which is how
// free-form / malformed event names are made impossible at publish time. The
// registry enforces the `PascalCaseEntity.PastTenseAction` shape BY ENUMERATION
// — only the listed names pass; we do not pattern-match the shape.
//
// Mirrors the `ID_PREFIXES` const-map-not-enum pattern (types.ts:43-54): a
// `const` literal + a derived string-literal union. NO TS `enum` —
// `erasableSyntaxOnly` is on (tsconfig.app.json). (NFR-1: imports nothing from
// src/features/*.)
//
// Open Question 1 (for Heba): §7.2 OMITS `Customer.StatusChanged` /
// `Customer.Converted` even though §3.2 + CUSTOMER_TRANSITIONS + E3-S2 will need
// them. We author §7.2 EXACTLY (free-form is rejected by design) and flag the gap
// — it is resolved by a decision-log.md entry before E3-S2, not invented here.

/** The verbatim §7.2 canonical event-type names. Extend only by editing §7.2. */
export const EVENT_TYPES = [
  // Lead
  "Lead.Created",
  "Lead.Updated",
  "Lead.StatusChanged",
  "Lead.Converted",
  "Lead.Deleted",
  // Customer
  "Customer.Created",
  "Customer.Updated",
  "Customer.Deleted",
  // Ticket
  "Ticket.Created",
  "Ticket.Updated",
  "Ticket.StatusChanged",
  "Ticket.Assigned",
  "Ticket.Deleted",
  // Tenant
  "Tenant.SubsidiaryAdded",
  "Tenant.SubsidiaryRemoved",
  // Auth
  "Auth.LoggedIn",
  "Auth.LoginFailed",
  "Auth.LoggedOut",
  "Auth.RoleDenied",
] as const;

/** The string-literal union of every canonical event type. */
export type EventType = (typeof EVENT_TYPES)[number];

// A Set for O(1) membership; the array above stays the readable source of truth.
const EVENT_TYPE_SET: ReadonlySet<string> = new Set(EVENT_TYPES);

/** Narrows an arbitrary string to a canonical `EventType` (registry membership). */
export function isEventType(s: string): s is EventType {
  return EVENT_TYPE_SET.has(s);
}
