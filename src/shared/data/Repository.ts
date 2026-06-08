// The repository seam (ADR-004): the single generic data-access contract every
// feature data hook in Epics 1–5 binds to, and that LocalStorageRepository (E0-S4)
// — later HttpRepository (E6) — implements, injected at the composition root.
// Features depend on THIS interface, never a concrete repository (asserted by the
// E0-S11 architecture-fitness test). No persistence detail (localStorage, keys,
// HTTP, fetch) leaks into these types.
//
// Canonical source: _bmad-output/project-context.md §4.1 (copied verbatim), with
// the two E0-S3 reconciliations applied: Page's field is `data` not `items`
// (§4.1 + the §5.5 wire envelope; the epic file's `items` is un-logged drift —
// CONFIRMED 2026-06-07 by Heba), and the wire filters `status`/`ownerId` (§5.4)
// are conventional keys inside the open `filter` Record, not top-level fields.
//
// This module is 100% type-only — zero runtime exports, emitting no JavaScript.
// `ID`/`BaseEntity` are imported `import type` (verbatimModuleSyntax is on);
// the only import is the sibling domain kernel (NFR-1: nothing from src/features/*).
// Runtime behaviors — default pageSize=25, max-100 clamp, tenant/subsidiary
// scoping from auth context, optimistic-concurrency 409, soft-delete, the
// 4-beat use case, REST status codes — all belong to the adapter (E0-S4), not
// the type. Tenant scope is composed inside the adapter and is deliberately
// absent from every signature here (UC-5).

import type { ID, BaseEntity } from "../domain/types";

/**
 * Standard list parameters (project-context.md §4.1).
 * - `filter` is an open `Record`: domain filters like `status`/`ownerId` (the
 *   §5.4 wire params) are keys here, not dedicated fields. Any string key is
 *   structurally accepted — this is what makes "unknown filters ignored, never
 *   errored" (UC-5) true at the type boundary; the runtime ignore is the adapter's.
 * - `sort` is `"field"` (asc) or `"-field"` (desc).
 * - `page` is 1-based; `pageSize` defaults to 25 / clamps at 100 IN THE ADAPTER
 *   (E0-S4) — the type only carries the shape.
 */
export interface ListQuery {
  filter?: Record<string, string | number | boolean>;
  q?: string; // free-text search
  page?: number; // 1-based
  pageSize?: number; // default 25, max 100 — ENFORCED BY THE ADAPTER (E0-S4), not the type
  sort?: string; // "field" | "-field" (desc)
}

/**
 * The uniform paginated list result (project-context.md §4.1). The field is
 * `data` (Reconciliation 1) — keeping the in-app shape aligned with the §5.5
 * wire envelope (`{ data: [...], meta: {...} }`) so no rename seam is needed.
 */
export interface Page<T> {
  data: T[];
  total: number;
  page: number;
  pageSize: number;
}

/** Options shared by mutating operations. `correlationId` lets a batch saga thread
 *  one correlationId across many update/remove calls (E1-S3 offboard). When absent
 *  the adapter mints its own. */
export interface MutationOptions {
  correlationId?: string;
}

/**
 * The one data-access seam (project-context.md §4.1, ADR-004). Five members,
 * exactly as the constitution defines them.
 * - `create` takes only business fields: `Omit<T, keyof BaseEntity>` — the
 *   adapter sets `id`/audit fields/`version = 1` in the create beat (§4.2 rule 3).
 * - `update` takes the caller's `version` for optimistic concurrency; a mismatch
 *   is the adapter's `409` (§4.2 rule 4), not modeled here.
 * - `remove` is a SOFT delete (adapter sets `deletedAt`); lists exclude
 *   soft-deleted unless `filter.includeDeleted = true` (§4.2 rule 5).
 * - Optional `MutationOptions` on `update`/`remove` allows a caller to thread a
 *   shared `correlationId` across a batch (E1-S3). When absent the adapter mints
 *   one per operation (the normal 4-beat behavior).
 */
export interface Repository<T extends BaseEntity> {
  list(q?: ListQuery): Promise<Page<T>>;
  get(id: ID): Promise<T | null>;
  create(input: Omit<T, keyof BaseEntity>): Promise<T>;
  update(
    id: ID,
    patch: Partial<Omit<T, keyof BaseEntity>>,
    version: number,
    options?: MutationOptions,
  ): Promise<T>;
  remove(id: ID, options?: MutationOptions): Promise<void>; // soft delete
}
