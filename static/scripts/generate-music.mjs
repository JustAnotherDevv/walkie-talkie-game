#!/usr/bin/env node
// Task 17.4 — generate tension score tracks and ending stings via the Music API.
// Validates: Requirements 10.5, 10.6
//
// Usage: ELEVENLABS_API_KEY=sk-... node scripts/generate-music.mjs

import { promises as fs } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const PUBLIC_DIR = path.join(ROOT, 'public');
const MUSIC_DIR = path.join(PUBLIC_DIR, 'audio', 'music');
const MANIFEST_PATH = path.join(PUBLIC_DIR, 'audio', 'manifest.json');

const API_KEY = process.env.ELEVENLABS_API_KEY;
if (!API_KEY) {
  console.error('ELEVENLABS_API_KEY environment variable is required.');
  process.exit(1);
}

const BEAT_TRACKS = {
  Opening: {
    prompt: 'Sparse ambient dread score, near silence, a single low drone, distant mechanical thumps. 60 bpm. Psychological thriller.',
    duration_seconds: 45,
  },
  Rising: {
    prompt: 'Sparse ambient dread score, just perceptible synth bed, barely moving pulse, still no melody. 65 bpm. Psychological thriller.',
    duration_seconds: 45,
  },
  Midpoint: {
    prompt: 'Low-volume tension score begins, muted strings enter, slow rising pulse, dread. 75 bpm. Psychological thriller.',
    duration_seconds: 60,
  },
  Climb: {
    prompt: 'Escalating tension score, tight string ostinato, rising synth pad, faster pulse, still cold. 90 bpm. Psychological thriller.',
    duration_seconds: 60,
  },
  Climax: {
    prompt: 'Full tension score at peak, relentless ostinato, low brass, heart-rate-fast pulse, cold dread. 110 bpm. Psychological thriller.',
    duration_seconds: 60,
  },
};

const ENDING_STINGS = {
  Release: {
    prompt: 'A warm exhale sting: low drone resolves into a single clean major chord, relieved, cinematic. 6 seconds.',
    duration_seconds: 6,
  },
  LeftBehind: {
    prompt: 'A cold betrayal sting: deceleration into a single dissonant minor chord, corporate finality. 6 seconds.',
    duration_seconds: 6,
  },
  Alone: {
    prompt: 'A bittersweet departure sting: suspended chord resolving to an open fifth, distant and warm. 6 seconds.',
    duration_seconds: 6,
  },
  Reset: {
    prompt: 'A hard cycle-restart sting: sharp cut, silence, then a single low pulse, ominous and mechanical. 6 seconds.',
    duration_seconds: 6,
  },
};

async function generateMusic({ prompt, duration_seconds }) {
  const res = await fetch('https://api.elevenlabs.io/v1/music', {
    method: 'POST',
    headers: {
      'xi-api-key': API_KEY,
      'Content-Type': 'application/json',
      Accept: 'audio/mpeg',
    },
    body: JSON.stringify({
      prompt,
      music_length_ms: Math.round(duration_seconds * 1000),
    }),
  });
  if (!res.ok) {
    throw new Error(`music failed: ${res.status} ${await res.text()}`);
  }
  return new Uint8Array(await res.arrayBuffer());
}

async function updateManifest(musicTracks, endingStings) {
  const raw = await fs.readFile(MANIFEST_PATH, 'utf8');
  const manifest = JSON.parse(raw);
  manifest.musicTracks = { ...(manifest.musicTracks ?? {}), ...musicTracks };
  manifest.endingStings = { ...(manifest.endingStings ?? {}), ...endingStings };
  await fs.writeFile(MANIFEST_PATH, JSON.stringify(manifest, null, 2) + '\n');
}

async function main() {
  await fs.mkdir(MUSIC_DIR, { recursive: true });
  const failures = [];
  const musicEntries = {};
  const stingEntries = {};

  for (const [beat, spec] of Object.entries(BEAT_TRACKS)) {
    const relPath = `/audio/music/${beat.toLowerCase()}.mp3`;
    const absPath = path.join(PUBLIC_DIR, relPath);
    try {
      console.log(`Generating beat ${beat}…`);
      const audio = await generateMusic(spec);
      await fs.writeFile(absPath, audio);
      musicEntries[beat] = relPath;
    } catch (err) {
      failures.push({ key: `music:${beat}`, message: err.message });
    }
  }

  for (const [ending, spec] of Object.entries(ENDING_STINGS)) {
    const relPath = `/audio/music/ending_${ending.toLowerCase()}_sting.mp3`;
    const absPath = path.join(PUBLIC_DIR, relPath);
    try {
      console.log(`Generating sting ${ending}…`);
      const audio = await generateMusic(spec);
      await fs.writeFile(absPath, audio);
      stingEntries[ending] = relPath;
    } catch (err) {
      failures.push({ key: `sting:${ending}`, message: err.message });
    }
  }

  if (Object.keys(musicEntries).length > 0 || Object.keys(stingEntries).length > 0) {
    await updateManifest(musicEntries, stingEntries);
  }

  if (failures.length > 0) {
    console.error('\nFailures:');
    for (const f of failures) console.error(`  ${f.key}: ${f.message}`);
    process.exit(2);
  }

  console.log(
    `\nWrote ${Object.keys(musicEntries).length} beat tracks and ${
      Object.keys(stingEntries).length
    } ending stings.`,
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
