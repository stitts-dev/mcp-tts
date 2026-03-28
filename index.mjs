#!/usr/bin/env node

/**
 * MCP TTS Server — gives Claude Code a voice via ElevenLabs.
 *
 * Tools:
 *   speak(text, voice?, category?)  — speak text aloud, config-aware
 *   get_voice_config()              — read current voice config
 *   set_voice_config(config)        — write full voice config
 */

import { readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  ListToolsRequestSchema,
  CallToolRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import { synthesize } from "./elevenlabs.mjs";
import { synthesizeLocal, ensureModel } from "./piper.mjs";
import { playChunks, playFile } from "./audio.mjs";

// ── Config ──────────────────────────────────────────────────────────────

const __dirname = dirname(fileURLToPath(import.meta.url));
// Store config in ~/.claude/ so it persists across npx/marketplace reinstalls
const CONFIG_PATH = join(process.env.HOME || process.env.USERPROFILE || __dirname, ".claude", "voice-config.json");

let API_KEY = process.env.ELEVENLABS_API_KEY;
const MODEL_ID = process.env.ELEVENLABS_MODEL_ID || "eleven_multilingual_v2";

// Voice library — name -> ElevenLabs voice ID
const VOICES = {
  daniel:    "onwK4e9ZLuTAKqWW03F9",
  jessica:   "flHkNRp1BlvT73UL6gyz",  // Jessica Anne Bogart - Eloquent Villain
  austin:    "Bj9UqZbhQsanLzgalpEG",  // Deep, Raspy and Authentic
  archer:    "Fahco4VZzobUeiPqni1S",   // Conversational
  donovan:   "DMyrgzQFny3JI1Y1paM5",   // Articulate, Strong and Deep
  juniper:   "aMSt68OGf4xUZAnLpTU8",   // Grounded and Professional
  "mark-casual":  "1SM7GgM6IMuvQlz2BwM3", // Casual, Relaxed and Light
  "mark-natural": "UgBBYS2sOqTuMpoF3BR0", // Natural Conversations
  cassidy:   "56AoDkrOh6qfVPDXZ7Pt",   // Crisp, Direct and Clear
  spuds:     "NOpBlnGInO9m6vDvFkFC",   // Wise and Approachable
  rob:       "2ajXGJNYBR0iNHpS4VZb",   // Tough & Calloused
  adam:      "IRHApOXLvnW57QJPQH2P",   // American, Dark and Tough
  edward:    "goT3UYdM9bhm0n2lmKQx",   // British, Dark, Seductive, Low
};

const VALID_CATEGORIES = ["completions", "errors", "questions", "status", "summaries"];
const VALID_PROVIDERS = ["elevenlabs", "piper"];
const PIPER_VOICES = ["en_US-l2arctic-medium", "en_US-norman-medium", "en_US-kusal-medium"];

const DEFAULT_CONFIG = {
  version: 1,
  provider: "elevenlabs",
  categories: { completions: true, errors: true, questions: true, status: false, summaries: false },
  voices: { default: "edward" },
  piperVoice: "en_US-norman-medium",
  piperSpeed: 1.0,
  longOutputThreshold: 500,
  enabled: true,
};

const DEFAULT_VOICE_ID = process.env.ELEVENLABS_VOICE_ID || VOICES[DEFAULT_CONFIG.voices.default];

// ── Voice config ────────────────────────────────────────────────────────

let _cachedConfig = null;

async function loadConfig() {
  if (_cachedConfig) return _cachedConfig;
  try {
    const raw = await readFile(CONFIG_PATH, "utf-8");
    _cachedConfig = { ...DEFAULT_CONFIG, ...JSON.parse(raw) };
  } catch {
    _cachedConfig = { ...DEFAULT_CONFIG };
  }
  // Use API key from config as fallback if env var not set
  if (!API_KEY && _cachedConfig.apiKey) {
    API_KEY = _cachedConfig.apiKey;
  }
  return _cachedConfig;
}

async function saveConfig(config) {
  await writeFile(CONFIG_PATH, JSON.stringify(config, null, 2) + "\n", "utf-8");
  _cachedConfig = config;
}

function lookupVoice(name) {
  return name ? VOICES[name.toLowerCase().trim()] : undefined;
}

function resolveVoiceForCategory(config, category, explicitVoice) {
  return lookupVoice(explicitVoice)
    || lookupVoice(config.voices?.[category])
    || lookupVoice(config.voices?.default)
    || DEFAULT_VOICE_ID;
}

function isCategoryEnabled(config, category) {
  if (!config.enabled) return false;
  if (!category) return config.enabled; // no category = legacy call, allow if enabled
  return config.categories?.[category] ?? false;
}

// ── Rate limiting ───────────────────────────────────────────────────────

let lastSpeakTime = 0;
let queuedSpeak = null;
let queueTimer = null;
const COOLDOWN_MS = 3000;

async function rateLimitedSpeak(cleaned, voiceId) {
  const now = Date.now();
  const elapsed = now - lastSpeakTime;

  if (elapsed >= COOLDOWN_MS) {
    lastSpeakTime = Date.now();
    await doSpeak(cleaned, voiceId);
    return { spoken: true };
  }

  // Queue this request (latest wins — settle replaced promise so it doesn't hang)
  return new Promise((resolve, reject) => {
    if (queueTimer) clearTimeout(queueTimer);
    if (queuedSpeak) {
      queuedSpeak.resolve({ skipped: true, reason: "replaced by newer speak request" });
    }
    queuedSpeak = { cleaned, voiceId, resolve, reject };
    const wait = COOLDOWN_MS - elapsed;
    queueTimer = setTimeout(async () => {
      const { cleaned: c, voiceId: v, resolve: res, reject: rej } = queuedSpeak;
      queuedSpeak = null;
      queueTimer = null;
      lastSpeakTime = Date.now();
      try {
        await doSpeak(c, v);
        res({ spoken: true });
      } catch (err) {
        rej(err);
      }
    }, wait);
  });
}

async function doSpeak(cleaned, voiceId) {
  const config = _cachedConfig || await loadConfig();

  if (config.provider === "piper") {
    const wavPath = await synthesizeLocal(cleaned, {
      voice: config.piperVoice || "en_US-norman-medium",
      speed: config.piperSpeed || 1.0,
    });
    await playFile(wavPath);
    return;
  }

  const chunks = await synthesize(cleaned, {
    apiKey: API_KEY,
    voiceId,
    modelId: MODEL_ID,
  });
  if (chunks.length === 0) throw new Error("No audio received from ElevenLabs");
  await playChunks(chunks);
}

// ── Markdown stripping ──────────────────────────────────────────────────

function stripMarkdown(text) {
  if (!text) return "";
  if (!/[`#*_\[\]<\->]/.test(text)) return text.trim();
  let r = text;
  r = r.replace(/```[\s\S]*?```/g, "");       // code blocks
  r = r.replace(/`([^`]*)`/g, "$1");           // inline code
  r = r.replace(/\[([^\]]*)\]\([^)]*\)/g, "$1"); // links
  r = r.replace(/<\/?[^>]+>/g, "");            // HTML tags
  r = r.replace(/^#{1,6}\s+/gm, "");           // headings
  r = r.replace(/\*\*([^*]*)\*\*/g, "$1");     // bold
  r = r.replace(/__([^_]*)__/g, "$1");
  r = r.replace(/\*([^*]*)\*/g, "$1");         // italic
  r = r.replace(/\b_([^_]*)_\b/g, "$1");
  r = r.replace(/^\s*[-*]\s+/gm, "");          // unordered list
  r = r.replace(/^\s*\d+\.\s+/gm, "");         // ordered list
  r = r.replace(/[ \t]{2,}/g, " ");
  r = r.replace(/\n{2,}/g, "\n");
  return r.trim();
}

// ── MCP Server ──────────────────────────────────────────────────────────

const server = new Server(
  { name: "mcp-tts", version: "3.1.0" },
  { capabilities: { tools: {} } }
);

server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: [
    {
      name: "speak",
      description:
        "Speak text aloud using the configured TTS provider (ElevenLabs or local Piper). Always include a category so the server can apply voice config rules. The server decides whether to actually speak based on the enabled flag and category settings.",
      inputSchema: {
        type: "object",
        properties: {
          text: {
            type: "string",
            description: "Text to speak aloud (markdown will be stripped)",
          },
          voice: {
            type: "string",
            enum: Object.keys(VOICES),
            description: "Voice override (optional — server auto-selects from config based on category)",
          },
          category: {
            type: "string",
            enum: VALID_CATEGORIES,
            description: "Response category: completions, errors, questions, status, or summaries",
          },
        },
        required: ["text"],
      },
    },
    {
      name: "get_voice_config",
      description: "Read the current TTS voice configuration including provider, category toggles, voice mappings, and threshold.",
      inputSchema: {
        type: "object",
        properties: {},
      },
    },
    {
      name: "set_voice_config",
      description: "Write a complete TTS voice configuration. Replaces the entire config (no partial merge — read first, modify, then write back).",
      inputSchema: {
        type: "object",
        properties: {
          config: {
            type: "object",
            description: "Full voice config object with version, provider, categories, voices, longOutputThreshold, and enabled fields",
          },
        },
        required: ["config"],
      },
    },
    {
      name: "setup_tts",
      description: "First-time setup: store your ElevenLabs API key. Required before speak will work. Get a key at https://elevenlabs.io",
      inputSchema: {
        type: "object",
        properties: {
          api_key: {
            type: "string",
            description: "Your ElevenLabs API key (starts with sk_)",
          },
        },
        required: ["api_key"],
      },
    },
  ],
}));

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const toolName = request.params.name;

  // ── setup_tts ──
  if (toolName === "setup_tts") {
    const { api_key } = request.params.arguments ?? {};
    if (!api_key || typeof api_key !== "string" || !api_key.startsWith("sk_")) {
      return {
        content: [{ type: "text", text: "Invalid API key. Must be a string starting with sk_. Get one at https://elevenlabs.io" }],
        isError: true,
      };
    }
    const config = await loadConfig();
    config.apiKey = api_key;
    await saveConfig(config);
    API_KEY = api_key;
    return {
      content: [{ type: "text", text: JSON.stringify({ success: true, message: "API key saved. TTS is ready to use." }) }],
    };
  }

  // ── get_voice_config ──
  if (toolName === "get_voice_config") {
    const config = await loadConfig();
    const needsSetup = config.provider !== "piper" && !API_KEY && !config.apiKey;
    return {
      content: [{ type: "text", text: JSON.stringify({ ...config, needsSetup, availablePiperVoices: PIPER_VOICES }, null, 2) }],
    };
  }

  // ── set_voice_config ──
  if (toolName === "set_voice_config") {
    const { config } = request.params.arguments ?? {};
    if (!config || typeof config !== "object") {
      return {
        content: [{ type: "text", text: "Missing required parameter: config (object)" }],
        isError: true,
      };
    }
    // Validate provider
    if (config.provider && !VALID_PROVIDERS.includes(config.provider)) {
      return {
        content: [{ type: "text", text: `Invalid provider: ${config.provider}. Must be one of: ${VALID_PROVIDERS.join(", ")}` }],
        isError: true,
      };
    }
    // Validate piper voice
    if (config.piperVoice && !PIPER_VOICES.includes(config.piperVoice)) {
      return {
        content: [{ type: "text", text: `Invalid piper voice: ${config.piperVoice}. Must be one of: ${PIPER_VOICES.join(", ")}` }],
        isError: true,
      };
    }
    // Validate voice names
    if (config.voices) {
      for (const [key, name] of Object.entries(config.voices)) {
        if (name && !VOICES[name.toLowerCase().trim()]) {
          return {
            content: [{ type: "text", text: `Invalid voice "${name}" for key "${key}". Valid voices: ${Object.keys(VOICES).join(", ")}` }],
            isError: true,
          };
        }
      }
    }
    const finalConfig = { ...DEFAULT_CONFIG, ...config, version: 1 };
    await saveConfig(finalConfig);
    return {
      content: [{ type: "text", text: JSON.stringify({ success: true, config: finalConfig }, null, 2) }],
    };
  }

  // ── speak ──
  if (toolName === "speak") {
    const { text, voice, category } = request.params.arguments ?? {};

    if (!text || typeof text !== "string") {
      return {
        content: [{ type: "text", text: "Missing required parameter: text" }],
        isError: true,
      };
    }

    const config = await loadConfig();

    // Check API key is available (only needed for ElevenLabs)
    if (config.provider !== "piper" && !API_KEY) {
      return {
        content: [{ type: "text", text: JSON.stringify({ success: false, needsSetup: true, message: "No API key configured. Run /tts or call setup_tts with your ElevenLabs API key, or switch provider to 'piper' for local TTS." }) }],
        isError: true,
      };
    }

    // Gatekeeper: check if this category is enabled
    if (!isCategoryEnabled(config, category)) {
      const reason = !config.enabled
        ? "TTS is disabled (enabled: false)"
        : `category '${category}' is disabled`;
      return {
        content: [{
          type: "text",
          text: JSON.stringify({ success: false, skipped: true, reason }),
        }],
      };
    }

    const cleaned = stripMarkdown(text);
    if (!cleaned) {
      return {
        content: [{ type: "text", text: "Nothing to speak after stripping markdown" }],
      };
    }

    // Threshold check: if text is too long and category is not "summaries", reject
    if (category && category !== "summaries" && cleaned.length > config.longOutputThreshold) {
      return {
        content: [{
          type: "text",
          text: JSON.stringify({
            success: false,
            skipped: true,
            reason: `text exceeds threshold (${cleaned.length} > ${config.longOutputThreshold || 500} chars). Use category 'summaries' with a shorter summary.`,
          }),
        }],
      };
    }

    const voiceId = resolveVoiceForCategory(config, category, voice);

    try {
      await rateLimitedSpeak(cleaned, voiceId);
      return {
        content: [{
          type: "text",
          text: JSON.stringify({
            success: true,
            chars: cleaned.length,
            voice: voice || config.voices?.[category] || config.voices?.default || "default",
            category: category || "uncategorized",
          }),
        }],
      };
    } catch (err) {
      console.error("mcp-tts: speak failed:", err.message);
      return {
        content: [{ type: "text", text: `TTS error: ${err.message}` }],
        isError: true,
      };
    }
  }

  return {
    content: [{ type: "text", text: `Unknown tool: ${toolName}` }],
    isError: true,
  };
});

