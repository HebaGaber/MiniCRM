// The React context object for the auth kernel, kept in its own module so that
// `AuthProvider.tsx` exports ONLY its component (eslint `react-refresh/
// only-export-components` is an error, and `allowConstantExport` does not cover a
// `createContext()` call — co-locating the context with the component would break
// the rule). `useAuth.ts` imports the context from here to read the value.
//
// The context defaults to the `undefined` sentinel (React 19 idiom): a consumer
// rendered OUTSIDE `<AuthProvider>` reads `undefined`, which `useAuth()` detects and
// turns into a thrown error — the hook never silently returns `undefined` (AC1).

import { createContext } from "react";
import type { AuthContextValue } from "./auth.types";

/** Auth context; `undefined` until a `<AuthProvider>` supplies a value (AC1 guard). */
export const AuthContext = createContext<AuthContextValue | undefined>(undefined);
