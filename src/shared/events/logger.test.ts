import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { logger } from "./logger";
import type { LogContext } from "./logger";

// ── Test helpers ──────────────────────────────────────────────────────────────

const ctx: LogContext = {
  tenantId: "ten_001",
  subsidiaryId: "sub_001",
  actorId: "usr_001",
  correlationId: "cor-abc-123",
};

const ctxNoSubsidiary: LogContext = {
  tenantId: "ten_002",
  subsidiaryId: null,
  actorId: "usr_002",
  correlationId: "cor-xyz-789",
};

/** Captures console.log output for a single call block. */
function captureLog(fn: () => void): string[] {
  const captured: string[] = [];
  const orig = console.log;
  console.log = (msg: string) => {
    captured.push(msg);
  };
  try {
    fn();
  } finally {
    console.log = orig;
  }
  return captured;
}

function captureError(fn: () => void): string[] {
  const captured: string[] = [];
  const orig = console.error;
  console.error = (msg: string) => {
    captured.push(msg);
  };
  try {
    fn();
  } finally {
    console.error = orig;
  }
  return captured;
}

function captureWarn(fn: () => void): string[] {
  const captured: string[] = [];
  const orig = console.warn;
  console.warn = (msg: string) => {
    captured.push(msg);
  };
  try {
    fn();
  } finally {
    console.warn = orig;
  }
  return captured;
}

// ── AC1 — Structured JSON shape ───────────────────────────────────────────────

describe("AC1 — structured JSON shape", () => {
  it("emits all required fields for logger.info", () => {
    const [line] = captureLog(() => logger.info(ctx, "Lead created"));
    const record = JSON.parse(line);

    expect(typeof record.ts).toBe("string");
    // ts is ISO 8601
    expect(() => new Date(record.ts)).not.toThrow();
    expect(record.level).toBe("info");
    expect(record.tenantId).toBe("ten_001");
    expect(record.subsidiaryId).toBe("sub_001");
    expect(record.actorId).toBe("usr_001");
    expect(record.msg).toBe("Lead created");
    expect(record.correlationId).toBe("cor-abc-123");
  });

  it("includes extra fields in the emitted record", () => {
    const [line] = captureLog(() =>
      logger.info(ctx, "ticket updated", { ticketId: "tkt_001", stage: "open" }),
    );
    const record = JSON.parse(line);
    expect(record.ticketId).toBe("tkt_001");
    expect(record.stage).toBe("open");
  });

  it("handles subsidiaryId = null", () => {
    const [line] = captureLog(() =>
      logger.info(ctxNoSubsidiary, "action taken"),
    );
    const record = JSON.parse(line);
    expect(record.subsidiaryId).toBeNull();
    expect(record.tenantId).toBe("ten_002");
    expect(record.correlationId).toBe("cor-xyz-789");
  });

  it("correlationId in the record matches the one supplied in ctx", () => {
    const specificCtx: LogContext = {
      ...ctx,
      correlationId: "cor-unique-999",
    };
    const [line] = captureLog(() => logger.info(specificCtx, "test"));
    const record = JSON.parse(line);
    expect(record.correlationId).toBe("cor-unique-999");
  });

  it("emits valid JSON (parseable)", () => {
    const [line] = captureLog(() => logger.info(ctx, "valid JSON check"));
    expect(() => JSON.parse(line)).not.toThrow();
  });

  it("extra fields cannot overwrite correlationId from ctx", () => {
    const [line] = captureLog(() =>
      logger.info(ctx, "test", { correlationId: "injected-bad" }),
    );
    const record = JSON.parse(line);
    expect(record.correlationId).toBe(ctx.correlationId);
    expect(record.correlationId).not.toBe("injected-bad");
  });

  it("extra fields cannot overwrite level", () => {
    const [line] = captureLog(() =>
      logger.info(ctx, "test", { level: "error" }),
    );
    const record = JSON.parse(line);
    expect(record.level).toBe("info");
  });

  it("extra fields cannot overwrite ts", () => {
    const fixedTs = "2000-01-01T00:00:00.000Z";
    const [line] = captureLog(() =>
      logger.info(ctx, "test", { ts: fixedTs }),
    );
    const record = JSON.parse(line);
    expect(record.ts).not.toBe(fixedTs);
  });
});

// ── AC2 — PII masking ─────────────────────────────────────────────────────────

describe("AC2 — PII masking (NFR-8)", () => {
  it("masks email addresses in msg", () => {
    const [line] = captureLog(() =>
      logger.info(ctx, "user heba@example.com logged in"),
    );
    const record = JSON.parse(line);
    expect(record.msg).not.toContain("heba@example.com");
    expect(record.msg).toContain("h***@example.com");
  });

  it("masks email addresses in extra fields", () => {
    const [line] = captureLog(() =>
      logger.info(ctx, "user action", { email: "john@domain.org" }),
    );
    const record = JSON.parse(line);
    expect(record.email).not.toContain("john@domain.org");
    expect(record.email).toContain("j***@domain.org");
  });

  it("redacts password field values", () => {
    const [line] = captureLog(() =>
      logger.info(ctx, "auth attempt", { password: "supersecret" }),
    );
    const record = JSON.parse(line);
    expect(record.password).toBe("[REDACTED]");
    expect(record.password).not.toContain("supersecret");
  });

  it("redacts token field values", () => {
    const [line] = captureLog(() =>
      logger.info(ctx, "auth", { token: "abc123token" }),
    );
    const record = JSON.parse(line);
    expect(record.token).toBe("[REDACTED]");
    expect(record.token).not.toContain("abc123token");
  });

  it("redacts authorization field values", () => {
    const [line] = captureLog(() =>
      logger.info(ctx, "request", { authorization: "Bearer abc" }),
    );
    const record = JSON.parse(line);
    expect(record.authorization).toBe("[REDACTED]");
  });

  it("does not log raw PII when extra contains secret", () => {
    const [line] = captureLog(() =>
      logger.info(ctx, "operation", { secret: "my-secret-key" }),
    );
    expect(line).not.toContain("my-secret-key");
  });

  it("does not log unmasked email in msg", () => {
    const rawEmail = "user@corp.com";
    const [line] = captureLog(() =>
      logger.info(ctx, `logged in as ${rawEmail}`),
    );
    expect(line).not.toContain(rawEmail);
  });

  it("does not log raw password in extra", () => {
    const [line] = captureLog(() =>
      logger.info(ctx, "change", { password: "p@ssw0rd!" }),
    );
    expect(line).not.toContain("p@ssw0rd!");
  });

  it("passes through safe string values unchanged", () => {
    const [line] = captureLog(() =>
      logger.info(ctx, "Lead created", { leadId: "lead_001" }),
    );
    const record = JSON.parse(line);
    expect(record.leadId).toBe("lead_001");
  });
});

