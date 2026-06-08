// Composition root (E1-S1, ADR-004): the ONLY place in the app that wires a
// concrete Repository<T> adapter to the Repository<T> interface. Feature code
// calls `useRepository(config)` — it receives a `Repository<T>` bound to the
// current session's scope. The adapter (LocalStorageRepository) is never imported
// from feature code (asserted by the architecture-fitness E2E gate: e2e/architecture-fitness.spec.ts).
//
// Swap point (Epic 6): replace `LocalStorageRepository` with `HttpRepository` here —
// feature code is unchanged. This is the ADR-004 strangler-fig pivot.
//
// Returns `null` when no session is active. Feature data hooks render their loading
// skeleton in that case (route guards prevent this in practice).
//
// NFR-1: src/app may import from shared/* — never the reverse. No feature imports.

import { useMemo } from "react";
import { useAuth } from "../shared/auth/useAuth";
import { LocalStorageRepository } from "../shared/data/LocalStorageRepository";
import type { EntityConfig } from "../shared/data/LocalStorageRepository";
import type { BaseEntity } from "../shared/domain/types";
import type { Repository } from "../shared/data/Repository";

/**
 * Factory hook: returns a `Repository<T>` bound to the current session (E1-S1, AC1).
 * Scope (tenantId + subsidiaryId) is embedded in the adapter at construction time —
 * callers never pass tenantId or subsidiaryId (UC-5, AC2).
 *
 * Pass a STABLE module-level `config` constant — the hook is memoised on
 * `(session, config.name)` so a new function reference on every render would
 * not cause churn, but a new config object would.
 *
 * Returns `null` when `session === null` (unauthenticated). Feature hooks should
 * treat a null repository as the loading/unauthenticated state.
 */
export function useRepository<T extends BaseEntity>(
  config: EntityConfig<T>,
): Repository<T> | null {
  const { session } = useAuth();
  return useMemo(
    () => (session !== null ? new LocalStorageRepository<T>(config, session) : null),
    // Stable key: re-create only when the session identity changes or the entity name
    // changes (config object identity is not stable across renders, but config.name is).
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [session, config.name],
  );
}
