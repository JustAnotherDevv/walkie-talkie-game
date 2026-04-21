#!/usr/bin/env node
// Task 17.1 — Voice Design: produce the Partner voice artefact and persist
// its voiceId into src/config/agentConfig.ts so the rest of the app uses it.
// Validates: Requirements 4.1, 4.2, 4.3, 10.1
//
// Usage: ELEVENLABS_API_KEY=sk-... node scripts/generate-voice.mjs
// Optional:
//   PREVIEW_INDEX=0..2 (which preview to keep, default 0)
//   VOICE_PROMPT="..." to override the default weary-elder prompt

import { promises as fs } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const AGENT_CONFIG_PATH = path.join(ROOT, 'src/config/agentConfig.ts');

const API_KEY = process.env.ELEVENLABS_API_KEY;
if (!API_KEY) {
  console.error('ELEVENLABS_API_KEY environment variable is required.');
  process.exit(1);
}

const VOICE_PROMPT =
  process.env.VOICE_PROMPT ??
  'An ultra-realistic elderly male voice, late 60s to 70s, weary, gravelly, measured. American or transatlantic accent. Subtle breathing and short pauses mid-sentence. Softly worn with age but still clear; the voice of someone who has been talking through a battered intercom for a long time.';

const PREVIEW_TEXT =
  'I have been stuck down here for longer than I care to think about. If you can hear me, tap the intercom, and tell me what you see. We can get out of this, one piece at a time.';

async function createPreviews() {
  const res = await fetch(
    'https://api.elevenlabs.io/v1/text-to-voice/create-previews',
    {
      method: 'POST',
      headers: {
        'xi-api-key': API_KEY,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        voice_description: VOICE_PROMPT,
        text: PREVIEW_TEXT,
      }),
    },
  );
  if (!res.ok) {
    throw new Error(`create-previews failed: ${res.status} ${await res.text()}`);
  }
  return res.json();
}

async function saveVoice(generatedVoiceId, voiceName) {
  const res = await fetch(
    'https://api.elevenlabs.io/v1/text-to-voice/create-voice-from-preview',
    {
      method: 'POST',
      headers: {
        'xi-api-key': API_KEY,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        voice_name: voiceName,
        voice_description: VOICE_PROMPT,
        generated_voice_id: generatedVoiceId,
      }),
    },
  );
  if (!res.ok) {
    throw new Error(`save voice failed: ${res.status} ${await res.text()}`);
  }
  return res.json();
}

async function writeVoiceIdIntoAgentConfig(voiceId) {
  const current = await fs.readFile(AGENT_CONFIG_PATH, 'utf8');
  const next = current.replace(
    /export const PARTNER_VOICE_ID = '[^']*';/,
    `export const PARTNER_VOICE_ID = '${voiceId}';`,
  );
  if (next === current) {
    throw new Error('Could not find PARTNER_VOICE_ID constant to rewrite.');
  }
  await fs.writeFile(AGENT_CONFIG_PATH, next);
}

async function main() {
  const idx = Number(process.env.PREVIEW_INDEX ?? 0);
  console.log('Requesting 3 Voice Design previews…');
  const previews = await createPreviews();
  const list = previews.previews ?? previews;
  if (!Array.isArray(list) || list.length === 0) {
    throw new Error(`Unexpected previews payload: ${JSON.stringify(previews)}`);
  }

  const chosen = list[idx] ?? list[0];
  console.log(`Keeping preview ${idx} (generated_voice_id=${chosen.generated_voice_id ?? chosen.voice_id}).`);

  const saved = await saveVoice(
    chosen.generated_voice_id ?? chosen.voice_id,
    'Static Partner',
  );
  const voiceId = saved.voice_id ?? saved.voiceId;
  if (!voiceId) {
    throw new Error(`Unexpected save payload: ${JSON.stringify(saved)}`);
  }

  await writeVoiceIdIntoAgentConfig(voiceId);
  console.log(`Persisted voiceId ${voiceId} to ${path.relative(ROOT, AGENT_CONFIG_PATH)}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