// ── AC3 — Log levels ──────────────────────────────────────────────────────────

describe("AC3 — log levels", () => {
  it("logger.error emits level=error via console.error", () => {
    const captured = captureError(() => logger.error(ctx, "something failed"));
    expect(captured.length).toBe(1);
    const record = JSON.parse(captured[0]);
    expect(record.level).toBe("error");
  });

  it("logger.warn emits level=warn via console.warn", () => {
    const captured = captureWarn(() => logger.warn(ctx, "degraded state"));
    expect(captured.length).toBe(1);
    const record = JSON.parse(captured[0]);
    expect(record.level).toBe("warn");
  });

  it("logger.info emits level=info via console.log", () => {
    const captured = captureLog(() => logger.info(ctx, "state changed"));
    expect(captured.length).toBe(1);
    const record = JSON.parse(captured[0]);
    expect(record.level).toBe("info");
  });

  it("logger.debug emits level=debug via console.log", () => {
    const captured = captureLog(() => logger.debug(ctx, "dev detail"));
    expect(captured.length).toBe(1);
    const record = JSON.parse(captured[0]);
    expect(record.level).toBe("debug");
  });

  it("logger.error does NOT write to console.log or console.warn", () => {
    const logLines = captureLog(() => logger.error(ctx, "err"));
    const warnLines = captureWarn(() => logger.error(ctx, "err"));
    // Each capture independently — error only goes to console.error
    expect(logLines.length).toBe(0);
    expect(warnLines.length).toBe(0);
  });

  it("logger.warn does NOT write to console.log or console.error", () => {
    const logLines = captureLog(() => logger.warn(ctx, "warn"));
    const errLines = captureError(() => logger.warn(ctx, "warn"));
    expect(logLines.length).toBe(0);
    expect(errLines.length).toBe(0);
  });

  it("each level produces exactly one line per call", () => {
    expect(captureError(() => logger.error(ctx, "e")).length).toBe(1);
    expect(captureWarn(() => logger.warn(ctx, "w")).length).toBe(1);
    expect(captureLog(() => logger.info(ctx, "i")).length).toBe(1);
    expect(captureLog(() => logger.debug(ctx, "d")).length).toBe(1);
  });
});

// ── Additional edge cases ─────────────────────────────────────────────────────

describe("edge cases", () => {
  it("logs without extra fields (extra is undefined)", () => {
    const [line] = captureLog(() => logger.info(ctx, "minimal log"));
    const record = JSON.parse(line);
    expect(record.msg).toBe("minimal log");
  });

  it("extra fields do not overwrite required fields (spread order guard)", () => {
    // extra is spread BEFORE fixed fields so core fields always win.
    const [line] = captureLog(() =>
      logger.info(ctx, "test", { level: "error", ts: "2000-01-01T00:00:00.000Z" }),
    );
    const record = JSON.parse(line);
    expect(record.level).toBe("info");
    expect(record.ts).not.toBe("2000-01-01T00:00:00.000Z");
    expect(record.tenantId).toBe("ten_001");
  });

  it("emits a fallback line when JSON.stringify would throw (crash-safe)", () => {
    // BigInt is not JSON-serializable; emit() should not throw but instead
    // emit a core-fields-only line with serializationError: true.
    const bigintExtra = { count: BigInt(42) } as unknown as Record<string, unknown>;
    const [line] = captureLog(() => logger.info(ctx, "bigint test", bigintExtra));
    const record = JSON.parse(line);
    expect(record.serializationError).toBe(true);
    expect(record.correlationId).toBe(ctx.correlationId);
    expect(record.msg).toBe("bigint test");
  });

  it("nested extra fields containing PII are masked", () => {
    const [line] = captureLog(() =>
      logger.info(ctx, "nested", { user: { email: "a@b.com", name: "Alice" } }),
    );
    const record = JSON.parse(line);
    // email inside nested object is masked
    expect(JSON.stringify(record.user)).not.toContain("a@b.com");
  });
});

// ── Restore console methods after each test ───────────────────────────────────
// The capture helpers above restore inline (finally), but as an extra safety net:
let origLog: typeof console.log;
let origError: typeof console.error;
let origWarn: typeof console.warn;

beforeEach(() => {
  origLog = console.log;
  origError = console.error;
  origWarn = console.warn;
});

afterEach(() => {
  console.log = origLog;
  console.error = origError;
  console.warn = origWarn;
});
