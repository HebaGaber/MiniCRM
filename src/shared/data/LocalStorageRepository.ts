// The pilot localStorage adapter (ADR-004, project-context.md §4). Implements
// Repository<T> with:
//  - localStorage key scheme: crm:{tenantId}:{subsidiaryId|_parent}:{entity}
//  - Tenant/subsidiary scoping from injected SessionClaims (never from callers — UC-5)
//  - The canonical 4-beat use case on every mutation (architecture §Pattern 1):
//    authorize → mutate (Zod validate + write) → emit one DomainEvent → audit one AuditEvent
//  - REST-shaped RepositoryError (statusCode + code + message + details + location)
//  - Fault-injection toggle (ADR-007) for deterministic rollback testing
//  - transition() for status changes (maps to POST /{id}/transition — never PATCH status)
//
// (NFR-1: imports only shared/* siblings — never src/features/*.)

import { z } from "zod";
import type { ID, BaseEntity, IdKind } from "../domain/types";
import { newId } from "../domain/types";
import type { Repository, ListQuery, Page } from "./Repository";
import type { SessionClaims } from "../auth/auth.types";
import type { Capability, Action, OwnedResource } from "../auth/permissions";
import { authorize } from "../auth/permissions";
import { publish } from "../events/bus";
import type { DomainEvent } from "../events/bus";
import { append } from "../events/auditLog";
import { newCorrelationId } from "../events/correlation";
import type { EventType } from "../events/eventTypes";
import { canTransition } from "../domain/status";
import type { TransitionEntity } from "../domain/status";
import { getFaultMode } from "./faultInjection";

// ── Error types ───────────────────────────────────────────────────────────────

/** Field-level validation error detail (REST §5.5 error envelope). */
export interface ValidationDetail {
  field: string;
  issue: string;
}

/**
 * REST-shaped repository error (AC6). `statusCode` mirrors the HTTP code callers
 * should surface: 403 denied · 404 not found · 409 version conflict · 422
 * validation/illegal-transition · 503 network (fault-injected). `location` is
 * set on 201 create so callers can honour the `Location` header contract.
 */
export class RepositoryError extends Error {
  readonly statusCode: number;
  readonly code: string;
  readonly details: ValidationDetail[] | undefined;
  readonly location: string | undefined;

  constructor(
    statusCode: number,
    code: string,
    message: string,
    details?: ValidationDetail[],
    location?: string,
  ) {
    super(message);
    this.name = "RepositoryError";
    this.statusCode = statusCode;
    this.code = code;
    this.details = details;
    this.location = location;
  }
}

// ── EntityConfig ──────────────────────────────────────────────────────────────

/** The canonical event types an entity's repository emits for each operation. */
export interface EntityEventConfig {
  created: EventType;
  updated: EventType;
  deleted: EventType;
  statusChanged?: EventType; // if absent, transition() emits `updated`
}

/**
 * Constructor config for `LocalStorageRepository<T>`. Supply one per entity type
 * at the composition root (src/app) together with the current `SessionClaims`.
 */
export interface EntityConfig<T extends BaseEntity> {
  /** Lowercase entity name — used as the last segment of the localStorage key. */
  name: string;
  /** PascalCase entity name — used as `entityType` in audit events. */
  entityType: string;
  /** Passed to `newId()` to mint type-prefixed IDs on `create`. */
  idKind: IdKind;
  /** Zod schema for the full entity (including BaseEntity fields). */
  schema: z.ZodType<T>;
  /** Capability used for create / update / transition authZ checks. */
  capability: Capability;
  /** Capability used for `remove` (soft-delete). Defaults to `capability`. */
  deleteCapability?: Capability;
  /** Canonical event types for each operation. */
  events: EntityEventConfig;
  /** If set, `transition()` calls `canTransition(transitionEntity, from, to)`. */
  transitionEntity?: TransitionEntity;
}

// ── LocalStorageRepository ───────────────────────────────────────────────────

/**
 * The pilot localStorage adapter. Implements `Repository<T>` with full
 * 4-beat use-case semantics, REST-shaped errors, and the fault-injection toggle.
 * Constructed with `EntityConfig<T>` + the current `SessionClaims` at the
 * composition root; the session is never passed per-call (UC-5).
 */
