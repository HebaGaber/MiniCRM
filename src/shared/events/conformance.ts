// The UC-2 conformance helper (AC4): production test INFRASTRUCTURE, not a
// one-off. It records what a single operation emits and asserts the universal
// guarantee this story defines — exactly ONE DomainEvent published, exactly ONE
// AuditEvent appended, sharing ONE `correlationId`. E0-S4 and every Epic 1–5
// mutation spec import this to prove their mutation honors UC-2.
//
// It is framework-light and NOT coupled to Vitest internals: it observes through
// the real public APIs (`subscribe` on the bus, `all()` on the audit log) and
// signals violations by throwing a plain `Error`, so any runner (or none) can use
// it. It lives in src/shared/events/ — importable from non-test code paths — not
// in a `__tests__` folder. (NFR-1: imports nothing from src/features/*.)

import type { DomainEvent } from "./bus";
import { subscribe } from "./bus";
import type { AuditEvent } from "./auditLog";
import { all as allAudits } from "./auditLog";

/** What an operation emitted: the domain events published + audit records appended. */
export interface Emissions {
  events: DomainEvent[];
  audits: AuditEvent[];
}

/**
 * Runs `operation` and captures everything it emits: every `DomainEvent`
 * published to the bus and every `AuditEvent` appended to the log DURING the
 * call. Observes through the real public APIs — it subscribes to the bus for the
 * duration and diffs the audit log around the call, so it does not monkey-patch
 * or otherwise perturb the modules under test.
 *
 * Assumes the pilot's synchronous 4-beat (ADR-008). The bus subscription is
 * always torn down, even if `operation` throws.
 */
export function recordEmissions(operation: () => void): Emissions {
  const events: DomainEvent[] = [];
  const unsubscribe = subscribe((e) => events.push(e));
  const auditCountBefore = allAudits().length;
  try {
    operation();
  } finally {
    unsubscribe();
  }
  const audits = allAudits().slice(auditCountBefore);
  return { events, audits };
}

/**
 * Asserts the UC-2 contract on captured `Emissions`: exactly 1 domain event,
 * exactly 1 audit event, and identical `correlationId`s. Throws a descriptive
 * `Error` on any violation (so the helper provably catches 2-events / 0-audits /
 * mismatched-correlationId cases — not just passes the happy path).
 */
export function assertOneOpOneEventOneAudit(emissions: Emissions): void {
  const { events, audits } = emissions;
  if (events.length !== 1) {
    throw new Error(
      `UC-2 violation: expected exactly 1 domain event, got ${events.length}.`,
    );
  }
  const correlationId = events[0].correlationId;
  // Attribute only the audits sharing THIS operation's correlationId. An unrelated
  // append that happened to land in the capture window (another operation's audit)
  // must not count against this op, nor validate the wrong record.
  const related = audits.filter((a) => a.correlationId === correlationId);
  if (related.length === 1) {
    return; // exactly 1 event + 1 audit on one correlationId — conformant.
  }
  if (related.length === 0) {
    if (audits.length === 0) {
      throw new Error(`UC-2 violation: expected exactly 1 audit event, got 0.`);
    }
    // An audit was appended, but none share the domain event's correlationId.
    throw new Error(
      `UC-2 violation: correlationId mismatch — domain "${correlationId}" vs audit "${audits[0].correlationId}".`,
    );
  }
  throw new Error(
    `UC-2 violation: expected exactly 1 audit event, got ${related.length}.`,
  );
}

/**
 * Convenience: run an operation and assert UC-2 in one call. Returns the captured
 * `Emissions` so the caller can make further assertions on the payload/action.
 */
export function expectOneOpOneEventOneAudit(operation: () => void): Emissions {
  const emissions = recordEmissions(operation);
  assertOneOpOneEventOneAudit(emissions);
  return emissions;
}

// ── Async variants (for LocalStorageRepository — E0-S4) ──────────────────────
// The sync helpers above do not await the operation, so they cannot capture
// emissions from async methods. These async variants keep the subscription alive
// through the full `await operation()` span.

/**
 * Async variant of `recordEmissions`: awaits `operation` before tearing down the
 * bus subscription so emissions from async repository methods are captured.
 */
export async function recordEmissionsAsync(
  operation: () => Promise<unknown>,
): Promise<Emissions> {
  const events: DomainEvent[] = [];
  const unsubscribe = subscribe((e) => events.push(e));
  const auditCountBefore = allAudits().length;
  try {
    await operation();
  } finally {
    unsubscribe();
  }
  const audits = allAudits().slice(auditCountBefore);
  return { events, audits };
}

/**
 * Async variant of `expectOneOpOneEventOneAudit`. Awaits `operation`, asserts
 * UC-2 conformance, and returns the captured `Emissions` for further assertions.
 */
export async function expectOneOpOneEventOneAuditAsync(
  operation: () => Promise<unknown>,
): Promise<Emissions> {
  const emissions = await recordEmissionsAsync(operation);
  assertOneOpOneEventOneAudit(emissions);
  return emissions;
}
