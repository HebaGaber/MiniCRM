// AC3 (E0-S10): Unifonic SMS/messaging — port interface + Noop adapter.
// Guarded by flag `messaging.enabled` (hard-off in the pilot, ADR-012).
// No Unifonic SDK is imported or referenced at any call site.

export interface MessagingPort {
  sendSms(to: string, body: string): Promise<void>;
  sendEmail(to: string, subject: string, body: string): Promise<void>;
}

export const NoopMessagingAdapter: MessagingPort = {
  sendSms: async () => { /* noop — flag off in pilot */ },
  sendEmail: async () => { /* noop — flag off in pilot */ },
};
