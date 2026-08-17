/**
 * OtelMetrics — OTel-backed Metrics implementation with parallel snapshot.
 */

import type { Metrics } from './metrics.js';
import type { OtelMeter } from './metrics-otel.js';

export interface OtelMetricsDeps {
 readonly meter: OtelMeter;
}

export class OtelMetrics implements Metrics {
 private readonly meter: OtelMeter;
 private readonly state = {
 pipelineRunsReady: 0,
 pipelineRunsFailed: 0,
 dlq: 0,
 activeUploads: 0,
 pipelineDurationsCount: 0,
 pipelineDurationsSum: 0,
 };

 constructor(deps: OtelMetricsDeps) {
 this.meter = deps.meter;
 }

 incPipelineRun(status: 'ready' | 'failed'): void {
 if (status === 'ready') {
 this.state.pipelineRunsReady++;
 this.meter.createCounter('capture_pipeline_runs_total').add(1, { status: 'ready' });
 } else {
 this.state.pipelineRunsFailed++;
 this.meter.createCounter('capture_pipeline_runs_total').add(1, { status: 'failed' });
 }
 }

 incDlq(): void {
 this.state.dlq++;
 this.meter.createCounter('capture_dlq_entries_total').add(1);
 }

 incActiveUpload(): void {
 this.state.activeUploads++;
 this.meter.createUpDownCounter('capture_active_uploads').add(1);
 }

 decActiveUpload(): void {
 this.state.activeUploads = Math.max(0, this.state.activeUploads - 1);
 this.meter.createUpDownCounter('capture_active_uploads').add(-1);
 }

 recordPipelineDuration(seconds: number): void {
 this.state.pipelineDurationsCount++;
 this.state.pipelineDurationsSum += seconds;
 this.meter.createCounter('capture_pipeline_duration_seconds').add(1, { kind: 'count' });
 this.meter.createCounter('capture_pipeline_duration_seconds').add(seconds, { kind: 'sum' });
 }

 snapshot(): string {
 const s = this.state;
 const lines = [
 '# HELP capture_pipeline_runs_total Total pipeline runs that reached a terminal state, by status.',
 '# TYPE capture_pipeline_runs_total counter',
 `capture_pipeline_runs_total{status="ready"} ${s.pipelineRunsReady}`,
 `capture_pipeline_runs_total{status="failed"} ${s.pipelineRunsFailed}`,
 '# HELP capture_dlq_entries_total Total DLQ entries written.',
 '# TYPE capture_dlq_entries_total counter',
 `capture_dlq_entries_total ${s.dlq}`,
 '# HELP capture_active_uploads Active upload sessions in flight.',
 '# TYPE capture_active_uploads gauge',
 `capture_active_uploads ${s.activeUploads}`,
 '# HELP capture_pipeline_duration_seconds Pipeline execution duration in seconds.',
 '# TYPE capture_pipeline_duration_seconds histogram',
 `capture_pipeline_duration_seconds_count ${s.pipelineDurationsCount}`,
 `capture_pipeline_duration_seconds_sum ${s.pipelineDurationsSum.toFixed(3)}`,
 ];
 return lines.join(String.fromCharCode(10)) + String.fromCharCode(10);
 }
}
