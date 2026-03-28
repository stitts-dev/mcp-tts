---
description: Bump version in all plugin sources and deploy after changes
globs: ["skills/**/*.md", ".claude-plugin/**", "*.mjs", "package.json", "INSTRUCTIONS.md"]
---

# Plugin Versioning & Deployment

## Version bump

When editing plugin files, bump the version before committing:

- **Patch** (3.1.0 → 3.1.1): bug fixes, typo corrections
- **Minor** (3.1.0 → 3.2.0): new features, config options, flow changes
- **Major** (3.1.0 → 4.0.0): breaking changes to tool interface or skill behavior

Version must match in ALL 3 sources:
1. `package.json` → `"version"`
2. `skills/tts/SKILL.md` → frontmatter `version:`
3. `.claude-plugin/plugin.json` → `"version"`

A **pre-push hook** enforces this — push will be blocked if versions disagree.

## After pushing

1. Run `bash scripts/deploy.sh` to sync runtime files to `~/.claude/mcp-tts/`
2. Bump the `sha` in `stitts-dev/hub` → `.claude-plugin/marketplace.json` to publish the new version
3. Restart Claude Code to pick up MCP server changes

## Architecture

- **This repo** is the source of truth for all plugin metadata (`.claude-plugin/`, `.mcp.json`, `INSTRUCTIONS.md`, `skills/`)
- **Hub repo** (`stitts-dev/hub`) is a pure manifest — references this repo by git URL + SHA
- **Deploy dir** (`~/.claude/mcp-tts/`) is a runtime copy for the MCP server process
