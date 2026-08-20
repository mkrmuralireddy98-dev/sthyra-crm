/**
 * Dashboard HTTP layer — 8 HTML routes + /v1/health.
 */

import Fastify, { type FastifyInstance } from 'fastify';
import { randomUUID } from 'node:crypto';
import { installRequestIdPlugin, currentRequestId } from '@sthyra-crm/observability';
import { DashboardService, StubDashboardFetcher } from './service.js';
import { renderErrorPage } from './layout.js';

export interface BuildServerDeps {
 readonly service?: DashboardService;
  readonly fetcher?: StubDashboardFetcher;
}

function getTenant(req: { headers: Record<string, string | string[] | undefined> }): string {
  const t = req.headers['x-tenant-id'];
  return (Array.isArray(t) ? t[0] : t ?? '').toString().trim();
}

function rid(): string { return currentRequestId() ?? randomUUID(); }

export async function buildDashboardServer(deps: BuildServerDeps = {}): Promise<FastifyInstance> {
  const app = Fastify({ logger: false, disableRequestLogging: true });
  installRequestIdPlugin(app);

  const fetcher = deps.fetcher ?? new StubDashboardFetcher();
  const service = deps.service ?? new DashboardService(fetcher);

  app.get('/v1/health', async () => ({ status: 'ok', service: 'dashboard' }));

  // FR-1: GET /
  app.get('/', async (req, reply) => {
    const orgId = getTenant(req) || 'public';
    reply.header('content-type', 'text/html');
    return service.renderHome(orgId);
  });

  // FR-2: GET /projects/:projectId
  app.get('/projects/:projectId', async (req, reply) => {
    const orgId = getTenant(req);
    if (!orgId) {
      reply.code(401);
      reply.header('content-type', 'text/html');
      return renderErrorPage(401, 'Unauthorized', 'x-tenant-id header is required', rid());
    }
    const projectId = ((req.params as { projectId?: string }).projectId ?? '').trim();
    reply.header('content-type', 'text/html');
    return service.renderProject(orgId, projectId);
  });

  // FR-3: GET /projects/:projectId/issues
  app.get('/projects/:projectId/issues', async (req, reply) => {
    const orgId = getTenant(req) || 'public';
    const projectId = ((req.params as { projectId?: string }).projectId ?? '').trim();
    const status = (req.query as { status?: string }).status;
    reply.header('content-type', 'text/html');
    return service.renderIssues(orgId, projectId, status);
  });

  // FR-4: GET /projects/:projectId/issues/:issueId
  app.get('/projects/:projectId/issues/:issueId', async (req, reply) => {
    const orgId = getTenant(req) || 'public';
    const projectId = ((req.params as { projectId?: string }).projectId ?? '').trim();
    const issueId = ((req.params as { issueId?: string }).issueId ?? '').trim();
    reply.header('content-type', 'text/html');
    return service.renderIssue(orgId, projectId, issueId);
  });

  // FR-5: GET / POST /projects/:projectId/copilot
  app.get('/projects/:projectId/copilot', async (req, reply) => {
    const orgId = getTenant(req) || 'public';
    const projectId = ((req.params as { projectId?: string }).projectId ?? '').trim();
    reply.header('content-type', 'text/html');
    return service.renderCopilotForm(orgId, projectId);
  });

  app.post('/projects/:projectId/copilot', async (req, reply) => {
    const orgId = getTenant(req) || 'public';
    const projectId = ((req.params as { projectId?: string }).projectId ?? '').trim();
    const body = req.body as { text?: string } | undefined;
    if (!body || !body.text) {
      reply.code(400);
      reply.header('content-type', 'text/html');
      return renderErrorPage(400, 'Bad Request', 'text is required', rid());
    }
    reply.header('content-type', 'text/html');
    return service.renderCopilotReply(orgId, projectId, body.text);
  });

  // FR-6: GET /projects/:projectId/reports/daily + /orgs/:orgId/reports/weekly
  app.get('/projects/:projectId/reports/daily', async (req, reply) => {
    const orgId = getTenant(req) || 'public';
    const projectId = ((req.params as { projectId?: string }).projectId ?? '').trim();
    const dateStr = (req.query as { date?: string }).date ?? new Date().toISOString().slice(0, 10);
    const date = new Date(dateStr + 'T00:00:00Z');
    reply.header('content-type', 'text/html');
    return service.renderDailyReport(orgId, projectId, isNaN(date.getTime()) ? new Date() : date);
  });

  app.get('/orgs/:orgId/reports/weekly', async (req, reply) => {
    const orgId = getTenant(req) || 'public';
    reply.header('content-type', 'text/html');
    return service.renderWeeklyReport(orgId);
  });

  // FR-7: GET /projects/:projectId/milestones
  app.get('/projects/:projectId/milestones', async (req, reply) => {
    const orgId = getTenant(req) || 'public';
    const projectId = ((req.params as { projectId?: string }).projectId ?? '').trim();
    reply.header('content-type', 'text/html');
    return service.renderMilestones(orgId, projectId);
  });

  // FR-8: GET /orgs/:orgId/workflows + /orgs/:orgId/integrations
  app.get('/orgs/:orgId/workflows', async (req, reply) => {
    const orgId = getTenant(req) || 'public';
    const pathOrgId = ((req.params as { orgId?: string }).orgId ?? '').trim();
    if (orgId !== pathOrgId) {
      reply.code(404);
      reply.header('content-type', 'text/html');
      return renderErrorPage(404, 'Not Found', 'Tenant mismatch', rid());
    }
    reply.header('content-type', 'text/html');
    return service.renderWorkflows(orgId);
  });

  app.get('/orgs/:orgId/integrations', async (req, reply) => {
    const orgId = getTenant(req) || 'public';
    const pathOrgId = ((req.params as { orgId?: string }).orgId ?? '').trim();
    if (orgId !== pathOrgId) {
      reply.code(404);
      reply.header('content-type', 'text/html');
      return renderErrorPage(404, 'Not Found', 'Tenant mismatch', rid());
    }
    reply.header('content-type', 'text/html');
    return service.renderIntegrations(orgId);
  });

  return app;
}
