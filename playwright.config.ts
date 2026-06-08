import { defineConfig } from '@playwright/test';

// Playwright configuration for MiniCRM pilot E2E + fitness tests (ADR-013).
// These tests run as Node.js (no browser fixture) — they test the repository
// adapter and project structure directly without a running browser.
// Browser E2E (conversion flows, ticket lifecycle) ships with Epic 6.
export default defineConfig({
  testDir: './e2e',
  timeout: 30_000,
  reporter: 'list',
});
