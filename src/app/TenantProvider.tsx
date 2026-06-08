// TenantProvider (E1-S1, AC1): derives tenant/subsidiary scope from the auth
// session and exposes it via TenantContext. Must be mounted INSIDE <AuthProvider>
// so `useAuth()` resolves to a live session.
//
// Responsibilities:
//  1. Derive `scopeName` from the active session (mock pilot map; expanded by E1-S2/S3
//     once subsidiary records are dynamic).
//  2. Manage `scopeLoading`: true for 420ms (~--crm-base 200ms + 220ms) whenever the
//     session reference changes (new login, role switch, sign-out + sign-in).
//     This is the "felt isolation" beat (prototype-behavior.md §Scope re-query skeleton).
//  3. Expose `tenantId` / `subsidiaryId` from the session — same as session claims but
//     surfaced through TenantContext so feature code never imports `useAuth` for scope.
//
// NFR-1: src/app imports shared/* only — never reverse.

import { useEffect, useMemo, useRef, useState } from "react";
import type { ReactNode } from "react";
import type { ID } from "../shared/domain/types";
import { useAuth } from "../shared/auth/useAuth";
import { TenantContext } from "../shared/auth/tenantContext";
import type { TenantContextValue } from "../shared/auth/tenant.types";

// ── Scope-name resolution ─────────────────────────────────────────────────────
// Maps the pilot mock subsidiaryId values to human-readable names (mirrors the
// SUBSIDIARIES config in prototype/app/config.jsx). `null` is the tenant-admin
// roll-up: the whole tenant is named after the pilot tenant.
// E1-S2/S3 will replace this static map with dynamic Subsidiary entity lookups.

const TENANT_NAME = "Northwind Trading";

const SUB_NAMES: Record<string, string> = {
  sub_eu: "EU / Frankfurt",
  sub_us: "US / Chicago",
};

function resolveScopeName(subsidiaryId: ID | null): string {
  if (subsidiaryId === null) return TENANT_NAME;
  // `Object.hasOwn` so prototype-inherited keys never resolve to a bogus name
  return Object.hasOwn(SUB_NAMES, subsidiaryId) ? SUB_NAMES[subsidiaryId] : subsidiaryId;
}

// ── Scope-loading timer ───────────────────────────────────────────────────────
// 420ms = --crm-base (200ms) + 220ms (per prototype-behavior.md §Timings).
// This is the skeleton window every scoped screen inherits on a scope change.
const SCOPE_LOADING_MS = 420;

// ── Provider ──────────────────────────────────────────────────────────────────

export function TenantProvider({ children }: { children: ReactNode }) {
  const { session } = useAuth();
  const [scopeLoading, setScopeLoading] = useState(false);

  // Track the previous session identity so we only fire the loading timer on
  // genuine changes (identity = userId + subsidiaryId combination).
  const prevSessionKeyRef = useRef<string | null>(null);

  useEffect(() => {
    if (session === null) {
      prevSessionKeyRef.current = null;
      // Reset scope-loading when the session clears; intentional effect-driven state.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setScopeLoading(false);
      return;
    }

    const key = `${session.userId}:${session.subsidiaryId ?? "_parent"}`;
    if (key === prevSessionKeyRef.current) return; // no change
    prevSessionKeyRef.current = key;

    setScopeLoading(true);
    const timer = setTimeout(() => setScopeLoading(false), SCOPE_LOADING_MS);
    // Reset ref in cleanup so StrictMode double-mount and normal session changes
    // both retrigger correctly (second mount sees null ref and fires the timer).
    return () => {
      clearTimeout(timer);
      prevSessionKeyRef.current = null;
    };
  }, [session]);

  const value = useMemo<TenantContextValue | null>(() => {
    if (session === null) return null;
    return {
      tenantId: session.tenantId,
      subsidiaryId: session.subsidiaryId,
      scopeName: resolveScopeName(session.subsidiaryId),
      scopeLoading,
    };
  }, [session, scopeLoading]);

  if (value === null) {
    // No active session — render children without providing TenantContext value.
    // Auth layer handles unauthenticated UI; TenantContext is only valid when
    // there IS a session. useTenant() throws for unauthenticated consumers, which
    // is correct (those surfaces are behind route guards).
    return <>{children}</>;
  }

  return <TenantContext.Provider value={value}>{children}</TenantContext.Provider>;
}
