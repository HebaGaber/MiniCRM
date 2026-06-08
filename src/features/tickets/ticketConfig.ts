// EntityConfig for Ticket (stub seeded by E1-S3 for offboard reassignment).
// Epics 4+ will add the full feature layer on top of this config.
// Wired at the composition root via useRepository(TICKET_CONFIG).

import type { EntityConfig } from "../../shared/data/LocalStorageRepository";
import type { Ticket } from "../../shared/domain/ticket.types";
import { ticketSchema } from "../../shared/domain/schemas";

export const TICKET_CONFIG: EntityConfig<Ticket> = {
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
  transitionEntity: "ticket",
};
