import { describe, it, beforeEach } from 'node:test';
import * as assert from 'node:assert/strict';
import { OtelMetrics } from './metrics-otel-impl.js';
import { FakeOtelMeter } from './metrics-otel.js';

// Wire metrics-otel-impl to metrics module path
import './metrics-otel-impl.js';

describe('OtelMetrics — OTel-backed Prometheus format', () => {
 let meter: FakeOtelMeter;
 let metrics: OtelMetrics;

 beforeEach(() => {
 meter = new FakeOtelMeter();
 metrics = new OtelMetrics({ meter });
 });

 it('incPipelineRun emits to OTel meter with status label', () => {
 metrics.incPipelineRun('ready');
 assert.equal(meter.total('capture_pipeline_runs_total'), 1);
 assert.equal(meter.getCount('capture_pipeline_runs_total', { status: 'ready' }), 1);
 });

 it('incPipelineRun tracks ready and failed separately', () => {
 metrics.incPipelineRun('ready');
 metrics.incPipelineRun('ready');
 metrics.incPipelineRun('failed');
 assert.equal(meter.getCount('capture_pipeline_runs_total', { status: 'ready' }), 2);
 assert.equal(meter.getCount('capture_pipeline_runs_total', { status: 'failed' }), 1);
 });

 it('incDlq emits to OTel meter', () => {
 metrics.incDlq();
 metrics.incDlq();
 assert.equal(meter.getCount('capture_dlq_entries_total'), 2);
 });

 it('incActiveUpload + decActiveUpload tracks gauge', () => {
 metrics.incActiveUpload();
 metrics.incActiveUpload();
 metrics.decActiveUpload();
 assert.equal(meter.getCount('capture_active_uploads'), 1);
 });

 it('recordPipelineDuration tracks count + sum via OTel labels', () => {
 metrics.recordPipelineDuration(0.123);
 metrics.recordPipelineDuration(0.456);
 assert.equal(meter.getCount('capture_pipeline_duration_seconds', { kind: 'count' }), 2);
 assert.equal(meter.getCount('capture_pipeline_duration_seconds', { kind: 'sum' }), 0.579);
 });

 it('snapshot() returns Prometheus text format with all metrics', () => {
 metrics.incPipelineRun('ready');
 metrics.incDlq();
 metrics.incActiveUpload();
 metrics.recordPipelineDuration(1.5);
 const text = metrics.snapshot();
 assert.match(text, /capture_pipeline_runs_total/);
 assert.match(text, /capture_dlq_entries_total/);
 assert.match(text, /capture_active_uploads/);
 assert.match(text, /capture_pipeline_duration_seconds_count 1/);
 assert.match(text, /capture_pipeline_duration_seconds_sum 1\.500/);
 });

 it('decActiveUpload does not go below 0', () => {
 metrics.decActiveUpload();
 metrics.decActiveUpload();
 const text = metrics.snapshot();
 assert.match(text, /capture_active_uploads 0/);
 });

 it('handles snapshot from scratch (all zeros)', () => {
 const text = metrics.snapshot();
 assert.match(text, /capture_pipeline_runs_total\{status="ready"\} 0/);
 assert.match(text, /capture_pipeline_runs_total\{status="failed"\} 0/);
 });
});
