/**
 * BlobStorage — tenant-scoped blob storage contract.
 *
 * The capture service writes raw 360° video chunks (8 MB each per FR-2)
 * to a blob store and reads them back to assemble the final capture.
 * Two implementations satisfy this contract:
 *
 *   - LocalFsStorage (T-012): dev/test, writes to .dev-storage/
 *   - S3Storage (T-013): production, writes to AWS S3
 *
 * Tenant boundary: every key MUST include the orgId. The contract does
 * NOT enforce this — it's a convention the implementations follow. This
 * is a deliberate choice: the storage layer is content-addressed; the
 * tenant check happens at the repository layer that constructs the key.
 *
 * Per spec-kit plan.md §Storage:
 *   s3://sthyra-crm-raw-360-{region}/
 *     org/{orgId}/project/{projectId}/capture/{captureId}/
 *       raw/chunk-NNNN.bin
 *
 * For local development, the same path is mirrored under .dev-storage/.
 */

export interface PutOptions {
 /** MIME type; e.g., 'video/mp4' or 'application/octet-stream'. */
 readonly contentType?: string;
 /** Pre-computed sha256 of the bytes. Stored alongside for verification. */
 readonly sha256?: string;
 /** Arbitrary key/value metadata. */
 readonly metadata?: Readonly<Record<string, string>>;
}

export interface ObjectInfo {
 readonly size: number;
 readonly contentType: string | null;
 readonly sha256: string | null;
}

export interface SignedUrlOptions {
 readonly method: 'GET' | 'PUT';
 /** TTL for the URL, in seconds. Per Constitution NFR-5, default 900 (15 min). */
 readonly expiresInSeconds: number;
}

export interface BlobStorage {
 /**
 * Store `data` at `key`. Idempotent on key+contentHash: if an object at
 * `key` already exists with the same sha256, returns without re-uploading.
 */
 put(key: string, data: Buffer | Uint8Array, opts?: PutOptions): Promise<void>;

 /**
 * Fetch the bytes at `key`. Throws if the key does not exist.
 */
 get(key: string): Promise<Buffer>;

 /**
 * Get metadata without downloading the body. Returns ObjectInfo even if
 * the object is missing — call `exists()` separately if you need that.
 */
 head(key: string): Promise<ObjectInfo>;

 /**
 * Generate a pre-signed URL for direct client upload/download. Used by
 * the mobile client (T-006, T-008) to PUT chunks directly to S3 without
 * going through the API gateway.
 */
 signedUrl(key: string, opts: SignedUrlOptions): Promise<string>;

 /**
 * Delete an object. Idempotent — no-op if the key does not exist.
 */
 delete(key: string): Promise<void>;

 /**
 * Check whether an object exists at `key`. Returns true/false; does not throw.
 */
 exists(key: string): Promise<boolean>;

 /**
 * Concatenate `parts` (an ordered list of chunk keys) into a single
 * object at `key`. Used by `POST /v1/upload-sessions/:id/complete` to
 * assemble the final capture file from uploaded chunks.
 *
 * For S3 this issues a `CreateMultipartUpload` + `UploadPart` per chunk +
 * `CompleteMultipartUpload`. For local-fs this is a simple file concat.
 */
 concatenate(key: string, parts: readonly string[]): Promise<void>;
}

/**
 * Helper for callers that want to construct tenant-scoped keys.
 * Centralizing this here means the same path layout applies to both
 * implementations — Constitution §II tenant isolation is enforced by
 * convention at this boundary.
 */
export interface CaptureStorageKey {
 readonly region: string;
 readonly orgId: string;
 readonly projectId: string;
 readonly captureId: string;
}

export function captureChunkKey(k: CaptureStorageKey, chunkIndex: number): string {
 return `org/${k.orgId}/project/${k.projectId}/capture/${k.captureId}/raw/chunk-${String(chunkIndex).padStart(4, '0')}.bin`;
}

export function captureManifestKey(k: CaptureStorageKey): string {
 return `org/${k.orgId}/project/${k.projectId}/capture/${k.captureId}/manifest.json`;
}
