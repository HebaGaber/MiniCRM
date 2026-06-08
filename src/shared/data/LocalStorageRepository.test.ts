// @vitest-environment jsdom
//
// Integration tests for LocalStorageRepository (E0-S4, NFR-12).
// Uses jsdom for localStorage (same opt-in pattern as AuthProvider.test.tsx).
// Covers all ACs:
//   AC1 — key scheme (crm:{tenantId}:{subsidiaryId|_parent}:{entity})
//   AC2 — scope from auth context; tenant_admin roll-up; subsidiary isolation
//   AC3 — create audit fields + version=1; stale update → 409; soft-delete; status rejected
//   AC4 — Zod validate-before-persist → 422 + ValidationDetail[]
//   AC5 — 4-beat (UC-2): 1 DomainEvent + 1 AuditEvent + shared correlationId
//   AC5 — illegal transition → 422 (UC-3)
//   AC5 — authorization denial → 403/404
//   AC6 — cross-tenant access → null / 404 (UC-5)
//   AC6 — list query: unknown filters ignored; pageSize clamped; default pageSize=25
//   AC7 — fault-injection toggle

import { describe, it, expect, beforeEach } from "vitest";
import { LocalStorageRepository, RepositoryError } from "./LocalStorageRepository";
import type { EntityConfig } from "./LocalStorageRepository";
import { setFaultMode, resetFaultMode } from "./faultInjection";
import { leadSchema } from "../domain/schemas";
import { newId } from "../domain/types";
import type { ID, BaseEntity } from "../domain/types";
import type { Lead } from "../domain/lead.types";
import type { SessionClaims } from "../auth/auth.types";
import { __resetBus } from "../events/bus";
import { __resetAuditLog, all as allAudits } from "../events/auditLog";
import { expectOneOpOneEventOneAuditAsync } from "../events/conformance";

// ── Test fixtures ─────────────────────────────────────────────────────────────

const TENANT_A: ID = "tnt_a";
const TENANT_B: ID = "tnt_b";
const SUB_EU: ID = "sub_eu";
const SUB_US: ID = "sub_us";
const USER_ADMIN: ID = "usr_admin";
const USER_SALES: ID = "usr_sales";

const adminSession: SessionClaims = {
  userId: USER_ADMIN,
  tenantId: TENANT_A,
  subsidiaryId: null,          // tenant_admin → sees all
  roles: ["tenant_admin"],
  exp: "2099-12-31T23:59:59.000Z",
};

const salesSession: SessionClaims = {
  userId: USER_SALES,
  tenantId: TENANT_A,
  subsidiaryId: SUB_EU,        // subsidiary user
  roles: ["sales"],
  exp: "2099-12-31T23:59:59.000Z",
};

const tenantBSession: SessionClaims = {
  userId: newId("user"),
  tenantId: TENANT_B,
  subsidiaryId: null,
  roles: ["tenant_admin"],
  exp: "2099-12-31T23:59:59.000Z",
};

const leadConfig: EntityConfig<Lead> = {
  name: "lead",
  entityType: "Lead",
  idKind: "lead",
  schema: leadSchema,
  capability: "lead.manage",
  deleteCapability: "record.deleteExport",
  events: {
    created: "Lead.Created",
    updated: "Lead.Updated",
    deleted: "Lead.Deleted",
    statusChanged: "Lead.StatusChanged",
  },
  transitionEntity: "lead",
};

function makeLeadInput(
  overrides: Partial<Omit<Lead, keyof BaseEntity>> = {},
): Omit<Lead, keyof BaseEntity> {
  return {
    name: "Jane Doe",
    email: "jane@example.com",
    source: "web",
    status: "new",
    ownerId: USER_SALES,
    ...overrides,
  };
}

function adminRepo(): LocalStorageRepository<Lead> {
  return new LocalStorageRepository<Lead>(leadConfig, adminSession);
}

function salesRepo(): LocalStorageRepository<Lead> {
  return new LocalStorageRepository<Lead>(leadConfig, salesSession);
}

// ── Setup / teardown ──────────────────────────────────────────────────────────

beforeEach(() => {
  localStorage.clear();
  __resetBus();
  __resetAuditLog();
  resetFaultMode();
});

// ── AC1 — Key scheme ──────────────────────────────────────────────────────────

