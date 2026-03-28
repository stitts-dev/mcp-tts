#!/usr/bin/env bash
# Deploy mcp-tts runtime files to ~/.claude/mcp-tts/
# Run after making changes to sync the running MCP server.

set -euo pipefail

REPO_DIR="$(cd "$(dirname "$0")/.." && pwd)"
DEPLOY_DIR="$HOME/.claude/mcp-tts"

GREEN='\033[0;32m'
NC='\033[0m'

# Runtime files
for file in index.mjs audio.mjs elevenlabs.mjs piper.mjs package.json INSTRUCTIONS.md; do
  cp "$REPO_DIR/$file" "$DEPLOY_DIR/$file"
done

# Skill
mkdir -p "$DEPLOY_DIR/skills/tts"
cp "$REPO_DIR/skills/tts/SKILL.md" "$DEPLOY_DIR/skills/tts/SKILL.md"

# Piper binary
if [[ -f "$REPO_DIR/piper-cli/target/release/piper-cli" ]]; then
  mkdir -p "$DEPLOY_DIR/piper-cli/target/release"
  cp "$REPO_DIR/piper-cli/target/release/piper-cli" "$DEPLOY_DIR/piper-cli/target/release/piper-cli"
fi

echo -e "${GREEN}✓ Deployed to $DEPLOY_DIR${NC}"
echo "  Restart Claude Code to pick up changes."