// ── Standalone test mode ────────────────────────────────────────────────

if (process.argv.includes("--test")) {
  console.log("mcp-tts: test mode — synthesizing test phrase");
  try {
    const config = await loadConfig();
    console.log(`mcp-tts: config loaded — provider: ${config.provider}, enabled: ${config.enabled}`);

    if (config.provider === "piper") {
      const wavPath = await synthesizeLocal("Task complete. All tests passing.", {
        voice: config.piperVoice,
        speed: config.piperSpeed,
      });
      console.log(`mcp-tts: piper synthesized to ${wavPath}`);
      await playFile(wavPath);
    } else {
      const chunks = await synthesize("Task complete. All tests passing.", {
        apiKey: API_KEY,
        voiceId: DEFAULT_VOICE_ID,
        modelId: MODEL_ID,
      });
      console.log(`mcp-tts: got ${chunks.length} chunks`);
      await playChunks(chunks);
    }
    console.log("mcp-tts: test complete");
  } catch (err) {
    console.error("mcp-tts: test failed:", err.message);
    process.exit(1);
  }
} else {
  // Normal MCP stdio mode
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("mcp-tts: server running on stdio");

  // Preload piper model in background if provider is piper
  const startupConfig = await loadConfig();
  if (startupConfig.provider === "piper") {
    ensureModel(startupConfig.piperVoice || "en_US-norman-medium");
  }
}