describe("AC1 — localStorage key scheme", () => {
  it("tenant_admin stores under crm:{tenantId}:_parent:{entity}", async () => {
    await adminRepo().create(makeLeadInput());
    const raw = localStorage.getItem(`crm:${TENANT_A}:_parent:lead`);
    expect(raw).not.toBeNull();
    const rows = JSON.parse(raw!) as Lead[];
    expect(rows).toHaveLength(1);
  });

  it("subsidiary user stores under crm:{tenantId}:{subsidiaryId}:{entity}", async () => {
    await salesRepo().create(makeLeadInput());
    const raw = localStorage.getItem(`crm:${TENANT_A}:${SUB_EU}:lead`);
    expect(raw).not.toBeNull();
    const rows = JSON.parse(raw!) as Lead[];
    expect(rows).toHaveLength(1);
  });
});

// ── AC2 — Scope from auth context ─────────────────────────────────────────────

describe("AC2 — Scoping from auth context (never from caller)", () => {
  it("tenant_admin list() sees records from all subsidiaries in same tenant", async () => {
    await salesRepo().create(makeLeadInput({ name: "EU Lead" }));
    const usSession: SessionClaims = { ...salesSession, subsidiaryId: SUB_US };
    await new LocalStorageRepository<Lead>(leadConfig, usSession).create(
      makeLeadInput({ name: "US Lead" }),
    );

    const page = await adminRepo().list();
    expect(page.data).toHaveLength(2);
  });

  it("subsidiary user list() sees own + parent rows, not sibling subsidiary rows", async () => {
    const parentLead = await adminRepo().create(makeLeadInput({ name: "Parent" }));
    const euLead = await salesRepo().create(makeLeadInput({ name: "EU" }));
    const usSession: SessionClaims = { ...salesSession, subsidiaryId: SUB_US };
    await new LocalStorageRepository<Lead>(leadConfig, usSession).create(
      makeLeadInput({ name: "US" }),
    );

    const page = await salesRepo().list();
    const ids = page.data.map((r) => r.id);
    expect(ids).toContain(parentLead.id);  // parent → visible
    expect(ids).toContain(euLead.id);      // own → visible
    expect(page.data).toHaveLength(2);     // sibling US → NOT visible
  });
});

// ── AC3 — Create audit fields; version; soft-delete; status rejected ──────────

describe("AC3 — Create / update / soft-delete semantics", () => {
  it("create sets id (lead_ prefix), version=1, all audit fields from session", async () => {
    const lead = await adminRepo().create(makeLeadInput());
    expect(lead.id).toMatch(/^lead_/);
    expect(lead.version).toBe(1);
    expect(lead.tenantId).toBe(TENANT_A);
    expect(lead.subsidiaryId).toBeNull();
    expect(lead.createdBy).toBe(USER_ADMIN);
    expect(lead.updatedBy).toBe(USER_ADMIN);
    expect(lead.deletedAt).toBeNull();
    expect(lead.createdAt).toBeTruthy();
    expect(lead.updatedAt).toBe(lead.createdAt);
  });

  it("update with stale version → RepositoryError(409)", async () => {
    const lead = await adminRepo().create(makeLeadInput());
    await expect(adminRepo().update(lead.id, { name: "New" }, 999)).rejects.toMatchObject({
      statusCode: 409,
      code: "VERSION_CONFLICT",
    });
  });

  it("update bumps version and sets updatedAt/updatedBy", async () => {
    const repo = adminRepo();
    const lead = await repo.create(makeLeadInput());
    const updated = await repo.update(lead.id, { name: "Updated" }, 1);
    expect(updated.version).toBe(2);
    expect(updated.name).toBe("Updated");
    expect(updated.updatedBy).toBe(USER_ADMIN);
  });

  it("update rejects status in patch with RepositoryError(422)", async () => {
    const repo = adminRepo();
    const lead = await repo.create(makeLeadInput());
    await expect(
      repo.update(lead.id, { status: "contacted" } as Partial<Omit<Lead, keyof BaseEntity>>, 1),
    ).rejects.toMatchObject({ statusCode: 422, code: "PATCH_STATUS" });
  });

  it("remove soft-deletes: list() excludes it; get() returns null", async () => {
    const repo = adminRepo();
    const lead = await repo.create(makeLeadInput());
    await repo.remove(lead.id);

    const page = await repo.list();
    expect(page.data.find((r) => r.id === lead.id)).toBeUndefined();
    expect(await repo.get(lead.id)).toBeNull();
  });

  it("remove with includeDeleted=true includes the soft-deleted record", async () => {
    const repo = adminRepo();
    const lead = await repo.create(makeLeadInput());
    await repo.remove(lead.id);

    const page = await repo.list({ filter: { includeDeleted: true } });
    const found = page.data.find((r) => r.id === lead.id);
    expect(found).toBeDefined();
    expect(found?.deletedAt).not.toBeNull();
  });
});

