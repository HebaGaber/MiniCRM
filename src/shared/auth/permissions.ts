// The two-gate authZ kernel (ADR-009 §6.3, ADR-015): the §2.2 permission matrix
// encoded as DATA (`Capability × Role → Grant`), the single pure `can()` predicate
// with the ADR-015 five-grant model, the tenant/subsidiary scope check that yields
// the 404-not-403 outcome, and the audited `authorize()` gate that emits
// `Auth.RoleDenied`. This is the SINGLE source of access logic for the whole app —
// no feature invents its own (DoD §10): the route/action guards (guards.tsx) and
// the repository's 4-beat *authorize* beat (E0-S4) all delegate here.
//
// IS NOT: the repository wiring (E0-S4 calls `authorize()`); the designed
// blocked/empty screen UI (E0-S9-era shell); a server-side trust boundary (the
// pilot gates run client-side — ADR-009 "acceptable only because auth is mocked";
// the real gate is Epic 6, design-only). The E0-S11 cross-tenant E2E asserts 0
// leaks against this logical isolation.
//
// NFR-1: shared/auth imports sibling shared modules (`domain/`, `events/`) only —
// never `src/features/*`, and `shared/events` never imports back into `shared/auth`.
// No TS `enum` — `erasableSyntaxOnly`/`verbatimModuleSyntax` are on (tsconfig.app.json).

import type { ID } from "../domain/types";
import type { Role } from "../domain/status";
import type { SessionClaims } from "./auth.types";
import { publish } from "../events/bus";
import { append } from "../events/auditLog";
import { newCorrelationId } from "../events/correlation";

// ── ADR-015 predicate model ───────────────────────────────────────────────────

/**
 * The five-grant predicate vocabulary (ADR-015). Each cell of the matrix resolves
 * to one of these; `can()` evaluates it against an action + resource:
 * - `allow`      → any action of this capability, on any in-scope record.
 * - `deny` (—)   → always false (an explicit deny; absence is ALSO deny — see can()).
 * - `view`       → read actions only; ANY mutation is false.
 * - `own`        → only when `isOwned(actor, resource)`.
 * - `restricted` → only when `isOwned(actor, resource)` AND `action ∈ RESTRICTED_SAFE`.
 */
export type Grant = "allow" | "deny" | "view" | "own" | "restricted";

/** The §2.2 matrix rows (amended by DEC-CC-1) plus the AC6 delta rows. */
export type Capability =
  | "tenant.manage" //        Manage tenant/subsidiaries, users
  | "lead.manage" //          Leads: create/edit/convert
  | "customer.manage" //      Customers: create/edit (C-2)
  | "ticket.create" //        Tickets: create (DEC-CC-1 — all four roles)
  | "ticket.manage" //        Tickets: edit/assign
  | "audit.view" //           View audit/events
  | "record.deleteExport" //  Delete(soft)/export (+ hard-delete via `allow`)
  | "rollup.view"; //         Cross-subsidiary roll-up read model (E1-S5)

/**
 * The action being attempted. `read` is the ONLY read action (`isReadAction`);
 * every other value is a mutation. `softDelete`/`export` are the `RESTRICTED_SAFE`
 * pair; `hardDelete` is deliberately NOT safe-listed (AC6 — never granted by
 * `restricted`; only an `allow` cell, i.e. `tenant_admin`, permits it — §2.1).
 */
export type Action =
  | "read"
  | "create"
  | "edit"
  | "convert"
  | "assign"
  | "transition"
  | "softDelete"
  | "hardDelete"
  | "export";

/**
 * The record an action targets (ADR-015 `OwnedResource`), enriched with scope (for
 * the AC4 404 check) and identity (for the AC5 denial audit reference). A real
 * `BaseEntity` (lead/customer/ticket) structurally satisfies this — pass it straight in.
 */
export interface OwnedResource {
  tenantId: ID; //               hard isolation boundary (AC4 / isInScope)
  subsidiaryId: ID | null; //    ADR-002 visibility dimension
  ownerId?: ID; //               leads/customers they own
  assigneeId?: ID | null; //     tickets assigned to them
  actorId?: ID; //               audit/domain records they themselves produced
  id?: ID; //                    audit `entityId` on a denial (optional)
  entityType?: string; //        audit `entityType` on a denial (optional)
}

/** The result of a guard decision (ADR-009): granted, in-tenant role-denied, or out-of-scope. */
export type AuthZOutcome = "granted" | "denied" | "notFound";

