import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { writeFile, chmod, mkdir, rm } from "node:fs/promises";
import { randomBytes } from "node:crypto";
import { buildBinaryPaths, findBinary } from "./piper.mjs";

// ── buildBinaryPaths ────────────────────────────────────────────────────

describe("buildBinaryPaths", () => {
  test("returns 4 candidate paths", () => {
    const paths = buildBinaryPaths("/fake/module", "/fake/home");
    assert.equal(paths.length, 4);
  });

  test("first two paths are relative to moduleDir", () => {
    const paths = buildBinaryPaths("/opt/plugin", "/Users/test");
    assert.ok(paths[0].startsWith("/opt/plugin/piper-cli/target/release/"));
    assert.ok(paths[1].startsWith("/opt/plugin/piper-cli/target/debug/"));
  });

  test("last two paths are under homeDir/.claude/mcp-tts/", () => {
    const paths = buildBinaryPaths("/opt/plugin", "/Users/test");
    assert.ok(paths[2].startsWith("/Users/test/.claude/mcp-tts/piper-cli/target/release/"));
    assert.ok(paths[3].startsWith("/Users/test/.claude/mcp-tts/piper-cli/target/debug/"));
  });

  test("plugin cache dir differs from home dir paths", () => {
    const paths = buildBinaryPaths("/cache/plugin/v1", "/Users/me");
    // When running from plugin cache, moduleDir != homeDir paths
    assert.notEqual(paths[0], paths[2]);
    assert.notEqual(paths[1], paths[3]);
  });

  test("local dev: moduleDir == source repo produces matching first two paths", () => {
    const paths = buildBinaryPaths("/Users/me/.claude/mcp-tts", "/Users/me");
    // In local dev, first path and third path are identical
    assert.equal(paths[0], paths[2]);
  });
});

// ── findBinary ──────────────────────────────────────────────────────────

describe("findBinary", () => {
  const testDir = join(tmpdir(), `piper-test-${randomBytes(4).toString("hex")}`);
  const fakeBinary = join(testDir, "piper-cli");

  test("returns first executable path found", async () => {
    await mkdir(testDir, { recursive: true });
    await writeFile(fakeBinary, "#!/bin/sh\necho ok\n");
    await chmod(fakeBinary, 0o755);

    const result = await findBinary(["/nonexistent/path", fakeBinary]);
    assert.equal(result, fakeBinary);

    await rm(testDir, { recursive: true });
  });

  test("skips non-executable paths", async () => {
    await mkdir(testDir, { recursive: true });
    const noExec = join(testDir, "not-executable");
    await writeFile(noExec, "data");
    await chmod(noExec, 0o644);

    const result = await findBinary([noExec]);
    assert.equal(result, "piper-cli"); // fell through to PATH

    await rm(testDir, { recursive: true });
  });

  test("returns PATH fallback when no candidates exist", async () => {
    const result = await findBinary(["/no/such/file", "/also/missing"]);
    assert.equal(result, "piper-cli");
  });

  test("returns PATH fallback for empty candidates list", async () => {
    const result = await findBinary([]);
    assert.equal(result, "piper-cli");
  });

  test("prefers earlier path when multiple are executable", async () => {
    await mkdir(testDir, { recursive: true });
    const first = join(testDir, "first");
    const second = join(testDir, "second");
    await writeFile(first, "#!/bin/sh\n");
    await writeFile(second, "#!/bin/sh\n");
    await chmod(first, 0o755);
    await chmod(second, 0o755);

    const result = await findBinary([first, second]);
    assert.equal(result, first);

    await rm(testDir, { recursive: true });
  });
});
