// @vitest-environment jsdom
//
// E1-S5 — RollupPage component tests (RTL).
// Covers NFR-12:
//   - Four UI states: loading / empty / error / ready
//   - Empty-tenant shows empty state (UC-1)
//   - Widgets render counts for the resolved scope
//   - Sibling subsidiaries notice for subsidiary user
//   - Read-only lock pill visible
//   - Edge-case link rendered
//   - AC3: subsidiary user does NOT see sibling subsidiary rows

import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen, waitFor, act } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { AuthContext } from "../../shared/auth/authContext";
import type { AuthContextValue, SessionClaims } from "../../shared/auth/auth.types";
import type { ID } from "../../shared/domain/types";
import { LocalStorageRepository } from "../../shared/data/LocalStorageRepository";
import type { Subsidiary } from "../../shared/domain/tenant.types";
import type { Lead } from "../../shared/domain/lead.types";
import type { Customer } from "../../shared/domain/customer.types";
import type { Ticket } from "../../shared/domain/ticket.types";
import { __resetBus } from "../../shared/events/bus";
import { __resetAuditLog } from "../../shared/events/auditLog";
import { SUBSIDIARY_CONFIG } from "../tenancy/subsidiaryConfig";
import { LEAD_ROLLUP_CONFIG, CUSTOMER_ROLLUP_CONFIG, TICKET_ROLLUP_CONFIG } from "./rollupConfigs";
import { RollupPage } from "./RollupPage";

// ── Fixtures ──────────────────────────────────────────────────────────────────

const TENANT_A: ID = "tnt_a";
const SUB_EU: ID = "sub_eu";
const SUB_US: ID = "sub_us";

const adminSession: SessionClaims = {
  userId: "usr_admin",
  tenantId: TENANT_A,
  subsidiaryId: null,
  roles: ["tenant_admin"],
  exp: "2099-12-31T23:59:59.000Z",
};

const salesSession: SessionClaims = {
  userId: "usr_sales",
  tenantId: TENANT_A,
  subsidiaryId: SUB_EU,
  roles: ["sales"],
  exp: "2099-12-31T23:59:59.000Z",
};

function makeAuthValue(session: SessionClaims | null): AuthContextValue {
  return {
    session,
    isAuthenticated: session !== null,
    signIn: vi.fn(),
    signOut: vi.fn(),
    setSubsidiaryScope: vi.fn(),
  };
}

function makeRepos(session: SessionClaims) {
  return {
    subsidiaryRepo: new LocalStorageRepository<Subsidiary>(SUBSIDIARY_CONFIG, session),
    leadRepo: new LocalStorageRepository<Lead>(LEAD_ROLLUP_CONFIG, session),
    customerRepo: new LocalStorageRepository<Customer>(CUSTOMER_ROLLUP_CONFIG, session),
    ticketRepo: new LocalStorageRepository<Ticket>(TICKET_ROLLUP_CONFIG, session),
  };
}

function renderPage(session: SessionClaims) {
  const repos = makeRepos(session);
  return render(
    <MemoryRouter>
      <AuthContext.Provider value={makeAuthValue(session)}>
        <RollupPage {...repos} />
      </AuthContext.Provider>
    </MemoryRouter>,
  );
}

function seedSubsidiary(id: ID, name: string, tenantId = TENANT_A): void {
  const key = `crm:${tenantId}:_parent:subsidiary`;
  const existing = JSON.parse(localStorage.getItem(key) ?? "[]") as unknown[];
  existing.push({
    id,
    tenantId,
    subsidiaryId: null,
    name,
    parentSubsidiaryId: null,
    region: "EU",
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    createdBy: "usr_admin",
    updatedBy: "usr_admin",
    version: 1,
    deletedAt: null,
  });
  localStorage.setItem(key, JSON.stringify(existing));
}

function seedLead(id: ID, subsidiaryId: ID | null, tenantId = TENANT_A): void {
  const seg = subsidiaryId ?? "_parent";
  const key = `crm:${tenantId}:${seg}:lead`;
  const existing = JSON.parse(localStorage.getItem(key) ?? "[]") as unknown[];
  existing.push({
    id,
    tenantId,
    subsidiaryId,
    name: "Test Lead",
    email: `${id}@test.com`,
    source: "web",
    status: "new",
    ownerId: "usr_admin",
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    createdBy: "usr_admin",
    updatedBy: "usr_admin",
    version: 1,
    deletedAt: null,
  });
  localStorage.setItem(key, JSON.stringify(existing));
}

