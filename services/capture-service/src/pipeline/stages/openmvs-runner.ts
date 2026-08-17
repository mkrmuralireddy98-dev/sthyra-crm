/**
 * OpenMvsRunner — the actual OpenMVS / RealityCapture invocation.
 * Dependency-injected so tests pass a fake.
 */

export interface OpenMvsRunInput {
 readonly sparseDir: string;
 readonly outputDir: string;
}

export interface OpenMvsRunOutput {
 readonly meshPath: string;
 readonly vertexCount: number;
}

export interface OpenMvsRunner {
 run(input: OpenMvsRunInput): Promise<OpenMvsRunOutput>;
}

export class RealOpenMvsRunner implements OpenMvsRunner {
 private readonly openMvsPath: string;
 constructor(opts: { openMvsPath?: string } = {}) {
 this.openMvsPath = opts.openMvsPath ?? process.env.OPENMVS_PATH ?? 'openmvs';
 }

 async run(input: OpenMvsRunInput): Promise<OpenMvsRunOutput> {
 const { spawn } = await import('node:child_process');
 const { mkdir } = await import('node:fs/promises');
 const { join } = await import('node:path');
 await mkdir(input.outputDir, { recursive: true });
 const meshPath = join(input.outputDir, 'mesh.ply');

 return new Promise((resolve, reject) => {
 const proc = spawn(this.openMvsPath, [
 'DensiifyPointCloud', input.sparseDir, meshPath,
 '--resolution-level', '1',
 ]);
 let stderr = '';
 proc.stderr.on('data', (c) => { stderr += c.toString(); });
 proc.on('error', (err) => {
 const e = new Error(`openmvs failed to spawn: ${err.message}`) as Error & { retryable?: boolean };
 e.retryable = true;
 reject(e);
 });
 proc.on('exit', (code, signal) => {
 if (code === 0) {
 const m = stderr.match(/(\d+) vertices/);
 const vertexCount = m ? Number(m[1]) : 0;
 resolve({ meshPath, vertexCount });
 } else if (/out of memory/i.test(stderr)) {
 const e = new Error('openmvs out of memory') as Error & { retryable?: boolean };
 e.retryable = true;
 reject(e);
 } else {
 const e = new Error(`openmvs exited with code ${code}`) as Error & { retryable?: boolean };
 e.retryable = true;
 reject(e);
 }
 });
 });
 }
}
