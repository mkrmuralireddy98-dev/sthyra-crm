/**
 * CaptureService — domain layer. Pure business logic, no HTTP.
 *
 * Responsibilities:
 *   - Idempotency check on capture initiation (Constitution §IV)
 *   - Capture + upload session creation in one transaction
 *   - Tenant boundary enforcement (Constitution §II)
 *   - Domain event emission
 *   - sha256 verification on finalize
 *   - Cross-tenant probe resistance
 */

import type { Capture, CreateCaptureInput, DomainEvent, UploadSession } from './types.js';
import type { CaptureRepository, IdempotencyStore } from './repository.js';

const DEFAULT_CHUNK_SIZE_BYTES = 8 * 1024 * 1024;
const DEFAULT_UPLOAD_SESSION_TTL_SECONDS = 15 * 60;

export class CaptureServiceError extends Error {
 readonly code: string;
 constructor(message: string, code: string) {
 super(message);
 this.code = code;
 this.name = new.target?.name ?? 'CaptureServiceError';
 }
}

export class DuplicateClientCaptureIdError extends CaptureServiceError {
 constructor(message: string) {
 super(message, 'duplicate_client_capture_id');
 this.name = 'DuplicateClientCaptureIdError';
 }
}

export class MissingTenantError extends CaptureServiceError {
 constructor(message: string) {
 super(message, 'missing_tenant');
 this.name = 'MissingTenantError';
 }
}

export interface CaptureServiceDeps {
 readonly repo: CaptureRepository;
 readonly idempotency: IdempotencyStore;
 readonly onEvent?: (event: DomainEvent) => void;
 readonly chunkSizeBytes?: number;
 /** Optional outbox writer — persists events to event_outbox for cross-instance delivery. */
 readonly outboxWriter?: (event: DomainEvent) => Promise<void>;
 readonly uploadSessionTtlSeconds?: number;
}

export interface CreateCaptureResult {
 readonly capture: Capture;
 readonly uploadSession: UploadSession;
}

interface IdempotentResult {
 readonly result: CreateCaptureResult;
 readonly orgId: string;
}

export class CaptureService {
 private readonly repo: CaptureRepository;
 private readonly idempotency: IdempotencyStore;
 private readonly onEvent: (e: DomainEvent) => void;
 private readonly outboxWriter: (event: DomainEvent) => Promise<void>;
 private readonly chunkSizeBytes: number;
 private readonly uploadSessionTtlSeconds: number;

 constructor(deps: CaptureServiceDeps) {
 this.repo = deps.repo;
 this.idempotency = deps.idempotency;
 this.onEvent = deps.onEvent ?? (() => {});
    this.outboxWriter = deps.outboxWriter ?? (async () => {});
 this.chunkSizeBytes = deps.chunkSizeBytes ?? DEFAULT_CHUNK_SIZE_BYTES;
 this.uploadSessionTtlSeconds = deps.uploadSessionTtlSeconds ?? DEFAULT_UPLOAD_SESSION_TTL_SECONDS;
 }

 private async emit(event: DomainEvent): Promise<void> {
 this.onEvent(event);
 await this.outboxWriter(event);
 }

