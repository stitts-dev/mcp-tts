import { execFile } from "node:child_process";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { randomBytes } from "node:crypto";
import { fileURLToPath } from "node:url";
import { access, constants } from "node:fs/promises";

const __dirname = dirname(fileURLToPath(import.meta.url));

const BINARY_PATHS = [
  join(__dirname, "piper-cli", "target", "release", "piper-cli"),
  join(__dirname, "piper-cli", "target", "debug", "piper-cli"),
];

async function findBinary() {
  for (const p of BINARY_PATHS) {
    try {
      await access(p, constants.X_OK);
      return p;
    } catch {}
  }
  // Fall back to PATH
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

export async function synthesizeLocal(text, { voice = "en_US-norman-medium", speed = 1.0 } = {}) {
  const binary = await findBinary();
  const outFile = join(tmpdir(), `mcp-tts-piper-${randomBytes(4).toString("hex")}.wav`);

  return new Promise((resolve, reject) => {
    const child = execFile(
      binary,
      ["--voice", voice, "--output", outFile, "--speed", String(speed)],
      { timeout: 30_000 },
      (err) => {
        if (err) reject(new Error(`piper-cli failed: ${err.message}`));
        else resolve(outFile);
      }
    );
    child.stdin.write(text);
    child.stdin.end();
  });
}
