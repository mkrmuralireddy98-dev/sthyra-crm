/**
 * InMemoryEventBus — capture-scoped pub/sub for field-service.
 *
 * Same pattern as capture-service's EventBus: subscriptions keyed by
 * issueId, tenant-scoped at delivery time.
 */

export interface IssueEvent {
 readonly type: 'issue.created' | 'issue.updated' | 'issue.commented' | 'issue.resolved' | 'issue.reopened';
 readonly issueId: string;
 readonly orgId: string;
 readonly projectId: string;
 readonly occurredAt: Date;
}

export type IssueEventSubscriber = (event: IssueEvent) => void | Promise<void>;
export type Unsubscribe = () => void;

export interface IssueEventBus {
 publish(event: IssueEvent): Promise<void>;
 subscribe(orgId: string, issueId: string, handler: IssueEventSubscriber): Unsubscribe;
 subscriberCount(): number;
}

interface InternalSub {
 readonly orgId: string;
 readonly issueId: string;
 readonly handler: IssueEventSubscriber;
}

export class InMemoryEventBus implements IssueEventBus {
 private readonly subs = new Map<string, InternalSub[]>();

 async publish(event: IssueEvent): Promise<void> {
 const list = this.subs.get(event.issueId) ?? [];
 await Promise.all(list.map(async (sub) => {
 if (sub.orgId !== event.orgId) return; // tenant boundary
 try {
 await sub.handler(event);
 } catch {
 // Swallow per-subscriber errors (Constitution §V isolation)
 }
 }));
 }

 subscribe(orgId: string, issueId: string, handler: IssueEventSubscriber): Unsubscribe {
 const internal: InternalSub = { orgId, issueId, handler };
 const list = this.subs.get(issueId) ?? [];
 list.push(internal);
 this.subs.set(issueId, list);
 return () => {
 const current = this.subs.get(issueId) ?? [];
 const idx = current.indexOf(internal);
 if (idx >= 0) current.splice(idx, 1);
 if (current.length === 0) this.subs.delete(issueId);
 };
 }

 subscriberCount(): number {
 let total = 0;
 for (const list of this.subs.values()) total += list.length;
 return total;
 }
}
