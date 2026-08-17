import { describe, it } from 'node:test';
import * as assert from 'node:assert/strict';
import { mapProcoreRFI, mapBIM360Issue, mapPlangridPunch } from './mappers.js';

describe('mappers', () => {
  it('mapProcoreRFI maps fields', () => {
    const r = mapProcoreRFI({ id: 'rfi_1', title: 'RFI', description: 'desc' });
    assert.equal(r.title, 'RFI');
    assert.equal(r.sourceId, 'rfi_1');
    assert.equal(r.source, 'procore.rfi');
  });

  it('mapBIM360Issue maps fields', () => {
    const i = mapBIM360Issue({ id: 'b1', title: 'Clash', severity: 'high' });
    assert.equal(i.severity, 'high');
    assert.equal(i.source, 'bim360.issue');
  });

  it('mapPlangridPunch maps fields', () => {
    const p = mapPlangridPunch({ id: 'pg_1', name: 'Punch', items: 12 });
    assert.equal(p.source, 'plangrid.punch');
    assert.match(p.description, /12/);
  });

  it('handles missing fields with defaults', () => {
    const r = mapProcoreRFI({});
    assert.equal(r.title, 'Untitled RFI');
    assert.equal(r.sourceId, '');
  });
});
