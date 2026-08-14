import { describe, it } from 'node:test';
import * as assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const aslPath = join(__dirname, 'pipeline.asl.json');

describe('Step Functions ASL — pipeline.asl.json', () => {
 it('the file exists and is valid JSON', () => {
 const raw = readFileSync(aslPath, 'utf8');
 const asl = JSON.parse(raw) as unknown;
 assert.ok(asl);
 });

 it('declares the 5 stages in canonical order', () => {
 const asl = JSON.parse(readFileSync(aslPath, 'utf8')) as {
 States: Record<string, { Next?: string; End?: boolean }>;
 };
 // Start → decode → sfm → mesh → segment → align → end
 const order = ['decode', 'sfm', 'mesh', 'segment', 'align'];
 for (let i = 0; i < order.length; i++) {
 const state = asl.States[order[i] ?? ''];
 assert.ok(state, `state ${order[i]} must exist`);
 if (i < order.length - 1) {
 assert.equal(state.Next, order[i + 1], `${order[i]} must transition to ${order[i + 1]}`);
 }
 }
 const last = asl.States[order[order.length - 1] ?? ''];
 assert.equal(last.End, true, 'align must be terminal');
 });

 it('every stage has a retry policy (3 attempts, exponential backoff)', () => {
 const asl = JSON.parse(readFileSync(aslPath, 'utf8')) as {
 States: Record<string, { Retry?: Array<{ ErrorEquals: string[]; MaxAttempts: number; IntervalSeconds: number; BackoffRate: number }> }>;
 };
 for (const stageName of ['decode', 'sfm', 'mesh', 'segment', 'align']) {
 const stage = asl.States[stageName];
 assert.ok(Array.isArray(stage.Retry), `${stageName} must have a Retry clause`);
 const retry = stage.Retry?.[0];
 assert.ok(retry, `${stageName} must have at least one retry`);
 assert.ok(retry.MaxAttempts >= 1, `${stageName} retry MaxAttempts must be >= 1`);
 assert.ok(retry.BackoffRate > 1, `${stageName} retry BackoffRate must be > 1 for exponential growth`);
 }
 });

 it('has a Catch clause that routes unrecoverable failures to a DLQ', () => {
 const asl = JSON.parse(readFileSync(aslPath, 'utf8')) as {
 States: Record<string, { Catch?: Array<{ ErrorEquals: string[]; Next: string; ResultPath?: string }> }>;
 };
 for (const stageName of ['decode', 'sfm', 'mesh', 'segment', 'align']) {
 const stage = asl.States[stageName];
 assert.ok(Array.isArray(stage.Catch), `${stageName} must have a Catch clause`);
 const catchAll = stage.Catch?.find((c) => c.ErrorEquals.includes('States.ALL'));
 assert.ok(catchAll, `${stageName} must catch States.ALL`);
 assert.equal(catchAll?.Next, 'DlqState');
 }
 });

 it('Comment field documents the contract (Constitution §V — interface-stable)', () => {
 const asl = JSON.parse(readFileSync(aslPath, 'utf8')) as { Comment?: string };
 assert.ok(asl.Comment);
 assert.match(asl.Comment, /decode/);
 assert.match(asl.Comment, /align/);
 });

 it('StartAt is decode (per state-machine.ts)', () => {
 const asl = JSON.parse(readFileSync(aslPath, 'utf8')) as { StartAt: string };
 assert.equal(asl.StartAt, 'decode');
 });

 it('TimeoutSeconds is set on each stage (production SLAs)', () => {
 const asl = JSON.parse(readFileSync(aslPath, 'utf8')) as {
 States: Record<string, { TimeoutSeconds?: number }>;
 };
 for (const stageName of ['decode', 'sfm', 'mesh', 'segment', 'align']) {
 const stage = asl.States[stageName];
 assert.ok(stage.TimeoutSeconds && stage.TimeoutSeconds > 0);
 }
 });
});
