// RollupPage — Cross-subsidiary roll-up read model (E1-S5).
// Read-only aggregate table: Subsidiary | Leads | Customers | Tickets | Total.
// Gated by rollup.view (RouteGuard in router.tsx — AC1); tenant_admin gets
// full tenant view, subsidiary user sees only own scope + parent (AC3, UC-5).
// No mutations, no domain events (AC2 — strict read model).
//
// Repos are injected by RollupRoute in router.tsx (src/app/ → features/ direction
// is fine; reverse is the violation — features must never import from app/).
// NFR-1: features/dashboard → shared/* only.

import React from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../shared/auth/useAuth";
import type { Role } from "../../shared/domain/status";
import type { Repository } from "../../shared/data/Repository";
import type { Subsidiary } from "../../shared/domain/tenant.types";
import type { Lead } from "../../shared/domain/lead.types";
import type { Customer } from "../../shared/domain/customer.types";
import type { Ticket } from "../../shared/domain/ticket.types";
import { QueryStateBoundary } from "../../shared/ui/QueryStateBoundary";
import { Skeleton } from "../../shared/ui/components/Skeleton";
import { Icon } from "../../shared/ui/components/Icon";
import { useRollup } from "./useRollup";

const PAGE_PAD: React.CSSProperties = {
  padding: "28px 32px",
  maxWidth: 1280,
  margin: "0 auto",
  display: "flex",
  flexDirection: "column",
  gap: "var(--iso-space-6)",
};

const TH_STYLE: React.CSSProperties = {
  font: "500 10px/1 var(--iso-font-ui)",
  letterSpacing: "0.06em",
  textTransform: "uppercase",
  color: "var(--iso-fg-subtle)",
};

const COL_STYLE: React.CSSProperties = {
  font: "400 14px/1 var(--iso-font-ui)",
  color: "var(--iso-fg)",
  textAlign: "right",
  fontVariantNumeric: "tabular-nums",
};

const GRID_COLS = "1.6fr repeat(4, 1fr)";

// Human role labels for the eyebrow (prototype shows the display label, not the raw id).
const ROLE_LABELS: Record<Role, string> = {
  tenant_admin: "Tenant admin",
  sales: "Sales",
  support: "Support",
  viewer: "Viewer",
};

function TableHeader() {
  return (
    <div
      role="row"
      style={{
        display: "grid",
        gridTemplateColumns: GRID_COLS,
        alignItems: "center",
        height: 40,
        padding: "0 var(--iso-space-5)",
        borderBottom: "1px solid var(--iso-border)",
        background: "var(--iso-blue-3-50)",
      }}
    >
      <div style={TH_STYLE}>Subsidiary</div>
      <div style={{ ...TH_STYLE, textAlign: "right" }}>Leads</div>
      <div style={{ ...TH_STYLE, textAlign: "right" }}>Customers</div>
      <div style={{ ...TH_STYLE, textAlign: "right" }}>Tickets</div>
      <div style={{ ...TH_STYLE, textAlign: "right" }}>Total</div>
    </div>
  );
}

function SkeletonRows() {
  return (
    <>
      {[0, 1, 2, 3].map((i) => (
        <div
          key={i}
          role="row"
          style={{
            display: "grid",
            gridTemplateColumns: GRID_COLS,
            alignItems: "center",
            minHeight: 52,
            padding: "0 var(--iso-space-5)",
            borderBottom: "1px solid var(--iso-border-muted)",
          }}
        >
          <Skeleton w="55%" h={13} />
          <Skeleton w={28} h={12} style={{ justifySelf: "end" }} />
          <Skeleton w={28} h={12} style={{ justifySelf: "end" }} />
          <Skeleton w={28} h={12} style={{ justifySelf: "end" }} />
          <Skeleton w={28} h={12} style={{ justifySelf: "end" }} />
        </div>
      ))}
    </>
  );
}

interface RollupPageProps {
  subsidiaryRepo: Repository<Subsidiary> | null;
  leadRepo: Repository<Lead> | null;
  customerRepo: Repository<Customer> | null;
  ticketRepo: Repository<Ticket> | null;
}

