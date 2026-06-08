// AC4 (E0-S10): AI-agent engine — out-of-scope for the pilot (ADR-012).
// Port interface only; no implementation. No AI/ML SDK is referenced.

export interface AiAgentPort {
  processQuery(tenantId: string, query: string): Promise<string>;
}
