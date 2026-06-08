// Structured logger (E0-S8, project-context.md §7.4 / ADR-008 / Pattern 7).
//
// Emits JSON log records shaped exactly as §7.4:
//   { ts, level, tenantId, subsidiaryId, actorId, msg, correlationId, ...extra }
//
// PII masking (NFR-8): msg and every extra field are passed through `redact()`
// (imported from auditLog.ts — one masker shared with E0-S7, not two).
//
// The caller supplies context (tenantId/subsidiaryId/actorId/correlationId) as a
// plain object. The logger does NOT call useAuth() or getAuthContext() — it is a
// pure shared-layer utility usable in node test environments and non-React code.
//
// Output sink: console.error (error), console.warn (warn), console.log (info/debug).
// No external logging library — ADR-008 specifies in-process for the pilot.
//
// NFR-1: this module imports nothing from src/features/* or src/app/*.

import { redact } from "./auditLog";

/** The four log levels from §7.4. */
export type LogLevel = "error" | "warn" | "info" | "debug";

/**
 * Caller-supplied context for a log line. Comes from the active operation's
 * auth context + the correlationId minted at action start (Pattern 7).
 */
export interface LogContext {
  tenantId: string;
  subsidiaryId: string | null;
  actorId: string;
  correlationId: string;
}

/**
 * The emitted log record (§7.4 verbatim).
 * `ts` is the log-line timestamp (ISO 8601 UTC) — distinct from `occurredAt`
 * on AuditEvent/DomainEvent (Reconciliation 1 from E0-S7).
 */
export interface LogRecord {
  ts: string;
  level: LogLevel;
  tenantId: string;
  subsidiaryId: string | null;
  actorId: string;
  msg: string;
  correlationId: string;
  [key: string]: unknown;
}

function emit(
  level: LogLevel,
  ctx: LogContext,
  msg: string,
  extra?: Record<string, unknown>,
): void {
  const redactedMsg = redact(msg) as string;
  const redactedExtra = extra ? (redact(extra) as Record<string, unknown>) : {};

  // Spread redactedExtra BEFORE fixed fields so caller-supplied keys cannot
  // overwrite ts, level, tenantId, actorId, msg, or correlationId.
  const record: LogRecord = {
    ...redactedExtra,
    ts: new Date().toISOString(),
    level,
    tenantId: ctx.tenantId,
    subsidiaryId: ctx.subsidiaryId,
    actorId: ctx.actorId,
    msg: redactedMsg,
    correlationId: ctx.correlationId,
  };

  // Crash-safe serialization: if extra contains a non-serializable value
  // (e.g. BigInt), fall back to emitting the core fields only so the log
  // line is never silently lost.
  let line: string;
  try {
    line = JSON.stringify(record);
  } catch {
    line = JSON.stringify({
      ts: record.ts,
      level: record.level,
      tenantId: record.tenantId,
      subsidiaryId: record.subsidiaryId,
      actorId: record.actorId,
      msg: record.msg,
      correlationId: record.correlationId,
      serializationError: true,
    });
  }

  if (level === "error") {
    console.error(line);
  } else if (level === "warn") {
    console.warn(line);
  } else {
    console.log(line);
  }
}

export const logger = {
  error(ctx: LogContext, msg: string, extra?: Record<string, unknown>): void {
    emit("error", ctx, msg, extra);
  },
  warn(ctx: LogContext, msg: string, extra?: Record<string, unknown>): void {
    emit("warn", ctx, msg, extra);
  },
  info(ctx: LogContext, msg: string, extra?: Record<string, unknown>): void {
    emit("info", ctx, msg, extra);
  },
  debug(ctx: LogContext, msg: string, extra?: Record<string, unknown>): void {
    emit("debug", ctx, msg, extra);
  },
};
