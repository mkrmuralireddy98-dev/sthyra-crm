import { describe, it, beforeEach } from 'node:test';
import * as assert from 'node:assert/strict';
import Fastify, { type FastifyInstance } from 'fastify';
import { installMetricsPlugin, metrics } from './metrics.js';

describe('installMetricsPlugin — /v1/metrics', () => {
 let app: FastifyInstance;

 beforeEach(async () => {
 app = Fastify({ logger: false });
 installMetricsPlugin(app);
 await app.ready();
 });

 it('returns 200 with Prometheus text format', async () => {
 const res = await app.inject({ method: 'GET', url: '/v1/metrics' });
 assert.equal(res.statusCode, 200);
 assert.match(res.headers['content-type'] ?? '', /text\/plain/);
 });

 it('exposes capture_pipeline_runs_total counter', async () => {
 metrics.incPipelineRun('ready');
 const res = await app.inject({ method: 'GET', url: '/v1/metrics' });
 assert.match(res.body, /capture_pipeline_runs_total/);
 assert.match(res.body, /capture_pipeline_runs_total\{status="ready"\} \d+/);
 });

 it('exposes capture_dlq_entries_total counter', async () => {
 metrics.incDlq();
 const res = await app.inject({ method: 'GET', url: '/v1/metrics' });
 assert.match(res.body, /capture_dlq_entries_total/);
 });

 it('exposes capture_active_uploads gauge', async () => {
 metrics.incActiveUpload();
 const res = await app.inject({ method: 'GET', url: '/v1/metrics' });
 assert.match(res.body, /capture_active_uploads/);
 });

 it('does not require authentication (Prometheus scrapes unauthenticated)', async () => {
 const res = await app.inject({ method: 'GET', url: '/v1/metrics' });
 assert.equal(res.statusCode, 200);
 });

 it('recordPipelineDuration adds to count + sum', () => {
 const before = metrics.snapshot();
 metrics.recordPipelineDuration(0.123);
 const after = metrics.snapshot();
 assert.notEqual(before, after);
 });
});
