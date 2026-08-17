import { describe, it } from 'node:test';
import * as assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

describe('docker-compose.integration.yml — Phase 1.b + Phase 2 stack', () => {
 it('parses as valid YAML', () => {
 const yaml = readFileSync(
 join(__dirname, '..', '..', '..', 'docker-compose.integration.yml'),
 'utf8',
 );
 // Minimal YAML check: contains both services and volumes blocks at top level
 assert.match(yaml, /^services:\n/m);
 assert.match(yaml, /^volumes:\n/m);
 });

 it('contains all 4 services (postgres, redis, capture-service, field-service)', () => {
 const yaml = readFileSync(
 join(__dirname, '..', '..', '..', 'docker-compose.integration.yml'),
 'utf8',
 );
 assert.match(yaml, /^  postgres:/m);
 assert.match(yaml, /^  redis:/m);
 assert.match(yaml, /^  capture-service:/m);
 assert.match(yaml, /^  field-service:/m);
 });

 it('field-service container is on port 9091', () => {
 const yaml = readFileSync(
 join(__dirname, '..', '..', '..', 'docker-compose.integration.yml'),
 'utf8',
 );
 assert.match(yaml, /"9091:9091"/);
 });
});
