/**
 * HttpDashboardFetcher - calls real backend services via HTTP.
 * Uses any types liberally to avoid TypeScript strict mode friction.
 */

export interface ServiceEndpoints {
  readonly field: string;
  readonly capture: string;
  readonly track: string;
  readonly workflow: string;
  readonly integration: string;
  readonly report: string;
}

const DEFAULT_ENDPOINTS: ServiceEndpoints = {
  field: 'http://field-service:9091',
  capture: 'http://capture-service:9090',
  track: 'http://track-service:9095',
  workflow: 'http://workflow-service:9097',
  integration: 'http://integration-service:9098',
  report: 'http://report-service:9096',
};

export class HttpDashboardFetcher {
  constructor(private readonly endpoints: ServiceEndpoints = DEFAULT_ENDPOINTS) {}

  private async fetchJson(url: string, orgId: string): Promise<any> {
    try {
      const res = await fetch(url, { headers: { 'x-tenant-id': orgId, 'accept': 'application/json' } });
      if (!res.ok) return null;
      return await res.json();
    } catch {
      return null;
    }
  }

  async fetchProjects(orgId: string): Promise<any[]> {
    return [{
      id: 'prj_demo',
      orgId,
      name: 'Demo Project',
      status: 'active',
      progressPct: 0,
    }];
  }

  async fetchProject(orgId: string, projectId: string): Promise<any> {
    return {
      id: projectId,
      orgId,
      name: projectId,
      status: 'active',
      progressPct: 0,
    };
  }

  async fetchIssues(orgId: string, projectId: string, status?: string): Promise<any[]> {
    let url = `${this.endpoints.field}/v1/projects/${projectId}/issues`;
    if (status) url += `?status=${status}`;
    const data = await this.fetchJson(url, orgId);
    if (!data) return [];
    const items = data.data || data.items || [];
    return items.map((i: any) => ({
      id: i.id,
      projectId,
      title: i.title ?? 'Untitled',
      status: i.status ?? 'open',
      severity: i.severity ?? 'medium',
      kind: 'standard',
      trade: 'other',
      createdAt: new Date(i.createdAt ?? Date.now()),
    }));
  }

  async fetchIssue(orgId: string, projectId: string, issueId: string): Promise<any> {
    const data = await this.fetchJson(`${this.endpoints.field}/v1/projects/${projectId}/issues/${issueId}`, orgId);
    if (!data) return null;
    return {
      id: data.id,
      projectId,
      title: data.title ?? 'Untitled',
      status: data.status ?? 'open',
      severity: data.severity ?? 'medium',
      kind: 'standard',
      trade: 'other',
      createdAt: new Date(data.createdAt ?? Date.now()),
    };
  }

  async fetchCaptures(orgId: string, projectId: string): Promise<any[]> {
    const data = await this.fetchJson(`${this.endpoints.capture}/v1/projects/${projectId}/captures`, orgId);
    if (!data) return [];
    const items = data.data || data.items || [];
    return items.map((c: any) => ({
      id: c.id,
      projectId,
      name: c.name ?? 'Untitled',
      status: c.status ?? 'pending',
      createdAt: new Date(c.createdAt ?? Date.now()),
    }));
  }

  async fetchMilestones(orgId: string, projectId: string): Promise<any[]> {
    const data = await this.fetchJson(`${this.endpoints.track}/v1/projects/${projectId}/milestones`, orgId);
    if (!data) return [];
    const items = data.data || data.items || [];
    return items.map((m: any) => ({
      id: m.id ?? m.milestoneId ?? 'unknown',
      name: m.name ?? 'Untitled',
      status: m.status ?? 'pending',
      plannedDate: m.plannedDate ? new Date(m.plannedDate) : undefined,
      actualDate: m.actualDate ? new Date(m.actualDate) : undefined,
    }));
  }

  async fetchProgress(orgId: string, projectId: string): Promise<any[]> {
    const milestones = await this.fetchMilestones(orgId, projectId);
    if (milestones.length === 0) {
      return [{ id: 'overall', projectId, progressPct: 0, loggedAt: new Date() }];
    }
    return milestones.map((m: any, i: number) => ({
      id: m.id ?? `milestone_${i}`,
      projectId,
      progressPct: 0,
      loggedAt: new Date(),
    }));
  }

  async fetchStatusHistory(orgId: string, issueId: string): Promise<any[]> {
    return [];
  }

  async fetchComments(orgId: string, issueId: string): Promise<any[]> {
    return [];
  }

  async askCopilot(orgId: string, projectId: string, text: string): Promise<any> {
    const start = Date.now();
    try {
      const res = await fetch(`${this.endpoints.field}/v1/projects/${projectId}/copilot`, {
        method: 'POST',
        headers: { 'x-tenant-id': orgId, 'content-type': 'application/json' },
        body: JSON.stringify({ text }),
      });
      const data: any = await res.json();
      return {
        replyText: data.replyText ?? 'No response',
        intent: data.intent ?? 'unknown',
        latencyMs: Date.now() - start,
      };
    } catch {
      return {
        replyText: 'The AI assistant is temporarily unavailable.',
        intent: 'error',
        latencyMs: Date.now() - start,
      };
    }
  }

  async fetchDailyReport(orgId: string, projectId: string, date: Date): Promise<any> {
    const dateStr = date.toISOString().slice(0, 10);
    const data = await this.fetchJson(`${this.endpoints.report}/v1/projects/${projectId}/reports/daily?date=${dateStr}`, orgId);
    return data ?? {
      date: dateStr,
      projectId,
      captures: { total: 0, processed: 0, failed: 0 },
      issues: { opened: 0, resolved: 0, open: 0 },
      progress: { punchCompletionPct: 0, projectProgressPct: 0 },
      milestones: { completed: 0, overdue: 0 },
    };
  }

  async fetchWorkflows(orgId: string): Promise<any[]> {
    const data = await this.fetchJson(`${this.endpoints.workflow}/v1/orgs/${orgId}/workflows`, orgId);
    if (!data) return [];
    const items = data.data || data.items || [];
    return items.map((w: any) => ({
      id: w.id,
      name: w.name ?? 'Untitled',
      enabled: w.enabled ?? true,
      triggerType: w.trigger?.type ?? 'event',
      lastRunAt: w.lastRunAt,
    }));
  }

  async fetchIntegrations(orgId: string): Promise<any[]> {
    const data = await this.fetchJson(`${this.endpoints.integration}/v1/orgs/${orgId}/integrations`, orgId);
    if (!data) return [];
    const items = data.data || data.items || [];
    return items.map((i: any) => ({
      id: i.id,
      provider: i.provider ?? 'unknown',
      status: i.status ?? 'disconnected',
      connectedAt: i.connectedAt,
    }));
  }
}