/** Actions that a `restricted` grant permits on an OWNED record. Hard-delete is NEVER here (AC6). */
export const RESTRICTED_SAFE: ReadonlySet<Action> = new Set<Action>(["softDelete", "export"]);

/** True only for the single read action; every other action is a mutation (AC6 `view`). */
export function isReadAction(action: Action): boolean {
  return action === "read";
}

/**
 * The §2.2 permission matrix as DATA (AC3). Each cell is a `Grant`; an ABSENT cell
 * is the **default deny** (AC2) — we deliberately do NOT write `"deny"` into every
 * empty cell (absence *is* deny; the resolver treats a missing cell as deny). The
 * one explicit `"deny"` is the viewer audit cell, where the matrix's hard `—` is
 * worth asserting as intent.
 *
 * Hard-delete (AC6): `record.deleteExport` has no `hardDelete`-specific row — it is
 * covered by the same cells. `tenant_admin = allow` ⇒ `can(admin, …, "hardDelete")`
 * is true (admins CAN hard-delete, §2.1); `sales`/`support = restricted` ⇒
 * `hardDelete ∉ RESTRICTED_SAFE` ⇒ false (denied) while owned soft-delete/export
 * pass; `viewer = deny`. One row satisfies both "hard-delete denied for sales/support"
 * and "hard-delete is tenant_admin-only".
 */
export const MATRIX: Record<Capability, Partial<Record<Role, Grant>>> = {
  "tenant.manage": { tenant_admin: "allow" },
  "lead.manage": { tenant_admin: "allow", sales: "allow", viewer: "view" },
  "customer.manage": { tenant_admin: "allow", sales: "allow", support: "view", viewer: "view" },
  "ticket.create": { tenant_admin: "allow", sales: "allow", support: "allow", viewer: "allow" }, // DEC-CC-1
  "ticket.manage": { tenant_admin: "allow", sales: "view", support: "allow", viewer: "view" },
  "audit.view": { tenant_admin: "allow", sales: "own", support: "own", viewer: "deny" },
  "record.deleteExport": { tenant_admin: "allow", sales: "restricted", support: "restricted", viewer: "deny" },
  "rollup.view": { tenant_admin: "allow", sales: "view", support: "view", viewer: "view" },
};

// ── Pure predicates (no side effects — cell-tested in isolation, AC3/AC6) ──────

/**
 * ADR-015 `isOwned`: the actor is the responsible party on the record, or (for an
 * audit/event record) authored it. A resource carrying none of the three ownership
 * keys is NOT owned (a missing key never matches a real userId).
 */
export function isOwned(actor: SessionClaims, resource: OwnedResource): boolean {
  const { userId } = actor;
  return resource.ownerId === userId || resource.assigneeId === userId || resource.actorId === userId;
}

/** Resolves a single role's cell grant. `Object.hasOwn` so inherited keys MISS → undefined (default deny). */
function cellGrant(capability: Capability, role: Role): Grant | undefined {
  const row = Object.hasOwn(MATRIX, capability) ? MATRIX[capability] : undefined;
  if (row === undefined) return undefined;
  return Object.hasOwn(row, role) ? row[role] : undefined;
}

/** Evaluates ONE resolved grant against the action + resource (ADR-015 reference predicate). */
function evalGrant(grant: Grant, actor: SessionClaims, action: Action, resource: OwnedResource): boolean {
  switch (grant) {
    case "allow":
      return true;
    case "view":
      return isReadAction(action);
    case "own":
      return isOwned(actor, resource);
    case "restricted":
      return isOwned(actor, resource) && RESTRICTED_SAFE.has(action);
    default:
      return false; // "deny" (and, defensively, any unknown grant)
  }
}

/**
 * The SINGLE access predicate (AC1) — pure, no side effects. Resolves the actor's
 * roles against the matrix and applies the ADR-015 model with deny-wins (AC2):
 *
 * Multi-role resolution (Reconciliation C — AC2 ⊕ ADR-015): an EXPLICIT `deny` in
 * ANY of the actor's roles wins (conflict → deny); ABSENCE is the default deny (not
 * a conflicting deny); among the remaining NON-deny grants, permit if ANY evaluates
 * true (most-permissive). All-absent ⇒ false (default deny). In the pilot every
 * session is single-role (`roles: [role]`), so this degenerates to a single cell
 * lookup; the resolution is implemented correctly anyway for forward-safety.
 *
 * `Object.hasOwn`-based lookup (cellGrant) makes a bogus capability/role string miss
 * the matrix and resolve to the default deny instead of throwing.
 */
