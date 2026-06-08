// AC4 (E0-S10): Multi-cloud routing engine — out-of-scope for the pilot (ADR-012).
// Port interface only; no implementation. No cloud-provider SDK is referenced.

export interface MultiCloudPort {
  routeRequest(region: string, payload: unknown): Promise<unknown>;
}
