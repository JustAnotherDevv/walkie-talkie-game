#!/usr/bin/env node
// Task 17.3 — generate diegetic SFX via the Sound Effects API.
// Validates: Requirements 10.4, 10.6
//
// Usage: ELEVENLABS_API_KEY=sk-... node scripts/generate-sfx.mjs

import { promises as fs } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const PUBLIC_DIR = path.join(ROOT, 'public');
const SFX_DIR = path.join(PUBLIC_DIR, 'audio', 'sfx');
const MANIFEST_PATH = path.join(PUBLIC_DIR, 'audio', 'manifest.json');

const API_KEY = process.env.ELEVENLABS_API_KEY;
if (!API_KEY) {
  console.error('ELEVENLABS_API_KEY environment variable is required.');
  process.exit(1);
}

const SFX_PROMPTS = {
  DoorLock: { text: 'A heavy industrial bolt sliding shut, metallic clack, short reverb', duration_seconds: 1.2 },
  DoorUnlock: { text: 'A heavy industrial bolt retracting, metallic clack, short reverb', duration_seconds: 1.2 },
  RadioStaticStart: { text: 'Short burst of walkie-talkie squelch, rising, ends in a soft hiss', duration_seconds: 0.7 },
  RadioStaticEnd: { text: 'Short burst of walkie-talkie squelch, falling, ends in a soft cut', duration_seconds: 0.7 },
  ObjectInteract: { text: 'Tactile interaction click, a small metal switch being flicked, muted', duration_seconds: 0.4 },
  CooperateButtonClick: { text: 'Warm rounded confirm click, like pressing a large industrial button', duration_seconds: 0.5 },
  DefectButtonClick: { text: 'Cold sharp confirm click, a solenoid, like pressing a red industrial button', duration_seconds: 0.5 },
  LockedDoorThud: { text: 'A heavy locked door being pushed and rebounding, dull thud', duration_seconds: 1.0 },
  SignalLost: { text: 'Intercom cutting out, a short burst of static and then silence', duration_seconds: 1.5 },
  StaticBurst: { text: 'A single sharp burst of radio static, quick attack and release', duration_seconds: 0.9 },
};

async function generateSFX({ text, duration_seconds }) {
  const res = await fetch('https://api.elevenlabs.io/v1/sound-generation', {
    method: 'POST',
    headers: {
      'xi-api-key': API_KEY,
      'Content-Type': 'application/json',
      Accept: 'audio/mpeg',
    },
    body: JSON.stringify({
      text,
      duration_seconds,
      prompt_influence: 0.5,
    }),
  });
  if (!res.ok) {
    throw new Error(`sound-generation failed: ${res.status} ${await res.text()}`);
  }
  return new Uint8Array(await res.arrayBuffer());
}

async function updateManifest(entries) {
  const raw = await fs.readFile(MANIFEST_PATH, 'utf8');
  const manifest = JSON.parse(raw);
  manifest.sfxClips = { ...(manifest.sfxClips ?? {}), ...entries };
  await fs.writeFile(MANIFEST_PATH, JSON.stringify(manifest, null, 2) + '\n');
}

async function main() {
  await fs.mkdir(SFX_DIR, { recursive: true });
  const failures = [];
  const manifestEntries = {};

  for (const [key, prompt] of Object.entries(SFX_PROMPTS)) {
    const relPath = `/audio/sfx/${key}.mp3`;
    const absPath = path.join(PUBLIC_DIR, relPath);
    try {
      console.log(`Generating SFX ${key}…`);
      const audio = await generateSFX(prompt);
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

  console.log(`\nWrote ${Object.keys(manifestEntries).length} SFX clips.`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
