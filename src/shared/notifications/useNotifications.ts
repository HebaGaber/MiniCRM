// useNotifications() — four-state React hook for the notifications kernel (AC4).
// Consumers (E5-S3 bell/inbox, E5-S1 dashboard card) plug the returned `state`
// directly into <QueryStateBoundary> without writing any notification logic of
// their own (ADR-014). The hook is read-only at this layer; mutations flow through
// markRead / markAllRead which force a re-render via the version counter pattern.

import { useState } from 'react';
import type { QueryState } from '../ui/QueryStateBoundary';
import { useAuth } from '../auth/useAuth';
import type { AppNotification } from './NotificationService';
import {
  notificationsFor,
  markRead as serviceMarkRead,
  markAllRead as serviceMarkAllRead,
} from './NotificationService';

export interface UseNotificationsResult {
  state: QueryState;
  notifications: readonly AppNotification[];
  unreadCount: number;
  markRead: (id: string) => void;
  markAllRead: () => void;
  error: Error | null;
}

export function useNotifications(): UseNotificationsResult {
  const { session } = useAuth();

  // Version counter forces a re-render when markRead/markAllRead mutate _store.
  const [, setVersion] = useState(0);
  const forceUpdate = () => setVersion((v) => v + 1);

  if (!session) {
    return {
      state: 'loading',
      notifications: [],
      unreadCount: 0,
      markRead: () => undefined,
      markAllRead: () => undefined,
      error: null,
    };
  }

  const recipient = session.userId;
  // UC-5: filter by tenantId to prevent cross-tenant notification leaks if userId values collide.
  const notifications = notificationsFor(recipient).filter(
    (n) => n.tenantId === session.tenantId,
  );
  const state: QueryState = notifications.length === 0 ? 'empty' : 'ready';
  const unreadCount = notifications.filter((n) => !n.read).length;

  function markRead(id: string): void {
    serviceMarkRead(id);
    forceUpdate();
  }

  function markAllRead(): void {
    serviceMarkAllRead(recipient);
    forceUpdate();
  }

  return {
    state,
    notifications,
    unreadCount,
    markRead,
    markAllRead,
    error: null,
  };
}
