// EntityConfig for Subsidiary (E1-S2, ADR-004). Wired at the composition root via
// useRepository(SUBSIDIARY_CONFIG). Feature code calls useRepository() and receives
// a Repository<Subsidiary> bound to the current session scope — never touches
// LocalStorageRepository or localStorage directly (UC-5, DoD §10).

import type { EntityConfig } from "../../shared/data/LocalStorageRepository";
import type { Subsidiary } from "../../shared/domain/tenant.types";
import { subsidiarySchema } from "../../shared/domain/schemas";

export const SUBSIDIARY_CONFIG: EntityConfig<Subsidiary> = {
  name: "subsidiary",
  entityType: "Subsidiary",
  idKind: "subsidiary",
  schema: subsidiarySchema,
  capability: "tenant.manage",
  events: {
    created: "Tenant.SubsidiaryAdded",
    updated: "Tenant.SubsidiaryAdded", // no distinct update event in §7.2 registry
    deleted: "Tenant.SubsidiaryRemoved",
  },
};
