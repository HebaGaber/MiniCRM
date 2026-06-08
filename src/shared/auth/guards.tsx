// The two authZ gates (ADR-009 §6.3, AC1): a `<RouteGuard>` for screen access and
// an `<ActionGuard>` for per-record mutation access. BOTH read claims via `useAuth()`
// (never props — tenant/subsidiary/roles come only from the auth context) and
// delegate to the single `permissions.ts` predicate — the components hold NO access
// logic of their own (DoD §10 "no feature invents its own access logic").
//
// Client-side UX gate only (ADR-009): in the pilot these run client-side, which is
// "acceptable only because auth is mocked"; the authoritative, AUDITED denial is
// `permissions.authorize()`, fired by E0-S4's 4-beat *authorize* beat when a mutation
// is actually attempted. So these gates are PURE — they decide visibility/enablement
// and emit NOTHING. Emitting `Auth.RoleDenied` during render would double-fire under
// React 19 StrictMode (the trap AuthProvider.tsx documents) and would spam the audit
// trail for merely *viewing* a disabled control. The blocked/empty `fallback` UI is a
// minimal placeholder here; the designed blocked state (§8.5 "deny-wins, felt
// gracefully") lands with the E0-S9-era shell. Routing/mount wiring is also deferred.
//
// NFR-1: shared/auth imports siblings only — never src/features/*.

import type { ReactNode } from "react";
import { useAuth } from "./useAuth";
import { can, resolveOutcome } from "./permissions";
import type { Action, Capability, OwnedResource } from "./permissions";

/**
 * Screen gate (AC1): renders `children` when the role may open the screen for
 * `capability`, else `fallback`. It expresses openability through the SAME `can()`
 * predicate (AC1) by asking `read` against a synthetic in-own-scope, self-owned
 * resource. The screen-level grants resolve as: `allow` → open, `view` → open (read
 * is a read action), `own` → open for the owner (the synthetic resource is
 * self-owned), `deny`/absent → blocked. Row-level filtering of WHAT an opened role
 * sees happens downstream. Unauthenticated → blocked.
 *
 * NOTE: a `restricted` cell resolves CLOSED here (`read ∉ RESTRICTED_SAFE`). That is
 * correct, not a gap: `restricted` is a per-RECORD action grant (soft-delete/export
 * on an owned record — only `record.deleteExport` carries it), never a screen-level
 * capability. No route is gated on a `restricted` capability; route capabilities are
 * the screen rows (`*.manage`, `audit.view`), which carry only `allow`/`view`/`own`/`deny`.
 */
export function RouteGuard({
  capability,
  children,
  fallback = null,
}: {
  capability: Capability;
  children: ReactNode;
  fallback?: ReactNode;
}) {
  const { session } = useAuth();
  if (session === null) return <>{fallback}</>;
  // Synthetic self-owned, in-own-scope resource so `own`/`view`/`allow` cells open
  // the screen via the single predicate; `deny`/absent cells do not.
  const selfResource: OwnedResource = {
    tenantId: session.tenantId,
    subsidiaryId: session.subsidiaryId,
    ownerId: session.userId,
    assigneeId: session.userId,
    actorId: session.userId,
  };
  return can(session, capability, "read", selfResource) ? <>{children}</> : <>{fallback}</>;
}

/**
 * Per-record mutation gate (AC1, AC4) — a render-prop that hands its child an
 * `allowed` boolean (e.g. to disable a control). `allowed` is true ONLY for a
 * `granted` outcome; a `denied` (role) OR a `notFound` (out-of-scope) outcome both
 * yield `allowed === false` — the control is simply disabled, never revealing that
 * an out-of-scope record exists (the 404/existence-non-disclosure is enforced
 * authoritatively at the data layer via `authorize()`). Unauthenticated → false.
 */
export function ActionGuard({
  capability,
  action,
  resource,
  children,
}: {
  capability: Capability;
  action: Action;
  resource: OwnedResource;
  children: (allowed: boolean) => ReactNode;
}) {
  const { session } = useAuth();
  const allowed = session !== null && resolveOutcome(session, capability, action, resource) === "granted";
  return <>{children(allowed)}</>;
}