export class LocalStorageRepository<T extends BaseEntity> implements Repository<T> {
  private config: EntityConfig<T>;
  private session: SessionClaims;

  constructor(config: EntityConfig<T>, session: SessionClaims) {
    this.config = config;
    this.session = session;
  }

  // ── Private: key helpers ─────────────────────────────────────────────────

  /** The localStorage bucket key for new records from this session. */
  private writeKey(): string {
    const seg = this.session.subsidiaryId ?? "_parent";
    return `crm:${this.session.tenantId}:${seg}:${this.config.name}`;
  }

  /**
   * All bucket keys accessible to this session.
   * - `tenant_admin` (subsidiaryId=null): scans ALL keys matching `crm:{tenantId}:*:{name}`.
   * - Subsidiary user: [`crm:{tenantId}:_parent:{name}`, `crm:{tenantId}:{subsidiaryId}:{name}`].
   */
  private accessibleKeys(): string[] {
    const { tenantId, subsidiaryId } = this.session;
    const entity = this.config.name;
    if (subsidiaryId === null) {
      if (typeof localStorage === "undefined") return [];
      const prefix = `crm:${tenantId}:`;
      const suffix = `:${entity}`;
      const keys: string[] = [];
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        if (k !== null && k.startsWith(prefix) && k.endsWith(suffix)) keys.push(k);
      }
      return keys;
    }
    return [
      `crm:${tenantId}:_parent:${entity}`,
      `crm:${tenantId}:${subsidiaryId}:${entity}`,
    ];
  }

  private readBucket(key: string): T[] {
    if (typeof localStorage === "undefined") return [];
    const raw = localStorage.getItem(key);
    if (!raw) return [];
    try {
      return JSON.parse(raw) as T[];
    } catch {
      return [];
    }
  }

  private writeBucket(key: string, rows: T[]): void {
    if (typeof localStorage === "undefined") return;
    localStorage.setItem(key, JSON.stringify(rows));
  }

  /** All rows accessible to this session, optionally including soft-deleted. */
  private getAccessibleRows(includeDeleted = false): T[] {
    const rows = this.accessibleKeys().flatMap((k) => this.readBucket(k));
    return includeDeleted ? rows : rows.filter((r) => r.deletedAt === null);
  }

  /** Finds a record AND its bucket key across all accessible buckets. */
  private findRecord(id: ID): { record: T; bucketKey: string } | null {
    for (const key of this.accessibleKeys()) {
      const rows = this.readBucket(key);
      const record = rows.find((r) => r.id === id);
      if (record !== undefined) return { record, bucketKey: key };
    }
    return null;
  }

  // ── Private: validation ──────────────────────────────────────────────────

  /** Validates a full entity candidate; throws RepositoryError(422) on failure. */
  private validate(entity: unknown): T {
    const result = this.config.schema.safeParse(entity);
    if (!result.success) {
      const details: ValidationDetail[] = result.error.issues.map((i) => ({
        field: i.path.length > 0 ? i.path.join(".") : "_",
        issue: i.message,
      }));
      throw new RepositoryError(422, "VALIDATION", "Validation failed", details);
    }
    return result.data;
  }

  // ── Private: authorization ───────────────────────────────────────────────

  /** Calls the audited authorize gate; maps AuthZOutcome to RepositoryError throws. */
  private checkAuthorize(
    action: Action,
    resource: OwnedResource,
    capability: Capability = this.config.capability,
  ): void {
    const outcome = authorize(this.session, capability, action, resource);
    if (outcome === "notFound") {
      throw new RepositoryError(404, "NOT_FOUND", "Record not found");
    }
    if (outcome === "denied") {
      throw new RepositoryError(403, "FORBIDDEN", "Access denied");
    }
    // 'granted' → fall through
  }

  // ── Private: fault injection ─────────────────────────────────────────────

  /** Checks the fault-injection toggle; throws the matching RepositoryError if set. */
  private checkFaultInjection(): void {
    const mode = getFaultMode();
    if (mode === "409") {
      throw new RepositoryError(409, "VERSION_CONFLICT", "Fault-injected version conflict");
    }
    if (mode === "422") {
      throw new RepositoryError(422, "VALIDATION", "Fault-injected validation error", [
        { field: "_", issue: "fault injected" },
      ]);
    }
    if (mode === "network") {
      throw new RepositoryError(503, "NETWORK", "Fault-injected network failure");
    }
  }

  // ── Repository<T> interface ──────────────────────────────────────────────

  /**
   * Lists accessible (non-deleted-unless-includeDeleted) records for this session.
   * Applies free-text search, field filters (unknown keys silently ignored), sort,
   * and pagination. `pageSize` defaults to 25; clamped to max 100.
   */
  async list(q?: ListQuery): Promise<Page<T>> {
    const page = Math.max(1, q?.page ?? 1);
    const pageSize = Math.min(100, Math.max(1, q?.pageSize ?? 25));
    const includeDeleted = q?.filter?.includeDeleted === true;

    let rows = this.getAccessibleRows(includeDeleted);

    // Free-text search across string field values
    if (q?.q) {
      const qt = q.q.toLowerCase();
      rows = rows.filter((r) =>
        Object.values(r as Record<string, unknown>).some(
          (v) => typeof v === "string" && v.toLowerCase().includes(qt),
        ),
      );
    }

    // Field filters — unknown keys silently ignored (UC-5 forward-compat)
    if (q?.filter) {
      for (const [key, value] of Object.entries(q.filter)) {
        if (key === "includeDeleted") continue;
        rows = rows.filter((r) => (r as Record<string, unknown>)[key] === value);
      }
    }

    // Sort: "field" → asc, "-field" → desc
    if (q?.sort) {
      const desc = q.sort.startsWith("-");
      const field = desc ? q.sort.slice(1) : q.sort;
      rows = [...rows].sort((a, b) => {
        const av = (a as Record<string, unknown>)[field];
        const bv = (b as Record<string, unknown>)[field];
        if (av === bv) return 0;
        const cmp = av == null ? -1 : bv == null ? 1 : av < bv ? -1 : 1;
        return desc ? -cmp : cmp;
      });
    }

    const total = rows.length;
    const start = (page - 1) * pageSize;
    return { data: rows.slice(start, start + pageSize), total, page, pageSize };
  }

  /**
   * Returns the record by ID, or `null` if not found or soft-deleted.
   * Out-of-tenant IDs return `null` (404) — existence is never disclosed.
   */
  async get(id: ID): Promise<T | null> {
    const hit = this.findRecord(id);
    if (hit === null || hit.record.deletedAt !== null) return null;
    return hit.record;
  }

  /**
   * Creates a record. Runs the 4-beat use case:
   * authorize (create) → validate + write → emit `<Entity>.Created` → audit.
   * Sets `id`, all BaseEntity audit fields, `version=1` from session context.
   * Returns the persisted entity (REST 201 + Location semantics: see `RepositoryError.location`).
   */
  async create(input: Omit<T, keyof BaseEntity>): Promise<T> {
    this.checkFaultInjection();

    const correlationId = newCorrelationId();
    const now = new Date().toISOString();

    const draft = {
      ...(input as object),
      id: newId(this.config.idKind),
      tenantId: this.session.tenantId,
      subsidiaryId: this.session.subsidiaryId,
      createdAt: now,
      updatedAt: now,
      createdBy: this.session.userId,
      updatedBy: this.session.userId,
      version: 1,
      deletedAt: null,
    } as unknown as T;

    // BEAT 1 — AUTHORIZE
    this.checkAuthorize("create", {
      tenantId: draft.tenantId,
      subsidiaryId: draft.subsidiaryId,
      entityType: this.config.entityType,
    });

    // BEAT 2 — MUTATE (validate + write)
    const entity = this.validate(draft);
    const bucketKey = this.writeKey();
    const rows = this.readBucket(bucketKey);
    rows.push(entity);
    this.writeBucket(bucketKey, rows);

    // BEAT 3 — EMIT
    publish(this.domainEvent(this.config.events.created, entity, correlationId, now));

    // BEAT 4 — AUDIT
    append({
      id: crypto.randomUUID(),
      tenantId: entity.tenantId,
      subsidiaryId: entity.subsidiaryId,
      actorId: this.session.userId,
      action: `${this.config.name}.create`,
      entityType: this.config.entityType,
      entityId: entity.id,
      occurredAt: now,
      after: entity,
      correlationId,
    });

    return entity;
  }

  /**
   * Updates a record's non-status fields. Runs the 4-beat use case.
   * Rejects `status` in the patch with 422 — use `transition()` for status changes.
   * Requires the caller's `version`; mismatch → 409.
   */
  async update(id: ID, patch: Partial<Omit<T, keyof BaseEntity>>, version: number): Promise<T> {
    this.checkFaultInjection();

    // Reject status changes via update (must use transition — AC3/AC6)
    if (Object.hasOwn(patch as object, "status")) {
      throw new RepositoryError(422, "PATCH_STATUS", "Status transitions must use transition()", [
        { field: "status", issue: "Use transition() to change entity status" },
      ]);
    }

    const hit = this.findRecord(id);
    if (hit === null || hit.record.deletedAt !== null) {
      throw new RepositoryError(404, "NOT_FOUND", `Record ${id} not found`);
    }
    const { record, bucketKey } = hit;

    const correlationId = newCorrelationId();
    const now = new Date().toISOString();

    // BEAT 1 — AUTHORIZE
    this.checkAuthorize("edit", this.ownedResource(record));

    // Version check (409)
    if (record.version !== version) {
      throw new RepositoryError(
        409,
        "VERSION_CONFLICT",
        `Version conflict: supplied ${version}, stored ${record.version}`,
      );
    }

    // BEAT 2 — MUTATE (validate + write)
    const merged = {
      ...(record as object),
      ...(patch as object),
      updatedAt: now,
      updatedBy: this.session.userId,
      version: record.version + 1,
    } as unknown as T;

    const validated = this.validate(merged);
    this.replaceInBucket(bucketKey, id, validated);

    // BEAT 3 — EMIT
    publish(
      this.domainEvent(this.config.events.updated, validated, correlationId, now, {
        before: record,
        after: validated,
      }),
    );

    // BEAT 4 — AUDIT
    append({
      id: crypto.randomUUID(),
      tenantId: validated.tenantId,
      subsidiaryId: validated.subsidiaryId,
      actorId: this.session.userId,
      action: `${this.config.name}.update`,
      entityType: this.config.entityType,
      entityId: validated.id,
      occurredAt: now,
      before: record,
      after: validated,
      correlationId,
    });

    return validated;
  }

  /**
   * Soft-deletes a record (`deletedAt` set). Runs the 4-beat use case.
   * Lists and `get()` exclude soft-deleted records (use `filter.includeDeleted=true` to include).
   */
  async remove(id: ID): Promise<void> {
    this.checkFaultInjection();

    const hit = this.findRecord(id);
    if (hit === null || hit.record.deletedAt !== null) {
      throw new RepositoryError(404, "NOT_FOUND", `Record ${id} not found`);
    }
    const { record, bucketKey } = hit;

    const correlationId = newCorrelationId();
    const now = new Date().toISOString();

    // BEAT 1 — AUTHORIZE
    this.checkAuthorize(
      "softDelete",
      this.ownedResource(record),
      this.config.deleteCapability ?? this.config.capability,
    );

    // BEAT 2 — MUTATE (validate + soft delete)
    const deletedDraft = {
      ...(record as object),
      deletedAt: now,
      updatedAt: now,
      updatedBy: this.session.userId,
      version: record.version + 1,
    } as unknown as T;

    const deleted = this.validate(deletedDraft);
    this.replaceInBucket(bucketKey, id, deleted);

    // BEAT 3 — EMIT
    publish(
      this.domainEvent(this.config.events.deleted, deleted, correlationId, now, {
        id: deleted.id,
      }),
    );

    // BEAT 4 — AUDIT
    append({
      id: crypto.randomUUID(),
      tenantId: deleted.tenantId,
      subsidiaryId: deleted.subsidiaryId,
      actorId: this.session.userId,
      action: `${this.config.name}.delete`,
      entityType: this.config.entityType,
      entityId: deleted.id,
      occurredAt: now,
      before: record,
      correlationId,
    });
  }

  /**
   * Transitions a record's status (maps to `POST /{id}/transition` — AC6).
   * Calls `canTransition` from `status.ts`; illegal move → 422. Runs the 4-beat.
   * Emits `<Entity>.StatusChanged` if configured, otherwise `<Entity>.Updated`.
   * Requires the caller's `version`; mismatch → 409.
   */
  async transition(id: ID, to: string, version: number): Promise<T> {
    this.checkFaultInjection();

    const hit = this.findRecord(id);
    if (hit === null || hit.record.deletedAt !== null) {
      throw new RepositoryError(404, "NOT_FOUND", `Record ${id} not found`);
    }
    const { record, bucketKey } = hit;

    const correlationId = newCorrelationId();
    const now = new Date().toISOString();

    // BEAT 1 — AUTHORIZE (transition action)
    this.checkAuthorize("transition", this.ownedResource(record));

    // Version check (409)
    if (record.version !== version) {
      throw new RepositoryError(
        409,
        "VERSION_CONFLICT",
        `Version conflict: supplied ${version}, stored ${record.version}`,
      );
    }

    const from = (record as Record<string, unknown>)["status"] as string | undefined ?? "";

    // canTransition check (422)
    if (!this.config.transitionEntity || !canTransition(this.config.transitionEntity, from, to)) {
      throw new RepositoryError(
        422,
        "ILLEGAL_TRANSITION",
        `Cannot transition from '${from}' to '${to}'`,
        [{ field: "status", issue: `Transition '${from}' → '${to}' is not allowed` }],
      );
    }

    // BEAT 2 — MUTATE
    const transitioned = {
      ...(record as object),
      status: to,
      updatedAt: now,
      updatedBy: this.session.userId,
      version: record.version + 1,
    } as unknown as T;

    const validated = this.validate(transitioned);
    this.replaceInBucket(bucketKey, id, validated);

    const eventType = this.config.events.statusChanged ?? this.config.events.updated;

    // BEAT 3 — EMIT
    publish(
      this.domainEvent(eventType, validated, correlationId, now, { id: validated.id, from, to }),
    );

    // BEAT 4 — AUDIT
    append({
      id: crypto.randomUUID(),
      tenantId: validated.tenantId,
      subsidiaryId: validated.subsidiaryId,
      actorId: this.session.userId,
      action: `${this.config.name}.transition`,
      entityType: this.config.entityType,
      entityId: validated.id,
      occurredAt: now,
      before: { status: from },
      after: { status: to },
      correlationId,
    });

    return validated;
  }

  // ── Private: shared helpers ──────────────────────────────────────────────

  /** Replaces the record at `id` in the named bucket. No-op if not found. */
  private replaceInBucket(bucketKey: string, id: ID, updated: T): void {
    const rows = this.readBucket(bucketKey);
    const idx = rows.findIndex((r) => r.id === id);
    if (idx !== -1) rows[idx] = updated;
    this.writeBucket(bucketKey, rows);
  }

  /** Builds an `OwnedResource` from a stored entity for the authZ gate. */
  private ownedResource(record: T): OwnedResource {
    const r = record as Record<string, unknown>;
    return {
      tenantId: record.tenantId,
      subsidiaryId: record.subsidiaryId,
      ownerId: typeof r["ownerId"] === "string" ? r["ownerId"] : undefined,
      assigneeId:
        typeof r["assigneeId"] === "string" || r["assigneeId"] === null
          ? (r["assigneeId"] as ID | null)
          : undefined,
      id: record.id,
      entityType: this.config.entityType,
    };
  }

  /** Constructs a well-formed `DomainEvent` for BEAT 3. */
  private domainEvent(
    type: EventType,
    entity: T,
    correlationId: string,
    occurredAt: string,
    payload?: unknown,
  ): DomainEvent {
    return {
      eventId: crypto.randomUUID(),
      type,
      tenantId: entity.tenantId,
      subsidiaryId: entity.subsidiaryId,
      actorId: this.session.userId,
      occurredAt,
      payload: payload ?? entity,
      correlationId,
    };
  }
}
