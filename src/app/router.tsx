// App router (E1-S2, AC1). Two-gate authZ: route guard + action guard.
// Routes for features gated by capability; out-of-tenant/missing → NotFoundPage.
// Unauthenticated users are redirected to /sign-in (demo role picker).
// NFR-1: src/app imports shared/* and features/* — never reverse.

import { type ReactNode } from "react";
import { BrowserRouter, Navigate, Route, Routes, useNavigate } from "react-router-dom";
import { AppShell } from "../shared/ui/components/AppShell";
import { RouteGuard } from "../shared/auth/guards";
import { NotFoundView } from "../shared/ui/NotFoundView";
import { SubsidiariesPage } from "../features/tenancy/SubsidiariesPage";
import { useRepository } from "./composition";
import { SUBSIDIARY_CONFIG } from "../features/tenancy/subsidiaryConfig";
import { useAuth } from "../shared/auth/useAuth";
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

// ── Demo sign-in page (shown when no session exists) ─────────────────────────

const DEMO_ROLES: { id: Role; label: string; description: string }[] = [
  { id: "tenant_admin", label: "Tenant Admin", description: "Sara Khan · full access + subsidiaries" },
  { id: "sales",        label: "Sales",        description: "Marco Ruiz · EU / Frankfurt" },
  { id: "support",      label: "Support",      description: "Lena Bauer · US / Chicago" },
  { id: "viewer",       label: "Viewer",       description: "Ivo Petrov · EU / Frankfurt (read-only)" },
];

function SignInPage() {
  const { signIn } = useAuth();
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
  if (session === null) return <Navigate to="/sign-in" replace />;
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
              <AppShell>
                <Routes>
                  <Route path="/" element={<Navigate to="/subsidiaries" replace />} />
                  <Route
                    path="/subsidiaries"
                    element={
                      <RouteGuard capability="tenant.manage" fallback={<NotFoundPage />}>
                        <SubsidiariesRoute />
                      </RouteGuard>
                    }
                  />
                  <Route path="*" element={<NotFoundPage />} />
                </Routes>
              </AppShell>
            </RequireAuth>
          }
        />
      </Routes>
    </BrowserRouter>
  );
}
