/**
 * Sthyra CRM — admin-service project routes
 * Adds project CRUD scoped to tenants.
 * Mounted at /v1/admin/tenants/:id/projects
 */

import type { FastifyInstance } from 'fastify';

interface ProjectRecord {
 id: string;
 tenantId: string;
 name: string;
 location: string;
 type: string;
 status: string;
 progressPct: number;
 createdAt: string;
}

const projects = new Map<string, ProjectRecord[]>();

export function registerProjectRoutes(app: FastifyInstance): void {
 // List projects for a tenant
 app.get('/v1/admin/tenants/:id/projects', async (req: any, reply: any) => {
 const tenantId = ((req.params as any).id ?? '').trim();
 const items = projects.get(tenantId) ?? [];
 reply.send({ data: items });
 });

 // Create project
 app.post('/v1/admin/tenants/:id/projects', async (req: any, reply: any) => {
 const tenantId = ((req.params as any).id ?? '').trim();
 const body = (req.body ?? {}) as { name?: string; location?: string; type?: string };
 if (!body.name || !body.location) {
 reply.code(400).send({
 type: 'https://sthyra-crm.dev/errors/invalid-input',
 title: 'Invalid input',
 status: 400,
 detail: 'name and location required',
 });
 return;
 }
 const id = `prj_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
 const project: ProjectRecord = {
 id,
 tenantId,
 name: body.name,
 location: body.location,
 type: body.type ?? 'commercial',
 status: 'planning',
 progressPct: 0,
 createdAt: new Date().toISOString(),
 };
 const existing = projects.get(tenantId) ?? [];
 projects.set(tenantId, [...existing, project]);
 reply.code(201).send(project);
 });

 // Update project
 app.patch('/v1/admin/tenants/:tenantId/projects/:projectId', async (req: any, reply: any) => {
 const tenantId = ((req.params as any).tenantId ?? '').trim();
 const projectId = ((req.params as any).projectId ?? '').trim();
 const items = projects.get(tenantId) ?? [];
 const idx = items.findIndex(p => p.id === projectId);
 if (idx < 0) {
 reply.code(404).send({ title: 'Not Found', status: 404, detail: 'project not found' });
 return;
 }
 const body = (req.body ?? {}) as Partial<ProjectRecord>;
 items[idx] = { ...items[idx], ...body, id: items[idx].id, tenantId: items[idx].tenantId };
 reply.send(items[idx]);
 });

 // Delete project
 app.delete('/v1/admin/tenants/:tenantId/projects/:projectId', async (req: any, reply: any) => {
 const tenantId = ((req.params as any).tenantId ?? '').trim();
 const projectId = ((req.params as any).projectId ?? '').trim();
 const items = projects.get(tenantId) ?? [];
 const filtered = items.filter(p => p.id !== projectId);
 projects.set(tenantId, filtered);
 reply.code(204).send();
 });
}
