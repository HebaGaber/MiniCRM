// @vitest-environment jsdom
//
// Tests for AppShellWithSubsidiaries (E1-S4) — snap-back + event-driven refresh.
// These tests live in src/app/ (same layer as router.tsx) so they can import
// the component and mock its direct dependencies without breaking NFR-1 layering.

import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, act, waitFor, cleanup } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { AuthContext } from '../shared/auth/authContext';
import type { AuthContextValue, SessionClaims } from '../shared/auth/auth.types';
import type { Subsidiary } from '../shared/domain/tenant.types';
import type { DomainEvent } from '../shared/events/bus';
import type { ID } from '../shared/domain/types';

const TENANT_ID: ID = 'tnt_northwind';
const SUB_EU: ID = 'sub_eu';
const SUB_US: ID = 'sub_us';

// Track all subscribe callbacks so we can fire events at them
const subscribedCallbacks: ((e: DomainEvent) => void)[] = [];

vi.mock('./composition', () => ({
  useRepository: vi.fn(),
}));

vi.mock('../shared/events/bus', () => ({
  subscribe: vi.fn((cb: (e: DomainEvent) => void) => {
    subscribedCallbacks.push(cb);
    return () => {
      const idx = subscribedCallbacks.indexOf(cb);
      if (idx !== -1) subscribedCallbacks.splice(idx, 1);
    };
  }),
  publish: vi.fn(),
}));

import { AppShellWithSubsidiaries } from './router';
import { useRepository } from './composition';

function makeSub(id: ID, name: string): Subsidiary {
  return {
    id, tenantId: TENANT_ID, subsidiaryId: null,
    name, parentSubsidiaryId: null, region: id === SUB_EU ? 'EU' : 'US',
    createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-01T00:00:00.000Z',
    createdBy: 'usr_sara', updatedBy: 'usr_sara', version: 1, deletedAt: null,
  };
}

function makeSession(subsidiaryId: ID | null): SessionClaims {
  return {
    userId: 'usr_sara', tenantId: TENANT_ID, subsidiaryId,
    roles: ['tenant_admin'], exp: '2099-12-31T23:59:59.000Z',
  };
}

function makeAuth(session: SessionClaims, setSubsidiaryScope = vi.fn()): AuthContextValue {
  return {
    session, isAuthenticated: true,
    signIn: vi.fn(), signOut: vi.fn(),
    setSubsidiaryScope,
  };
}

function renderWrapper(auth: AuthContextValue) {
  return render(
    <MemoryRouter>
      <AuthContext.Provider value={auth}>
        <AppShellWithSubsidiaries>
          <div data-testid="child" />
        </AppShellWithSubsidiaries>
      </AuthContext.Provider>
    </MemoryRouter>,
  );
}

describe('AppShellWithSubsidiaries — snap-back', () => {
  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
    subscribedCallbacks.length = 0;
  });

  it('resets scope to null when current subsidiaryId is no longer in activeSubs', async () => {
    // sub_eu is active in session but only sub_us is returned by repo (sub_eu offboarded)
    const mockList = vi.fn().mockResolvedValue({
      data: [makeSub(SUB_US, 'US / Chicago')],
      total: 1,
    });
    vi.mocked(useRepository).mockReturnValue({ list: mockList } as never);

    const setSubsidiaryScope = vi.fn();
    const auth = makeAuth(makeSession(SUB_EU), setSubsidiaryScope);

    renderWrapper(auth);

    await waitFor(() => {
      expect(setSubsidiaryScope).toHaveBeenCalledWith(null, TENANT_ID);
    });
  });

  it('does not snap back when activeSubs is still loading (empty list)', async () => {
    // Repo returns an empty list — this represents the "still loading" state
    // (or legitimately zero subsidiaries). Guard prevents false snap-back.
    const mockList = vi.fn().mockResolvedValue({ data: [], total: 0 });
    vi.mocked(useRepository).mockReturnValue({ list: mockList } as never);

    const setSubsidiaryScope = vi.fn();
    const auth = makeAuth(makeSession(SUB_EU), setSubsidiaryScope);

    renderWrapper(auth);

    // Let the async load settle
    await act(async () => { await mockList.mock.results[0]?.value; });
    expect(setSubsidiaryScope).not.toHaveBeenCalled();
  });

  it('does not snap back when subsidiaryId is already null (whole-tenant scope)', async () => {
    const mockList = vi.fn().mockResolvedValue({ data: [], total: 0 });
    vi.mocked(useRepository).mockReturnValue({ list: mockList } as never);

    const setSubsidiaryScope = vi.fn();
    const auth = makeAuth(makeSession(null), setSubsidiaryScope); // null = whole tenant

    renderWrapper(auth);
    await act(async () => { await mockList.mock.results[0]?.value; });
    expect(setSubsidiaryScope).not.toHaveBeenCalled();
  });

  it('refreshes sub list on Tenant.SubsidiaryAdded event', async () => {
    const mockList = vi.fn().mockResolvedValue({
      data: [makeSub(SUB_EU, 'EU / Frankfurt')],
      total: 1,
    });
    vi.mocked(useRepository).mockReturnValue({ list: mockList } as never);

    const auth = makeAuth(makeSession(null));
    renderWrapper(auth);

    // Wait for initial load
    await waitFor(() => expect(mockList).toHaveBeenCalledTimes(1));

    // Fire SubsidiaryAdded event — should trigger another load
    act(() => {
      subscribedCallbacks.forEach(cb =>
        cb({ type: 'Tenant.SubsidiaryAdded', payload: {} } as DomainEvent),
      );
    });

    await waitFor(() => expect(mockList).toHaveBeenCalledTimes(2));
  });

  it('refreshes sub list on Tenant.SubsidiaryRemoved event', async () => {
    const mockList = vi.fn().mockResolvedValue({
      data: [makeSub(SUB_EU, 'EU / Frankfurt'), makeSub(SUB_US, 'US / Chicago')],
      total: 2,
    });
    vi.mocked(useRepository).mockReturnValue({ list: mockList } as never);

    const auth = makeAuth(makeSession(null));
    renderWrapper(auth);

    await waitFor(() => expect(mockList).toHaveBeenCalledTimes(1));

    act(() => {
      subscribedCallbacks.forEach(cb =>
        cb({ type: 'Tenant.SubsidiaryRemoved', payload: {} } as DomainEvent),
      );
    });

    await waitFor(() => expect(mockList).toHaveBeenCalledTimes(2));
  });
});