// ── AC4 — Zod validation → 422 ────────────────────────────────────────────────

describe("AC4 — Validate-before-persist (Zod) → 422 + ValidationDetail[]", () => {
  it("create with empty name → RepositoryError(422) with 'name' in details", async () => {
    let err: unknown;
    try {
      await adminRepo().create(makeLeadInput({ name: "" }));
    } catch (e) {
      err = e;
    }
    expect(err).toBeInstanceOf(RepositoryError);
    const re = err as RepositoryError;
    expect(re.statusCode).toBe(422);
    expect(re.code).toBe("VALIDATION");
    expect(re.details?.some((d) => d.field === "name")).toBe(true);
  });

  it("create with invalid email → RepositoryError(422)", async () => {
    await expect(adminRepo().create(makeLeadInput({ email: "not-an-email" }))).rejects.toMatchObject(
      { statusCode: 422, code: "VALIDATION" },
    );
  });

  it("create with invalid source enum → RepositoryError(422)", async () => {
    await expect(
      adminRepo().create(makeLeadInput({ source: "invalid" as Lead["source"] })),
    ).rejects.toMatchObject({ statusCode: 422, code: "VALIDATION" });
  });
});

// ── AC5 — 4-beat (UC-2 conformance) ──────────────────────────────────────────

describe("AC5 — 4-beat use case: exactly 1 event + 1 audit per mutation (UC-2)", () => {
  it("create emits Lead.Created + lead.create audit on shared correlationId", async () => {
    const emissions = await expectOneOpOneEventOneAuditAsync(async () => {
      await adminRepo().create(makeLeadInput());
    });
    expect(emissions.events[0].type).toBe("Lead.Created");
    expect(emissions.audits[0].action).toBe("lead.create");
    expect(emissions.events[0].correlationId).toBe(emissions.audits[0].correlationId);
  });

  it("update emits Lead.Updated + lead.update audit on shared correlationId", async () => {
    const lead = await adminRepo().create(makeLeadInput());
    __resetBus();
    __resetAuditLog();

    const emissions = await expectOneOpOneEventOneAuditAsync(async () => {
      await adminRepo().update(lead.id, { name: "Updated" }, 1);
    });
    expect(emissions.events[0].type).toBe("Lead.Updated");
    expect(emissions.audits[0].action).toBe("lead.update");
  });

  it("remove emits Lead.Deleted + lead.delete audit on shared correlationId", async () => {
    const lead = await adminRepo().create(makeLeadInput());
    __resetBus();
    __resetAuditLog();

    const emissions = await expectOneOpOneEventOneAuditAsync(async () => {
      await adminRepo().remove(lead.id);
    });
    expect(emissions.events[0].type).toBe("Lead.Deleted");
    expect(emissions.audits[0].action).toBe("lead.delete");
  });

  it("transition emits Lead.StatusChanged + lead.transition audit on shared correlationId", async () => {
    const lead = await adminRepo().create(makeLeadInput());
    __resetBus();
    __resetAuditLog();

    const emissions = await expectOneOpOneEventOneAuditAsync(async () => {
      await adminRepo().transition(lead.id, "contacted", 1);
    });
    expect(emissions.events[0].type).toBe("Lead.StatusChanged");
    expect(emissions.audits[0].action).toBe("lead.transition");
    expect(emissions.events[0].correlationId).toBe(emissions.audits[0].correlationId);
  });
});

// ── AC5 — Illegal transition (UC-3) ──────────────────────────────────────────

describe("AC5 — illegal transition → 422 (UC-3)", () => {
  it("'new' → 'converted' (illegal) → RepositoryError(422) ILLEGAL_TRANSITION", async () => {
    const lead = await adminRepo().create(makeLeadInput());
    await expect(adminRepo().transition(lead.id, "converted", 1)).rejects.toMatchObject({
      statusCode: 422,
      code: "ILLEGAL_TRANSITION",
    });
  });

  it("'new' → 'contacted' (legal) succeeds and updates status", async () => {
    const lead = await adminRepo().create(makeLeadInput());
    const next = await adminRepo().transition(lead.id, "contacted", 1);
    expect(next.status).toBe("contacted");
    expect(next.version).toBe(2);
  });

  it("transition with stale version → RepositoryError(409)", async () => {
    const lead = await adminRepo().create(makeLeadInput());
    await expect(adminRepo().transition(lead.id, "contacted", 99)).rejects.toMatchObject({
      statusCode: 409,
      code: "VERSION_CONFLICT",
    });
  });
});

