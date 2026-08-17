import { describe, it } from 'node:test';
import * as assert from 'node:assert/strict';
import { MILESTONE_STATUSES, PROJECT_STATUSES, PROGRESS_SOURCES } from './types.js';

describe('Track types — status enums', () => {
  it('MILESTONE_STATUSES has 4 values', () => {
    assert.equal(MILESTONE_STATUSES.length, 4);
    assert.ok(MILESTONE_STATUSES.includes('pending'));
    assert.ok(MILESTONE_STATUSES.includes('in_progress'));
    assert.ok(MILESTONE_STATUSES.includes('completed'));
    assert.ok(MILESTONE_STATUSES.includes('skipped'));
  });

  it('PROJECT_STATUSES has 6 values', () => {
    assert.equal(PROJECT_STATUSES.length, 6);
    assert.ok(PROJECT_STATUSES.includes('planning'));
    assert.ok(PROJECT_STATUSES.includes('active'));
    assert.ok(PROJECT_STATUSES.includes('at_risk'));
    assert.ok(PROJECT_STATUSES.includes('delayed'));
    assert.ok(PROJECT_STATUSES.includes('completed'));
    assert.ok(PROJECT_STATUSES.includes('cancelled'));
  });

  it('PROGRESS_SOURCES has manual only (MVP)', () => {
    assert.equal(PROGRESS_SOURCES.length, 1);
    assert.ok(PROGRESS_SOURCES.includes('manual'));
  });
});
