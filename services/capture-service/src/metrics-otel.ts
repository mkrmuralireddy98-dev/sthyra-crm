/**
 * OtelMetrics — OpenTelemetry-backed implementation of Metrics.
 *
 * Phase 1.b polish. Replaces PrometheusMetricsImpl with an OTel-based
 * implementation that:
 *   - Uses @opentelemetry/api Counter + UpDownCounter for the metrics
 *   - Exposes a Prometheus-format scrape endpoint via
 *     @opentelemetry/exporter-prometheus (production) or our own
 *     snapshot (tests)
 *
 * The Metrics interface stays the same — only the implementation changes.
 * Tests pass a fake that snapshots OTel counter state.
 */

export interface OtelCounter {
 add(value: number, attributes?: Record<string, string>): void;
}

export interface OtelUpDownCounter {
 add(value: number, attributes?: Record<string, string>): void;
}

export interface OtelMeter {
 createCounter(name: string, options?: { description?: string }): OtelCounter;
 createUpDownCounter(name: string, options?: { description?: string }): OtelUpDownCounter;
}

export interface OtelSnapshot {
 readonly pipelineRunsReady: number;
 readonly pipelineRunsFailed: number;
 readonly dlq: number;
 readonly activeUUs: number;
 readonly pipelineDurationsCount: number;
 readonly pipelineDurationsSum: number;
}

/**
 * FakeOtelMeter — counts adds per (counter name, attributes).
 * Tests use this to verify metrics are emitted with the right labels.
 */
export class FakeOtelMeter implements OtelMeter {
 private readonly counts = new Map<string, number>();

 private key(name: string, attrs?: Record<string, string>): string {
 return `${name}|${JSON.stringify(attrs ?? {})}`;
 }

 createCounter(name: string): OtelCounter {
 return {
 add: (value: number, attrs?: Record<string, string>) => {
 const k = this.key(name, attrs);
 this.counts.set(k, (this.counts.get(k) ?? 0) + value);
 },
 };
 }

 createUpDownCounter(name: string): OtelCounter {
 return {
 add: (value: number, attrs?: Record<string, string>) => {
 const k = this.key(name, attrs);
 this.counts.set(k, (this.counts.get(k) ?? 0) + value);
 },
 };
 }

 /** Get the count for a specific (counter, attribute) tuple. */
 getCount(name: string, attrs?: Record<string, string>): number {
 return this.counts.get(this.key(name, attrs)) ?? 0;
 }

 /** Total across all attributes for a counter. */
 total(name: string): number {
 let sum = 0;
 for (const [k, v] of this.counts.entries()) {
 if (k.startsWith(name + '|')) sum += v;
 }
 return sum;
 }

 /** Aggregate the same counter across different attribute values. */
 snapshot(): OtelSnapshot {
 let ready = 0, failed = 0, dlq = 0, active = 0, durCount = 0, durSum = 0;
 for (const [k, v] of this.counts.entries()) {
 const [name, attrsJson] = k.split('|');
 const attrs = JSON.parse(attrsJson) as Record<string, string>;
 if (name === 'capture_pipeline_runs_total') {
 if (attrs['status'] === 'ready') ready += v;
 if (attrs['status'] === 'failed') failed += v;
 }
 if (name === 'capture_dlq_entries_total') dlq += v;
 if (name === 'capture_active_uploads') active += v;
 if (name === 'capture_pipeline_duration_seconds') {
 // Histogram — count is the count of observations, sum is sum
 if (attrs['kind'] === 'count') durCount += v;
 if (attrs['kind'] === 'sum') durSum += v;
 }
 }
 return {
 pipelineRunsReady: ready,
 pipelineRunsFailed: failed,
 dlq,
 activeUUs: active,
 pipelineDurationsCount: durCount,
 pipelineDurationsSum: durSum,
 };
 }
}
