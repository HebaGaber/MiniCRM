import { describe, it, expect } from 'vitest'
import {
  canTransition,
  LEAD_TRANSITIONS,
  CUSTOMER_TRANSITIONS,
  TICKET_TRANSITIONS,
  STATUS_TONE,
} from './status'
import type {
  TransitionEntity,
  LeadStatus,
  CustomerStatus,
  TicketStatus,
  TicketPriority,
} from './status'

// Exhaustive literal sets, driven off the union types via `satisfies
// Record<Union, true>`. Adding a literal to a union WITHOUT updating these
// objects is a COMPILE error — which keeps the exhaustiveness assertions honest.
const LEAD_STATUSES = {
  new: true, contacted: true, qualified: true, disqualified: true, converted: true,
} satisfies Record<LeadStatus, true>
const CUSTOMER_STATUSES = {
  prospect: true, onboarding: true, active: true, inactive: true, churned: true,
} satisfies Record<CustomerStatus, true>
const TICKET_STATUSES = {
  open: true, in_progress: true, pending: true, resolved: true, closed: true,
} satisfies Record<TicketStatus, true>
const TICKET_PRIORITIES = {
  low: true, medium: true, high: true, urgent: true,
} satisfies Record<TicketPriority, true>

const leadStatuses = Object.keys(LEAD_STATUSES) as LeadStatus[]
const customerStatuses = Object.keys(CUSTOMER_STATUSES) as CustomerStatus[]
const ticketStatuses = Object.keys(TICKET_STATUSES) as TicketStatus[]
const ticketPriorities = Object.keys(TICKET_PRIORITIES) as TicketPriority[]

// (entity kind, map, every status literal of that entity) for table-driven tests.
const MAPS: ReadonlyArray<{
  entity: TransitionEntity
  map: Record<string, string[]>
  allStatuses: readonly string[]
}> = [
  { entity: 'lead', map: LEAD_TRANSITIONS, allStatuses: leadStatuses },
  { entity: 'customer', map: CUSTOMER_TRANSITIONS, allStatuses: customerStatuses },
  { entity: 'ticket', map: TICKET_TRANSITIONS, allStatuses: ticketStatuses },
]

describe('canTransition — every legal transition is allowed', () => {
  for (const { entity, map } of MAPS) {
    for (const [from, tos] of Object.entries(map)) {
      for (const to of tos) {
        it(`${entity}: ${from} → ${to} is legal`, () => {
          expect(canTransition(entity, from, to)).toBe(true)
        })
      }
    }
  }
})

describe('canTransition — illegal transitions are rejected', () => {
  // Terminal states reject EVERY move (including a no-op self-transition).
  const terminals: ReadonlyArray<{ entity: TransitionEntity; state: string }> = [
    { entity: 'lead', state: 'converted' },
    { entity: 'customer', state: 'churned' },
    { entity: 'ticket', state: 'closed' },
  ]
  for (const { entity, state } of terminals) {
    const { allStatuses } = MAPS.find((m) => m.entity === entity)!
    for (const to of allStatuses) {
      it(`${entity}: terminal ${state} → ${to} is rejected`, () => {
        expect(canTransition(entity, state, to)).toBe(false)
      })
    }
  }

  // Representative illegal (non-terminal) pairs — not present in the maps.
  const illegal: ReadonlyArray<[TransitionEntity, string, string]> = [
    ['lead', 'new', 'qualified'],          // must be contacted first
    ['lead', 'new', 'converted'],          // cannot skip the funnel
    ['lead', 'qualified', 'new'],          // no backward move to new
    ['customer', 'prospect', 'active'],    // must pass through onboarding
    ['customer', 'prospect', 'churned'],   // not reachable from prospect
    ['customer', 'onboarding', 'inactive'],
    ['ticket', 'open', 'resolved'],        // cannot resolve without work
    ['ticket', 'pending', 'closed'],       // close only via open or resolved
  ]
  for (const [entity, from, to] of illegal) {
    it(`${entity}: ${from} → ${to} is rejected`, () => {
      expect(canTransition(entity, from, to)).toBe(false)
    })
  }

  it('unknown from-state is rejected (no throw)', () => {
    expect(canTransition('lead', 'bogus', 'contacted')).toBe(false)
  })

  it('inherited Object.prototype keys as from-state are rejected (no throw)', () => {
    // Regression: a plain-object map lookup of "toString"/"constructor" returns
    // an inherited function, which has no `.includes` — the guard must reject,
    // not throw. (Edge Case Hunter finding, E0-S1 review.)
    expect(canTransition('lead', 'toString', 'contacted')).toBe(false)
    expect(canTransition('lead', 'constructor', 'contacted')).toBe(false)
    expect(canTransition('ticket', 'valueOf', 'open')).toBe(false)
  })

  it('an out-of-domain entity is rejected (no silent ticket-map fallthrough)', () => {
    // Regression: the entity dispatch must not default unknown kinds to the
    // ticket map. (Edge Case Hunter finding, E0-S1 review.)
    expect(canTransition('tenant' as TransitionEntity, 'open', 'closed')).toBe(false)
  })
})

describe('ticket reopen — resolved → open is the only legal reopen', () => {
  it('resolved → open is legal (the one sanctioned reopen)', () => {
    expect(canTransition('ticket', 'resolved', 'open')).toBe(true)
  })

  it('closed → open is rejected (closed is terminal — Flag C)', () => {
    expect(canTransition('ticket', 'closed', 'open')).toBe(false)
  })

  it('no terminal/blocked state other than resolved can reach open', () => {
    // Of the states that can reach `open`, none may be a terminal/blocked one.
    const canReachOpen = ticketStatuses.filter((s) => canTransition('ticket', s, 'open'))
    expect(canReachOpen).not.toContain('closed')
    expect(canReachOpen).toContain('resolved')
  })
})

describe('STATUS_TONE — every pill-rendered literal has a tone (no missing keys)', () => {
  const VALID_TONES = ['neutral', 'info', 'success', 'warning', 'danger']

  const cases: ReadonlyArray<{ category: keyof typeof STATUS_TONE; literals: readonly string[] }> = [
    { category: 'lead', literals: leadStatuses },
    { category: 'ticket', literals: ticketStatuses },
    { category: 'priority', literals: ticketPriorities },
    { category: 'customer', literals: customerStatuses },
  ]

  for (const { category, literals } of cases) {
    for (const literal of literals) {
      it(`${category}.${literal} maps to a valid tone`, () => {
        const tone = (STATUS_TONE[category] as Record<string, string>)[literal]
        expect(tone).toBeDefined()
        expect(VALID_TONES).toContain(tone)
      })
    }
  }

  it('customer tone explicitly includes prospect and onboarding (AC3)', () => {
    expect(STATUS_TONE.customer.prospect).toBe('info')
    expect(STATUS_TONE.customer.onboarding).toBe('warning')
  })
})
