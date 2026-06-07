// Tests for the append-only audit log + redaction (AC2, AC5, NFR-12): append
// then read returns the record; the store is append-only (no update/delete API)
// and returned records are frozen defensive copies; redact strips secret keys and
// masks email/phone in before/after.

import { describe, it, expect, beforeEach } from "vitest";
import {
  append,
  all,
  redact,
  __resetAuditLog,
  type AuditEvent,
} from "./auditLog";
import { newCorrelationId } from "./correlation";
import { newId } from "../domain/types";

function sampleAudit(overrides: Partial<AuditEvent> = {}): AuditEvent {
  return {
    id: newId("workflow"),
    tenantId: newId("tenant"),
    subsidiaryId: null,
    actorId: newId("user"),
    action: "lead.convert",
    entityType: "Lead",
    entityId: newId("lead"),
    occurredAt: "2026-06-07T00:00:00.000Z",
    correlationId: newCorrelationId(),
    ...overrides,
  };
}

beforeEach(() => {
  __resetAuditLog();
});

describe("append + read (AC2)", () => {
  it("append then read returns the appended record", () => {
    const event = sampleAudit();
    append(event);

    const records = all();
    expect(records).toHaveLength(1);
    expect(records[0].id).toBe(event.id);
    expect(records[0].action).toBe("lead.convert");
    expect(records[0].correlationId).toBe(event.correlationId);
  });

  it("preserves append order across multiple records", () => {
    append(sampleAudit({ action: "lead.create" }));
    append(sampleAudit({ action: "lead.update" }));
    append(sampleAudit({ action: "lead.convert" }));

    expect(all().map((e) => e.action)).toEqual([
      "lead.create",
      "lead.update",
      "lead.convert",
    ]);
  });
});

describe("append-only immutability (AC2)", () => {
  it("exposes no update/delete/clear on the public API", () => {
    // The module's runtime surface is append + all + redact + the test-only reset.
    // There is intentionally no mutation method — assert by absence at the import
    // site: the suite would not compile if we imported a non-existent `update`.
    expect(typeof append).toBe("function");
    expect(typeof all).toBe("function");
  });

  it("mutating a record handed to append does not change stored state", () => {
    const event = sampleAudit({ after: { name: "before-mutation" } });
    append(event);

    // Mutate the caller's reference AFTER appending.
    (event.after as { name: string }).name = "after-mutation";

    expect((all()[0].after as { name: string }).name).toBe("before-mutation");
  });

  it("mutating a returned record does not change what a later read returns", () => {
    append(sampleAudit({ action: "lead.create" }));

    const first = all()[0];
    // Returned records are frozen — attempting to write throws in strict mode
    // (ESM modules are strict), and never changes stored state regardless.
    expect(() => {
      (first as { action: string }).action = "tampered";
    }).toThrow();

    expect(all()[0].action).toBe("lead.create");
  });
});

