/**
 * Sthyra CRM Capture Service — domain types.
 * Mirrors the Postgres schema in plan.md §3. Readonly interfaces
 * because records are immutable after creation (mutations are full
 * record replacement).
 */

export const CAPTURE_KINDS = ['walkthrough_360', 'drone', 'laser_scan'] as const;
export type CaptureKind = (typeof CAPTURE_KINDS)[number];

export const CAPTURE_STATUSES = [
  'draft', 'uploading', 'processing', 'ready', 'failed', 'archived',
] as const;
export type CaptureStatus = (typeof CAPTURE_STATUSES)[number];

export const UPLOAD_SESSION_STATUSES = [
  'pending', 'uploading', 'complete', 'abandoned',
] as const;
export type UploadSessionStatus = (typeof UPLOAD_SESSION_STATUSES)[number];

export const PIPELINE_STAGES = ['decode', 'sfm', 'mesh', 'segment', 'align'] as const;
export type PipelineStage = (typeof PIPELINE_STAGES)[number];

export interface Capture {
 readonly id: string;
 readonly orgId: string;
 readonly projectId: string;
 readonly clientCaptureId: string;
 readonly kind: CaptureKind;
 readonly status: CaptureStatus;
 readonly deviceModel: string | null;
 readonly deviceOsVersion: string | null;
 readonly startedAt: Date;
 readonly finalizedAt: Date | null;
 readonly totalChunks: number | null;
 readonly sha256: string | null;
 readonly errorMessage: string | null;
 readonly createdAt: Date;
 readonly updatedAt: Date;
}

export interface UploadSession {
 readonly id: string;
 readonly captureId: string;
 readonly orgId: string;
 readonly projectId: string;
 readonly chunkSizeBytes: number;
 readonly totalChunks: number;
 readonly receivedChunks: readonly number[];
 readonly status: UploadSessionStatus;
 readonly expiresAt: Date;
 readonly createdAt: Date;
 readonly updatedAt: Date;
}

export interface CreateCaptureInput {
 readonly orgId: string;
 readonly projectId: string;
 readonly clientCaptureId: string;
 readonly kind: CaptureKind;
 readonly deviceModel?: string | null;
 readonly deviceOsVersion?: string | null;
}

export interface DomainEvent {
 readonly type: 'capture.initiated' | 'capture.uploaded' | 'capture.failed' | 'capture.archived';
 readonly captureId: string;
 readonly orgId: string;
 readonly projectId: string;
 readonly occurredAt: Date;
}
