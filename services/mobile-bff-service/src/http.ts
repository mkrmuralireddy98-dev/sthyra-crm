/**
 * Mobile BFF HTTP layer — 8 routes per spec.md FR-1 to FR-8.
 */

import Fastify, { type FastifyInstance } from 'fastify';
import { randomUUID } from 'node:crypto';
import { installRequestIdPlugin, currentRequestId } from '@sthyra-crm/observability';
import { MobileSessionService } from './service.js';
import type { MobileServiceDeps } from './service.js';
import type { MobileRepository } from './repository.js';
import { InMemoryMobileRepository } from './repo-memory.js';
import { verifyJwt, parseBearerToken } from './jwt.js';

interface RequestClaims {
  orgId: string;
  userId: string;
  deviceId: string;
}

export interface BuildServerDeps {
  readonly service?: MobileSessionService;
  readonly repo?: MobileRepository;
  readonly jwtSecret?: string;
}

const DEFAULT_JWT_SECRET = process.env.MOBILE_JWT_SECRET ?? 'sthyra-crm-mobile-jwt-secret-32b-padded';

function getTenant(req: { headers: Record<string, string | string[] | undefined> }): string {
  const t = req.headers['x-tenant-id'];
  return (Array.isArray(t) ? t[0] : t ?? '').toString().trim();
}

function getIdempotencyKey(req: { headers: Record<string, string | string[] | undefined> }): string {
  const k = req.headers['x-idempotency-key'];
  return (Array.isArray(k) ? k[0] : k ?? '').toString().trim();
}

interface ProblemJson {
  type: string; title: string; status: number;
  detail: string; trace_id: string; code: string;
}

function problem(
  reply: { code: (n: number) => unknown; header: (k: string, v: string) => unknown; send: (b: unknown) => unknown },
  status: number,
  type: string,
  title: string,
  detail: string,
  code: string,
  traceId: string,
): unknown {
  reply.header('content-type', 'application/problem+json');
  reply.code(status);
  return reply.send({ type, status, title, detail, trace_id: traceId, code } satisfies ProblemJson);
}

function rid(): string {
  return currentRequestId() ?? randomUUID();
}

interface RequestClaims {
  orgId: string;
  userId: string;
  deviceId: string;
}

/**
 * Helper: extract verified claims from Authorization header. Returns claims
 * on success, or null on failure. (Failure → call site returns 401.)
 */
function authenticate(req: { headers: Record<string, string | string[] | undefined> }, secret: string): RequestClaims | null {
  const token = parseBearerToken((req.headers.authorization as string | undefined) ?? undefined);
  if (!token) return null;
  try {
    return verifyJwt(token, secret);
  } catch {
    return null;
  }
}

