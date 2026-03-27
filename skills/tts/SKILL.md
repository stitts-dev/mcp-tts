---
name: tts
description: Configure TTS voice mode — first-time setup, toggle modes, set per-category voices, adjust thresholds
version: 2.2.0
---

# TTS Voice Configuration

Interactive control panel for the TTS voice system.

## Flow

1. Call `get_voice_config` to read current settings
2. **If `needsSetup` is true**: run the Setup flow (below) first
3. Display the current config as a formatted status panel:

```
TTS Voice Config
─────────────────
Mode:      [ambient]     Enabled: [yes]
Threshold: [500 chars]

Categories:
  completions  ✓  voice: jessica
  errors       ✓  voice: rob
  questions    ✓  voice: edward
  status       ✓  voice: daniel
  summaries    ✓  voice: daniel
  plans        ✓  voice: edward

Default voice: edward
```

4. Present all config options in a single `AskUserQuestion` call. Include current values in each question text so the user knows what they're changing from:

```jsonc
{
  "questions": [
    {
      "question": "TTS Mode? (currently: ambient)",
      "header": "Mode",
      "multiSelect": false,
      "options": [
        { "label": "Off", "description": "Nothing speaks" },
        { "label": "Minimal", "description": "Completions, errors, blocking questions" },
        { "label": "Ambient", "description": "All categories enabled" },
        { "label": "Full", "description": "Everything — summaries for long output" }
      ]
    },
    {
      "question": "Which categories should be enabled? (Other for: summaries, plans)",
      "header": "Categories",
      "multiSelect": true,
      "options": [
        { "label": "completions", "description": "Task completions" },
        { "label": "errors", "description": "Build/test failures" },
        { "label": "questions", "description": "Blocking questions" },
        { "label": "status", "description": "Progress updates" }
      ]
    },
    {
      "question": "Default voice? (currently: edward) Other for: archer, donovan, juniper, mark-casual, mark-natural, cassidy, spuds, rob, adam",
      "header": "Voice",
      "multiSelect": false,
      "options": [
        { "label": "edward", "description": "British, deep, composed (default)" },
        { "label": "jessica", "description": "Eloquent, dramatic" },
        { "label": "daniel", "description": "Steady broadcaster" },
        { "label": "austin", "description": "Deep, raspy, authentic" }
      ]
    },
    {
      "question": "Summary threshold? (currently: 500 chars)",
      "header": "Threshold",
      "multiSelect": false,
      "options": [
        { "label": "300", "description": "Speak more often" },
        { "label": "500 (default)", "description": "Balanced" },
        { "label": "800", "description": "Only long responses" },
        { "label": "Disabled", "description": "Never auto-summarize" }
      ]
    }
  ]
}
```

5. Apply changes:
   - **Mode → category sync**: If mode changed but categories were NOT explicitly toggled, auto-apply the mode preset:
     - Off: all categories false, enabled: false
     - Minimal: completions + errors + questions only
     - Ambient: all categories true
     - Full: all categories true
   - If user explicitly selected categories in Q2, respect that override regardless of mode
   - **No change**: If all answers match current config, skip the write and say "No changes needed."
6. Write all changes in one `set_voice_config` call
7. Confirm with `speak("TTS settings updated.", category: "status")`

## Setup Flow (first-time only)

When `get_voice_config` returns `needsSetup: true`:

1. Tell the user: "TTS needs an ElevenLabs API key to work. Get one free at https://elevenlabs.io"
2. Use `AskUserQuestion` to ask them to paste their key:
   - Question: "Paste your ElevenLabs API key (starts with sk_)"
   - No predefined options — user types their key in the "Other" field
3. Call `setup_tts` with the key
4. If successful, call `speak("Voice setup complete. Welcome to TTS mode.", category: "completions")` to test it
5. Then continue to the normal config flow above

## Mode Reference

| Mode | What speaks |
|------|-------------|
| Off | Nothing |
| Minimal | Task completions, build failures, blocking questions |
| Ambient | All of minimal + status updates + long-output summaries |
| Full | Everything — every response gets spoken (summaries for long output) |

**Plans category**: Enabled in Ambient and Full modes. Speaks when presenting or revising a plan.

## Available Voices

edward, daniel, jessica, austin, archer, donovan, juniper, mark-casual, mark-natural, cassidy, spuds, rob, adam
