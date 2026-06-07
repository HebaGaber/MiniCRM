// Lead canonical entity. (project-context.md §2.2)
// PRODUCT — Sales Journey (lead portion).
// Reconciliation 2 (flag G): `convertedToCustomerId` is OPTIONAL (`?:`) and is
// the other half of the bidirectional conversion lineage (pairs with
// Customer.convertedFromLeadId); the conversion saga (E3-S1) writes it.

import type { LeadStatus, LeadSource } from "./status";
import type { BaseEntity, ID } from "./types";

export interface Lead extends BaseEntity {
  name: string;
  email: string;
  phone?: string;
  company?: string;
  source: LeadSource;
  status: LeadStatus;
  ownerId: ID;
  notes?: string;
  convertedToCustomerId?: ID; // flag G lineage (optional, not nullable)
}
