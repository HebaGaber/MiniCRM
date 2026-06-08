// Cross-tenant isolation E2E scaffold (AC2, UC-5, SM-P3).
//
// Asserts 0 cross-tenant data leaks against the LocalStorageRepository adapter
// (ADR-004). Tenant A creates a lead; Tenant B cannot read, list, or mutate it.
//
// Runs as a Node.js Playwright test (no browser). Uses a Map-backed localStorage
// polyfill so the adapter's key-scheme isolation is exercised in Node.js.
// Production gate: E6-S3 (server-side Postgres RLS replaces this pilot proxy).

import { test, expect } from '@playwright/test';

// ── localStorage polyfill (must be set before any test body calls the adapter)
// LocalStorageRepository only touches localStorage inside method bodies, so
// this module-level assignment is in place before any test or beforeEach runs.
let _store: Record<string, string> = {};
const _mockStorage = {
  getItem: (key: string): string | null => _store[key] ?? null,
  setItem: (key: string, value: string): void => { _store[key] = value; },
  removeItem: (key: string): void => { delete _store[key]; },
  clear: (): void => { _store = {}; },
  key: (index: number): string | null => Object.keys(_store)[index] ?? null,
  get length(): number { return Object.keys(_store).length; },
} as Storage;

Object.defineProperty(globalThis, 'localStorage', {
  value: _mockStorage,
  writable: true,
  configurable: true,
});

// ── Project imports (after polyfill is assigned at module level)
import { LocalStorageRepository } from '../src/shared/data/LocalStorageRepository.js';
import type { EntityConfig } from '../src/shared/data/LocalStorageRepository.js';
import { leadSchema } from '../src/shared/domain/schemas.js';
import type { Lead } from '../src/shared/domain/lead.types.js';
import type { SessionClaims } from '../src/shared/auth/auth.types.js';
import { newId } from '../src/shared/domain/types.js';
import type { ID } from '../src/shared/domain/types.js';
import { __resetBus } from '../src/shared/events/bus.js';
import { __resetAuditLog } from '../src/shared/events/auditLog.js';
import { resetFaultMode } from '../src/shared/data/faultInjection.js';

// ── Fixtures
const TENANT_A = 'tnt_isolation_a' as ID;
const TENANT_B = 'tnt_isolation_b' as ID;

const tenantASession: SessionClaims = {
  userId: 'usr_admin_a' as ID,
  tenantId: TENANT_A,
  subsidiaryId: null,
  roles: ['tenant_admin'],
  exp: '2099-12-31T23:59:59.000Z',
};

const tenantBSession: SessionClaims = {
  userId: 'usr_admin_b' as ID,
  tenantId: TENANT_B,
  subsidiaryId: null,
  roles: ['tenant_admin'],
  exp: '2099-12-31T23:59:59.000Z',
};

const leadConfig: EntityConfig<Lead> = {
  name: 'lead',
  entityType: 'Lead',
  idKind: 'lead',
  schema: leadSchema,
  capability: 'lead.manage',
  deleteCapability: 'record.deleteExport',
  events: {
    created: 'Lead.Created',
    updated: 'Lead.Updated',
    deleted: 'Lead.Deleted',
    statusChanged: 'Lead.StatusChanged',
  },
  transitionEntity: 'lead',
};

let _emailSeq = 0;
function makeLeadInput(): Omit<Lead, 'id' | 'tenantId' | 'subsidiaryId' | 'createdAt' | 'updatedAt' | 'createdBy' | 'updatedBy' | 'version' | 'deletedAt'> {
  // Use a counter instead of Date.now() — two rapid calls in the same ms would
  // produce duplicate emails otherwise.
  const seq = ++_emailSeq;
  return {
    name: 'Alice Cross',
    email: `alice-${seq}@acme.test`,
    source: 'web',
    status: 'new',
    ownerId: newId('user'),
  };
}

