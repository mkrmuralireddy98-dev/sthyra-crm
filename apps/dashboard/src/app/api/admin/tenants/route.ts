/**
 * /api/admin/tenants
 *
 * Proxy route — the Next.js server forwards calls to admin-service:9100.
 * This solves the CORS problem: the browser only ever talks to localhost:3000,
 * and the Next.js server talks to the backend.
 */

import { NextRequest, NextResponse } from 'next/server';

const ADMIN_SERVICE_URL = process.env.ADMIN_SERVICE_URL ?? 'http://127.0.0.1:9100';
const DEFAULT_ADMIN_USER = process.env.ADMIN_DEFAULT_USER ?? 'usr_dashboard';

async function forward(req: NextRequest, pathname: string, method: string): Promise<NextResponse> {
 const url = `${ADMIN_SERVICE_URL}${pathname}`;
 const headers = new Headers();
 headers.set('content-type', 'application/json');
 headers.set('authorization', `Bearer admin:super:${DEFAULT_ADMIN_USER}`);
 const incomingRid = req.headers.get('x-request-id');
 if (incomingRid) headers.set('x-request-id', incomingRid);
 const idem = req.headers.get('idempotency-key') ?? req.headers.get('Idempotency-Key');
 if (idem) headers.set('x-idempotency-key', idem);

 const init: RequestInit = { method, headers };
 if (method !== 'GET' && method !== 'HEAD') {
 try {
 const body = await req.text();
 if (body) init.body = body;
 } catch {}
 }

 try {
 const res = await fetch(url, init);
 const text = await res.text(); if (res.status === 204) return new NextResponse(null, { status: 204 });
 return new NextResponse(text, {
 status: res.status,
 headers: {
 'content-type': res.headers.get('content-type') ?? 'application/json',
 'x-request-id': res.headers.get('x-request-id') ?? incomingRid ?? '',
 },
 });
 } catch (err: any) {
 return NextResponse.json(
 { type: 'https://sthyra-crm.dev/errors/bad-gateway', title: 'Bad Gateway', status: 502, detail: err.message, instance: pathname },
 { status: 502 },
 );
 }
}

export async function GET(req: NextRequest): Promise<NextResponse> {
 const { pathname } = await req.nextUrl;
 return forward(req, pathname.replace('/api/admin', '/v1/admin'), 'GET');
}

export async function POST(req: NextRequest): Promise<NextResponse> {
 const { pathname } = await req.nextUrl;
 return forward(req, pathname.replace('/api/admin', '/v1/admin'), 'POST');
}
