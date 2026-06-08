// Fault-injection toggle (ADR-007): because the localStorage adapter never fails
// on transport, this module lets tests force specific error paths so optimistic-
// rollback and error-boundary paths are exercised deterministically. Set a fault
// mode BEFORE a mutation call; the repository checks it at the start of each
// mutation and throws the matching RepositoryError. Reset after each test.
//
// Usage: setFaultMode('409') → next mutation throws 409 VERSION_CONFLICT.
//        setFaultMode('none') / resetFaultMode() → adapter behaves normally.
//
// (NFR-1: imports nothing from src/features/*.)

/** The injectable failure mode. `'none'` is the default (no fault). */
export type FaultMode = "409" | "422" | "network" | "none";

let current: FaultMode = "none";

/** Set the fault mode that the next repository mutation will throw. */
export function setFaultMode(mode: FaultMode): void {
  current = mode;
}

/** Returns the current fault mode. */
export function getFaultMode(): FaultMode {
  return current;
}

/**
 * TEST-ONLY: resets the fault mode to `'none'` so specs don't leak state.
 * Do not call from app code.
 */
export function resetFaultMode(): void {
  current = "none";
}
