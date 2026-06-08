// The auth kernel (ADR-009, project-context.md §6): ONE `AuthProvider` that holds
// session state, resolves a picked role into canonical `SessionClaims` via mock SSO,
// and emits the auth-lifecycle events (`Auth.LoggedIn/LoginFailed/LoggedOut`) to the
// dual event/audit streams on a single `correlationId` (UC-2). This is the single
// source of tenant/subsidiary scope and roles for the whole app — consumers read it
// only through `useAuth()`.
//
// IS NOT (bind consuming stories): the route/action guards, the permission matrix,
// and `Auth.RoleDenied` emission are E0-S6 (this story only exposes the reusable
// emission seam they reuse — see `emitAuthEvent`). Repository scoping is E0-S4.
// The pixel-perfect login screen is deferred to the E0-S9-era shell story; this is
// the provider + hook + mock sign-in logic + the role→claims/scope/identity data.
//
// NFR-1: shared/auth imports sibling shared modules (`domain/`, `events/`) only —
// never `src/features/*`, and `shared/events` never imports back into `shared/auth`.

import { useCallback, useMemo, useRef, useState } from "react";
import type { ReactNode } from "react";
import type { ID } from "../domain/types";
import type { Role } from "../domain/status";
import { publish } from "../events/bus";
import { append } from "../events/auditLog";
import { newCorrelationId } from "../events/correlation";
import { AuthContext } from "./authContext";
import type { AuthContextValue, SessionClaims } from "./auth.types";

// ── Mock identity data (internal — AC4) ──────────────────────────────────────
// The seedable per-role identity/scope map. This is an INTERNAL detail of the
// provider, not exported call-site coupling: a future OIDC implementation replaces
// `resolveMockIdentity` and these constants vanish, while the context value shape
// and `useAuth()` API stay identical.
//
// Values come from the prototype (`config.jsx` TENANT/SUBSIDIARIES/ROLES,
// `shell.jsx` USER_OF) and the E0-S5 epic UX table. IDs are deterministic,
// type-prefixed constants (§2.1) — stable and testable for the mock; we sidestep
// the `crypto.randomUUID()` secure-context caveat by not minting random fixtures.

// Single tenant for the pilot — Northwind Trading (config.jsx TENANT).
const TENANT_ID: ID = "tnt_northwind";
// Subsidiaries (config.jsx SUBSIDIARIES): EU/Frankfurt, US/Chicago.
const SUB_EU: ID = "sub_eu";
const SUB_US: ID = "sub_us";
// Mock session expiry — a far-future ISO 8601 UTC string (§2.1: timestamps are
// strings, never `Date`). A real OIDC token carries its own `exp`.
const MOCK_EXP = "2099-12-31T23:59:59.000Z";

// Anonymous sentinel for a FAILED login (Open Question 3): there is no established
// session at failure time, so we do NOT fabricate a real user. `tenantId` is the
// single pilot tenant; `actorId` is an explicit anonymous marker.
const ANON_ACTOR: ID = "usr_anonymous";

// ── Session persistence (E0-S5, sign-in fix) ─────────────────────────────────
// The established session is persisted to `sessionStorage` so a full page reload
// keeps the user signed in instead of bouncing them back to /sign-in. `sessionStorage`
// (not `localStorage`) is deliberate for the mock: the session lives for the tab's
// lifetime and clears on tab close, which is the closest mock analogue to a short-
// lived OIDC token — no stale "logged in last week" sessions linger. This is the auth
// kernel (shared/auth), not feature code, so it is the legitimate owner of the
// session-token store; the CLAUDE.md "persist only via Repository<T>" rule governs
// tenant-scoped ENTITY persistence, not the auth seam's own session. The future OIDC
// implementation (AC4) replaces this store with token storage behind the same seam.
const SESSION_STORAGE_KEY = "mincrm.auth.session";

/** Narrow an unknown (parsed JSON) to `SessionClaims` so a tampered/legacy blob is rejected. */
function isSessionClaims(value: unknown): value is SessionClaims {
  if (typeof value !== "object" || value === null) return false;
  const c = value as Record<string, unknown>;
  return (
    typeof c.userId === "string" &&
    typeof c.tenantId === "string" &&
    (c.subsidiaryId === null || typeof c.subsidiaryId === "string") &&
    Array.isArray(c.roles) &&
    c.roles.every((r) => typeof r === "string") &&
    typeof c.exp === "string"
  );
}

/**
 * Restore a persisted session on mount (silent — emits NO `Auth.LoggedIn`; a reload
 * is not a fresh login). Returns `null` when nothing valid is stored, the blob is
 * malformed, or the session has expired. Storage access is guarded so a missing/locked
 * `sessionStorage` (SSR, privacy mode) degrades to "no session", never throws.
 */
