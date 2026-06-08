import { describe, it, expect } from 'vitest'
import { readFileSync, readdirSync } from 'fs'
import { join } from 'path'

const UI_DIR = join(import.meta.dirname, '.')

function collectTsxFiles(dir: string): string[] {
  const results: string[] = []
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const fullPath = join(dir, entry.name)
    if (entry.isDirectory()) {
      results.push(...collectTsxFiles(fullPath))
    } else if (entry.name.endsWith('.tsx') && !entry.name.endsWith('.test.tsx')) {
      results.push(fullPath)
    }
  }
  return results
}

const FILES = collectTsxFiles(UI_DIR)

const HEX_LITERAL = /#[0-9a-fA-F]{3,8}(?![0-9a-fA-F])/

describe('Token lint — shared/ui components must not hardcode design values', () => {
  it.each(FILES.map(f => [f.split('/src/').pop()!, f]))(
    '%s has no hardcoded hex colors',
    (_name, filePath) => {
      const src = readFileSync(filePath, 'utf-8')
      const lines = src.split('\n')
      const violations: string[] = []
      lines.forEach((line, i) => {
        // skip comments
        if (line.trimStart().startsWith('//') || line.trimStart().startsWith('*')) return
        // skip test files (already filtered but just in case)
        if (filePath.endsWith('.test.tsx')) return
        if (HEX_LITERAL.test(line)) {
          violations.push(`  line ${i + 1}: ${line.trim()}`)
        }
      })
      expect(violations, `Hardcoded hex colors found in ${filePath}:\n${violations.join('\n')}`).toHaveLength(0)
    },
  )
})
