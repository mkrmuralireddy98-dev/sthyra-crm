import { describe, it } from 'node:test';
import * as assert from 'node:assert/strict';
import { computeCloseoutReport } from './closeout.js';
import type { Issue, PunchData, IssueKind } from './types.js';

function makeIssue(overrides: Partial<Issue> = {}): Issue {
 return {
 id: 'iss_001',
 orgId: 'org_a',
 projectId: 'prj_1',
 captureId: null,
 clientIssueId: null,
 title: 't',
 description: 'd',
 severity: 'medium',
 status: 'open',
 assignedTo: null,
 coordinates: null,
 dueDate: null,
 createdBy: 'user_1',
 createdAt: new Date('2026-08-14T00:00:00Z'),
 updatedAt: new Date('2026-08-14T00:00:00Z'),
 resolvedAt: null,
 deletedAt: null,
 kind: 'standard' as IssueKind,
 punchData: null,
 ...overrides,
 };
}

const punch = (trade: 'plumbing' | 'electrical' | 'other'): PunchData => ({
 trade,
 location: { level: 'L2', room: '304' },
 assignedTo: 'user_2',
 dueDate: null,
 photoIds: [],
});

describe('computeCloseoutReport', () => {
 it('returns 100% completion for empty project', () => {
 const report = computeCloseoutReport([]);
 assert.equal(report.total, 0);
 assert.equal(report.completionPct, 100);
 });

 it('returns 0% when no items closed', () => {
 const items = [makeIssue({ id: 'i1' }), makeIssue({ id: 'i2' })];
 const report = computeCloseoutReport(items);
 assert.equal(report.total, 2);
 assert.equal(report.completionPct, 0);
 });

 it('returns 50% when half closed', () => {
 const items = [
 makeIssue({ id: 'i1', status: 'closed' }),
 makeIssue({ id: 'i2', status: 'open' }),
 ];
 const report = computeCloseoutReport(items);
 assert.equal(report.completionPct, 50);
 });

 it('returns 100% when all closed', () => {
 const items = [
 makeIssue({ id: 'i1', status: 'closed' }),
 makeIssue({ id: 'i2', status: 'closed' }),
 ];
 const report = computeCloseoutReport(items);
 assert.equal(report.completionPct, 100);
 });

 it('byStatus counts every status', () => {
 const items = [
 makeIssue({ id: 'i1', status: 'open' }),
 makeIssue({ id: 'i2', status: 'open' }),
 makeIssue({ id: 'i3', status: 'in_progress' }),
 makeIssue({ id: 'i4', status: 'closed' }),
 ];
 const report = computeCloseoutReport(items);
 assert.equal(report.byStatus['open'], 2);
 assert.equal(report.byStatus['in_progress'], 1);
 assert.equal(report.byStatus['closed'], 1);
 });

 it('byTrade counts only punch items', () => {
 const items = [
 makeIssue({ id: 'i1', kind: 'punch', punchData: punch('plumbing') }),
 makeIssue({ id: 'i2', kind: 'punch', punchData: punch('electrical') }),
 makeIssue({ id: 'i3', kind: 'punch', punchData: punch('plumbing') }),
 makeIssue({ id: 'i4', kind: 'standard' }), // not punch, ignored in byTrade
 ];
 const report = computeCloseoutReport(items);
 assert.equal(report.byTrade['plumbing'], 2);
 assert.equal(report.byTrade['electrical'], 1);
 assert.equal(report.byTrade['standard'], undefined);
 });

 it('byTrade is empty when no punch items', () => {
 const items = [makeIssue({ kind: 'standard' })];
 const report = computeCloseoutReport(items);
 assert.equal(Object.keys(report.byTrade).length, 0);
 });

 it('averageResolutionHours: 0 when no resolved items', () => {
 const items = [makeIssue({ status: 'open' })];
 const report = computeCloseoutReport(items);
 assert.equal(report.averageResolutionHours, 0);
 });

 it('averageResolutionHours computes mean', () => {
 const items = [
 makeIssue({ id: 'i1', status: 'resolved', resolvedAt: new Date('2026-08-14T01:00:00Z') }),
 makeIssue({ id: 'i2', status: 'resolved', resolvedAt: new Date('2026-08-14T03:00:00Z') }),
 ];
 const report = computeCloseoutReport(items);
 // i1: 1h, i2: 3h, mean = 2h
 assert.equal(report.averageResolutionHours, 2);
 });
});
