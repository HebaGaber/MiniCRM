import '@testing-library/jest-dom/vitest'
import { cleanup } from '@testing-library/react'
import { afterEach } from 'vitest'

afterEach(() => {
  cleanup()
  // AuthProvider now persists the session to sessionStorage (sign-in fix). Clear it
  // between specs so a signIn() in one test cannot restore a session into the next
  // test's fresh <AuthProvider> mount. Guarded for the node-env specs (no DOM storage).
  if (typeof sessionStorage !== 'undefined') sessionStorage.clear()
})