function loadPersistedSession(): SessionClaims | null {
  try {
    if (typeof sessionStorage === "undefined") return null;
    const raw = sessionStorage.getItem(SESSION_STORAGE_KEY);
    if (raw === null) return null;
    const parsed: unknown = JSON.parse(raw);
    if (!isSessionClaims(parsed)) return null;
    // Honor `exp`: a stored-but-expired session is treated as signed out.
    if (Date.parse(parsed.exp) <= Date.now()) return null;
    return parsed;
  } catch {
    return null;
  }
}

/** Write-through the current session (or clear it on sign-out). Guarded like the reader. */
function persistSession(session: SessionClaims | null): void {
  try {
    if (typeof sessionStorage === "undefined") return;
    if (session === null) sessionStorage.removeItem(SESSION_STORAGE_KEY);
    else sessionStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(session));
  } catch {
    // Storage full / unavailable — the in-memory session still works for this tab;
    // only reload-persistence is lost. Never break sign-in over a storage fault.
  }
}

/** One canonical-role identity: the actor id and the subsidiary scope it lands in. */
interface MockIdentity {
  userId: ID;
  subsidiaryId: ID | null;
}

// Keyed by the CANONICAL `Role` (status.ts) — the single source of role values.
// `tenant_admin` → `subsidiaryId: null` is the roll-up signal (AC2); the
// subsidiary-pinned roles carry a concrete id.
const MOCK_IDENTITIES: Record<Role, MockIdentity> = {
  tenant_admin: { userId: "usr_sara", subsidiaryId: null }, // Sara Khan — whole tenant
  sales: { userId: "usr_marco", subsidiaryId: SUB_EU }, //        Marco Ruiz — EU
  support: { userId: "usr_lena", subsidiaryId: SUB_US }, //       Lena Bauer — US
  viewer: { userId: "usr_ivo", subsidiaryId: SUB_EU }, //         Ivo Petrov — EU
};

// Reconciliation A: the mock accepts the prototype-style ids (`config.jsx`) as input
// LABELS, but maps them onto the canonical `Role` for the `roles[]` claim. Canonical
// ids resolve to themselves (handled directly against MOCK_IDENTITIES).
const ROLE_ALIASES: Record<string, Role> = {
  sales_agent: "sales",
  support_agent: "support",
};

/**
 * OIDC SEAM (AC4) — the ONLY identity-source-specific code. Resolves a picked
 * role id (canonical or a prototype alias) into canonical `SessionClaims`, or
 * `null` for an unknown role. A future OIDC (Auth Code + PKCE) implementation
 * replaces ONLY this function (mapping IdP claims → `Role`); every consumer and the
 * context value shape stay unchanged.
 */
function resolveMockIdentity(roleId: string): SessionClaims | null {
  // `Object.hasOwn` (NOT `in` / bracket access) so inherited prototype keys
  // ("constructor", "toString", "valueOf", "__proto__", …) MISS the maps instead
  // of resolving to a bogus session — same guard status.ts uses for its transition
  // lookup. With `in`, `"constructor" in MOCK_IDENTITIES` is `true` and would mint
  // claims with `userId: undefined` and a fabricated role.
  const role: Role | undefined = Object.hasOwn(MOCK_IDENTITIES, roleId)
    ? (roleId as Role)
    : Object.hasOwn(ROLE_ALIASES, roleId)
      ? ROLE_ALIASES[roleId]
      : undefined;
  if (role === undefined) return null;
  const identity = MOCK_IDENTITIES[role];
  return {
    userId: identity.userId,
    tenantId: TENANT_ID,
    subsidiaryId: identity.subsidiaryId,
    roles: [role],
    exp: MOCK_EXP,
  };
}

// ── Dual-stream auth event emission (UC-2 — AC3) ──────────────────────────────
// The reusable emission seam. E0-S6 reuses this shape to emit `Auth.RoleDenied`
// from its guards; this story emits only `Auth.LoggedIn/LoginFailed/LoggedOut`
// (there is no denial here, so `Auth.RoleDenied` is NOT fired from the provider).

/** The three auth-lifecycle domain-event types this story owns (canonical §7.2). */
type AuthEventType = "Auth.LoggedIn" | "Auth.LoginFailed" | "Auth.LoggedOut";
/** The matching audit verbs — lowercase dotted, distinct from `type` (Reconciliation B). */
type AuthAuditAction = "auth.login" | "auth.login_failed" | "auth.logout";

interface AuthEmission {
  type: AuthEventType;
  action: AuthAuditAction;
  actorId: ID;
  tenantId: ID;
  subsidiaryId: ID | null;
  entityType: "User" | "Session";
  payload: unknown;
}

