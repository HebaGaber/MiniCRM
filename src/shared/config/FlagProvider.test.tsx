// @vitest-environment jsdom
//
// Tests for E0-S10: Flag/config provider + Noop external ports.
// Covers: resolution precedence, deny-wins, cycle detection, auth-context evaluation,
// external flag defaults, Noop adapters, and vendor-SDK import cleanliness.

import { act, render, renderHook, within } from '@testing-library/react';
import { readFileSync } from 'fs';
import { join } from 'path';
import { describe, expect, it } from 'vitest';
import type { ReactNode } from 'react';
import { AuthProvider } from '../auth/AuthProvider';
import { useAuth } from '../auth/useAuth';
import { FlagProvider } from './FlagProvider';
import { useFlagContext } from './flagContext';
import {
  PILOT_FLAGS,
  resolveConfig,
  resolveFlag,
  type ConfigDefinition,
  type FlagDefinition,
} from './flagStore';
import { useConfig } from './useConfig';
import { useFlag } from './useFlag';
import { NoopCloudAdapter } from './ports/CloudPort';
import { NoopErpSyncAdapter } from './ports/ErpSyncPort';
import { NoopMessagingAdapter } from './ports/MessagingPort';

// ── Helpers ───────────────────────────────────────────────────────────────────

const TENANT = 'tnt_test';
const SUB_A = 'sub_a';
const SUB_B = 'sub_b';

// Mock auth session constants (from AuthProvider.tsx MOCK_IDENTITIES)
const TENANT_NW = 'tnt_northwind';
const SUB_EU = 'sub_eu'; // sales → sub_eu

/** Wrap with AuthProvider + FlagProvider (custom store) for hook tests. */
function makeWrapper(
  flags?: Record<string, FlagDefinition>,
  config?: Record<string, ConfigDefinition>,
) {
  return function Wrapper({ children }: { children: ReactNode }) {
    return (
      <AuthProvider>
        <FlagProvider flags={flags} config={config}>
          {children}
        </FlagProvider>
      </AuthProvider>
    );
  };
}

// ── resolveFlag unit tests (pure function) ────────────────────────────────────

describe('resolveFlag — resolution precedence', () => {
  it('returns system value when only system level is defined', () => {
    const store: Record<string, FlagDefinition> = {
      'feat.x': { system: true },
    };
    expect(resolveFlag(store, 'feat.x', TENANT, null)).toBe(true);
  });

  it('subsidiary wins over tenant when both defined and both true', () => {
    const store: Record<string, FlagDefinition> = {
      'feat.x': {
        system: true,
        tenant: { [TENANT]: true },
        subsidiary: { [SUB_A]: true },
      },
    };
    expect(resolveFlag(store, 'feat.x', TENANT, SUB_A)).toBe(true);
  });

  it('deny-wins: system=false beats tenant=true → false', () => {
    const store: Record<string, FlagDefinition> = {
      'feat.x': {
        system: false,
        tenant: { [TENANT]: true },
      },
    };
    expect(resolveFlag(store, 'feat.x', TENANT, null)).toBe(false);
  });
});

describe('resolveFlag — deny-wins', () => {
  it('system false beats subsidiary true and tenant true', () => {
    const store: Record<string, FlagDefinition> = {
      'feat.x': {
        system: false,
        tenant: { [TENANT]: true },
        subsidiary: { [SUB_A]: true },
      },
    };
    expect(resolveFlag(store, 'feat.x', TENANT, SUB_A)).toBe(false);
  });

  it('tenant false beats subsidiary true', () => {
    const store: Record<string, FlagDefinition> = {
      'feat.x': {
        system: true,
        tenant: { [TENANT]: false },
        subsidiary: { [SUB_A]: true },
      },
    };
    expect(resolveFlag(store, 'feat.x', TENANT, SUB_A)).toBe(false);
  });

  it('subsidiary false beats system true and tenant true', () => {
    const store: Record<string, FlagDefinition> = {
      'feat.x': {
        system: true,
        tenant: { [TENANT]: true },
        subsidiary: { [SUB_A]: false },
      },
    };
    expect(resolveFlag(store, 'feat.x', TENANT, SUB_A)).toBe(false);
  });

  it('deny-wins: subsidiary=true, tenant=false → false', () => {
    const store: Record<string, FlagDefinition> = {
      'feat.x': {
        tenant: { [TENANT]: false },
        subsidiary: { [SUB_A]: true },
      },
    };
    expect(resolveFlag(store, 'feat.x', TENANT, SUB_A)).toBe(false);
  });
});

