// OffboardDialog — multi-phase offboard modal (choose → running) (E1-S3).
// Phases: choose (pick reassignment target) → running (visual progress saga → finish).
// The "running" phase is a visual simulation; the real batch commit happens in finish().
// Rollback path: simulateFail aborts at ~60% WITHOUT calling finish() — nothing committed.
// AC1: action guarded by can(actor, 'tenant.manage', 'softDelete', resource).
// AC2: soft-delete only — repo.remove() sets deletedAt.
// AC3: all active records reassigned under shared correlationId before subsidiary soft-delete.
// AC4: Tenant.SubsidiaryRemoved + audit share the offboard correlationId.
// AC5: danger-toned, initial focus on Cancel, Esc suppressed while running.
// Motion: crm-pop enter, progress ticks max(90, base/2) ms, persistent danger toast on fail.

import { useEffect, useRef, useState } from "react";
import type { BaseEntity } from "../../shared/domain/types";
import type { Subsidiary } from "../../shared/domain/tenant.types";
import type { Lead } from "../../shared/domain/lead.types";
import type { Customer } from "../../shared/domain/customer.types";
import type { Ticket } from "../../shared/domain/ticket.types";
import type { SessionClaims } from "../../shared/auth/auth.types";
import type { ID } from "../../shared/domain/types";
import { LocalStorageRepository } from "../../shared/data/LocalStorageRepository";
import { SUBSIDIARY_CONFIG } from "./subsidiaryConfig";
import { LEAD_CONFIG } from "../leads/leadConfig";
import { CUSTOMER_CONFIG } from "../customers/customerConfig";
import { TICKET_CONFIG } from "../tickets/ticketConfig";
import { newCorrelationId } from "../../shared/events/correlation";
import { SelectField } from "../../shared/ui/templates/EntityForm";
import { Button } from "../../shared/ui/components/Button";
import { Icon } from "../../shared/ui/components/Icon";
import { pushToast } from "../../shared/ui/components/Toast";

// Active states (non-terminal) — only these records are reassigned (prototype §ACTIVE_STATES).
const LEAD_ACTIVE: ReadonlySet<string> = new Set(["new", "contacted", "qualified"]);
const CUSTOMER_ACTIVE: ReadonlySet<string> = new Set(["prospect", "onboarding", "active", "inactive"]);
const TICKET_ACTIVE: ReadonlySet<string> = new Set(["open", "in_progress", "pending", "resolved"]);

/**
 * Fetches ALL non-deleted records accessible to the repo, iterating pages until
 * exhausted. The list() cap of 100 per page means a subsidiary with >100 active
 * records would be silently truncated without this loop.
 */
async function fetchAll<T extends BaseEntity>(
  repo: LocalStorageRepository<T>,
): Promise<T[]> {
  const records: T[] = [];
  let pageNum = 1;
  while (true) {
    const p = await repo.list({ filter: { includeDeleted: false }, pageSize: 100, page: pageNum });
    records.push(...p.data);
    if (records.length >= p.total || p.data.length === 0) break;
    pageNum++;
  }
  return records;
}

/** Count active records owned by a subsidiary across the three entity types. */
export async function computeOffboardImpact(
  subId: ID,
  session: SessionClaims,
): Promise<{ leads: number; customers: number; tickets: number }> {
  const leadRepo = new LocalStorageRepository<Lead>(LEAD_CONFIG, session);
  const customerRepo = new LocalStorageRepository<Customer>(CUSTOMER_CONFIG, session);
  const ticketRepo = new LocalStorageRepository<Ticket>(TICKET_CONFIG, session);

  const [allLeads, allCustomers, allTickets] = await Promise.all([
    fetchAll(leadRepo),
    fetchAll(customerRepo),
    fetchAll(ticketRepo),
  ]);

  const leads = allLeads.filter(
    (r) => r.subsidiaryId === subId && LEAD_ACTIVE.has(r.status),
  ).length;
  const customers = allCustomers.filter(
    (r) => r.subsidiaryId === subId && CUSTOMER_ACTIVE.has(r.status),
  ).length;
  const tickets = allTickets.filter(
    (r) => r.subsidiaryId === subId && TICKET_ACTIVE.has(r.status),
  ).length;

  return { leads, customers, tickets };
}

