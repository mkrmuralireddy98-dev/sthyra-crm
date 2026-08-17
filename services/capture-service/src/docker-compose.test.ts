import { describe, it, before } from 'node:test';
import * as assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

/**
 * Validates docker-compose.integration.yml structurally so we don't
 * regress the YAML indentation that took down the file earlier.
 *
 * Uses simple string-pattern assertions (no full YAML parser).
 * The real validation happens at `docker-compose config` time when
 * someone runs `docker-compose up`.
 */

const composePath = join(__dirname, '../../../docker-compose.integration.yml');
let content = '';

describe('docker-compose.integration.yml', () => {
 before(() => {
 content = readFileSync(composePath, 'utf8');
 });

 it('parses without syntax errors (basic check)', () => {
 assert.match(content, /^services:/m);
 assert.match(content, /^volumes:/m);
 });

 it('has the three expected services: postgres, redis, capture-service', () => {
 assert.match(content, /^  postgres:/m);
 assert.match(content, /^  redis:/m);
 assert.match(content, /^  capture-service:/m);
 });

 it('postgres service has the correct image and port', () => {
 assert.match(content, /image: postgres:16/);
 assert.match(content, /- "5432:5432"/);
 assert.match(content, /POSTGRES_USER: sthyra_crm/);
 assert.match(content, /POSTGRES_PASSWORD: sthyra_crm/);
 assert.match(content, /POSTGRES_DB: sthyra_crm/);
 });

 it('redis service has healthcheck (CMD redis-cli ping)', () => {
 assert.match(content, /redis-cli/);
 assert.match(content, /ping/);
 assert.match(content, /- "6379:6379"/);
 });

 it('capture-service depends on postgres + redis with healthy condition', () => {
 assert.match(content, /depends_on:/);
 assert.match(content, /postgres:/);
 assert.match(content, /condition: service_healthy/);
 assert.match(content, /redis:/);
 });

 it('capture-service has DATABASE_URL pointing at the postgres container', () => {
 assert.match(content, /DATABASE_URL: postgres:\/\/sthyra_crm:sthyra_crm@postgres:5432\/sthyra_crm/);
 assert.match(content, /REDIS_URL: redis:\/\/redis:6379/);
 assert.match(content, /STHYRA_CRM_STORAGE: local/);
 });

 it('volume mounts the SQL migration file (auto-runs on first start)', () => {
 assert.match(content, /services\/capture-service\/migrations\/001-init\.sql/);
 assert.match(content, /docker-entrypoint-initdb\.d/);
 });

 it('declares both volumes (pg-data-int + storage-int)', () => {
 assert.match(content, /sthyra-crm-pg-data-int:/);
 assert.match(content, /sthyra-crm-storage-int:/);
 });

 it('capture-service exposes port 9090', () => {
 assert.match(content, /- "9090:9090"/);
 });

 it('capture-service has a Dockerfile reference', () => {
 assert.match(content, /dockerfile: services\/capture-service\/Dockerfile/);
 });
});