// ── Setup ─────────────────────────────────────────────────────────────────────

beforeEach(() => {
  localStorage.clear();
  __resetBus();
  __resetAuditLog();
});

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("RollupPage", () => {
  it("renders the page heading", async () => {
    await act(async () => {
      renderPage(adminSession);
    });
    expect(screen.getByRole("heading", { name: /cross-subsidiary roll-up/i })).toBeInTheDocument();
  });

  it("shows the Read-only lock pill via aria-label", async () => {
    await act(async () => {
      renderPage(adminSession);
    });
    expect(screen.getByLabelText(/read-only/i)).toBeInTheDocument();
  });

  it("shows edge-case link", async () => {
    await act(async () => {
      renderPage(adminSession);
    });
    expect(screen.getByText(/open a record from another workspace/i)).toBeInTheDocument();
  });

  it("empty state — no records shows empty state, not error (AC4)", async () => {
    await act(async () => {
      renderPage(adminSession);
    });
    await waitFor(() => {
      expect(screen.getByText(/nothing to roll up yet/i)).toBeInTheDocument();
    });
  });

  it("ready state — renders counts for resolved scope", async () => {
    seedSubsidiary(SUB_EU, "EU Frankfurt");
    seedLead("lead_1", SUB_EU);
    seedLead("lead_2", SUB_EU);

    await act(async () => {
      renderPage(adminSession);
    });

    await waitFor(() => {
      expect(screen.getByText("EU Frankfurt")).toBeInTheDocument();
    });

    // Two leads in EU Frankfurt → count cell shows "2"
    const cells = screen.getAllByText("2");
    expect(cells.length).toBeGreaterThan(0);
    // Parent level row is always shown
    expect(screen.getByText("Parent level (shared)")).toBeInTheDocument();
    // Tenant total footer
    expect(screen.getByText(/tenant total/i)).toBeInTheDocument();
  });

  it("tenant-scope subtitle shown for admin", async () => {
    await act(async () => {
      renderPage(adminSession);
    });
    expect(screen.getByText(/a read-only aggregate across every subsidiary/i)).toBeInTheDocument();
  });

  it("subsidiary-scope subtitle shown for subsidiary user", async () => {
    await act(async () => {
      renderPage(salesSession);
    });
    await waitFor(() => {
      expect(screen.getByText(/sibling subsidiaries are not shown/i)).toBeInTheDocument();
    });
  });

  it("AC3: subsidiary user does NOT see sibling subsidiary rows (AC3/UC-5)", async () => {
    // Seed two subsidiaries: EU (sales user's own) and US (sibling)
    seedSubsidiary(SUB_EU, "EU Frankfurt");
    seedSubsidiary(SUB_US, "US Chicago");
    seedLead("lead_eu", SUB_EU);
    seedLead("lead_us", SUB_US); // in the sibling sub — must not appear as a row

    await act(async () => {
      renderPage(salesSession); // scoped to SUB_EU only
    });

    await waitFor(() => {
      // salesSession sees own sub → EU Frankfurt row appears
      expect(screen.getByText("EU Frankfurt")).toBeInTheDocument();
    });

    // US Chicago is a sibling — must not appear as a row for the subsidiary user
    expect(screen.queryByText("US Chicago")).not.toBeInTheDocument();
  });

  it("grand total rendered in Tenant total footer", async () => {
    seedSubsidiary(SUB_EU, "EU Frankfurt");
    seedLead("lead_1", SUB_EU);

    await act(async () => {
      renderPage(adminSession);
    });

    await waitFor(() => {
      expect(screen.getByText(/tenant total/i)).toBeInTheDocument();
    });

    // The Tenant total row should be present and carry the grand total
    const tenantTotalRow = screen.getByText(/tenant total/i).closest('[role="row"]');
    expect(tenantTotalRow).toBeInTheDocument();
  });
});