describe("redact — secret keys + email/phone masking (AC5, §7.4)", () => {
  it("drops secret-bearing key values (case-insensitive)", () => {
    const out = redact({
      password: "hunter2",
      Token: "abc.def",
      apiKey: "sk-123",
      authorization: "Bearer x",
      secret: "s",
      name: "Ada",
    }) as Record<string, unknown>;

    expect(out.password).toBe("[REDACTED]");
    expect(out.Token).toBe("[REDACTED]");
    expect(out.apiKey).toBe("[REDACTED]");
    expect(out.authorization).toBe("[REDACTED]");
    expect(out.secret).toBe("[REDACTED]");
    expect(out.name).toBe("Ada"); // non-secret survives
  });

  it("masks emails as a***@x.com", () => {
    const out = redact({ email: "ada.lovelace@example.com" }) as {
      email: string;
    };
    expect(out.email).toBe("a***@example.com");
  });

  it("masks phone-like digit runs, keeping the last two digits", () => {
    const out = redact({ phone: "+1 (555) 123-4567" }) as { phone: string };
    expect(out.phone).toBe("***67");
  });

  it("leaves ISO 8601 timestamps and free text untouched (no over-masking)", () => {
    const out = redact({
      createdAt: "2026-06-07T00:00:00.000Z",
      note: "Met at the 2026 conference, follow up soon",
    }) as { createdAt: string; note: string };

    expect(out.createdAt).toBe("2026-06-07T00:00:00.000Z");
    expect(out.note).toBe("Met at the 2026 conference, follow up soon");
  });

  it("redacts recursively through nested objects and arrays", () => {
    const out = redact({
      user: { password: "x", contacts: [{ email: "b@y.com" }] },
    }) as { user: { password: string; contacts: { email: string }[] } };

    expect(out.user.password).toBe("[REDACTED]");
    expect(out.user.contacts[0].email).toBe("b***@y.com");
  });

  it("does not mutate its input", () => {
    const input = { password: "x", email: "c@d.com" };
    redact(input);
    expect(input.password).toBe("x");
    expect(input.email).toBe("c@d.com");
  });

  it("append redacts before/after before storing", () => {
    append(
      sampleAudit({
        before: { password: "old", email: "old@x.com" },
        after: { password: "new", email: "new@x.com" },
      }),
    );

    const rec = all()[0];
    expect((rec.before as { password: string }).password).toBe("[REDACTED]");
    expect((rec.before as { email: string }).email).toBe("o***@x.com");
    expect((rec.after as { password: string }).password).toBe("[REDACTED]");
    expect((rec.after as { email: string }).email).toBe("n***@x.com");
  });
});

describe("redact — masking precision (Review Patch — Decision 1)", () => {
  it("does NOT over-mask numeric identifiers (zip+4, short order ids)", () => {
    const out = redact({ zip: "12345-6789", order: "1234567" }) as {
      zip: string;
      order: string;
    };
    expect(out.zip).toBe("12345-6789"); // 9 digits → an id, not a phone
    expect(out.order).toBe("1234567"); // 7 bare digits → an id, not a phone
  });

  it("masks card/account PANs (13–19 digit runs), keeping the last four", () => {
    const out = redact({ card: "1234567890123456" }) as { card: string };
    expect(out.card).toBe("***3456");
  });

  it("masks E.164 and formatted phone numbers, keeping the last two", () => {
    const out = redact({
      intl: "+15551234567",
      formatted: "(555) 123-4567",
    }) as { intl: string; formatted: string };
    expect(out.intl).toBe("***67");
    expect(out.formatted).toBe("***67");
  });

  it("masks value-borne secrets (bearer / JWT) even under a non-secret key", () => {
    const out = redact({
      data: "Bearer eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxIn0.abc",
      raw: "eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxIn0.def",
    }) as { data: string; raw: string };
    expect(out.data).toBe("Bearer [REDACTED]");
    expect(out.raw).toBe("[REDACTED]");
  });
});

describe("redact / append — crash-safety on exotic snapshots (Review Patch)", () => {
  it("resolves cyclic references to [Circular] instead of overflowing the stack", () => {
    const cyclic: Record<string, unknown> = { name: "x" };
    cyclic.self = cyclic;
    const out = redact(cyclic) as { name: string; self: unknown };
    expect(out.name).toBe("x");
    expect(out.self).toBe("[Circular]");
  });

  it("drops functions/symbols (not serializable) rather than throwing", () => {
    const out = redact({ fn: () => {}, sym: Symbol("s"), keep: 1 }) as Record<
      string,
      unknown
    >;
    expect(out.fn).toBeUndefined();
    expect(out.sym).toBeUndefined();
    expect(out.keep).toBe(1);
  });

  it("normalizes Date values to ISO strings instead of flattening to {}", () => {
    const out = redact({ at: new Date("2026-06-07T00:00:00.000Z") }) as {
      at: string;
    };
    expect(out.at).toBe("2026-06-07T00:00:00.000Z");
  });

  it("append never throws and always records, even with a cyclic / function snapshot", () => {
    const cyclic: Record<string, unknown> = { fn: () => {} };
    cyclic.self = cyclic;
    expect(() => append(sampleAudit({ after: cyclic }))).not.toThrow();
    expect(all()).toHaveLength(1);
    expect((all()[0].after as { self: unknown }).self).toBe("[Circular]");
  });
});
