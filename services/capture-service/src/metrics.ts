/**
 * /v1/metrics — Prometheus-compatible scrape endpoint.
 *
 * Phase 1 MVP exposes:
 *   - capture_pipeline_runs_total{status=ready|failed} (counter)
 *   - capture_dlq_entries_total (counter)
 *   - capture_active_uploads (gauge)
 *   - capture_pipeline_duration_seconds (histogram — count + sum only)
 *
 * The HTTP route is just the scrape endpoint. The orchestrator /
 * PipelineRunTracker / DLQ call metrics.* setters to update values.
 */

import type { FastifyInstance } from 'fastify';

export interface Metrics {
 incPipelineRun(status: 'ready' | 'failed'): void;
 incDlq(): void;
 incActiveUpload(): void;
 decActiveUpload(): void;
 recordPipelineDuration(seconds: number): void;
 snapshot(): string;
}

class PrometheusMetricsImpl implements Metrics {
 private pipelineRuns = { ready: 0, failed: 0 };
 private dlq = 0;
 private activeUploads = 0;
 private pipelineDurations = { count: 0, sum: 0 };

 incPipelineRun(status: 'ready' | 'failed'): void {
 this.pipelineRuns[status]++;
 }

 incDlq(): void {
 this.dlq++;
 }

 incActiveUpload(): void {
 this.activeUploads++;
 }

 decActiveUpload(): void {
 this.activeUploads = Math.max(0, this.activeUploads - 1);
 }

 recordPipelineDuration(seconds: number): void {
 this.pipelineDurations.count++;
 this.pipelineDurations.sum += seconds;
 }

 snapshot(): string {
 const lines: string[] = [];
 lines.push('# HELP capture_pipeline_runs_total Total pipeline runs that reached a terminal state, by status.');
 lines.push('# TYPE capture_pipeline_runs_total counter');
 lines.push(`capture_pipeline_runs_total{status="ready"} ${this.pipelineRuns.ready}`);
 lines.push(`capture_pipeline_runs_total{status="failed"} ${this.pipelineRuns.failed}`);

 lines.push('# HELP capture_dlq_entries_total Total DLQ entries written.');
 lines.push('# TYPE capture_dlq_entries_total counter');
 lines.push(`capture_dlq_entries_total ${this.dlq}`);

 lines.push('# HELP capture_active_uploads Active upload sessions in flight.');
 lines.push('# TYPE capture_active_uploads gauge');
 lines.push(`capture_active_uploads ${this.activeUploads}`);

 lines.push('# HELP capture_pipeline_duration_seconds Pipeline execution duration in seconds.');
 lines.push('# TYPE capture_pipeline_duration_seconds histogram');
 lines.push(`capture_pipeline_duration_seconds_count ${this.pipelineDurations.count}`);
 lines.push(`capture_pipeline_duration_seconds_sum ${this.pipelineDurations.sum.toFixed(3)}`);

 return lines.join('\n') + '\n';
 }
}

export const metrics: Metrics = new PrometheusMetricsImpl();

export function installMetricsPlugin(app: FastifyInstance): void {
 app.get('/v1/metrics', async (_req, reply) => {
 void reply.header('content-type', 'text/plain; version=0.0.4');
 return metrics.snapshot();
 });
}
