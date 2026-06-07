// Tenant / Subsidiary / User canonical entities. (project-context.md §2.2)
// Identity & tenancy primitives — all extend BaseEntity. Status/role literals
// come from the single source (E0-S1 status.ts) via type-only imports.

import type { TenantStatus, Role } from "./status";
import type { BaseEntity, ID } from "./types";

export interface Tenant extends BaseEntity {
  name: string;
  status: TenantStatus;
}

export interface Subsidiary extends BaseEntity {
  name: string;
  parentSubsidiaryId: ID | null; // null = top-level subsidiary
}

export interface User extends BaseEntity {
  email: string;
  displayName: string;
  roles: Role[];
}
