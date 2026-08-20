/**
 * InMemoryCopilotRepository — Phase 4 MVP implementation.
 */

import type { CopilotRepository } from './repository.js';
import type { Conversation, Message, ConversationState } from './types.js';

export class InMemoryCopilotRepository implements CopilotRepository {
 private readonly conversations = new Map<string, Conversation>();
 private readonly messagesByOrgConv = new Map<string, Message[]>();

 private convKey(orgId: string, id: string): string {
 return 'conv:' + orgId + ':' + id;
 }

 private msgKey(orgId: string, conversationId: string): string {
 return orgId + ':' + conversationId;
 }

 async insertConversation(conversation: Conversation): Promise<void> {
 this.conversations.set(this.convKey(conversation.orgId, conversation.id), conversation);
 }

 async findConversation(orgId: string, id: string): Promise<Conversation | null> {
 return this.conversations.get(this.convKey(orgId, id)) ?? null;
 }

 async listConversations(
 orgId: string,
 userId: string,
 limit?: number,
 _cursor?: string,
 ): Promise<{ items: readonly Conversation[]; nextCursor: string | null }> {
 const all: Conversation[] = [];
 for (const c of this.conversations.values()) {
 if (c.orgId === orgId && c.userId === userId) all.push(c);
 }
 all.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
 const limitN = Math.min(200, Math.max(1, limit ?? 50));
 const slice = all.slice(0, limitN);
 const last = slice[slice.length - 1];
 const nextCursor = all.length > limitN && last ? last.createdAt.toISOString() + '|' + last.id : null;
 return { items: slice, nextCursor };
 }

 async archiveConversation(orgId: string, id: string): Promise<void> {
 const c = this.conversations.get(this.convKey(orgId, id));
 if (!c) return;
 const writable = c as { state: ConversationState; archivedAt: Date | null };
 writable.state = 'archived';
 writable.archivedAt = new Date();
 }

 async insertMessage(message: Message): Promise<void> {
 const k = this.msgKey(message.orgId, message.conversationId);
 const list = this.messagesByOrgConv.get(k) ?? [];
 list.push(message);
 this.messagesByOrgConv.set(k, list);
 }

 async findMessage(orgId: string, conversationId: string, messageId: string): Promise<Message | null> {
 const k = this.msgKey(orgId, conversationId);
 const list = this.messagesByOrgConv.get(k) ?? [];
 return list.find((m) => m.id === messageId) ?? null;
 }

 async listMessages(orgId: string, conversationId: string): Promise<readonly Message[]> {
 const k = this.msgKey(orgId, conversationId);
 const list = this.messagesByOrgConv.get(k) ?? [];
 return [...list];
 }

 async pinMessage(orgId: string, conversationId: string, messageId: string, pinned: boolean): Promise<void> {
 const m = await this.findMessage(orgId, conversationId, messageId);
 if (!m) return;
 (m as { pinned: boolean }).pinned = pinned;
 (m as { pinnedAt: Date | null }).pinnedAt = pinned ? new Date() : null;
 }

 nextId(): number {
 return ++counter;
 }
}

let counter = 0;
