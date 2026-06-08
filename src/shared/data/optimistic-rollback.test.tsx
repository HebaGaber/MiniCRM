// @vitest-environment jsdom
//
// Optimistic-rollback tests (AC3, ADR-007, NFR-12).
// Demonstrates the canonical onMutate/onError/onSettled pattern with TanStack
// Query. Uses the fault-injection toggle to force 409 and 422 errors and
// asserts the optimistic UI snaps back to the previous value (ADR-007:
// "rollback snap-back at slow + toast").

import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react';
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { useState } from 'react';
import { QueryClient, QueryClientProvider, useMutation, useQueryClient } from '@tanstack/react-query';
import { LocalStorageRepository, RepositoryError } from './LocalStorageRepository';
import type { EntityConfig } from './LocalStorageRepository';
import { leadSchema } from '../domain/schemas';
import type { Lead } from '../domain/lead.types';
import type { SessionClaims } from '../auth/auth.types';
import { newId } from '../domain/types';
import type { ID } from '../domain/types';
import { setFaultMode, resetFaultMode } from './faultInjection';
import { __resetBus } from '../events/bus';
import { __resetAuditLog } from '../events/auditLog';

// ── Fixtures ──────────────────────────────────────────────────────────────────

const SESSION: SessionClaims = {
  userId: 'usr_rollback_test' as ID,
  tenantId: 'tnt_rollback_test' as ID,
  subsidiaryId: null,
  roles: ['tenant_admin'],
  exp: '2099-12-31T23:59:59.000Z',
};

const rollbackLeadConfig: EntityConfig<Lead> = {
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

// ── Minimal demo component ────────────────────────────────────────────────────
// Implements the ADR-007 optimistic-rollback contract with TanStack Query:
//   onMutate  → capture snapshot, apply optimistic update instantly
//   onError   → restore from snapshot (snap-back)
//   onSettled → would invalidate cache in real app; omitted in pilot demo

interface RollbackDemoProps {
  repo: LocalStorageRepository<Lead>;
  lead: Lead;
}

type RollbackContext = { previousName: string };

function RollbackDemoView({ repo, lead }: RollbackDemoProps) {
  const [displayedName, setDisplayedName] = useState(lead.name);
  const [settled, setSettled] = useState(false);
  const queryClient = useQueryClient();

  const mutation = useMutation<Lead, RepositoryError, string, RollbackContext>({
    mutationFn: (nextName: string) =>
      repo.update(lead.id, { name: nextName }, lead.version),

    onMutate: async (nextName) => {
      const previousName = displayedName;
      setDisplayedName(nextName); // optimistic apply — instant (ADR-007)
      return { previousName };
    },

    onError: (_err, _vars, context) => {
      if (context) setDisplayedName(context.previousName); // snap-back (ADR-007)
    },

    // onSettled runs after success OR error — invalidate queries so stale data refetches
    onSettled: () => {
      setSettled(true);
      // In a real app: queryClient.invalidateQueries({ queryKey: ['leads'] });
      // Here we just mark settled so tests can assert this hook ran.
      void queryClient;
    },
  });

  return (
    <div>
      <span data-testid="name">{displayedName}</span>
      {mutation.isPending && <span data-testid="pending">saving…</span>}
      {mutation.isError && (
        <span data-testid="error">
          {mutation.error instanceof RepositoryError
            ? `Error ${mutation.error.statusCode}`
            : 'Error'}
        </span>
      )}
      {settled && <span data-testid="settled">settled</span>}
      <button data-testid="update-btn" onClick={() => mutation.mutate('Updated Name')}>
        Update
      </button>
    </div>
  );
}

function makeQueryClient() {
  // retry: false so test mutations don't retry on fault-injected errors
  return new QueryClient({ defaultOptions: { mutations: { retry: false } } });
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('Optimistic rollback via fault injection (ADR-007, AC3)', () => {
  let repo: LocalStorageRepository<Lead>;
  let lead: Lead;

  beforeEach(async () => {
    __resetBus();
    __resetAuditLog();
    resetFaultMode();
    localStorage.clear();
    repo = new LocalStorageRepository<Lead>(rollbackLeadConfig, SESSION);
    lead = await repo.create({
      name: 'Original Name',
      email: 'rollback@test.example',
      source: 'web',
      status: 'new',
      ownerId: newId('user'),
    });
  });

  afterEach(() => {
    cleanup();
  });

  it('happy path: optimistic name is committed and onSettled fires', async () => {
    const qc = makeQueryClient();
    render(
      <QueryClientProvider client={qc}>
        <RollbackDemoView repo={repo} lead={lead} />
      </QueryClientProvider>,
    );

    expect(screen.getByTestId('name').textContent).toBe('Original Name');

    fireEvent.click(screen.getByTestId('update-btn'));

    // Wait for the optimistic update (onMutate) and successful commit
    await waitFor(() =>
      expect(screen.getByTestId('name').textContent).toBe('Updated Name'),
    );
    await waitFor(() => expect(screen.queryByTestId('pending')).toBeNull());
    expect(screen.queryByTestId('error')).toBeNull();
    expect(screen.getByTestId('name').textContent).toBe('Updated Name');
    // onSettled fires in all cases — verified by sentinel element
    await waitFor(() => expect(screen.getByTestId('settled')).toBeTruthy());
  });

  it('409 VERSION_CONFLICT: optimistic update snaps back to original', async () => {
    setFaultMode('409');
    const qc = makeQueryClient();
    render(
      <QueryClientProvider client={qc}>
        <RollbackDemoView repo={repo} lead={lead} />
      </QueryClientProvider>,
    );

    expect(screen.getByTestId('name').textContent).toBe('Original Name');

    fireEvent.click(screen.getByTestId('update-btn'));

    // onError fires → snap-back (ADR-007); onSettled fires after error too
    await waitFor(() =>
      expect(screen.getByTestId('error').textContent).toBe('Error 409'),
    );
    expect(screen.getByTestId('name').textContent).toBe('Original Name');
    await waitFor(() => expect(screen.getByTestId('settled')).toBeTruthy());
  });

  it('422 VALIDATION_ERROR: optimistic update snaps back to original', async () => {
    setFaultMode('422');
    const qc = makeQueryClient();
    render(
      <QueryClientProvider client={qc}>
        <RollbackDemoView repo={repo} lead={lead} />
      </QueryClientProvider>,
    );

    expect(screen.getByTestId('name').textContent).toBe('Original Name');

    fireEvent.click(screen.getByTestId('update-btn'));

    // onError fires → snap-back
    await waitFor(() =>
      expect(screen.getByTestId('error').textContent).toBe('Error 422'),
    );
    expect(screen.getByTestId('name').textContent).toBe('Original Name');
  });

  it('network fault: optimistic update snaps back to original', async () => {
    setFaultMode('network');
    const qc = makeQueryClient();
    render(
      <QueryClientProvider client={qc}>
        <RollbackDemoView repo={repo} lead={lead} />
      </QueryClientProvider>,
    );

    fireEvent.click(screen.getByTestId('update-btn'));

    await waitFor(() =>
      expect(screen.getByTestId('error').textContent).toMatch('Error'),
    );
    expect(screen.getByTestId('name').textContent).toBe('Original Name');
  });
});
