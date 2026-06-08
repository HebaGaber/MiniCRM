// The auth-kernel type surface (ADR-009, project-context.md §6.1). `SessionClaims`
// is the canonical claim shape derived once at the shell and read everywhere via
// `useAuth()` — tenant/subsidiary scope and roles come from HERE, never from props
// or client input. `AuthContextValue` is the contract the provider exposes and the
// hook returns; it is identical for mock SSO now and OIDC later (AC4), so swapping
// the identity source touches only the provider internals, not this shape.
//
// Type-only module: `import type` per `verbatimModuleSyntax` (tsconfig.app.json).
// `Role` and `ID` are NOT redefined here — they have a single source in the domain
// layer (NFR-1: shared/auth → shared/domain, never the reverse).

import type { ID } from "../domain/types";
import type { Role } from "../domain/status";

/**
 * The canonical session claims (project-context.md §6.1, ADR-009). Established once
 * at the app shell and exposed via `useAuth()`.
 * - `subsidiaryId === null` is the agreed roll-up signal (AC2): the repository
 *   (E0-S4) relaxes the subsidiary filter and returns ALL tenant rows. Subsidiary-
 *   pinned roles carry a concrete `subsidiaryId`.
 * - `exp` is an ISO 8601 UTC string — timestamps are strings, never `Date` (§2.1).
 */
export interface SessionClaims {
  userId: ID;
  tenantId: ID;
  subsidiaryId: ID | null;
  roles: Role[];
  exp: string;
}

/**
 * The value exposed by `<AuthProvider>` and returned by `useAuth()`. This shape is
 * the stable seam (AC4): it does not change when mock SSO is replaced by OIDC.
 * - `session` is `null` when no one is signed in (and after a failed sign-in).
 * - `signIn(roleId)` resolves a picked role to canonical claims (mock SSO); an
 *   unknown role leaves `session` null and emits `Auth.LoginFailed` (does not throw).
 * - `setSubsidiaryScope(id, tenantId)` switches the active subsidiary scope (E1-S4,
 *   AC2). `id === null` means whole-tenant roll-up. The implementation validates
 *   `tenantId === session.tenantId`; a mismatched tenantId is silently rejected
 *   (mirrors the production X-Subsidiary-Id contract — tenantId always from token).
 */
export interface AuthContextValue {
  session: SessionClaims | null;
  isAuthenticated: boolean;
  signIn: (roleId: string) => void;
  signOut: () => void;
  setSubsidiaryScope: (id: ID | null, tenantId: ID) => void;
}
