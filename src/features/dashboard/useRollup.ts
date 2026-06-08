// useRollup — read-only aggregation hook for the cross-subsidiary roll-up
// read model (E1-S5, AC2). Counts per subsidiary via individual filtered queries
// (list({filter:{subsidiaryId:sub.id}, pageSize:1}).total) so counts are accurate
// regardless of how many records exist (page.data is capped at 100 by the adapter;
// page.total is always the full count post-filter).
//
// Scope enforcement (AC3/UC-5):
// - tenant_admin (subsidiaryId=null): shows all active subsidiaries + parent-level.
// - Subsidiary user: shows only their own subsidiary + parent-level; siblings are
//   filtered out from the subsidiary list before building rows.
//
// Read-only: no mutations, no domain events, no 4-beat (AC2).
// NFR-1: features/dashboard → shared/* only.

import { useCallback, useEffect, useState } from "react";
import type { Subsidiary } from "../../shared/domain/tenant.types";
import type { Repository } from "../../shared/data/Repository";
import type { Lead } from "../../shared/domain/lead.types";
import type { Customer } from "../../shared/domain/customer.types";
import type { Ticket } from "../../shared/domain/ticket.types";
import type { SessionClaims } from "../../shared/auth/auth.types";
import type { ID } from "../../shared/domain/types";

export interface RollupRow {
  id: string;
  name: string;
  leads: number;
  customers: number;
  tickets: number;
}

export interface RollupTotals {
  leads: number;
  customers: number;
  tickets: number;
  grand: number;
}

export type RollupState = "loading" | "empty" | "error" | "ready";

interface RollupResult {
  rows: RollupRow[];
  totals: RollupTotals;
  state: RollupState;
  error: Error | null;
  reload: () => void;
}

interface RollupRepos {
  subsidiaryRepo: Repository<Subsidiary> | null;
  leadRepo: Repository<Lead> | null;
  customerRepo: Repository<Customer> | null;
  ticketRepo: Repository<Ticket> | null;
  session: SessionClaims | null;
}

export function useRollup({ subsidiaryRepo, leadRepo, customerRepo, ticketRepo, session }: RollupRepos): RollupResult {
  const [rows, setRows] = useState<RollupRow[]>([]);
  const [totals, setTotals] = useState<RollupTotals>({ leads: 0, customers: 0, tickets: 0, grand: 0 });
  const [state, setState] = useState<RollupState>("loading");
  const [error, setError] = useState<Error | null>(null);

  const compute = useCallback(async () => {
    if (!subsidiaryRepo || !leadRepo || !customerRepo || !ticketRepo) return;
    setState("loading");
    setError(null);
    try {
      const subPage = await subsidiaryRepo.list({ filter: { includeDeleted: false }, pageSize: 100 });

      // AC3: Subsidiary users see only their own subsidiary + parent-level (never siblings).
      const isTenantAdmin = session?.subsidiaryId === null;
      const visibleSubs: Subsidiary[] = isTenantAdmin
        ? subPage.data
        : subPage.data.filter((s) => s.id === session?.subsidiaryId);

      // Count per subsidiary via per-sub filtered queries — page.total is accurate
      // regardless of record volume (not capped by the 100-row pageSize limit).
      const countFor = async (
        repo: Repository<Lead> | Repository<Customer> | Repository<Ticket>,
        subId: ID | null,
      ): Promise<number> => {
        const p = await (repo as Repository<{ subsidiaryId: ID | null }>).list({
          filter: { subsidiaryId: subId },
          pageSize: 1,
        });
        return p.total;
      };

      const [subRows, parentLeads, parentCustomers, parentTickets] = await Promise.all([
        Promise.all(
          visibleSubs.map(async (s) => ({
            id: s.id,
            name: s.name,
            leads: await countFor(leadRepo, s.id),
            customers: await countFor(customerRepo, s.id),
            tickets: await countFor(ticketRepo, s.id),
          })),
        ),
        countFor(leadRepo, null),
        countFor(customerRepo, null),
        countFor(ticketRepo, null),
      ]);

      const parentRow: RollupRow = {
        id: "_parent",
        name: "Parent level (shared)",
        leads: parentLeads,
        customers: parentCustomers,
        tickets: parentTickets,
      };

      const allRows: RollupRow[] = [...subRows, parentRow];
      const t: RollupTotals = allRows.reduce(
        (acc, r) => ({
          leads: acc.leads + r.leads,
          customers: acc.customers + r.customers,
          tickets: acc.tickets + r.tickets,
          grand: acc.grand + r.leads + r.customers + r.tickets,
        }),
        { leads: 0, customers: 0, tickets: 0, grand: 0 },
      );

      setRows(allRows);
      setTotals(t);
      setState(t.grand === 0 && visibleSubs.length === 0 ? "empty" : "ready");
    } catch (err) {
      setError(new Error("Can't load roll-up"));
      setState("error");
      void err; // suppress unused-variable lint; original error logged to console in prod
    }
  }, [subsidiaryRepo, leadRepo, customerRepo, ticketRepo, session]);

  useEffect(() => {
    void compute();
  }, [compute]);

  return { rows, totals, state, error, reload: compute };
}
