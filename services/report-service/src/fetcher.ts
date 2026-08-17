/**
 * ReportFetcher — abstraction over cross-service data access.
 * Phase 9 MVP: StubReportFetcher returns deterministic data for testing.
 * Phase 9.b: real HTTP clients to capture-service, field-service, etc.
 */

import type {
  CaptureSummary, IssueSummary, MilestoneSummary, ProgressSummary,
} from './types.js';

export interface ReportFetcher {
 fetchCaptures(orgId: string, projectId: string): Promise<readonly CaptureSummary[]>;
 fetchIssues(orgId: string, projectId: string): Promise<readonly IssueSummary[]>;
 fetchMilestones(orgId: string, projectId: string): Promise<readonly MilestoneSummary[]>;
 fetchProgress(orgId: string, projectId: string): Promise<readonly ProgressSummary[]>;
}

/**
 * In-memory fetcher — tests inject deterministic data.
 */
export class StubReportFetcher implements ReportFetcher {
 capturesByProject = new Map<string, CaptureSummary[]>();
 issuesByProject = new Map<string, IssueSummary[]>();
 milestonesByProject = new Map<string, MilestoneSummary[]>();
 progressByProject = new Map<string, ProgressSummary[]>();

 async fetchCaptures(_orgId: string, projectId: string): Promise<readonly CaptureSummary[]> {
 return this.capturesByProject.get(projectId) ?? [];
 }

 async fetchIssues(_orgId: string, projectId: string): Promise<readonly IssueSummary[]> {
 return this.issuesByProject.get(projectId) ?? [];
 }

 async fetchMilestones(_orgId: string, projectId: string): Promise<readonly MilestoneSummary[]> {
 return this.milestonesByProject.get(projectId) ?? [];
 }

 async fetchProgress(_orgId: string, projectId: string): Promise<readonly ProgressSummary[]> {
 return this.progressByProject.get(projectId) ?? [];
 }
}
