import { spawn, spawnSync } from 'node:child_process'

/**
 * Finds ffmpeg/ffprobe: an explicit FFMPEG_PATH/FFPROBE_PATH first, then PATH.
 * Returns null when missing, so the runner can explain how to install it.
 */
export function findTool(name) {
  const override = process.env[`${name.toUpperCase()}_PATH`]
  if (override) return override
  const probe = spawnSync(name, ['-version'], { stdio: 'ignore', shell: false })
  return probe.status === 0 ? name : null
}

/** Runs a command; resolves with stdout as a Buffer, rejects with stderr. */
export function run(command, args, { input } = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { stdio: ['pipe', 'pipe', 'pipe'] })
    const out = []
    const err = []
    child.stdout.on('data', (chunk) => out.push(chunk))
    child.stderr.on('data', (chunk) => err.push(chunk))
    child.on('error', reject)
    child.on('close', (code) => {
      if (code === 0) resolve(Buffer.concat(out))
      else
        reject(
          new Error(
            `${command} exited with ${code}\n${Buffer.concat(err).toString().trim().split('\n').slice(-12).join('\n')}`,
          ),
        )
    })
    if (input) child.stdin.end(input)
    else child.stdin.end()
  })
}

/** Length of a media file in seconds. */
export async function duration(ffprobe, file) {
  const out = await run(ffprobe, [
    '-v',
    'error',
    '-show_entries',
    'format=duration',
    '-of',
    'csv=p=0',
    file,
  ])
  return Number(out.toString().trim())
}

/** Decodes any audio file to raw float samples. */
export async function decode(ffmpeg, file, { rate = 48_000, channels = 2, start = 0, seconds } = {}) {
  const args = ['-v', 'error']
  if (start) args.push('-ss', String(start))
  args.push('-i', file)
  if (seconds) args.push('-t', String(seconds))
  args.push('-vn', '-ac', String(channels), '-ar', String(rate), '-f', 'f32le', '-')
  const out = await run(ffmpeg, args)
  // Copied out: a pooled Buffer can start at an offset a Float32Array cannot.
  return new Float32Array(out.buffer.slice(out.byteOffset, out.byteOffset + out.byteLength))
}
