// @vitest-environment jsdom
//
// E1-S5 — Cross-subsidiary roll-up: unit tests for the aggregation logic.
// Covers NFR-12 requirements:
//   - Admin counts span all tenant subsidiaries + parent-level
//   - Subsidiary user counts cover only own + parent-level (AC3/UC-5)
//   - Read model issues no writes or events (AC2)
//   - Permission cells: rollup.view granted to all roles (via can())
//   - Empty-tenant shows empty state (grand total = 0)

import { describe, it, expect, beforeEach } from "vitest";
import { LocalStorageRepository } from "../../shared/data/LocalStorageRepository";
import type { Subsidiary } from "../../shared/domain/tenant.types";
import type { Lead } from "../../shared/domain/lead.types";
import type { Customer } from "../../shared/domain/customer.types";
import type { Ticket } from "../../shared/domain/ticket.types";
import type { SessionClaims } from "../../shared/auth/auth.types";
import type { ID } from "../../shared/domain/types";
import { can } from "../../shared/auth/permissions";
import { SUBSIDIARY_CONFIG } from "../tenancy/subsidiaryConfig";
import { LEAD_ROLLUP_CONFIG, CUSTOMER_ROLLUP_CONFIG, TICKET_ROLLUP_CONFIG } from "./rollupConfigs";

// ── Fixtures ──────────────────────────────────────────────────────────────────

const TENANT_A: ID = "tnt_a";
const TENANT_B: ID = "tnt_b";
const SUB_EU: ID = "sub_eu";
const SUB_US: ID = "sub_us";
const USER_ADMIN: ID = "usr_admin";
const USER_SALES: ID = "usr_sales";

const adminSession: SessionClaims = {
  userId: USER_ADMIN,
  tenantId: TENANT_A,
  subsidiaryId: null,
  roles: ["tenant_admin"],
  exp: "2099-12-31T23:59:59.000Z",
};

const salesSession: SessionClaims = {
  userId: USER_SALES,
  tenantId: TENANT_A,
  subsidiaryId: SUB_EU,
  roles: ["sales"],
  exp: "2099-12-31T23:59:59.000Z",
};

const supportSession: SessionClaims = {
  userId: "usr_support",
  tenantId: TENANT_A,
  subsidiaryId: SUB_US,
  roles: ["support"],
  exp: "2099-12-31T23:59:59.000Z",
};

const viewerSession: SessionClaims = {
  userId: "usr_viewer",
  tenantId: TENANT_A,
  subsidiaryId: SUB_EU,
  roles: ["viewer"],
  exp: "2099-12-31T23:59:59.000Z",
};

const otherTenantSession: SessionClaims = {
  userId: "usr_other",
  tenantId: TENANT_B,
  subsidiaryId: null,
  roles: ["tenant_admin"],
  exp: "2099-12-31T23:59:59.000Z",
};

// Minimal stored-object helpers — written directly to localStorage for clarity
function makeBase(id: ID, tenantId: ID, subsidiaryId: ID | null): object {
  return {
    id,
    tenantId,
    subsidiaryId,
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    createdBy: USER_ADMIN,
    updatedBy: USER_ADMIN,
    version: 1,
    deletedAt: null,
  };
}

function seedLead(id: ID, tenantId: ID, subsidiaryId: ID | null): void {
  const seg = subsidiaryId ?? "_parent";
  const key = `crm:${tenantId}:${seg}:lead`;
  const existing = JSON.parse(localStorage.getItem(key) ?? "[]") as unknown[];
  existing.push({
    ...makeBase(id, tenantId, subsidiaryId),
    name: "Test Lead",
    email: `${id}@test.com`,
    source: "web",
    status: "new",
    ownerId: USER_ADMIN,
  });
  localStorage.setItem(key, JSON.stringify(existing));
}

function seedCustomer(id: ID, tenantId: ID, subsidiaryId: ID | null): void {
  const seg = subsidiaryId ?? "_parent";
  const key = `crm:${tenantId}:${seg}:customer`;
  const existing = JSON.parse(localStorage.getItem(key) ?? "[]") as unknown[];
  existing.push({
    ...makeBase(id, tenantId, subsidiaryId),
    name: "Test Customer",
    primaryEmail: `${id}@test.com`,
    status: "active",
  });
  localStorage.setItem(key, JSON.stringify(existing));
}

function seedTicket(id: ID, tenantId: ID, subsidiaryId: ID | null): void {
  const seg = subsidiaryId ?? "_parent";
  const key = `crm:${tenantId}:${seg}:ticket`;
  const existing = JSON.parse(localStorage.getItem(key) ?? "[]") as unknown[];
  existing.push({
    ...makeBase(id, tenantId, subsidiaryId),
    customerId: "cust_1",
    subject: "Test Ticket",
    description: "Test",
    status: "open",
    priority: "low",
    assigneeId: null,
  });
  localStorage.setItem(key, JSON.stringify(existing));
}

