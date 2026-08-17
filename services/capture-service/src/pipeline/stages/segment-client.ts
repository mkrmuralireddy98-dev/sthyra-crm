/**
 * SegmentInferenceClient — calls the segmentation ML inference endpoint.
 * Dependency-injected so tests pass a fake.
 *
 * Production wires HttpSegmentInferenceClient which POSTs the mesh to
 * the inference service (e.g. a SageMaker endpoint or a Kubernetes
 * inference service) and returns the labels + segmentation JSON.
 */

export interface SegmentRequest {
 readonly meshPath: string;
 readonly captureId: string;
}

export interface SegmentResponse {
 readonly segmentationPath: string;
 readonly labels: string[];
}

export interface SegmentInferenceClient {
 segment(input: SegmentRequest): Promise<SegmentResponse>;
}

/**
 * HttpSegmentInferenceClient — POSTs to a configured ML inference endpoint.
 * Uses fetch() (Node 18+).
 */
export class HttpSegmentInferenceClient implements SegmentInferenceClient {
 private readonly endpoint: string;
 private readonly timeoutMs: number;

 constructor(opts: { endpoint?: string; timeoutMs?: number } = {}) {
 this.endpoint = opts.endpoint ?? process.env.SEGMENT_INFERENCE_URL ?? 'http://localhost:9095/segment';
 this.timeoutMs = opts.timeoutMs ?? 120_000;
 }

 async segment(input: SegmentRequest): Promise<SegmentResponse> {
 const controller = new AbortController();
 const timer = setTimeout(() => controller.abort(), this.timeoutMs);
 try {
 const res = await fetch(this.endpoint, {
 method: 'POST',
 headers: { 'content-type': 'application/json' },
 body: JSON.stringify(input),
 signal: controller.signal,
 });
 if (!res.ok) {
 const body = await res.text();
 const e = new Error(`${res.status} ${res.statusText}: ${body}`) as Error & { retryable?: boolean };
 // 4xx is non-retryable (client error). 5xx and timeout are retryable.
 e.retryable = res.status >= 500;
 throw e;
 }
 const json = await res.json() as SegmentResponse;
 return json;
 } catch (err) {
 if ((err as { name?: string }).name === 'AbortError') {
 const e = new Error('Request timeout') as Error & { retryable?: boolean };
 e.retryable = true;
 throw e;
 }
 throw err;
 } finally {
 clearTimeout(timer);
 }
 }
}
