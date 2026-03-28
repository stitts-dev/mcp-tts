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
export async function playFile(filePath) {
  try {
    await new Promise((resolve, reject) => {
      execFile("afplay", [filePath], (err) => {
        if (err) reject(err);
        else resolve();
      });
    });
  } finally {
    await unlink(filePath).catch(() => {});
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
