// @vitest-environment jsdom
//
// E1-S2 UI-fidelity specs (correct-course DEC-CC-5). These pin the prototype
// (`prototype/app/tenancy.jsx` SubsidiariesPage/OnboardForm/OutcomePicker) so the
// onboard surface matches the UI source of truth. Kept separate from the existing
// SubsidiariesPage.test.tsx so the behavioral suite is untouched.

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { render, screen, fireEvent, cleanup, waitFor } from "@testing-library/react";
import { LocalStorageRepository } from "../../shared/data/LocalStorageRepository";
import type { Subsidiary } from "../../shared/domain/tenant.types";
import type { SessionClaims, AuthContextValue } from "../../shared/auth/auth.types";
import type { ID } from "../../shared/domain/types";
import { __resetBus } from "../../shared/events/bus";
import { __resetAuditLog } from "../../shared/events/auditLog";
import { SUBSIDIARY_CONFIG } from "./subsidiaryConfig";
import { SubsidiariesPage } from "./SubsidiariesPage";
import { AuthContext } from "../../shared/auth/authContext";

// Mock the toast module so we can assert the rollback toast title (the fault path
// fires it via setTimeout). OnboardForm/OffboardDialog only use `pushToast`.
vi.mock("../../shared/ui/components/Toast", () => ({ pushToast: vi.fn() }));
import { pushToast } from "../../shared/ui/components/Toast";

const TENANT_A: ID = "tnt_a";
const adminSession: SessionClaims = {
  userId: "usr_admin" as ID,
  tenantId: TENANT_A,
  subsidiaryId: null,
  roles: ["tenant_admin"],
  exp: "2099-12-31T23:59:59.000Z",
};

function makeAuthValue(session: SessionClaims | null): AuthContextValue {
  return { session, isAuthenticated: session !== null, signIn: vi.fn(), signOut: vi.fn(), setSubsidiaryScope: vi.fn() };
}
function makeRepo(): LocalStorageRepository<Subsidiary> {
  return new LocalStorageRepository<Subsidiary>(SUBSIDIARY_CONFIG, adminSession);
}
function renderPage(repo = makeRepo()) {
  return render(
    <AuthContext.Provider value={makeAuthValue(adminSession)}>
      <SubsidiariesPage repo={repo} />
    </AuthContext.Provider>,
  );
}

beforeEach(() => {
  localStorage.clear();
  __resetBus();
  __resetAuditLog();
  vi.mocked(pushToast).mockClear();
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe("E1-S2 fidelity — Subsidiaries list (DEC-CC-5)", () => {
  it("empty state shows the `network` icon and the 'Northwind Trading' scope line", async () => {
    const { container } = renderPage();
    await screen.findByText("No subsidiaries yet");
    // scope-framed line (§8.7) plumbed through DataTable.EmptyConfig
    expect(screen.getByText("Northwind Trading")).toBeInTheDocument();
    // network icon (lucide renders `.lucide-network`), not the default inbox
    expect(container.querySelector(".lucide-network")).toBeTruthy();
    expect(container.querySelector(".lucide-inbox")).toBeNull();
  });

  it("page subtitle includes the offboarding sentence", async () => {
    renderPage();
    expect(
      await screen.findByText(/Offboarding reassigns active records before a subsidiary leaves\./),
    ).toBeInTheDocument();
  });

  it("Created column renders the 'D MMM YYYY' form (no locale slashes)", async () => {
    const repo = makeRepo();
    await repo.create({ name: "Seeded Sub", parentSubsidiaryId: null });
    renderPage(repo);
    await screen.findByText("Seeded Sub");
    // e.g. "8 Jun 2026" — not "6/8/2026". Month group is 2-3 letters: en-GB short
    // months are 3 chars EXCEPT September → "Sept" (4 chars in modern ICU), so allow {2,3}.
    const cell = await screen.findByText(/^\d{1,2} [A-Z][a-z]{2,3} \d{4}$/);
    expect(cell.textContent).not.toContain("/");
  });
});

describe("E1-S2 fidelity — OnboardForm (DEC-CC-5)", () => {
  function openForm() {
    renderPage();
    fireEvent.click(screen.getByTestId("onboard-btn"));
  }

  it("OutcomePicker shows the flask-conical icon and the 'Simulate server response' label", () => {
    openForm();
    const dialog = screen.getByRole("dialog");
    expect(dialog.querySelector(".lucide-flask-conical")).toBeTruthy();
    expect(screen.getByText("Simulate server response")).toBeInTheDocument();
    // segmented Success / Server error options remain
    expect(screen.getByTestId("outcome-success")).toBeInTheDocument();
    expect(screen.getByTestId("outcome-fail")).toBeInTheDocument();
  });

  it("rollback fires a danger toast titled 'Couldn't onboard — rolled back.' (trailing period)", async () => {
    openForm();
    fireEvent.click(screen.getByTestId("outcome-fail"));
    const dialog = screen.getByRole("dialog");
    fireEvent.change(screen.getByTestId("sub-name"), { target: { value: "Doomed Sub" } });
    fireEvent.click(dialog.querySelector('button[type="submit"]') as HTMLButtonElement);

    await waitFor(
      () =>
        expect(pushToast).toHaveBeenCalledWith(
          expect.objectContaining({ tone: "danger", title: "Couldn't onboard — rolled back." }),
        ),
      { timeout: 2000 },
    );
  });
});
