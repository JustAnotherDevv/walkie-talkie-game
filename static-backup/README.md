# Static — AI Escape Room

First-person cooperative escape room. The player is trapped in an industrial
facility and must communicate by walkie-talkie with an AI partner to solve
five narrative beats' worth of interlocking puzzles, culminating in a
simultaneous cooperate/defect prisoner's dilemma with four distinct endings.

## Running locally

```sh
npm install
npm run dev        # Vite dev server
npm run build      # tsc -b + vite build
npm test           # vitest, 200+ tests across unit + fast-check properties
```

Controls: **WASD** move, **mouse** look (click to lock pointer), **E**
interact with props, hold **V** to speak to your partner.

## ElevenLabs integration

The project uses ElevenLabs in two different ways.

### Build-time: pre-generated audio assets

`scripts/generate-voice.mjs`, `generate-tts.mjs`, `generate-sfx.mjs` and
`generate-music.mjs` call the ElevenLabs HTTP APIs to produce the Partner
voice, narration lines, diegetic SFX and tension score, then write them
under `public/audio/…` and register the paths in `public/audio/manifest.json`.

```sh
export ELEVENLABS_API_KEY=sk-your-key
node scripts/generate-voice.mjs    # writes voiceId into src/config/agentConfig.ts
node scripts/generate-tts.mjs      # 7 narration lines, including all 4 endings
node scripts/generate-sfx.mjs      # 10 diegetic SFX clips
node scripts/generate-music.mjs    # 5 beat tracks + 4 ending stings
```

Until you run these, `public/audio/` contains silent WAV placeholders from
`scripts/generate-silent-audio.mjs` so the manifest validator is happy.

### Runtime: live Conversational AI

Live partner dialogue uses `@elevenlabs/client`'s Conversation API. It is
feature-gated on `VITE_ELEVENLABS_AGENT_ID`: if an agent ID is set, the
service opens a real WebSocket session and the player's mic streams
through the SDK on PTT press. Otherwise the service stays on its internal
mock path (used by all tests and by local dev without credentials).

To enable the live session:

1. Create a Conversational AI agent at <https://elevenlabs.io/app/conversational-ai>.
2. Copy `.env.example` → `.env.local` and fill in:
   ```
   VITE_ELEVENLABS_AGENT_ID=your-agent-id
   VITE_ELEVENLABS_VOICE_ID=voice-id-from-generate-voice.mjs
   ```
3. Make sure the agent is configured as public, or substitute a backend
   that mints signed URLs (the current wiring assumes a public agent).
4. `npm run dev` — clicking "Begin transmission" now opens a real ConvAI
   session; holding V streams mic audio; the agent reply plays through
   the SDK's audio output.

The app's system prompt, trust rules and final-choice decision rules from
`src/config/agentConfig.ts` are passed as `overrides.agent.prompt` when
starting the session, and per-puzzle partner knowledge + trust events +
tone instructions are pushed as `sendContextualUpdate` calls, so the same
agent works for every beat without needing bespoke dashboard configuration.

## Tests

`npm test` runs Vitest with fast-check property tests (≥100 iterations
each). `src/__tests__/noSaveOperations.test.ts` additionally sweeps the
source tree for forbidden persistence APIs (localStorage / sessionStorage
/ indexedDB) and runs a full-session spy to assert none are called.
