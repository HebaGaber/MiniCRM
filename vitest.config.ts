import { defineConfig } from 'vitest/config'

// Minimal Vitest config for the domain kernel (E0-S1). The full harness
// (jsdom + RTL + Playwright + architecture-fitness test) is wired in E0-S11.
// The global environment stays `node` — the domain/events/data specs need no
// DOM. E0-S5 introduces the first RTL spec (AuthProvider.test.tsx); it opts into
// jsdom per-file via a `// @vitest-environment jsdom` docblock, so the global
// env is left untouched. The include glob is widened to `.test.tsx` so React
// component specs are discovered alongside the node `.test.ts` specs.
export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.test.{ts,tsx}'],
    setupFiles: ['src/test-setup.ts'],
  },
})
