import Fastify, { type FastifyInstance } from 'fastify';
import { randomUUID } from 'node:crypto';
import { ProjectService, type Project } from './index.js';

interface BuildServerOptions {
  service: ProjectService;
}

interface CreateProjectBody {
  orgId?: unknown;
  name?: unknown;
  address?: unknown;
  startedAt?: unknown;
  status?: unknown;
}

function deriveFieldFromMessage(message: string, isDuplicate: boolean): string | null {
  if (isDuplicate) return null;
  const m = message.match(/^(\w+) must/);
  return m ? (m[1]?.toLowerCase() ?? null) : null;
}

export function buildServer(opts: BuildServerOptions): FastifyInstance {
  const app = Fastify({ logger: false });

  app.setErrorHandler((err: unknown, _req, reply) => {
    const trace_id = randomUUID();
    const detail = err instanceof Error ? err.message : String(err);
    reply.type('application/problem+json').status(500).send({
      type: 'https://sthyra-crm.dev/errors/internal',
      title: 'Internal Server Error',
      status: 500,
      detail,
      trace_id,
      code: 'internal_error',
    });
  });

  app.get('/v1/health', async () => ({ status: 'ok' }));

  app.post('/v1/projects', async (req, reply) => {
    const body = req.body as CreateProjectBody;
    if (!body || typeof body !== 'object') {
      reply.type('application/problem+json').status(422);
      return {
        type: 'https://sthyra-crm.dev/errors/validation_failed',
        title: 'Validation failed',
        status: 422,
        detail: 'request body must be a JSON object',
        trace_id: randomUUID(),
        code: 'validation_failed',
      };
    }
    try {
      const startedAt =
        typeof body.startedAt === 'string' ? new Date(body.startedAt) : new Date(String(body.startedAt ?? ''));
      const project = await opts.service.create({
        orgId: String(body.orgId ?? ''),
        name: String(body.name ?? ''),
        address: String(body.address ?? ''),
        startedAt,
        ...(typeof body.status === 'string' ? { status: body.status as never } : {}),
      });
      reply.status(201);
      return serializeProject(project);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      const field = deriveFieldFromMessage(message, false);
      reply.type('application/problem+json').status(422);
      return {
        type: 'https://sthyra-crm.dev/errors/validation_failed',
        title: field ? `Invalid ${field}` : 'Validation failed',
        status: 422,
        detail: message,
        trace_id: randomUUID(),
        code: 'validation_failed',
      };
    }
  });

  app.get('/v1/projects', async (req, reply) => {
    const orgId = (req.query as { orgId?: string }).orgId;
    if (!orgId) {
      reply.type('application/problem+json').status(422);
      return {
        type: 'https://sthyra-crm.dev/errors/validation_failed',
        title: 'Missing orgId',
        status: 422,
        detail: 'orgId query parameter is required',
        trace_id: randomUUID(),
        code: 'validation_failed',
      };
    }
    const projects = await opts.service.list({ orgId });
    return { data: projects.map(serializeProject) };
  });

  app.get('/v1/projects/:id', async (req, reply) => {
    const { id } = req.params as { id: string };
    const project = await opts.service.get(id);
    if (!project) {
      reply.type('application/problem+json').status(404);
      return {
        type: 'https://sthyra-crm.dev/errors/not_found',
        title: 'Project not found',
        status: 404,
        detail: `No project with id "${id}".`,
        trace_id: randomUUID(),
        code: 'not_found',
      };
    }
    return serializeProject(project);
  });

  app.post('/v1/projects/:id/archive', async (req, reply) => {
    const { id } = req.params as { id: string };
    try {
      const archived = await opts.service.archive(id);
      return serializeProject(archived);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      const isAlreadyArchived = /already archived/i.test(message);
      const status = isAlreadyArchived ? 409 : 404;
      reply.type('application/problem+json').status(status);
      return {
        type: `https://sthyra-crm.dev/errors/${isAlreadyArchived ? 'conflict' : 'not_found'}`,
        title: isAlreadyArchived ? 'Project already archived' : 'Project not found',
        status,
        detail: message,
        trace_id: randomUUID(),
        code: isAlreadyArchived ? 'already_archived' : 'not_found',
      };
    }
  });

  return app;
}

function serializeProject(p: Project) {
  return {
    id: p.id,
    orgId: p.orgId,
    name: p.name,
    status: p.status,
    address: p.address,
    startedAt: p.startedAt.toISOString(),
    createdAt: p.createdAt.toISOString(),
    archivedAt: p.archivedAt?.toISOString(),
  };
}
