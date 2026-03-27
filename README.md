# mcp-tts

MCP server that gives Claude Code a voice via ElevenLabs TTS. Includes 13 voices, configurable voice modes, per-category voice selection, and smart summarization.

## Setup

### 1. Install

Via plugin marketplace:
```
/plugin install mcp-tts@stitts-plugins
```

Or via npx (no clone needed):

```json
{
  "tts": {
    "command": "npx",
    "args": ["-y", "github:stitts-dev/mcp-tts"],
    "env": {
      "ELEVENLABS_API_KEY": "your-api-key"
    }
  }
}
```

Or git clone:

```bash
cd ~/.claude
git clone https://github.com/stitts-dev/mcp-tts.git mcp-tts
cd mcp-tts && npm install
```

### 2. Environment variables

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `ELEVENLABS_API_KEY` | Yes | — | Your ElevenLabs API key |
| `ELEVENLABS_VOICE_ID` | No | edward | Override default voice by ID |
| `ELEVENLABS_MODEL_ID` | No | `eleven_multilingual_v2` | ElevenLabs model |

### 3. Register MCP server

Add to `~/.claude.json` (or `~/.claude/.mcp.json`) inside `"mcpServers"`:

```json
"tts": {
  "type": "stdio",
  "command": "node",
  "args": ["~/.claude/mcp-tts/index.mjs"],
  "env": {
    "ELEVENLABS_API_KEY": "your-api-key"
  }
}
```

### 4. Add instructions to CLAUDE.md

Copy `INSTRUCTIONS.md` contents into your `~/.claude/CLAUDE.md`. This tells Claude when and how to use each voice.

## Tools

### `speak`

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `text` | string | Yes | Text to speak (markdown stripped automatically) |
| `voice` | string | No | Voice override (server auto-selects from config) |
| `category` | string | No | Response category: `completions`, `errors`, `questions`, `status`, `summaries` |

The server decides whether to speak based on voice config mode and category settings. Rate-limited to one speak every 3 seconds.

### `get_voice_config`

Returns current voice configuration as JSON. No parameters.

### `set_voice_config`

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `config` | object | Yes | Full voice config object (replaces entire config) |

Config is stored at `~/.claude/voice-config.json` (persists across reinstalls).

## Voice Modes

Configure via `/tts` skill or `set_voice_config`:

| Mode | What speaks |
|------|-------------|
| `off` | Nothing |
| `minimal` | Task completions, build failures, blocking questions (default) |
| `ambient` | All of minimal + status updates + long-output summaries |
| `full` | Everything — every response gets spoken (summaries for long output) |

## Available voices

| Voice | Tone | Best for |
|-------|------|----------|
| `edward` | British, deep, composed | Default — task completions, neutral updates |
| `daniel` | Steady broadcaster | Factual summaries, status reports |
| `donovan` | Articulate, strong | Confident recommendations, warnings |
| `archer` | Conversational | Casual updates |
| `juniper` | Grounded, professional | Professional summaries |
| `cassidy` | Crisp, direct | Short alerts |
| `austin` | Deep, raspy, authentic | Informal assessments |
| `mark-natural` | Young, natural | Casual conversation |
| `mark-casual` | Relaxed, light | Low-stakes updates |
| `jessica` | Eloquent, dramatic | Impressive results |
| `spuds` | Wise, approachable | Advice, mentoring |
| `rob` | Tough, gritty | Bad news, hard truths |
| `adam` | Dark, tough | Critical failures |

## Test

```bash
export ELEVENLABS_API_KEY=sk_...
cd ~/.claude/mcp-tts && node index.mjs --test
```

## Requirements

- macOS (uses `afplay` for audio playback)
- Node.js 18+
- ElevenLabs API key ([elevenlabs.io](https://elevenlabs.io))
