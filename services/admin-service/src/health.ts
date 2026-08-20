/**
 * Health aggregator — calls /v1/health on all services in parallel.
 */

import type { SystemHealth, ServiceHealth, ServiceHealthStatus } from './types.js';

export interface ServiceEndpoint {
 readonly name: string;
 readonly url: string;
}

const DEFAULT_SERVICES: readonly ServiceEndpoint[] = [
 { name: 'capture-service', url: 'http://capture-service:9090/v1/health' },
 { name: 'field-service', url: 'http://field-service:9091/v1/health' },
 { name: 'bim-viewer-service', url: 'http://bim-viewer-service:9092/v1/health' },
 { name: 'ai-copilot-service', url: 'http://ai-copilot-service:9093/v1/health' },
 { name: 'mobile-bff-service', url: 'http://mobile-bff-service:9094/v1/health' },
 { name: 'track-service', url: 'http://track-service:9095/v1/health' },
 { name: 'report-service', url: 'http://report-service:9096/v1/health' },
 { name: 'workflow-service', url: 'http://workflow-service:9097/v1/health' },
 { name: 'integration-service', url: 'http://integration-service:9098/v1/health' },
 { name: 'dashboard-service', url: 'http://dashboard-service:9099/v1/health' },
 { name: 'user-service', url: 'http://user-service:9104/v1/health' },
 { name: 'org-service', url: 'http://org-service:9103/v1/health' },
];

export class HealthChecker {
 constructor(private readonly endpoints: readonly ServiceEndpoint[] = DEFAULT_SERVICES) {}

 async checkAll(timeoutMs = 5000): Promise<SystemHealth> {
 const checks = await Promise.all(
 this.endpoints.map(s => this.checkOne(s, timeoutMs))
 );
 const unhealthy = checks.filter(c => c.status === 'unhealthy').length;
 const degraded = checks.filter(c => c.status === 'degraded').length;
 let status: ServiceHealthStatus = 'healthy';
 if (unhealthy > 0) status = 'unhealthy';
 else if (degraded > 0) status = 'degraded';
 return { status, services: checks, checkedAt: new Date() };
 }

 private async checkOne(s: ServiceEndpoint, timeoutMs: number): Promise<ServiceHealth> {
 const start = Date.now();
 try {
 const controller = new AbortController();
 const timer = setTimeout(() => controller.abort(), timeoutMs);
 const res = await fetch(s.url, { signal: controller.signal });
 clearTimeout(timer);
 const latency = Date.now() - start;
 if (res.ok) {
 return {
 service: s.name, status: 'healthy', latencyMs: latency,
 checkedAt: new Date(), error: null,
 };
 }
 return {
 service: s.name, status: 'unhealthy', latencyMs: latency,
 checkedAt: new Date(), error: `HTTP ${res.status}`,
 };
 } catch (err: any) {
 return {
 service: s.name, status: 'unhealthy', latencyMs: null,
 checkedAt: new Date(), error: err.message || 'fetch failed',
 };
 }
 }
}
