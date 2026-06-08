// AC4 (E0-S10): Billing engine — out-of-scope for the pilot (ADR-012).
// Port interface only; no implementation. No billing SDK is referenced.

export interface BillingPort {
  createInvoice(tenantId: string, amount: number, currency: string): Promise<string>;
  voidInvoice(invoiceId: string): Promise<void>;
}
