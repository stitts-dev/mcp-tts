---
name: tts
description: Configure TTS voice — first-time setup, toggle categories, set provider/voices, adjust thresholds
version: 3.3.0
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
Provider:  [piper]       Enabled: [yes]
Threshold: [500 chars]
Piper voice: [en_US-norman-medium]  Speed: [1.0]

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
      "question": "TTS Provider? (currently: elevenlabs)",
      "header": "Provider",
      "multiSelect": false,
      "options": [
        { "label": "elevenlabs", "description": "Cloud TTS via ElevenLabs API (requires API key)" },
        { "label": "piper", "description": "Local TTS via piper-rs — free, offline, no API key needed" }
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
      "question": "Default voice? (currently: edward) — ElevenLabs voices only; Piper voice set separately. Other for: archer, donovan, juniper, mark-casual, mark-natural, cassidy, spuds, rob, adam",
      "header": "Voice",
      "multiSelect": false,
      "options": [
        { "label": "edward", "description": "British, deep, composed (default)" },
        { "label": "jessica", "description": "Eloquent, dramatic" },
        { "label": "daniel", "description": "Steady broadcaster" },
        { "label": "austin", "description": "Deep, raspy, authentic" }
      ]
    }
  ]
}
```

If the user selected **piper** as provider, additionally ask:

```jsonc
{
  "questions": [
    {
      "question": "Piper voice? (currently: en_US-norman-medium)",
      "header": "Piper Voice",
      "multiSelect": false,
      "options": [
        { "label": "en_US-norman-medium", "description": "Norman — direct, clear (61 MB)" },
        { "label": "en_US-l2arctic-medium", "description": "L2Arctic — calm, steady (73 MB)" },
        { "label": "en_US-kusal-medium", "description": "Kusal — alternative (60 MB)" }
      ]
    }
  ]
}
```

5. Apply changes:
   - **No change**: If all answers match current config, skip the write and say "No changes needed."
6. Write all changes in one `set_voice_config` call
7. Confirm with `speak("TTS settings updated.", category: "status")`

## Setup Flow (first-time only)

When `get_voice_config` returns `needsSetup: true`:

1. Ask the user which provider they want:
   - **piper**: No API key needed — skip to config flow
   - **elevenlabs**: Tell the user: "TTS needs an ElevenLabs API key. Get one free at https://elevenlabs.io"
2. For ElevenLabs: Use `AskUserQuestion` to ask them to paste their key:
   - Question: "Paste your ElevenLabs API key (starts with sk_)"
   - No predefined options — user types their key in the "Other" field
3. Call `setup_tts` with the key (ElevenLabs only)
4. If successful, call `speak("Voice setup complete. Welcome to TTS mode.", category: "completions")` to test it
5. Then continue to the normal config flow above

## Available Voices

edward, daniel, jessica, austin, archer, donovan, juniper, mark-casual, mark-natural, cassidy, spuds, rob, adam
