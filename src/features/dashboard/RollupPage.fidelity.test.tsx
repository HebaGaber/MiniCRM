// @vitest-environment jsdom
//
// E1-S5 fidelity specs (correct-course DEC-CC-5/6). Pins the prototype RollupPage
// (`prototype/app/tenancy.jsx`): empty fires on grand===0 regardless of subsidiary
// count (AC4); eyebrow shows the role DISPLAY LABEL + scope DISPLAY NAME (not the raw
// role id + tenantId); the empty state shows the `layers` icon + a scope line (§8.7).

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

const TENANT_A: ID = "tnt_a";
const SUB_EU: ID = "sub_eu";

const adminSession: SessionClaims = {
  userId: "usr_admin", tenantId: TENANT_A, subsidiaryId: null,
  roles: ["tenant_admin"], exp: "2099-12-31T23:59:59.000Z",
};

function makeAuthValue(session: SessionClaims): AuthContextValue {
  return { session, isAuthenticated: true, signIn: vi.fn(), signOut: vi.fn(), setSubsidiaryScope: vi.fn() };
}
function renderPage(session: SessionClaims) {
  return render(
    <MemoryRouter>
      <AuthContext.Provider value={makeAuthValue(session)}>
        <RollupPage
          subsidiaryRepo={new LocalStorageRepository<Subsidiary>(SUBSIDIARY_CONFIG, session)}
          leadRepo={new LocalStorageRepository<Lead>(LEAD_ROLLUP_CONFIG, session)}
          customerRepo={new LocalStorageRepository<Customer>(CUSTOMER_ROLLUP_CONFIG, session)}
          ticketRepo={new LocalStorageRepository<Ticket>(TICKET_ROLLUP_CONFIG, session)}
        />
      </AuthContext.Provider>
    </MemoryRouter>,
  );
}
function seedSubsidiary(id: ID, name: string): void {
  const key = `crm:${TENANT_A}:_parent:subsidiary`;
  const existing = JSON.parse(localStorage.getItem(key) ?? "[]") as unknown[];
  existing.push({
    id, tenantId: TENANT_A, subsidiaryId: null, name, parentSubsidiaryId: null, region: "EU",
    createdAt: "2026-01-01T00:00:00.000Z", updatedAt: "2026-01-01T00:00:00.000Z",
    createdBy: "usr_admin", updatedBy: "usr_admin", version: 1, deletedAt: null,
  });
  localStorage.setItem(key, JSON.stringify(existing));
}
function seedLead(id: ID, subsidiaryId: ID): void {
  const key = `crm:${TENANT_A}:${subsidiaryId}:lead`;
  const existing = JSON.parse(localStorage.getItem(key) ?? "[]") as unknown[];
  existing.push({
    id, tenantId: TENANT_A, subsidiaryId, name: "L", email: `${id}@t.com`, source: "web",
    status: "new", ownerId: "usr_admin", createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z", createdBy: "usr_admin", updatedBy: "usr_admin",
    version: 1, deletedAt: null,
  });
  localStorage.setItem(key, JSON.stringify(existing));
}

beforeEach(() => {
  localStorage.clear();
  __resetBus();
  __resetAuditLog();
});

describe("E1-S5 fidelity (DEC-CC-5/6)", () => {
  it("empty state fires on grand===0 even when subsidiaries exist (AC4) — layers icon + scope line", async () => {
    seedSubsidiary(SUB_EU, "EU Frankfurt"); // sub exists, but it holds zero records
    await act(async () => { renderPage(adminSession); });

    await waitFor(() => expect(screen.getByText(/nothing to roll up yet/i)).toBeInTheDocument());
    // layers icon in the empty state (no table rows are rendered while empty)
    expect(document.querySelector(".lucide-layers")).toBeTruthy();
    // scope line "Whole tenant (roll-up)" appears in BOTH the eyebrow and the empty scopeLine
    expect(screen.getAllByText(/Whole tenant \(roll-up\)/).length).toBeGreaterThanOrEqual(2);
  });

  it("eyebrow shows the role display label + scope display name (not raw ids)", async () => {
    seedSubsidiary(SUB_EU, "EU Frankfurt");
    seedLead("lead_1", SUB_EU);
    await act(async () => { renderPage(adminSession); });

    await waitFor(() => expect(screen.getByText("EU Frankfurt")).toBeInTheDocument());
    expect(screen.getByText(/Tenant admin · Whole tenant \(roll-up\)/)).toBeInTheDocument();
    expect(screen.queryByText(/tenant_admin · tnt_a/)).not.toBeInTheDocument();
  });
});
