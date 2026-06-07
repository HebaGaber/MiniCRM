// The correlationId minter (Pattern 7, ADR-008). One id is minted at the START
// of a user action and threaded through the domain event, the audit record, and
// (later, E0-S8) the structured log line — so the three streams of one operation
// are joinable. This module ships only the minter; the *threading* happens in the
// 4-beat use case (E0-S4). (NFR-1: this shared-layer module imports nothing from
// src/features/*.)
//
// `crypto.randomUUID()` is the same platform global `newId` (domain/types.ts) uses
// — no `uuid` dependency. We deliberately do NOT route through `newId`: a
// correlationId is NOT an entity ID, so it carries no type prefix (types.ts:59
// explicitly separates the two). `WorkflowInstance.correlationId` is likewise a
// bare `string`.
//
// Secure-context caveat (deferred-work.md): `crypto.randomUUID()` requires a
// secure context in browsers — the same accepted risk already taken for `newId`;
// no extra handling is added here.

/** Mints a fresh, unprefixed UUID v4 to correlate one operation's three streams. */
export function newCorrelationId(): string {
  return crypto.randomUUID();
}
