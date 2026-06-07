# Deferred Work

Real findings surfaced during review that are not actionable in their originating story. Re-evaluate when the consuming story lands.

## Deferred from: code review of 0-2-author-baseentity-and-canonical-entity-types (2026-06-07)

- **`crypto.randomUUID()` requires a secure context** ([src/shared/domain/types.ts:62](../../src/shared/domain/types.ts#L62)). `newId` calls the bare global `crypto.randomUUID()`. It resolves in the Vitest node environment, on `localhost` dev, and over HTTPS in production — but in a browser it is exposed **only in a secure context**, so serving the pilot over plain `http://` on a LAN IP (e.g. demoing from another device) makes `crypto.randomUUID` `undefined` → `TypeError` on every entity create. The story explicitly accepted "no polyfill, no `uuid` dependency" (Dev Notes), so this is **not** a code change for E0-S2. **Action for whoever owns deployment / the dev-server story:** ensure the app is always served from a secure context (HTTPS or `localhost`), or add a guarded fallback at that point. Severity: Medium (only triggers in an insecure-context deployment).
