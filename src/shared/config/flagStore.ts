// Static flag/config stores + type definitions (ADR-011, ADR-012, E0-S10).
// Keeping types and stores in a separate module lets FlagProvider.tsx export
// only the component (satisfying react-refresh/only-export-components).

import type { ID } from '../domain/types';

export type ConfigValue = string | number | boolean;

export interface FlagDefinition {
  system?: boolean;
  tenant?: Record<string, boolean>;
  subsidiary?: Record<string, boolean>;
}

export interface ConfigDefinition {
  system?: ConfigValue;
  tenant?: Record<string, ConfigValue>;
  subsidiary?: Record<string, ConfigValue>;
}

// Static pilot stores. External-system flags are hard-off (ADR-012).
// Add tenant/subsidiary overrides here as the pilot grows.
export const PILOT_FLAGS: Record<string, FlagDefinition> = {
  'erp.sync.enabled': { system: false },
  'messaging.enabled': { system: false },
  'cloud.enabled': { system: false },
};

export const PILOT_CONFIG: Record<string, ConfigDefinition> = {};

// ── Pure resolution functions ─────────────────────────────────────────────────

/**
 * Resolves a boolean flag for the given tenant/subsidiary context.
 * Precedence: subsidiary > tenant > system (most-specific-wins).
 * Deny-wins: if ANY applicable level is `false`, returns `false`.
 * Cycle-proof: returns `false` immediately when `key` is already in `seen`.
 */
export function resolveFlag(
  store: Record<string, FlagDefinition>,
  key: string,
  tenantId: ID | null,
  subsidiaryId: ID | null,
  seen: Set<string> = new Set(),
): boolean {
  if (seen.has(key)) return false;
  seen.add(key);

  const def = store[key];
  if (!def) return false;

  const levels: boolean[] = [];

  if (subsidiaryId !== null && def.subsidiary && Object.hasOwn(def.subsidiary, subsidiaryId)) {
    levels.push(def.subsidiary[subsidiaryId]);
  }
  if (tenantId !== null && def.tenant && Object.hasOwn(def.tenant, tenantId)) {
    levels.push(def.tenant[tenantId]);
  }
  if (def.system !== undefined) {
    levels.push(def.system);
  }

  if (levels.length === 0) return false;
  if (levels.some(v => v === false)) return false;
  return levels[0];
}

/**
 * Resolves a config value for the given tenant/subsidiary context.
 * Precedence: subsidiary > tenant > system (most-specific-wins).
 * Falls back to `defaultValue` when no level is defined.
 */
export function resolveConfig(
  store: Record<string, ConfigDefinition>,
  key: string,
  tenantId: ID | null,
  subsidiaryId: ID | null,
  defaultValue: ConfigValue,
): ConfigValue {
  const def = store[key];
  if (!def) return defaultValue;

  if (subsidiaryId !== null && def.subsidiary && Object.hasOwn(def.subsidiary, subsidiaryId)) {
    return def.subsidiary[subsidiaryId];
  }
  if (tenantId !== null && def.tenant && Object.hasOwn(def.tenant, tenantId)) {
    return def.tenant[tenantId];
  }
  if (def.system !== undefined) {
    return def.system;
  }
  return defaultValue;
}
