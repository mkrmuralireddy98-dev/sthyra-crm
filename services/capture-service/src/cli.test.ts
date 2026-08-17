import { describe, it, afterEach } from 'node:test';
import * as assert from 'node:assert/strict';
import { startInMemoryServer, type StartedServer } from './cli.js';

describe('capture-service CLI — boot smoke (in-memory)', () => {
 let server: StartedServer | null = null;

 afterEach(async () => {
 if (server) {
 await server.close();
 server = null;
 }
 });

 it('boots an HTTP server listening on a random port', async () => {
 server = await startInMemoryServer({ port: 0 });
 assert.ok(server.port > 0);
 });

 it('GET /v1/health responds 200 on the booted server', async () => {
 server = await startInMemoryServer({ port: 0 });
 const res = await fetch(server.url + '/v1/health');
 assert.equal(res.status, 200);
 const body = await res.json() as { status: string };
 assert.equal(body.status, 'ok');
 });

 it('POST /v1/projects/:id/captures responds 201', async () => {
 server = await startInMemoryServer({ port: 0 });
 const res = await fetch(server.url + '/v1/projects/prj_1/captures', {
 method: 'POST',
 headers: {
 'content-type': 'application/json',
 'x-tenant-id': 'org_a',
 'x-idempotency-key': 'idem-1',
 },
 body: JSON.stringify({
 clientCaptureId: 'cli_001',
 kind: 'walkthrough_360',
 }),
 });
 assert.equal(res.status, 201);
 const body = await res.json() as { capture: { id: string; orgId: string } };
 assert.equal(body.capture.orgId, 'org_a');
 });

 it('GET /v1/metrics returns Prometheus-format text', async () => {
 server = await startInMemoryServer({ port: 0 });
 const res = await fetch(server.url + '/v1/metrics');
 assert.equal(res.status, 200);
 const text = await res.text();
 assert.match(text, /capture_pipeline_runs_total/);
 });
});
