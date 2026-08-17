import { describe, it, afterEach } from 'node:test';
import * as assert from 'node:assert/strict';
import { startInMemoryServer, type StartedServer } from './cli.js';

describe('bim-viewer-service CLI — end-to-end smoke', () => {
 let started: StartedServer | null = null;

 afterEach(async () => {
 if (started) {
 await started.stop();
 started = null;
 }
 });

 it('boots and serves /v1/health', async () => {
 started = await startInMemoryServer();
 assert.ok(started.port > 0);
 const res = await fetch(`http://127.0.0.1:${started.port}/v1/health`);
 assert.equal(res.status, 200);
 const body = await res.json();
 assert.equal(body.status, 'ok');
 });

 it('boots and serves /v1/projects/:projectId/bim-model POST', async () => {
 started = await startInMemoryServer();
 const ifc = `ISO-10303-21;
HEADER;
FILE_SCHEMA(('IFC4X3'));
ENDSEC;
DATA;
#5=IFCBEAM('Beam',$,$,$,$,$,$);
ENDSEC;`;
 const res = await fetch(`http://127.0.0.1:${started.port}/v1/projects/prj_1/bim-model`, {
 method: 'POST',
 headers: { 'x-tenant-id': 'org_a', 'x-idempotency-key': 'i', 'content-type': 'application/json' },
 body: JSON.stringify({ fileName: 'l.ifc', modelHash: 'abc', schemaVersion: 'IFC4X3', ifcContent: ifc, createdBy: 'u' }),
 });
 assert.equal(res.status, 201);
 const body = await res.json();
 assert.ok(body.id.startsWith('bim_'));
 });

 it('cross-tenant probe returns 404 (no existence leak)', async () => {
 started = await startInMemoryServer();
 const ifc = `ISO-10303-21;
HEADER;
FILE_SCHEMA(('IFC4X3'));
ENDSEC;
DATA;
#5=IFCBEAM('B',$,$,$,$,$,$);
ENDSEC;`;
 const create = await fetch(`http://127.0.0.1:${started.port}/v1/projects/prj_1/bim-model`, {
 method: 'POST',
 headers: { 'x-tenant-id': 'org_a', 'x-idempotency-key': 'i', 'content-type': 'application/json' },
 body: JSON.stringify({ fileName: 'l.ifc', modelHash: 'abc', schemaVersion: 'IFC4X3', ifcContent: ifc, createdBy: 'u' }),
 });
 const model = await create.json();
 const cross = await fetch(`http://127.0.0.1:${started.port}/v1/projects/prj_1/bim-model`, {
 headers: { 'x-tenant-id': 'org_b' },
 });
 assert.equal(cross.status, 404);
 });

 it('boots and serves element-lookup', async () => {
 started = await startInMemoryServer();
 const ifc = `ISO-10303-21;
HEADER;
FILE_SCHEMA(('IFC4X3'));
ENDSEC;
DATA;
#5=IFCBEAM('Beam',$,$,$,$,$,$);
ENDSEC;`;
 await fetch(`http://127.0.0.1:${started.port}/v1/projects/prj_1/bim-model`, {
 method: 'POST',
 headers: { 'x-tenant-id': 'org_a', 'x-idempotency-key': 'i', 'content-type': 'application/json' },
 body: JSON.stringify({ fileName: 'l.ifc', modelHash: 'abc', schemaVersion: 'IFC4X3', ifcContent: ifc, createdBy: 'u' }),
 });
 const res = await fetch(`http://127.0.0.1:${started.port}/v1/projects/prj_1/bim-model/element-lookup`, {
 method: 'POST',
 headers: { 'x-tenant-id': 'org_a', 'content-type': 'application/json' },
 body: JSON.stringify({ x: 1.5, y: 0.5, z: 0.25 }),
 });
 assert.equal(res.status, 200);
 });
});
