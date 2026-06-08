// Minimal EntityConfigs used only by the rollup read model (E1-S5).
// These configs power Repository<T>.list() calls — the rollup NEVER mutates
// data through them. The capability/events fields satisfy the EntityConfig
// contract but are never exercised in the rollup path (list() has no authZ
// check — scope comes from the session's subsidiaryId via accessibleKeys()).
//
// NFR-1: features/dashboard imports from shared/* only — never upward.

import type { EntityConfig } from "../../shared/data/LocalStorageRepository";
import type { Lead } from "../../shared/domain/lead.types";
import type { Customer } from "../../shared/domain/customer.types";
import type { Ticket } from "../../shared/domain/ticket.types";
import { leadSchema, customerSchema, ticketSchema } from "../../shared/domain/schemas";

export const LEAD_ROLLUP_CONFIG: EntityConfig<Lead> = {
  name: "lead",
  entityType: "Lead",
  idKind: "lead",
  schema: leadSchema,
  capability: "lead.manage",
  events: {
    created: "Lead.Created",
    updated: "Lead.Updated",
    deleted: "Lead.Deleted",
    statusChanged: "Lead.StatusChanged",
  },
};

export const CUSTOMER_ROLLUP_CONFIG: EntityConfig<Customer> = {
  name: "customer",
  entityType: "Customer",
  idKind: "customer",
  schema: customerSchema,
  capability: "customer.manage",
  events: {
    created: "Customer.Created",
    updated: "Customer.Updated",
    deleted: "Customer.Deleted",
  },
};

export const TICKET_ROLLUP_CONFIG: EntityConfig<Ticket> = {
  name: "ticket",
  entityType: "Ticket",
  idKind: "ticket",
  schema: ticketSchema,
  capability: "ticket.manage",
  events: {
    created: "Ticket.Created",
    updated: "Ticket.Updated",
    deleted: "Ticket.Deleted",
    statusChanged: "Ticket.StatusChanged",
  },
};
