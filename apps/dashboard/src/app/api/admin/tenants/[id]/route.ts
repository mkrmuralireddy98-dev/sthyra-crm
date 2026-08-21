/**
 * /api/admin/tenants/[id]/* — proxy to admin-service.
 *
 * Handles GET single tenant, POST suspend/resume.
 */

import { NextRequest, NextResponse } from 'next/server';

const ADMIN_SERVICE_URL = process.env.ADMIN_SERVICE_URL ?? 'http://127.0.0.1:9100';
const DEFAULT_ADMIN_USER = process.env.ADMIN_DEFAULT_USER ?? 'usr_dashboard';

async function forward(req: NextRequest, targetPath: string, method: string): Promise<NextResponse> {
 const url = `${ADMIN_SERVICE_URL}${targetPath}`;
 const headers = new Headers();
 headers.set('content-type', 'application/json');
 headers.set('authorization', `Bearer admin:super:${DEFAULT_ADMIN_USER}`);
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

export async function GET(
 req: NextRequest,
 { params }: { params: { id: string } },
): Promise<NextResponse> {
 return forward(req, `/v1/admin/tenants/${params.id}`, 'GET');
}

export async function POST(
 req: NextRequest,
 { params }: { params: { id: string } },
): Promise<NextResponse> {
 const url = req.nextUrl.pathname;
 const action = url.split('/').pop();
 return forward(req, `/v1/admin/tenants/${params.id}/${action}`, 'POST');
}

export async function PATCH(
 req: NextRequest,
 { params }: { params: { id: string } },
): Promise<NextResponse> {
 return forward(req, `/v1/admin/tenants/${params.id}`, 'PATCH');
}

export async function DELETE(
 req: NextRequest,
 { params }: { params: { id: string } },
): Promise<NextResponse> {
 return forward(req, `/v1/admin/tenants/${params.id}`, 'DELETE');
}
