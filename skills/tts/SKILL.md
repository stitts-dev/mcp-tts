---
name: tts
description: Configure TTS voice mode — first-time setup, toggle modes, set per-category voices, adjust thresholds
version: 2.0.0
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

Default voice: edward
```

4. Ask the user what they want to change using `AskUserQuestion`:

**Question 1: What to configure**
- Options: "Mode" / "Categories" / "Voices" / "Threshold" / "Looks good"
- If "Looks good" — done, no changes needed

5. Based on selection, drill into that section:

**If Mode:**
- Options: "Off" / "Minimal" / "Ambient" / "Full"
- When changing mode, auto-update categories to match the preset:
  - Off: all categories false, enabled: false
  - Minimal: completions + errors + questions only
  - Ambient: all categories true
  - Full: all categories true

**If Categories:**
- Show current toggles, ask which to flip (multiSelect)

**If Voices:**
- Ask which category to change voice for (or default)
- Then ask which voice (show the 13 options)

**If Threshold:**
- Ask for new char count threshold

6. Read current config via `get_voice_config`, apply changes, write back via `set_voice_config`
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

## Available Voices

edward, daniel, jessica, austin, archer, donovan, juniper, mark-casual, mark-natural, cassidy, spuds, rob, adam
