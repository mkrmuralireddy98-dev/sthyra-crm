/**
 * Closeout SSE — project-scoped punch list events (FR-8).
 *
 * GET /v1/projects/:projectId/closeout/events
 *   → text/event-stream
 *   → emits punch.* events for the subscribed (orgId, projectId)
 */

import { randomUUID } from 'node:crypto';
import type { FastifyInstance } from 'fastify';
import type { IssueEvent, IssueEventBus } from './index.js';

export type CloseoutEventType =
  | 'punch.created'
  | 'punch.assigned'
  | 'punch.resolved'
  | 'punch.inspected'
  | 'punch.reopened';

export interface CloseoutEvent {
  readonly type: CloseoutEventType;
  readonly projectId: string;
  readonly orgId: string;
  readonly issueId: string;
  readonly occurredAt: Date;
}

function formatSSE(event: CloseoutEvent, id: string): string {
  return `id: ${id}\nevent: ${event.type}\ndata: ${JSON.stringify(event)}\n\n`;
}

const TYPE_MAP: Record<IssueEvent['type'], CloseoutEventType> = {
  'issue.created': 'punch.created',
  'issue.updated': 'punch.assigned',
  'issue.commented': 'punch.assigned',
  'issue.resolved': 'punch.resolved',
  'issue.reopened': 'punch.reopened',
  'issue.closed': 'punch.inspected',
};

export function bridgeIssueEvent(event: IssueEvent, projectId: string): CloseoutEvent | null {
  if (event.projectId !== projectId) return null;
  const closeoutType = TYPE_MAP[event.type];
  if (!closeoutType) return null;
  return {
    type: closeoutType,
    projectId: event.projectId,
    orgId: event.orgId,
    issueId: event.issueId,
    occurredAt: event.occurredAt,
  };
}

export async function installCloseoutSSE(app: FastifyInstance, bus: IssueEventBus): Promise<void> {
  app.get('/v1/projects/:projectId/closeout/events', async (req, reply) => {
    const rid = randomUUID();
    void reply.header('x-request-id', rid);
    const tenant = (req.headers['x-tenant-id'] as string | undefined)?.trim() ?? '';
    if (!tenant) {
      reply.code(401);
      return reply.header('content-type', 'application/problem+json')
        .send({
          type: 'https://sthyra-crm.dev/errors/unauthorized',
          status: 401,
          title: 'Missing tenant',
          detail: 'x-tenant-id header is required',
          code: 'unauthorized',
          trace_id: rid,
        });
    }
    const projectId = ((req.params as { projectId?: string }).projectId ?? '').trim();
    if (!projectId) {
      reply.code(400);
      return reply.send({ error: 'missing projectId' });
    }

    reply.raw.writeHead(200, {
      'content-type': 'text/event-stream',
      'cache-control': 'no-cache',
      'connection': 'keep-alive',
      'x-accel-buffering': 'no',
    });

    // Bridge: the bus.subscribe is issue-scoped. We tap into it via a wildcard.
    const unsub = bus.subscribe(tenant, '*__closeout__', (e: IssueEvent) => {
      if (e.orgId !== tenant) return;
      const bridged = bridgeIssueEvent(e, projectId);
      if (bridged) reply.raw.write(formatSSE(bridged, randomUUID()));
    });

    const heartbeat = setInterval(() => {
      reply.raw.write(`: heartbeat ${new Date().toISOString()}\n\n`);
    }, 30_000);

    // ?once=1 closes after a brief moment (used by tests)
    const q = (req.query as { once?: string });
    if (q.once === '1') {
      setTimeout(() => {
        clearInterval(heartbeat);
        unsub();
        reply.raw.end();
      }, 100);
      return;
    }

    reply.raw.on('close', () => {
      clearInterval(heartbeat);
      unsub();
    });
  });
}
