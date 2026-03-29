import { writeFile, unlink } from "node:fs/promises";
import { execFile } from "node:child_process";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { randomBytes } from "node:crypto";

/**
 * Play an array of base64 MP3 chunks sequentially using afplay (macOS).
 * Writes each chunk to a temp file, plays it, then cleans up.
 */
/**
 * Play an audio file via afplay, then delete it.
 */
/**
 * Post-process a WAV file with SoX: upsample to 44.1kHz, lowpass, normalize.
 * Returns the path to the polished file (or original if sox unavailable).
 */
async function polishWav(filePath) {
  const polished = filePath.replace(/\.wav$/, "-polished.wav");
  try {
    await new Promise((resolve, reject) => {
      execFile(
        "sox",
        [filePath, "-r", "44100", polished, "lowpass", "8000", "gain", "-n", "-1"],
        { timeout: 10_000 },
        (err) => {
          if (err) reject(err);
          else resolve();
        }
      );
    });
    await unlink(filePath).catch(() => {});
    return polished;
  } catch {
    return filePath;
  }
}

export async function playFile(filePath, { polish = false } = {}) {
  const target = polish ? await polishWav(filePath) : filePath;
  try {
    await new Promise((resolve, reject) => {
      execFile("afplay", ["-q", "1", target], (err) => {
        if (err) reject(err);
        else resolve();
      });
    });
  } finally {
    await unlink(target).catch(() => {});
  }
}

export async function playChunks(chunks) {
  // Concatenate all base64 chunks into a single MP3 buffer
  const combined = Buffer.concat(
    chunks.map((b64) => Buffer.from(b64, "base64"))
  );

  const tmpFile = join(
    tmpdir(),
    `mcp-tts-${randomBytes(4).toString("hex")}.mp3`
  );

  await writeFile(tmpFile, combined);

  try {
    await new Promise((resolve, reject) => {
      execFile("afplay", [tmpFile], (err) => {
        if (err) reject(err);
        else resolve();
      });
    });
  } finally {
    await unlink(tmpFile).catch(() => {});
  }
}
