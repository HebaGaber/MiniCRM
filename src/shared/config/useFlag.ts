// OpenFeature-shaped flag hook (ADR-011, E0-S10).
// Composes flag context (FlagProvider) + auth context (AuthProvider) so the
// evaluation context is always the current session claims (tenantId, subsidiaryId).

import { useAuth } from '../auth/useAuth';
import { useFlagContext } from './flagContext';

/**
 * Resolves a boolean flag for the current session context.
 * - Evaluation context = current session (tenantId + subsidiaryId, E0-S5).
 * - Resolution: subsidiary > tenant > system; deny-wins; cycle-proof.
 * - Returns `defaultValue` (default: `false`) when there is no active session.
 * - External-system flags (`erp.sync.enabled`, `messaging.enabled`, `cloud.enabled`)
 *   are always `false` in the pilot static store (ADR-012).
 *
 * Must be used inside both `<AuthProvider>` and `<FlagProvider>`.
 */
export function useFlag(key: string, defaultValue = false): boolean {
  const { session } = useAuth();
  const { resolveFlag } = useFlagContext();

  if (!session) return defaultValue;

  return resolveFlag(key, session.tenantId, session.subsidiaryId);
}
