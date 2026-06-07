// Tests for the canonical event-type registry (AC3, NFR-12): every §7.2 name is
// accepted; free-form / malformed names are rejected; `isEventType` narrows.

import { describe, it, expect } from "vitest";
import { EVENT_TYPES, isEventType, type EventType } from "./eventTypes";

describe("EVENT_TYPES registry — accepts every canonical §7.2 name (AC3)", () => {
  for (const name of EVENT_TYPES) {
    it(`accepts "${name}"`, () => {
      expect(isEventType(name)).toBe(true);
    });
  }

  it("contains exactly the 19 verbatim §7.2 names", () => {
    expect(EVENT_TYPES).toHaveLength(19);
    // Spot-check the boundaries of the list and the cross-entity coverage.
    expect(EVENT_TYPES).toContain("Lead.Created");
    expect(EVENT_TYPES).toContain("Auth.RoleDenied");
    expect(EVENT_TYPES).toContain("Tenant.SubsidiaryAdded");
  });

  it("does NOT include Customer.StatusChanged / Customer.Converted (Open Question 1)", () => {
    // Authored §7.2 verbatim — these are flagged for Heba, not invented here.
    expect(isEventType("Customer.StatusChanged")).toBe(false);
    expect(isEventType("Customer.Converted")).toBe(false);
  });
});

describe("isEventType — rejects free-form / malformed names (AC3)", () => {
  it.each([
    ["lead.created", "lowercase (wrong case)"],
    ["Foo.Bar", "unknown entity/action"],
    ["LeadCreated", "missing dot separator"],
    ["", "empty string"],
    ["Lead.Created ", "trailing whitespace"],
    ["lead.convert", "an audit action, not a domain type"],
  ])('rejects "%s" (%s)', (input) => {
    expect(isEventType(input)).toBe(false);
  });

  it("narrows the type when used as a guard", () => {
    const raw: string = "Lead.Created";
    if (isEventType(raw)) {
      // Inside the guard, `raw` is `EventType` — this assignment must compile.
      const narrowed: EventType = raw;
      expect(narrowed).toBe("Lead.Created");
    } else {
      throw new Error("expected a canonical name to narrow");
    }
  });
});
