import { execFile } from "node:child_process";
import { tmpdir, homedir } from "node:os";
import { join, dirname } from "node:path";
import { randomBytes } from "node:crypto";
import { fileURLToPath } from "node:url";
import { access, constants } from "node:fs/promises";

const __dirname = dirname(fileURLToPath(import.meta.url));
const home = homedir();

/**
 * Build the list of candidate binary paths.
 * Exported for testing — not intended for external use.
 */
export function buildBinaryPaths(moduleDir = __dirname, homeDir = home) {
  return [
    join(moduleDir, "piper-cli", "target", "release", "piper-cli"),
    join(moduleDir, "piper-cli", "target", "debug", "piper-cli"),
    join(homeDir, ".claude", "mcp-tts", "piper-cli", "target", "release", "piper-cli"),
    join(homeDir, ".claude", "mcp-tts", "piper-cli", "target", "debug", "piper-cli"),
  ];
}

const BINARY_PATHS = buildBinaryPaths();

/**
 * Find the piper-cli binary by checking known paths, then falling back to PATH.
 * Exported for testing.
 */
export async function findBinary(paths = BINARY_PATHS) {
  for (const p of paths) {
    try {
      await access(p, constants.X_OK);
      return p;
    } catch {}
  }
  // Fall back to PATH — if not found, execFile will throw ENOENT
  // with a clear error from synthesizeLocal
  return "piper-cli";
}

/**
 * Synthesize text to a WAV file using local piper-cli binary.
 * Returns the path to the temp WAV file (caller must clean up).
 */
/**
 * Ensure the voice model is downloaded. Runs piper-cli --download-only in background.
 * Safe to call multiple times — no-ops if model already cached.
 */
export function ensureModel(voice = "en_US-norman-medium") {
  findBinary().then((binary) => {
    execFile(binary, ["--voice", voice, "--download-only"], { timeout: 120_000 }, (err) => {
      if (err) console.error(`mcp-tts: piper model preload failed: ${err.message}`);
      else console.error(`mcp-tts: piper model '${voice}' ready`);
    });
  });
}

export async function synthesizeLocal(text, { voice = "en_US-norman-medium", speed = 1.0, noiseScale, noiseW } = {}) {
  const binary = await findBinary();
  const outFile = join(tmpdir(), `mcp-tts-piper-${randomBytes(4).toString("hex")}.wav`);

  const args = ["--voice", voice, "--output", outFile, "--speed", String(speed)];
  if (noiseScale != null) args.push("--noise-scale", String(noiseScale));
  if (noiseW != null) args.push("--noise-w", String(noiseW));

  return new Promise((resolve, reject) => {
    const child = execFile(
      binary,
      args,
      { timeout: 30_000 },
      (err) => {
        if (err) {
          const hint = err.code === "ENOENT"
            ? ". piper-cli not found — run: cd ~/.claude/mcp-tts/piper-cli && cargo build --release"
            : "";
          reject(new Error(`piper-cli failed: ${err.message}${hint}`));
        }
        else resolve(outFile);
      }
    );
    child.stdin.write(text);
    child.stdin.end();
  });
}