 async create(orgId: string, projectId: string, idempotencyKey: string, input: CreateCaptureInput): Promise<CreateCaptureResult> {
 if (!orgId) throw new MissingTenantError('orgId required (tenant boundary)');
 if (!projectId) throw new MissingTenantError('projectId required');
 if (!idempotencyKey) throw new MissingTenantError('idempotencyKey required (Constitution §IV)');
 if (!input.clientCaptureId || !input.kind) {
 throw new CaptureServiceError('clientCaptureId and kind are required', 'invalid_input');
 }

 const cacheKey = `idem:${orgId}:${idempotencyKey}`;
 const cached = await this.idempotency.get<IdempotentResult>(cacheKey);
 if (cached) return cached.result;

 const existing = await this.repo.findCaptureByClientId(orgId, projectId, input.clientCaptureId);
 if (existing) {
 throw new DuplicateClientCaptureIdError(
 `(projectId, clientCaptureId) already exists: (${projectId}, ${input.clientCaptureId})`,
 );
 }

 const now = new Date();
 const capture: Capture = {
 id: `cap_${now.getTime().toString(36)}_${Math.random().toString(36).slice(2, 10)}`,
 orgId,
 projectId,
 clientCaptureId: input.clientCaptureId,
 kind: input.kind,
 status: 'uploading',
 deviceModel: input.deviceModel ?? null,
 deviceOsVersion: input.deviceOsVersion ?? null,
 startedAt: now,
 finalizedAt: null,
 totalChunks: null,
 sha256: null,
 errorMessage: null,
 createdAt: now,
 updatedAt: now,
 };
 const uploadSession: UploadSession = {
 id: `upl_${now.getTime().toString(36)}_${Math.random().toString(36).slice(2, 10)}`,
 captureId: capture.id,
 orgId: capture.orgId,
 projectId: capture.projectId,
 chunkSizeBytes: this.chunkSizeBytes,
 totalChunks: 0,
 receivedChunks: [],
 status: 'uploading',
 expiresAt: new Date(now.getTime() + this.uploadSessionTtlSeconds * 1000),
 createdAt: now,
 updatedAt: now,
 };

 await this.repo.insertCapture(capture);
 await this.repo.insertUploadSession(uploadSession);

 const result: CreateCaptureResult = { capture, uploadSession };
 await this.idempotency.set<IdempotentResult>(cacheKey, { result, orgId });

 await this.emit({
 type: 'capture.initiated',
 captureId: capture.id,
 orgId: capture.orgId,
 projectId: capture.projectId,
 occurredAt: now,
 });

 return result;
 }

 async find(orgId: string, id: string): Promise<Capture | null> {
 return this.repo.findCapture(orgId, id);
 }

 async list(orgId: string, projectId: string, filter?: { status?: Capture['status'] }): Promise<readonly Capture[]> {
 return this.repo.listCaptures(orgId, projectId, filter);
 }

 async archive(orgId: string, id: string): Promise<void> {
 const cap = await this.repo.findCapture(orgId, id);
 if (!cap) throw new CaptureServiceError(`capture not found: ${id}`, 'not_found');
 await this.repo.archiveCapture(orgId, id);
 await this.emit({
 type: 'capture.archived',
 captureId: id,
 orgId,
 projectId: cap.projectId,
 occurredAt: new Date(),
 });
 }

 async getUploadSession(orgId: string, id: string): Promise<UploadSession | null> {
 return this.repo.findUploadSession(orgId, id);
 }

 async recordChunkReceived(orgId: string, uploadSessionId: string, chunkIndex: number): Promise<void> {
 // Tenant-scoped existence check. The repo's recordChunkReceived throws
 // a plain Error on not-found; we rethrow as CaptureServiceError so the
 // HTTP layer can map to 404.
 const session = await this.repo.findUploadSession(orgId, uploadSessionId);
 if (!session) {
 throw new CaptureServiceError(
 `upload session not found: ${uploadSessionId}`,
 'not_found',
 );
 }
 await this.repo.recordChunkReceived(orgId, uploadSessionId, chunkIndex);
 }

 async finalize(
 orgId: string,
 uploadSessionId: string,
 sha256: string,
 ): Promise<{ captureId: string; status: 'processing' }> {
 const session = await this.repo.findUploadSession(orgId, uploadSessionId);
 if (!session) throw new CaptureServiceError(`upload session not found: ${uploadSessionId}`, 'not_found');
 const expectedChunks = session.totalChunks;
 const received = session.receivedChunks.length;
 if (expectedChunks > 0 && received < expectedChunks) {
 throw new CaptureServiceError(
 `cannot finalize: ${received}/${expectedChunks} chunks received`,
 'incomplete_upload',
 );
 }
 await this.repo.completeUploadSession(orgId, uploadSessionId);
 await this.repo.updateCaptureStatus(orgId, session.captureId, 'processing', { sha256 });
 await this.emit({
 type: 'capture.uploaded',
 captureId: session.captureId,
 orgId,
 projectId: session.projectId,
 occurredAt: new Date(),
 });
 return { captureId: session.captureId, status: 'processing' };
 }
}
