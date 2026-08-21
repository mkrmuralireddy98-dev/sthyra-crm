'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { toast } from '@/components/toast';
import { suspendOrg, resumeOrg, deleteOrg } from '@/lib/api';

interface Props {
 orgId: string;
 orgName: string;
 status: string;
 role: 'admin' | 'user';
}

export function OrgActions({ orgId, orgName, status, role }: Props) {
 const router = useRouter();
 const [busy, setBusy] = useState(false);
 const [confirmDelete, setConfirmDelete] = useState(false);

 if (role !== 'admin') {
 // Org users only see a link to their org
 return (
 <Link
 href={`/orgs/${orgId}`}
 className="btn btn-ghost"
 style={{ padding: '4px 10px', fontSize: 11 }}
 >
 view →
 </Link>
 );
 }

 const onSuspend = async () => {
 setBusy(true);
 try {
 await suspendOrg(orgId, 'suspended via UI');
 toast({ title: 'org suspended', description: `${orgName} (${orgId})` });
 router.refresh();
 } catch (e: any) {
 toast({ title: 'failed', description: e.message, variant: 'error' });
 } finally {
 setBusy(false);
 }
 };

 const onResume = async () => {
 setBusy(true);
 try {
 await resumeOrg(orgId, 'resumed via UI');
 toast({ title: 'org resumed', description: `${orgName} (${orgId})` });
 router.refresh();
 } finally {
 setBusy(false);
 }
 };

 const onDelete = async () => {
 setBusy(true);
 try {
 await deleteOrg(orgId, 'deleted via UI');
 toast({ title: 'org deleted', description: `${orgName} removed` });
 setConfirmDelete(false);
 router.refresh();
 router.push('/orgs');
 } catch (e: any) {
 toast({ title: 'failed', description: e.message, variant: 'error' });
 setBusy(false);
 }
 };

 return (
 <div style={{ display: 'flex', gap: 4, justifyContent: 'flex-end' }}>
 <Link
 href={`/orgs/${orgId}/edit`}
 className="btn btn-ghost"
 style={{ padding: '4px 10px', fontSize: 11 }}
 title="Edit organization"
 >
 ✏ edit
 </Link>

 {status === 'active' ? (
 <button
 onClick={onSuspend}
 disabled={busy}
 className="btn btn-ghost"
 style={{ padding: '4px 10px', fontSize: 11 }}
 title="Suspend organization"
 >
 ⏸ suspend
 </button>
 ) : (
 <button
 onClick={onResume}
 disabled={busy}
 className="btn btn-ghost"
 style={{ padding: '4px 10px', fontSize: 11, color: 'var(--accent)', borderColor: 'var(--accent)' }}
 title="Resume organization"
 >
 ▶ resume
 </button>
 )}

 {confirmDelete ? (
 <>
 <button
 onClick={() => setConfirmDelete(false)}
 disabled={busy}
 className="btn btn-ghost"
 style={{ padding: '4px 8px', fontSize: 11 }}
 >
 cancel
 </button>
 <button
 onClick={onDelete}
 disabled={busy}
 className="btn"
 style={{ padding: '4px 10px', fontSize: 11, background: '#ff4444', color: '#fff', borderColor: '#ff4444' }}
 title="Confirm delete"
 >
 confirm
 </button>
 </>
 ) : (
 <button
 onClick={() => setConfirmDelete(true)}
 disabled={busy}
 className="btn"
 style={{ padding: '4px 10px', fontSize: 11, background: 'transparent', color: '#ff4444', borderColor: '#ff4444' }}
 title="Delete organization"
 >
 × delete
 </button>
 )}
 </div>
 );
}
