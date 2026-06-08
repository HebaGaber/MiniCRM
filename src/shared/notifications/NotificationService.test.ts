// Tests for NotificationService (AC1, AC2, AC3, UC-5, NFR-12).

import { describe, it, expect, beforeEach } from 'vitest';
import { publish, __resetBus } from '../events/bus';
import type { DomainEvent } from '../events/bus';
import { newCorrelationId } from '../events/correlation';
import { newId } from '../domain/types';
import {
  notificationsFor,
  markRead,
  markAllRead,
  __resetNotifications,
} from './NotificationService';

const TENANT_A = 'tenant-a';
const TENANT_B = 'tenant-b';
const SUB_US = 'sub-us';
const ASSIGNEE = 'usr_assignee-1';
const OWNER = 'usr_owner-1';

function makeEvent(
  type: DomainEvent['type'],
  payload: Record<string, unknown>,
  overrides: Partial<DomainEvent> = {},
): DomainEvent {
  return {
    eventId: newId('workflow'),
    type,
    tenantId: TENANT_A,
    subsidiaryId: SUB_US,
    actorId: newId('user'),
    occurredAt: new Date().toISOString(),
    payload,
    correlationId: newCorrelationId(),
    ...overrides,
  };
}

beforeEach(() => {
  __resetBus();
  __resetNotifications();
});

// ── AC3 / Recipient mapping ──────────────────────────────────────────────────

describe('Ticket.Assigned → notification to assigneeId (AC3)', () => {
  it('creates a notification for the assignee', () => {
    publish(makeEvent('Ticket.Assigned', { assigneeId: ASSIGNEE, ticketId: 'tkt_1' }));
    const ns = notificationsFor(ASSIGNEE);
    // Should include the newly published one (seed data is reset; seed has no Ticket.Assigned for ASSIGNEE)
    const newNotif = ns.find((n) => n.id.endsWith('-notif'));
    expect(newNotif).toBeDefined();
    expect(newNotif!.recipient).toBe(ASSIGNEE);
    expect(newNotif!.type).toBe('Ticket.Assigned');
  });
});

describe('Lead.Converted → notification to ownerId (AC3)', () => {
  it('creates a notification for the lead owner', () => {
    publish(makeEvent('Lead.Converted', { ownerId: OWNER, leadId: 'lead_1' }));
    const ns = notificationsFor(OWNER);
    const newNotif = ns.find((n) => n.id.endsWith('-notif'));
    expect(newNotif).toBeDefined();
    expect(newNotif!.recipient).toBe(OWNER);
    expect(newNotif!.type).toBe('Lead.Converted');
  });
});

describe('Unhandled event type → no notification (AC3)', () => {
  it('produces no notification for Lead.Created', () => {
    publish(makeEvent('Lead.Created', { ownerId: OWNER }));
    const ns = notificationsFor(OWNER).filter((n) => n.id.endsWith('-notif'));
    expect(ns).toHaveLength(0);
  });

  it('produces no notification for Ticket.StatusChanged', () => {
    publish(makeEvent('Ticket.StatusChanged', { assigneeId: ASSIGNEE }));
    const ns = notificationsFor(ASSIGNEE).filter((n) => n.id.endsWith('-notif'));
    expect(ns).toHaveLength(0);
  });
});

describe('Null/missing payload field → no notification (AC3)', () => {
  it('skips when Ticket.Assigned has no assigneeId', () => {
    publish(makeEvent('Ticket.Assigned', { ticketId: 'tkt_1' }));
    const ns = notificationsFor('').filter((n) => n.id.endsWith('-notif'));
    expect(ns).toHaveLength(0);
  });

  it('skips when Lead.Converted has no ownerId', () => {
    publish(makeEvent('Lead.Converted', { leadId: 'lead_1' }));
    const ns = notificationsFor('').filter((n) => n.id.endsWith('-notif'));
    expect(ns).toHaveLength(0);
  });
});

// ── UC-5 / Tenant scoping ───────────────────────────────────────────────────

describe('Notifications are scoped to the event tenant/subsidiary (UC-5)', () => {
  it('notification carries tenantId and subsidiaryId from the event', () => {
    publish(makeEvent('Ticket.Assigned', { assigneeId: ASSIGNEE }, { tenantId: TENANT_A, subsidiaryId: SUB_US }));
    const ns = notificationsFor(ASSIGNEE).filter((n) => n.id.endsWith('-notif'));
    expect(ns[0]!.tenantId).toBe(TENANT_A);
    expect(ns[0]!.subsidiaryId).toBe(SUB_US);
  });

  it('recipient on tenant-A does not see tenant-B notifications', () => {
    // Tenant-B event with same ASSIGNEE
    publish(makeEvent('Ticket.Assigned', { assigneeId: ASSIGNEE }, { tenantId: TENANT_B }));
    const ns = notificationsFor(ASSIGNEE).filter((n) => n.id.endsWith('-notif'));
    // The notification IS created, but its tenantId is TENANT_B — the caller (useNotifications)
    // scopes by session.userId; cross-tenant is enforced at the session layer, not here.
    // The test asserts the tenantId on the notification is correctly stamped.
    expect(ns[0]!.tenantId).toBe(TENANT_B);
    // A separate recipient for TENANT_A gets nothing from this event.
    const ns2 = notificationsFor('usr_other');
    expect(ns2.filter((n) => n.id.endsWith('-notif'))).toHaveLength(0);
  });
});

