// App-level provider composition (E0-S5 + E0-S10 + E0-S12).
// FlagProvider is mounted INSIDE AuthProvider so useFlag/useConfig can read
// the auth context (tenantId, subsidiaryId) for flag evaluation (ADR-011).
// NotificationService is imported for its side-effect: registering the bus
// subscription at app boot (ADR-014) so no Ticket.Assigned / Lead.Converted
// events are missed before the first useNotifications() consumer mounts.

import type { ReactNode } from 'react';
import { AuthProvider } from '../shared/auth/AuthProvider';
import { FlagProvider } from '../shared/config/FlagProvider';
import '../shared/notifications/NotificationService'; // side-effect: registers bus subscription

export function Providers({ children }: { children: ReactNode }) {
  return (
    <AuthProvider>
      <FlagProvider>
        {children}
      </FlagProvider>
    </AuthProvider>
  );
}
