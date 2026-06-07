// Ticket canonical entity. (project-context.md §2.2)
// PRODUCT — Ticketing (on shared Tasks/Workflow).

import type { TicketStatus, TicketPriority } from "./status";
import type { BaseEntity, ID } from "./types";

export interface Ticket extends BaseEntity {
  customerId: ID;
  subject: string;
  description: string;
  status: TicketStatus;
  priority: TicketPriority;
  assigneeId: ID | null;
}