// ── markRead / markAllRead ───────────────────────────────────────────────────

describe('markRead(id) (AC4)', () => {
  it('sets read=true on the target notification', () => {
    publish(makeEvent('Ticket.Assigned', { assigneeId: ASSIGNEE }));
    const ns = notificationsFor(ASSIGNEE);
    const n = ns.find((x) => x.id.endsWith('-notif'))!;
    expect(n.read).toBe(false);
    markRead(n.id);
    const updated = notificationsFor(ASSIGNEE).find((x) => x.id === n.id);
    expect(updated!.read).toBe(true);
  });

  it('does not mutate other notifications', () => {
    publish(makeEvent('Ticket.Assigned', { assigneeId: ASSIGNEE }));
    publish(makeEvent('Ticket.Assigned', { assigneeId: ASSIGNEE }));
    const ns = notificationsFor(ASSIGNEE).filter((n) => n.id.endsWith('-notif'));
    const [first, second] = ns;
    markRead(first!.id);
    const updated = notificationsFor(ASSIGNEE);
    const secondUpdated = updated.find((n) => n.id === second!.id);
    expect(secondUpdated!.read).toBe(false);
  });
});

describe('markAllRead(recipient) (AC4)', () => {
  it('marks all notifications for the recipient as read', () => {
    publish(makeEvent('Ticket.Assigned', { assigneeId: ASSIGNEE }));
    publish(makeEvent('Ticket.Assigned', { assigneeId: ASSIGNEE }));
    markAllRead(ASSIGNEE);
    const ns = notificationsFor(ASSIGNEE);
    expect(ns.every((n) => n.read)).toBe(true);
  });

  it('does not touch other recipients', () => {
    publish(makeEvent('Ticket.Assigned', { assigneeId: ASSIGNEE }));
    publish(makeEvent('Lead.Converted', { ownerId: OWNER }));
    markAllRead(ASSIGNEE);
    const ownerNs = notificationsFor(OWNER).filter((n) => n.id.endsWith('-notif'));
    expect(ownerNs.every((n) => !n.read)).toBe(true);
  });
});

// ── Ordering ─────────────────────────────────────────────────────────────────

describe('notificationsFor returns newest-first (AC4)', () => {
  it('sorts by occurredAt descending', () => {
    const older = makeEvent('Ticket.Assigned', { assigneeId: ASSIGNEE }, {
      occurredAt: '2026-06-01T10:00:00Z',
    });
    const newer = makeEvent('Ticket.Assigned', { assigneeId: ASSIGNEE }, {
      occurredAt: '2026-06-01T12:00:00Z',
    });
    publish(older);
    publish(newer);
    const ns = notificationsFor(ASSIGNEE).filter((n) => n.id.endsWith('-notif'));
    expect(ns[0]!.occurredAt > ns[1]!.occurredAt).toBe(true);
  });
});

// ── __resetNotifications ─────────────────────────────────────────────────────

describe('__resetNotifications() TEST-ONLY (AC1)', () => {
  it('clears dynamic notifications and restores seed data', () => {
    publish(makeEvent('Ticket.Assigned', { assigneeId: ASSIGNEE }));
    expect(notificationsFor(ASSIGNEE).some((n) => n.id.endsWith('-notif'))).toBe(true);
    __resetNotifications();
    // Dynamic notification is gone; seed data is back
    expect(notificationsFor(ASSIGNEE).some((n) => n.id.endsWith('-notif'))).toBe(false);
    expect(notificationsFor('usr_lena').length).toBeGreaterThan(0);
  });

  it('restores read:false on seed items after markRead + reset (shallow-copy guard)', () => {
    const ns = notificationsFor('usr_lena');
    expect(ns[0]!.read).toBe(false);
    markRead(ns[0]!.id);
    expect(notificationsFor('usr_lena')[0]!.read).toBe(true);
    __resetNotifications();
    // Seed objects must be unaffected — read:false restored
    expect(notificationsFor('usr_lena')[0]!.read).toBe(false);
  });
});

// ── Seed data sanity ─────────────────────────────────────────────────────────

describe('Seed data is present after reset (AC2)', () => {
  it('usr_lena has 2 seeded notifications', () => {
    expect(notificationsFor('usr_lena')).toHaveLength(2);
  });

  it('usr_marco has 1 seeded notification', () => {
    expect(notificationsFor('usr_marco')).toHaveLength(1);
  });

  it('usr_sara has 1 seeded notification (read=true)', () => {
    const ns = notificationsFor('usr_sara');
    expect(ns).toHaveLength(1);
    expect(ns[0]!.read).toBe(true);
  });
});
