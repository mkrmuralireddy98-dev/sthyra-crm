import { describe, it, beforeEach } from 'node:test';
import * as assert from 'node:assert/strict';
import { InMemoryOrgRepository, OrgService } from './index.js';

describe('OrgService.list()', () => {
  let service: OrgService;
  let repo: InMemoryOrgRepository;

  beforeEach(() => {
    repo = new InMemoryOrgRepository();
    service = new OrgService(repo);
  });

  it('returns an empty array when no orgs exist', async () => {
    const list = await service.list();
    assert.deepEqual(list, []);
  });

  it('returns all orgs when called without filters', async () => {
    await service.create({ name: 'A', region: 'us-east', plan: 'pro' });
    await service.create({ name: 'B', region: 'us-east', plan: 'pro' });
    await service.create({ name: 'C', region: 'eu-west', plan: 'pro' });

    const list = await service.list();
    assert.equal(list.length, 3);
  });

  it('filters by region when region is provided', async () => {
    await service.create({ name: 'A', region: 'us-east', plan: 'pro' });
    await service.create({ name: 'B', region: 'eu-west', plan: 'pro' });
    await service.create({ name: 'C', region: 'us-east', plan: 'pro' });

    const list = await service.list({ region: 'us-east' });
    assert.equal(list.length, 2);
    assert.ok(list.every((o) => o.region === 'us-east'));
  });

  it('respects limit parameter', async () => {
    for (let i = 0; i < 10; i++) {
      await service.create({ name: `Org ${i}`, region: 'us-east', plan: 'pro' });
    }
    const list = await service.list({ limit: 3 });
    assert.equal(list.length, 3);
  });
});
