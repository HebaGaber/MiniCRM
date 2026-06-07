// The append-only audit log (ADR-008, project-context.md §7.1): the immutable
// "who did what, when" compliance stream. `AuditEvent` is defined here VERBATIM
// from §7.1 — note `id` (NOT `eventId` — Reconciliation 3), `action` (a lowercase
// dotted verb, e.g. "lead.convert"; the DOMAIN discriminator is `type` —
// Reconciliation 2), and `occurredAt` (NOT `ts` — Reconciliation 1).
//
// APPEND + READ ONLY (AC2): there is no update/delete/clear in the production
// API, and stored records are never mutated in place — `append` stores a frozen
// deep copy and reads return frozen copies, so a caller cannot retroactively edit
// the log. `before`/`after` snapshots pass through `redact()` (AC5) before
// storage; `redact` is exported for E0-S8's structured logger to reuse (one
// masker, not two divergent ones).
//
// Storage (Reconciliation 4 / Open Question 2): this is the audit log's OWN
// stream — NOT entity persistence via Repository<T> — so this shared-infra module
// may touch `localStorage` directly (§4's "feature code never touches
// localStorage" binds src/features/*, not shared infra). The canonical pilot
// store is an in-memory append-only array (so it is unit-testable in the Vitest
// node env, which has no `localStorage`); it write-throughs to `localStorage`
// only when that global is present. (NFR-1: imports nothing from src/features/*.)

import type { ID } from "../domain/types";

/**
 * An immutable audit record (project-context.md §7.1, verbatim). Tenant-tagged;
 * carries the shared `correlationId`. `before`/`after` are stored REDACTED (AC5).
 */
export interface AuditEvent {
  id: ID; // NOT eventId (Reconciliation 3)
  tenantId: ID;
  subsidiaryId: ID | null;
  actorId: ID;
  action: string; // lowercase dotted verb, e.g. "lead.convert" (NOT "type" — Reconciliation 2)
  entityType: string;
  entityId: ID;
  occurredAt: string; // ISO 8601 UTC — NOT "ts" (Reconciliation 1)
  before?: unknown; // redacted (AC5)
  after?: unknown; // redacted (AC5)
  correlationId: string;
}

// ── §7.4 redaction ───────────────────────────────────────────────────────────

// Secret-bearing keys whose VALUES are dropped entirely (case-insensitive match).
const SECRET_KEYS = new Set([
  "password",
  "token",
  "secret",
  "apikey",
  "authorization",
]);

// Matches an email anywhere in a string value, so we can mask the local part.
const EMAIL = /([A-Za-z0-9._%+-])([A-Za-z0-9._%+-]*)(@[A-Za-z0-9.-]+\.[A-Za-z]{2,})/g;

// VALUE-borne secrets masked anywhere in a string — not just when the KEY matches
// SECRET_KEYS. Covers a token captured under a generic key, e.g. { data: "Bearer
// eyJ…" } or a bare JWT, which key-name matching alone would log in clear.
const BEARER = /\bBearer\s+[\w.\-+/=]+/gi; // "Bearer <token>"
const JWT = /\beyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\b/g; // header.payload.sig

