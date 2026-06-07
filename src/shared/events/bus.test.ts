// Tests for the domain event bus (AC1, AC3, NFR-12): canonical publish reaches
// subscribers; non-canonical publish throws and reaches NO subscriber; subscribe
// returns a working unsubscribe.

import { describe, it, expect, beforeEach } from "vitest";
import { publish, subscribe, __resetBus, type DomainEvent } from "./bus";
import { newCorrelationId } from "./correlation";
import { newId } from "../domain/types";

// A canonical, fully-populated DomainEvent builder for the tests.
function sampleEvent(overrides: Partial<DomainEvent> = {}): DomainEvent {
  return {
    eventId: newId("workflow"),
    type: "Lead.Created",
    tenantId: newId("tenant"),
    subsidiaryId: null,
    actorId: newId("user"),
    occurredAt: "2026-06-07T00:00:00.000Z",
    payload: { leadId: newId("lead") },
    correlationId: newCorrelationId(),
    ...overrides,
  };
}

beforeEach(() => {
  __resetBus();
});

describe("publish — canonical events reach subscribers (AC1)", () => {
  it("dispatches a canonical event to every current subscriber", () => {
    const seenA: DomainEvent[] = [];
    const seenB: DomainEvent[] = [];
    subscribe((e) => seenA.push(e));
    subscribe((e) => seenB.push(e));

    const event = sampleEvent();
    publish(event);

    expect(seenA).toEqual([event]);
    expect(seenB).toEqual([event]);
  });
});

describe("publish — rejects non-canonical types (AC3)", () => {
  it("throws and dispatches to NO subscriber for a free-form type", () => {
    const seen: DomainEvent[] = [];
    subscribe((e) => seen.push(e));

    expect(() => publish(sampleEvent({ type: "Lead.Frobnicated" }))).toThrow(
      /Non-canonical domain event type/,
    );
    expect(seen).toHaveLength(0);
  });

  it.each(["lead.created", "Foo.Bar", ""])(
    'throws for malformed type "%s"',
    (type) => {
      expect(() => publish(sampleEvent({ type }))).toThrow();
    },
  );
});

describe("subscribe — returns a working unsubscribe", () => {
  it("stops delivering after unsubscribe", () => {
    const seen: DomainEvent[] = [];
    const unsubscribe = subscribe((e) => seen.push(e));

    publish(sampleEvent());
    expect(seen).toHaveLength(1);

    unsubscribe();
    publish(sampleEvent());
    expect(seen).toHaveLength(1); // no further delivery

    // Unsubscribe is idempotent — calling again is a safe no-op.
    expect(() => unsubscribe()).not.toThrow();
  });
});

describe("publish — isolates subscriber failures (Review Patch)", () => {
  it("delivers to every subscriber even when an earlier one throws", () => {
    const seen: DomainEvent[] = [];
    subscribe(() => {
      throw new Error("boom");
    });
    subscribe((e) => seen.push(e));

    // publish surfaces the failure, but the later subscriber still received it.
    expect(() => publish(sampleEvent())).toThrow();
    expect(seen).toHaveLength(1);
  });

  it("surfaces handler failures as an AggregateError after full delivery", () => {
    subscribe(() => {
      throw new Error("a");
    });
    subscribe(() => {
      throw new Error("b");
    });

    try {
      publish(sampleEvent());
      throw new Error("expected publish to throw");
    } catch (error) {
      expect(error).toBeInstanceOf(AggregateError);
      expect((error as AggregateError).errors).toHaveLength(2);
    }
  });
});
