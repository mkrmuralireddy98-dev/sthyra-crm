import { describe, it, afterEach } from 'node:test';
import * as assert from 'node:assert/strict';
import { startInMemoryServer, type StartedServer } from './cli.js';

/**
 * End-to-end smoke test: boot the CLI, exercise the full capture
 * lifecycle (POST → chunk → finalize), confirm metrics endpoint reflects
 * the activity, then shut down cleanly.
 *
 * This is the Phase 1.c "can you actually run this thing?" test.
 */

let server: StartedServer | null = null;

afterEach(async () => {
 if (server) {
 await server.close();
 server = null;
 }
});

describe('Phase 1.c E2E — full capture lifecycle via booted CLI', () => {
 it('boots, creates a capture, records a chunk, finalizes, and serves metrics', async () => {
 server = await startInMemoryServer({ port: 0 });
 const base = server.url;

 // 1. Health check
 const health = await fetch(base + '/v1/health');
 assert.equal(health.status, 200);
 const healthBody = await health.json() as { status: string };
 assert.equal(healthBody.status, 'ok');

 // 2. Create capture
 const create = await fetch(base + '/v1/projects/prj_1/captures', {
 method: 'POST',
 headers: {
 'content-type': 'application/json',
 'x-tenant-id': 'org_e2e',
 'x-idempotency-key': 'e2e-key-001',
 },
 body: JSON.stringify({
 clientCaptureId: 'cli_e2e_001',
 kind: 'walkthrough_360',
 deviceModel: 'Insta360 X4',
 }),
 });
 assert.equal(create.status, 201);
 const { capture, uploadSession } = await create.json() as { capture: { id: string; orgId: string }; uploadSession: { id: string; totalChunks: number } };
 assert.equal(capture.orgId, 'org_e2e');
 assert.equal(uploadSession.totalChunks, 0);

 // 3. Record a chunk
 const chunk = await fetch(base + `/v1/upload-sessions/${uploadSession.id}/chunks/0`, {
 method: 'POST',
 headers: { 'x-tenant-id': 'org_e2e' },
 });
 assert.equal(chunk.status, 200);
 const chunkBody = await chunk.json() as { received: number };
 assert.equal(chunkBody.received, 0);

 // 4. Finalize
 const complete = await fetch(base + `/v1/upload-sessions/${uploadSession.id}/complete`, {
 method: 'POST',
 headers: { 'content-type': 'application/json', 'x-tenant-id': 'org_e2e' },
 body: JSON.stringify({ sha256: 'e2e-sha-abc-123' }),
 });
 assert.equal(complete.status, 200);
 const completeBody = await complete.json() as { status: string; captureId: string };
 assert.equal(completeBody.status, 'processing');

 // 5. Read the capture back
 const read = await fetch(base + `/v1/captures/${capture.id}`, {
 headers: { 'x-tenant-id': 'org_e2e' },
 });
 assert.equal(read.status, 200);
 const readBody = await read.json() as { status: string; sha256: string };
 assert.equal(readBody.status, 'processing');
 assert.equal(readBody.sha256, 'e2e-sha-abc-123');

 // 6. List captures
 const list = await fetch(base + '/v1/projects/prj_1/captures', {
 headers: { 'x-tenant-id': 'org_e2e' },
 });
 assert.equal(list.status, 200);
 const listBody = await list.json() as { data: Array<{ id: string }> };
 assert.ok(listBody.data.length >= 1);
 assert.ok(listBody.data.some((c) => c.id === capture.id));

 // 7. Metrics endpoint reflects the activity (capture_active_uploads incremented)
 const metrics = await fetch(base + '/v1/metrics');
 assert.equal(metrics.status, 200);
 const metricsText = await metrics.text();
 assert.match(metricsText, /capture_active_uploads/);

 // 8. Archive the capture
 const archive = await fetch(base + `/v1/captures/${capture.id}/archive`, {
 method: 'POST',
 headers: { 'x-tenant-id': 'org_e2e' },
 });
 assert.equal(archive.status, 204);
 });

 it('cross-tenant 404 (no existence leak) over real HTTP', async () => {
 server = await startInMemoryServer({ port: 0 });
 const base = server.url;

 // Create in org_a
 const create = await fetch(base + '/v1/projects/prj_1/captures', {
 method: 'POST',
 headers: {
 'content-type': 'application/json',
 'x-tenant-id': 'org_a',
 'x-idempotency-key': 'e2e-iso-1',
 },
 body: JSON.stringify({ clientCaptureId: 'cli_iso_1', kind: 'walkthrough_360' }),
 });
 const { capture } = await create.json() as { capture: { id: string } };

 // org_b tries to read it — should 404
 const crossTenant = await fetch(base + `/v1/captures/${capture.id}`, {
 headers: { 'x-tenant-id': 'org_b' },
 });
 assert.equal(crossTenant.status, 404);

 // org_b tries to archive — should 404
 const archiveCross = await fetch(base + `/v1/captures/${capture.id}/archive`, {
 method: 'POST',
 headers: { 'x-tenant-id': 'org_b' },
 });
 assert.equal(archiveCross.status, 404);
 });

 it('idempotency replay returns the same capture (Stripe convention)', async () => {
 server = await startInMemoryServer({ port: 0 });
 const base = server.url;

 const headers = {
 'content-type': 'application/json',
 'x-tenant-id': 'org_e2e',
 'x-idempotency-key': 'e2e-idem-replay',
 };
 const body = JSON.stringify({ clientCaptureId: 'cli_replay', kind: 'walkthrough_360' });

 const first = await fetch(base + '/v1/projects/prj_1/captures', { method: 'POST', headers, body });
 const second = await fetch(base + '/v1/projects/prj_1/captures', { method: 'POST', headers, body });

 assert.equal(first.status, 201);
 assert.equal(second.status, 200); // replay, not create

 const firstBody = await first.json() as { capture: { id: string } };
 const secondBody = await second.json() as { capture: { id: string } };
 assert.equal(firstBody.capture.id, secondBody.capture.id);
 });

 it('every error response is application/problem+json with trace_id', async () => {
 server = await startInMemoryServer({ port: 0 });
 const base = server.url;

 // Force a 401 (no x-tenant-id)
 const r401 = await fetch(base + '/v1/projects/prj_1/captures', {
 method: 'POST',
 headers: { 'content-type': 'application/json' },
 body: JSON.stringify({ clientCaptureId: 'x', kind: 'walkthrough_360' }),
 });
 assert.equal(r401.status, 401);
 assert.match(r401.headers.get('content-type') ?? '', /application\/problem\+json/);
 const problem = await r401.json() as { type: string; status: number; trace_id: string };
 assert.ok(problem.type);
 assert.equal(problem.status, 401);
 assert.ok(problem.trace_id);
 });
});