// A phone-shaped WHOLE value: optional leading `+`, then digits with the usual
// separators. Matched whole-string only (never embedded) so it can't mangle
// dates/ids inside free text — a full ISO 8601 timestamp (with `T`/`:`/`Z`) can't
// match at all. Shape-match alone is NOT enough to mask (see maskString).
const PHONE_SHAPE = /^\+?[(\d][\d\s().-]{5,}\d$/;
// Marks a value as a *formatted* phone rather than a bare numeric identifier.
const PHONE_SEPARATOR = /[\s().-]/;

const REDACTED = "[REDACTED]";
const CIRCULAR = "[Circular]";

/** Masks any email occurrence as `a***@x.com` (first char + stars + domain). */
function maskEmail(value: string): string {
  return value.replace(EMAIL, (_m, first: string, _rest: string, domain: string) => `${first}***${domain}`);
}

/**
 * Masks a string value (§7.4), in priority order:
 * 1. embedded bearer tokens / JWTs → `[REDACTED]` (value-borne secrets);
 * 2. a WHOLE-value 13–19-digit run → `***` + last 4 (card/account PANs);
 * 3. a phone number — E.164 (leading `+`, 8–15 digits) or a *formatted* number
 *    (has a separator, 10–15 digits) → `***` + last 2;
 * 4. otherwise mask any embedded email.
 *
 * Bare 7–9-digit numeric values (zip+4, order numbers, short ids) are deliberately
 * left intact — they are identifiers, not phones; masking them corrupted the audit
 * snapshot. The trade-off: an *unformatted* bare phone (no `+`, no separators) is
 * treated as an opaque id and not masked.
 */
function maskString(value: string): string {
  const tokenMasked = value.replace(BEARER, "Bearer [REDACTED]").replace(JWT, REDACTED);
  if (tokenMasked !== value) return tokenMasked; // a secret was present — don't re-scan it

  const trimmed = value.trim();
  if (PHONE_SHAPE.test(trimmed)) {
    const digits = trimmed.replace(/\D/g, "");
    if (digits.length >= 13 && digits.length <= 19) {
      return `***${digits.slice(-4)}`; // card/account PAN
    }
    const isE164 = trimmed.startsWith("+") && digits.length >= 8 && digits.length <= 15;
    const isFormatted = PHONE_SEPARATOR.test(trimmed) && digits.length >= 10 && digits.length <= 15;
    if (isE164 || isFormatted) {
      return `***${digits.slice(-2)}`;
    }
  }
  return maskEmail(value);
}

/**
 * Redacts a `before`/`after` snapshot for the audit log (§7.4), recursively:
 * - drops the VALUE of any secret-bearing key (`password`, `token`, `secret`,
 *   `apiKey`, `authorization`, case-insensitive) → `[REDACTED]`;
 * - masks value-borne secrets (bearer/JWT), emails (`a***@x.com`), phone numbers
 *   and card PANs in string values.
 *
 * Robust to exotic snapshots so the audit write never throws (AC2/append must not
 * silently drop a record): cyclic references resolve to `"[Circular]"`, and
 * functions/symbols (not serializable, meaningless in a snapshot) are dropped — so
 * the returned structure is always acyclic and structured-clone-safe. `Date`s are
 * normalized to ISO strings (the constitution stores timestamps as strings) rather
 * than silently flattened to `{}`.
 *
 * Pure and non-mutating — returns a fresh structure; the input is untouched.
 * Exported for E0-S8 (the structured logger) to reuse — do NOT fork this.
 */
export function redact(snapshot: unknown): unknown {
  return redactValue(snapshot, new WeakSet());
}

function redactValue(snapshot: unknown, seen: WeakSet<object>): unknown {
  if (typeof snapshot === "string") {
    return maskString(snapshot);
  }
  if (typeof snapshot === "function" || typeof snapshot === "symbol") {
    return undefined; // not serializable; would otherwise crash structuredClone
  }
  if (snapshot instanceof Date) {
    return snapshot.toISOString(); // preserve the value instead of flattening to {}
  }
  if (Array.isArray(snapshot)) {
    if (seen.has(snapshot)) return CIRCULAR;
    seen.add(snapshot);
    return snapshot.map((item) => redactValue(item, seen));
  }
  if (snapshot !== null && typeof snapshot === "object") {
    if (seen.has(snapshot)) return CIRCULAR;
    seen.add(snapshot);
    const out: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(snapshot)) {
      out[key] = SECRET_KEYS.has(key.toLowerCase()) ? REDACTED : redactValue(value, seen);
    }
    return out;
  }
  // numbers, booleans, null, undefined, bigint — nothing to redact.
  return snapshot;
}

// ── Append-only store ─────────────────────────────────────────────────────────

const LOCAL_STORAGE_KEY = "crm:auditLog";

// The canonical pilot store: an in-memory append-only array. Records are stored
// as frozen deep copies so nothing handed in (or read out) can later mutate them.
const store: AuditEvent[] = [];

/** Deep-clones then deeply freezes, so a stored/returned record is immutable. */
function freezeCopy(event: AuditEvent): AuditEvent {
  let copy: AuditEvent;
  try {
    copy = structuredClone(event);
  } catch {
    // redact() has already replaced before/after with fresh, acyclic, serializable
    // structures and the other fields are scalars, so the record is never lost even
    // if structuredClone rejects some exotic value — freeze the redacted record.
    copy = event;
  }
  return deepFreeze(copy);
}

function deepFreeze<T>(value: T, seen = new WeakSet<object>()): T {
  if (value !== null && typeof value === "object") {
    if (seen.has(value)) return value; // guard cycles — never recurse forever
    seen.add(value);
    for (const v of Object.values(value)) deepFreeze(v, seen);
    Object.freeze(value);
  }
  return value;
}

/** Write-through to localStorage when the global exists (browser); no-op in node. */
function persist(): void {
  if (typeof localStorage === "undefined") return;
  try {
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(store));
  } catch {
    // Quota/serialization failures must not break the in-memory append-only
    // guarantee — the in-memory array stays the source of truth for the pilot.
  }
}

/**
 * Appends an immutable audit record (the only write operation — AC2). The
 * `before`/`after` snapshots are run through `redact()` (§7.4) before storage,
 * and the whole record is stored as a frozen deep copy so neither the caller's
 * reference nor a later reader can mutate what a subsequent read returns.
 */
export function append(event: AuditEvent): void {
  const redacted: AuditEvent = {
    ...event,
    ...("before" in event ? { before: redact(event.before) } : {}),
    ...("after" in event ? { after: redact(event.after) } : {}),
  };
  store.push(freezeCopy(redacted));
  persist();
}

/**
 * Returns every audit record in append order, as frozen defensive copies (AC2) —
 * mutating a returned record cannot change what a subsequent read returns.
 */
export function all(): readonly AuditEvent[] {
  return Object.freeze(store.map((e) => freezeCopy(e)));
}

/**
 * TEST-ONLY: empties the in-memory store (and the localStorage mirror when
 * present) so specs don't leak state. Deliberately kept OUT of the production
 * append-only contract — do not call from app code.
 */
export function __resetAuditLog(): void {
  store.length = 0;
  if (typeof localStorage !== "undefined") {
    try {
      localStorage.removeItem(LOCAL_STORAGE_KEY);
    } catch {
      // ignore — best-effort test cleanup
    }
  }
}
