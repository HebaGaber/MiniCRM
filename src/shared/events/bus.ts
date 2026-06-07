// The domain event bus (ADR-008): a synchronous, in-process pub/sub for the
// pilot. `DomainEvent` is defined here VERBATIM from project-context.md §7.2 —
// note `occurredAt` (NOT `ts` — Reconciliation 1) and `type` (the canonical
// registry name; the AUDIT discriminator is `action` — Reconciliation 2) and
// `eventId` (the prod outbox idempotency key — NOT `id` — Reconciliation 3).
//
// `publish()` validates `event.type` against the canonical registry FIRST: a
// non-canonical type throws before any handler runs, so free-form names can never
// reach a subscriber and the bus writes no audit (AC3). This module is generic —
// no entity-specific logic: E0-S4 will `publish`, E0-S12 will `subscribe`. The
// production outbox/CQRS-lite is design-only (Epic 6) — not built; we keep
// `eventId` only so that seam is honored. (NFR-1: imports nothing from features.)

import type { ID } from "../domain/types";
import { isEventType } from "./eventTypes";

/**
 * A "something happened" record on the event bus (project-context.md §7.2,
 * verbatim). Tenant-tagged and immutable; carries the shared `correlationId`.
 */
export interface DomainEvent<P = unknown> {
  eventId: ID; // prod outbox idempotency key (ADR-008) — NOT `id` (Reconciliation 3)
  type: string; // canonical registry name, e.g. "Lead.Created"
  tenantId: ID;
  subsidiaryId: ID | null;
  actorId: ID;
  occurredAt: string; // ISO 8601 UTC — NOT "ts" (Reconciliation 1)
  payload: P;
  correlationId: string;
}

/** A subscriber: invoked synchronously with every successfully-published event. */
export type DomainEventHandler = (event: DomainEvent) => void;

// In-process subscriber set. A Set gives idempotent add and O(1) removal so the
// returned unsubscribe is exact even if the same handler subscribed once.
const subscribers = new Set<DomainEventHandler>();

/**
 * Registers a handler for every future published event.
 * @returns an unsubscribe function (idempotent — safe to call more than once).
 */
export function subscribe(handler: DomainEventHandler): () => void {
  subscribers.add(handler);
  return () => {
    subscribers.delete(handler);
  };
}

/**
 * Publishes a domain event synchronously to all current subscribers.
 *
 * The event `type` MUST be a canonical registry name (eventTypes.ts §7.2). A
 * non-canonical type throws BEFORE any handler runs — nothing is dispatched and
 * the free-form name is rejected (AC3). Iterates a snapshot so a handler that
 * (un)subscribes mid-dispatch does not perturb the in-flight delivery.
 *
 * Handler failures are isolated: every subscriber is delivered to even if an
 * earlier one throws, so one buggy listener can't starve the rest. Collected
 * failures are surfaced (not swallowed) as an `AggregateError` AFTER full delivery.
 */
export function publish(event: DomainEvent): void {
  if (!isEventType(event.type)) {
    throw new Error(
      `Non-canonical domain event type "${event.type}" rejected: not in the §7.2 registry (eventTypes.ts).`,
    );
  }
  const errors: unknown[] = [];
  for (const handler of [...subscribers]) {
    try {
      handler(event);
    } catch (error) {
      errors.push(error);
    }
  }
  if (errors.length > 0) {
    throw new AggregateError(
      errors,
      `${errors.length} subscriber(s) threw while handling "${event.type}".`,
    );
  }
}

/**
 * TEST-ONLY: clears all subscribers so specs don't leak state between runs.
 * Not part of the production pub/sub contract — do not call from app code.
 */
export function __resetBus(): void {
  subscribers.clear();
}
