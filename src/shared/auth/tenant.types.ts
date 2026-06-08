// TenantContextValue — the derived scope state exposed via useTenant() (E1-S1).
// Distinct from SessionClaims (auth.types.ts): SessionClaims is the raw JWT shape;
// TenantContextValue is the *derived* scope surface — what every UI component needs
// to know about "where am I and is the scope changing?".
//
// Type-only module: `import type` per `verbatimModuleSyntax` (tsconfig.app.json).
// ID is imported from the domain layer (NFR-1: shared/auth → shared/domain, never reverse).

import type { ID } from "../domain/types";

/**
 * The derived scope context (E1-S1, ADR-002). Exposed via `useTenant()`.
 * - `tenantId` / `subsidiaryId` — mirrors the session claims; never passed to callers,
 *   never sourced from props or URL (UC-5). `subsidiaryId === null` is the roll-up signal.
 * - `scopeName` — human-readable label for the active scope (used in UI copy and
 *   `NotFoundView`). "Northwind Trading" for tenant_admin; subsidiary name otherwise.
 * - `scopeLoading` — `true` for 420ms after the session changes (new login / role switch).
 *   Every scoped screen that shows a skeleton checks this flag. Derived from `--crm-base`
 *   (200ms) + 220ms per prototype-behavior.md §Timings.
 */
export interface TenantContextValue {
  tenantId: ID;
  subsidiaryId: ID | null;
  scopeName: string;
  scopeLoading: boolean;
}
