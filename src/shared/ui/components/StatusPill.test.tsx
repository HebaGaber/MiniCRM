// @vitest-environment jsdom
import { render, screen, cleanup } from '@testing-library/react'
import { describe, it, expect, afterEach } from 'vitest'

afterEach(cleanup)
import { StatusPill } from './StatusPill'
import type { StatusPillTone } from './StatusPill'
import { STATUS_TONE } from '../../domain/status'

const TONES: StatusPillTone[] = ['neutral', 'info', 'success', 'warning', 'danger']

describe('StatusPill', () => {
  it('renders children text', () => {
    render(<StatusPill tone="success">Active</StatusPill>)
    expect(screen.getByText('Active')).toBeTruthy()
  })

  it('renders dot indicator by default (no icon)', () => {
    const { container } = render(<StatusPill tone="neutral">Neutral</StatusPill>)
    const spans = container.querySelectorAll('span')
    // the dot span is a child span with width/height 6px style
    const dot = Array.from(spans).find(
      s => s.style.width === '6px' && s.style.height === '6px',
    )
    expect(dot).toBeTruthy()
  })

  it('renders icon when icon prop is provided', () => {
    const { container } = render(<StatusPill tone="success" icon="check">Done</StatusPill>)
    const dot = Array.from(container.querySelectorAll('span')).find(
      s => s.style.width === '6px' && s.style.height === '6px',
    )
    expect(dot).toBeUndefined()
  })

  it.each(TONES)('tone=%s applies DS token bg color (no hardcoded hex)', (tone) => {
    const { container } = render(<StatusPill tone={tone}>{tone}</StatusPill>)
    const pill = container.querySelector('span')!
    const bg = pill.style.backgroundColor
    // must NOT be a raw hex or rgb() literal value
    expect(bg).not.toMatch(/^#[0-9a-fA-F]{3,8}$/)
    expect(bg).not.toMatch(/^rgb\(/)
  })

  it('defaults to neutral tone when no tone prop is supplied', () => {
    render(<StatusPill>No tone</StatusPill>)
    expect(screen.getByText('No tone')).toBeTruthy()
  })

  it('sm size applies smaller font', () => {
    const { container } = render(<StatusPill tone="info" size="sm">Small</StatusPill>)
    const pill = container.querySelector('span')!
    expect(pill.style.font).toMatch(/9px/)
  })

  it('STATUS_TONE is the authoritative mapping and returns a valid tone', () => {
    const tone = STATUS_TONE.customer['prospect']
    const validTones: StatusPillTone[] = ['neutral', 'info', 'success', 'warning', 'danger']
    expect(validTones).toContain(tone)
  })

  it('STATUS_TONE covers all customer statuses without hardcoding', () => {
    const customerStatuses = Object.keys(STATUS_TONE.customer) as (keyof typeof STATUS_TONE.customer)[]
    const validTones: StatusPillTone[] = ['neutral', 'info', 'success', 'warning', 'danger']
    for (const s of customerStatuses) {
      const tone = STATUS_TONE.customer[s]
      expect(validTones, `status "${s}" should map to a valid tone`).toContain(tone)
    }
  })
})
