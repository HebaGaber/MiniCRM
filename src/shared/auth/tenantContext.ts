// The React context object for the tenant/scope kernel, kept in its own module so
// TenantProvider.tsx exports ONLY its component (same rationale as authContext.ts —
// eslint react-refresh/only-export-components). `useTenant.ts` imports the context
// from here to read the value.
//
// The context defaults to the `undefined` sentinel: a consumer rendered OUTSIDE
// `<TenantProvider>` reads `undefined`, which `useTenant()` detects and turns into a
// thrown error — the hook never silently returns `undefined` (mirrors auth pattern).

import { createContext } from "react";
import type { TenantContextValue } from "./tenant.types";

/** Tenant/scope context; `undefined` until a `<TenantProvider>` supplies a value. */
export const TenantContext = createContext<TenantContextValue | undefined>(undefined);
