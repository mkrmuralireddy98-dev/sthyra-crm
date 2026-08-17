import { describe, it } from 'node:test';
import * as assert from 'node:assert/strict';
import {
 MESSAGE_ROLES, INTENTS, TOOL_NAMES, CONVERSATION_STATES,
 type IntentType, type ToolName, type ConversationState, type MessageRole,
} from './types.js';

describe('AI Copilot — types', () => {
 it('MESSAGE_ROLES has 2 values', () => {
 assert.equal(MESSAGE_ROLES.length, 2);
 assert.deepEqual([...MESSAGE_ROLES], ['user', 'assistant']);
 });

 it('INTENTS has 6 values', () => {
 assert.equal(INTENTS.length, 6);
 const expected = ['clarify', 'find_blockers', 'list_captures', 'list_issues', 'lookup_element', 'summarize_project'];
 assert.deepEqual([...INTENTS].sort(), expected);
 });

 it('TOOL_NAMES has 6 values', () => {
 assert.equal(TOOL_NAMES.length, 6);
 });

 it('CONVERSATION_STATES has 2 values', () => {
 assert.equal(CONVERSATION_STATES.length, 2);
 assert.deepEqual([...CONVERSATION_STATES].sort(), ['active', 'archived']);
 });

 it('IntentType supports all 6 intents', () => {
 const types: IntentType[] = ['list_captures', 'list_issues', 'lookup_element', 'summarize_project', 'find_blockers', 'clarify'];
 for (const t of types) assert.equal(t, t);
 });

 it('ToolName supports all 6 tools', () => {
 const tools: ToolName[] = ['capture.list', 'capture.by_id', 'issue.list', 'issue.by_id', 'bim.lookup_element', 'bim.diff_summary'];
 for (const t of tools) assert.equal(t, t);
 });

 it('ConversationState supports both states', () => {
 const states: ConversationState[] = ['active', 'archived'];
 for (const s of states) assert.equal(s, s);
 });

 it('MessageRole supports user + assistant', () => {
 const roles: MessageRole[] = ['user', 'assistant'];
 for (const r of roles) assert.equal(r, r);
 });
});
