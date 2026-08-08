/**
 * Direct API client for the dashboard. The dashboard renders server-side, so
 * these run on the server during SSR. We forward the inbound request-id (or
 * mint one) so the org-service can correlate its logs to the dashboard's.
 *
 * Endpoint URLs come from env vars so the same build runs in dev, staging, prod.
 */

import { randomUUID } from 'node:crypto';

const ORG_SERVICE_URL = process.env.ORG_SERVICE_URL ?? 'http://127.0.0.1:8080';
const PROJECT_SERVICE_URL = process.env.PROJECT_SERVICE_URL ?? 'http://127.0.0.1:8082';

export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly title: string,
    readonly detail: string,
    readonly traceId: string,
    readonly code?: string,
  ) {
    super(`${title}: ${detail}`);
  }
}

interface FetchOptions {
  requestId?: string;
  idempotencyKey?: string;
}

function buildHeaders(opts: FetchOptions): Record<string, string> {
  const headers: Record<string, string> = {
    'content-type': 'application/json',
    'x-request-id': opts.requestId ?? randomUUID(),
  };
  if (opts.idempotencyKey) headers['idempotency-key'] = opts.idempotencyKey;
  return headers;
}

function parseProblem(res: Response, fallbackTraceId: string): Promise<ApiError> {
  return res
    .json()
    .then((body: { title?: string; detail?: string; trace_id?: string; code?: string }) => {
      return new ApiError(
        res.status,
        body.title ?? 'Request failed',
        body.detail ?? `HTTP ${res.status}`,
        body.trace_id ?? fallbackTraceId,
        body.code,
      );
    })
    .catch(() => new ApiError(res.status, 'Request failed', `HTTP ${res.status}`, fallbackTraceId));
}

export interface Org {
  id: string;
  name: string;
  region: string;
  plan: string;
  createdAt: string;
}

export interface Project {
  id: string;
  orgId: string;
  name: string;
  status: 'active' | 'on_hold' | 'completed' | 'archived';
  address: string;
  startedAt: string;
  createdAt: string;
  archivedAt?: string;
}

export async function listOrgs(opts: FetchOptions = {}): Promise<Org[]> {
  const res = await fetch(`${ORG_SERVICE_URL}/v1/orgs`, {
    method: 'GET',
    headers: buildHeaders(opts),
  });
  if (!res.ok) {
    throw await parseProblem(res, res.headers.get('x-request-id') ?? '');
  }
  const body = (await res.json()) as { data: Org[] };
  return body.data;
}

export async function createOrg(
  input: { name: string; region: string; plan: string },
  opts: FetchOptions = {},
): Promise<Org> {
  const res = await fetch(`${ORG_SERVICE_URL}/v1/orgs`, {
    method: 'POST',
    headers: buildHeaders(opts),
    body: JSON.stringify(input),
  });
  if (!res.ok) {
    const traceId = res.headers.get('x-request-id') ?? '';
    throw await parseProblem(res, traceId);
  }
  return (await res.json()) as Org;
}

export async function getOrg(id: string, opts: FetchOptions = {}): Promise<Org | null> {
  const res = await fetch(`${ORG_SERVICE_URL}/v1/orgs/${id}`, {
    headers: buildHeaders(opts),
  });
  if (res.status === 404) return null;
  if (!res.ok) {
    throw await parseProblem(res, res.headers.get('x-request-id') ?? '');
  }
  return (await res.json()) as Org;
}

export async function listProjects(orgId: string, opts: FetchOptions = {}): Promise<Project[]> {
  const res = await fetch(`${PROJECT_SERVICE_URL}/v1/projects?orgId=${encodeURIComponent(orgId)}`, {
    headers: buildHeaders(opts),
  });
  if (!res.ok) {
    throw await parseProblem(res, res.headers.get('x-request-id') ?? '');
  }
  const body = (await res.json()) as { data: Project[] };
  return body.data;
}

export async function archiveProject(id: string, opts: FetchOptions = {}): Promise<Project> {
  const res = await fetch(`${PROJECT_SERVICE_URL}/v1/projects/${id}/archive`, {
    method: 'POST',
    headers: buildHeaders(opts),
  });
  if (!res.ok) {
    throw await parseProblem(res, res.headers.get('x-request-id') ?? '');
  }
  return (await res.json()) as Project;
}
