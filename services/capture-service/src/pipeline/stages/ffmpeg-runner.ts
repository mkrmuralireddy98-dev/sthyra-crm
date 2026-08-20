/**
 * FfmpegRunner — the actual ffmpeg invocation. Dependency-injected so
 * tests can pass a fake. Production wires the real impl that spawns
 * the ffmpeg binary as a subprocess.
 *
 * Per Phase 1.b:
 *   - Real impl uses `child_process.spawn('ffmpeg', [...])`
 *   - Captures stdout/stderr for the orchestrator's structured logs
 *   - Marks SIGPIPE/ENOSPC as retryable, exit code 1 as retryable,
 *     exit code 234 (corrupt input) as non-retryable
 */

export interface FfmpegRunInput {
 readonly videoPath: string;
 readonly outputDir: string;
 readonly fps: number;
}

export interface FfmpegRunOutput {
 readonly framesDir: string;
 readonly frameCount: number;
 readonly durationSeconds: number;
}

export interface FfmpegRunner {
 run(input: FfmpegRunInput): Promise<FfmpegRunOutput>;
}

/**
 * RealFfmpegRunner — spawns the ffmpeg binary. Used in production via
 * the CLI's startPostgresServer or via the orchestrator's wiring.
 *
 * Output structure:
 *   {outputDir}/frames/frame-%05d.jpg
 *
 * The -vf fps=N selects N frames per second from the input.
 */
export class RealFfmpegRunner implements FfmpegRunner {
 private readonly ffmpegPath: string;

 constructor(opts: { ffmpegPath?: string } = {}) {
 this.ffmpegPath = opts.ffmpegPath ?? process.env.FFMPEG_PATH ?? 'ffmpeg';
 }

 async run(input: FfmpegRunInput): Promise<FfmpegRunOutput> {
 const { spawn } = await import('node:child_process');
 const { mkdir } = await import('node:fs/promises');
 const { join } = await import('node:path');

 await mkdir(join(input.outputDir, 'frames'), { recursive: true });

 return new Promise((resolve, reject) => {
 const args = [
 '-y', // overwrite output
 '-i', input.videoPath,
 '-vf', `fps=${input.fps}`,
 '-frame_pts', '1',
 join(input.outputDir, 'frames', 'frame-%05d.jpg'),
 ];
 const proc = spawn(this.ffmpegPath, args);
 let stderr = '';

 proc.stderr.on('data', (chunk) => {
 stderr += chunk.toString();
 });

 proc.on('error', (err) => {
 const e = new Error(`ffmpeg failed to spawn: ${err.message}`) as Error & { retryable?: boolean };
 // ENOENT or EACCES for ffmpeg binary → likely misconfig, retry
 e.retryable = true;
 reject(e);
 });

 proc.on('exit', (code, signal) => {
 if (code === 0) {
 // Best-effort: parse stderr for Duration info; fall back to input estimate.
 // ffmpeg prints "Duration: HH:MM:SS.xx"
 const m = stderr.match(/Duration: (\d+):(\d+):(\d+\.\d+)/);
 const dur = m ? Number(m[1]) * 3600 + Number(m[2]) * 60 + Number(m[3]) : 0;
 const fps = input.fps;
 const frames = Math.round(dur * fps);
 resolve({
 framesDir: join(input.outputDir, 'frames'),
 frameCount: frames,
 durationSeconds: dur,
 });
 } else {
 const e = new Error(`ffmpeg exited with code ${code} (signal=${signal ?? 'none'})`) as Error & { retryable?: boolean };
 // 234 = corrupt input (non-retryable); SIGPIPE/ENOSPC = transient (retry)
 e.retryable = code !== 234;
 reject(e);
 }
 });
 });
 }
}
