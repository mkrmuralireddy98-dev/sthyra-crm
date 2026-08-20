import { test } from 'node:test';
import assert from 'node:assert/strict';
import { HealthChecker } from './health.js';

test('aggregates health across services', async () => {
 const checker = new HealthChecker([
 { name: 'good', url: 'http://localhost:1/health' }, // unreachable
 { name: 'fake', url: 'http://fake.example.invalid:9999/health' },
 ]);
 const result = await checker.checkAll(500);
 assert.equal(result.services.length, 2);
 assert.ok(result.services.every(s => s.status === 'unhealthy'));
 assert.equal(result.status, 'unhealthy');
});

test('short timeout marks slow services unhealthy', async () => {
 const checker = new HealthChecker([
 { name: 'never', url: 'http://10.255.255.1/health' },
 ]);
 const result = await checker.checkAll(100);
 assert.equal(result.status, 'unhealthy');
});
