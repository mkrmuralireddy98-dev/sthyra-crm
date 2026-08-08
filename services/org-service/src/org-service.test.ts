import { describe, it, beforeEach } from 'node:test';
import * as assert from 'node:assert/strict';
import { OrgService, InMemoryOrgRepository, type CreateOrgInput } from './index.js';

describe('OrgService', () => {
  let service: OrgService;
  let repo: InMemoryOrgRepository;

  beforeEach(() => {
    repo = new InMemoryOrgRepository();
    service = new OrgService(repo);
  });

  describe('create()', () => {
    it('returns a new org with an id, name, region, plan, and createdAt', async () => {
      const org = await service.create({
        name: 'Hudson Tower GC',
        region: 'us-east',
        plan: 'pro',
      });

      assert.ok(org.id, 'org.id must be set');
      assert.equal(org.name, 'Hudson Tower GC');
      assert.equal(org.region, 'us-east');
      assert.equal(org.plan, 'pro');
      assert.ok(org.createdAt instanceof Date);
    });

    it('rejects an empty name', async () => {
      await assert.rejects(
        () => service.create({ name: '', region: 'us-east', plan: 'pro' }),
        /name/i,
      );
    });

    it('rejects an unknown region', async () => {
      await assert.rejects(
        () => service.create({ name: 'Acme', region: 'mars' as never, plan: 'pro' }),
        /region/i,
      );
    });

    it('rejects an unknown plan', async () => {
      await assert.rejects(
        () => service.create({ name: 'Acme', region: 'us-east', plan: 'platinum' as never }),
        /plan/i,
      );
    });

    it('rejects a duplicate (name, region) pair — tenant-scoped uniqueness', async () => {
      const input: CreateOrgInput = { name: 'Acme GC', region: 'us-east', plan: 'pro' };
      await service.create(input);
      await assert.rejects(
        () => service.create(input),
        /already exists/i,
      );
    });

    it('allows the same name in different regions', async () => {
      const first  = await service.create({ name: 'Acme GC', region: 'us-east', plan: 'pro' });
      const second = await service.create({ name: 'Acme GC', region: 'eu-west', plan: 'pro' });
      assert.notEqual(first.id, second.id, 'different regions must yield different org ids');
    });
  });

  describe('get()', () => {
    it('returns the org by id', async () => {
      const created = await service.create({ name: 'Acme', region: 'us-east', plan: 'pro' });
      const found = await service.get(created.id);
      assert.ok(found);
      assert.equal(found?.id, created.id);
    });

    it('returns null for an unknown id', async () => {
      const found = await service.get('does-not-exist');
      assert.equal(found, null);
    });
  });
});
