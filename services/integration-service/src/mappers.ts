/**
 * Mappers — convert external-system shapes to Sthyra CRM entities.
 * Field mapping is automatic (default field names).
 */

export interface IssueShape {
 title: string;
 description: string;
 severity: 'low' | 'medium' | 'high' | 'critical';
 sourceId: string;
 source: 'procore.rfi' | 'bim360.issue' | 'plangrid.punch';
}

export function mapProcoreRFI(rfi: Record<string, unknown>): IssueShape {
 return {
 title: String(rfi['title'] ?? 'Untitled RFI'),
 description: String(rfi['description'] ?? ''),
 severity: 'medium',
 sourceId: String(rfi['id'] ?? ''),
 source: 'procore.rfi',
 };
}

export function mapBIM360Issue(issue: Record<string, unknown>): IssueShape {
 const sev = String(issue['severity'] ?? 'medium');
 const severity: IssueShape['severity'] = sev === 'high' || sev === 'critical' ? 'high' : 'medium';
 return {
 title: String(issue['title'] ?? 'Untitled BIM 360 issue'),
 description: String(issue['description'] ?? issue['title'] ?? ''),
 severity,
 sourceId: String(issue['id'] ?? ''),
 source: 'bim360.issue',
 };
}

export function mapPlangridPunch(punch: Record<string, unknown>): IssueShape {
 return {
 title: String(punch['name'] ?? 'Untitled Punch'),
 description: `Punch list with ${punch['items'] ?? 0} items`,
 severity: 'low',
 sourceId: String(punch['id'] ?? ''),
 source: 'plangrid.punch',
 };
}