export function RollupPage({ subsidiaryRepo, leadRepo, customerRepo, ticketRepo }: RollupPageProps) {
  const { session } = useAuth();
  const navigate = useNavigate();

  const { rows, totals, state, error, reload } = useRollup({
    subsidiaryRepo,
    leadRepo,
    customerRepo,
    ticketRepo,
    session,
  });

  const isTenantScope = session?.subsidiaryId === null;
  const roleLabel = ROLE_LABELS[session?.roles[0] ?? "viewer"];
  // Scope DISPLAY name (prototype): tenant → "Whole tenant (roll-up)"; otherwise the
  // current subsidiary's name (resolved from the loaded rows — falls back during load).
  const currentSubName = rows.find((r) => r.id === session?.subsidiaryId)?.name;
  const scopeName = isTenantScope ? "Whole tenant (roll-up)" : currentSubName ?? "Your subsidiary";

  return (
    <div style={PAGE_PAD}>
      {/* Page header */}
      <div
        style={{
          display: "flex",
          alignItems: "flex-start",
          justifyContent: "space-between",
          gap: "var(--iso-space-4)",
        }}
      >
        <div>
          <div
            style={{
              font: "500 11px/1 var(--iso-font-ui)",
              letterSpacing: "0.06em",
              textTransform: "uppercase",
              color: "var(--iso-fg-subtle)",
              marginBottom: "var(--iso-space-1)",
            }}
          >
            {roleLabel} · {scopeName}
          </div>
          <h1
            style={{
              margin: 0,
              font: "600 24px/1.2 var(--iso-font-display)",
              color: "var(--iso-fg-strong)",
            }}
          >
            Cross-subsidiary roll-up
          </h1>
          <p
            style={{
              margin: "var(--iso-space-1) 0 0",
              font: "400 13px/1.5 var(--iso-font-body)",
              color: "var(--iso-fg-muted)",
            }}
          >
            {isTenantScope
              ? "A read-only aggregate across every subsidiary in the tenant. No editing, no cross-boundary writes."
              : "Read-only counts for your current scope. Sibling subsidiaries are not shown."}
          </p>
        </div>

        {/* Read-only lock pill */}
        <span
          aria-label="Read-only"
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 6,
            font: "500 11px/1 var(--iso-font-ui)",
            color: "var(--iso-fg-muted)",
            border: "1px solid var(--iso-border)",
            borderRadius: "var(--iso-radius-full)",
            padding: "6px 11px",
            flexShrink: 0,
          }}
        >
          <Icon name="lock" size={12} />
          Read-only
        </span>
      </div>

      {/* Roll-up table card */}
      <div
        style={{
          background: "var(--iso-bg)",
          border: "1px solid var(--iso-border)",
          borderRadius: "var(--iso-radius-lg)",
          overflow: "hidden",
        }}
      >
        <QueryStateBoundary
          state={state}
          error={error}
          onRetry={reload}
          skeleton={
            <>
              <TableHeader />
              <SkeletonRows />
            </>
          }
          empty={{
            icon: "layers",
            title: "Nothing to roll up yet",
            scopeLine: scopeName,
            body: "Once subsidiaries hold records, their counts aggregate here.",
          }}
        >
          <div role="table" aria-label="Cross-subsidiary roll-up">
            <TableHeader />

            {rows.map((r) => {
              const rowTotal = r.leads + r.customers + r.tickets;
              const isParent = r.id === "_parent";
              return (
                <div
                  key={r.id}
                  role="row"
                  style={{
                    display: "grid",
                    gridTemplateColumns: GRID_COLS,
                    alignItems: "center",
                    minHeight: 52,
                    padding: "0 var(--iso-space-5)",
                    borderBottom: "1px solid var(--iso-border-muted)",
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 10,
                      font: "500 14px/1.3 var(--iso-font-body)",
                      color: "var(--iso-fg)",
                    }}
                  >
                    <span
                      style={{
                        width: 26,
                        height: 26,
                        borderRadius: "var(--iso-radius-xs)",
                        background: isParent ? "var(--iso-n-100)" : "var(--iso-brand-soft)",
                        color: isParent ? "var(--iso-fg-muted)" : "var(--iso-brand)",
                        display: "inline-flex",
                        alignItems: "center",
                        justifyContent: "center",
                        flexShrink: 0,
                      }}
                    >
                      <Icon name={isParent ? "layers" : "building-2"} size={14} />
                    </span>
                    {r.name}
                  </div>
                  <div style={COL_STYLE}>{r.leads}</div>
                  <div style={COL_STYLE}>{r.customers}</div>
                  <div style={COL_STYLE}>{r.tickets}</div>
                  <div style={{ ...COL_STYLE, fontWeight: 600, color: "var(--iso-fg-strong)" }}>{rowTotal}</div>
                </div>
              );
            })}

            {/* Tenant total footer row */}
            <div
              role="row"
              style={{
                display: "grid",
                gridTemplateColumns: GRID_COLS,
                alignItems: "center",
                minHeight: 52,
                padding: "0 var(--iso-space-5)",
                background: "var(--iso-blue-3-50)",
              }}
            >
              <div
                style={{
                  font: "500 13px/1 var(--iso-font-ui)",
                  letterSpacing: "0.04em",
                  textTransform: "uppercase",
                  color: "var(--iso-fg-subtle)",
                }}
              >
                Tenant total
              </div>
              <div style={{ ...COL_STYLE, fontWeight: 600 }}>{totals.leads}</div>
              <div style={{ ...COL_STYLE, fontWeight: 600 }}>{totals.customers}</div>
              <div style={{ ...COL_STYLE, fontWeight: 600 }}>{totals.tickets}</div>
              <div style={{ ...COL_STYLE, fontWeight: 700, color: "var(--iso-brand)" }}>{totals.grand}</div>
            </div>
          </div>
        </QueryStateBoundary>
      </div>

      {/* Edge-case hook: routes to NotFoundView (E1-S1) — exercises cross-tenant not-found */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          font: "400 12px/1.4 var(--iso-font-ui)",
          color: "var(--iso-fg-subtle)",
        }}
      >
        <Icon name="external-link" size={13} />
        <span>Edge case:</span>
        <button
          onClick={() => navigate("/not-found-workspace")}
          style={{
            background: "transparent",
            border: 0,
            padding: 0,
            cursor: "pointer",
            font: "500 12px/1.4 var(--iso-font-body)",
            color: "var(--iso-link, var(--iso-brand))",
            textDecoration: "underline",
            textUnderlineOffset: 2,
          }}
        >
          open a record from another workspace ↗
        </button>
      </div>
    </div>
  );
}