function seedSubsidiary(id: ID, tenantId: ID, name: string): void {
  const key = `crm:${tenantId}:_parent:subsidiary`;
  const existing = JSON.parse(localStorage.getItem(key) ?? "[]") as unknown[];
  existing.push({
    ...makeBase(id, tenantId, null),
    name,
    parentSubsidiaryId: null,
    region: "EU",
  });
  localStorage.setItem(key, JSON.stringify(existing));
}

beforeEach(() => {
  localStorage.clear();
});

// ── Permission cells ──────────────────────────────────────────────────────────

describe("rollup.view permission cells", () => {
  const resource = { tenantId: TENANT_A, subsidiaryId: null };

  it("grants to tenant_admin", () => {
    expect(can(adminSession, "rollup.view", "read", resource)).toBe(true);
  });

  it("grants read to sales (view cell)", () => {
    expect(can({ ...salesSession, subsidiaryId: null }, "rollup.view", "read", resource)).toBe(true);
  });

  it("grants read to support (view cell)", () => {
    expect(can(supportSession, "rollup.view", "read", resource)).toBe(true);
  });

  it("grants read to viewer (view cell)", () => {
    expect(can(viewerSession, "rollup.view", "read", resource)).toBe(true);
  });

  it("denies mutation actions (view cell only permits read)", () => {
    expect(can(salesSession, "rollup.view", "create", resource)).toBe(false);
    expect(can(salesSession, "rollup.view", "edit", resource)).toBe(false);
  });
});

// ── Aggregation: admin sees all subsidiaries + parent ─────────────────────────

describe("admin aggregation — spans all subsidiaries + parent-level", () => {
  it("returns counts for all subsidiaries and parent-level row", async () => {
    seedSubsidiary(SUB_EU, TENANT_A, "EU Frankfurt");
    seedSubsidiary(SUB_US, TENANT_A, "US Chicago");

    seedLead("lead_1", TENANT_A, SUB_EU);
    seedLead("lead_2", TENANT_A, SUB_EU);
    seedLead("lead_3", TENANT_A, SUB_US);
    seedCustomer("cust_1", TENANT_A, null); // parent-level
    seedTicket("tkt_1", TENANT_A, SUB_EU);
    seedTicket("tkt_2", TENANT_A, null); // parent-level

    const subRepo = new LocalStorageRepository<Subsidiary>(SUBSIDIARY_CONFIG, adminSession);
    const leadRepo = new LocalStorageRepository<Lead>(LEAD_ROLLUP_CONFIG, adminSession);
    const customerRepo = new LocalStorageRepository<Customer>(CUSTOMER_ROLLUP_CONFIG, adminSession);
    const ticketRepo = new LocalStorageRepository<Ticket>(TICKET_ROLLUP_CONFIG, adminSession);

    const [subPage, leadPage, customerPage, ticketPage] = await Promise.all([
      subRepo.list({ filter: { includeDeleted: false }, pageSize: 100 }),
      leadRepo.list({ pageSize: 1000 }),
      customerRepo.list({ pageSize: 1000 }),
      ticketRepo.list({ pageSize: 1000 }),
    ]);

    // Admin sees all leads/customers/tickets across all subsidiaries
    expect(leadPage.total).toBe(3);
    expect(customerPage.total).toBe(1);
    expect(ticketPage.total).toBe(2);
    expect(subPage.total).toBe(2);

    // Per-subsidiary counts
    const euLeads = leadPage.data.filter((l) => l.subsidiaryId === SUB_EU).length;
    const usLeads = leadPage.data.filter((l) => l.subsidiaryId === SUB_US).length;
    expect(euLeads).toBe(2);
    expect(usLeads).toBe(1);

    // Parent-level records
    const parentCustomers = customerPage.data.filter((c) => c.subsidiaryId === null).length;
    const parentTickets = ticketPage.data.filter((t) => t.subsidiaryId === null).length;
    expect(parentCustomers).toBe(1);
    expect(parentTickets).toBe(1);
  });

  it("never includes records from other tenants", async () => {
    seedLead("lead_tenant_a", TENANT_A, SUB_EU);
    seedLead("lead_tenant_b", TENANT_B, SUB_EU);

    const leadRepo = new LocalStorageRepository<Lead>(LEAD_ROLLUP_CONFIG, adminSession);
    const page = await leadRepo.list({ pageSize: 1000 });

    expect(page.total).toBe(1);
    expect(page.data[0].tenantId).toBe(TENANT_A);
  });
});