/**
 * Emits ONE auth action across both streams on ONE shared `correlationId` (UC-2):
 * mints the id, APPENDS the `AuditEvent` (lowercase dotted `action`) FIRST, THEN
 * publishes the `DomainEvent` (canonical `type` — `bus.publish` throws on a free-
 * form name, the AC3 guard).
 *
 * Audit-BEFORE-publish is deliberate: `bus.publish` delivers synchronously to every
 * subscriber and, if any throws, RE-RAISES an `AggregateError` AFTER delivery. If we
 * published first, that throw would skip `append` and leave a `DomainEvent` with no
 * matching `AuditEvent` — breaking UC-2 atomicity and the compliance trail on a fault
 * we don't own. Writing the audit first guarantees both stream records exist before
 * any subscriber fault can surface. This is the reference emission pattern consuming
 * stories (E0-S6, E0-S4, Epics 1–5) copy. `eventId`/audit-`id` are bare UUIDs —
 * infra-stream record ids, not entity ids (mirrors `correlation.ts`); `occurredAt`
 * is a shared ISO timestamp.
 */
function emitAuthEvent(e: AuthEmission): void {
  const correlationId = newCorrelationId();
  const occurredAt = new Date().toISOString();
  append({
    id: crypto.randomUUID(),
    tenantId: e.tenantId,
    subsidiaryId: e.subsidiaryId,
    actorId: e.actorId,
    action: e.action,
    entityType: e.entityType,
    entityId: e.actorId,
    occurredAt,
    correlationId,
  });
  publish({
    eventId: crypto.randomUUID(),
    type: e.type,
    tenantId: e.tenantId,
    subsidiaryId: e.subsidiaryId,
    actorId: e.actorId,
    occurredAt,
    payload: e.payload,
    correlationId,
  });
}

// ── The provider ──────────────────────────────────────────────────────────────

/**
 * Establishes the auth context once (mount at the app shell — wiring is a later
 * shell concern, not this story's AC). Holds `SessionClaims | null` and exposes
 * `{ session, isAuthenticated, signIn, signOut }` via `useAuth()`.
 */
export function AuthProvider({ children }: { children: ReactNode }) {
  // Lazy initializer: restore a persisted session on mount so a reload keeps the user
  // signed in. This is SILENT — no `Auth.LoggedIn` is emitted for a restore (a reload
  // is not a new login); only the explicit `signIn` call below audits a login.
  const [session, setSession] = useState<SessionClaims | null>(loadPersistedSession);
  // Mirrors the latest claims so `signOut` reads them without a stale closure and
  // WITHOUT emitting inside a state updater (React 19 StrictMode may invoke an
  // updater twice — that would double-emit and break UC-2's "exactly one event").
  const sessionRef = useRef<SessionClaims | null>(session);

  const signIn = useCallback((roleId: string) => {
    const claims = resolveMockIdentity(roleId);
    if (claims === null) {
      // Unknown role → failed login. Anonymous sentinel actor/tenant (OQ3); leave
      // the session null and do NOT throw to the UI.
      emitAuthEvent({
        type: "Auth.LoginFailed",
        action: "auth.login_failed",
        actorId: ANON_ACTOR,
        tenantId: TENANT_ID,
        subsidiaryId: null,
        entityType: "Session",
        payload: { attemptedRoleId: roleId },
      });
      return;
    }
    sessionRef.current = claims;
    setSession(claims);
    persistSession(claims); // survive reload (sign-in fix)
    emitAuthEvent({
      type: "Auth.LoggedIn",
      action: "auth.login",
      actorId: claims.userId,
      tenantId: claims.tenantId,
      subsidiaryId: claims.subsidiaryId,
      entityType: "User",
      payload: { roles: claims.roles },
    });
  }, []);

  const signOut = useCallback(() => {
    const current = sessionRef.current;
    if (current === null) return; // no session → nothing to clear, no event
    sessionRef.current = null;
    setSession(null);
    persistSession(null); // clear the persisted session (sign-in fix)
    emitAuthEvent({
      type: "Auth.LoggedOut",
      action: "auth.logout",
      actorId: current.userId,
      tenantId: current.tenantId,
      subsidiaryId: current.subsidiaryId,
      entityType: "User",
      payload: { roles: current.roles },
    });
  }, []);

  // E1-S4 (AC2): switch active subsidiary scope within the token's tenant.
  // Validates the passed tenantId matches the token — never trusts client input
  // (mirrors production X-Subsidiary-Id header contract, constitution §5.2).
  // No domain event emitted: scope switching is a UI navigation decision, not an entity mutation.
  const setSubsidiaryScope = useCallback((id: ID | null, tenantId: ID) => {
    const current = sessionRef.current;
    if (current === null) return;
    if (tenantId !== current.tenantId) return; // cross-tenant rejected (always validated, even for null id)
    const updated = { ...current, subsidiaryId: id };
    sessionRef.current = updated;
    setSession(updated);
    persistSession(updated); // keep the persisted scope in sync (sign-in fix)
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({ session, isAuthenticated: session !== null, signIn, signOut, setSubsidiaryScope }),
    [session, signIn, signOut, setSubsidiaryScope],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
