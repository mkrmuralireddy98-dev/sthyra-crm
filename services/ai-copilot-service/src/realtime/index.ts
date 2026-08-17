/**
 * InMemoryEventBus — copilot events pub/sub.
 */

export type CopilotEventType = 'message.received' | 'message.replied';

export interface CopilotEvent {
 readonly type: CopilotEventType;
 readonly orgId: string;
 readonly conversationId: string;
 readonly messageId: string;
}

export type CopilotEventSubscriber = (event: CopilotEvent) => void | Promise<void>;
export type Unsubscribe = () => void;

export interface CopilotEventBus {
 publish(event: CopilotEvent): Promise<void>;
 subscribe(orgId: string, conversationId: string, handler: CopilotEventSubscriber): Unsubscribe;
 subscriberCount(): number;
}

interface InternalSub {
 readonly orgId: string;
 readonly conversationId: string;
 readonly handler: CopilotEventSubscriber;
}

export class InMemoryEventBus implements CopilotEventBus {
 private readonly subs = new Map<string, InternalSub[]>();

 async publish(event: CopilotEvent): Promise<void> {
 const list = this.subs.get(event.conversationId) ?? [];
 await Promise.all(list.map(async (sub) => {
 if (sub.orgId !== event.orgId) return;
 try {
 await sub.handler(event);
 } catch {
 // swallow per-subscriber errors
 }
 }));
 }

 subscribe(orgId: string, conversationId: string, handler: CopilotEventSubscriber): Unsubscribe {
 const internal: InternalSub = { orgId, conversationId, handler };
 const list = this.subs.get(conversationId) ?? [];
 list.push(internal);
 this.subs.set(conversationId, list);
 return () => {
 const current = this.subs.get(conversationId) ?? [];
 const idx = current.indexOf(internal);
 if (idx >= 0) current.splice(idx, 1);
 if (current.length === 0) this.subs.delete(conversationId);
 };
 }

 subscriberCount(): number {
 let total = 0;
 for (const list of this.subs.values()) total += list.length;
 return total;
 }
}
