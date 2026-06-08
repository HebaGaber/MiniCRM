// @vitest-environment jsdom
//
// E0-S5 auth-kernel specs (NFR-12, AC1–AC4). This is the FIRST RTL spec in the
// repo; it opts into jsdom via the docblock above so the 153 node-env specs
// (domain/events/data) are untouched (global Vitest env stays `node`). It proves:
// - AC1: a consumer rendered INSIDE <AuthProvider> reads claims; useAuth() OUTSIDE
//        the provider THROWS (never silently returns undefined).
// - AC2: tenant_admin → subsidiaryId === null (roll-up); a pinned role → concrete id.
// - AC3: signIn / signOut / failed-login each emit exactly 1 domain event + 1 audit
//        on ONE shared correlationId — proven with the E0-S7 UC-2 conformance helper.
// - AC4 / Reconciliation A: prototype role ids (`support_agent`) map onto canonical
//        roles, exercising the mock-SSO seam through the stable useAuth() surface.

import { describe, it, expect, beforeEach } from "vitest";
import { render, renderHook, act, screen, fireEvent } from "@testing-library/react";
import { AuthProvider } from "./AuthProvider";
import { useAuth } from "./useAuth";
import { __resetBus } from "../events/bus";
import { __resetAuditLog } from "../events/auditLog";
import { expectOneOpOneEventOneAudit } from "../events/conformance";

beforeEach(() => {
  // Reset both streams so emissions don't leak across specs (E0-S7 contract).
  __resetBus();
  __resetAuditLog();
});

describe("useAuth() guard (AC1)", () => {
  it("throws when used outside <AuthProvider> — never returns undefined", () => {
    function Outside() {
      useAuth();
      return null;
    }
    expect(() => render(<Outside />)).toThrow(/within <AuthProvider>/);
  });

  it("a rendered consumer inside <AuthProvider> reads the claims", () => {
    function ClaimsProbe() {
      const { session, isAuthenticated, signIn } = useAuth();
      return (
        <div>
          <span data-testid="auth">{String(isAuthenticated)}</span>
          <span data-testid="sub">{session ? String(session.subsidiaryId) : "none"}</span>
          <button onClick={() => signIn("tenant_admin")}>signin</button>
        </div>
      );
    }
    render(
      <AuthProvider>
        <ClaimsProbe />
      </AuthProvider>,
    );
    expect(screen.getByTestId("auth").textContent).toBe("false");
    fireEvent.click(screen.getByText("signin"));
    expect(screen.getByTestId("auth").textContent).toBe("true");
    expect(screen.getByTestId("sub").textContent).toBe("null"); // tenant_admin roll-up
  });
});

describe("claims derivation (AC1, AC2, Reconciliation A)", () => {
  it("tenant_admin carries subsidiaryId === null (roll-up — AC2)", () => {
    const { result } = renderHook(() => useAuth(), { wrapper: AuthProvider });
    act(() => result.current.signIn("tenant_admin"));
    expect(result.current.isAuthenticated).toBe(true);
    expect(result.current.session?.userId).toBe("usr_sara");
    expect(result.current.session?.tenantId).toBe("tnt_northwind");
    expect(result.current.session?.subsidiaryId).toBeNull();
    expect(result.current.session?.roles).toEqual(["tenant_admin"]);
    expect(result.current.session?.exp).toBe("2099-12-31T23:59:59.000Z"); // full claims set (NFR-12)
  });

  it("a subsidiary-pinned role carries a concrete subsidiaryId (AC2)", () => {
    const { result } = renderHook(() => useAuth(), { wrapper: AuthProvider });
    act(() => result.current.signIn("sales"));
    expect(result.current.session?.subsidiaryId).toBe("sub_eu");
    expect(result.current.session?.roles).toEqual(["sales"]);
  });

  it("maps a prototype role id onto its canonical role (Reconciliation A)", () => {
    const { result } = renderHook(() => useAuth(), { wrapper: AuthProvider });
    act(() => result.current.signIn("support_agent"));
    expect(result.current.session?.roles).toEqual(["support"]);
    expect(result.current.session?.subsidiaryId).toBe("sub_us");
  });

  it("an inherited Object.prototype key is NOT a role — no bogus session", () => {
    // Regression guard: with `in`/bracket access these resolve a fabricated role
    // and mint claims with userId undefined. `Object.hasOwn` makes them miss the map.
    const { result } = renderHook(() => useAuth(), { wrapper: AuthProvider });
    for (const key of ["constructor", "toString", "valueOf", "hasOwnProperty", "__proto__"]) {
      act(() => result.current.signIn(key));
      expect(result.current.isAuthenticated).toBe(false);
      expect(result.current.session).toBeNull();
    }
  });
});

describe("audited auth events — dual streams, one correlationId (AC3 / UC-2)", () => {
  it("signIn emits exactly one Auth.LoggedIn + one audit on a shared correlationId", () => {
    const { result } = renderHook(() => useAuth(), { wrapper: AuthProvider });
    const { events, audits } = expectOneOpOneEventOneAudit(() => {
      act(() => result.current.signIn("tenant_admin"));
    });
    expect(events[0].type).toBe("Auth.LoggedIn");
    expect(audits[0].action).toBe("auth.login"); // lowercase dotted verb (Reconciliation B)
    expect(events[0].actorId).toBe("usr_sara");
    expect(audits[0].correlationId).toBe(events[0].correlationId);
  });

  it("signOut emits exactly one Auth.LoggedOut + one audit on a shared correlationId", () => {
    const { result } = renderHook(() => useAuth(), { wrapper: AuthProvider });
    act(() => result.current.signIn("sales"));
    const { events, audits } = expectOneOpOneEventOneAudit(() => {
      act(() => result.current.signOut());
    });
    expect(events[0].type).toBe("Auth.LoggedOut");
    expect(audits[0].action).toBe("auth.logout");
    expect(events[0].actorId).toBe("usr_marco"); // about-to-be-cleared claims
    expect(audits[0].correlationId).toBe(events[0].correlationId);
    expect(result.current.isAuthenticated).toBe(false);
  });

  it("signIn with an invalid role emits Auth.LoginFailed (1+1) and stays unauthenticated", () => {
    const { result } = renderHook(() => useAuth(), { wrapper: AuthProvider });
    const { events, audits } = expectOneOpOneEventOneAudit(() => {
      act(() => result.current.signIn("not_a_role"));
    });
    expect(events[0].type).toBe("Auth.LoginFailed");
    expect(audits[0].action).toBe("auth.login_failed");
    expect(events[0].actorId).toBe("usr_anonymous"); // anonymous sentinel (OQ3)
    expect(events[0].tenantId).toBe("tnt_northwind");
    expect(audits[0].correlationId).toBe(events[0].correlationId);
    expect(result.current.isAuthenticated).toBe(false);
    expect(result.current.session).toBeNull();
  });
});
