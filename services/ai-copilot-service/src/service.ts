/**
 * CopilotService — domain layer.
 * Composes intent + tool router + reply composer + repository + state machine.
 */

import { randomUUID } from 'node:crypto';
import {
 initialConversationState,
 transitionConversation,
 type ConversationEvent,
} from './state-machine.js';
import { classifyIntent } from './intent.js';
import { composeReply } from './reply-composer.js';
import { routeTools, type ToolRouterDeps } from './tool-router.js';
import type {
 Conversation, Message, Intent, ToolCall, ToolError,
 CreateConversationInput, CreateMessageInput, PaginationCursor,
} from './types.js';
import type { CopilotRepository } from './repository.js';
import { encodeCursor, decodeCursor } from './pagination.js';

const DEFAULT_PAGINATION_SECRET = process.env.PAGINATION_SECRET ?? 'sthyra-crm-dev-pagination-secret-32b';
const MAX_MESSAGES_PER_CONVERSATION = 1000;

export type CopilotEvent =
 | { type: 'message.received'; orgId: string; conversationId: string; messageId: string }
 | { type: 'message.replied'; orgId: string; conversationId: string; messageId: string };

export interface CopilotServiceDeps {
 readonly repo: CopilotRepository;
 readonly routerDeps: ToolRouterDeps;
 readonly paginationSecret?: string;
 readonly onEvent?: (event: CopilotEvent) => void;
}

export interface SubmitInput {
 readonly orgId: string;
 readonly userId: string;
 readonly conversationId?: string | null;
 readonly text: string;
 readonly idempotencyKey?: string | null;
}

export interface SubmitOutput {
 readonly reply: Message;
 readonly toolCalls: readonly ToolCall[];
 readonly toolErrors: readonly ToolError[];
}

export class CopilotService {
 private readonly repo: CopilotRepository;
 private readonly routerDeps: ToolRouterDeps;
 private readonly paginationSecret: string;
 private readonly onEvent: (e: CopilotEvent) => void;

 constructor(deps: CopilotServiceDeps) {
 this.repo = deps.repo;
 this.routerDeps = deps.routerDeps;
 this.paginationSecret = deps.paginationSecret ?? DEFAULT_PAGINATION_SECRET;
 this.onEvent = deps.onEvent ?? (() => {});
 }

 // ─── T-014: submit ────────────────────────────────────────
 async submit(input: SubmitInput, projectId: string): Promise<SubmitOutput> {
 if (!input.orgId) throw new Error('orgId required (Constitution §II)');
 if (!input.userId) throw new Error('userId required');
 if (!input.text || !input.text.trim()) throw new Error('text required');
 if (!projectId) throw new Error('projectId required');

 let conversationId = input.conversationId;
 if (!conversationId) {
 // Create new conversation; title = first 80 chars of text (Q7)
 const title = 'Q: ' + input.text.trim().slice(0, 80);
 const conv = await this.createConversation({
 orgId: input.orgId,
 userId: input.userId,
 title,
 });
 conversationId = conv.id;
 }

 // Q6 — max 1000 messages per conversation
 const existing = await this.repo.listMessages(input.orgId, conversationId);
 if (existing.length >= MAX_MESSAGES_PER_CONVERSATION) {
 throw new Error('conversation at message cap (1000)');
 }

 // Persist user message
 const userMessageId = `msg_${randomUUID().replace(/-/g, '').slice(0, 22)}`;
 const userMessage: Message = {
 id: userMessageId,
 orgId: input.orgId,
 conversationId,
 userId: input.userId,
 role: 'user',
 text: input.text,
 intent: null,
 toolCalls: [],
 toolErrors: [],
 pinned: false,
 pinnedAt: null,
 createdAt: new Date(),
 };
 await this.repo.insertMessage(userMessage);
 this.emit({ type: 'message.received', orgId: input.orgId, conversationId, messageId: userMessageId });

 // Classify intent (NFR-2: deterministic)
 const intent: Intent = classifyIntent(input.text);

 // Route tools
 const { calls: toolCalls, errors: toolErrors } = await routeTools(intent, this.routerDeps, {
 orgId: input.orgId,
 projectId,
 });

 // Compose reply
 const replyText = composeReply(intent, toolCalls, toolErrors).text;

 // Persist assistant message
 const replyMessageId = `msg_${randomUUID().replace(/-/g, '').slice(0, 22)}`;
 const reply: Message = {
 id: replyMessageId,
 orgId: input.orgId,
 conversationId,
 userId: 'assistant',
 role: 'assistant',
 text: replyText,
 intent,
 toolCalls,
 toolErrors,
 pinned: false,
 pinnedAt: null,
 createdAt: new Date(),
 };
 await this.repo.insertMessage(reply);
 this.emit({ type: 'message.replied', orgId: input.orgId, conversationId, messageId: replyMessageId });

 return { reply, toolCalls, toolErrors };
 }

 // ─── T-015: getConversation + list ─────────────────────────
 async createConversation(input: CreateConversationInput): Promise<Conversation> {
 if (!input.orgId) throw new Error('orgId required');
 if (!input.userId) throw new Error('userId required');
 if (!input.title) throw new Error('title required (Q7)');
 const id = `conv_${randomUUID().replace(/-/g, '').slice(0, 22)}`;
 const conv: Conversation = {
 id,
 orgId: input.orgId,
 userId: input.userId,
 title: input.title,
 state: 'active',
 createdAt: new Date(),
 archivedAt: null,
 };
 await this.repo.insertConversation(conv);
 return conv;
 }

 async getConversation(orgId: string, id: string): Promise<Conversation | null> {
 return this.repo.findConversation(orgId, id);
 }

 async listConversations(
 orgId: string,
 userId: string,
 pagination?: { limit?: number; cursor?: string },
 ): Promise<{ items: readonly Conversation[]; nextCursor: string | null }> {
 let cursorDecoded: PaginationCursor | undefined;
 if (pagination?.cursor) {
 cursorDecoded = decodeCursor(pagination.cursor, this.paginationSecret);
 }
 return this.repo.listConversations(orgId, userId, pagination?.limit ?? 50, cursorDecoded
 ? encodeCursor(cursorDecoded, this.paginationSecret)
 : undefined);
 }

 async archiveConversation(orgId: string, id: string): Promise<void> {
 const conv = await this.repo.findConversation(orgId, id);
 if (!conv) throw new Error(`conversation not found: ${id}`);
 const before = initialConversationState();
 const after = transitionConversation(before, { type: 'archive' } satisfies ConversationEvent);
 if (after.state !== 'archived') throw new Error(`expected archived state, got ${after.state}`);
 await this.repo.archiveConversation(orgId, id);
 }

 // ─── T-016: pin ─────────────────────────────────────────────
 async pinMessage(orgId: string, conversationId: string, messageId: string, pinned: boolean): Promise<void> {
 const message = await this.repo.findMessage(orgId, conversationId, messageId);
 if (!message) throw new Error(`message not found: ${messageId}`);
 if (message.orgId !== orgId) throw new Error(`not found: ${messageId}`);
 await this.repo.pinMessage(orgId, conversationId, messageId, pinned);
 }

 // ─── Helpers ──────────────────────────────────────────────
 private emit(e: CopilotEvent): void {
 this.onEvent(e);
 }
}
