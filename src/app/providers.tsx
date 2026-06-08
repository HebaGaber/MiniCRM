// App-level provider composition (E0-S5 + E0-S10).
// FlagProvider is mounted INSIDE AuthProvider so useFlag/useConfig can read
// the auth context (tenantId, subsidiaryId) for flag evaluation (ADR-011).

import type { ReactNode } from 'react';
import { AuthProvider } from '../shared/auth/AuthProvider';
import { FlagProvider } from '../shared/config/FlagProvider';

export function Providers({ children }: { children: ReactNode }) {
  return (
    <AuthProvider>
      <FlagProvider>
        {children}
      </FlagProvider>
    </AuthProvider>
  );
}
