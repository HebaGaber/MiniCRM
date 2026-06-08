// @vitest-environment jsdom
//
// E0-S5 / E0-S6 sign-in flow integration spec (sign-in fix).
// Proves the end-to-end contract the prior implementation broke:
//  - /sign-in is a PUBLIC route reachable while unauthenticated (E0-S6).
//  - An unauthenticated visit to a protected route is bounced to /sign-in.
//  - Picking a demo role ESTABLISHES the session in the auth context and the guard
//    recognizes it, REDIRECTING into the authenticated app home (off /sign-in).
//  - The session PERSISTS to sessionStorage, so a reload (fresh provider mount)
//    keeps the user signed in instead of bouncing back to /sign-in.
//
// Renders the real <Providers> (AuthProvider) + <App> (AppRouter's BrowserRouter),
// so it exercises the actual route guard + redirect wiring, not a stand-in.

import { describe, it, expect, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor, cleanup } from "@testing-library/react";
import { Providers } from "./providers";
import App from "../App";
import { __resetBus } from "../shared/events/bus";
import { __resetAuditLog } from "../shared/events/auditLog";

beforeEach(() => {
  // Fresh streams + empty stores so each render starts deterministic and signed out.
  __resetBus();
  __resetAuditLog();
  sessionStorage.clear();
  localStorage.clear();
  // Reset the SPA history to "/" so BrowserRouter starts at the protected root.
  window.history.pushState({}, "", "/");
});

function renderApp() {
  return render(
    <Providers>
      <App />
    </Providers>,
  );
}

describe("sign-in flow (E0-S5 / E0-S6)", () => {
  it("an unauthenticated visit to a protected route is redirected to the public /sign-in", async () => {
    renderApp();
    // The guard bounced "/" → "/sign-in" and the role picker is visible.
    expect(await screen.findByText("Pick a demo role to sign in")).toBeInTheDocument();
    expect(window.location.pathname).toBe("/sign-in");
  });

  it("picking a role signs in and lands on the authenticated app home (off /sign-in)", async () => {
    renderApp();

    const adminCard = await screen.findByRole("button", { name: /Tenant Admin/i });
    fireEvent.click(adminCard);

    // The session is established + the guard lets us in: we leave /sign-in for the
    // app home ("/" → "/rollup"), and the sign-in picker is gone.
    await waitFor(() => expect(window.location.pathname).toBe("/rollup"));
    expect(screen.queryByText("Pick a demo role to sign in")).not.toBeInTheDocument();

    // …and the session was persisted (so a reload would not bounce us back).
    expect(sessionStorage.getItem("mincrm.auth.session")).not.toBeNull();
  });

  it("persists the session across a reload — a fresh app mount stays signed in", async () => {
    renderApp();
    fireEvent.click(await screen.findByRole("button", { name: /Tenant Admin/i }));
    await waitFor(() => expect(window.location.pathname).toBe("/rollup"));

    // Simulate a full page reload: tear down and mount a brand-new app tree. The
    // session must be restored from sessionStorage — no bounce to /sign-in, and NO
    // re-prompt for a role.
    cleanup();
    renderApp();

    await waitFor(() => expect(window.location.pathname).toBe("/rollup"));
    expect(screen.queryByText("Pick a demo role to sign in")).not.toBeInTheDocument();
  });
});
