// Type-level tests for the repository seam (NFR-12). These are primarily
// COMPILE-TIME assertions — the real gate is `tsc -b` (mirroring the E0-S2
// types.test.ts pattern: value-assignment shape checks + `@ts-expect-error`
// guarded negatives). The runtime `expect`s exist only so Vitest has live
// assertions to run. Behavioral defaults/clamping (pageSize=25, max 100),
// scoping, 409/422/404 and soft-delete are the ADAPTER's job (E0-S4) and are
// deliberately NOT tested here.

import { describe, it, expect } from "vitest";
import { newId, type BaseEntity } from "../domain/types";
import type { Lead } from "../domain/lead.types";
import type { Repository, Page, ListQuery } from "./Repository";

// A fully-populated BaseEntity, reused to build entity samples.
const base: BaseEntity = {
  id: newId("lead"),
  tenantId: newId("tenant"),
  subsidiaryId: null,
  createdAt: "2026-06-07T00:00:00.000Z",
  updatedAt: "2026-06-07T00:00:00.000Z",
  createdBy: newId("user"),
  updatedBy: newId("user"),
  version: 1,
  deletedAt: null,
};

describe("Page<T> — paging contract (AC2 / Reconciliation 1)", () => {
  it("has exactly { data: T[]; total; page; pageSize } with data: T[]", () => {
    const page: Page<Lead> = { data: [], total: 0, page: 1, pageSize: 25 };
    expect(page.data).toEqual([]);
    expect(page.total).toBe(0);
    expect(page.page).toBe(1);
    expect(page.pageSize).toBe(25);
  });

  it("rejects the `items` field (Reconciliation 1: data, NOT items)", () => {
    // @ts-expect-error — Page keys on `data`, not `items` (constitution §4.1 + §5.5 wire envelope)
    const wrong: Page<Lead> = { items: [], total: 0, page: 1, pageSize: 25 };
    void wrong;
    expect(true).toBe(true);
  });
});

describe("ListQuery — standard params (AC3 / Reconciliation 2)", () => {
  it("is structurally open at the filter boundary (unknown keys tolerated)", () => {
    // status/ownerId are conventional keys inside the open `filter` Record, NOT
    // top-level fields; any string key is structurally accepted (UC-5).
    const q: ListQuery = {
      filter: {
        status: "new",
        ownerId: "usr_x",
        anyUnknownKey: "y",
        count: 3,
        includeDeleted: true,
      },
      q: "acme",
      page: 1,
      pageSize: 25,
      sort: "-updatedAt",
    };
    expect(q.filter?.status).toBe("new");
    expect(q.filter?.ownerId).toBe("usr_x");
    expect(q.filter?.anyUnknownKey).toBe("y");
    expect(q.sort).toBe("-updatedAt");
  });

  it("constrains filter VALUES to string | number | boolean", () => {
    // The open Record tolerates unknown KEYS, but not arbitrary value shapes.
    // @ts-expect-error — a nested object is not string | number | boolean
    const bad: ListQuery = { filter: { nested: { a: 1 } } };
    void bad;
    expect(true).toBe(true);
  });

  it("allows an empty query (all params optional)", () => {
    const q: ListQuery = {};
    expect(q.page).toBeUndefined();
  });
});

describe("Repository<T> — the five-member seam (AC1)", () => {
  it("a conforming mock satisfies all five members and Omit<> on create", () => {
    const store: Lead[] = [];
    const repo: Repository<Lead> = {
      list: async (): Promise<Page<Lead>> => ({
        data: store,
        total: store.length,
        page: 1,
        pageSize: 25,
      }),
      get: async (id) => store.find((l) => l.id === id) ?? null,
      // `input` is Omit<Lead, keyof BaseEntity> — only business fields; the
      // adapter (E0-S4) supplies id/audit fields/version. Proven by spreading
      // a BaseEntity over the business input to reconstruct a full Lead.
      create: async (input) => {
        const lead: Lead = { ...base, ...input };
        store.push(lead);
        return lead;
      },
      update: async (id, patch) => {
        const existing = store.find((l) => l.id === id)!;
        return { ...existing, ...patch };
      },
      remove: async () => {},
    };

    expect(typeof repo.list).toBe("function");
    expect(typeof repo.get).toBe("function");
    expect(typeof repo.create).toBe("function");
    expect(typeof repo.update).toBe("function");
    expect(typeof repo.remove).toBe("function");
  });

  it("rejects a T that does not extend BaseEntity (constraint AC1)", () => {
    interface NotAnEntity {
      foo: string;
    }
    // @ts-expect-error — Repository requires T extends BaseEntity
    const bad: Repository<NotAnEntity> = {} as never;
    void bad;
    expect(true).toBe(true);
  });

  it("create's input excludes BaseEntity audit fields (Omit AC1)", async () => {
    const repo: Repository<Lead> = {
      list: async () => ({ data: [], total: 0, page: 1, pageSize: 25 }),
      get: async () => null,
      create: async (input) => ({ ...base, ...input }),
      update: async () => ({ ...base, name: "", email: "", source: "web", status: "new", ownerId: newId("user") }),
      remove: async () => {},
    };
    // @ts-expect-error — `id` (a BaseEntity field) is Omit-ted from create input
    await repo.create({ id: newId("lead"), name: "X", email: "x@y.test", source: "web", status: "new", ownerId: newId("user") });
    const created = await repo.create({
      name: "Acme",
      email: "hi@acme.test",
      source: "web",
      status: "new",
      ownerId: newId("user"),
    });
    expect(created.name).toBe("Acme");
    expect(created.version).toBe(1);
  });
});
