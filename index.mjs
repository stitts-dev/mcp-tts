#!/usr/bin/env node

/**
 * MCP TTS Server — gives Claude Code a voice via ElevenLabs.
 *
 * Single tool: speak(text, voice?)
 * Strips markdown, synthesizes via WebSocket, plays via afplay.
 */

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  ListToolsRequestSchema,
  CallToolRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import { synthesize } from "./elevenlabs.mjs";
import { playChunks } from "./audio.mjs";

// ── Config ──────────────────────────────────────────────────────────────

const API_KEY = process.env.ELEVENLABS_API_KEY;
const REN_VOICE_ID = process.env.ELEVENLABS_REN_VOICE_ID;
const VOX_VOICE_ID = process.env.ELEVENLABS_VOX_VOICE_ID || REN_VOICE_ID;
const MODEL_ID = process.env.ELEVENLABS_MODEL_ID || "eleven_turbo_v2_5";

if (!API_KEY || !REN_VOICE_ID) {
  console.error(
    "mcp-tts: ELEVENLABS_API_KEY and ELEVENLABS_REN_VOICE_ID required as env vars"
  );
  process.exit(1);
}

// ── Markdown stripping ──────────────────────────────────────────────────

function stripMarkdown(text) {
  if (!text) return "";
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
  { name: "mcp-tts", version: "1.0.0" },
  { capabilities: { tools: {} } }
);

server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: [
    {
      name: "speak",
      description:
        "Speak text aloud using ElevenLabs TTS. Use for brief verbal summaries of completed work, test results, or key findings. Keep text concise (1-2 sentences). Don't speak code.",
      inputSchema: {
        type: "object",
        properties: {
          text: {
            type: "string",
            description: "Text to speak aloud (markdown will be stripped)",
          },
          voice: {
            type: "string",
            enum: ["ren", "vox"],
            description: "Voice to use (default: ren)",
          },
        },
        required: ["text"],
      },
    },
  ],
}));

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  if (request.params.name !== "speak") {
    return {
      content: [{ type: "text", text: `Unknown tool: ${request.params.name}` }],
      isError: true,
    };
  }

  const { text, voice } = request.params.arguments ?? {};

  if (!text || typeof text !== "string") {
    return {
      content: [{ type: "text", text: "Missing required parameter: text" }],
      isError: true,
    };
  }

  const cleaned = stripMarkdown(text);
  if (!cleaned) {
    return {
      content: [{ type: "text", text: "Nothing to speak after stripping markdown" }],
    };
  }

  const voiceId = voice === "vox" ? VOX_VOICE_ID : REN_VOICE_ID;

  try {
    const chunks = await synthesize(cleaned, {
      apiKey: API_KEY,
      voiceId,
      modelId: MODEL_ID,
    });

    if (chunks.length === 0) {
      return {
        content: [{ type: "text", text: "No audio received from ElevenLabs" }],
        isError: true,
      };
    }

    await playChunks(chunks);

    return {
      content: [
        {
          type: "text",
          text: JSON.stringify({
            success: true,
            chars: cleaned.length,
            voice: voice || "ren",
          }),
        },
      ],
    };
  } catch (err) {
    console.error("mcp-tts: speak failed:", err.message);
    return {
      content: [{ type: "text", text: `TTS error: ${err.message}` }],
      isError: true,
    };
  }
});

// ── Standalone test mode ────────────────────────────────────────────────

if (process.argv.includes("--test")) {
  console.log("mcp-tts: test mode — synthesizing 'Hello, I am your coach.'");
  try {
    const chunks = await synthesize("Hello, I am your coach.", {
      apiKey: API_KEY,
      voiceId: REN_VOICE_ID,
      modelId: MODEL_ID,
    });
    console.log(`mcp-tts: got ${chunks.length} chunks`);
    await playChunks(chunks);
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
}
