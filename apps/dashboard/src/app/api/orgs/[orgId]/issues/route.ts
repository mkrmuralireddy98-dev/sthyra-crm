/**
 * /api/orgs/[orgId]/issues — proxy to field-service.
 *
 * Browser calls /api/orgs/org_a/issues, Next.js forwards to
 * http://field-service:9091/v1/projects/prj_demo/issues with x-tenant-id header.
 */

import { NextRequest, NextResponse } from 'next/server';

const FIELD_SERVICE_URL = process.env.FIELD_SERVICE_URL ?? 'http://127.0.0.1:9091';

async function forward(
 req: NextRequest,
 targetPath: string,
 orgId: string,
 method: string,
): Promise<NextResponse> {
 const url = `${FIELD_SERVICE_URL}${targetPath}`;
 const headers = new Headers();
 headers.set('content-type', 'application/json');
 headers.set('x-tenant-id', orgId);
 const rid = req.headers.get('x-request-id');
 if (rid) headers.set('x-request-id', rid);
 const idem = req.headers.get('idempotency-key') ?? req.headers.get('Idempotency-Key');
 if (idem) headers.set('x-idempotency-key', idem);

 const init: RequestInit = { method, headers };
 if (method !== 'GET' && method !== 'HEAD') {
 try {
 init.body = await req.text();
 } catch {}
 }

 try {
 const res = await fetch(url, init);
 const text = await res.text();
 return new NextResponse(text, {
 status: res.status,
 headers: { 'content-type': res.headers.get('content-type') ?? 'application/json' },
 });
 } catch (err: any) {
 return NextResponse.json(
 { title: 'Bad Gateway', status: 502, detail: err.message },
 { status: 502 },
 );
 }
}

export async function GET(req: NextRequest, { params }: { params: { orgId: string } }): Promise<NextResponse> {
 const url = req.nextUrl;
 const limit = url.searchParams.get('limit') ?? '50';
 const status = url.searchParams.get('status');
 let path = `/v1/projects/prj_demo/issues?limit=${limit}`;
 if (status) path += `&status=${status}`;
 return forward(req, path, params.orgId, 'GET');
}

export async function POST(req: NextRequest, { params }: { params: { orgId: string } }): Promise<NextResponse> {
 return forward(req, '/v1/projects/prj_demo/issues', params.orgId, 'POST');
}
