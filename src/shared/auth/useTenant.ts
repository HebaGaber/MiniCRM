// `useTenant()` (E1-S1, AC1): the single accessor for the derived scope state.
// Every consumer reads tenantId/subsidiaryId/scopeName/scopeLoading from HERE —
// never from props, URL, or raw session claims in product code (UC-5, ADR-002).
// The hook reads TenantContext and guards the "outside provider" case: it throws a
// clear error rather than returning `undefined`.

import { useContext } from "react";
import { TenantContext } from "./tenantContext";
import type { TenantContextValue } from "./tenant.types";

/**
 * Returns the current tenant/scope context value: `{ tenantId, subsidiaryId,
 * scopeName, scopeLoading }`. Scope is always derived from the auth context —
 * never from caller-supplied arguments (UC-5).
 *
 * @throws if called outside a `<TenantProvider>` — the context is the `undefined`
 * sentinel there. Mount `<TenantProvider>` inside `<AuthProvider>` at the app shell.
 */
export function useTenant(): TenantContextValue {
  const value = useContext(TenantContext);
  if (value === undefined) {
    throw new Error("useTenant must be used within <TenantProvider>");
  }
  return value;
}
