#!/usr/bin/env node
// Generate short silent WAV placeholder files for every path in the audio manifest.
// This lets ElevenLabsService.loadAudioManifest succeed and fetches not 404 during
// development/tests. Replace with real ElevenLabs-generated audio before shipping.

import { promises as fs } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const PUBLIC_DIR = path.join(ROOT, 'public');
const MANIFEST_PATH = path.join(PUBLIC_DIR, 'audio', 'manifest.json');

function silentWav({ durationMs = 250, sampleRate = 22050 } = {}) {
  const numSamples = Math.floor((sampleRate * durationMs) / 1000);
  const bytesPerSample = 2; // 16-bit mono
  const dataSize = numSamples * bytesPerSample;
  const buffer = Buffer.alloc(44 + dataSize);

  buffer.write('RIFF', 0);
  buffer.writeUInt32LE(36 + dataSize, 4);
  buffer.write('WAVE', 8);
  buffer.write('fmt ', 12);
  buffer.writeUInt32LE(16, 16); // PCM chunk size
  buffer.writeUInt16LE(1, 20); // audio format: PCM
  buffer.writeUInt16LE(1, 22); // mono
  buffer.writeUInt32LE(sampleRate, 24);
  buffer.writeUInt32LE(sampleRate * bytesPerSample, 28); // byte rate
  buffer.writeUInt16LE(bytesPerSample, 32); // block align
  buffer.writeUInt16LE(16, 34); // bits per sample
  buffer.write('data', 36);
  buffer.writeUInt32LE(dataSize, 40);

  // Data section already zero-filled = silence.
  return buffer;
}

async function main() {
  const manifestRaw = await fs.readFile(MANIFEST_PATH, 'utf8');
  const manifest = JSON.parse(manifestRaw);

  const paths = new Set();
  for (const section of ['ttsLines', 'sfxClips', 'musicTracks', 'endingStings']) {
    const group = manifest[section];
    if (!group) continue;
    for (const assetPath of Object.values(group)) {
      if (typeof assetPath === 'string' && assetPath.startsWith('/')) {
        paths.add(assetPath);
      }
    }
  }

  const wav = silentWav();
  let written = 0;
  for (const assetPath of paths) {
    const absPath = path.join(PUBLIC_DIR, assetPath);
    await fs.mkdir(path.dirname(absPath), { recursive: true });
    await fs.writeFile(absPath, wav);
    written++;
  }

  console.log(`Wrote ${written} silent WAV placeholders under ${PUBLIC_DIR}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