type OffboardDialogProps = {
  sub: Subsidiary;
  activeSubs: Subsidiary[];
  session: SessionClaims;
  onClose: () => void;
  onOffboarded: (subId: ID) => void;
};

type Phase = "choose" | "running";

export function OffboardDialog({ sub, activeSubs, session, onClose, onOffboarded }: OffboardDialogProps) {
  const panelRef = useRef<HTMLDivElement>(null);
  const cancelRef = useRef<HTMLButtonElement>(null);
  const runningRef = useRef(false);
  const mountedRef = useRef(true);
  const tickTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [impact, setImpact] = useState<{ leads: number; customers: number; tickets: number } | null>(null);
  const [target, setTarget] = useState("");
  const [phase, setPhase] = useState<Phase>("choose");
  const [done, setDone] = useState(0);
  const [simulateFail, setSimulateFail] = useState(false);

  // Unmount cleanup — guards against setState on unmounted component
  useEffect(() => {
    return () => {
      mountedRef.current = false;
      if (tickTimerRef.current !== null) clearTimeout(tickTimerRef.current);
    };
  }, []);

  // Load impact on mount (mounted guard prevents setState after unmount)
  useEffect(() => {
    void computeOffboardImpact(sub.id, session).then((result) => {
      if (mountedRef.current) setImpact(result);
    });
  }, [sub.id, session]);

  // Focus initial safe control + focus-trap + Esc handling
  useEffect(() => {
    const t = setTimeout(() => cancelRef.current?.focus(), 0);
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        if (!runningRef.current) onClose();
        return;
      }
      if (e.key === "Tab") {
        const panel = panelRef.current;
        if (!panel) return;
        const focusable = Array.from(
          panel.querySelectorAll<HTMLButtonElement | HTMLSelectElement | HTMLInputElement>(
            "button,select,input",
          ),
        ).filter((el) => !el.disabled);
        if (!focusable.length) return;
        const [first] = focusable;
        const last = focusable[focusable.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };
    document.addEventListener("keydown", onKey);
    return () => {
      clearTimeout(t);
      document.removeEventListener("keydown", onKey);
    };
  }, [onClose, phase]);

  const total = impact ? impact.leads + impact.customers + impact.tickets : 0;

  const targetOptions = [
    ...activeSubs
      .filter((s) => s.id !== sub.id)
      .map((s) => ({ value: s.id, label: s.name })),
    { value: "parent", label: "Parent level (shared)" },
  ];

  const targetName =
    target === "parent"
      ? "Parent level"
      : (activeSubs.find((s) => s.id === target)?.name ?? "");

  const run = () => {
    if (!target) return;
    setPhase("running");
    runningRef.current = true;

    if (total === 0) {
      void finish();
      return;
    }

    const failAt = simulateFail ? Math.max(1, Math.floor(total * 0.6)) : -1;
    let i = 0;
    // Tick interval: max(90, base/2). --crm-base = 200ms → max(90,100) = 100ms.
    const stepMs = 100;

    const tick = () => {
      if (!mountedRef.current) return; // component unmounted — stop ticking
      i += 1;
      setDone(i);
      if (i === failAt) {
        runningRef.current = false;
        pushToast({
          tone: "danger",
          title: "Reassignment failed mid-batch — rolled back.",
          body: `No records moved. ${sub.name} is still active.`,
          action: { label: "Try again", onClick: onClose },
        });
        onClose();
        return;
      }
      if (i >= total) {
        void finish();
        return;
      }
      tickTimerRef.current = setTimeout(tick, stepMs);
    };
    tickTimerRef.current = setTimeout(tick, 200);
  };

  const finish = async () => {
    try {
      const correlationId = newCorrelationId();
      const targetSubsidiaryId: ID | null = target === "parent" ? null : (target as ID);

      const leadRepo = new LocalStorageRepository<Lead>(LEAD_CONFIG, session);
      const customerRepo = new LocalStorageRepository<Customer>(CUSTOMER_CONFIG, session);
      const ticketRepo = new LocalStorageRepository<Ticket>(TICKET_CONFIG, session);
      const subRepo = new LocalStorageRepository<Subsidiary>(SUBSIDIARY_CONFIG, session);

      // Fetch ALL active records (pagination loop bypasses the 100-record list() cap)
      const [allLeads, allCustomers, allTickets] = await Promise.all([
        fetchAll(leadRepo),
        fetchAll(customerRepo),
        fetchAll(ticketRepo),
      ]);

      const activeLeads = allLeads.filter(
        (r) => r.subsidiaryId === sub.id && LEAD_ACTIVE.has(r.status),
      );
      const activeCustomers = allCustomers.filter(
        (r) => r.subsidiaryId === sub.id && CUSTOMER_ACTIVE.has(r.status),
      );
      const activeTickets = allTickets.filter(
        (r) => r.subsidiaryId === sub.id && TICKET_ACTIVE.has(r.status),
      );

      // Reassign active leads
      for (const lead of activeLeads) {
        await leadRepo.reassign(
          lead.id,
          targetSubsidiaryId,
          { ownerId: session.userId },
          lead.version,
          correlationId,
        );
      }

      // Reassign active customers
      for (const customer of activeCustomers) {
        await customerRepo.reassign(
          customer.id,
          targetSubsidiaryId,
          {},
          customer.version,
          correlationId,
        );
      }

      // Reassign active tickets
      for (const ticket of activeTickets) {
        await ticketRepo.reassign(
          ticket.id,
          targetSubsidiaryId,
          { assigneeId: session.userId },
          ticket.version,
          correlationId,
        );
      }

      // Soft-delete the subsidiary under the same correlationId (AC4)
      await subRepo.remove(sub.id, { correlationId });

      runningRef.current = false;
      const n = activeLeads.length + activeCustomers.length + activeTickets.length;
      pushToast({
        tone: "success",
        title: `${sub.name} offboarded.`,
        body:
          n > 0
            ? `${n} active record${n === 1 ? "" : "s"} reassigned to ${targetName}.`
            : "No active records to reassign.",
      });
      onOffboarded(sub.id); // triggers setOffboardTarget(null) + list reload
    } catch (err) {
      runningRef.current = false;
      pushToast({
        tone: "danger",
        title: "Offboard failed — rolled back.",
        body: err instanceof Error ? err.message : "An unexpected error occurred.",
        action: { label: "Try again", onClick: onClose },
      });
      onClose();
    }
  };

  return (
    <>
      {/* Backdrop */}
      <div
        role="presentation"
        onClick={() => {
          if (!runningRef.current) onClose();
        }}
        style={{
          position: "fixed",
          inset: 0,
          background: "rgba(0,0,0,0.25)",
          zIndex: 200,
        }}
      />
      {/* Panel */}
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="offboard-dialog-title"
        data-testid="offboard-dialog"
        style={{
          position: "fixed",
          top: "50%",
          left: "50%",
          transform: "translate(-50%, -50%)",
          width: "500px",
          maxWidth: "calc(100vw - 32px)",
          background: "var(--iso-bg)",
          borderRadius: "var(--iso-radius-xl)",
          boxShadow: "var(--iso-shadow-modal)",
          zIndex: 201,
          animation: "crm-pop var(--crm-base) var(--crm-ease-decelerate)",
        }}
      >
        {/* Header */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "var(--iso-space-3)",
            padding: "var(--iso-space-5) var(--iso-space-5) 0",
          }}
        >
          <span
            style={{
              width: 32,
              height: 32,
              borderRadius: "var(--iso-radius-sm)",
              background: "var(--iso-danger-soft)",
              color: "var(--iso-danger)",
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              flexShrink: 0,
            }}
          >
            <Icon name="alert-triangle" size={16} />
          </span>
          <h2
            id="offboard-dialog-title"
            style={{
              margin: 0,
              font: "500 18px/1.3 var(--iso-font-display)",
              color: "var(--iso-fg-strong)",
            }}
          >
            Offboard {sub.name}
          </h2>
        </div>

        {/* Body */}
        <div style={{ padding: "var(--iso-space-4) var(--iso-space-5)" }}>
          {phase === "choose" ? (
            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              <p
                style={{
                  margin: 0,
                  font: "400 13px/20px var(--iso-font-body)",
                  color: "var(--iso-fg-muted)",
                }}
              >
                Offboarding soft-deletes{" "}
                <strong style={{ color: "var(--iso-fg)", fontWeight: 500 }}>{sub.name}</strong> —
                it disappears from lists and the scope switcher. Its active records must be
                reassigned first.
              </p>

              {/* Impact preview */}
              {impact !== null && (
                <div style={{ display: "flex", gap: 8 }}>
                  {(
                    [
                      ["Leads", impact.leads],
                      ["Customers", impact.customers],
                      ["Tickets", impact.tickets],
                    ] as [string, number][]
                  ).map(([label, count]) => (
                    <div
                      key={label}
                      data-testid={`impact-${label.toLowerCase()}`}
                      style={{
                        flex: 1,
                        padding: "12px 14px",
                        borderRadius: "var(--iso-radius-sm)",
                        background: "var(--iso-brand-soft)",
                        border: "1px solid var(--iso-border-muted)",
                      }}
                    >
                      <div
                        style={{
                          font: "500 22px/1 var(--iso-font-display)",
                          color: "var(--iso-fg-strong)",
                        }}
                      >
                        {count}
                      </div>
                      <div
                        style={{
                          font: "400 11px/1 var(--iso-font-ui)",
                          color: "var(--iso-fg-subtle)",
                          marginTop: 5,
                          textTransform: "uppercase",
                          letterSpacing: "0.04em",
                        }}
                      >
                        {label}
                      </div>
                    </div>
                  ))}
                </div>
              )}

              <SelectField
                label="Reassign active records to"
                required
                value={target}
                onChange={setTarget}
                options={targetOptions}
                placeholder="Choose a target…"
                help="Records and their ownership move to this target. Targets are limited to active subsidiaries in this tenant."
                data-testid="target-select"
              />

              <label
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 9,
                  cursor: "pointer",
                  font: "400 12px/1.4 var(--iso-font-ui)",
                  color: "var(--iso-fg-muted)",
                }}
              >
                <InlineToggle on={simulateFail} onChange={() => setSimulateFail((v) => !v)} />
                Simulate a mid-batch failure (rolls back)
              </label>
            </div>
          ) : (
            /* Running phase */
            <div style={{ display: "flex", flexDirection: "column", gap: 14, padding: "6px 0" }}>
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                }}
              >
                <span
                  style={{ font: "500 13px/1 var(--iso-font-body)", color: "var(--iso-fg)" }}
                >
                  Reassigning to {targetName}
                </span>
                <span
                  style={{
                    font: "500 13px/1 var(--iso-font-ui)",
                    color: "var(--iso-fg-muted)",
                  }}
                >
                  {done} / {total}
                </span>
              </div>
              <div
                style={{
                  height: 8,
                  borderRadius: "var(--iso-radius-full)",
                  background: "var(--iso-n-100)",
                  overflow: "hidden",
                }}
                role="progressbar"
                aria-valuenow={done}
                aria-valuemax={total}
                aria-label="Reassignment progress"
              >
                <div
                  style={{
                    height: "100%",
                    width: `${total > 0 ? (done / total) * 100 : 100}%`,
                    background: "var(--iso-brand)",
                    borderRadius: "inherit",
                    transition: "width var(--crm-base) var(--crm-ease-decelerate)",
                  }}
                />
              </div>
              <span
                style={{
                  font: "400 12px/1.4 var(--iso-font-ui)",
                  color: "var(--iso-fg-subtle)",
                }}
              >
                Moving leads, customers and tickets and re-scoping their owners…
              </span>
            </div>
          )}
        </div>

        {/* Footer */}
        <div
          style={{
            display: "flex",
            justifyContent: "flex-end",
            gap: "var(--iso-space-2)",
            padding: "0 var(--iso-space-5) var(--iso-space-5)",
          }}
        >
          {phase === "choose" ? (
            <>
              <Button
                ref={cancelRef}
                variant="secondary"
                onClick={onClose}
                data-testid="offboard-cancel"
              >
                Cancel
              </Button>
              <Button
                variant="danger"
                disabled={!target}
                onClick={run}
                data-testid="offboard-confirm"
              >
                Offboard subsidiary
              </Button>
            </>
          ) : (
            <Button variant="secondary" disabled>
              Reassigning…
            </Button>
          )}
        </div>
      </div>
    </>
  );
}

// ── Inline toggle (same visual as SubsidiariesPage Toggle, avoids barrel extract) ──

function InlineToggle({ on, onChange }: { on: boolean; onChange: () => void }) {
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
          background: "var(--iso-bg)",
          transform: on ? "translateX(16px)" : "translateX(0)",
          transition: "transform var(--crm-fast) var(--crm-ease-standard)",
        }}
      />
    </button>
  );
}
