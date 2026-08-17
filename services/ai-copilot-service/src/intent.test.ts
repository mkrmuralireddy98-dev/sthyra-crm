import { describe, it } from 'node:test';
import * as assert from 'node:assert/strict';
import { classifyIntent } from './intent.js';

describe('AI Copilot — intent classifier (T-006)', () => {
 it('classifies issue listing', () => {
 const i = classifyIntent('show all open issues');
 assert.equal(i.type, 'list_issues');
 assert.equal(i.slots['status'], 'open');
 });

 it('classifies capture listing with status filter', () => {
 const i = classifyIntent('list walks that are ready');
 assert.equal(i.type, 'list_captures');
 assert.equal(i.slots['status'], 'ready');
 });

 it('classifies element lookup with coordinates', () => {
 const i = classifyIntent('what element is at x=1.5, y=2.5, z=0.5');
 assert.equal(i.type, 'lookup_element');
 assert.equal(i.slots['x'], 1.5);
 assert.equal(i.slots['y'], 2.5);
 assert.equal(i.slots['z'], 0.5);
 });

 it('classifies summarize_project', () => {
 const i = classifyIntent('how is Phase 3 going');
 assert.equal(i.type, 'summarize_project');
 });

 it('classifies find_blockers', () => {
 const i = classifyIntent('show all blockers');
 assert.equal(i.type, 'find_blockers');
 });

 it('falls back to clarify for ambiguous input', () => {
 const i = classifyIntent('xyz abc foo bar');
 assert.equal(i.type, 'clarify');
 assert.equal(i.confidence, 0.3);
 });

 it('returns confidence between 0 and 1', () => {
 const i = classifyIntent('show issues');
 assert.ok(i.confidence > 0 && i.confidence <= 1);
 });

 it('highest-scoring pattern wins on ambiguous input', () => {
 const i = classifyIntent('show me the issues from this walk');
 // Multiple keywords match list_issues more strongly than list_captures
 assert.equal(i.type, 'list_issues');
 });
});
