// Zod v4 runtime schemas for all persisted entities. Used by LocalStorageRepository
// (E0-S4) to validate-before-persist (AC4): every write validates the full entity
// (including all BaseEntity fields) and rejects invalid data with 422 + field details.
//
// These schemas are RUNTIME companions to the TypeScript interfaces in types.ts and
// *.types.ts — they do NOT replace those types; the interfaces remain the canonical
// contracts. `import type` is used for any Zod type annotations so this module
// passes verbatimModuleSyntax checks. (NFR-1: imports nothing from src/features/*.)

import { z } from "zod";

// ── BaseEntity fields (shared by all entity schemas) ─────────────────────────

const baseEntitySchema = z.object({
  id: z.string().min(1),
  tenantId: z.string().min(1),
  subsidiaryId: z.string().nullable(),
  createdAt: z.string().min(1),
  updatedAt: z.string().min(1),
  createdBy: z.string().min(1),
  updatedBy: z.string().min(1),
  version: z.number().int().min(1),
  deletedAt: z.string().nullable(),
});

// ── Lead (project-context.md §2.2, lead.types.ts) ────────────────────────────

export const leadSchema = baseEntitySchema.extend({
  name: z.string().min(1, "Name is required"),
  email: z.string().email("Invalid email address"),
  phone: z.string().optional(),
  company: z.string().optional(),
  source: z.enum(["web", "referral", "event", "outbound", "import"]),
  status: z.enum(["new", "contacted", "qualified", "disqualified", "converted"]),
  ownerId: z.string().min(1, "Owner is required"),
  notes: z.string().optional(),
  convertedToCustomerId: z.string().optional(),
});

export type LeadSchema = z.infer<typeof leadSchema>;

// ── Customer (project-context.md §2.2, customer.types.ts) ────────────────────

export const customerSchema = baseEntitySchema.extend({
  name: z.string().min(1, "Name is required"),
  primaryEmail: z.string().email("Invalid email address"),
  phone: z.string().optional(),
  status: z.enum(["prospect", "onboarding", "active", "inactive", "churned"]),
  convertedFromLeadId: z.string().optional(),
  taxRegistrationNumber: z.string().optional(),
  contactAddress: z.string().optional(),
});

export type CustomerSchema = z.infer<typeof customerSchema>;

// ── Ticket (project-context.md §2.2, ticket.types.ts) ────────────────────────

export const ticketSchema = baseEntitySchema.extend({
  customerId: z.string().min(1, "Customer is required"),
  subject: z.string().min(1, "Subject is required"),
  description: z.string().min(1, "Description is required"),
  status: z.enum(["open", "in_progress", "pending", "resolved", "closed"]),
  priority: z.enum(["low", "medium", "high", "urgent"]),
  assigneeId: z.string().nullable(),
});

export type TicketSchema = z.infer<typeof ticketSchema>;
