// E0-S6 permission-matrix + predicate specs (NFR-12, AC2/AC3/AC4/AC5/AC6). Node env
// (pure functions, no DOM — the global Vitest env stays `node`; only the RTL guard
// spec opts into jsdom). The matrix test is an INDEPENDENT ORACLE: it declares the
// §2.2 grants (as amended by DEC-CC-1) here and asserts (a) MATRIX encodes exactly
// that, and (b) `can()` behaves per the ADR-015 grant semantics for every
// (capability, role) cell against owned/not-owned, read/mutate, soft/hard-delete
// fixtures. Scope + denial-audit are covered alongside.

import { describe, it, expect, beforeEach } from "vitest";
import {
  can,
  isOwned,
  isReadAction,
  isInScope,
  resolveOutcome,
  authorize,
  MATRIX,
  RESTRICTED_SAFE,
  type Capability,
  type Action,
  type Grant,
  type OwnedResource,
} from "./permissions";
import type { SessionClaims } from "./auth.types";
import type { Role } from "../domain/status";
import { __resetBus } from "../events/bus";
import { __resetAuditLog } from "../events/auditLog";
import { expectOneOpOneEventOneAudit, recordEmissions } from "../events/conformance";

// ── Fixtures ────────────────────────────────────────────────────────────────
const TENANT = "tnt_northwind";
const OTHER_TENANT = "tnt_other";
const SUB_EU = "sub_eu";
const SUB_US = "sub_us";
const EXP = "2099-12-31T23:59:59.000Z";

function actorOf(role: Role, userId: string, subsidiaryId: string | null): SessionClaims {
  return { userId, tenantId: TENANT, subsidiaryId, roles: [role], exp: EXP };
}

const ADMIN = actorOf("tenant_admin", "usr_sara", null);
const SALES = actorOf("sales", "usr_marco", SUB_EU);
const SUPPORT = actorOf("support", "usr_lena", SUB_US);
const VIEWER = actorOf("viewer", "usr_ivo", SUB_EU);
const ACTORS: Record<Role, SessionClaims> = {
  tenant_admin: ADMIN,
  sales: SALES,
  support: SUPPORT,
  viewer: VIEWER,
};

/** A record the actor OWNS, in the actor's own scope. */
function owned(actor: SessionClaims): OwnedResource {
  return { tenantId: actor.tenantId, subsidiaryId: actor.subsidiaryId, ownerId: actor.userId };
}
/** A record in the actor's scope but owned by someone else. */
function notOwned(actor: SessionClaims): OwnedResource {
  return { tenantId: actor.tenantId, subsidiaryId: actor.subsidiaryId, ownerId: "usr_stranger" };
}

// ── §2.2 matrix as an INDEPENDENT oracle (amended by DEC-CC-1) ────────────────
const ABSENT = "absent" as const;
type ExpectedGrant = Grant | typeof ABSENT;
const EXPECTED: Record<Capability, Record<Role, ExpectedGrant>> = {
  "tenant.manage": { tenant_admin: "allow", sales: ABSENT, support: ABSENT, viewer: ABSENT },
  "lead.manage": { tenant_admin: "allow", sales: "allow", support: ABSENT, viewer: "view" },
  "customer.manage": { tenant_admin: "allow", sales: "allow", support: "view", viewer: "view" },
  "ticket.create": { tenant_admin: "allow", sales: "allow", support: "allow", viewer: "allow" }, // DEC-CC-1
  "ticket.manage": { tenant_admin: "allow", sales: "view", support: "allow", viewer: "view" },
  "audit.view": { tenant_admin: "allow", sales: "own", support: "own", viewer: "deny" },
  "record.deleteExport": { tenant_admin: "allow", sales: "restricted", support: "restricted", viewer: "deny" },
  "rollup.view": { tenant_admin: "allow", sales: "view", support: "view", viewer: "view" }, // DEC-CC-6 (roll-up visible to all roles, scoped)
};
const ALL_CAPS = Object.keys(EXPECTED) as Capability[];
const ALL_ROLES: Role[] = ["tenant_admin", "sales", "support", "viewer"];

