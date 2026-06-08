// AC3 (E0-S10): Cloud storage/services — port interface + Noop adapter.
// Guarded by flag `cloud.enabled` (hard-off in the pilot, ADR-012).
// No cloud-provider SDK is imported or referenced at any call site.

export interface CloudPort {
  uploadFile(key: string, data: Blob): Promise<string>;
  deleteFile(key: string): Promise<void>;
}

export const NoopCloudAdapter: CloudPort = {
  uploadFile: async () => '',
  deleteFile: async () => { /* noop — flag off in pilot */ },
};