describe('resolveFlag — cycle detection', () => {
  it('returns false immediately when key is already in the seen set', () => {
    const store: Record<string, FlagDefinition> = {
      'feat.x': { system: true },
    };
    const seen = new Set(['feat.x']);
    expect(resolveFlag(store, 'feat.x', TENANT, null, seen)).toBe(false);
  });

  it('does not loop — resolves normally when seen set is empty', () => {
    const store: Record<string, FlagDefinition> = {
      'feat.x': { system: true },
    };
    expect(resolveFlag(store, 'feat.x', TENANT, null, new Set())).toBe(true);
  });
});

describe('resolveFlag — edge cases', () => {
  it('returns false for undefined key (deny-wins default)', () => {
    expect(resolveFlag({}, 'missing.key', TENANT, null)).toBe(false);
  });

  it('returns false when no applicable level is defined for context', () => {
    const store: Record<string, FlagDefinition> = {
      'feat.x': {
        subsidiary: { [SUB_B]: true }, // SUB_A has no entry
      },
    };
    expect(resolveFlag(store, 'feat.x', TENANT, SUB_A)).toBe(false);
  });

  it('does not match a different tenantId', () => {
    const store: Record<string, FlagDefinition> = {
      'feat.x': { tenant: { 'tnt_other': true } },
    };
    expect(resolveFlag(store, 'feat.x', TENANT, null)).toBe(false);
  });
});

// ── resolveConfig unit tests (pure function) ──────────────────────────────────

describe('resolveConfig — resolution precedence', () => {
  it('returns system value when only system level defined', () => {
    const store: Record<string, ConfigDefinition> = {
      'app.theme': { system: 'light' },
    };
    expect(resolveConfig(store, 'app.theme', TENANT, null, 'dark')).toBe('light');
  });

  it('subsidiary overrides tenant and system', () => {
    const store: Record<string, ConfigDefinition> = {
      'app.theme': {
        system: 'light',
        tenant: { [TENANT]: 'dark' },
        subsidiary: { [SUB_A]: 'high-contrast' },
      },
    };
    expect(resolveConfig(store, 'app.theme', TENANT, SUB_A, 'light')).toBe('high-contrast');
  });

  it('tenant overrides system when subsidiary not defined', () => {
    const store: Record<string, ConfigDefinition> = {
      'app.theme': {
        system: 'light',
        tenant: { [TENANT]: 'dark' },
      },
    };
    expect(resolveConfig(store, 'app.theme', TENANT, null, 'light')).toBe('dark');
  });

  it('falls back to defaultValue when key is not defined', () => {
    expect(resolveConfig({}, 'missing.key', TENANT, null, 42)).toBe(42);
  });
});

// ── External system flags (pilot defaults) ────────────────────────────────────

describe('PILOT_FLAGS — external system flags default off', () => {
  it('erp.sync.enabled defaults to false', () => {
    expect(resolveFlag(PILOT_FLAGS, 'erp.sync.enabled', TENANT, null)).toBe(false);
  });

  it('messaging.enabled defaults to false', () => {
    expect(resolveFlag(PILOT_FLAGS, 'messaging.enabled', TENANT, null)).toBe(false);
  });

  it('cloud.enabled defaults to false', () => {
    expect(resolveFlag(PILOT_FLAGS, 'cloud.enabled', TENANT, null)).toBe(false);
  });

  it('erp.sync.enabled is false even for a specific subsidiary', () => {
    expect(resolveFlag(PILOT_FLAGS, 'erp.sync.enabled', TENANT, SUB_A)).toBe(false);
  });
});

// ── useFlag hook tests — no session ──────────────────────────────────────────

describe('useFlag — with no session', () => {
  it('returns false by default when no session exists', () => {
    const customFlags: Record<string, FlagDefinition> = {
      'feat.something': { system: true },
    };
    const { result } = renderHook(() => useFlag('feat.something'), {
      wrapper: makeWrapper(customFlags),
    });
    // No signIn called → session is null → returns default false
    expect(result.current).toBe(false);
  });

  it('returns custom defaultValue when no session exists', () => {
    const { result } = renderHook(() => useFlag('feat.something', false), {
      wrapper: makeWrapper(),
    });
    expect(result.current).toBe(false);
  });
});

