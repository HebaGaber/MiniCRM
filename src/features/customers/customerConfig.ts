// EntityConfig for Customer (stub seeded by E1-S3 for offboard reassignment).
// Epics 3+ will add the full feature layer on top of this config.
// Wired at the composition root via useRepository(CUSTOMER_CONFIG).

import type { EntityConfig } from "../../shared/data/LocalStorageRepository";
import type { Customer } from "../../shared/domain/customer.types";
import { customerSchema } from "../../shared/domain/schemas";

export const CUSTOMER_CONFIG: EntityConfig<Customer> = {
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
