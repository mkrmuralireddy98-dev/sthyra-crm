/**
 * IcpRunner — runs ICP (iterative closest point) alignment against a BIM model.
 */

export interface IcpAlignInput {
 readonly meshPath: string;
 readonly bimPath: string | null;
}

export interface IcpAlignOutput {
 readonly transformPath: string;
 readonly fitness: number;
 readonly inlier_rmse: number;
}

export interface IcpRunner {
 align(input: IcpAlignInput): Promise<IcpAlignOutput>;
}

export class RealIcpRunner implements IcpRunner {
 private readonly scriptPath: string;
 constructor(opts: { scriptPath?: string } = {}) {
 this.scriptPath = opts.scriptPath ?? process.env.ICP_SCRIPT ?? '/opt/sthyra-crm/pipelines/align.py';
 }

 async align(input: IcpAlignInput): Promise<IcpAlignOutput> {
 const { spawn } = await import('node:child_process');
 return new Promise((resolve, reject) => {
 const args = [
 this.scriptPath,
 '--mesh', input.meshPath,
 ...(input.bimPath ? ['--bim', input.bimPath] : []),
 ];
 const proc = spawn('python3', args);
 let stdout = '', stderr = '';
 proc.stdout.on('data', (c) => { stdout += c.toString(); });
 proc.stderr.on('data', (c) => { stderr += c.toString(); });

 proc.on('error', (err) => {
 const e = new Error(`align failed to spawn: ${err.message}`) as Error & { retryable?: boolean };
 e.retryable = true;
 reject(e);
 });

 proc.on('exit', (code, signal) => {
 if (code === 0) {
 try {
 const json = JSON.parse(stdout) as IcpAlignOutput;
 resolve(json);
 } catch {
 reject(new Error('align script produced invalid JSON'));
 }
 } else if (/failed to converge/i.test(stderr)) {
 const e = new Error('ICP failed to converge') as Error & { retryable?: boolean };
 e.retryable = true;
 reject(e);
 } else {
 const e = new Error('align exited with code ' + code) as Error & { retryable?: boolean };
 e.retryable = true;
 reject(e);
 }
 });
 });
 }
}
