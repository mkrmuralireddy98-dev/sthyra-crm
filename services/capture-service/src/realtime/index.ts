/**
 * EventBus — capture-scoped pub/sub for realtime push.
 *
 * Per tasks.md T-023:
 *   - Subscribers register interest in a specific captureId
 *   - Publishers emit DomainEvents
 *   - Events are routed to subscribers with the matching captureId
 *   - Tenant boundary: subscriber's (orgId, captureId) is matched as a
 *     pair — events for the same captureId but a different orgId are
 *     never delivered (Constitution §II)
 *
 * InMemoryEventBus is the Phase 1 MVP. For multi-instance production
 * it would be Redis pub/sub or AWS SNS/SQS (Phase 1.b).
 *
 * The bus is a thin wrapper — the orchestrator and CaptureService own
 * the publishing; the HTTP SSE handler (T-024) owns the subscribing.
 */

import type { DomainEvent } from '../types.js';

export type EventSubscriber = (event: DomainEvent) => void | Promise<void>;
export type Unsubscribe = () => void;

export interface EventBus {
 publish(event: DomainEvent): Promise<void>;
 /**
 * Subscribe to all events for a given (orgId, captureId) pair.
 * Returns an unsubscribe function. The orgId is checked at dispatch
 * time so cross-tenant events are NEVER delivered (Constitution §II).
 */
 subscribe(orgId: string, captureId: string, handler: EventSubscriber): Unsubscribe;
 /**
 * Returns the total number of active subscriptions (for diagnostics).
 */
 subscriberCount(): number;
}

interface InternalSubscription {
 readonly orgId: string;
 readonly captureId: string;
 readonly handler: EventSubscriber;
}

export class InMemoryEventBus implements EventBus {
 private readonly subscriptions = new Map<string, InternalSubscription[]>();

 async publish(event: DomainEvent): Promise<void> {
 const subs = this.subscriptions.get(event.captureId) ?? [];
 // Run all handlers in parallel, catching per-handler errors so one
 // faulty subscriber doesn't break the others (Constitution §V — isolation).
 await Promise.all(subs.map(async (sub) => {
 // Tenant boundary: same captureId in a different org is NOT delivered.
 if (sub.orgId !== event.orgId) return;
 try {
 await sub.handler(event);
 } catch (err) {
 // Swallow — but in production we'd log this via a logger injected
 // via the constructor. For Phase 1 we leave it as a console.error.
 // eslint-disable-next-line no-console
 console.error('event subscriber error:', err);
 }
 }));
 }

 subscribe(orgId: string, captureId: string, handler: EventSubscriber): Unsubscribe {
 const internal: InternalSubscription = { orgId, captureId, handler };
 const list = this.subscriptions.get(captureId) ?? [];
 list.push(internal);
 this.subscriptions.set(captureId, list);
 return () => {
 const current = this.subscriptions.get(captureId) ?? [];
 const idx = current.indexOf(internal);
 if (idx >= 0) current.splice(idx, 1);
 if (current.length === 0) this.subscriptions.delete(captureId);
 };
 }

 subscriberCount(): number {
 let total = 0;
 for (const list of this.subscriptions.values()) total += list.length;
 return total;
 }
}
