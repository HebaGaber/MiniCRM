// App router (E1-S2, AC1). Two-gate authZ: route guard + action guard.
// Routes for features gated by capability; out-of-tenant/missing → NotFoundPage.
// NFR-1: src/app imports shared/* and features/* — never reverse.

import { BrowserRouter, Navigate, Route, Routes, useNavigate } from "react-router-dom";
import { AppShell } from "../shared/ui/components/AppShell";
import { RouteGuard } from "../shared/auth/guards";
import { NotFoundView } from "../shared/ui/NotFoundView";
import { SubsidiariesPage } from "../features/tenancy/SubsidiariesPage";
import { useRepository } from "./composition";
import { SUBSIDIARY_CONFIG } from "../features/tenancy/subsidiaryConfig";
import { useAuth } from "../shared/auth/useAuth";

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

export function AppRouter() {
  return (
    <BrowserRouter>
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
    </BrowserRouter>
  );
}
