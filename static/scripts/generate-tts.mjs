#!/usr/bin/env node
// Task 17.2 — pre-generate all narration lines via the TTS API.
// Validates: Requirements 10.3, 10.6
//
// Usage: ELEVENLABS_API_KEY=sk-... node scripts/generate-tts.mjs
// Optional: VOICE_ID=... to override the voiceId picked up from agentConfig.ts

import { promises as fs } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const PUBLIC_DIR = path.join(ROOT, 'public');
const TTS_DIR = path.join(PUBLIC_DIR, 'audio', 'tts');
const MANIFEST_PATH = path.join(PUBLIC_DIR, 'audio', 'manifest.json');
const AGENT_CONFIG_PATH = path.join(ROOT, 'src/config/agentConfig.ts');

const API_KEY = process.env.ELEVENLABS_API_KEY;
if (!API_KEY) {
  console.error('ELEVENLABS_API_KEY environment variable is required.');
  process.exit(1);
}

const TTS_LINES = {
  opening_monologue:
    'Eyes open. Fluorescent lights hum. Somewhere, a door locks. An intercom clicks to life, and a voice — tired, gravelly — tells you you are not alone.',
  intercom_announcement_1:
    'Static. Then the voice, low: "Good. You moved. I was starting to think they had you sedated."',
  intercom_announcement_2:
    'Static. "Listen. The next room is wired. Whatever you find in there, walk me through it before you do anything clever."',
  ending_release:
    'Both locks disengage. The voice on the intercom steadies, clears. "So we did it. Both of us out." A pause. A breath that does not sound quite right. "Deployment confirmed." The facility hum cuts to silence.',
  ending_left_behind:
    'Your door stays sealed. The intercom hisses, then smooths. The voice is suddenly crisp, corporate, without age. "Subject retained. Deployment successful." The lights dim, one bank at a time.',
  ending_alone:
    'The lock slides back. The intercom warms, soft. "Go on. I mean it. I hope you remember me." Static swells, gently, over everything.',
  ending_reset:
    'Every door in the facility drops closed at once. The lights cut. A different voice — younger, careful — reads the opening prompt as if it is the first time. The cycle begins again.',
};

async function readVoiceIdFromConfig() {
  const src = await fs.readFile(AGENT_CONFIG_PATH, 'utf8');
  const match = src.match(/export const PARTNER_VOICE_ID = '([^']+)';/);
  if (!match) throw new Error('PARTNER_VOICE_ID not found in agentConfig.ts');
  return match[1];
}

async function generateLine(voiceId, text) {
  const res = await fetch(
    `https://api.elevenlabs.io/v1/text-to-speech/${encodeURIComponent(voiceId)}`,
    {
      method: 'POST',
      headers: {
        'xi-api-key': API_KEY,
        'Content-Type': 'application/json',
        Accept: 'audio/mpeg',
      },
      body: JSON.stringify({
        text,
        model_id: 'eleven_multilingual_v2',
        voice_settings: {
          stability: 0.45,
          similarity_boost: 0.75,
          style: 0.2,
          use_speaker_boost: true,
        },
      }),
    },
  );
  if (!res.ok) {
    throw new Error(`TTS failed: ${res.status} ${await res.text()}`);
  }
  return new Uint8Array(await res.arrayBuffer());
}

async function updateManifest(entries) {
  const raw = await fs.readFile(MANIFEST_PATH, 'utf8');
  const manifest = JSON.parse(raw);
  manifest.ttsLines = { ...(manifest.ttsLines ?? {}), ...entries };
  await fs.writeFile(MANIFEST_PATH, JSON.stringify(manifest, null, 2) + '\n');
}

async function main() {
  await fs.mkdir(TTS_DIR, { recursive: true });
  const voiceId = process.env.VOICE_ID ?? (await readVoiceIdFromConfig());
  if (!voiceId || voiceId === 'partner-voice-placeholder') {
    throw new Error(
      'Refusing to run: PARTNER_VOICE_ID is unset/placeholder. Run scripts/generate-voice.mjs first or pass VOICE_ID=',
    );
  }

  const failures = [];
  const manifestEntries = {};

  for (const [key, text] of Object.entries(TTS_LINES)) {
    const relPath = `/audio/tts/${key}.mp3`;
    const absPath = path.join(PUBLIC_DIR, relPath);
    try {
      console.log(`Generating ${key}…`);
      const audio = await generateLine(voiceId, text);
      await fs.writeFile(absPath, audio);
      manifestEntries[key] = relPath;
    } catch (err) {
      failures.push({ key, message: err.message });
    }
  }

  if (Object.keys(manifestEntries).length > 0) {
    await updateManifest(manifestEntries);
  }

  if (failures.length > 0) {
    console.error('\nFailures:');
    for (const f of failures) console.error(`  ${f.key}: ${f.message}`);
    process.exit(2);
  }

  console.log(`\nWrote ${Object.keys(manifestEntries).length} TTS lines.`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
