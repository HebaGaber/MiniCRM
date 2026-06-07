// Unit tests for the domain kernel (NFR-12). Covers the ID factory (prefix +
// uniqueness + UUID-v4 shape, driven off ID_PREFIXES so a new kind is auto-tested),
// the WorkflowInstance JSON round-trip, and compile-time proof that every
// canonical entity extends BaseEntity.

import { describe, it, expect } from "vitest";
import {
  newId,
  ID_PREFIXES,
  type ID,
  type IdKind,
  type BaseEntity,
  type WorkflowInstance,
} from "./types";
import type { Tenant, Subsidiary, User } from "./tenant.types";
import type { Customer } from "./customer.types";
import type { Lead } from "./lead.types";
import type { Ticket } from "./ticket.types";

// crypto.randomUUID() emits a v4 UUID: 8-4-4-4-12 hex, version nibble `4`,
// variant nibble ∈ {8,9,a,b}.
const UUID_V4 =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

// A fully-populated BaseEntity used as the spread base for entity samples.
const base: BaseEntity = {
  id: newId("tenant"),
  tenantId: newId("tenant"),
  subsidiaryId: null,
  createdAt: "2026-06-07T00:00:00.000Z",
  updatedAt: "2026-06-07T00:00:00.000Z",
  createdBy: newId("user"),
  updatedBy: newId("user"),
  version: 1,
  deletedAt: null,
};

describe("newId — type-prefixed UUID factory (AC4)", () => {
  // Loop off the prefix map itself: adding a kind to ID_PREFIXES auto-covers it.
  for (const [kind, prefix] of Object.entries(ID_PREFIXES)) {
    it(`mints a '${prefix}' id for kind '${kind}'`, () => {
      const id = newId(kind as IdKind);
      expect(id.startsWith(prefix)).toBe(true);
      // The part after the prefix is a valid UUID v4.
      expect(id.slice(prefix.length)).toMatch(UUID_V4);
    });
  }

  it("returns distinct values across two calls", () => {
    expect(newId("lead")).not.toBe(newId("lead"));
  });
});

describe("WorkflowInstance — JSON round-trip (AC5)", () => {
  it("preserves the resumability fields through serialize/deserialize", () => {
    const instance: WorkflowInstance<{ leadId: ID }> = {
      ...base,
      id: newId("workflow"),
      type: "lead_conversion",
      status: "running",
      currentStep: 2,
      steps: ["guard", "create-customer", "link-lineage"],
      completedSteps: ["guard", "create-customer"],
      correlationId: "corr-abc-123",
      payload: { leadId: newId("lead") },
    };

    const round: WorkflowInstance<{ leadId: ID }> = JSON.parse(
      JSON.stringify(instance),
    );

    expect(round.correlationId).toBe(instance.correlationId);
    expect(round.currentStep).toBe(instance.currentStep);
    expect(round.completedSteps).toEqual(instance.completedSteps);
    expect(round.steps).toEqual(instance.steps);
    expect(round.type).toBe(instance.type);
    expect(round.status).toBe(instance.status);
  });
});

describe("canonical entities extend BaseEntity (AC2/AC3 — compile-time)", () => {
  it("every entity is assignable to BaseEntity", () => {
    // These assignments only compile if each entity structurally extends
    // BaseEntity. Referenced at runtime so noUnusedLocals stays happy.
    const tenant: Tenant = { ...base, name: "Acme", status: "active" };
    const subsidiary: Subsidiary = {
      ...base,
      name: "Acme EU",
      parentSubsidiaryId: null,
    };
    const user: User = {
      ...base,
      email: "a@acme.test",
      displayName: "Ada",
      roles: ["tenant_admin"],
    };
    const customer: Customer = {
      ...base,
      name: "Globex",
      primaryEmail: "ops@globex.test",
      status: "prospect",
      convertedFromLeadId: newId("lead"),
    };
    const lead: Lead = {
      ...base,
      name: "Lead Co",
      email: "hi@lead.test",
      source: "web",
      status: "new",
      ownerId: newId("user"),
      convertedToCustomerId: newId("customer"),
    };
    const ticket: Ticket = {
      ...base,
      customerId: newId("customer"),
      subject: "Help",
      description: "Need assistance",
      status: "open",
      priority: "high",
      assigneeId: null,
    };
    const workflow: WorkflowInstance = {
      ...base,
      id: newId("workflow"),
      type: "customer_onboarding",
      status: "running",
      currentStep: 0,
      steps: [],
      completedSteps: [],
      correlationId: "corr-1",
      payload: undefined,
    };

    const all: BaseEntity[] = [
      tenant,
      subsidiary,
      user,
      customer,
      lead,
      ticket,
      workflow,
    ];
    expect(all).toHaveLength(7);
    expect(all.every((e) => e.version === 1)).toBe(true);
  });

  it("lineage fields are optional, not nullable (AC3 / Reconciliation 2)", () => {
    // A non-converted customer/lead simply omits the field — compiles fine.
    const customer: Customer = {
      ...base,
      name: "No Lineage",
      primaryEmail: "x@y.test",
      status: "active",
    };
    const lead: Lead = {
      ...base,
      name: "Fresh Lead",
      email: "z@y.test",
      source: "referral",
      status: "new",
      ownerId: newId("user"),
    };
    expect(customer.convertedFromLeadId).toBeUndefined();
    expect(lead.convertedToCustomerId).toBeUndefined();
  });
});
