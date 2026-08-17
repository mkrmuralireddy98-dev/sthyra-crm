/**
 * ColmapRunner — the actual COLMAP / GLOMAP invocation. Dependency-injected
 * so tests pass a fake. Production wires the real impl that spawns the
 * colmap binary (or its GLOMAP successor) as a subprocess.
 *
 * Per Phase 1.b:
 *   - Real impl uses `child_process.spawn('colmap', [...])` with the
 *     feature_extractor + exhaustive_matcher + mapper pipeline
 *   - Captures stdout/stderr for structured logs
 *   - CUDA OOM → retryable (transient)
 *   - "No features extracted" → non-retryable (corrupt input)
 *   - Exit code != 0 → generally retryable (transient infra issue)
 */

export type ColmapQuality = 'low' | 'medium' | 'high';

export interface ColmapRunInput {
 readonly framesDir: string;
 readonly outputDir: string;
 readonly quality: ColmapQuality;
}

export interface ColmapRunOutput {
 readonly sparseDir: string;
 readonly pointCount: number;
 readonly imageCount: number;
}

export interface ColmapRunner {
 run(input: ColmapRunInput): Promise<ColmapRunOutput>;
}

/**
 * RealColmapRunner — spawns the colmap binary. Production uses
 * GLOMAP (https://github.com/colmap/glomap) when available, falling
 * back to COLMAP. Both expose the same CLI shape for the operations
 * we use (feature_extractor + mapper).
 */
export class RealColmapRunner implements ColmapRunner {
 private readonly colmapPath: string;
 private readonly quality: ColmapQuality;

 constructor(opts: { colmapPath?: string; quality?: ColmapQuality } = {}) {
 this.colmapPath = opts.colmapPath ?? process.env.COLMAP_PATH ?? 'colmap';
 this.quality = opts.quality ?? 'medium';
 }

 async run(input: ColmapRunInput): Promise<ColmapRunOutput> {
 const { spawn } = await import('node:child_process');
 const { mkdir } = await import('node:fs/promises');
 const { join } = await import('node:path');

 const databasePath = join(input.outputDir, 'database.db');
 const sparseDir = join(input.outputDir, 'sparse');
 await mkdir(sparseDir, { recursive: true });

 const quality = input.quality;
 const sharedArgs = [
 '--database_path', databasePath,
 '--image_path', input.framesDir,
 '--output_path', sparseDir,
 ];

 return new Promise((resolve, reject) => {
 // For Phase 1.b we run the mapper step directly (the feature_extractor
 // step is folded into a pre-processing pass that the orchestrator does).
 const args = [
 'mapper',
 ...sharedArgs,
 ...(quality === 'low' ? ['--Mapper.ba_refine_focal_length', '0', '--Mapper.ba_refine_principal_point', '0'] : []),
 ...(quality === 'high' ? ['--Mapper.ba_refine_focal_length', '1', '--Mapper.ba_refine_principal_point', '1', '--Mapper.ba_refine_extra_params', '1'] : []),
 ];

 const proc = spawn(this.colmapPath, args);
 let stderr = '';
 proc.stderr.on('data', (chunk) => { stderr += chunk.toString(); });

 proc.on('error', (err) => {
 const e = new Error(`colmap failed to spawn: ${err.message}`) as Error & { retryable?: boolean };
 e.retryable = true;
 reject(e);
 });

 proc.on('exit', (code, signal) => {
 if (code === 0) {
 // Parse summary line: "Registered N images as M points."
 const m = stderr.match(/Registered (\d+) images as (\d+) points/);
 const imageCount = m ? Number(m[1]) : 0;
 const pointCount = m ? Number(m[2]) : 0;
 resolve({ sparseDir, pointCount, imageCount });
 } else if (/No features extracted/i.test(stderr)) {
 const e = new Error('No features extracted from images (corrupt input)') as Error & { retryable?: boolean };
 e.retryable = false;
 reject(e);
 } else if (/out of memory|CUDA error/i.test(stderr)) {
 const e = new Error(`colmap ran out of memory (signal=${signal ?? 'none'})`) as Error & { retryable?: boolean };
 e.retryable = true;
 reject(e);
 } else {
 const e = new Error(`colmap exited with code ${code} (signal=${signal ?? 'none'})`) as Error & { retryable?: boolean };
 e.retryable = true;
 reject(e);
 }
 });
 });
 }
}
