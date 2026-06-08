// App-level provider composition (E0-S5 + E0-S10 + E0-S12 + E1-S1).
// Mount order (innermost is always available to its children):
//   AuthProvider          — session claims, signIn/signOut
//   └── TenantProvider    — derived scope (tenantId, subsidiaryId, scopeName, scopeLoading)
//       └── FlagProvider  — feature flags (can read auth context for tenant-scoped flags)
//           └── children
//
// NotificationService is imported for its side-effect: registering the bus
// subscription at app boot (ADR-014) so no Ticket.Assigned / Lead.Converted
// events are missed before the first useNotifications() consumer mounts.

import type { ReactNode } from 'react';
import { AuthProvider } from '../shared/auth/AuthProvider';
import { TenantProvider } from './TenantProvider';
import { FlagProvider } from '../shared/config/FlagProvider';
import '../shared/notifications/NotificationService'; // side-effect: registers bus subscription

export function Providers({ children }: { children: ReactNode }) {
  return (
    <AuthProvider>
      <TenantProvider>
        <FlagProvider>
          {children}
        </FlagProvider>
      </TenantProvider>
    </AuthProvider>
  );
}
