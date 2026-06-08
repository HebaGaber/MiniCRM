// @vitest-environment jsdom
//
// E0-S6 guard RTL specs (NFR-12, AC1/AC4). Opts into jsdom via the docblock above so
// the node-env specs stay untouched (global Vitest env stays `node` — E0-S5 pattern).
// Proves the two gates against the REAL auth context (`<AuthProvider>` + `useAuth`):
// - RouteGuard renders a screen for an allowed role and blocks (renders fallback) for
//   a denied role, and blocks while unauthenticated (AC1 route-guard).
// - ActionGuard permits a mutation control on an OWNED record and disables it on a
//   NOT-OWNED record for an `own`/`restricted` role (AC1 action-guard, ADR-015).
// The mock claims (usr_marco / sub_eu for `sales`) come from AuthProvider's identity map.

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import { AuthProvider } from "./AuthProvider";
import { useAuth } from "./useAuth";
import { RouteGuard, ActionGuard } from "./guards";
import type { OwnedResource } from "./permissions";
import { __resetBus } from "../events/bus";
import { __resetAuditLog } from "../events/auditLog";

beforeEach(() => {
  __resetBus();
  __resetAuditLog();
});

// Vitest config does not set `globals: true`, so RTL's auto-cleanup is not
// registered — unmount each render explicitly so duplicate test ids don't stack.
afterEach(() => {
  cleanup();
});

// A harness that signs in the given role then renders a RouteGuard for `capability`.
function RouteHarness({ role, capability }: { role: string; capability: Parameters<typeof RouteGuard>[0]["capability"] }) {
  const { signIn, isAuthenticated } = useAuth();
  return (
    <div>
      {!isAuthenticated && <button onClick={() => signIn(role)}>signin</button>}
      <RouteGuard capability={capability} fallback={<div data-testid="blocked">No access</div>}>
        <div data-testid="screen">Screen content</div>
      </RouteGuard>
    </div>
  );
}

describe("RouteGuard renders/blocks a screen by role (AC1)", () => {
  it("blocks while unauthenticated (renders fallback, not the screen)", () => {
    render(
      <AuthProvider>
        <RouteHarness role="tenant_admin" capability="tenant.manage" />
      </AuthProvider>,
    );
    expect(screen.queryByTestId("screen")).toBeNull();
    expect(screen.getByTestId("blocked")).not.toBeNull();
  });

  it("renders the screen for an allowed role (tenant_admin → tenant.manage)", () => {
    render(
      <AuthProvider>
        <RouteHarness role="tenant_admin" capability="tenant.manage" />
      </AuthProvider>,
    );
    fireEvent.click(screen.getByText("signin"));
    expect(screen.getByTestId("screen")).not.toBeNull();
    expect(screen.queryByTestId("blocked")).toBeNull();
  });

  it("blocks a denied role (viewer → tenant.manage is default-deny)", () => {
    render(
      <AuthProvider>
        <RouteHarness role="viewer" capability="tenant.manage" />
      </AuthProvider>,
    );
    fireEvent.click(screen.getByText("signin"));
    expect(screen.queryByTestId("screen")).toBeNull();
    expect(screen.getByTestId("blocked")).not.toBeNull();
  });

  it("opens a screen for a read-only (view) role (viewer → lead.manage)", () => {
    render(
      <AuthProvider>
        <RouteHarness role="viewer" capability="lead.manage" />
      </AuthProvider>,
    );
    fireEvent.click(screen.getByText("signin"));
    expect(screen.getByTestId("screen")).not.toBeNull(); // view grant still opens the screen
  });
});

// A harness that signs in `sales` then renders an ActionGuard for a delete control.
function ActionHarness({ resource }: { resource: OwnedResource }) {
  const { signIn, isAuthenticated } = useAuth();
  return (
    <div>
      {!isAuthenticated && <button onClick={() => signIn("sales")}>signin</button>}
      <ActionGuard capability="record.deleteExport" action="softDelete" resource={resource}>
        {(allowed) => (
          <button data-testid="delete" disabled={!allowed}>
            Delete
          </button>
        )}
      </ActionGuard>
    </div>
  );
}

describe("ActionGuard permits/disables a control on owned vs not-owned (AC1, ADR-015)", () => {
  // sales mock claims: userId usr_marco, tenant tnt_northwind, subsidiary sub_eu.
  const OWNED: OwnedResource = { tenantId: "tnt_northwind", subsidiaryId: "sub_eu", ownerId: "usr_marco" };
  const NOT_OWNED: OwnedResource = { tenantId: "tnt_northwind", subsidiaryId: "sub_eu", ownerId: "usr_someone_else" };

  it("permits soft-delete on an OWNED record (restricted grant + owned → enabled)", () => {
    render(
      <AuthProvider>
        <ActionHarness resource={OWNED} />
      </AuthProvider>,
    );
    fireEvent.click(screen.getByText("signin"));
    expect((screen.getByTestId("delete") as HTMLButtonElement).disabled).toBe(false);
  });

  it("disables soft-delete on a NOT-OWNED record (restricted grant + not owned → disabled)", () => {
    render(
      <AuthProvider>
        <ActionHarness resource={NOT_OWNED} />
      </AuthProvider>,
    );
    fireEvent.click(screen.getByText("signin"));
    expect((screen.getByTestId("delete") as HTMLButtonElement).disabled).toBe(true);
  });

  it("disables the control while unauthenticated", () => {
    render(
      <AuthProvider>
        <ActionHarness resource={OWNED} />
      </AuthProvider>,
    );
    expect((screen.getByTestId("delete") as HTMLButtonElement).disabled).toBe(true);
  });

  it("disables the control for an out-of-tenant record (notFound — non-disclosure, AC4)", () => {
    // The record is OWNED by the actor but lives in another tenant → notFound, not granted.
    // The control is disabled identically to a role-denial, never revealing the record exists.
    const crossTenant: OwnedResource = { tenantId: "tnt_other", subsidiaryId: "sub_eu", ownerId: "usr_marco" };
    render(
      <AuthProvider>
        <ActionHarness resource={crossTenant} />
      </AuthProvider>,
    );
    fireEvent.click(screen.getByText("signin"));
    expect((screen.getByTestId("delete") as HTMLButtonElement).disabled).toBe(true);
  });
});
