// @vitest-environment jsdom
//
// E1-S3 fidelity specs (correct-course DEC-CC-5). Pins the prototype
// (`prototype/app/tenancy.jsx` OffboardDialog + `store.jsx` commitOffboard) and the
// owner-re-scope ruling (2026-06-08): the offboard saga moves only `subsidiaryId` and
// PRESERVES each record's existing owner/assignee — it must NOT reassign orphans to the
// acting admin. (The prototype's per-subsidiary people roster has no app equivalent.)

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { render, screen, fireEvent, cleanup, waitFor } from "@testing-library/react";
import { LocalStorageRepository } from "../../shared/data/LocalStorageRepository";
import { LEAD_CONFIG } from "../leads/leadConfig";
import { TICKET_CONFIG } from "../tickets/ticketConfig";
import type { Subsidiary } from "../../shared/domain/tenant.types";
import type { Lead } from "../../shared/domain/lead.types";
import type { Ticket } from "../../shared/domain/ticket.types";
import type { SessionClaims, AuthContextValue } from "../../shared/auth/auth.types";
import type { ID } from "../../shared/domain/types";
import { __resetBus } from "../../shared/events/bus";
import { __resetAuditLog } from "../../shared/events/auditLog";
import { OffboardDialog } from "./OffboardDialog";
import { AuthContext } from "../../shared/auth/authContext";

vi.mock("../../shared/ui/components/Toast", () => ({ pushToast: vi.fn() }));

const TENANT_A: ID = "tnt_a";
const USER_ADMIN: ID = "usr_admin";
const OWNER_MARCO: ID = "usr_marco";
const ASSIGNEE_LENA: ID = "usr_lena";

const adminSession: SessionClaims = {
  userId: USER_ADMIN,
  tenantId: TENANT_A,
  subsidiaryId: null,
  roles: ["tenant_admin"],
  exp: "2099-12-31T23:59:59.000Z",
};

function makeAuthValue(session: SessionClaims): AuthContextValue {
  return { session, isAuthenticated: true, signIn: vi.fn(), signOut: vi.fn(), setSubsidiaryScope: vi.fn() };
}

function makeSub(id: ID, name: string): Subsidiary {
  return {
    id, tenantId: TENANT_A, subsidiaryId: null, name, parentSubsidiaryId: null, region: "EU",
    createdAt: "2026-01-01T00:00:00.000Z", updatedAt: "2026-01-01T00:00:00.000Z",
    createdBy: USER_ADMIN, updatedBy: USER_ADMIN, version: 1, deletedAt: null,
  };
}

beforeEach(() => {
  localStorage.clear();
  __resetBus();
  __resetAuditLog();
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe("E1-S3 fidelity — offboard preserves owner/assignee (DEC-CC-5 ruling)", () => {
  it("reassigns active records to the target WITHOUT overwriting ownerId/assigneeId", async () => {
    const subX = makeSub("sub_x" as ID, "EU / Frankfurt");
    const subY = makeSub("sub_y" as ID, "US / Chicago");

    // Seed one active lead (owner=Marco) and one active ticket (assignee=Lena) in sub_x.
    const xSession: SessionClaims = { ...adminSession, subsidiaryId: subX.id };
    await new LocalStorageRepository<Lead>(LEAD_CONFIG, xSession).create({
      name: "EU Lead", email: "eu@x.com", source: "web", status: "new", ownerId: OWNER_MARCO,
    });
    await new LocalStorageRepository<Ticket>(TICKET_CONFIG, xSession).create({
      customerId: "cust_x" as ID, subject: "EU Ticket", description: "d", status: "open",
      priority: "medium", assigneeId: ASSIGNEE_LENA,
    });

    // Spy on the real reassign (keep original behavior so the saga completes).
    const reassignSpy = vi.spyOn(LocalStorageRepository.prototype, "reassign");

    render(
      <AuthContext.Provider value={makeAuthValue(adminSession)}>
        <OffboardDialog
          sub={subX}
          activeSubs={[subX, subY]}
          session={adminSession}
          onClose={vi.fn()}
          onOffboarded={vi.fn()}
        />
      </AuthContext.Provider>,
    );

    // Wait for impact to load (2 active records), choose target sub_y, confirm.
    await waitFor(() => expect(screen.getByTestId("impact-leads").textContent).toContain("1"));
    fireEvent.change(screen.getByRole("combobox"), { target: { value: subY.id } });
    fireEvent.click(screen.getByTestId("offboard-confirm"));

    // Saga runs (tick → finish). Wait for both records to be reassigned.
    await waitFor(() => expect(reassignSpy).toHaveBeenCalledTimes(2), { timeout: 3000 });

    // Every reassign patch (3rd arg) must be empty — owner/assignee preserved, never the admin.
    for (const call of reassignSpy.mock.calls) {
      const patch = call[2] as Record<string, unknown>;
      expect(patch).not.toHaveProperty("ownerId");
      expect(patch).not.toHaveProperty("assigneeId");
    }
  });

  it("impact stat cards use the --iso-blue-3-50 token (not --iso-brand-soft)", async () => {
    const subX = makeSub("sub_x" as ID, "EU / Frankfurt");
    render(
      <AuthContext.Provider value={makeAuthValue(adminSession)}>
        <OffboardDialog sub={subX} activeSubs={[subX]} session={adminSession} onClose={vi.fn()} onOffboarded={vi.fn()} />
      </AuthContext.Provider>,
    );
    const card = await screen.findByTestId("impact-leads");
    expect(card.style.background).toContain("--iso-blue-3-50");
  });
});
