// App router (E1-S2, AC1; E1-S4 scope switcher). Two-gate authZ: route guard + action guard.
// Routes for features gated by capability; out-of-tenant/missing → NotFoundPage.
// Unauthenticated users are redirected to /sign-in (demo role picker).
// NFR-1: src/app imports shared/* and features/* — never reverse.

import { useCallback, useEffect, useState, type ReactNode } from "react";
import { BrowserRouter, Navigate, Route, Routes, useLocation, useNavigate } from "react-router-dom";
import type { Location } from "react-router-dom";
import { AppShell } from "../shared/ui/components/AppShell";
import { RouteGuard } from "../shared/auth/guards";
import { NotFoundView } from "../shared/ui/NotFoundView";
import { SubsidiariesPage } from "../features/tenancy/SubsidiariesPage";
import { RollupPage } from "../features/dashboard/RollupPage";
import { useRepository } from "./composition";
import { SUBSIDIARY_CONFIG } from "../features/tenancy/subsidiaryConfig";
import { LEAD_ROLLUP_CONFIG, CUSTOMER_ROLLUP_CONFIG, TICKET_ROLLUP_CONFIG } from "../features/dashboard/rollupConfigs";
import { useAuth } from "../shared/auth/useAuth";
import { subscribe } from "../shared/events/bus";
import type { DomainEvent } from "../shared/events/bus";
import type { Subsidiary } from "../shared/domain/tenant.types";
import type { Role } from "../shared/domain/status";

function NotFoundPage() {
  const navigate = useNavigate();
  const { session } = useAuth();
  const scopeName = session?.tenantId ?? "this workspace";
  return <NotFoundView scopeName={scopeName} onBack={() => navigate(-1)} />;
}

function SubsidiariesRoute() {
  const repo = useRepository(SUBSIDIARY_CONFIG);
  if (!repo) return null;
  return <SubsidiariesPage repo={repo} />;
}

// ── RollupRoute (E1-S5) ───────────────────────────────────────────────────────
// Creates repos at the app layer and injects them into RollupPage.
// app/ → features/ direction is intentional; the reverse (features/ → app/) is
// the layering violation the architecture prohibits.

function RollupRoute() {
  const subsidiaryRepo = useRepository(SUBSIDIARY_CONFIG);
  const leadRepo = useRepository(LEAD_ROLLUP_CONFIG);
  const customerRepo = useRepository(CUSTOMER_ROLLUP_CONFIG);
  const ticketRepo = useRepository(TICKET_ROLLUP_CONFIG);
  return (
    <RollupPage
      subsidiaryRepo={subsidiaryRepo}
      leadRepo={leadRepo}
      customerRepo={customerRepo}
      ticketRepo={ticketRepo}
    />
  );
}

// ── AppShellWithSubsidiaries (E1-S4) ─────────────────────────────────────────
// Loads active subsidiaries and passes them to AppShell for the scope switcher.
// Also handles scope snap-back if the current scope becomes offboarded.

export function AppShellWithSubsidiaries({ children }: { children: ReactNode }) {
  const { session, setSubsidiaryScope } = useAuth();
  const repo = useRepository(SUBSIDIARY_CONFIG);
  const [activeSubs, setActiveSubs] = useState<Subsidiary[]>([]);

  const loadSubs = useCallback(async () => {
    if (!repo) return;
    try {
      const page = await repo.list({ filter: { includeDeleted: false }, pageSize: 100 });
      setActiveSubs(page.data);
    } catch {
      // silent — switcher shows empty list, not an error state
    }
  }, [repo]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadSubs();
  }, [loadSubs]);

  // Snap-back: if current scope was offboarded, reset to tenant level
  useEffect(() => {
    if (!session || session.subsidiaryId === null) return;
    if (activeSubs.length === 0) return; // still loading — avoid false snap
    const stillActive = activeSubs.some(s => s.id === session.subsidiaryId);
    if (!stillActive) {
      setSubsidiaryScope(null, session.tenantId);
    }
  }, [activeSubs, session, setSubsidiaryScope]);

  // Refresh sub list when subsidiaries are onboarded or offboarded
  useEffect(() => {
    return subscribe((event: DomainEvent) => {
      if (
        event.type === 'Tenant.SubsidiaryAdded' ||
        event.type === 'Tenant.SubsidiaryRemoved'
      ) {
        void loadSubs();
      }
    });
  }, [loadSubs]);

  return (
    <AppShell activeSubs={activeSubs}>
      {children}
    </AppShell>
  );
}

