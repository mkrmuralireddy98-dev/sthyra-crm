import { describe, it } from 'node:test';
import * as assert from 'node:assert/strict';
import { composeReply } from './reply-composer.js';
import type { Intent, ToolCall, ToolError } from './types.js';

describe('AI Copilot — reply composer (T-008)', () => {
 it('list_issues reply includes count + filter description', () => {
 const intent: Intent = { type: 'list_issues', slots: { status: 'open', severity: 'high' }, confidence: 0.9 };
 const calls: ToolCall[] = [{
 tool: 'issue.list',
 input: { status: 'open', severity: 'high' },
 output: { total: 7, items: [] },
 }];
 const out = composeReply(intent, calls, []);
 assert.match(out.text, /Found 7 issues/);
 assert.match(out.text, /matching(.*open.*high|.*high.*open)/);
 });

 it('list_captures reply uses singular for count=1', () => {
 const intent: Intent = { type: 'list_captures', slots: {}, confidence: 0.9 };
 const calls: ToolCall[] = [{
 tool: 'capture.list',
 input: {},
 output: { total: 1, items: [] },
 }];
 const out = composeReply(intent, calls, []);
 assert.match(out.text, /1 capture/);
 });

 it('list_captures reply uses plural for count=5', () => {
 const intent: Intent = { type: 'list_captures', slots: {}, confidence: 0.9 };
 const calls: ToolCall[] = [{
 tool: 'capture.list',
 input: {},
 output: { total: 5, items: [] },
 }];
 const out = composeReply(intent, calls, []);
 assert.match(out.text, /5 captures/);
 });

 it('lookup_element reply returns element details when found', () => {
 const intent: Intent = { type: 'lookup_element', slots: { x: 1.5, y: 2.5, z: 0.5 }, confidence: 0.95 };
 const calls: ToolCall[] = [{
 tool: 'bim.lookup_element',
 input: { x: 1.5, y: 2.5, z: 0.5 },
 output: { elementId: 'beam_001', elementName: 'Level 3 East Beam', elementType: 'IfcBeam', distance: 0.03 },
 }];
 const out = composeReply(intent, calls, []);
 assert.match(out.text, /beam_001/);
 assert.match(out.text, /Level 3 East Beam/);
 assert.match(out.text, /IfcBeam/);
 });

 it('lookup_element reply returns "not found" when no element', () => {
 const intent: Intent = { type: 'lookup_element', slots: { x: 100, y: 100, z: 100 }, confidence: 0.95 };
 const calls: ToolCall[] = [{
 tool: 'bim.lookup_element',
 input: { x: 100, y: 100, z: 100 },
 output: { elementId: null, elementName: null, elementType: null, distance: 4.5 },
 }];
 const out = composeReply(intent, calls, []);
 assert.match(out.text, /No BIM element/);
 });

 it('summarize_project reply aggregates 3 sources', () => {
 const intent: Intent = { type: 'summarize_project', slots: {}, confidence: 0.9 };
 const calls: ToolCall[] = [
 { tool: 'issue.list', input: {}, output: { total: 23, items: [] } },
 { tool: 'capture.list', input: {}, output: { total: 4, items: [] } },
 { tool: 'bim.diff_summary', input: {}, output: { total: 12, items: [] } },
 ];
 const out = composeReply(intent, calls, []);
 assert.match(out.text, /23 issue/);
 assert.match(out.text, /4 capture/);
 assert.match(out.text, /12 BIM deviation/);
 });

 it('clarify reply suggests example queries', () => {
 const intent: Intent = { type: 'clarify', slots: {}, confidence: 0.3 };
 const out = composeReply(intent, [], []);
 assert.match(out.text, /didn't understand/);
 assert.match(out.text, /show open high-severity issues/);
 });

 it('errors → reply includes failure note', () => {
 const intent: Intent = { type: 'list_issues', slots: {}, confidence: 0.5 };
 const errors: ToolError[] = [{ tool: 'issue.list', error: 'timeout' }];
 const out = composeReply(intent, [], errors);
 assert.match(out.text, /1 tool call.*failed|Note: 1/);
 });
});
