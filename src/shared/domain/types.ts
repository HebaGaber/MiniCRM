// The domain kernel: the BaseEntity standard, the type-prefixed ID, the single
// ID factory, and the WorkflowInstance saga state. Every persisted entity in the
// app extends BaseEntity; every entity ID is minted by `newId`. (NFR-2 BaseEntity
// standard; NFR-1: this shared-layer module imports nothing from src/features/*.)
//
// Canonical source: _bmad-output/project-context.md §2 (copied verbatim), with
// the three E0-S2 reconciliations applied — location is domain/types.ts (not
// data/), conversion lineage is optional (`?:`, flag G), and entities split
// across sibling *.types.ts files. crypto.randomUUID() is a platform global
// (Node + DOM); no `uuid` dependency. No TS `enum` — `erasableSyntaxOnly` and
// `verbatimModuleSyntax` are on (see tsconfig.app.json).

// ── §2.1 ID + BaseEntity ─────────────────────────────────────────────────────

/** A type-prefixed UUID v4, e.g. `cust_1f3c…`. Minted only by `newId`. */
export type ID = string;

/**
 * Every persisted entity extends this. (project-context.md §2.1)
 * - `tenantId` is the hard isolation boundary (ADR-002); required on every record.
 * - `subsidiaryId = null` ⇒ a parent-level record (tenant-wide / shared). (ADR-002)
 * - Timestamps are ISO 8601 strings, never `Date`.
 * - Deletes are soft: `deletedAt = null` means active.
 * - `version` is optimistic-concurrency; the repository sets it to 1 on create (E0-S4),
 *   so it is not defaulted here.
 */
export interface BaseEntity {
  id: ID;
  tenantId: ID;
  subsidiaryId: ID | null;
  createdAt: string;
  updatedAt: string;
  createdBy: ID;
  updatedBy: ID;
  version: number;
  deletedAt: string | null;
}

// ── §2.1 Type-prefixed ID factory ────────────────────────────────────────────
// A `const` map (not an `enum`): kind keys are human (`'customer'`), prefixes are
// the §2.1 wire prefixes (`'cust_'`) — they intentionally differ.

export const ID_PREFIXES = {
  lead: "lead_",
  customer: "cust_",
  ticket: "tkt_",
  workflow: "wf_",
  tenant: "tnt_",
  subsidiary: "sub_",
  user: "usr_",
} as const;

/** The set of entity kinds `newId` can mint. */
export type IdKind = keyof typeof ID_PREFIXES;

/**
 * Mints a self-describing, type-prefixed UUID. This is the single ID source for
 * all entity creation — the repository *create* beat (E0-S4) calls it.
 * It is NOT `newCorrelationId()` (that's events/correlation.ts, E0-S7).
 */
export function newId(kind: IdKind): ID {
  return ID_PREFIXES[kind] + crypto.randomUUID();
}

// ── Pattern 2: WorkflowInstance (saga / onboarding persisted state) ───────────
// The durable state the conversion saga (E3-S1) and onboarding workflow (E3-S2)
// read and resume from via the WorkflowRunner (E3). Kept deliberately generic —
// concrete payload shapes and the step lists belong to E3, not here.

export type WorkflowType = "lead_conversion" | "customer_onboarding";
export type WorkflowStatus = "running" | "completed" | "compensating" | "failed";

export interface WorkflowInstance<P = unknown> extends BaseEntity {
  type: WorkflowType;
  status: WorkflowStatus;
  currentStep: number; // resume point — saga reloads from here
  steps: string[]; // ordered step names
  completedSteps: string[]; // names of steps already run (idempotency)
  correlationId: string; // ties the saga's multiple 4-beat mutations together
  payload: P;
}
