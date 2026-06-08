// @vitest-environment jsdom
//
// E1-S4 fidelity specs (correct-course DEC-CC-5/6). Pins the prototype sidebar
// (`prototype/app/shell.jsx` Sidebar + `config.jsx` NAV): two labelled groups —
// **Workspace** and **Tenancy** — with Subsidiaries=`network` and Roll-up=`layers`
// (the impl had them swapped: Subsidiaries=`layers`, Roll-up=`bar-chart-2`). Roll-up
// stays visible to every role (DEC-CC-6); the prototype's admin-only nav gate is stale.

import { describe, it, expect, afterEach, vi } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { AuthContext } from "../../auth/authContext";
import type { AuthContextValue, SessionClaims } from "../../auth/auth.types";
import type { ID } from "../../domain/types";
import { AppShell } from "./AppShell";

afterEach(() => { cleanup(); vi.restoreAllMocks(); });

const TENANT_ID: ID = "tnt_northwind";
const SUB_EU: ID = "sub_eu";

const adminSession: SessionClaims = {
  userId: "usr_sara", tenantId: TENANT_ID, subsidiaryId: null,
  roles: ["tenant_admin"], exp: "2099-12-31T23:59:59.000Z",
};
const salesSession: SessionClaims = {
  userId: "usr_marco", tenantId: TENANT_ID, subsidiaryId: SUB_EU,
  roles: ["sales"], exp: "2099-12-31T23:59:59.000Z",
};

function makeAuthValue(session: SessionClaims): AuthContextValue {
  return { session, isAuthenticated: true, signIn: vi.fn(), signOut: vi.fn(), setSubsidiaryScope: vi.fn() };
}

function renderShell(session: SessionClaims) {
  return render(
    <MemoryRouter>
      <AuthContext.Provider value={makeAuthValue(session)}>
        <AppShell activeSubs={[{ id: SUB_EU, name: "EU / Frankfurt", region: "EU", tenantId: TENANT_ID }]}>
          <div>content</div>
        </AppShell>
      </AuthContext.Provider>
    </MemoryRouter>,
  );
}

describe("E1-S4 fidelity — sidebar nav groups + icons (DEC-CC-5/6)", () => {
  it("renders both Workspace and Tenancy group labels for admin", () => {
    renderShell(adminSession);
    expect(screen.getByText("Workspace")).toBeInTheDocument();
    expect(screen.getByText("Tenancy")).toBeInTheDocument();
  });

  it("Subsidiaries nav uses the `network` icon (not `layers`)", () => {
    renderShell(adminSession);
    const link = screen.getByRole("link", { name: /Subsidiaries/ });
    expect(link.querySelector(".lucide-network")).toBeTruthy();
    expect(link.querySelector(".lucide-layers")).toBeNull();
  });

  it("Roll-up nav uses the `layers` icon (not `bar-chart-2`)", () => {
    renderShell(adminSession);
    const link = screen.getByRole("link", { name: /Roll-up/ });
    expect(link.querySelector(".lucide-layers")).toBeTruthy();
    expect(link.querySelector(".lucide-bar-chart-2")).toBeNull();
  });

  it("Roll-up stays visible to a non-admin role (DEC-CC-6 — prototype admin-only nav is stale)", () => {
    renderShell(salesSession);
    expect(screen.getByRole("link", { name: /Roll-up/ })).toBeInTheDocument();
  });
});