// ── useFlag hook tests — with active session (AC1: eval context = auth context) ─

describe('useFlag — with active session', () => {
  it('resolves flag using auth session tenantId after sign-in', () => {
    const customFlags: Record<string, FlagDefinition> = {
      'feat.x': { tenant: { [TENANT_NW]: true } },
    };
    const { result } = renderHook(
      () => ({ flag: useFlag('feat.x'), auth: useAuth() }),
      { wrapper: makeWrapper(customFlags) },
    );
    expect(result.current.flag).toBe(false); // no session
    act(() => { result.current.auth.signIn('sales'); });
    // session: tenantId=tnt_northwind, subsidiaryId=sub_eu
    // tenant level = true, system not defined → true
    expect(result.current.flag).toBe(true);
  });

  it('deny-wins applies through useFlag hook with active session', () => {
    const customFlags: Record<string, FlagDefinition> = {
      'feat.y': { system: false, subsidiary: { [SUB_EU]: true } },
    };
    const { result } = renderHook(
      () => ({ flag: useFlag('feat.y'), auth: useAuth() }),
      { wrapper: makeWrapper(customFlags) },
    );
    act(() => { result.current.auth.signIn('sales'); });
    // subsidiary=sub_eu is true, but system=false → deny-wins → false
    expect(result.current.flag).toBe(false);
  });

  it('subsidiary level overrides tenant level for sales role (sub_eu context)', () => {
    const customFlags: Record<string, FlagDefinition> = {
      'feat.z': {
        system: true,
        tenant: { [TENANT_NW]: true },
        subsidiary: { [SUB_EU]: true },
      },
    };
    const { result } = renderHook(
      () => ({ flag: useFlag('feat.z'), auth: useAuth() }),
      { wrapper: makeWrapper(customFlags) },
    );
    act(() => { result.current.auth.signIn('sales'); });
    expect(result.current.flag).toBe(true);
  });
});

// ── useFlag — external system flags always off ────────────────────────────────

describe('useFlag — external system flags always off', () => {
  it('erp.sync.enabled resolves false even without session', () => {
    const { result } = renderHook(() => useFlag('erp.sync.enabled'), {
      wrapper: makeWrapper(),
    });
    expect(result.current).toBe(false);
  });

  it('erp.sync.enabled resolves false even with active session', () => {
    const { result } = renderHook(
      () => ({ flag: useFlag('erp.sync.enabled'), auth: useAuth() }),
      { wrapper: makeWrapper() },
    );
    act(() => { result.current.auth.signIn('tenant_admin'); });
    expect(result.current.flag).toBe(false);
  });
});

// ── useConfig hook tests ──────────────────────────────────────────────────────

describe('useConfig — with no session', () => {
  it('returns defaultValue when no session exists', () => {
    const customConfig: Record<string, ConfigDefinition> = {
      'app.maxItems': { system: 50 },
    };
    const { result } = renderHook(() => useConfig('app.maxItems', 10), {
      wrapper: makeWrapper(undefined, customConfig),
    });
    expect(result.current).toBe(10); // no session → defaultValue
  });
});

describe('useConfig — with active session', () => {
  it('resolves config using auth session tenantId after sign-in', () => {
    const customConfig: Record<string, ConfigDefinition> = {
      'app.pageSize': { system: 10, tenant: { [TENANT_NW]: 25 } },
    };
    const { result } = renderHook(
      () => ({ config: useConfig('app.pageSize', 5), auth: useAuth() }),
      { wrapper: makeWrapper(undefined, customConfig) },
    );
    expect(result.current.config).toBe(5); // no session → defaultValue
    act(() => { result.current.auth.signIn('tenant_admin'); });
    // tenantId=tnt_northwind, subsidiaryId=null → tenant=25
    expect(result.current.config).toBe(25);
  });
});

// ── FlagProvider context guard ─────────────────────────────────────────────────

describe('useFlagContext — outside provider', () => {
  it('throws when used outside <FlagProvider>', () => {
    expect(() =>
      renderHook(() => useFlagContext()),
    ).toThrow(/within <FlagProvider>/);
  });
});

// ── Noop port adapter tests ───────────────────────────────────────────────────

describe('NoopErpSyncAdapter', () => {
  it('syncLead resolves without throwing', async () => {
    await expect(NoopErpSyncAdapter.syncLead('lead_123')).resolves.toBeUndefined();
  });

  it('syncCustomer resolves without throwing', async () => {
    await expect(NoopErpSyncAdapter.syncCustomer('cust_456')).resolves.toBeUndefined();
  });
});