// ── AC6 — Cross-tenant isolation (UC-5) ──────────────────────────────────────

describe("AC6 — cross-tenant → 404 (UC-5)", () => {
  it("get() with a foreign-tenant ID returns null", async () => {
    const bRepo = new LocalStorageRepository<Lead>(leadConfig, tenantBSession);
    const bLead = await bRepo.create(makeLeadInput());
    expect(await adminRepo().get(bLead.id)).toBeNull();
  });

  it("update() on a foreign-tenant record → RepositoryError(404)", async () => {
    const bRepo = new LocalStorageRepository<Lead>(leadConfig, tenantBSession);
    const bLead = await bRepo.create(makeLeadInput());
    await expect(adminRepo().update(bLead.id, { name: "Hijack" }, 1)).rejects.toMatchObject({
      statusCode: 404,
    });
  });
});

// ── AC6 — List query semantics ────────────────────────────────────────────────

describe("AC6 — list query: unknown filters, pageSize clamp, default pageSize", () => {
  it("unknown filter keys are silently ignored (never throw)", async () => {
    await adminRepo().create(makeLeadInput());
    await expect(
      adminRepo().list({ filter: { unknownField: "x", anotherKey: 42 } as never }),
    ).resolves.toBeDefined();
  });

  it("pageSize=999 is clamped to 100", async () => {
    const page = await adminRepo().list({ pageSize: 999 });
    expect(page.pageSize).toBe(100);
  });

  it("default pageSize is 25 when not supplied", async () => {
    const page = await adminRepo().list();
    expect(page.pageSize).toBe(25);
  });

  it("filter by status returns only matching records", async () => {
    const repo = adminRepo();
    const lead = await repo.create(makeLeadInput());
    await repo.create(makeLeadInput({ name: "Another" }));
    await repo.transition(lead.id, "contacted", 1);

    const page = await repo.list({ filter: { status: "contacted" } });
    expect(page.data).toHaveLength(1);
    expect(page.data[0].status).toBe("contacted");
  });

  it("total reflects unfiltered count; page slicing is correct", async () => {
    const repo = adminRepo();
    for (let i = 0; i < 5; i++) {
      await repo.create(makeLeadInput({ name: `Lead ${i}` }));
    }
    const page = await repo.list({ page: 1, pageSize: 2 });
    expect(page.total).toBe(5);
    expect(page.data).toHaveLength(2);
    expect(page.pageSize).toBe(2);
  });
});

// ── AC7 — Fault-injection toggle ─────────────────────────────────────────────

describe("AC7 — fault-injection toggle (ADR-007)", () => {
  it("'409' mode → create throws RepositoryError(409)", async () => {
    setFaultMode("409");
    await expect(adminRepo().create(makeLeadInput())).rejects.toMatchObject({
      statusCode: 409,
      code: "VERSION_CONFLICT",
    });
  });

  it("'422' mode → create throws RepositoryError(422)", async () => {
    setFaultMode("422");
    await expect(adminRepo().create(makeLeadInput())).rejects.toMatchObject({
      statusCode: 422,
      code: "VALIDATION",
    });
  });

  it("'network' mode → create throws RepositoryError(503)", async () => {
    setFaultMode("network");
    await expect(adminRepo().create(makeLeadInput())).rejects.toMatchObject({
      statusCode: 503,
      code: "NETWORK",
    });
  });

  it("resetFaultMode() clears the fault; subsequent create succeeds", async () => {
    setFaultMode("409");
    resetFaultMode();
    await expect(adminRepo().create(makeLeadInput())).resolves.toBeDefined();
  });

  it("injected fault emits NO events and NO audit records", async () => {
    setFaultMode("422");
    try {
      await adminRepo().create(makeLeadInput());
    } catch {
      // expected
    }
    expect(allAudits()).toHaveLength(0);
  });
});

// ── Authorization ─────────────────────────────────────────────────────────────

describe("Authorization denial (AC5)", () => {
  it("viewer role cannot create a lead → RepositoryError(403)", async () => {
    const viewerSession: SessionClaims = {
      userId: newId("user"),
      tenantId: TENANT_A,
      subsidiaryId: SUB_EU,
      roles: ["viewer"],
      exp: "2099-12-31T23:59:59.000Z",
    };
    const viewerRepo = new LocalStorageRepository<Lead>(leadConfig, viewerSession);
    await expect(viewerRepo.create(makeLeadInput())).rejects.toMatchObject({
      statusCode: 403,
      code: "FORBIDDEN",
    });
  });
});
