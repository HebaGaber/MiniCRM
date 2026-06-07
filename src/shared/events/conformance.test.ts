// Tests for the UC-2 conformance helper (AC4, NFR-12). Proves the helper PASSES a
// well-formed one-op (1 event + 1 audit + shared correlationId) and — critically
// — FAILS on each violation (2 events / 0 audits / mismatched correlationId), so
// downstream stories can trust it actually catches non-conformance.

import { describe, it, expect, beforeEach } from "vitest";
import {
  recordEmissions,
  assertOneOpOneEventOneAudit,
  expectOneOpOneEventOneAudit,
} from "./conformance";
import { publish, __resetBus, type DomainEvent } from "./bus";
import { append, __resetAuditLog, type AuditEvent } from "./auditLog";
import { newCorrelationId } from "./correlation";
import { newId } from "../domain/types";

// Simulate one operation's two sinks with a shared correlationId (the E0-S4 shape).
function domainEvent(correlationId: string): DomainEvent {
  return {
    eventId: newId("workflow"),
    type: "Lead.Created",
    tenantId: newId("tenant"),
    subsidiaryId: null,
    actorId: newId("user"),
    occurredAt: "2026-06-07T00:00:00.000Z",
    payload: {},
    correlationId,
  };
}

function auditEvent(correlationId: string): AuditEvent {
  return {
    id: newId("workflow"),
    tenantId: newId("tenant"),
    subsidiaryId: null,
    actorId: newId("user"),
    action: "lead.create",
    entityType: "Lead",
    entityId: newId("lead"),
    occurredAt: "2026-06-07T00:00:00.000Z",
    correlationId,
  };
}

beforeEach(() => {
  __resetBus();
  __resetAuditLog();
});

describe("conformance helper — passes a conformant one-op (AC4)", () => {
  it("accepts exactly 1 event + 1 audit + shared correlationId", () => {
    const correlationId = newCorrelationId();

    const emissions = expectOneOpOneEventOneAudit(() => {
      publish(domainEvent(correlationId));
      append(auditEvent(correlationId));
    });

    expect(emissions.events).toHaveLength(1);
    expect(emissions.audits).toHaveLength(1);
    expect(emissions.events[0].correlationId).toBe(
      emissions.audits[0].correlationId,
    );
  });

  it("captures only emissions during the operation, not pre-existing audits", () => {
    // A pre-existing audit from an earlier op must not count against this op.
    append(auditEvent(newCorrelationId()));

    const correlationId = newCorrelationId();
    expect(() =>
      expectOneOpOneEventOneAudit(() => {
        publish(domainEvent(correlationId));
        append(auditEvent(correlationId));
      }),
    ).not.toThrow();
  });

  it("ignores an unrelated in-window audit with a different correlationId (Review Patch)", () => {
    const correlationId = newCorrelationId();
    const emissions = recordEmissions(() => {
      publish(domainEvent(correlationId));
      append(auditEvent(correlationId));
      // An unrelated operation's audit lands inside the capture window — it must
      // not count against this op (correlationId filtering).
      append(auditEvent(newCorrelationId()));
    });
    expect(() => assertOneOpOneEventOneAudit(emissions)).not.toThrow();
  });
});

describe("conformance helper — fails on violations (AC4)", () => {
  it("fails when two domain events are emitted", () => {
    const correlationId = newCorrelationId();
    expect(() =>
      expectOneOpOneEventOneAudit(() => {
        publish(domainEvent(correlationId));
        publish(domainEvent(correlationId));
        append(auditEvent(correlationId));
      }),
    ).toThrow(/expected exactly 1 domain event, got 2/);
  });

  it("fails when zero audits are appended", () => {
    const correlationId = newCorrelationId();
    expect(() =>
      expectOneOpOneEventOneAudit(() => {
        publish(domainEvent(correlationId));
      }),
    ).toThrow(/expected exactly 1 audit event, got 0/);
  });

  it("fails when correlationIds do not match", () => {
    const emissions = recordEmissions(() => {
      publish(domainEvent(newCorrelationId()));
      append(auditEvent(newCorrelationId()));
    });
    expect(() => assertOneOpOneEventOneAudit(emissions)).toThrow(
      /correlationId mismatch/,
    );
  });
});
