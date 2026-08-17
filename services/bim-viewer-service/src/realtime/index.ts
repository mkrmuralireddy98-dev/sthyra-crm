/**
 * InMemoryEventBus — bim events pub/sub.
 */

export type BimEventType = 'bim.uploaded' | 'bim.validated' | 'bim.ready' | 'bim.aligned' | 'bim.diff_computed' | 'bim.failed';

export interface BimEvent {
 readonly type: BimEventType;
 readonly modelId: string;
 readonly orgId: string;
 readonly projectId: string;
 readonly occurredAt: Date;
}

export type BimEventSubscriber = (event: BimEvent) => void | Promise<void>;
export type Unsubscribe = () => void;

export interface BimEventBus {
 publish(event: BimEvent): Promise<void>;
 subscribe(orgId: string, projectId: string, handler: BimEventSubscriber): Unsubscribe;
 subscriberCount(): number;
}

interface InternalSub {
 readonly orgId: string;
 readonly projectId: string;
 readonly handler: BimEventSubscriber;
}

export class InMemoryEventBus implements BimEventBus {
 private readonly subs = new Map<string, InternalSub[]>();

 async publish(event: BimEvent): Promise<void> {
 const list = this.subs.get(event.projectId) ?? [];
 await Promise.all(list.map(async (sub) => {
 if (sub.orgId !== event.orgId) return;
 try {
 await sub.handler(event);
 } catch {
 // swallow per-subscriber errors
 }
 }));
 }

 subscribe(orgId: string, projectId: string, handler: BimEventSubscriber): Unsubscribe {
 const internal: InternalSub = { orgId, projectId, handler };
 const list = this.subs.get(projectId) ?? [];
 list.push(internal);
 this.subs.set(projectId, list);
 return () => {
 const current = this.subs.get(projectId) ?? [];
 const idx = current.indexOf(internal);
 if (idx >= 0) current.splice(idx, 1);
 if (current.length === 0) this.subs.delete(projectId);
 };
 }

 subscriberCount(): number {
 let total = 0;
 for (const list of this.subs.values()) total += list.length;
 return total;
 }
}

// Re-export for compatibility with http.ts
export type { BimEvent as default };
