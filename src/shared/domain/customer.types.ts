// Customer canonical entity. (project-context.md §2.2)
// SHARED capability — the CRM consumes it, it does not own it.
// Reconciliation 2 (flag G): `convertedFromLeadId` is OPTIONAL (`?:`), not
// `| null` — a non-converted customer simply omits it. It is the durable lineage
// the conversion saga (E3-S1, step `link-lineage`) writes, paired with
// Lead.convertedToCustomerId. `taxRegistrationNumber`/`contactAddress` are the
// DEC-CC-2 fields the §3.2 activation gate (E3-S2) requires before onboarding→active.

import type { CustomerStatus } from "./status";
import type { BaseEntity, ID } from "./types";

export interface Customer extends BaseEntity {
  name: string;
  primaryEmail: string;
  phone?: string;
  status: CustomerStatus;
  convertedFromLeadId?: ID; // flag G lineage (optional, not nullable)
  taxRegistrationNumber?: string; // DEC-CC-2: required to activate
  contactAddress?: string; // DEC-CC-2: required to activate
}
