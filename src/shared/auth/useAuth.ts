// `useAuth()` (AC1): the single accessor for session claims and the auth helpers.
// Every consumer reads tenant/subsidiary scope and roles from HERE — never from
// props or client input (ADR-009). The hook reads the context and GUARDS the
// "outside provider" case: it throws a clear error rather than returning
// `undefined`, so a missing `<AuthProvider>` fails loudly at the call site.

import { useContext } from "react";
import { AuthContext } from "./authContext";
import type { AuthContextValue } from "./auth.types";

/**
 * Returns the current auth context value: `{ session, isAuthenticated, signIn,
 * signOut }`. Consumers derive tenant/subsidiary from `session` (no extra getters).
 *
 * @throws if called outside an `<AuthProvider>` — the context is the `undefined`
 * sentinel there, and a silent `undefined` would let scope-derivation read nothing
 * (AC1). Mount `<AuthProvider>` at the app shell so this never fires in production.
 */
export function useAuth(): AuthContextValue {
  const value = useContext(AuthContext);
  if (value === undefined) {
    throw new Error("useAuth must be used within <AuthProvider>");
  }
  return value;
}
