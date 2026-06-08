// Flag/config provider (ADR-011, E0-S10).
// OpenFeature-shaped; static pilot store → Unleash in production (same interface).
// Evaluation context = auth context (SessionClaims from E0-S5) — composed in the hooks.
// External-system flags default OFF (ADR-012). Most-specific-wins; deny-wins; cycle-proof.
//
// This file exports ONLY the FlagProvider component (react-refresh rule).
// Types, stores, and resolver functions live in flagStore.ts.
// Context + useFlagContext live in flagContext.ts.
//
// NFR-1: FlagProvider does NOT import shared/auth — the hooks (useFlag, useConfig)
// compose auth + flag contexts. Provider is auth-agnostic for easy isolation testing.

import { useMemo } from 'react';
import type { ReactNode } from 'react';
import { FlagContext } from './flagContext';
import {
  PILOT_CONFIG,
  PILOT_FLAGS,
  resolveConfig,
  resolveFlag,
} from './flagStore';
import type { ConfigDefinition, FlagDefinition } from './flagStore';

/**
 * Mounts INSIDE `<AuthProvider>` so `useFlag`/`useConfig` can read the auth context.
 * Accepts optional `flags`/`config` props for injecting a custom store in tests.
 */
export function FlagProvider({
  children,
  flags = PILOT_FLAGS,
  config = PILOT_CONFIG,
}: {
  children: ReactNode;
  flags?: Record<string, FlagDefinition>;
  config?: Record<string, ConfigDefinition>;
}) {
  const value = useMemo(
    () => ({
      resolveFlag: (key: string, tenantId: string | null, subsidiaryId: string | null, seen?: Set<string>) =>
        resolveFlag(flags, key, tenantId, subsidiaryId, seen),
      resolveConfig: (key: string, tenantId: string | null, subsidiaryId: string | null, defaultValue: string | number | boolean) =>
        resolveConfig(config, key, tenantId, subsidiaryId, defaultValue),
    }),
    [flags, config],
  );

  return <FlagContext.Provider value={value}>{children}</FlagContext.Provider>;
}
