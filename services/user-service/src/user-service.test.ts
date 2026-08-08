import { describe, it, beforeEach } from 'node:test';
import * as assert from 'node:assert/strict';
import {
  UserService,
  InMemoryUserRepository,
  InMemoryTokenStore,
  type Role,
} from './index.js';

describe('UserService', () => {
  let service: UserService;
  let users: InMemoryUserRepository;
  let tokens: InMemoryTokenStore;

  beforeEach(() => {
    users = new InMemoryUserRepository();
    tokens = new InMemoryTokenStore();
    service = new UserService({ users, tokens, tokenTtlSeconds: 3600 });
  });

  describe('provision()', () => {
    it('creates a user with id, email, displayName, role, createdAt', async () => {
      const user = await service.provision({
        email: 'maya@hudson-tower.gc',
        displayName: 'Maya Reyes',
        role: 'project_admin',
        orgId: 'org_00000001',
      });
      assert.ok(user.id.startsWith('usr_'));
      assert.equal(user.email, 'maya@hudson-tower.gc');
      assert.equal(user.displayName, 'Maya Reyes');
      assert.equal(user.role, 'project_admin');
      assert.equal(user.orgId, 'org_00000001');
      assert.ok(user.createdAt);
    });

    it('rejects an invalid role', async () => {
      await assert.rejects(
        () =>
          service.provision({
            email: 'valid@x.com',
            displayName: 'X',
            role: 'god_mode' as Role,
            orgId: 'org_x',
          }),
        /role/i,
      );
    });

    it('rejects an invalid email', async () => {
      await assert.rejects(
        () =>
          service.provision({
            email: 'not-an-email',
            displayName: 'X',
            role: 'field_worker',
            orgId: 'org_x',
          }),
        /email/i,
      );
    });

    it('rejects a duplicate email in the same org', async () => {
      await service.provision({
        email: 'maya@hudson.gc',
        displayName: 'Maya',
        role: 'field_worker',
        orgId: 'org_x',
      });
      await assert.rejects(
        () =>
          service.provision({
            email: 'maya@hudson.gc',
            displayName: 'Maya 2',
            role: 'field_worker',
            orgId: 'org_x',
          }),
        /already exists/i,
      );
    });

    it('allows the same email in a different org', async () => {
      await service.provision({
        email: 'shared@x.com',
        displayName: 'A',
        role: 'field_worker',
        orgId: 'org_a',
      });
      const other = await service.provision({
        email: 'shared@x.com',
        displayName: 'B',
        role: 'project_admin',
        orgId: 'org_b',
      });
      assert.notEqual(other.id, (await users.findByEmail('shared@x.com', 'org_a'))?.id);
    });
  });

  describe('issueToken() + verifyToken()', () => {
    it('issues a token that round-trips back to the user', async () => {
      const user = await service.provision({
        email: 'maya@hudson.gc',
        displayName: 'Maya',
        role: 'project_admin',
        orgId: 'org_x',
      });
      const { token, expiresAt } = await service.issueToken(user.id);
      assert.ok(token.length > 20, 'token must be opaque');
      assert.ok(expiresAt > new Date());

      const verified = await service.verifyToken(token);
      assert.ok(verified);
      assert.equal(verified.userId, user.id);
      assert.equal(verified.orgId, 'org_x');
      assert.equal(verified.role, 'project_admin');
    });

    it('verifyToken returns null for unknown token', async () => {
      assert.equal(await service.verifyToken('not-a-real-token'), null);
    });

    it('verifyToken returns null for an expired token', async () => {
      const user = await service.provision({
        email: 'maya@hudson.gc',
        displayName: 'Maya',
        role: 'project_admin',
        orgId: 'org_x',
      });
      const shortLived = new UserService({
        users,
        tokens,
        tokenTtlSeconds: -1,
      });
      const { token } = await shortLived.issueToken(user.id);
      assert.equal(await service.verifyToken(token), null);
    });

    it('revokeToken invalidates a token', async () => {
      const user = await service.provision({
        email: 'maya@hudson.gc',
        displayName: 'Maya',
        role: 'project_admin',
        orgId: 'org_x',
      });
      const { token } = await service.issueToken(user.id);
      await service.revokeToken(token);
      assert.equal(await service.verifyToken(token), null);
    });
  });
});
