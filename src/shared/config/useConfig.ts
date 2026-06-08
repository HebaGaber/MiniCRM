// OpenFeature-shaped config hook (ADR-011, E0-S10).
// Composes flag context (FlagProvider) + auth context (AuthProvider) so the
// evaluation context is always the current session claims.

import { useAuth } from '../auth/useAuth';
import { useFlagContext } from './flagContext';
import type { ConfigValue } from './flagStore';

/**
 * Resolves a typed config value for the current session context.
 * - Evaluation context = current session (tenantId + subsidiaryId, E0-S5).
 * - Resolution: subsidiary > tenant > system (most-specific-wins).
 * - Returns `defaultValue` when there is no active session or the key is not defined.
 *
 * Must be used inside both `<AuthProvider>` and `<FlagProvider>`.
 */
export function useConfig<T extends ConfigValue>(key: string, defaultValue: T): T {
  const { session } = useAuth();
  const { resolveConfig } = useFlagContext();

  if (!session) return defaultValue;

  return resolveConfig(key, session.tenantId, session.subsidiaryId, defaultValue) as T;
}