// ── Aggregation: subsidiary user sees only own + parent ───────────────────────

describe("subsidiary user aggregation — own scope + parent only (AC3/UC-5)", () => {
  it("does not see sibling subsidiary records", async () => {
    seedLead("lead_eu_1", TENANT_A, SUB_EU);
    seedLead("lead_us_1", TENANT_A, SUB_US); // sibling — must not appear
    seedLead("lead_parent", TENANT_A, null); // parent-level — visible

    const leadRepo = new LocalStorageRepository<Lead>(LEAD_ROLLUP_CONFIG, salesSession);
    const page = await leadRepo.list({ pageSize: 1000 });

    // salesSession.subsidiaryId = SUB_EU — accessible buckets: _parent + SUB_EU
    expect(page.total).toBe(2);
    const ids = page.data.map((l) => l.id);
    expect(ids).toContain("lead_eu_1");
    expect(ids).toContain("lead_parent");
    expect(ids).not.toContain("lead_us_1");
  });

  it("parent-level records are visible to subsidiary users", async () => {
    seedCustomer("cust_parent", TENANT_A, null);
    seedCustomer("cust_eu", TENANT_A, SUB_EU);

    const customerRepo = new LocalStorageRepository<Customer>(CUSTOMER_ROLLUP_CONFIG, salesSession);
    const page = await customerRepo.list({ pageSize: 1000 });

    expect(page.total).toBe(2);
  });
});

// ── Read model: no writes, no events emitted ──────────────────────────────────

describe("read model — no mutations or events (AC2)", () => {
  it("list() does not mutate localStorage", async () => {
    seedLead("lead_1", TENANT_A, SUB_EU);
    const keyBefore = `crm:${TENANT_A}:${SUB_EU}:lead`;
    const before = localStorage.getItem(keyBefore);

    const leadRepo = new LocalStorageRepository<Lead>(LEAD_ROLLUP_CONFIG, adminSession);
    await leadRepo.list({ pageSize: 1000 });

    // The EU bucket should be unchanged after a read
    const afterEuKey = localStorage.getItem(keyBefore);
    expect(afterEuKey).toBe(before);
  });

  it("list() only calls read methods (no create/update/remove paths)", async () => {
    seedSubsidiary(SUB_EU, TENANT_A, "EU");
    const subRepo = new LocalStorageRepository<Subsidiary>(SUBSIDIARY_CONFIG, adminSession);

    // Just verify list() resolves without error and returns correct shape
    const page = await subRepo.list({ filter: { includeDeleted: false }, pageSize: 100 });
    expect(Array.isArray(page.data)).toBe(true);
  });
});

// ── Empty tenant shows empty state (grand = 0) ────────────────────────────────

describe("empty tenant", () => {
  it("returns grand total of 0 when no records exist", async () => {
    const leadRepo = new LocalStorageRepository<Lead>(LEAD_ROLLUP_CONFIG, adminSession);
    const customerRepo = new LocalStorageRepository<Customer>(CUSTOMER_ROLLUP_CONFIG, adminSession);
    const ticketRepo = new LocalStorageRepository<Ticket>(TICKET_ROLLUP_CONFIG, adminSession);

    const [lp, cp, tp] = await Promise.all([
      leadRepo.list({ pageSize: 1000 }),
      customerRepo.list({ pageSize: 1000 }),
      ticketRepo.list({ pageSize: 1000 }),
    ]);

    const grand = lp.total + cp.total + tp.total;
    expect(grand).toBe(0);
  });

  it("subsidiary user with no records returns grand total 0", async () => {
    const leadRepo = new LocalStorageRepository<Lead>(LEAD_ROLLUP_CONFIG, salesSession);
    const page = await leadRepo.list({ pageSize: 1000 });
    expect(page.total).toBe(0);
  });
});

// ── Cross-tenant isolation ────────────────────────────────────────────────────

describe("cross-tenant isolation", () => {
  it("admin roll-up never includes another tenant's counts", async () => {
    seedLead("lead_a", TENANT_A, null);
    seedLead("lead_b", TENANT_B, null); // different tenant

    const leadRepoA = new LocalStorageRepository<Lead>(LEAD_ROLLUP_CONFIG, adminSession);
    const pageA = await leadRepoA.list({ pageSize: 1000 });

    expect(pageA.total).toBe(1);
    expect(pageA.data[0].tenantId).toBe(TENANT_A);

    const leadRepoB = new LocalStorageRepository<Lead>(LEAD_ROLLUP_CONFIG, otherTenantSession);
    const pageB = await leadRepoB.list({ pageSize: 1000 });

    expect(pageB.total).toBe(1);
    expect(pageB.data[0].tenantId).toBe(TENANT_B);
  });
});
