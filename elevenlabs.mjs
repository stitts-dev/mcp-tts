import WebSocket from "ws";

const TAG = "[TTS:WS]";

const FATAL_ERRORS = new Set([
  "voice_id_does_not_exist",
  "invalid_api_key",
  "quota_exceeded",
  "unauthorized",
]);

/**
 * Synthesize text to base64 MP3 chunks via ElevenLabs WebSocket API.
 * Returns a promise that resolves with an array of base64 audio strings.
 *
 * Simplified from desktop client — no idle timer, no queue, no reconnection.
 * Single request-response per call.
 */
export function synthesize(text, { apiKey, voiceId, modelId }) {
  return new Promise((resolve, reject) => {
    const chunks = [];

    const params = new URLSearchParams({
      model_id: modelId,
      output_format: "mp3_44100_128",
    });

    const url = `wss://api.elevenlabs.io/v1/text-to-speech/${voiceId}/stream-input?${params}`;

    const ws = new WebSocket(url);
    let done = false;

    const timeout = setTimeout(() => {
      if (!done) {
        done = true;
        ws.close();
        reject(new Error("ElevenLabs WebSocket timeout (30s)"));
      }
    }, 30_000);

    ws.on("open", () => {
      // BOS — initialize voice
      ws.send(
        JSON.stringify({
          text: " ",
          voice_settings: {
            stability: 0.75,
            similarity_boost: 0.85,
            style: 0.15,
            use_speaker_boost: false,
          },
          xi_api_key: apiKey,
        })
      );

      // Send full text + EOS
      ws.send(
        JSON.stringify({
          text: text.endsWith(" ") ? text : text + " ",
          flush: true,
        })
      );

      // EOS — signal end of input
      ws.send(JSON.stringify({ text: "" }));
    });

    ws.on("message", (raw) => {
      try {
        const data = JSON.parse(raw.toString());
        if (data.audio) {
          chunks.push(data.audio);
        } else if (data.error) {
          console.error(TAG, "API error:", data.error);
          if (FATAL_ERRORS.has(data.error)) {
            done = true;
            clearTimeout(timeout);
            ws.close();
            reject(new Error(`ElevenLabs fatal: ${data.error}`));
            return;
          }
        }
        if (data.isFinal) {
          done = true;
          clearTimeout(timeout);
          ws.close();
          resolve(chunks);
        }
      } catch {
        // ignore malformed
      }
    });

    ws.on("close", () => {
      clearTimeout(timeout);
      if (!done) {
        done = true;
        resolve(chunks); // return whatever we got
      }
    });

    ws.on("error", (err) => {
      clearTimeout(timeout);
      if (!done) {
        done = true;
        reject(err);
      }
    });
  });
}
