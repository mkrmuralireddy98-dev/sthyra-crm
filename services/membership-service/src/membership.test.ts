import { describe, it, beforeEach } from 'node:test';
import * as assert from 'node:assert/strict';
import {
  MembershipService,
  InMemoryMembershipRepository,
  type OrgRole,
  type ProjectRole,
} from './index.js';

describe('MembershipService', () => {
  let service: MembershipService;
  let repo: InMemoryMembershipRepository;

  beforeEach(() => {
    repo = new InMemoryMembershipRepository();
    service = new MembershipService(repo);
  });

  describe('addOrgMember()', () => {
    it('adds a user to an org with a role', async () => {
      const m = await service.addOrgMember({
        userId: 'usr_1',
        orgId: 'org_1',
        role: 'project_admin',
      });
      assert.ok(m.id);
      assert.equal(m.userId, 'usr_1');
      assert.equal(m.orgId, 'org_1');
      assert.equal(m.role, 'project_admin');
      assert.ok(m.createdAt);
    });

    it('rejects an unknown role', async () => {
      await assert.rejects(
        () =>
          service.addOrgMember({
            userId: 'usr_1',
            orgId: 'org_1',
            role: 'god_mode' as OrgRole,
          }),
        /role/i,
      );
    });

    it('rejects a duplicate (userId, orgId) pair', async () => {
      const input = {
        userId: 'usr_1',
        orgId: 'org_1',
        role: 'project_admin' as OrgRole,
      };
      await service.addOrgMember(input);
      await assert.rejects(
        () => service.addOrgMember(input),
        /already a member/i,
      );
    });
  });

  describe('addProjectMember()', () => {
    it('adds a user to a project with a role', async () => {
      const m = await service.addProjectMember({
        userId: 'usr_1',
        projectId: 'prj_1',
        role: 'field_worker',
      });
      assert.equal(m.role, 'field_worker');
    });

    it('rejects unknown project role', async () => {
      await assert.rejects(
        () =>
          service.addProjectMember({
            userId: 'usr_1',
            projectId: 'prj_1',
            role: 'janitor' as ProjectRole,
          }),
        /role/i,
      );
    });

    it('different roles for the same (userId, projectId) are not duplicates', async () => {
      await service.addProjectMember({
        userId: 'usr_1',
        projectId: 'prj_1',
        role: 'field_worker',
      });
      const updated = await service.addProjectMember({
        userId: 'usr_1',
        projectId: 'prj_1',
        role: 'foreman',
      });
      assert.equal(updated.role, 'foreman');
    });
  });

  describe('listOrgMembers()', () => {
    it('returns all members of an org', async () => {
      await service.addOrgMember({ userId: 'u1', orgId: 'org_1', role: 'org_owner' });
      await service.addOrgMember({ userId: 'u2', orgId: 'org_1', role: 'project_admin' });
      await service.addOrgMember({ userId: 'u3', orgId: 'org_2', role: 'project_admin' });

      const members = await service.listOrgMembers('org_1');
      assert.equal(members.length, 2);
      assert.ok(members.every((m) => m.orgId === 'org_1'));
    });
  });

  describe('listProjectsForUser()', () => {
    it('returns all projects a user is a member of', async () => {
      await service.addProjectMember({ userId: 'u1', projectId: 'p1', role: 'field_worker' });
      await service.addProjectMember({ userId: 'u1', projectId: 'p2', role: 'foreman' });
      await service.addProjectMember({ userId: 'u2', projectId: 'p3', role: 'field_worker' });

      const projects = await service.listProjectsForUser('u1');
      assert.equal(projects.length, 2);
      assert.ok(projects.every((p) => p.userId === 'u1'));
    });
  });

  describe('removeOrgMember()', () => {
    it('removes an existing member', async () => {
      await service.addOrgMember({ userId: 'u1', orgId: 'org_1', role: 'project_admin' });
      await service.removeOrgMember('u1', 'org_1');
      const members = await service.listOrgMembers('org_1');
      assert.equal(members.length, 0);
    });

    it('does not throw when removing a non-member', async () => {
      await service.removeOrgMember('nonexistent', 'org_1'); // no-op
    });
  });
});
