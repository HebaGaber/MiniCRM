// Notifications kernel (ADR-014, project-context.md §7, §8).
//
// Subscribes to the DomainEvent bus (E0-S7) and projects in-app notifications.
// Notifications are driven off domain events ONLY — never bespoke writes (AC3).
// In-memory store mirrors the auditLog.ts pattern: unit-testable in node env,
// no localStorage dependency. Feature surfaces (E5-S3) consume useNotifications();
// they do NOT produce notifications (NFR-1).

import type { DomainEvent } from '../events/bus';
import { subscribe } from '../events/bus';

/** The canonical in-app notification shape (AC2). */
export interface AppNotification {
  id: string;
  recipient: string;         // userId — from event payload (assigneeId / ownerId)
  type: string;              // canonical event type, e.g. "Ticket.Assigned"
  payload: unknown;          // forwarded verbatim from DomainEvent.payload
  read: boolean;
  tenantId: string;
  subsidiaryId: string | null;
  occurredAt: string;        // ISO 8601 UTC — from DomainEvent.occurredAt
}

// Recipient-mapper: given an event, returns the target userId or null (skip).
type RecipientMapper = (event: DomainEvent) => string | null;

// AC3: Ticket.Assigned → assigneeId; Lead.Converted → ownerId.
// All other event types produce no notification.
const RECIPIENT_MAPPERS: Partial<Record<string, RecipientMapper>> = {
  'Ticket.Assigned': (e) => (e.payload as Record<string, unknown>).assigneeId as string ?? null,
  'Lead.Converted':  (e) => (e.payload as Record<string, unknown>).ownerId as string ?? null,
};

// Seeded demo notifications — matches prototype/app/store.jsx lines 188–193.
// Recipients use canonical mock-SSO userId values (AuthProvider.tsx:62-64):
//   usr_lena = Lena Bauer (support), usr_marco = Marco Ruiz (sales), usr_sara = Sara Khan (tenant_admin).
// Seed data is part of the initial store state; it does NOT go through handleEvent.
const SEED_NOTIFICATIONS: AppNotification[] = [
  {
    id: 'seed-ntf-1',
    recipient: 'usr_lena',
    type: 'Ticket.Assigned',
    payload: { title: 'SAML metadata mismatch' },
    read: false,
    tenantId: 'tenant-1',
    subsidiaryId: 'sub-us',
    occurredAt: '2026-06-06T13:50:00Z',
  },
  {
    id: 'seed-ntf-2',
    recipient: 'usr_lena',
    type: 'Ticket.Assigned',
    payload: { title: 'Onboarding checklist stuck — high priority' },
    read: false,
    tenantId: 'tenant-1',
    subsidiaryId: 'sub-us',
    occurredAt: '2026-06-06T11:00:00Z',
  },
  {
    id: 'seed-ntf-3',
    recipient: 'usr_marco',
    type: 'Lead.Converted',
    payload: { title: 'A lead was added to your queue' },
    read: false,
    tenantId: 'tenant-1',
    subsidiaryId: 'sub-eu',
    occurredAt: '2026-06-06T09:30:00Z',
  },
  {
    id: 'seed-ntf-4',
    recipient: 'usr_sara',
    type: 'Lead.Converted',
    payload: { title: 'Customer record merge completed' },
    read: true,
    tenantId: 'tenant-1',
    subsidiaryId: null,
    occurredAt: '2026-06-05T16:00:00Z',
  },
];

// In-memory notification store — not localStorage (unit-testable in node env).
// Shallow-copies each seed object so markRead mutations don't corrupt SEED_NOTIFICATIONS.
const _store: AppNotification[] = SEED_NOTIFICATIONS.map((n) => ({ ...n }));

/** Handles a published DomainEvent — the ONLY path that appends to _store (AC3). */
function handleEvent(event: DomainEvent): void {
  const mapper = RECIPIENT_MAPPERS[event.type];
  if (!mapper) return; // unhandled event type → no notification

  const recipient = mapper(event);
  if (!recipient) return; // missing payload field → skip

  const notification: AppNotification = {
    id: `${event.eventId}-notif`,
    recipient,
    type: event.type,
    payload: event.payload,
    read: false,
    tenantId: event.tenantId,
    subsidiaryId: event.subsidiaryId,
    occurredAt: event.occurredAt,
  };
  _store.push(notification);
}

/**
 * Returns all notifications for the given recipient, newest-first (AC4).
 * Scoped by recipient — callers must pass the authenticated userId.
 */
export function notificationsFor(recipient: string): readonly AppNotification[] {
  return _store
    .filter((n) => n.recipient === recipient)
    .sort((a, b) => b.occurredAt.localeCompare(a.occurredAt));
}

/** Marks a single notification as read by id. */
export function markRead(id: string): void {
  const n = _store.find((x) => x.id === id);
  if (n) n.read = true;
}

/** Marks all notifications for a recipient as read. */
export function markAllRead(recipient: string): void {
  _store.forEach((n) => {
    if (n.recipient === recipient) n.read = true;
  });
}

// Track the active unsubscribe handle so __resetNotifications() can cleanly
// re-register after __resetBus() has cleared the subscriber set in tests.
let _unsubscribe: (() => void) | null = null;

function _setupSubscription(): void {
  if (_unsubscribe) _unsubscribe(); // idempotent: remove stale handle first
  _unsubscribe = subscribe(handleEvent);
}

/**
 * TEST-ONLY: clears the store (restoring seed data) and re-subscribes.
 * Must be called alongside __resetBus() in beforeEach so the handler is
 * re-registered after the bus clears its subscriber set.
 * Not part of the production contract — do not call from app code.
 */
export function __resetNotifications(): void {
  // Shallow-copy each seed object so markRead mutations don't permanently alter SEED_NOTIFICATIONS.
  _store.splice(0, _store.length, ...SEED_NOTIFICATIONS.map((n) => ({ ...n })));
  _setupSubscription();
}

// Register the handler on module load — exactly one subscription (singleton).
_setupSubscription();
