# mcp-tts

MCP server that gives Claude Code a voice via ElevenLabs TTS.

## Setup

### 1. Install as MCP server

Add to your `~/.claude/.mcp.json`:

```json
{
  "mcpServers": {
    "tts": {
      "command": "npx",
      "args": ["-y", "github:stitts-dev/mcp-tts"],
      "env": {
        "ELEVENLABS_API_KEY": "your-api-key",
        "ELEVENLABS_REN_VOICE_ID": "your-voice-id"
      }
    }
  }
}
```

Or install via the Claude Code plugin marketplace if available.

### 2. Environment variables

| Variable | Required | Description |
|----------|----------|-------------|
| `ELEVENLABS_API_KEY` | Yes | ElevenLabs API key |
| `ELEVENLABS_REN_VOICE_ID` | Yes | Default voice ID |
| `ELEVENLABS_VOX_VOICE_ID` | No | Secondary voice ID (falls back to ren) |
| `ELEVENLABS_MODEL_ID` | No | Model ID (default: `eleven_turbo_v2_5`) |

### 3. Add to CLAUDE.md (optional)

```markdown
## Voice Output (TTS)

Use the `speak` tool ONLY in these situations:
- After completing a task the user requested (1 sentence summary)
- When a build or test run fails (state what failed)
- When asking a blocking question (speak the question)

NEVER speak: during exploration, after reading files, mid-implementation, or for status updates.
Max frequency: once per user request unless errors occur.
Keep text to 1-2 sentences. Don't speak code. Voice options: "ren" (default), "vox".
```

## Tool

### `speak`

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `text` | string | Yes | Text to speak (markdown stripped automatically) |
| `voice` | `"ren"` \| `"vox"` | No | Voice selection (default: ren) |

## Test

```bash
export ELEVENLABS_API_KEY=sk_...
export ELEVENLABS_REN_VOICE_ID=xZh...
node index.mjs --test
```

## Requirements

- macOS (uses `afplay` for audio playback)
- Node.js 18+