export async function buildMobileServer(deps: BuildServerDeps = {}): Promise<FastifyInstance> {
  const app = Fastify({ logger: false, disableRequestLogging: true });
  installRequestIdPlugin(app);

  const repo = deps.repo ?? new InMemoryMobileRepository();
  const jwtSecret = deps.jwtSecret ?? DEFAULT_JWT_SECRET;
  const serviceDeps: MobileServiceDeps = { repo };
  const service = deps.service ?? new MobileSessionService(serviceDeps);

  app.get('/v1/health', async () => ({ status: 'ok' }));

  // T-017: JWT enforcement helper — call as a preHandler for routes that need claims
  const requireClaims = async (req: { headers: Record<string, string | string[] | undefined> }, reply: { code: (n: number) => unknown; header: (k: string, v: string) => unknown; send: (b: unknown) => unknown }) => {
    const traceId = rid();
    const claims = authenticate(req, jwtSecret);
    if (!claims) {
      return problem(reply, 401, 'https://sthyra-crm.dev/errors/unauthorized', 'Missing or invalid JWT', 'Authorization: Bearer <jwt> required (NFR-2)', 'unauthorized', traceId);
    }
    return claims;
  };

  // ─── FR-1: POST /v1/mobile/sessions ──────────────────────
  app.post('/v1/mobile/sessions', async (req, reply) => {
    const traceId = rid();
    const claims = await requireClaims(req, reply);
    if (!claims || typeof claims !== 'object' || !('orgId' in claims)) return;
    const idem = getIdempotencyKey(req);
    if (!idem) return problem(reply, 400, 'https://sthyra-crm.dev/errors/missing-idempotency-key', 'Missing Idempotency-Key', 'x-idempotency-key header is required', 'missing_idempotency_key', traceId);
    const body = req.body as { projectId?: string; kind?: string; clientSessionId?: string } | undefined;
    if (!body || typeof body !== 'object' || !body.projectId || !body.kind) {
      return problem(reply, 400, 'https://sthyra-crm.dev/errors/invalid-input', 'Invalid body', 'projectId and kind required', 'invalid_input', traceId);
    }
    const validKinds = ['walkthrough_360', 'preconstruction', 'postconstruction', 'incident'] as const;
    if (!validKinds.includes(body.kind as typeof validKinds[number])) {
      return problem(reply, 400, 'https://sthyra-crm.dev/errors/invalid-input', 'Invalid kind', 'kind must be one of walkthrough_360|preconstruction|postconstruction|incident', 'invalid_input', traceId);
    }
    try {
      const session = await service.startSession({
        orgId: claims.orgId,
        userId: claims.userId,
        projectId: body.projectId,
        kind: body.kind as typeof validKinds[number],
        clientSessionId: body.clientSessionId ?? null,
      });
      const isReplay = session.clientSessionId === body.clientSessionId && session.status === 'recording';
      return reply.code(isReplay ? 200 : 201).send({
        sessionId: session.id,
        captureId: session.captureId,
        kind: session.kind,
        startedAt: session.createdAt.toISOString(),
        deviceMeta: { deviceId: claims.deviceId },
      });
    } catch (err) {
      return problem(reply, 400, 'https://sthyra-crm.dev/errors/invalid-input', 'Start failed', (err as Error).message, 'invalid_input', traceId);
    }
  });

  // ─── FR-2: POST /v1/mobile/sessions/:id/chunks/:n ──────
  app.post('/v1/mobile/sessions/:sessionId/chunks/:chunkIndex', async (req, reply) => {
    const traceId = rid();
    const claims = await requireClaims(req, reply);
    if (!claims || typeof claims !== 'object' || !('orgId' in claims)) return;
    const sessionId = ((req.params as { sessionId?: string }).sessionId ?? '').trim();
    const chunkIndexRaw = ((req.params as { chunkIndex?: string }).chunkIndex ?? '').trim();
    const chunkIndex = Number.parseInt(chunkIndexRaw, 10);
    if (!sessionId || Number.isNaN(chunkIndex) || chunkIndex < 0) {
      return problem(reply, 400, 'https://sthyra-crm.dev/errors/invalid-input', 'Invalid params', 'sessionId and non-negative chunkIndex required', 'invalid_input', traceId);
    }
    const body = req.body as { sha256?: string; sizeBytes?: number } | undefined;
    if (!body || typeof body !== 'object' || !body.sha256 || typeof body.sizeBytes !== 'number') {
      return problem(reply, 400, 'https://sthyra-crm.dev/errors/invalid-input', 'Invalid body', 'sha256 and sizeBytes required', 'invalid_input', traceId);
    }
    try {
      const result = await service.uploadChunk(claims.orgId, sessionId, {
        sessionId, chunkIndex, sha256: body.sha256, sizeBytes: body.sizeBytes,
      });
      // Idempotent replay: same chunkId → 200; new → 201
      const isReplay = chunks_seen_before(result.id);
      return reply.code(isReplay ? 200 : 201).send({
        chunkId: result.id, chunkIndex: result.chunkIndex, sha256: result.sha256,
        sizeBytes: result.sizeBytes, receivedAt: result.receivedAt.toISOString(),
      });
    } catch (err) {
      const message = (err as Error).message;
      if (/too large/i.test(message)) {
        reply.header('retry-after', '600');
        return problem(reply, 413, 'https://sthyra-crm.dev/errors/chunk-too-large', 'Chunk too large', message, 'chunk_too_large', traceId);
      }
      if (/not found/i.test(message)) {
        return problem(reply, 404, 'https://sthyra-crm.dev/errors/not-found', 'Session not found', message, 'not_found', traceId);
      }
      if (/conflict/i.test(message)) {
        return problem(reply, 409, 'https://sthyra-crm.dev/errors/conflict', 'Chunk conflict', message, 'chunk_conflict', traceId);
      }
      return problem(reply, 400, 'https://sthyra-crm.dev/errors/invalid-input', 'Upload failed', message, 'invalid_input', traceId);
    }
  });

  // Local helper: track chunk ids seen this request
  const seenChunkIds = new Set<number>();
  function chunks_seen_before(id: number): boolean {
    if (seenChunkIds.has(id)) return true;
    seenChunkIds.add(id);
    return false;
  }

  // ─── FR-3: POST /v1/mobile/sessions/:id/finalize ─────────
  app.post('/v1/mobile/sessions/:sessionId/finalize', async (req, reply) => {
    const traceId = rid();
    const claims = await requireClaims(req, reply);
    if (!claims || typeof claims !== 'object' || !('orgId' in claims)) return;
    const sessionId = ((req.params as { sessionId?: string }).sessionId ?? '').trim();
    const body = req.body as { actualChunkCount?: number; totalSizeBytes?: number; sha256Root?: string } | undefined;
    if (!body || typeof body !== 'object' || typeof body.actualChunkCount !== 'number' || typeof body.totalSizeBytes !== 'number' || !body.sha256Root) {
      return problem(reply, 400, 'https://sthyra-crm.dev/errors/invalid-input', 'Invalid body', 'actualChunkCount, totalSizeBytes, sha256Root required', 'invalid_input', traceId);
    }
    try {
      const finalized = await service.finalizeSession(claims.orgId, sessionId, {
        sessionId, actualChunkCount: body.actualChunkCount, totalSizeBytes: body.totalSizeBytes, sha256Root: body.sha256Root,
      });
      return reply.code(200).send({
        captureId: finalized.captureId,
        status: finalized.status,
        estimatedReadyAt: new Date(Date.now() + 60_000).toISOString(),
      });
    } catch (err) {
      const message = (err as Error).message;
      if (/not found/i.test(message)) {
        return problem(reply, 404, 'https://sthyra-crm.dev/errors/not-found', 'Session not found', message, 'not_found', traceId);
      }
      if (/too large/i.test(message)) {
        reply.header('retry-after', '600');
        return problem(reply, 413, 'https://sthyra-crm.dev/errors/session-too-large', 'Session too large', message, 'session_too_large', traceId);
      }
      return problem(reply, 409, 'https://sthyra-crm.dev/errors/finalize-conflict', 'Finalize failed', message, 'finalize_conflict', traceId);
    }
  });

  // ─── FR-4: GET /v1/mobile/captures/:captureId ──────────
  app.get('/v1/mobile/captures/:captureId', async (req, reply) => {
    const traceId = rid();
    const claims = await requireClaims(req, reply);
    if (!claims || typeof claims !== 'object' || !('orgId' in claims)) return;
    const captureId = ((req.params as { captureId?: string }).captureId ?? '').trim();
    if (!captureId) return problem(reply, 400, 'https://sthyra-crm.dev/errors/invalid-input', 'Invalid captureId', 'captureId required', 'invalid_input', traceId);
    // Phase 5 MVP: stub status (Phase 5.b: call capture-service GET)
    return reply.code(200).send({
      captureId,
      status: 'processing',
      pipelineStage: 'sfm',
      progress: 35,
    });
  });

  // ─── FR-5: POST /v1/mobile/issues ─────────────────────
  app.post('/v1/mobile/issues', async (req, reply) => {
    const traceId = rid();
    const claims = await requireClaims(req, reply);
    if (!claims || typeof claims !== 'object' || !('orgId' in claims)) return;
    const idem = getIdempotencyKey(req);
    if (!idem) return problem(reply, 400, 'https://sthyra-crm.dev/errors/missing-idempotency-key', 'Missing Idempotency-Key', 'x-idempotency-key header is required', 'missing_idempotency_key', traceId);
    const body = req.body as { captureId?: string; title?: string; description?: string; severity?: string; coordinates?: { x: number; y: number; z: number } } | undefined;
    if (!body || typeof body !== 'object' || !body.captureId || !body.title || !body.description || !body.severity || !body.coordinates) {
      return problem(reply, 400, 'https://sthyra-crm.dev/errors/invalid-input', 'Invalid body', 'captureId, title, description, severity, coordinates required', 'invalid_input', traceId);
    }
    const validSev = ['low', 'medium', 'high', 'critical'] as const;
    if (!validSev.includes(body.severity as typeof validSev[number])) {
      return problem(reply, 400, 'https://sthyra-crm.dev/errors/invalid-input', 'Invalid severity', 'severity must be low|medium|high|critical', 'invalid_input', traceId);
    }
    try {
      const result = await service.raiseIssueFromCamera(
        claims.orgId, claims.userId, body.captureId,
        body.title, body.description,
        body.severity as typeof validSev[number],
        body.coordinates,
      );
      return reply.code(201).send({ issueId: result.issueId, status: 'open', clientIssueId: idem });
    } catch (err) {
      return problem(reply, 400, 'https://sthyra-crm.dev/errors/invalid-input', 'Create issue failed', (err as Error).message, 'invalid_input', traceId);
    }
  });

  // ─── FR-6: POST /v1/mobile/copilot ─────────────────────
  app.post('/v1/mobile/copilot', async (req, reply) => {
    const traceId = rid();
    const claims = await requireClaims(req, reply);
    if (!claims || typeof claims !== 'object' || !('orgId' in claims)) return;
    const body = req.body as { projectId?: string; text?: string } | undefined;
    if (!body || typeof body !== 'object' || !body.projectId || !body.text) {
      return problem(reply, 400, 'https://sthyra-crm.dev/errors/invalid-input', 'Invalid body', 'projectId and text required', 'invalid_input', traceId);
    }
    try {
      const t0 = Date.now();
      const result = await service.askCopilot(claims.orgId, claims.userId, body.projectId, body.text);
      return reply.code(200).send({
        replyText: result.replyText,
        intent: result.intent,
        latencyMs: result.latencyMs + (Date.now() - t0),
      });
    } catch (err) {
      return problem(reply, 400, 'https://sthyra-crm.dev/errors/invalid-input', 'Copilot failed', (err as Error).message, 'invalid_input', traceId);
    }
  });

  // ─── FR-8: POST /v1/mobile/devices + DELETE ─────────────
  app.post('/v1/mobile/devices', async (req, reply) => {
    const traceId = rid();
    const claims = await requireClaims(req, reply);
    if (!claims || typeof claims !== 'object' || !('orgId' in claims)) return;
    const body = req.body as { apnsToken?: string } | undefined;
    if (!body || typeof body !== 'object' || !body.apnsToken) {
      return problem(reply, 400, 'https://sthyra-crm.dev/errors/invalid-input', 'Invalid body', 'apnsToken required', 'invalid_input', traceId);
    }
    try {
      const token = await service.registerDeviceToken({
        orgId: claims.orgId, userId: claims.userId,
        deviceId: claims.deviceId, apnsToken: body.apnsToken,
      });
      return reply.code(201).send({ deviceId: token.deviceId, registeredAt: token.registeredAt.toISOString() });
    } catch (err) {
      return problem(reply, 400, 'https://sthyra-crm.dev/errors/invalid-input', 'Register failed', (err as Error).message, 'invalid_input', traceId);
    }
  });

  app.delete('/v1/mobile/devices/:deviceId', async (req, reply) => {
    const traceId = rid();
    const claims = await requireClaims(req, reply);
    if (!claims || typeof claims !== 'object' || !('orgId' in claims)) return;
    const deviceId = ((req.params as { deviceId?: string }).deviceId ?? '').trim();
    if (!deviceId) return problem(reply, 400, 'https://sthyra-crm.dev/errors/invalid-input', 'Invalid deviceId', 'deviceId required', 'invalid_input', traceId);
    // Tenant boundary: only unregister your own device
    if (deviceId !== claims.deviceId) {
      return problem(reply, 404, 'https://sthyra-crm.dev/errors/not-found', 'Device not found', 'no device with this id in this tenant', 'not_found', traceId);
    }
    await service.unregisterDeviceToken(claims.orgId, deviceId);
    return reply.code(204).send();
  });

  // Suppress unused-variable warning for seenChunkIds
  void seenChunkIds;

  return app;
}