export function can(actor: SessionClaims, capability: Capability, action: Action, resource: OwnedResource): boolean {
  const grants = actor.roles.map((role) => cellGrant(capability, role));
  if (grants.some((g) => g === "deny")) return false; // explicit deny wins (AC2)
  return grants.some((g) => g !== undefined && evalGrant(g, actor, action, resource)); // most-permissive among non-deny
}

/**
 * Tenant/subsidiary scope check (AC4, ADR-002). `false` ⇒ a `notFound` outcome:
 * - `resource.tenantId !== actor.tenantId` → out-of-tenant (the hard boundary; existence
 *   never disclosed — disclosed as 404, never 403).
 * - within the tenant: `tenant_admin` (subsidiaryId === null) rolls up the whole tenant;
 *   a subsidiary-pinned actor sees only their own subsidiary + parent-level (`null`) records.
 *   A sibling-subsidiary record is out-of-scope → notFound (existence not disclosed in-tenant either).
 */
export function isInScope(actor: SessionClaims, resource: OwnedResource): boolean {
  if (resource.tenantId !== actor.tenantId) return false; // hard boundary
  if (actor.subsidiaryId === null) return true; //           tenant_admin roll-up
  return resource.subsidiaryId === actor.subsidiaryId || resource.subsidiaryId === null;
}

/**
 * The PURE guard decision (no emission) the UI gates render from (AC4). Out-of-scope
 * resolves to `notFound` BEFORE any role check, so a denial never reveals that an
 * out-of-scope record exists. In-scope: `granted` if `can(...)`, else `denied`.
 */
export function resolveOutcome(
  actor: SessionClaims,
  capability: Capability,
  action: Action,
  resource: OwnedResource,
): AuthZOutcome {
  if (!isInScope(actor, resource)) return "notFound";
  return can(actor, capability, action, resource) ? "granted" : "denied";
}

// ── The audited gate (AC5) — consumed by E0-S4's 4-beat *authorize* beat ────────

/**
 * Emits ONE `Auth.RoleDenied` across both streams on ONE shared `correlationId`
 * (UC-2). Copies the E0-S5 reference emission pattern VERBATIM: APPEND the
 * `AuditEvent` (lowercase dotted `action`) FIRST, THEN publish the `DomainEvent`
 * (canonical `type`). Audit-before-publish is deliberate — `bus.publish` delivers
 * synchronously and re-raises an `AggregateError` AFTER delivery if a subscriber
 * throws; appending first guarantees both stream records exist before any subscriber
 * fault can surface (see AuthProvider.tsx `emitAuthEvent`). `eventId`/audit-`id` are
 * bare UUIDs (infra-stream ids, not entity ids — mirrors correlation.ts).
 *
 * `Reconciliation A`: `AuditEvent.action` is the lowercase dotted verb
 * `"auth.role_denied"`; `DomainEvent.type` is the PascalCase registry name
 * `"Auth.RoleDenied"` (already in eventTypes.ts) — different fields by design.
 */
function emitRoleDenied(actor: SessionClaims, capability: Capability, action: Action, resource: OwnedResource): void {
  const correlationId = newCorrelationId();
  const occurredAt = new Date().toISOString();
  append({
    id: crypto.randomUUID(),
    tenantId: actor.tenantId,
    subsidiaryId: actor.subsidiaryId,
    actorId: actor.userId,
    action: "auth.role_denied",
    entityType: resource.entityType ?? "Authorization",
    entityId: resource.id ?? actor.userId,
    occurredAt,
    correlationId,
  });
  publish({
    eventId: crypto.randomUUID(),
    type: "Auth.RoleDenied",
    tenantId: actor.tenantId,
    subsidiaryId: actor.subsidiaryId,
    actorId: actor.userId,
    occurredAt,
    payload: { capability, action },
    correlationId,
  });
}

/**
 * The AUDITED authorization gate (AC1/AC5) — the predicate E0-S4's 4-beat
 * *authorize* beat calls on every mutation. Delegates the decision to the pure
 * `resolveOutcome`; on an in-tenant role `denied`, emits `Auth.RoleDenied` (dual
 * stream, one correlationId). A `granted` or `notFound` outcome emits NOTHING —
 * out-of-tenant is a not-found (AC4), NOT a role denial, so it never produces an
 * `Auth.RoleDenied` (which would be both a false signal and a subtle existence leak).
 */
export function authorize(
  actor: SessionClaims,
  capability: Capability,
  action: Action,
  resource: OwnedResource,
): AuthZOutcome {
  const outcome = resolveOutcome(actor, capability, action, resource);
  if (outcome === "denied") {
    emitRoleDenied(actor, capability, action, resource);
  }
  return outcome;
}
