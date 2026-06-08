// SubsidiariesPage — tenant admin only (E1-S2, AC1).
// Four UI states: loading / empty / error / ready (UC-1).
// Optimistic create with rollback on injected server error (AC5).
// Admin-only gated by <RouteGuard capability="tenant.manage"> in router.tsx.

import React, { useCallback, useEffect, useState } from "react";
import type { Subsidiary } from "../../shared/domain/tenant.types";
import type { Repository } from "../../shared/data/Repository";
import { DataTable } from "../../shared/ui/components/DataTable";
import type { ColumnDef } from "../../shared/ui/components/DataTable";
import { Button } from "../../shared/ui/components/Button";
import { Toolbar } from "../../shared/ui/components/Toolbar";
import { Icon } from "../../shared/ui/components/Icon";
import { StatusPill } from "../../shared/ui/components/StatusPill";
import { OnboardForm } from "./OnboardForm";

type PageState = "loading" | "empty" | "error" | "ready";

type Props = {
  repo: Repository<Subsidiary>;
};

export function SubsidiariesPage({ repo }: Props) {
  const [allRows, setAllRows] = useState<Subsidiary[]>([]);
  const [pageState, setPageState] = useState<PageState>("loading");
  const [includeOffboarded, setIncludeOffboarded] = useState(false);
  const [showOnboard, setShowOnboard] = useState(false);
  const [searchValue, setSearchValue] = useState("");

  const load = useCallback(async () => {
    setPageState("loading");
    try {
      const page = await repo.list({ filter: { includeDeleted: true }, pageSize: 100 });
      setAllRows(page.data);
      const activeCount = page.data.filter((r) => r.deletedAt === null).length;
      setPageState(activeCount === 0 && !includeOffboarded ? "empty" : "ready");
    } catch {
      setPageState("error");
    }
  }, [repo, includeOffboarded]);

  useEffect(() => {
    void load();
  }, [load]);

  // Optimistic add — row appears immediately at --crm-instant
  const handleOptimisticAdd = (sub: Subsidiary) => {
    setAllRows((prev) => [sub, ...prev]);
    setPageState("ready");
  };

  // Rollback — remove optimistic row on simulated server error (snap-back at --crm-slow)
  const handleRollback = (id: string) => {
    setAllRows((prev) => prev.filter((r) => r.id !== id));
    setPageState((prev) => (prev === "ready" ? "ready" : "empty"));
  };

  // Visible rows based on toggle + search
  const visibleRows = allRows.filter((r) => {
    if (!includeOffboarded && r.deletedAt !== null) return false;
    if (searchValue) {
      return r.name.toLowerCase().includes(searchValue.toLowerCase());
    }
    return true;
  });

  // Derive display state: respect page state but re-derive empty when no active subs shown
  const displayState: PageState = (() => {
    if (pageState === "loading") return "loading";
    if (pageState === "error") return "error";
    if (visibleRows.length === 0 && !includeOffboarded) return "empty";
    return "ready";
  })();

  const columns: ColumnDef<Subsidiary>[] = [
    {
      id: "name",
      header: "Name",
      width: "1.4fr",
      render: (r) => (
        <span
          style={{
            display: "flex",
            alignItems: "center",
            gap: 10,
            opacity: r.deletedAt !== null ? 0.55 : 1,
            transition: `opacity var(--crm-instant)`,
          }}
        >
          <span
            style={{
              width: 28,
              height: 28,
              borderRadius: "var(--iso-radius-xs)",
              background: r.deletedAt === null ? "var(--iso-brand-soft)" : "var(--iso-n-100)",
              color: r.deletedAt === null ? "var(--iso-brand)" : "var(--iso-fg-subtle)",
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              flexShrink: 0,
            }}
          >
            <Icon name="building-2" size={15} />
          </span>
          <span style={{ fontWeight: 500 }}>{r.name}</span>
          {r.deletedAt !== null && (
            <StatusPill tone="neutral" size="sm">
              Offboarded
            </StatusPill>
          )}
        </span>
      ),
    },
    {
      id: "parent",
      header: "Parent",
      width: "1fr",
      render: (r) => {
        if (!r.parentSubsidiaryId) {
          return (
            <span style={{ color: "var(--iso-fg-subtle)" }}>Top-level</span>
          );
        }
        const parent = allRows.find((s) => s.id === r.parentSubsidiaryId);
        return parent ? (
          <span>{parent.name}</span>
        ) : (
          <span style={{ color: "var(--iso-fg-subtle)" }}>—</span>
        );
      },
    },
    {
      id: "region",
      header: "Region",
      width: "0.9fr",
      render: (r) => (
        <span style={{ color: "var(--iso-fg-muted)" }}>{r.region ?? "—"}</span>
      ),
    },
    {
      id: "created",
      header: "Created",
      width: "0.8fr",
      align: "right",
      render: (r) => (
        <span style={{ color: "var(--iso-fg-subtle)" }}>
          {new Date(r.createdAt).toLocaleDateString()}
        </span>
      ),
    },
  ];

  const activeSubs = allRows.filter((r) => r.deletedAt === null);

  return (
    <div
      style={{
        padding: "28px 32px",
        maxWidth: 1280,
        margin: "0 auto",
        display: "flex",
        flexDirection: "column",
        gap: "var(--iso-space-6)",
      }}
    >
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
            tenant admin · tenancy
          </div>
          <h1
            style={{
              margin: 0,
              font: "600 24px/1.2 var(--iso-font-display)",
              color: "var(--iso-fg-strong)",
            }}
          >
            Subsidiaries
          </h1>
          <p
            style={{
              margin: "var(--iso-space-1) 0 0",
              font: "400 13px/1.5 var(--iso-font-body)",
              color: "var(--iso-fg-muted)",
            }}
          >
            Onboard, offboard and inspect the tenant&#39;s subsidiaries.
          </p>
        </div>
        <Button
          variant="primary"
          leadIcon="plus"
          onClick={() => setShowOnboard(true)}
          data-testid="onboard-btn"
        >
          Onboard subsidiary
        </Button>
      </div>

      {/* List card */}
      <div
        style={{
          background: "var(--iso-bg)",
          border: "1px solid var(--iso-border)",
          borderRadius: "var(--iso-radius-lg)",
          overflow: "hidden",
        }}
      >
        <Toolbar
          onSearch={setSearchValue}
          searchValue={searchValue}
          searchPlaceholder="Search subsidiaries…"
          right={
            <label
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 8,
                cursor: "pointer",
                font: "400 12px/1 var(--iso-font-body)",
                color: "var(--iso-fg-muted)",
              }}
            >
              <Toggle
                on={includeOffboarded}
                onChange={() => setIncludeOffboarded((v) => !v)}
              />
              Include offboarded
            </label>
          }
        />
        <DataTable<Subsidiary>
          columns={columns}
          rows={displayState === "ready" ? visibleRows : []}
          state={displayState}
          onRetry={load}
          empty={{
            title: "No subsidiaries yet",
            body: "Onboard your first subsidiary to start managing scoped records.",
            action: {
              label: "Onboard subsidiary",
              icon: "plus",
              onClick: () => setShowOnboard(true),
              autoFocus: displayState === "empty",
            },
          }}
          rowActions={(r) =>
            r.deletedAt === null
              ? [
                  {
                    label: "Offboard subsidiary",
                    icon: "log-out",
                    tone: "danger",
                    onClick: () => {
                      /* E1-S3 */
                    },
                  },
                ]
              : [{ label: "Offboarded — read only", icon: "lock", onClick: () => {} }]
          }
        />
      </div>

      {showOnboard && (
        <OnboardForm
          repo={repo}
          activeSubs={activeSubs}
          onClose={() => setShowOnboard(false)}
          onOptimisticAdd={handleOptimisticAdd}
          onRollback={handleRollback}
        />
      )}
    </div>
  );
}

// ── Toggle switch ─────────────────────────────────────────────────────────────

function Toggle({ on, onChange }: { on: boolean; onChange: () => void }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      onClick={onChange}
      style={{
        width: 36,
        height: 20,
        borderRadius: "var(--iso-radius-full)",
        border: 0,
        cursor: "pointer",
        padding: 2,
        flexShrink: 0,
        background: on ? "var(--iso-brand)" : "var(--iso-n-300)",
        transition: "background var(--crm-fast) var(--crm-ease-standard)",
      }}
    >
      <span
        style={{
          display: "block",
          width: 16,
          height: 16,
          borderRadius: "50%",
          background: "#fff",
          transform: on ? "translateX(16px)" : "translateX(0)",
          transition: "transform var(--crm-fast) var(--crm-ease-standard)",
        }}
      />
    </button>
  );
}
