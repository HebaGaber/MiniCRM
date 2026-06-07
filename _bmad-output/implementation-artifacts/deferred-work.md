# Deferred Work

Real findings surfaced during review that are not actionable in their originating story. Re-evaluate when the consuming story lands.

## Deferred from: code review of 0-2-author-baseentity-and-canonical-entity-types (2026-06-07)

- **`crypto.randomUUID()` requires a secure context** ([src/shared/domain/types.ts:62](../../src/shared/domain/types.ts#L62)). `newId` calls the bare global `crypto.randomUUID()`. It resolves in the Vitest node environment, on `localhost` dev, and over HTTPS in production — but in a browser it is exposed **only in a secure context**, so serving the pilot over plain `http://` on a LAN IP (e.g. demoing from another device) makes `crypto.randomUUID` `undefined` → `TypeError` on every entity create. The story explicitly accepted "no polyfill, no `uuid` dependency" (Dev Notes), so this is **not** a code change for E0-S2. **Action for whoever owns deployment / the dev-server story:** ensure the app is always served from a secure context (HTTPS or `localhost`), or add a guarded fallback at that point. Severity: Medium (only triggers in an insecure-context deployment).

## Deferred from: code review of 0-3-define-repository-page-listquery (2026-06-07)

- **No explicit `"strict": true` in any tsconfig** ([tsconfig.app.json](../../tsconfig.app.json)). The seam's nullability/optionality contracts (`get(): Promise<T | null>`, the `?:` vs `| null` distinction) rely on `strictNullChecks` being **on by default in TypeScript 6.x** — verified empirically active (`tsc` flags `null`→`string` with no flags, v6.0.3). This is **not** an E0-S3 issue (the contract is correct under the current toolchain) and is project-wide. **Action for whoever owns the build config:** add `"strict": true` to `tsconfig.app.json` so the load-bearing nullability contracts are pinned explicitly rather than depending on a compiler default that a TS-version or scaffold change could flip. Severity: Low (latent; only bites if the strict default changes).
