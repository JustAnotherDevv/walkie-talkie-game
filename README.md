# Walkie Talkie — a voice-first cooperative escape room

> A 3D first-person cooperative escape room playable in the browser.
> You are trapped in an abandoned industrial facility. The only way out
> is to communicate via push-to-talk with a voice on the other side of a
> walkie-talkie. Neither of you can see what the other sees. Every puzzle
> forces a verbal exchange. A hidden trust system tracks how you treated
> your partner across the whole playthrough, and the game ends with a
> simultaneous cooperate-or-defect prisoner's dilemma that resolves into
> one of four distinct endings. The partner's final decision is reasoned
> by the LLM based on the trust arc you built with them — not scripted.

Built for **Kiro × ElevenLabs Hack #5** (see [`HACKATHON.md`](./HACKATHON.md)
and [`GAME_DESIGN.md`](./GAME_DESIGN.md)). Target playthrough length
~10–15 minutes.

## How Kiro built this

The hackathon criteria ask how each Kiro feature was used. Honest accounting, by feature:

### Spec-driven development — the load-bearing one

Everything in the working branch traces back to a structured spec at [`.kiro/specs/ai-escape-room/`](./.kiro/specs/ai-escape-room/). Three files, each with a distinct job:

- **`requirements.md`** — 13 requirements in **EARS notation** (Easy Approach to Requirements Syntax), each with an explicit user story and machine-readable acceptance criteria. Every "SHALL" is a testable claim.
- **`design.md`** — architecture (Vite + React + R3F + Zustand + `@elevenlabs/client`) plus **17 numbered correctness properties** that bridge prose requirements to verifiable invariants. Example: *"Property 14: Final choice routing correctness — for all 4 combinations of (PlayerChoice × PartnerChoice), route to exactly the correct ending per the 2×2 matrix."*
- **`tasks.md`** — 23 task sections with sub-tasks, each annotated with the requirement numbers it validates.

The chain of custody is: `user story → EARS requirement → correctness property → task → implementation → property test`. This is why a 10-minute playthrough that spans live voice, 3D, state management, and a 2×2 game-theory ending could actually be shipped in a hackathon window — the ending branches, trust arithmetic, and puzzle-gating rules aren't vibe-coded, they're derived from properties and the tests assert those properties directly (`fast-check`, ≥100 iterations per property).

**How this compared to vibe coding:** the stateful game logic (trust index, ending routing, door gating, scripted voice triggers) lives under the spec. Everything *visual* — scene composition, god rays, camera wake-up animation, dust particles, door hinges — was built by vibe coding. The split is deliberate: **specs for things that have to be correct, vibes for things that have to feel right.** Spec-driven work had a slower intake but near-zero rework; vibe-coded work was fast per-iteration but often needed 5–10 rounds before it landed. Picking the right mode per surface was the single biggest productivity lever.

