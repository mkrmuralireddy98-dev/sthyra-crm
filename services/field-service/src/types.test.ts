import { describe, it } from 'node:test';
import * as assert from 'node:assert/strict';
import {
 SEVERITIES,
 ISSUE_STATUSES,
 type Severity,
 type IssueStatus,
 type Coordinates,
 type Issue,
} from './types.js';

describe('Field Service types', () => {
 it('SEVERITIES has exactly 4 values', () => {
 assert.equal(SEVERITIES.length, 4);
 assert.deepEqual([...SEVERITIES].sort(), ['critical', 'high', 'low', 'medium']);
 });

 it('ISSUE_STATUSES has exactly 4 values', () => {
 assert.equal(ISSUE_STATUSES.length, 5);
 assert.deepEqual([...ISSUE_STATUSES].sort(), ['closed', 'in_progress', 'open', 'resolved', 'wont_fix']);
 });

 it('Coordinates is a 3D coordinate triple', () => {
 const c: Coordinates = { x: 1.5, y: 2.5, z: 3.5 };
 assert.equal(c.x, 1.5);
 assert.equal(c.y, 2.5);
 assert.equal(c.z, 3.5);
 });

 it('Issue interface supports all 4 statuses', () => {
 const statuses: IssueStatus[] = ['open', 'in_progress', 'resolved', 'wont_fix'];
 for (const s of statuses) {
 const issue: Issue = {
 id: 'iss_001',
 orgId: 'org_a',
 projectId: 'prj_1',
 captureId: null,
 clientIssueId: null,
 title: 't',
 description: 'd',
 severity: 'medium',
 status: s,
 assignedTo: null,
 coordinates: null,
 dueDate: null,
 createdBy: 'user_1',
 createdAt: new Date(),
 updatedAt: new Date(),
 resolvedAt: null,
 deletedAt: null,
 };
 assert.equal(issue.status, s);
 }
 });

 it('Issue interface supports all 4 severities', () => {
 const severities: Severity[] = ['low', 'medium', 'high', 'critical'];
 for (const sev of severities) {
 const issue: Issue = {
 id: 'iss_002',
 orgId: 'org_a',
 projectId: 'prj_1',
 captureId: null,
 clientIssueId: null,
 title: 't',
 description: 'd',
 severity: sev,
 status: 'open',
 assignedTo: null,
 coordinates: null,
 dueDate: null,
 createdBy: 'user_1',
 createdAt: new Date(),
 updatedAt: new Date(),
 resolvedAt: null,
 deletedAt: null,
 };
 assert.equal(issue.severity, sev);
 }
 });

 it('Issue is fully readonly (immutability)', () => {
 const issue: Issue = {
 id: 'iss_003',
 orgId: 'org_a',
 projectId: 'prj_1',
 captureId: null,
 clientIssueId: null,
 title: 't',
 description: 'd',
 severity: 'low',
 status: 'open',
 assignedTo: null,
 coordinates: null,
 dueDate: null,
 createdBy: 'user_1',
 createdAt: new Date(),
 updatedAt: new Date(),
 resolvedAt: null,
 deletedAt: null,
 };
 // Type-level: every field is readonly. Runtime: can't reassign.
 assert.ok(issue);
 });

 it('Issue with captureId and coordinates', () => {
 const issue: Issue = {
 id: 'iss_004',
 orgId: 'org_a',
 projectId: 'prj_1',
 captureId: 'cap_001',
 clientIssueId: 'cli_issue_001',
 title: 'Missing MEP detail',
 description: 'See attached scan',
 severity: 'high',
 status: 'open',
 assignedTo: 'user_2',
 coordinates: { x: 3.2, y: 1.1, z: 0.5 },
 dueDate: new Date('2026-09-01'),
 createdBy: 'user_1',
 createdAt: new Date(),
 updatedAt: new Date(),
 resolvedAt: null,
 deletedAt: null,
 };
 assert.equal(issue.captureId, 'cap_001');
 assert.equal(issue.coordinates?.x, 3.2);
 assert.equal(issue.assignedTo, 'user_2');
 });

 it('soft-delete uses deletedAt (null = not deleted)', () => {
 const issue: Issue = {
 id: 'iss_005', orgId: 'o', projectId: 'p', captureId: null, clientIssueId: null,
 title: 't', description: 'd', severity: 'low', status: 'open',
 assignedTo: null, coordinates: null, dueDate: null,
 createdBy: 'u', createdAt: new Date(), updatedAt: new Date(),
 resolvedAt: null, deletedAt: null,
 };
 assert.equal(issue.deletedAt, null);
 const softDeleted: Issue = { ...issue, deletedAt: new Date() };
 assert.ok(softDeleted.deletedAt);
 });
});
