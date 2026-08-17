/**
 * Sthyra CRM Mobile BFF — domain types.
 */

export const MOBILE_SESSION_STATUSES = ['recording', 'uploading', 'processing', 'ready', 'failed', 'archived'] as const;
export type MobileSessionStatus = (typeof MOBILE_SESSION_STATUSES)[number];

export const MOBILE_KINDS = ['walkthrough_360', 'preconstruction', 'postconstruction', 'incident'] as const;
export type MobileKind = (typeof MOBILE_KINDS)[number];

export interface Coordinates {
 readonly x: number;
 readonly y: number;
 readonly z: number;
}

export interface MobileSession {
readonly id: string;
readonly orgId: string;
readonly userId: string;
readonly projectId: string;
readonly captureId: string | null;
readonly kind: MobileKind;
readonly clientSessionId: string | null;
readonly status: MobileSessionStatus;
readonly totalSizeBytes: number;
readonly sha256Root: string | null;
readonly actualChunkCount: number | null;
readonly createdAt: Date;
readonly deletedAt: Date | null;
}

export interface MobileChunk {
readonly id: number;
readonly sessionId: string;
readonly chunkIndex: number;
readonly sha256: string;
readonly sizeBytes: number;
readonly receivedAt: Date;
}

export type PushChannel = 'apns' | 'fcm';

export interface MobileDeviceToken {
  readonly id: string;
  readonly orgId: string;
  readonly userId: string;
  readonly deviceId: string;
  readonly apnsToken: string;
  readonly pushChannel: PushChannel;
  readonly fcmAppId: string | null;
  readonly registeredAt: Date;
}

export interface CreateSessionInput {
readonly orgId: string;
readonly userId: string;
readonly projectId: string;
readonly kind: MobileKind;
readonly clientSessionId?: string | null;
}

export interface ChunkUploadInput {
readonly sessionId: string;
readonly chunkIndex: number;
readonly sha256: string;
readonly sizeBytes: number;
}

export interface FinalizeSessionInput {
readonly sessionId: string;
readonly actualChunkCount: number;
readonly totalSizeBytes: number;
readonly sha256Root: string;
}

export interface CreateIssueFromCameraInput {
readonly orgId: string;
readonly userId: string;
readonly captureId: string;
readonly title: string;
readonly description: string;
readonly severity: 'low' | 'medium' | 'high' | 'critical';
readonly coordinates: Coordinates;
}

export interface RegisterDeviceTokenInput {
  readonly orgId: string;
  readonly userId: string;
  readonly deviceId: string;
  readonly apnsToken: string;
  readonly pushChannel?: PushChannel;
  readonly fcmAppId?: string | null;
}

export interface MobileJwtClaims {
readonly orgId: string;
readonly userId: string;
readonly deviceId: string;
}
