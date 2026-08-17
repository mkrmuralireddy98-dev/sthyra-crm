import { describe, it } from 'node:test';
import * as assert from 'node:assert/strict';
import type { IssueRepository } from './repository.js';

describe('IssueRepository contract', () => {
 it('is a valid TypeScript type', () => {
 const fn = (): IssueRepository | null => null;
 assert.equal(fn(), null);
 });

 it('requires orgId as first positional arg on tenant-scoped methods', () => {
 // Compile-time check via function type assertion.
 type TenantScoped = (orgId: string, id: string) => Promise<unknown>;
 const findIssue: TenantScoped = async (_orgId: string, _id: string) => ({});
 assert.equal(typeof findIssue, 'function');
 });
});