test.beforeEach(() => {
  _store = {};
  __resetBus();
  __resetAuditLog();
  resetFaultMode();
});

// ── Tests

test('Tenant B list returns 0 records after Tenant A creates a lead', async () => {
  const repoA = new LocalStorageRepository<Lead>(leadConfig, tenantASession);
  const repoB = new LocalStorageRepository<Lead>(leadConfig, tenantBSession);

  await repoA.create(makeLeadInput());

  const pageA = await repoA.list({});
  expect(pageA.total).toBe(1);

  const pageB = await repoB.list({});
  expect(pageB.data).toHaveLength(0);
  expect(pageB.total).toBe(0);
});

test('Tenant B get returns null for a lead owned by Tenant A', async () => {
  const repoA = new LocalStorageRepository<Lead>(leadConfig, tenantASession);
  const repoB = new LocalStorageRepository<Lead>(leadConfig, tenantBSession);

  const created = await repoA.create(makeLeadInput());

  const result = await repoB.get(created.id);
  expect(result).toBeNull();
});

test('Tenant B update on a Tenant A lead throws 404', async () => {
  const repoA = new LocalStorageRepository<Lead>(leadConfig, tenantASession);
  const repoB = new LocalStorageRepository<Lead>(leadConfig, tenantBSession);

  const created = await repoA.create(makeLeadInput());

  await expect(repoB.update(created.id, { name: 'Injected' }, created.version)).rejects.toMatchObject({
    statusCode: 404,
  });
});

test('Tenant A soft-delete is invisible to Tenant B (already null)', async () => {
  const repoA = new LocalStorageRepository<Lead>(leadConfig, tenantASession);
  const repoB = new LocalStorageRepository<Lead>(leadConfig, tenantBSession);

  const created = await repoA.create(makeLeadInput());
  await repoA.remove(created.id);

  // Tenant A sees it as soft-deleted (list excludes it by default)
  const pageA = await repoA.list({});
  expect(pageA.data.filter((l) => l.id === created.id)).toHaveLength(0);

  // Tenant B never had access — still null
  const result = await repoB.get(created.id);
  expect(result).toBeNull();
});

test('Tenant B remove on a Tenant A lead throws 404', async () => {
  const repoA = new LocalStorageRepository<Lead>(leadConfig, tenantASession);
  const repoB = new LocalStorageRepository<Lead>(leadConfig, tenantBSession);

  const created = await repoA.create(makeLeadInput());

  await expect(repoB.remove(created.id)).rejects.toMatchObject({
    statusCode: 404,
  });

  // Tenant A record is still intact after Tenant B's failed remove attempt
  const stillExists = await repoA.get(created.id);
  expect(stillExists).not.toBeNull();
  expect(stillExists!.deletedAt).toBeNull();
});

test('two tenants can each have their own lead with no interference', async () => {
  const repoA = new LocalStorageRepository<Lead>(leadConfig, tenantASession);
  const repoB = new LocalStorageRepository<Lead>(leadConfig, tenantBSession);

  await repoA.create({ ...makeLeadInput(), name: 'Lead A' });
  await repoB.create({ ...makeLeadInput(), name: 'Lead B' });

  const pageA = await repoA.list({});
  const pageB = await repoB.list({});

  expect(pageA.total).toBe(1);
  expect(pageA.data[0].name).toBe('Lead A');
  expect(pageB.total).toBe(1);
  expect(pageB.data[0].name).toBe('Lead B');

  // Cross-check: no leakage
  expect(pageA.data.every((l) => l.tenantId === TENANT_A)).toBe(true);
  expect(pageB.data.every((l) => l.tenantId === TENANT_B)).toBe(true);
});

// ── E1-S1: Subsidiary isolation (AC4, ADR-002) ───────────────────────────────
// Within a single tenant, a subsidiary-pinned user sees only their own subsidiary
// + parent-level records. Sibling subsidiaries are invisible.

