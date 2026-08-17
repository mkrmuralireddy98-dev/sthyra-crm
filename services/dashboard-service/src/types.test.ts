import { describe, it } from 'node:test';
import * as assert from 'node:assert/strict';
import type { ProjectSummary } from './types.js';

describe('Dashboard types', () => {
  it('ProjectSummary shape', () => {
    const p: ProjectSummary = {
      id: 'p1', orgId: 'org_a', name: 'Project A', status: 'active', progressPct: 47,
    };
    assert.equal(p.status, 'active');
    assert.equal(p.progressPct, 47);
  });
});