// ── Demo sign-in page (shown when no session exists) ─────────────────────────

const DEMO_ROLES: { id: Role; label: string; description: string }[] = [
  { id: "tenant_admin", label: "Tenant Admin", description: "Sara Khan · full access + subsidiaries" },
  { id: "sales",        label: "Sales",        description: "Marco Ruiz · EU / Frankfurt" },
  { id: "support",      label: "Support",      description: "Lena Bauer · US / Chicago" },
  { id: "viewer",       label: "Viewer",       description: "Ivo Petrov · EU / Frankfurt (read-only)" },
];

function SignInPage() {
  const { signIn, isAuthenticated } = useAuth();
  const location = useLocation();

  // Already signed in (e.g. a reload restored the session, or the user clicked a
  // role): leave the public /sign-in route and land on wherever they were headed.
  // `from` is stamped by <RequireAuth> when it bounced an unauthenticated visit;
  // default to "/" (→ /rollup). Never send back to /sign-in (would loop).
  if (isAuthenticated) {
    const from = (location.state as { from?: Location } | null)?.from?.pathname;
    const dest = from && from !== "/sign-in" ? from : "/";
    return <Navigate to={dest} replace />;
  }

  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        background: "var(--iso-blue-3-50, #f0f4ff)",
        gap: "var(--iso-space-6)",
        padding: "var(--iso-space-8)",
      }}
    >
      <div style={{ textAlign: "center" }}>
        <h1 style={{ margin: 0, font: "600 28px/1.2 var(--iso-font-display)", color: "var(--iso-fg-strong)" }}>
          min<span style={{ color: "var(--iso-brand)" }}>crm</span>
        </h1>
        <p style={{ margin: "var(--iso-space-2) 0 0", font: "400 14px/1.5 var(--iso-font-body)", color: "var(--iso-fg-muted)" }}>
          Pick a demo role to sign in
        </p>
      </div>
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: "var(--iso-space-2)",
          width: "100%",
          maxWidth: "360px",
        }}
      >
        {DEMO_ROLES.map((role) => (
          <button
            key={role.id}
            onClick={() => signIn(role.id)}
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "flex-start",
              gap: 2,
              padding: "var(--iso-space-3) var(--iso-space-4)",
              background: "var(--iso-bg)",
              border: "1px solid var(--iso-border)",
              borderRadius: "var(--iso-radius-md)",
              cursor: "pointer",
              textAlign: "left",
              transition: "border-color var(--crm-fast) var(--crm-ease-standard)",
            }}
            onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.borderColor = "var(--iso-brand)"; }}
            onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.borderColor = "var(--iso-border)"; }}
          >
            <span style={{ font: "500 14px/1 var(--iso-font-body)", color: "var(--iso-fg-strong)" }}>{role.label}</span>
            <span style={{ font: "400 12px/1.4 var(--iso-font-ui)", color: "var(--iso-fg-muted)" }}>{role.description}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

// ── Auth guard wrapper: redirect to /sign-in when unauthenticated ─────────────

function RequireAuth({ children }: { children: ReactNode }) {
  const { session } = useAuth();
  const location = useLocation();
  // Recognize an authenticated session before redirecting; only an absent session
  // bounces to the public /sign-in route, carrying `from` so sign-in can return the
  // user to where they were headed.
  if (session === null) return <Navigate to="/sign-in" replace state={{ from: location }} />;
  return <>{children}</>;
}

export function AppRouter() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/sign-in" element={<SignInPage />} />
        <Route
          path="/*"
          element={
            <RequireAuth>
              <AppShellWithSubsidiaries>
                <Routes>
                  <Route path="/" element={<Navigate to="/rollup" replace />} />
                  <Route
                    path="/subsidiaries"
                    element={
                      <RouteGuard capability="tenant.manage" fallback={<NotFoundPage />}>
                        <SubsidiariesRoute />
                      </RouteGuard>
                    }
                  />
                  <Route
                    path="/rollup"
                    element={
                      <RouteGuard capability="rollup.view" fallback={<NotFoundPage />}>
                        <RollupRoute />
                      </RouteGuard>
                    }
                  />
                  <Route path="*" element={<NotFoundPage />} />
                </Routes>
              </AppShellWithSubsidiaries>
            </RequireAuth>
          }
        />
      </Routes>
    </BrowserRouter>
  );
}