describe("MATRIX encodes the §2.2 permission matrix as data (AC3)", () => {
  for (const cap of ALL_CAPS) {
    for (const role of ALL_ROLES) {
      const expected = EXPECTED[cap][role];
      it(`${cap} × ${role} = ${expected}`, () => {
        const actual: ExpectedGrant = MATRIX[cap][role] ?? ABSENT;
        expect(actual).toBe(expected);
      });
    }
  }
});

describe("can() honors the ADR-015 grant semantics, cell-by-cell (AC3, AC6)", () => {
  for (const cap of ALL_CAPS) {
    for (const role of ALL_ROLES) {
      const grant = EXPECTED[cap][role];
      const actor = ACTORS[role];
      it(`${cap} × ${role} (${grant}) resolves correctly`, () => {
        const own = owned(actor);
        const other = notOwned(actor);
        switch (grant) {
          case "allow":
            expect(can(actor, cap, "read", other)).toBe(true);
            expect(can(actor, cap, "edit", other)).toBe(true); // mutation allowed too
            break;
          case "view":
            expect(can(actor, cap, "read", other)).toBe(true);
            expect(can(actor, cap, "edit", other)).toBe(false); // any mutation denied
            break;
          case "own":
            expect(can(actor, cap, "read", own)).toBe(true);
            expect(can(actor, cap, "read", other)).toBe(false); // not owned → denied
            break;
          case "restricted":
            expect(can(actor, cap, "softDelete", own)).toBe(true);
            expect(can(actor, cap, "export", own)).toBe(true);
            expect(can(actor, cap, "hardDelete", own)).toBe(false); // hard-delete never granted (AC6)
            expect(can(actor, cap, "softDelete", other)).toBe(false); // not owned → denied
            break;
          case "deny":
          case ABSENT:
            expect(can(actor, cap, "read", own)).toBe(false);
            expect(can(actor, cap, "edit", own)).toBe(false);
            break;
        }
      });
    }
  }
});

describe("DEC-CC-1 + C-2 concrete rows (AC3)", () => {
  it("ticket create is allow for ALL FOUR roles (DEC-CC-1)", () => {
    for (const role of ALL_ROLES) {
      expect(can(ACTORS[role], "ticket.create", "create", notOwned(ACTORS[role]))).toBe(true);
    }
  });

  it("ticket edit/assign: allow admin/support, denied (view) for sales/viewer", () => {
    expect(can(ADMIN, "ticket.manage", "assign", notOwned(ADMIN))).toBe(true);
    expect(can(SUPPORT, "ticket.manage", "edit", notOwned(SUPPORT))).toBe(true);
    expect(can(SALES, "ticket.manage", "edit", notOwned(SALES))).toBe(false); // view → no mutate
    expect(can(VIEWER, "ticket.manage", "assign", notOwned(VIEWER))).toBe(false);
  });

  it("customer create/edit: allow tenant_admin/sales, denied (view) for support/viewer (C-2)", () => {
    expect(can(ADMIN, "customer.manage", "create", notOwned(ADMIN))).toBe(true);
    expect(can(SALES, "customer.manage", "edit", notOwned(SALES))).toBe(true);
    expect(can(SUPPORT, "customer.manage", "edit", notOwned(SUPPORT))).toBe(false);
    expect(can(VIEWER, "customer.manage", "create", notOwned(VIEWER))).toBe(false);
  });

  it("view audit/events: own (sales/support), allow (admin), deny (viewer)", () => {
    expect(can(ADMIN, "audit.view", "read", notOwned(ADMIN))).toBe(true);
    expect(can(SALES, "audit.view", "read", owned(SALES))).toBe(true); // authored it
    expect(can(SALES, "audit.view", "read", notOwned(SALES))).toBe(false); // someone else's
    expect(can(SUPPORT, "audit.view", "read", owned(SUPPORT))).toBe(true);
    expect(can(VIEWER, "audit.view", "read", owned(VIEWER))).toBe(false); // explicit deny
  });
});

