import Fastify, { type FastifyInstance } from 'fastify';
import { randomUUID } from 'node:crypto';
import { MembershipService, type OrgRole, type ProjectRole } from './index.js';
import { emit, installRequestIdPlugin } from '@plumb/observability';
import { installAuthPlugin } from '@plumb/auth';

interface BuildServerOptions {
  service: MembershipService;
  userServiceUrl?: string;
  verifyToken?: (token: string) => Promise<{ userId: string; orgId: string; role: string } | null>;
}

interface AddOrgMemberBody {
  userId?: unknown;
  orgId?: unknown;
  role?: unknown;
}

interface AddProjectMemberBody {
  userId?: unknown;
  projectId?: unknown;
  role?: unknown;
}

export function buildServer(opts: BuildServerOptions): FastifyInstance {
  const app = Fastify({ logger: false });
  installRequestIdPlugin(app);
  // Phase 0: trust the local token store via a verify seam.
  // Phase 1: set USER_SERVICE_URL and remove the seam.
  void installAuthPlugin(app, {
    userServiceUrl: opts.userServiceUrl ?? 'http://127.0.0.1:8084',
    verify: opts.verifyToken ?? (async () => null),
  });

  app.setErrorHandler((err: unknown, _req, reply) => {
    const trace_id = randomUUID();
    const detail = err instanceof Error ? err.message : String(err);
    emit('error', 'unhandled_error', { detail });
    reply.type('application/problem+json').status(500).send({
      type: 'https://plumb.dev/errors/internal',
      title: 'Internal Server Error',
      status: 500,
      detail,
      trace_id,
      code: 'internal_error',
    });
  });

  app.get('/v1/health', async () => ({ status: 'ok' }));

  app.post('/v1/orgs/:orgId/members', async (req, reply) => {
    const { orgId } = req.params as { orgId: string };
    const body = req.body as AddOrgMemberBody;
    if (!body || typeof body !== 'object') {
      reply.type('application/problem+json').status(422);
      return problem(422, 'Validation failed', 'request body must be a JSON object', 'validation_failed', trace_id());
    }
    try {
      const member = await opts.service.addOrgMember({
        userId: String(body.userId ?? ''),
        orgId,
        role: String(body.role ?? '') as OrgRole,
      });
      reply.status(201);
      return serializeOrgMember(member);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      const isDuplicate = /already a member/i.test(message);
      const status = isDuplicate ? 409 : 422;
      reply.type('application/problem+json').status(status);
      return problem(status, isDuplicate ? 'User already a member' : 'Validation failed', message, isDuplicate ? 'already_member' : 'validation_failed', trace_id());
    }
  });

  app.get('/v1/orgs/:orgId/members', async (req) => {
    const { orgId } = req.params as { orgId: string };
    const members = await opts.service.listOrgMembers(orgId);
    return { data: members.map(serializeOrgMember) };
  });

  app.post('/v1/projects/:projectId/members', async (req, reply) => {
    const { projectId } = req.params as { projectId: string };
    const body = req.body as AddProjectMemberBody;
    if (!body || typeof body !== 'object') {
      reply.type('application/problem+json').status(422);
      return problem(422, 'Validation failed', 'request body must be a JSON object', 'validation_failed', trace_id());
    }
    try {
      const member = await opts.service.addProjectMember({
        userId: String(body.userId ?? ''),
        projectId,
        role: String(body.role ?? '') as ProjectRole,
      });
      reply.status(201);
      return serializeProjectMember(member);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      reply.type('application/problem+json').status(422);
      return problem(422, 'Validation failed', message, 'validation_failed', trace_id());
    }
  });

  app.get('/v1/projects/:projectId/members', async (req) => {
    const { projectId } = req.params as { projectId: string };
    const members = await opts.service.listProjectMembers(projectId);
    return { data: members.map(serializeProjectMember) };
  });

  app.get('/v1/users/:userId/projects', async (req) => {
    const { userId } = req.params as { userId: string };
    const projects = await opts.service.listProjectsForUser(userId);
    return { data: projects.map(serializeProjectMember) };
  });

  app.delete('/v1/orgs/:orgId/members/:userId', async (req, reply) => {
    const { orgId, userId } = req.params as { orgId: string; userId: string };
    await opts.service.removeOrgMember(userId, orgId);
    reply.status(204).send();
  });

  return app;
}

function trace_id(): string {
  return randomUUID();
}

function problem(
  status: number,
  title: string,
  detail: string,
  code: string,
  trace_id: string,
): Record<string, unknown> {
  return {
    type: `https://plumb.dev/errors/${code}`,
    title,
    status,
    detail,
    trace_id,
    code,
  };
}

function serializeOrgMember(m: { id: string; userId: string; orgId: string; role: string; createdAt: Date }) {
  return {
    id: m.id,
    userId: m.userId,
    orgId: m.orgId,
    role: m.role,
    createdAt: m.createdAt.toISOString(),
  };
}

function serializeProjectMember(m: {
  id: string;
  userId: string;
  projectId: string;
  role: string;
  createdAt: Date;
}) {
  return {
    id: m.id,
    userId: m.userId,
    projectId: m.projectId,
    role: m.role,
    createdAt: m.createdAt.toISOString(),
  };
}
