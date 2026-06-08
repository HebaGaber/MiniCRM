// AC3 (E0-S10): Odoo ERP sync — port interface + Noop adapter.
// Guarded by flag `erp.sync.enabled` (hard-off in the pilot, ADR-012).
// No Odoo SDK is imported or referenced at any call site.

export interface ErpSyncPort {
  syncLead(leadId: string): Promise<void>;
  syncCustomer(customerId: string): Promise<void>;
}

export const NoopErpSyncAdapter: ErpSyncPort = {
  syncLead: async () => { /* noop — flag off in pilot */ },
  syncCustomer: async () => { /* noop — flag off in pilot */ },
};
