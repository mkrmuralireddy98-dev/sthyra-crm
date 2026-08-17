/**
 * CopilotRepository — tenant-scoped storage contract.
 */

import type {
 Conversation,
 Message,
 CreateMessageInput,
 CreateConversationInput,
} from './types.js';

export interface CopilotRepository {
 insertConversation(conversation: Conversation): Promise<void>;
 findConversation(orgId: string, id: string): Promise<Conversation | null>;
 listConversations(orgId: string, userId: string, limit?: number, cursor?: string): Promise<{ items: readonly Conversation[]; nextCursor: string | null }>;
 archiveConversation(orgId: string, id: string): Promise<void>;
 insertMessage(message: Message): Promise<void>;
 findMessage(orgId: string, conversationId: string, messageId: string): Promise<Message | null>;
 listMessages(orgId: string, conversationId: string): Promise<readonly Message[]>;
 pinMessage(orgId: string, conversationId: string, messageId: string, pinned: boolean): Promise<void>;
 nextId(): number;
}
