// @vitest-environment jsdom
//
// Tests for TenantProvider (E1-S1, AC1).
// Covers:
//   - scopeName derivation for each mock role identity
//   - scopeLoading timer: true on session change, false after 420ms
//   - useTenant() throws outside <TenantProvider>
//   - null session renders children without TenantContext value

import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, act, cleanup } from "@testing-library/react";
import { AuthContext } from "../shared/auth/authContext";
import type { AuthContextValue, SessionClaims } from "../shared/auth/auth.types";
import type { ID } from "../shared/domain/types";
import { TenantProvider } from "./TenantProvider";
import { useTenant } from "../shared/auth/useTenant";

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeSession(overrides: Partial<SessionClaims> = {}): SessionClaims {
  return {
    userId: "usr_test" as ID,
    tenantId: "tnt_northwind" as ID,
    subsidiaryId: null,
    roles: ["tenant_admin"],
    exp: "2099-12-31T23:59:59.000Z",
    ...overrides,
  };
}

function makeAuthValue(session: SessionClaims | null): AuthContextValue {
  return {
    session,
    isAuthenticated: session !== null,
    signIn: vi.fn(),
    signOut: vi.fn(),
    setSubsidiaryScope: vi.fn(),
  };
}

function ScopeDisplay() {
  const ctx = useTenant();
  return (
    <div>
      <span data-testid="tenantId">{ctx.tenantId}</span>
      <span data-testid="subsidiaryId">{ctx.subsidiaryId ?? "null"}</span>
      <span data-testid="scopeName">{ctx.scopeName}</span>
      <span data-testid="scopeLoading">{String(ctx.scopeLoading)}</span>
    </div>
  );
}

function renderWithAuth(session: SessionClaims | null) {
  return render(
    <AuthContext.Provider value={makeAuthValue(session)}>
      <TenantProvider>
        <ScopeDisplay />
      </TenantProvider>
    </AuthContext.Provider>,
  );
}

// ── Tests ─────────────────────────────────────────────────────────────────────

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe("TenantProvider — scopeName derivation", () => {
  it("derives 'Northwind Trading' for tenant_admin (subsidiaryId=null)", () => {
    renderWithAuth(makeSession({ subsidiaryId: null }));
    expect(screen.getByTestId("scopeName").textContent).toBe("Northwind Trading");
  });

  it("derives 'EU / Frankfurt' for sub_eu session", () => {
    renderWithAuth(makeSession({ subsidiaryId: "sub_eu" as ID }));
    expect(screen.getByTestId("scopeName").textContent).toBe("EU / Frankfurt");
  });

  it("derives 'US / Chicago' for sub_us session", () => {
    renderWithAuth(makeSession({ subsidiaryId: "sub_us" as ID }));
    expect(screen.getByTestId("scopeName").textContent).toBe("US / Chicago");
  });

  it("falls back to subsidiaryId string for unknown subsidiary", () => {
    renderWithAuth(makeSession({ subsidiaryId: "sub_unknown" as ID }));
    expect(screen.getByTestId("scopeName").textContent).toBe("sub_unknown");
  });

  it("exposes tenantId and subsidiaryId from the session", () => {
    renderWithAuth(makeSession({ subsidiaryId: "sub_eu" as ID }));
    expect(screen.getByTestId("tenantId").textContent).toBe("tnt_northwind");
    expect(screen.getByTestId("subsidiaryId").textContent).toBe("sub_eu");
  });
});

describe("TenantProvider — scopeLoading timer", () => {
  it("sets scopeLoading=true on initial mount with a session, then false after 420ms", async () => {
    vi.useFakeTimers();
    renderWithAuth(makeSession());

    expect(screen.getByTestId("scopeLoading").textContent).toBe("true");

    await act(async () => {
      vi.advanceTimersByTime(420);
    });

    expect(screen.getByTestId("scopeLoading").textContent).toBe("false");
  });

  it("scopeLoading is true before 420ms elapses", async () => {
    vi.useFakeTimers();
    renderWithAuth(makeSession());

    await act(async () => {
      vi.advanceTimersByTime(419);
    });

    expect(screen.getByTestId("scopeLoading").textContent).toBe("true");
  });

  it("re-triggers scopeLoading when session identity changes", async () => {
    vi.useFakeTimers();
    const session1 = makeSession({ userId: "usr_sara" as ID, subsidiaryId: null });
    const session2 = makeSession({ userId: "usr_marco" as ID, subsidiaryId: "sub_eu" as ID });

    const { rerender } = render(
      <AuthContext.Provider value={makeAuthValue(session1)}>
        <TenantProvider>
          <ScopeDisplay />
        </TenantProvider>
      </AuthContext.Provider>,
    );

    // Let first scopeLoading expire
    await act(async () => { vi.advanceTimersByTime(420); });
    expect(screen.getByTestId("scopeLoading").textContent).toBe("false");

    // Switch session
    rerender(
      <AuthContext.Provider value={makeAuthValue(session2)}>
        <TenantProvider>
          <ScopeDisplay />
        </TenantProvider>
      </AuthContext.Provider>,
    );

    expect(screen.getByTestId("scopeLoading").textContent).toBe("true");

    await act(async () => { vi.advanceTimersByTime(420); });
    expect(screen.getByTestId("scopeLoading").textContent).toBe("false");
  });
});

describe("TenantProvider — null session", () => {
  it("renders children when session is null (no TenantContext value provided)", () => {
    // When session=null, TenantProvider renders children without providing TenantContext.
    // We can't call useTenant() in this subtree — just assert children render.
    render(
      <AuthContext.Provider value={makeAuthValue(null)}>
        <TenantProvider>
          <span data-testid="child">rendered</span>
        </TenantProvider>
      </AuthContext.Provider>,
    );
    expect(screen.getByTestId("child").textContent).toBe("rendered");
  });
});

describe("useTenant — outside provider", () => {
  it("throws if called outside <TenantProvider>", () => {
    function BadConsumer() {
      useTenant();
      return null;
    }
    // Suppress React error boundary console output
    const spy = vi.spyOn(console, "error").mockImplementation(() => undefined);
    expect(() => render(<BadConsumer />)).toThrow("useTenant must be used within <TenantProvider>");
    spy.mockRestore();
  });
});