const TENANT_C = 'tnt_isolation_c' as ID;
const SUB_ALPHA = 'sub_alpha' as ID;
const SUB_BETA  = 'sub_beta'  as ID;

const tenantAdminSession: SessionClaims = {
  userId: 'usr_admin_c' as ID,
  tenantId: TENANT_C,
  subsidiaryId: null,   // tenant_admin roll-up
  roles: ['tenant_admin'],
  exp: '2099-12-31T23:59:59.000Z',
};

const subAlphaSession: SessionClaims = {
  userId: 'usr_sales_alpha' as ID,
  tenantId: TENANT_C,
  subsidiaryId: SUB_ALPHA,
  roles: ['sales'],
  exp: '2099-12-31T23:59:59.000Z',
};

const subBetaSession: SessionClaims = {
  userId: 'usr_sales_beta' as ID,
  tenantId: TENANT_C,
  subsidiaryId: SUB_BETA,
  roles: ['sales'],
  exp: '2099-12-31T23:59:59.000Z',
};

test('sub_alpha user cannot list sub_beta records (sibling isolation)', async () => {
  const adminRepo  = new LocalStorageRepository<Lead>(leadConfig, tenantAdminSession);
  const alphaRepo  = new LocalStorageRepository<Lead>(leadConfig, subAlphaSession);
  const betaRepo   = new LocalStorageRepository<Lead>(leadConfig, subBetaSession);

  await alphaRepo.create({ ...makeLeadInput(), name: 'Alpha Lead' });
  await betaRepo.create({ ...makeLeadInput(), name: 'Beta Lead' });

  const alphaPage = await alphaRepo.list({});
  expect(alphaPage.total).toBe(1);
  expect(alphaPage.data[0].name).toBe('Alpha Lead');

  const betaPage = await betaRepo.list({});
  expect(betaPage.total).toBe(1);
  expect(betaPage.data[0].name).toBe('Beta Lead');

  // Tenant admin sees both
  const adminPage = await adminRepo.list({});
  expect(adminPage.total).toBe(2);
});

test('sub_alpha user get() returns null for sub_beta record', async () => {
  const alphaRepo = new LocalStorageRepository<Lead>(leadConfig, subAlphaSession);
  const betaRepo  = new LocalStorageRepository<Lead>(leadConfig, subBetaSession);

  const betaLead = await betaRepo.create({ ...makeLeadInput(), name: 'Beta Lead' });
  const result = await alphaRepo.get(betaLead.id);
  expect(result).toBeNull();
});

test('sub_alpha user can see parent-level (subsidiaryId=null) records', async () => {
  const adminRepo = new LocalStorageRepository<Lead>(leadConfig, tenantAdminSession);
  const alphaRepo = new LocalStorageRepository<Lead>(leadConfig, subAlphaSession);

  // tenant_admin writes to _parent bucket (subsidiaryId=null)
  const parentLead = await adminRepo.create({ ...makeLeadInput(), name: 'Parent Lead' });

  const hit = await alphaRepo.get(parentLead.id);
  expect(hit).not.toBeNull();
  expect(hit!.name).toBe('Parent Lead');
});

test('tenant_admin sees records from all subsidiaries', async () => {
  const adminRepo = new LocalStorageRepository<Lead>(leadConfig, tenantAdminSession);
  const alphaRepo = new LocalStorageRepository<Lead>(leadConfig, subAlphaSession);
  const betaRepo  = new LocalStorageRepository<Lead>(leadConfig, subBetaSession);

  await alphaRepo.create({ ...makeLeadInput(), name: 'Alpha' });
  await betaRepo.create({ ...makeLeadInput(), name: 'Beta' });

  const page = await adminRepo.list({});
  expect(page.total).toBe(2);
  const names = page.data.map((l) => l.name).sort();
  expect(names).toEqual(['Alpha', 'Beta']);
});
