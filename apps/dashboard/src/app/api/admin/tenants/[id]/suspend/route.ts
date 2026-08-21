/**
 * /api/admin/tenants/[id]/suspend — proxy POST to admin-service.
 */

import { NextRequest, NextResponse } from 'next/server';

const ADMIN_SERVICE_URL = process.env.ADMIN_SERVICE_URL ?? 'http://127.0.0.1:9100';
const DEFAULT_ADMIN_USER = process.env.ADMIN_DEFAULT_USER ?? 'usr_dashboard';

export async function POST(
 req: NextRequest,
 { params }: { params: { id: string } },
): Promise<NextResponse> {
 const url = `${ADMIN_SERVICE_URL}/v1/admin/tenants/${params.id}/suspend`;
 const headers = new Headers();
 headers.set('content-type', 'application/json');
 headers.set('authorization', `Bearer admin:super:${DEFAULT_ADMIN_USER}`);
 const rid = req.headers.get('x-request-id');
 if (rid) headers.set('x-request-id', rid);
 const idem = req.headers.get('idempotency-key') ?? req.headers.get('Idempotency-Key');
 if (idem) headers.set('x-idempotency-key', idem);

 let body = '';
 try {
 body = await req.text();
 } catch {}

 try {
 const res = await fetch(url, { method: 'POST', headers, body });
 const text = await res.text(); if (res.status === 204) return new NextResponse(null, { status: 204 });
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