describe("hard-delete is tenant_admin-only (AC6, §2.1)", () => {
  it("tenant_admin CAN hard-delete (allow grant)", () => {
    expect(can(ADMIN, "record.deleteExport", "hardDelete", owned(ADMIN))).toBe(true);
  });
  it("sales/support/viewer CANNOT hard-delete even when owned", () => {
    expect(can(SALES, "record.deleteExport", "hardDelete", owned(SALES))).toBe(false);
    expect(can(SUPPORT, "record.deleteExport", "hardDelete", owned(SUPPORT))).toBe(false);
    expect(can(VIEWER, "record.deleteExport", "hardDelete", owned(VIEWER))).toBe(false);
  });
  it("RESTRICTED_SAFE is exactly {softDelete, export} — hard-delete is not in it", () => {
    expect(RESTRICTED_SAFE.has("softDelete")).toBe(true);
    expect(RESTRICTED_SAFE.has("export")).toBe(true);
    expect(RESTRICTED_SAFE.has("hardDelete")).toBe(false);
  });
});

describe("default deny + lookup safety (AC2)", () => {
  it("an absent (capability, role) cell denies read and mutate", () => {
    expect(can(SALES, "tenant.manage", "read", owned(SALES))).toBe(false);
    expect(can(SALES, "tenant.manage", "edit", owned(SALES))).toBe(false);
    expect(can(SUPPORT, "lead.manage", "read", owned(SUPPORT))).toBe(false); // support absent on leads
  });
  it("a bogus capability resolves to default deny, not a throw", () => {
    expect(can(ADMIN, "not.a.capability" as Capability, "read", owned(ADMIN))).toBe(false);
  });
  it("an inherited Object.prototype role string misses the matrix (default deny)", () => {
    for (const key of ["constructor", "toString", "valueOf", "hasOwnProperty", "__proto__"]) {
      const bogus: SessionClaims = { ...ADMIN, roles: [key as Role] };
      expect(can(bogus, "lead.manage", "read", owned(ADMIN))).toBe(false);
    }
  });
  it("an actor with no roles is denied everything (empty roles[] → default deny)", () => {
    const noRoles: SessionClaims = { ...ADMIN, roles: [] };
    expect(can(noRoles, "lead.manage", "read", owned(noRoles))).toBe(false);
    expect(can(noRoles, "ticket.create", "create", owned(noRoles))).toBe(false);
  });
});

describe("multi-role resolution (Reconciliation C — AC2 ⊕ ADR-015)", () => {
  it("most-permissive among non-deny grants wins", () => {
    const salesViewer: SessionClaims = { ...SALES, roles: ["sales", "viewer"] };
    // lead.manage: sales=allow, viewer=view → most-permissive → can edit
    expect(can(salesViewer, "lead.manage", "edit", notOwned(salesViewer))).toBe(true);
  });
  it("an explicit deny in ANY role wins (deny-wins on conflict)", () => {
    const salesViewer: SessionClaims = { ...SALES, roles: ["sales", "viewer"] };
    // audit.view: sales=own, viewer=deny → explicit deny present → denied even when owned
    expect(can(salesViewer, "audit.view", "read", owned(salesViewer))).toBe(false);
  });
});

describe("isOwned + isReadAction helpers (AC6)", () => {
  it("isOwned matches ownerId, assigneeId, or actorId against userId", () => {
    expect(isOwned(SALES, { tenantId: TENANT, subsidiaryId: SUB_EU, ownerId: SALES.userId })).toBe(true);
    expect(isOwned(SALES, { tenantId: TENANT, subsidiaryId: SUB_EU, assigneeId: SALES.userId })).toBe(true);
    expect(isOwned(SALES, { tenantId: TENANT, subsidiaryId: SUB_EU, actorId: SALES.userId })).toBe(true);
    expect(isOwned(SALES, { tenantId: TENANT, subsidiaryId: SUB_EU })).toBe(false); // no ownership keys
    expect(isOwned(SALES, { tenantId: TENANT, subsidiaryId: SUB_EU, ownerId: "usr_other" })).toBe(false);
    // realistic ticket shape: an unassigned record carries assigneeId: null — must NOT be owned.
    expect(isOwned(SALES, { tenantId: TENANT, subsidiaryId: SUB_EU, assigneeId: null })).toBe(false);
  });
  it("isReadAction is true only for read", () => {
    expect(isReadAction("read")).toBe(true);
    for (const a of ["create", "edit", "softDelete", "hardDelete", "export", "assign"] as Action[]) {
      expect(isReadAction(a)).toBe(false);
    }
  });
});