describe('NoopMessagingAdapter', () => {
  it('sendSms resolves without throwing', async () => {
    await expect(NoopMessagingAdapter.sendSms('+1234567890', 'hello')).resolves.toBeUndefined();
  });

  it('sendEmail resolves without throwing', async () => {
    await expect(
      NoopMessagingAdapter.sendEmail('test@example.com', 'Subject', 'Body'),
    ).resolves.toBeUndefined();
  });
});

describe('NoopCloudAdapter', () => {
  it('uploadFile resolves to empty string', async () => {
    await expect(
      NoopCloudAdapter.uploadFile('file.txt', new Blob(['data'])),
    ).resolves.toBe('');
  });

  it('deleteFile resolves without throwing', async () => {
    await expect(NoopCloudAdapter.deleteFile('file.txt')).resolves.toBeUndefined();
  });
});

// ── RTL component tests (AC1: useFlag/useConfig render flagged/unflagged branches) ─

describe('RTL — useFlag renders flagged/unflagged branches (AC1)', () => {
  it('renders unflagged branch with no session (useFlag returns false)', () => {
    const customFlags: Record<string, FlagDefinition> = {
      'ui.newDashboard': { system: true }, // system=true, but no session → false
    };

    function FlaggedView() {
      const flag = useFlag('ui.newDashboard');
      return <div>{flag ? 'new-dashboard' : 'old-dashboard'}</div>;
    }

    const Wrapper = makeWrapper(customFlags);
    const { getByText } = render(<Wrapper><FlaggedView /></Wrapper>);
    expect(getByText('old-dashboard')).toBeDefined();
  });

  it('renders flagged branch after sign-in (useFlag with auth context)', async () => {
    const customFlags: Record<string, FlagDefinition> = {
      'ui.newDashboard': { tenant: { [TENANT_NW]: true } },
    };

    function FlaggedView() {
      const auth = useAuth();
      const flag = useFlag('ui.newDashboard');
      return (
        <div>
          <button onClick={() => auth.signIn('sales')}>sign-in-btn</button>
          <span data-testid="flag-result">{flag ? 'new-dashboard' : 'old-dashboard'}</span>
        </div>
      );
    }

    const Wrapper = makeWrapper(customFlags);
    const { container } = render(<Wrapper><FlaggedView /></Wrapper>);
    const view = within(container);
    expect(view.getByTestId('flag-result').textContent).toBe('old-dashboard'); // no session

    await act(async () => { view.getByRole('button').click(); });
    expect(view.getByTestId('flag-result').textContent).toBe('new-dashboard'); // session → tenant=true
  });

  it('renders config value via useConfig with active session (AC1)', async () => {
    const customConfig: Record<string, ConfigDefinition> = {
      'app.label': { tenant: { [TENANT_NW]: 'MinCRM' } },
    };

    function ConfigView() {
      const auth = useAuth();
      const label = useConfig('app.label', 'Default');
      return (
        <div>
          <button onClick={() => auth.signIn('tenant_admin')}>config-sign-in</button>
          <span data-testid="config-result">{label}</span>
        </div>
      );
    }

    const Wrapper = makeWrapper(undefined, customConfig);
    const { container } = render(<Wrapper><ConfigView /></Wrapper>);
    const view = within(container);
    expect(view.getByTestId('config-result').textContent).toBe('Default');

    await act(async () => { view.getByRole('button').click(); });
    expect(view.getByTestId('config-result').textContent).toBe('MinCRM');
  });
});

// ── Import guard — no vendor SDK (using fs.readFileSync) ─────────────────────

describe('import guard — no vendor SDK in shared/config', () => {
  it('config source files do not import any vendor feature-flag SDK', () => {
    const dir = join(import.meta.dirname, '.');
    const files = [
      'FlagProvider.tsx',
      'flagStore.ts',
      'flagContext.ts',
      'useFlag.ts',
      'useConfig.ts',
    ];
    const banned = ['@openfeature/', '@unleash/', 'launchdarkly', 'flagsmith'];

    for (const file of files) {
      const src = readFileSync(join(dir, file), 'utf-8');
      for (const vendor of banned) {
        expect(src, `${file} must not import ${vendor}`).not.toContain(vendor);
      }
    }
  });
});
