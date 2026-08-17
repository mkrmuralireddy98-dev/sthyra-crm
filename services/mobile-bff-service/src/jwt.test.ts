import { describe, it } from 'node:test';
import * as assert from 'node:assert/strict';
import { signJwt, verifyJwt, parseBearerToken } from './jwt.js';

const SECRET = 'test-mobile-jwt-secret-32-bytes-padded';

describe('Mobile JWT (T-003)', () => {
  it('signs + verifies round-trip', () => {
    const token = signJwt({ orgId: 'org_a', userId: 'user_1', deviceId: 'dev_1' }, { secret: SECRET });
    const claims = verifyJwt(token, SECRET);
    assert.equal(claims.orgId, 'org_a');
    assert.equal(claims.userId, 'user_1');
    assert.equal(claims.deviceId, 'dev_1');
  });

  it('rejects tampered signature', () => {
    const token = signJwt({ orgId: 'org_a', userId: 'u', deviceId: 'd' }, { secret: SECRET });
    const parts = token.split('.');
    const tampered = parts[0] + '.' + parts[1] + '.' + parts[2].slice(0, -2) + 'XX';
    assert.throws(() => verifyJwt(tampered, SECRET), /signature/i);
  });

  it('rejects expired tokens', () => {
    const token = signJwt(
      { orgId: 'o', userId: 'u', deviceId: 'd' },
      { secret: SECRET, ttlSeconds: -1 },
    );
    assert.throws(() => verifyJwt(token, SECRET), /expired/i);
  });

  it('rejects malformed token (no separator)', () => {
    assert.throws(() => verifyJwt('no-separator', SECRET), /format/i);
  });

  it('rejects token signed with different secret', () => {
    const token = signJwt({ orgId: 'o', userId: 'u', deviceId: 'd' }, { secret: 'secret-A' });
    assert.throws(() => verifyJwt(token, 'secret-B'), /signature/i);
  });

  it('parseBearerToken extracts Bearer token', () => {
    assert.equal(parseBearerToken('Bearer abc123'), 'abc123');
    assert.equal(parseBearerToken('bearer xyz'), 'xyz');
  });

  it('parseBearerToken returns null on non-Bearer or empty', () => {
    assert.equal(parseBearerToken(undefined), null);
    assert.equal(parseBearerToken(''), null);
    assert.equal(parseBearerToken('Basic xxx'), null);
    assert.equal(parseBearerToken('Bearer'), null);
  });

  it('verify rejects empty parts', () => {
    assert.throws(() => verifyJwt('..', SECRET), /format/i);
    assert.throws(() => verifyJwt('a..', SECRET), /format/i);
  });
});
