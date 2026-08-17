import { describe, it } from 'node:test';
import * as assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

describe('Dockerfile — structural validation', () => {
 it('multi-stage Dockerfile has expected sections', () => {
 const dockerfile = readFileSync(join(__dirname, '..', 'Dockerfile'), 'utf8');
 assert.match(dockerfile, /FROM .* AS builder/);
 assert.match(dockerfile, /FROM .* AS/); // second stage
 assert.match(dockerfile, /pnpm build/);
 assert.match(dockerfile, /EXPOSE 9091/);
 assert.match(dockerfile, /dist[\/]cli\.js/);
 });
});
