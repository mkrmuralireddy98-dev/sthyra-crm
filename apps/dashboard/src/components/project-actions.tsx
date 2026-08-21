'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { toast } from '@/components/toast';
import { deleteProject } from '@/lib/api';

interface Props {
 tenantId: string;
 projectId: string;
 projectName: string;
 role: 'admin' | 'user';
}

export function ProjectActions({ tenantId, projectId, projectName, role }: Props) {
 const router = useRouter();
 const [busy, setBusy] = useState(false);
 const [confirmDelete, setConfirmDelete] = useState(false);

 const onDelete = async () => {
 setBusy(true);
 try {
 await deleteProject(tenantId, projectId);
 toast({ title: 'project deleted', description: `${projectName} removed` });
 setConfirmDelete(false);
 router.refresh();
 } catch (e: any) {
 toast({ title: 'failed', description: e.message, variant: 'error' });
 setBusy(false);
 }
 };

 return (
 <div style={{ display: 'flex', gap: 4, justifyContent: 'flex-end' }}>
 <Link
 href={`/orgs/${tenantId}/projects/${projectId}/edit`}
 className="btn btn-ghost"
 style={{ padding: '4px 10px', fontSize: 11 }}
 title="Edit project"
 >
 ✏ edit
 </Link>

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
 title="Delete project"
 >
 × delete
 </button>
 )}
 </div>
 );
}
