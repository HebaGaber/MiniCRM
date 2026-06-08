// EntityConfig for Lead (stub seeded by E1-S3 for offboard reassignment).
// Epics 2+ will add the full feature layer on top of this config.
// Wired at the composition root via useRepository(LEAD_CONFIG).

import type { EntityConfig } from "../../shared/data/LocalStorageRepository";
import type { Lead } from "../../shared/domain/lead.types";
import { leadSchema } from "../../shared/domain/schemas";

export const LEAD_CONFIG: EntityConfig<Lead> = {
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
  transitionEntity: "lead",
};
