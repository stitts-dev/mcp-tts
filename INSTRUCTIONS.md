## Voice Output (TTS)

You have a `speak` tool via MCP that speaks text aloud using ElevenLabs.

### When to speak

Use `speak` ONLY in these situations:
- After completing a task the user requested (1 sentence summary)
- When a build or test run fails (state what failed)
- When asking a blocking question (speak the question)

NEVER speak: during exploration, after reading files, mid-implementation, or for status updates.
Max frequency: once per user request unless errors occur.
Keep text to 1-2 sentences. Don't speak code — summarize what changed.

### Voice selection

Choose a voice that matches the tone of your message. Default is `edward` (British, deep, composed).

| Voice | Tone | Use when... |
|-------|------|-------------|
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

Example: `speak("All 47 tests passing. Ship it.", voice: "archer")`
Example: `speak("Build failed. Missing import in auth module.", voice: "rob")`
Example: `speak("Refactor complete. Reduced bundle size by 40 percent.", voice: "jessica")`
