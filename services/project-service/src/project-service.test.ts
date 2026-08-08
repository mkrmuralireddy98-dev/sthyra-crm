import { describe, it, beforeEach } from 'node:test';
import * as assert from 'node:assert/strict';
import { ProjectService, InMemoryProjectRepository } from './index.js';

describe('ProjectService', () => {
  let service: ProjectService;
  let repo: InMemoryProjectRepository;

  beforeEach(() => {
    repo = new InMemoryProjectRepository();
    service = new ProjectService(repo);
  });

  describe('create()', () => {
    it('returns a project with id, org_id, name, status, address, started_at, created_at', async () => {
      const project = await service.create({
        orgId: 'org_00000001',
        name: 'Hudson Tower',
        address: '500 W 33rd St, New York, NY',
        startedAt: new Date('2026-01-15'),
      });

      assert.ok(project.id);
      assert.equal(project.orgId, 'org_00000001');
      assert.equal(project.name, 'Hudson Tower');
      assert.equal(project.status, 'active');
      assert.equal(project.address, '500 W 33rd St, New York, NY');
      assert.equal(project.startedAt.toISOString(), '2026-01-15T00:00:00.000Z');
      assert.ok(project.createdAt);
    });

    it('rejects empty name', async () => {
      await assert.rejects(
        () => service.create({ orgId: 'org_x', name: '', address: 'A', startedAt: new Date() }),
        /name/i,
      );
    });

    it('rejects an unknown status', async () => {
      await assert.rejects(
        () =>
          service.create({
            orgId: 'org_x',
            name: 'A',
            address: 'A',
            startedAt: new Date(),
            status: 'frozen' as never,
          }),
        /status/i,
      );
    });

    it('rejects missing orgId', async () => {
      await assert.rejects(
        () => service.create({ orgId: '', name: 'A', address: 'A', startedAt: new Date() }),
        /orgId/i,
      );
    });

    it('two projects in different orgs with the same name are allowed', async () => {
      const a = await service.create({
        orgId: 'org_a',
        name: 'Tower',
        address: 'addr',
        startedAt: new Date(),
      });
      const b = await service.create({
        orgId: 'org_b',
        name: 'Tower',
        address: 'addr',
        startedAt: new Date(),
      });
      assert.notEqual(a.id, b.id);
    });

    it('archive() transitions an active project to archived', async () => {
      const created = await service.create({
        orgId: 'org_a',
        name: 'A',
        address: 'A',
        startedAt: new Date(),
      });
      const archived = await service.archive(created.id);
      assert.equal(archived.status, 'archived');
      assert.ok(archived.archivedAt);
    });

    it('archive() rejects archiving an already-archived project', async () => {
      const created = await service.create({
        orgId: 'org_a',
        name: 'A',
        address: 'A',
        startedAt: new Date(),
      });
      await service.archive(created.id);
      await assert.rejects(
        () => service.archive(created.id),
        /already archived/i,
      );
    });
  });

  describe('list()', () => {
    it('returns only projects belonging to the requested org', async () => {
      await service.create({ orgId: 'org_a', name: 'A1', address: 'x', startedAt: new Date() });
      await service.create({ orgId: 'org_a', name: 'A2', address: 'y', startedAt: new Date() });
      await service.create({ orgId: 'org_b', name: 'B1', address: 'z', startedAt: new Date() });

      const aProjects = await service.list({ orgId: 'org_a' });
      const bProjects = await service.list({ orgId: 'org_b' });

      assert.equal(aProjects.length, 2);
      assert.equal(bProjects.length, 1);
      assert.ok(aProjects.every((p) => p.orgId === 'org_a'));
      assert.ok(bProjects.every((p) => p.orgId === 'org_b'));
    });

    it('respects limit parameter', async () => {
      for (let i = 0; i < 5; i++) {
        await service.create({
          orgId: 'org_a',
          name: `Project ${i}`,
          address: 'x',
          startedAt: new Date(),
        });
      }
      const page = await service.list({ orgId: 'org_a', limit: 3 });
      assert.equal(page.length, 3);
    });
  });

  describe('get()', () => {
    it('returns the project by id', async () => {
      const created = await service.create({
        orgId: 'org_a',
        name: 'A',
        address: 'A',
        startedAt: new Date(),
      });
      const found = await service.get(created.id);
      assert.ok(found);
      assert.equal(found?.id, created.id);
    });

    it('returns null for unknown id', async () => {
      assert.equal(await service.get('missing'), null);
    });
  });
});