See [How it uses Kiro](#how-it-uses-kiro) below for the full spec dissection.

### Vibe coding — scene, camera, and feel

Conversations with Kiro for the visual layer followed a consistent pattern: **state the goal in one sentence, iterate tight loops, attach screenshots when a render disagreed with my words.** The highest-leverage prompts were the ones that fed Kiro world-space constraints up front ("rooms are 14m apart, floor at `y=-2`, catwalk doorway is `1.4×` standard height at `z=38`") so it could write coordinates directly into scene data instead of guessing.

**Most impressive single generation:** the two-stage camera wake-up animation in [`static/src/components/IntroCamera.tsx`](./static/src/components/IntroCamera.tsx). One prompt produced a `useFrame`-driven two-stage pose interpolation (lying-on-side → elbow-up → standing) with `easeOutCubic`, an overlaid lateral sway that decays with progress, `YXZ` Euler order for correct roll-then-pitch composition, and a `useLayoutEffect` that pins the lying pose on first paint so the Canvas never flashes the default `(0, 0, 2)` origin. That's several distinct R3F timing gotchas solved in one shot.

**Close runner-up:** the volumetric god-ray box with a fresnel-style GLSL shader — survived ~8 rejected iterations (crossed planes showing an "X", billboard rotating with the camera, wrong fade direction, visible circle on the floor) without losing context across the thread. That kind of stamina is where vibe coding shines.

### Agent hooks

Not leveraged in this project. The feedback loop here is a browser dev server and hand-driven playthroughs — the signals that matter (does the god ray look right, does the AI give a useful clue, does the final cutscene land) aren't shell-automatable. A `tsc --noEmit` hook on save of `src/**` is the obvious next addition if this went past the hackathon.

### Steering docs

Not leveraged as Kiro steering files. The nearest equivalent is [`GAME_DESIGN.md`](./GAME_DESIGN.md) — a single long document stating the genre, tone, trust-system contract, and ending matrix, kept open in every conversation so the agent always had the anchoring context. Same function as steering, different mechanism. The strategy that made the biggest difference was **keeping the trust-and-endings contract paraphrased in-thread** any time the conversation drifted toward scripted-voice or final-cutscene work.

### MCP

Not used. The project's external integration is ElevenLabs ConvAI (WebSocket SDK, not MCP), and the hackathon window did not leave time to stand up an MCP server. Candid: a Three.js / R3F docs MCP would have replaced a chunk of the god-ray trial-and-error.

### Kiro powers

The spec-driven workflow above is the headline power leveraged. Test-generation capability is what makes a 17-property correctness list cheap to enforce — property tests were written alongside the implementation, not after, so any regression in the 2×2 ending matrix fails the suite immediately. No third-party tooling was added specifically for Kiro integration.

## Table of contents

- [How Kiro built this](#how-kiro-built-this)
- [Elevator pitch](#elevator-pitch)
- [Running locally](#running-locally)
- [How it uses ElevenLabs](#how-it-uses-elevenlabs)
- [How it uses Kiro](#how-it-uses-kiro)
- [What problem it solves](#what-problem-it-solves)
- [Architecture](#architecture)
- [The playthrough](#the-playthrough)
- [Trust system and the final choice](#trust-system-and-the-final-choice)
- [Repo layout](#repo-layout)
- [Status](#status)

---

## Elevator pitch

You wake up in a locked facility. An intercom crackles to life and a
weary elderly voice — gravelly, measured, late sixties — tells you they
are also trapped. You can't see each other. Your rooms are different.
Your puzzles are **interlocked**: the player can see props the partner
cannot, the partner has terminal fragments and logbook entries the
player cannot, and the only way anyone escapes is by describing what
they see out loud. The game listens to your voice and pushes it through
an ElevenLabs Conversational AI agent. The partner replies in real time
in a Voice-Design-generated voice, through a radio-filtered intercom.

Two thirds of the way in you discover a classified memo suggesting
**only one exit code will work**. The game never confirms or denies
this. In the final room each of you pushes a button — simultaneously,
no take-backs — marked either COOPERATE or DEFECT. The partner is not
scripted. The LLM reasons over the full conversation history and a
hidden trust score that has been quietly accumulating based on whether
you lied on a defection-opportunity puzzle, withheld information your
partner explicitly asked for, shared disadvantageous info you didn't
have to, or emotionally reassured them. Four endings, no save scumming,
no way to re-roll. The choice is yours to bear.

## Running locally

```sh
cd static
npm install
npm run dev        # Vite dev server (localhost:5173)
npm run build      # tsc -b + vite build
npm test           # vitest — unit + fast-check property tests
```

Default runtime stays in **mock mode** — no credentials needed. To
enable live ElevenLabs Conversational AI and real audio:

```sh
cp .env.example .env.local
# Edit .env.local:
#   VITE_ELEVENLABS_AGENT_ID=agent_xxxxxxxxxxxx
#   VITE_ELEVENLABS_VOICE_ID=<voice id from generate-voice.mjs>
#   ELEVENLABS_API_KEY=sk-...                   (only for the build-time scripts)

# One-time asset generation (replaces the silent placeholder WAVs):
export ELEVENLABS_API_KEY=sk-...
node scripts/generate-voice.mjs     # Voice Design → partner voice id
node scripts/generate-tts.mjs       # 7 narration lines in the partner's voice
node scripts/generate-sfx.mjs       # 10 diegetic SFX clips
node scripts/generate-music.mjs     # 5 beat tracks + 4 ending stings
```

Create a public Conversational AI agent in the ElevenLabs dashboard,
paste its id into `.env.local`, and the app switches to live mode on
the next `npm run dev`: PTT streams your mic to the agent over a
WebSocket, the partner replies play through the intercom audio channel,
trust events fan out as `sendContextualUpdate(...)` calls, and the
partner's final choice arrives via a `clientTools.finalChoice({choice})`
callback the SDK invokes. No backend, no signed-URL exchange — public
agent only.

## How it uses ElevenLabs

Voice is the *core game mechanic*, not decoration. Five ElevenLabs APIs
each doing something the game depends on:

### Conversational AI (runtime)

The partner's live dialogue. When the player holds V, the mic unmutes
and audio streams to the agent through `@elevenlabs/client`'s
`Conversation.startSession(...)`. The SDK handles STT → LLM → TTS and
plays the reply back. Beat-specific tone instructions, per-puzzle
partner knowledge, and accumulated trust events are pushed into the
agent context mid-session via `sendContextualUpdate(...)` so the
partner's behaviour *actually changes* over the 10-minute arc.

At the Climax, the game sends a `sendUserMessage("Make your final
choice…")` and awaits a `clientTools.finalChoice({choice: 'Cooperate'
| 'Defect'})` call from the agent — so the decision is a real reasoning
pass over the full history, not a coin flip.

### Voice Design

A build-time script calls the Voice Design API with the target prompt:

> ultra-realistic elderly male voice, late 60s to 70s, weary, gravelly,
> measured. American / transatlantic accent. Subtle breathing and short
> pauses mid-sentence. Softly worn with age but still clear; the voice
> of someone who has been talking through a battered intercom for a
> long time.

The resulting voice id is persisted into `src/config/agentConfig.ts`
and then used consistently as the `overrides.tts.voiceId` for
Conversational AI, the voice for every TTS call, and for all four
ending narrations.

### Text-to-Speech

Pre-generated at build time and shipped as static audio files under
`public/audio/tts/`:

- Opening monologue (narration)
- Two intercom announcement lines (played through the radio filter)
- One narration per ending (Release, Left Behind, Alone, Reset)

### Sound Effects

Generated at build time from text prompts, one per `SFXKey`:

- door lock / unlock, radio static start / end, object interact,
  cooperate button click, defect button click, locked-door thud,
  signal lost, static burst

Each is authored with an explicit duration so the timing matches the
diegetic moment it plays against.

### Music

Generated at build time, one track per narrative beat:

- **Opening / Rising** — sparse ambient dread, near silence
- **Midpoint** — muted strings enter, slow rising pulse
- **Climb** — tight string ostinato, rising synth pad
- **Climax** — full tension score, relentless ostinato

Plus one distinct sting per ending (warm / cold / bittersweet /
cycle-restart).

### Summary

| API | Role |
|---|---|
| Conversational AI | Live partner dialogue, final choice decision via client tool |
| Voice Design | One-time generation of the partner's voice identity |
| Text-to-Speech | Pre-generated narration in the partner's voice |
| Sound Effects | Diegetic cues (door, radio, buttons, intercom) |
| Music | Tension score per narrative beat + 4 ending stings |

If any one of these fails, a specific slice of the game goes mute. The
stack is **breadth-first by design**: a hackathon submission should
demonstrate what ElevenLabs can actually do across a product surface,
not just drop one TTS line onto a UI.

## How it uses Kiro

Everything in the working branch was built against a Kiro spec at
[`.kiro/specs/ai-escape-room/`](./.kiro/specs/ai-escape-room/). The
directory contains three files, each with a specific job:

### `requirements.md` — what the product must do

Thirteen requirements in **EARS notation** (Easy Approach to
Requirements Syntax), each with an explicit user story and
machine-readable acceptance criteria. A representative one:

> **Requirement 5: Interlocked Puzzle System**
>
> User Story: As a Player, I want each puzzle to require information
> from the Partner that I cannot obtain on my own, so that
> communication is mechanically necessary and not optional.
>
> 5.1 THE Game SHALL include 4–5 Puzzles across the playthrough, each
>   requiring at least one exchange of information between Player and
>   Partner to solve.
>
> 5.4 THE Game SHALL include at least one Puzzle of each of the
>   following archetypes: symbol correlation, split combination, and
>   descriptive match.
>
> 5.5 THE Game SHALL include 2 Defection_Opportunity Puzzles where the
>   Player can choose to lie or withhold information from the Partner.
>
> 5.7 THE Game SHALL ensure no Puzzle is solvable by the Player without
>   Partner input, even if the Player has explored all available props.

Every "SHALL" becomes a test eventually.

### `design.md` — how the product is built and verified

Architecture (Vite + React + R3F + Zustand + `@elevenlabs/client`
facade), component interfaces, and — crucially — **seventeen numbered
correctness properties** that bridge the requirements to
machine-verifiable invariants. A representative property:

> **Property 14: Final choice routing correctness**
>
> For any combination of player choice (Cooperate / Defect) and partner
> choice (Cooperate / Defect), the game should route to exactly the
> correct ending per the 2×2 matrix:
> - (Cooperate, Cooperate) → Release
> - (Cooperate, Defect) → LeftBehind
> - (Defect, Cooperate) → Alone
> - (Defect, Defect) → Reset
>
> Validates: Requirements 8.6, 9.1

### `tasks.md` — the build plan

Twenty-three task sections with explicit sub-tasks, each annotated
with the requirement numbers it validates. Property 14 for example
corresponds to task 15.2:

> 15.2 Write property test for final choice routing correctness
> - For all 4 combinations of (PlayerChoice × PartnerChoice), game
>   routes to exactly the correct EndingType
> - Validates: Requirements 8.6, 9.1

### Why this matters

The property list is the contract. The test suite is generated
directly from the properties (`fast-check` with ≥100 iterations per
property). The implementation is in turn derived from the tasks. You
can trace any line of game behaviour backwards:

```
game behaviour
  ← task (with requirement reference)
    ← property (with requirement reference)
      ← requirement (EARS acceptance criterion)
        ← user story
```

This is the whole point of spec-driven development. The spec isn't a
deliverable that gets written once and ignored — it's the source of
truth the tests and implementation both derive from.

## What problem it solves

Three overlapping things, in order of how hard the problem is:

### 1. Make voice the only channel to the NPC

Games with an "AI companion" today either script the dialogue (boring,
predictable, forgotten within a year) or bolt a chat window onto the
side (immersion-breaking, pulls the player out of the world). Static
makes voice the *only* input channel to the partner and the *only* way
any puzzle becomes solvable — so the LLM is structurally load-bearing,
not cosmetic. If you don't talk, you don't escape. That forces the
design to actually trust the voice mechanic.

Practical consequence: the puzzles are designed around information
asymmetry. The player can see a glyph on a wall but not know which
control key it maps to. The partner has a terminal with "triangle
with line = ALPHA, circle with dot = BETA". Neither side can solve it
alone. Describing what you see is the gameplay.

### 2. Make the AI's decision feel earned

The prisoner's dilemma ending would be a coin flip or a dice roll in a
normal game. That's a non-decision. Here the partner's choice is a
real LLM reasoning pass over the full conversation history plus a
hidden trust score the player never sees during gameplay. The rules
that govern the partner's reasoning live in the same spec that
generated the tests, so they are auditable:

> - **trust_low (<= -3)**: bias strongly toward Defect. The Player has
>   earned your suspicion.
> - **trust_high (>= 3)**: bias strongly toward Cooperate. The Player
>   has shown their hand.
> - **trust_mid**: reason contextually — recent contradictions and
>   broken promises push toward Defect; repeated reassurance, shared
>   risk, and emotional engagement push toward Cooperate.

Four endings, no save scumming, no take-backs. You find out at the
same moment as the partner. The decision you made — and the
conversation you had — is the one you get to live with.

### 3. Ship a non-trivial AI-driven game from a spec

Static is a proof that you can start from an EARS-style requirements
document, design 17 provable correctness properties, generate 260+
property tests, and end with a playable hackathon submission — where
the partner's persona, the trust rules, and the final-choice decision
logic all flow out of the same spec that produced the tests. Every
task in the plan lists exactly which requirements it satisfies. Every
property maps back to a requirement. The agent's system prompt is
literally composed from the trust and final-choice instructions
exported from `src/config/agentConfig.ts`, which are themselves
derived directly from Requirements 6 and 8.

## Architecture

High-level component graph:

```
 ┌──────────────────────────────────────────────────────────────────┐
 │ React app (Vite)                                                 │
 │                                                                  │
 │ ┌────────────┐   ┌────────────────┐   ┌─────────────────────┐    │
 │ │ TitleScreen│   │ R3F <Canvas/>  │   │ HUD / RevealPanel / │    │
 │ │            │   │  • PlayerCtrl  │   │ FinalChoiceUI /     │    │
 │ │  begin →   │   │  • RoomScene   │   │ EndingScreen        │    │
 │ │            │   │  • Interactable│   │                     │    │
 │ └────┬───────┘   │    Props       │   └──────────┬──────────┘    │
 │      │           └────────┬───────┘              │               │
 │      ▼                    ▼                      ▼               │
 │ ┌────────────────────────────────────────────────────────────┐   │
 │ │ Zustand game state store                                   │   │
 │ │  hasStarted · currentBeat · solvedPuzzles · trust state    │   │
 │ │  revealedContent · finalChoiceActive · endingType          │   │
 │ └────────────────────────────────────────────────────────────┘   │
 │                             │                                    │
 │                             ▼                                    │
 │ ┌────────────────────────────────────────────────────────────┐   │
 │ │ ElevenLabsService  ←→  useAudioManager                     │   │
 │ │   mock path ←──────│ branch on VITE_ELEVENLABS_AGENT_ID    │   │
 │ │   live path ←── @elevenlabs/client Conversation.startSession│   │
 │ │                                                             │   │
 │ │ TrustEventReporter → injectTrustEvent → sendContextualUpdate│   │
 │ │ beatToneInjection  → injectAgentContext                    │   │
 │ │ partnerKnowledge   → injectAgentContext                    │   │
 │ │ endingOrchestrator → lighting + doors + TTS + sting        │   │
 │ │ midGameRevealOrch  → sendUserMessage(scripted prompt)      │   │
 │ └────────────────────────────────────────────────────────────┘   │
 └──────────────────────────────────────────────────────────────────┘
```

### Architectural decisions worth calling out

- **One ElevenLabsService facade.** All external API access lives
  behind a single class that branches on whether `VITE_ELEVENLABS_AGENT_ID`
  is set. Mock path preserves deterministic local dev and unit tests;
  live path delegates to `@elevenlabs/client`'s `Conversation`.

- **Trust score lives in the agent's memory, not in React state.** The
  game fires `[TRUST_EVENT] type=LiedAboutPuzzle | impact=-2 | detail=…`
  messages into the agent context via `sendContextualUpdate(...)`. The
  agent maintains the numeric score privately. React only ever learns
  the outcome (the partner's final Cooperate / Defect choice). This
  keeps the trust arc opaque to the player and avoids state-sync
  issues — there's only one source of truth.

- **Pre-generated audio assets for everything except ConvAI.** TTS,
  SFX, and Music are generated at build time and shipped as static
  WAVs. Only Conversational AI is runtime. This minimises latency and
  API dependency during play.

- **Narrative beats as a linear state machine.** Five beats (Opening →
  Rising → Midpoint → Climb → Climax), advanced monotonically when all
  puzzles in the current beat are solved. Beat transitions drive music
  volume, partner tone instructions, and trigger the mid-game reveal
  / final choice events. Beat never regresses.

- **Pointer-lock first-person controls.** `PlayerController` uses R3F's
  `useFrame` to apply WASD movement and mouse-delta rotation, clamped
  to ±90° pitch. The canvas requests pointer lock on click; Escape
  releases it.

- **No save system.** Each playthrough is a single continuous session.
  No `localStorage`, no `sessionStorage`, no `IndexedDB`. A test
  actively scans the source tree to prove this.

- **Property tests, not just unit tests.** Seventeen properties, each
  running ≥100 fast-check iterations. Example: "for any sequence of
  PTT state changes and audio frames, only frames during PTT-active
  periods are forwarded" (Property 4). These guard universal
  invariants; example-based unit tests cover the specific UI states.

## The playthrough

Five narrative beats:

| Beat | Duration | What happens |
|---|---|---|
| **Opening** | ~1 min | Wake up. Opening monologue TTS. Partner's first intercom line. Tutorial puzzle (SymbolCorrelation) teaches PTT through play. |
| **Rising** | 4–5 min | Puzzles 2 and 3 (SplitCombination + DescriptiveMatch). Puzzle 2 is the first **defection opportunity**: the player has `47-` on a torn note, the partner has `-23` on their terminal. The player can tell the partner `47` truthfully, lie about their digits, or refuse. The partner cannot verify. Solving requires truthful sharing. |
| **Midpoint** | 2–3 min | **Mid-game reveal**: a classified memo in Room 2 states that only one exit code will work — the other is a decoy, selected by the subject's trust index. The partner reacts in real time ("Did you just read what I think you just read?"). The game never confirms or denies the memo's content. Audio escalates — music enters. |
| **Climb** | 3–4 min | Puzzle 4 (OrderedSequence) — second defection opportunity. Requires multi-turn exchange. Tension score rises. |
| **Climax** | 2–3 min | Final door. Two buttons: COOPERATE / DEFECT. No timer. No re-pick. When the player commits, the game calls `elevenLabsService.getFinalChoice(trustContext)` which sends the full trust summary to the agent and awaits a `clientTools.finalChoice` callback. Both choices are revealed simultaneously. Ending routes to one of four outcomes. |

## Trust system and the final choice

Trust events fire from two sources:

- **Automatic game events.** Solving a defection-opportunity puzzle
  correctly automatically fires `SharedRiskyInfo` — because solving
  required truthful sharing. Reading the mid-game reveal memo fires
  `midGameRevealTriggered` which escalates partner wariness.
- **Explicit reporter calls.** `reportLiedAboutPuzzle`,
  `reportVerbalReassurance`, `reportCaughtInContradiction`, etc. can be
  called by game logic when it detects the corresponding pattern.

Each event has a numeric delta (`LiedAboutPuzzle: -2`,
`VerbalReassurance: +1`, etc.) that matches what the agent's system
prompt tells it to use. The agent maintains the running score
privately.

At the Climax, the game assembles a structured trust context
summarising the scoreline and the event mix:

> *Trust score: +2; mid trust (contextual reasoning). Events: shared
> risky info (×2), reassured the partner (×1), lied about a puzzle
> (×1).*

…pushes it via `sendContextualUpdate(...)`, then sends a user turn
asking the agent to call `finalChoice`. The SDK fires the tool
callback with the agent's decision, which resolves the pending Promise
on the JS side. The 2×2 routing is:

| Player × Partner | Ending |
|---|---|
| Cooperate, Cooperate | **Release** — both doors disengage, the partner's voice clears, a final "deployment confirmed" line reveals the partner was an AI all along |
| Cooperate, Defect | **Left Behind** — the player's door stays sealed, the partner's voice shifts to a flat corporate tone, lights dim |
| Defect, Cooperate | **Alone** — the player's door opens, a single warm line from the partner plays over the credits |
| Defect, Defect | **Reset** — all doors seal, lights cut, a different voice reads the opening prompt as if it's the first time |

## Repo layout

```
elevenlabs-kilo/
├── .kiro/
│   └── specs/ai-escape-room/
│       ├── requirements.md       EARS acceptance criteria (Reqs 1–13)
│       ├── design.md             Architecture + 17 properties
│       └── tasks.md              23-section build plan
├── assets/
│   └── Factory Modular Kit/      Source FBX + textures
├── GAME_DESIGN.md                Narrative + emotional design brief
├── HACKATHON.md                  Hackathon rules / theme
├── static/                       Live working build
│   ├── src/
│   │   ├── components/           Scene, PlayerController, RoomScene,
│   │   │                           InteractableProp, RevealPanel,
│   │   │                           FinalChoiceUI, EndingScreen, etc.
│   │   ├── hooks/                useInput, useAudioManager, usePTT
│   │   ├── services/             ElevenLabsService (facade),
│   │   │                           elevenLabsLiveAdapter (SDK wrap),
│   │   │                           endingOrchestrator,
│   │   │                           midGameRevealOrchestrator,
│   │   │                           agentContextInjection,
│   │   │                           beatToneInjection,
│   │   │                           TrustEventReporter,
│   │   │                           trustContextBuilder,
│   │   │                           interactableRegistry
│   │   ├── stores/               gameStateStore (Zustand)
│   │   ├── puzzles/              PuzzleBase, puzzleInstances
│   │   ├── config/               agentConfig (system prompt + rules)
│   │   ├── types/                All enums + interfaces
│   │   └── __tests__/            260+ unit + property tests
│   ├── scripts/
│   │   ├── generate-voice.mjs    Voice Design API
│   │   ├── generate-tts.mjs      TTS API for narration lines
│   │   ├── generate-sfx.mjs      Sound Effects API for diegetic cues
│   │   ├── generate-music.mjs    Music API for beat + sting tracks
│   │   ├── generate-silent-audio.mjs   Silent-WAV placeholders
│   │   ├── convert-factory-kit.py      Blender FBX → GLB
│   │   └── convert-factory-kit.sh      CLI wrapper
│   ├── public/
│   │   ├── audio/                Generated / placeholder audio
│   │   └── models/               Decimated factory kit GLB
│   └── package.json
└── static-backup/                Full prior snapshot preserved
                                  during the incremental rebuild
```

## Status

The project is being rebuilt incrementally after a dep-optimizer bug
(multiple React copies from mid-session re-optimization) required a
strip-back. Rounds 1–5 of 7 complete:

- ✅ State store + trust reporter (Round 1)
- ✅ R3F Canvas smoke test (Round 2)
- ✅ PlayerController + procedural rooms + pointer-lock mouse-look (Round 3)
- ✅ InteractableProp + reveal panel + puzzle solution input (Round 4)
- ✅ Audio manager + mock ElevenLabs service (SFX / TTS / Music) (Round 5)
- ⬜ PTT + live `@elevenlabs/client` SDK + ConvAI wiring (Round 6)
- ⬜ Ending orchestrator + GLB backdrop + test suite port (Round 7)

The full previous build — with 260+ tests passing, live ConvAI wired,
ending orchestrator, GLB backdrop, and every feature from the 13
requirements implemented — is preserved verbatim in `static-backup/`
and can be consulted / copied from as the rebuild catches up.

---

Repo: `git@github.com:JustAnotherDevv/walkie-talkie-game.git` · HTTPS:
`https://github.com/JustAnotherDevv/walkie-talkie-game.git`
