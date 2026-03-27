## Voice Output (TTS)

You have a `speak` tool via MCP that speaks text aloud using ElevenLabs. The server manages voice configuration — you do NOT need to check config before calling speak. Always call `speak` with a `category` parameter and the server decides whether to actually speak based on the current mode.

### How it works

1. Classify your response into a category
2. Call `speak` with `text` and `category`
3. The server checks mode/config and either speaks or returns `{ "skipped": true, "reason": "..." }`
4. If skipped, do nothing — the user configured it that way

### Category classification

| When you are... | Category |
|---|---|
| Completing a task the user requested | `completions` |
| Reporting a build or test failure | `errors` |
| Asking a blocking question | `questions` |
| Giving a progress/status update | `status` |
| Summarizing a long response | `summaries` |
| Presenting or updating a plan | `plans` |

### When to call speak

**Always call speak** after these events — the server gatekeeps based on config:
- Task completions (category: `completions`)
- Build/test failures (category: `errors`)
- Blocking questions (category: `questions`)
- Progress updates, milestone announcements (category: `status`)
- Any response to the user (category: `summaries` if long, or appropriate category if short)

### Plan mode

When presenting a plan (the "Here's my plan" / "Ready to code?" moment), speak a 1-2 sentence summary of the approach with category `plans`. Focus on the *what* and *why* — not file lists or implementation details.

If the plan involves a non-obvious trade-off or key architectural decision, speak that too with category `plans`.

When revising a plan after user feedback, speak what changed with category `plans`.

Examples:
```
speak("Plan ready. We'll yield debate text events instead of discarding them, so TTS can voice the coaches' thinking aloud.", category: "plans")
speak("Key trade-off: reusing the existing ContentDelta event instead of adding a new variant — simpler, no schema changes.", category: "plans")
speak("Updated the plan — switched from event yielding to a dedicated broadcast channel for better backpressure.", category: "plans")
```

### What text to send

- **Short responses** (<500 chars of prose): send the full text
- **Long responses** (>500 chars): generate a 1-2 sentence conversational summary and send that with category `summaries`
- **Never send**: code blocks, file paths, JSON, structured data — summarize what changed instead
- Keep spoken text natural and conversational

If the server rejects with "text exceeds threshold", shorten your text and resend with category `summaries`.

### Voice selection

The server auto-selects the voice based on category and config. You do NOT need to pass a `voice` parameter unless you have a specific reason to override. The voice-tone guidelines below still apply if you choose to override:

| Voice | Tone | Natural for... |
|-------|------|----------------|
| `edward` | British, deep, composed | Default — task completions, neutral updates |
| `daniel` | Steady broadcaster | Factual summaries, status reports |
| `donovan` | Articulate, strong | Confident recommendations, warnings |
| `archer` | Conversational | Casual updates, light-hearted moments |
| `juniper` | Grounded, professional | Professional summaries, business context |
| `cassidy` | Crisp, direct | Short alerts, direct answers |
| `austin` | Deep, raspy, authentic | Informal, honest assessments |
| `mark-natural` | Young, natural | Casual conversation, brainstorming |
| `mark-casual` | Relaxed, light | Low-stakes updates |
| `jessica` | Eloquent, dramatic | Dramatic reveals, impressive results |
| `spuds` | Wise, approachable | Advice, mentoring moments |
| `rob` | Tough, gritty | Bad news, hard truths |
| `adam` | Dark, tough | Serious warnings, critical failures |

### Modes

The user configures TTS mode via the `/tts` command. You don't need to know the current mode — just always call speak with a category and the server handles it.

- **Off**: Nothing speaks
- **Minimal**: Only completions, errors, blocking questions
- **Ambient**: Everything except mid-exploration output
- **Full**: Speak after every response (summaries for long output)

### Managing config

Use `get_voice_config` to read current settings and `set_voice_config` to update them. These are primarily used by the `/tts` skill, but you can read config if the user asks about current TTS settings.

### Examples

```
speak("All 47 tests passing. Ship it.", category: "completions")
speak("Build failed. Missing import in auth module.", category: "errors")
speak("Which authentication method should I use — OAuth or JWT?", category: "questions")
speak("Finished refactoring the auth module. Starting on the API layer.", category: "status")
speak("I've updated 12 files to migrate from the old auth system to JWT tokens.", category: "summaries")
```
