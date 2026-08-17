import { describe, it } from 'node:test';
import * as assert from 'node:assert/strict';
import { TEMPLATES, findTemplate } from './templates.js';

describe('Workflow templates', () => {
 it('has 5 templates', () => {
 assert.equal(TEMPLATES.length, 5);
 });
 it('escalate_critical uses threshold trigger', () => {
 const t = findTemplate('escalate_critical');
 assert.ok(t);
 assert.equal(t!.trigger.type, 'threshold');
 });
 it('findTemplate returns null for missing', () => {
 assert.equal(findTemplate('nonexistent'), null);
 });
});
