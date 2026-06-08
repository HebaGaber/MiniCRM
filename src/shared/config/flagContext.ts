// Flag/config React context (ADR-011, E0-S10).
// Separating context from the provider component satisfies
// react-refresh/only-export-components (mirrors auth/authContext.ts pattern).

import { createContext, useContext } from 'react';
import type { ID } from '../domain/types';
import type { ConfigValue } from './flagStore';

export interface FlagContextValue {
  resolveFlag: (key: string, tenantId: ID | null, subsidiaryId: ID | null, seen?: Set<string>) => boolean;
  resolveConfig: (key: string, tenantId: ID | null, subsidiaryId: ID | null, defaultValue: ConfigValue) => ConfigValue;
}

export const FlagContext = createContext<FlagContextValue | undefined>(undefined);

/**
 * Returns the raw flag/config resolver context.
 * Prefer `useFlag`/`useConfig` which compose the auth context automatically.
 * Use this hook only in tests or when manual tenant/subsidiary control is needed.
 */
export function useFlagContext(): FlagContextValue {
  const ctx = useContext(FlagContext);
  if (ctx === undefined) {
    throw new Error('useFlagContext must be used within <FlagProvider>');
  }
  return ctx;
}
