import { describe, it, beforeEach } from 'node:test';
import * as assert from 'node:assert/strict';
import { CopilotService, type CopilotServiceDeps, type SubmitInput } from './service.js';
import type { CopilotRepository } from './repository.js';
import type { Conversation, Message } from './types.js';
import type { ToolRouterDeps } from './tool-router.js';

let repo: CopilotRepository;
let copilotService: CopilotService;
let events: Array<{ type: string; conversationId: string }>;

let conversations: Conversation[] = [];
let messages: Message[] = [];
let counter = 0;

beforeEach(() => {
 // Reset mock state for each test
 conversations = [];
 messages = [];
 counter = 0;
 repo = makeMockRepo();
 events = [];
 copilotService = new CopilotService({
 repo,
 routerDeps: makeMockRouterDeps(),
 onEvent: (e) => events.push({ type: e.type, conversationId: e.conversationId }),
 });
});

describe('CopilotService — submit (T-014)', () => {
 it('creates a new conversation when conversationId is null', async () => {
 const result = await copilotService.submit(makeSubmit('show all issues'), 'prj_1');
 assert.ok(result.reply.conversationId.startsWith('conv_'));
 });

 it('persists user message before assistant message', async () => {
 const r = await copilotService.submit(makeSubmit('show all issues'), 'prj_1');
 const convMessages = await repo.listMessages('org_a', r.reply.conversationId);
 assert.equal(convMessages.length, 2);
 assert.equal(convMessages[0]?.role, 'user');
 assert.equal(convMessages[1]?.role, 'assistant');
 });

 it('user text round-trips into user message', async () => {
 const r = await copilotService.submit(makeSubmit('unique marker text'), 'prj_1');
 const convMessages = await repo.listMessages('org_a', r.reply.conversationId);
 assert.ok(convMessages[0]?.text.includes('unique marker text'));
 });

 it('emits message.received + message.replied events', async () => {
 await copilotService.submit(makeSubmit('show all issues'), 'prj_1');
 assert.equal(events.length, 2);
 assert.equal(events[0]?.type, 'message.received');
 assert.equal(events[1]?.type, 'message.replied');
 });

 it('throws on missing orgId', async () => {
 await assert.rejects(
 copilotService.submit({ orgId: '', userId: 'u', text: 'x' }, 'prj_1'),
 /orgId required/,
 );
 });

 it('throws on missing text', async () => {
 await assert.rejects(
 copilotService.submit({ orgId: 'org_a', userId: 'u', text: '' }, 'prj_1'),
 /text required/,
 );
 });

 it('throws on missing projectId', async () => {
 await assert.rejects(
 copilotService.submit({ orgId: 'org_a', userId: 'u', text: 'x' }, ''),
 /projectId required/,
 );
 });
});

describe('CopilotService — createConversation + list (T-015)', () => {
 it('createConversation returns a server-assigned id', async () => {
 const conv = await copilotService.createConversation({
 orgId: 'org_a', userId: 'user_1', title: 'Q: show issues',
 });
 assert.ok(conv.id.startsWith('conv_'));
 assert.equal(conv.title, 'Q: show issues');
 assert.equal(conv.state, 'active');
 });

 it('listConversations returns tenant-scoped conversations', async () => {
 await copilotService.createConversation({ orgId: 'org_a', userId: 'user_1', title: 'A' });
 await copilotService.createConversation({ orgId: 'org_a', userId: 'user_1', title: 'B' });
 const list = await copilotService.listConversations('org_a', 'user_1');
 assert.equal(list.items.length, 2);
 });
});

describe('CopilotService — pin (T-016)', () => {
 it('pinMessage sets pinned=true on the message', async () => {
 const result = await copilotService.submit(makeSubmit('show issues'), 'prj_1');
 await copilotService.pinMessage('org_a', result.reply.conversationId, result.reply.id, true);
 const messages = await repo.listMessages('org_a', result.reply.conversationId);
 const pinned = messages.filter((m) => m.pinned);
 assert.equal(pinned.length, 1);
 });

 it('pinMessage across tenants throws (cross-tenant)', async () => {
 const result = await copilotService.submit(makeSubmit('show issues'), 'prj_1');
 await assert.rejects(
 copilotService.pinMessage('org_b', result.reply.conversationId, result.reply.id, true),
 /not found/i,
 );
 });
});

describe('CopilotService — archive', () => {
 it('archiveConversation sets archived state', async () => {
 const conv = await copilotService.createConversation({ orgId: 'org_a', userId: 'user_1', title: 'A' });
 await copilotService.archiveConversation('org_a', conv.id);
 const after = await copilotService.getConversation('org_a', conv.id);
 assert.equal(after?.state, 'archived');
 });
});

function makeSubmit(text: string): SubmitInput {
 return { orgId: 'org_a', userId: 'user_1', conversationId: null, text };
}

function makeMockRepo(): CopilotRepository {
 return {
 insertConversation: async (c) => { conversations.push(c); },
 findConversation: async (_orgId, id) => conversations.find((c) => c.id === id) ?? null,
 listConversations: async (orgId, userId) => ({
 items: conversations.filter((c) => c.orgId === orgId && c.userId === userId),
 nextCursor: null,
 }),
 archiveConversation: async (orgId, id) => {
 const c = conversations.find((x) => x.orgId === orgId && x.id === id);
 if (c) {
 c.archivedAt = new Date();
 c.state = 'archived';
 }
 },
 insertMessage: async (m) => { messages.push(m); },
 findMessage: async (orgId, convId, msgId) =>
 messages.find((m) => m.orgId === orgId && m.conversationId === convId && m.id === msgId) ?? null,
 listMessages: async (orgId, convId) =>
 messages.filter((m) => m.orgId === orgId && m.conversationId === convId),
 pinMessage: async (orgId, convId, msgId, pinned) => {
 const m = messages.find((x) => x.orgId === orgId && x.conversationId === convId && x.id === msgId);
 if (m) {
 m.pinned = pinned;
 m.pinnedAt = pinned ? new Date() : null;
 }
 },
 nextId: () => ++counter,
 };
}

function makeMockRouterDeps(): ToolRouterDeps {
 return {
 fetchFn: (async () => ({
 ok: true,
 status: 200,
 json: async () => ({ items: [], total: 0 }),
 } as unknown as Response)) as typeof fetch,
 captureServiceUrl: 'http://capture',
 fieldServiceUrl: 'http://field',
 bimViewerServiceUrl: 'http://bim',
 };
}

// Reset mock state captured in let above (closed over per-test).
