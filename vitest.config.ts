import { defineConfig } from 'vitest/config'

// Minimal Vitest config for the domain kernel (E0-S1). The full harness
// (jsdom + RTL + Playwright + architecture-fitness test) is wired in E0-S11.
// This story needs no DOM — a node environment is sufficient.
export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
})