describe("tenant/subsidiary scope → notFound, never 403 (AC4, ADR-002)", () => {
  it("a cross-tenant record is out of scope (→ notFound)", () => {
    const cross: OwnedResource = { tenantId: OTHER_TENANT, subsidiaryId: SUB_EU, ownerId: SALES.userId };
    expect(isInScope(SALES, cross)).toBe(false);
    expect(resolveOutcome(SALES, "lead.manage", "edit", cross)).toBe("notFound");
  });
  it("a sibling-subsidiary record is out of scope for a pinned actor (→ notFound)", () => {
    const sibling: OwnedResource = { tenantId: TENANT, subsidiaryId: SUB_US, ownerId: "usr_x" };
    expect(isInScope(SALES, sibling)).toBe(false); // SALES is sub_eu
    expect(resolveOutcome(SALES, "lead.manage", "edit", sibling)).toBe("notFound");
  });
  it("a parent-level (null) record is visible to a pinned actor", () => {
    const parent: OwnedResource = { tenantId: TENANT, subsidiaryId: null, ownerId: SALES.userId };
    expect(isInScope(SALES, parent)).toBe(true);
  });
  it("tenant_admin (subsidiaryId null) rolls up every subsidiary in the tenant", () => {
    expect(isInScope(ADMIN, { tenantId: TENANT, subsidiaryId: SUB_EU })).toBe(true);
    expect(isInScope(ADMIN, { tenantId: TENANT, subsidiaryId: SUB_US })).toBe(true);
    expect(isInScope(ADMIN, { tenantId: OTHER_TENANT, subsidiaryId: SUB_EU })).toBe(false); // tenant is the hard boundary
  });
  it("an in-own-subsidiary record is visible", () => {
    expect(isInScope(SALES, { tenantId: TENANT, subsidiaryId: SUB_EU })).toBe(true);
  });
});

describe("authorize() audits a denial on the dual streams (AC5, UC-2)", () => {
  beforeEach(() => {
    __resetBus();
    __resetAuditLog();
  });

  it("a denied in-tenant action emits exactly 1 Auth.RoleDenied + 1 audit on one correlationId", () => {
    // viewer trying to EDIT a lead in scope: lead.manage viewer=view → mutation denied.
    const res: OwnedResource = { tenantId: TENANT, subsidiaryId: SUB_EU, ownerId: "usr_x", id: "lead_42", entityType: "Lead" };
    let outcome: string | undefined;
    const { events, audits } = expectOneOpOneEventOneAudit(() => {
      outcome = authorize(VIEWER, "lead.manage", "edit", res);
    });
    expect(outcome).toBe("denied");
    expect(events[0].type).toBe("Auth.RoleDenied");
    expect(events[0].actorId).toBe(VIEWER.userId);
    expect(events[0].payload).toEqual({ capability: "lead.manage", action: "edit" });
    expect(audits[0].action).toBe("auth.role_denied"); // lowercase dotted verb (Reconciliation A)
    expect(audits[0].entityType).toBe("Lead");
    expect(audits[0].entityId).toBe("lead_42");
    expect(audits[0].correlationId).toBe(events[0].correlationId);
  });

  it("a granted action emits NOTHING", () => {
    const res: OwnedResource = { tenantId: TENANT, subsidiaryId: SUB_EU, ownerId: ADMIN.userId };
    const { events, audits } = recordEmissions(() => {
      expect(authorize(ADMIN, "lead.manage", "edit", res)).toBe("granted");
    });
    expect(events).toHaveLength(0);
    expect(audits).toHaveLength(0);
  });

  it("an out-of-tenant action is notFound and emits NOTHING (no Auth.RoleDenied — AC4)", () => {
    const cross: OwnedResource = { tenantId: OTHER_TENANT, subsidiaryId: SUB_EU, ownerId: SALES.userId };
    const { events, audits } = recordEmissions(() => {
      expect(authorize(SALES, "lead.manage", "edit", cross)).toBe("notFound");
    });
    expect(events).toHaveLength(0);
    expect(audits).toHaveLength(0);
  });
});
