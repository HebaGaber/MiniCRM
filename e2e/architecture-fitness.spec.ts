// Architecture-fitness gate (AC6, NFR-4, ADR-004).
//
// Asserts the repository-seam invariant: no src/features/* file may import
// localStorage directly or the concrete LocalStorageRepository. Feature code
// must depend only on the Repository<T> interface; the concrete adapter is
// wired only at the composition root (src/app).
//
// Runs as a Node.js Playwright test (no browser fixture needed).

import { test, expect } from '@playwright/test';
import * as fs from 'node:fs';
import * as path from 'node:path';

function collectTsFiles(dir: string, acc: string[] = []): string[] {
  if (!fs.existsSync(dir)) return acc;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) collectTsFiles(full, acc);
    else if (/\.(ts|tsx)$/.test(entry.name)) acc.push(full);
  }
  return acc;
}

test('no src/features/** file references localStorage directly', () => {
  const featuresDir = path.resolve('src/features');
  const files = collectTsFiles(featuresDir);
  const violations: string[] = [];

  for (const file of files) {
    const content = fs.readFileSync(file, 'utf8');
    // Match bare `localStorage` usage — not inside comments or strings that
    // are testing the restriction (e.g. test files that assert the absence).
    // Any identifier access like `localStorage.getItem` or `window.localStorage`
    // is a violation; only the adapter (LocalStorageRepository.ts) may use it.
    if (/(?<!\w)localStorage\b/.test(content)) {
      violations.push(path.relative(process.cwd(), file));
    }
  }

  expect(
    violations,
    `Features must not access localStorage directly — use Repository<T>:\n${violations.join('\n')}`,
  ).toHaveLength(0);
});

test('no src/features/** file imports LocalStorageRepository', () => {
  const featuresDir = path.resolve('src/features');
  const files = collectTsFiles(featuresDir);
  const violations: string[] = [];

  for (const file of files) {
    const content = fs.readFileSync(file, 'utf8');
    if (/from\s+['"][^'"]*LocalStorageRepository['"]/.test(content)) {
      violations.push(path.relative(process.cwd(), file));
    }
  }

  expect(
    violations,
    `Features must not import the concrete adapter — depend only on Repository<T>:\n${violations.join('\n')}`,
  ).toHaveLength(0);
});

test('no src/shared/** module (outside the adapter) imports LocalStorageRepository', () => {
  // Shared modules (auth, events, domain, ui, config) must depend only on the
  // Repository<T> interface — never the concrete adapter. Only the composition
  // root (src/app) may wire LocalStorageRepository to the interface.
  const sharedDir = path.resolve('src/shared');
  const files = collectTsFiles(sharedDir);
  const violations: string[] = [];

  for (const file of files) {
    const rel = path.relative(process.cwd(), file);
    // The adapter itself may self-reference; test files are excluded.
    if (rel.includes('LocalStorageRepository')) continue;
    if (/\.test\.(ts|tsx)$/.test(rel)) continue;
    const content = fs.readFileSync(file, 'utf8');
    if (/from\s+['"][^'"]*LocalStorageRepository['"]/.test(content)) {
      violations.push(rel);
    }
  }

  expect(
    violations,
    `Shared modules must not import the concrete adapter — use Repository<T> instead:\n${violations.join('\n')}`,
  ).toHaveLength(0);
});

// ── E1-S1: Scope-param seam assertions (AC2, UC-5) ───────────────────────────

test('no src/features/** file reads .tenantId or .subsidiaryId directly (E1-S1 AC2)', () => {
  // Feature code must get scope only via useTenant() — never by reading
  // session.tenantId / session.subsidiaryId in product code (UC-5, ADR-002).
  // This passes trivially today (features/ doesn't exist yet) and becomes a
  // live gate when Epic 2–5 feature code is added.
  const featuresDir = path.resolve('src/features');
  const files = collectTsFiles(featuresDir);
  const violations: string[] = [];

  for (const file of files) {
    const rel = path.relative(process.cwd(), file);
    if (/\.test\.(ts|tsx)$/.test(rel)) continue;
    const content = fs.readFileSync(file, 'utf8');
    // Match direct property access of tenantId/subsidiaryId on session or any object
    // (e.g. session.tenantId, claims.subsidiaryId). Feature code must not read these
    // directly — it should call useTenant() which provides them via context.
    if (/\b(?:session|claims|auth)\s*[?.]?\s*(?:tenantId|subsidiaryId)\b/.test(content)) {
      violations.push(rel);
    }
  }

  expect(
    violations,
    `Feature code must not read tenantId/subsidiaryId directly — use useTenant():\n${violations.join('\n')}`,
  ).toHaveLength(0);
});
