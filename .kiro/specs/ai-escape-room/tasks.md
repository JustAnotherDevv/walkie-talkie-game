# Implementation Plan: Static — AI Escape Room

## Overview

Implement *Static* as a Vite + React + TypeScript web application with Three.js and React Three Fiber for 3D rendering. Tasks are ordered to build a runnable skeleton first, then layer in puzzles, trust, ElevenLabs integration, and endings. fast-check is used for property-based tests. All 17 design properties have corresponding test sub-tasks.

## Tasks

- [x] 1. Project setup and core architecture
  - Create Vite + React + TypeScript project: `npm create vite@latest static -- --template react-ts`
  - Install dependencies: `npm install three @react-three/fiber @react-three/drei zustand`
  - Install dev dependencies: `npm install -D vitest @vitest/ui fast-check`
  - Create folder structure: `src/components`, `src/hooks`, `src/stores`, `src/services`, `src/types`, `src/utils`, `src/assets/audio`, `src/__tests__`
  - Define all enums in `src/types/`: `NarrativeBeat`, `FinalChoice`, `EndingType`, `TrustEventType`, `PuzzleArchetype`, `SFXKey`
  - Define all data model interfaces in `src/types/`: `PuzzleDefinition`, `Room`, `Prop`, `ConversationalAIAgentConfig`, `ElevenLabsError`, `AudioAssetManifest`
  - Create stub Zustand store `useGameStateStore` with `currentBeat`, `solvedPuzzleCount`, `advanceBeat()`, `triggerMidGameReveal()`, `triggerFinalChoice()`, and events
  - _Requirements: 11.1, 11.2_

- [x] 2. Input and player controller
  - [x] 2.1 Implement `useInput` hook with `onMoveInput`, `onLookInput`, `onInteractPressed`, `onPTTPressed`, `onPTTReleased`, `onFinalChoiceSelected` callbacks; bind `V` key for PTT and `E` for interact
    - _Requirements: 2.1, 2.2, 8.1_
  - [x] 2.2 Implement `PlayerController` R3F component with WASD movement, mouse-look via `useThree` and `useFrame`, `tryInteract()` raycast against `IInteractable` objects, and `movementEnabled` state
    - _Requirements: 1.1_
  - [x] 2.3 Write unit tests for `useInput` PTT state transitions
    - Verify `onPTTPressed` fires on V-down and `onPTTReleased` fires on V-up
    - _Requirements: 2.1, 2.2_

- [x] 3. Interactable prop system
  - [x] 3.1 Define `IInteractable` interface in `src/types/interactable.ts` with `interact()`, `getPromptText()`, `isInteractable`
    - _Requirements: 1.3, 1.4_
  - [x] 3.2 Implement `InteractableProp` R3F component: stores `revealContent`, `isMidGameRevealProp`, `puzzleId`; `interact()` reveals content and fires event; `isInteractable` returns true within range
    - _Requirements: 1.3, 1.4_
  - [x] 3.3 Write property test for interaction prompt visibility (Property 1)
    - **Property 1: Interaction prompt visibility**
    - **Validates: Requirements 1.3**
    - For any prop and player position, prompt visible iff player within interaction range
  - [x] 3.4 Write property test for prop reveal on interact (Property 2)
    - **Property 2: Prop reveal on interact**
    - **Validates: Requirements 1.4**
    - For any interactable prop in default state, `interact()` yields non-empty reveal content

- [x] 4. Room and door gating system
  - [x] 4.1 Implement `useRoomManager` hook with `rooms: Room[]`, `currentRoomIndex`, `tryUnlockDoor(roomIndex)`, `onDoorAttemptedWhileLocked` event; door stays locked until gating puzzle is solved
    - _Requirements: 1.5, 1.6, 11.3_
  - [x] 4.2 Load Factory Modular Kit GLB (convert FBX to GLB via Blender or gltf-transform); assemble 3 connected rooms in the R3F scene using kit pieces; place door meshes at each room transition
    - _Requirements: 1.2_
  - [x] 4.3 Write property test for door gating invariant (Property 3)
    - **Property 3: Door gating invariant**
    - **Validates: Requirements 1.5, 1.6, 11.3**
    - For any room, door locked iff gating puzzle unsolved; solving puzzle unlocks door; never unlocked while unsolved

- [x] 5. Puzzle system core
  - [x] 5.1 Define `IPuzzle` interface and implement `PuzzleBase` class with `puzzleId`, `isDefectionOpportunity`, `isSolved`, `trySubmitSolution(input)` (hash-compare), `getPartnerKnowledge()`
    - _Requirements: 5.1, 5.2, 5.3_
  - [x] 5.2 Implement `usePuzzleSystem` hook: holds `Map<string, IPuzzle>`, exposes `getPuzzle(id)`, fires `onPuzzleSolved` and `onPuzzleFailed` events; wire `onPuzzleSolved` → `tryUnlockDoor` and `advanceBeat`
    - _Requirements: 5.2, 11.2_
  - [x] 5.3 Write property test for puzzle structural completeness (Property 5)
    - **Property 5: Puzzle structural completeness**
    - **Validates: Requirements 5.1, 5.7**
    - For any puzzle in the set, `partnerKnowledge` non-empty, `correctSolution` non-empty, `roomId` valid, `narrativeBeat` valid
  - [x] 5.4 Write property test for correct solution unlocks puzzle (Property 6)
    - **Property 6: Correct solution unlocks puzzle**
    - **Validates: Requirements 5.2**
    - For any puzzle, submitting correct solution → `isSolved = true` and door unlocked within 1 second
  - [x] 5.5 Write property test for incorrect solution preserves state (Property 7)
    - **Property 7: Incorrect solution preserves puzzle state**
    - **Validates: Requirements 5.3**
    - For any puzzle and any non-matching string, `isSolved` remains false, no state penalty
  - [x] 5.6 Write property test for required puzzle archetypes (Property 8)
    - **Property 8: Required puzzle archetypes present**
    - **Validates: Requirements 5.4, 5.5**
    - Puzzle set contains ≥1 SymbolCorrelation, ≥1 SplitCombination, ≥1 DescriptiveMatch, exactly 2 with `isDefectionOpportunity = true`
  - [x] 5.7 Write property test for defection opportunity puzzles unverifiable (Property 9)
    - **Property 9: Defection opportunity puzzles are unverifiable by partner**
    - **Validates: Requirements 5.6**
    - For any puzzle with `isDefectionOpportunity = true`, `partnerKnowledge` does not contain `correctSolution`

- [x] 6. Checkpoint — core systems wired
  - Ensure all tests pass, ask the user if questions arise.
  - Verify: player can move through rooms, interact with props, submit puzzle solutions, and doors gate correctly.

- [x] 7. Implement the five puzzle instances
  - [x] 7.1 Implement Puzzle 1 (Opening beat — SymbolCorrelation, tutorial): place player-side glyph prop in Room 1; encode partner knowledge with matching glyph-to-key mapping; solution is the key label
    - _Requirements: 5.1, 5.4, 13.3_
  - [x] 7.2 Implement Puzzle 2 (Rising beat — SplitCombination, first defection opportunity): place two-digit note prop in Room 1; partner knowledge holds the other two digits; `isDefectionOpportunity = true`; player can lie about their digits
    - _Requirements: 5.1, 5.4, 5.5, 6.2_
  - [x] 7.3 Implement Puzzle 3 (Rising beat — DescriptiveMatch): place matching object in Room 2; partner knowledge describes the target object; solution is the object's label
    - _Requirements: 5.1, 5.4_
  - [x] 7.4 Implement Puzzle 4 (Climb beat — multi-turn, second defection opportunity): place ordered-sequence props in Room 2; partner knowledge holds the correct order; `isDefectionOpportunity = true`; requires multiple exchanges
    - _Requirements: 5.1, 5.5, 6.2_
  - [x] 7.5 Place mid-game reveal prop in Room 2 with `isMidGameRevealProp = true`; content is the "only one exit code works" note; wire `InteractableProp.onInteracted` → `triggerMidGameReveal()`
    - _Requirements: 7.1, 7.2_
  - [x] 7.6 Write property test for mid-game reveal prop placement (Property 12)
    - **Property 12: Mid-game reveal prop placement**
    - **Validates: Requirements 7.1**
    - Exactly one prop has `isMidGameRevealProp = true`; that prop is in room 2 or room 3

- [x] 8. Trust event reporter
  - [x] 8.1 Implement `TrustEventReporter` class with `reportEvent(type, detail)` that formats a structured message and injects it into the ConvAI agent context via `ElevenLabsService`; wire defection-opportunity puzzle outcomes and verbal reassurance detection to the reporter
    - _Requirements: 6.1, 6.2, 6.3, 6.4, 6.5, 6.6_
  - [x] 8.2 Write property test for trust events reported for player actions (Property 10)
    - **Property 10: Trust events are reported for player actions**
    - **Validates: Requirements 6.2, 6.3, 6.4, 6.6**
    - For each trust event type, the corresponding `TrustEventType` is reported; no event type is silently dropped
  - [x] 8.3 Write property test for trust accumulation across rooms (Property 11)
    - **Property 11: Trust events accumulate across rooms without reset**
    - **Validates: Requirements 6.9**
    - For any sequence of trust events spanning room transitions, all events present in agent context after transition; context never cleared between rooms

- [x] 9. Narrative beat state machine
  - [x] 9.1 Complete `useGameStateStore` beat state machine: `advanceBeat()` increments `currentBeat` in order (Opening → Rising → Midpoint → Climb → Climax), fires `onBeatChanged`; beat never regresses; `triggerMidGameReveal()` fires when mid-game reveal prop is interacted; `triggerFinalChoice()` fires when Climax beat is reached and all puzzles solved
    - _Requirements: 11.1, 11.2, 11.5_
  - [x] 9.2 Write property test for narrative beat advances monotonically (Property 16)
    - **Property 16: Narrative beat advances monotonically**
    - **Validates: Requirements 11.1, 11.2**
    - For any sequence of puzzle completion events, `currentBeat` only advances forward; never regresses; always a valid `NarrativeBeat`

- [x] 10. ElevenLabs service facade
  - [x] 10.1 Implement `ElevenLabsService` class with `apiKey`, `agentId`, `partnerVoiceId` fields; implement `startConversationSession()`, `sendPTTAudio(audioBlob)` → returns partner `Blob`, `getFinalChoice(trustContext)` → returns `FinalChoice`, `playTTSLine(lineKey)` → returns `Blob` from pre-generated cache; implement `onPartnerResponseReady` and `onAPIError` events
    - _Requirements: 3.1, 3.2, 8.3, 10.2_
  - [x] 10.2 Implement ConvAI timeout (10 s): on timeout play static-burst SFX, show "signal lost" UI, retry once; on second failure surface error state
    - _Requirements: 3.6_
  - [x] 10.3 Implement `AudioAssetManifest` loader: fetches manifest JSON at startup, loads pre-generated TTS files, SFX files, music tracks, and ending stings into memory; surface build error if any asset key is missing
    - _Requirements: 10.3, 10.4, 10.5, 10.6_
  - [x] 10.4 Implement microphone unavailability fallback: on PTT press with no mic, show HUD error and activate text-input field; text input sends typed text as a text turn to ConvAI
    - _Requirements: 2.5_
  - [x] 10.5 Write integration tests for `ElevenLabsService` with mocked SDK
    - Verify ConvAI called for runtime dialogue, TTS for pre-generated lines, SFX for diegetic cues, Music for tension score
    - Verify session initialised with correct `voiceId` and system prompt
    - Verify `getFinalChoice` includes conversation history and trust context
    - Verify API errors trigger correct fallback behaviour
    - _Requirements: 3.1, 3.4, 8.3, 10.1–10.5_

- [x] 11. Push-to-talk pipeline
  - [x] 11.1 Wire `useInput.onPTTPressed` → start microphone capture via MediaRecorder API; `onPTTReleased` → stop capture and call `elevenLabsService.sendPTTAudio()`; only frames captured during PTT-active window are included in the audio blob sent to ConvAI
    - _Requirements: 2.1, 2.2, 2.6_
  - [x] 11.2 Play radio static SFX at PTT start and end (from `AudioAssetManifest`); show PTT indicator in HUD while transmitting; hide on release
    - _Requirements: 2.3, 2.4_
  - [x] 11.3 Write property test for PTT audio filtering (Property 4)
    - **Property 4: PTT audio filtering**
    - **Validates: Requirements 2.6**
    - For any sequence of PTT state changes and audio frames, only frames during PTT-active periods are forwarded; no ambient frames transmitted

- [x] 12. Checkpoint — ElevenLabs integration and PTT working
  - Ensure all tests pass, ask the user if questions arise.
  - Verify: PTT transmits audio to ConvAI, partner responds via intercom, trust events are injected, manifest loads cleanly.

- [x] 13. Audio manager and atmosphere
  - [x] 13.1 Implement `useAudioManager` hook with `ambientSource`, `musicSource`, `sfxSource`, `intercomSource` Audio elements; implement `playSFX(key)`, `setMusicBeat(beat)`, `playPartnerResponse(blob)`, `playTTSLine(blob)`, `setIntercomActive(bool)`; apply radio filter via Web Audio API on intercom
    - _Requirements: 12.1, 12.2_
  - [x] 13.2 Wire `useGameStateStore.onBeatChanged` → `setMusicBeat(beat)`: music absent/near-zero at Opening/Rising; low volume at Midpoint; increased at Climb; full tension at Climax; ending sting on `onGameEnded`
    - _Requirements: 12.3, 12.4, 12.5, 12.6, 12.7_
  - [x] 13.3 Wire `InteractableProp.onInteracted` → `playSFX(SFXKey.Interact)` for every prop; wire locked-door attempt → `playSFX(SFXKey.DoorLocked)`
    - _Requirements: 1.6, 12.8_
  - [x] 13.4 Write property test for audio state matching narrative beat (Property 17)
    - **Property 17: Audio state matches narrative beat**
    - **Validates: Requirements 12.3, 12.4, 12.5, 12.6**
    - For any narrative beat, `AudioManager` music volume and ambient config match expected state for that beat

- [x] 14. UI components
  - [x] 14.1 Implement UI components: `InteractionPrompt`, `PTTIndicator`, `SignalLostMessage`, `FinalChoiceUI`, `EndingScreen`, `TitleScreen`
    - _Requirements: 2.3, 8.1, 9.7, 13.1_
  - [x] 14.2 Build title screen: game title, start prompt, WASD + mouse-look control hints; wire start button → begin opening monologue TTS then first intercom contact
    - _Requirements: 13.1, 13.5_
  - [x] 14.3 Build HUD: persistent PTT key binding label (`V`), PTT active indicator, interaction prompt overlay
    - _Requirements: 2.3, 13.4_
  - [x] 14.4 Build final choice UI: diegetic panel at final door with exactly two buttons (COOPERATE / DEFECT); no timer; on selection lock in player choice and call `elevenLabsService.getFinalChoice()`
    - _Requirements: 8.1, 8.2, 8.3_
  - [x] 14.5 Write unit tests for UI state transitions
    - PTT indicator shown on PTT press, hidden on release
    - Final choice UI shown when Climax beat reached
    - Ending screen shown after both choices collected
    - _Requirements: 2.3, 8.1, 8.5_

- [x] 15. Final choice and ending routing
  - [x] 15.1 Implement final choice collection: after player locks in choice, call `elevenLabsService.getFinalChoice(trustContext)`; wait for both choices; route to ending via 2×2 matrix: (Coop, Coop) → `Release`, (Coop, Defect) → `LeftBehind`, (Defect, Coop) → `Alone`, (Defect, Defect) → `Reset`
    - _Requirements: 8.3, 8.5, 8.6, 9.1_
  - [x] 15.2 Write property test for final choice routing correctness (Property 14)
    - **Property 14: Final choice routing correctness**
    - **Validates: Requirements 8.6, 9.1**
    - For all 4 combinations of (PlayerChoice × PartnerChoice), game routes to exactly the correct `EndingType`
  - [x] 15.3 Write property test for both choices collected before reveal (Property 15)
    - **Property 15: Both choices collected before reveal**
    - **Validates: Requirements 8.3, 8.5**
    - Ending screen never shown until both player choice and partner choice are received

- [x] 16. Implement four endings
  - [x] 16.1 Implement `Release` ending: play pre-generated TTS AI-reveal narration via intercom; open both doors; transition partner voice to clear (unfiltered) for final sign-off line; show Release ending screen
    - _Requirements: 9.2, 9.6, 9.7_
  - [x] 16.2 Implement `LeftBehind` ending: keep player door locked; play partner deployment confirmation TTS; shift intercom to calm corporate tone (different audio filter or separate clip); dim lights; show LeftBehind ending screen
    - _Requirements: 9.3, 9.6, 9.7_
  - [x] 16.3 Implement `Alone` ending: unlock player door; play partner's final warm TTS voice line over credits; show Alone ending screen
    - _Requirements: 9.4, 9.6, 9.7_
  - [x] 16.4 Implement `Reset` ending: seal all doors; cut lights; replay opening tutorial prompt with new voice on intercom; show Reset ending screen
    - _Requirements: 9.5, 9.6, 9.7_
  - [x] 16.5 Write unit tests for ending content
    - Each ending plays the correct TTS clip, shows the correct ending screen, and applies the correct door/light state
    - _Requirements: 9.2–9.7_

- [x] 17. Build-time audio asset generation scripts
  - [x] 17.1 Write a Node script (`scripts/generate-voice.ts`) that calls ElevenLabs Voice Design API with the target voice prompt (weary, gravelly, elderly male, late 60s–70s, American/transatlantic, subtle breathing and pauses) and saves the resulting `voiceId` to `src/config/agentConfig.ts`
    - _Requirements: 4.1, 4.2, 4.3, 10.1_
  - [x] 17.2 Write a build-time script that calls ElevenLabs TTS API to pre-generate all narration lines (opening monologue, intercom announcements, all four ending narration variants) using the Voice Design voice ID; save files to `public/audio/tts/` and register in `AudioAssetManifest`; surface build error on any failure
    - _Requirements: 10.3, 10.6_
  - [x] 17.3 Write a build-time script that calls ElevenLabs Sound Effects API to generate all diegetic SFX (door lock, door unlock, radio static burst start, radio static burst end, object interact, cooperate button click, defect button click, locked-door thud); save to `public/audio/sfx/` and register in manifest
    - _Requirements: 10.4, 10.6_
  - [x] 17.4 Write a build-time script that calls ElevenLabs Music API to generate tension score tracks for each narrative beat and four ending stings; save to `public/audio/music/` and register in manifest
    - _Requirements: 10.5, 10.6_

- [x] 18. ConvAI agent configuration
  - [x] 18.1 Write the `ConversationalAIAgentConfig` system prompt: partner persona (weary elderly male, former facility employee, doesn't know he's AI), trust score update instructions (LiedAboutPuzzle −, WithheldInfo −, SharedRiskyInfo +, CaughtInContradiction −, VerbalReassurance +, BrokePromise −), final choice decision rules (low trust → Defect, high trust → Cooperate, mid → contextual reasoning), partner room knowledge base
    - _Requirements: 3.3, 3.7, 6.1–6.9, 8.4, 8.7, 8.8, 8.9_
  - [x] 18.2 Inject per-puzzle `partnerKnowledge` strings into the agent context at the start of each puzzle's narrative beat via `ElevenLabsService`
    - _Requirements: 3.3, 5.1_

- [x] 19. Checkpoint — full playthrough runnable
  - Ensure all tests pass, ask the user if questions arise.
  - Verify: complete playthrough from title screen through all 5 beats to all 4 endings; trust events influence partner final choice; audio escalates correctly across beats.

- [x] 20. Mid-game reveal integration
  - [x] 20.1 Wire `triggerMidGameReveal()` → `elevenLabsService.sendPTTAudio()` with a scripted partner reaction prompt; play partner response via intercom; escalate audio (increase static, introduce music) immediately after reveal
    - _Requirements: 7.2, 7.3, 7.5_
  - [x] 20.2 Write property test for mid-game reveal triggers partner reaction (Property 13)
    - **Property 13: Mid-game reveal triggers partner reaction**
    - **Validates: Requirements 7.2**
    - Interacting with mid-game reveal prop triggers ConvAI response request and audio playback; reaction occurs before player can proceed

- [x] 21. Opening sequence and onboarding
  - [x] 21.1 Wire title screen start → play opening monologue TTS clip → enable player movement → trigger first intercom contact (ConvAI session start with opening line); tutorial puzzle (Puzzle 1) teaches PTT through play
    - _Requirements: 13.2, 13.3_

- [x] 22. Final polish and integration
  - [x] 22.1 Wire `useGameStateStore.onBeatChanged` to update partner tone instructions in ConvAI context (wariness at low trust, escalating urgency at Climb/Climax)
    - _Requirements: 6.8_
  - [x] 22.2 Ensure no save/checkpoint operations exist anywhere in the codebase; verify fresh playthrough on every page load (no localStorage/sessionStorage)
    - _Requirements: 11.4, 11.7_
  - [x] 22.3 Write unit test confirming no save operations
    - Simulate full session; assert no `localStorage`, `sessionStorage`, or IndexedDB calls occur
    - _Requirements: 11.4, 11.7_

- [x] 23. Final checkpoint — all tests pass
  - Ensure all tests pass, ask the user if questions arise.
  - Run full fast-check property suite (minimum 100 iterations per property) and all unit/integration tests before build finalisation.

## Notes

- Sub-tasks marked with `*` are optional and can be skipped for a faster MVP
- All 17 design properties have corresponding property test sub-tasks (Properties 1–17)
- Each property test must include the comment header: `// Feature: ai-escape-room, Property N: [Title]`
- fast-check minimum 100 iterations per property test
- Trust score lives entirely in the ConvAI agent memory — React never reads or writes it directly
- All TTS, SFX, and Music assets are pre-generated at build time; only ConvAI is runtime
- The Factory Modular Kit FBX is at `assets/Factory Modular Kit/source/Modular_factory_v1_0.fbx` — convert to GLB for web
- Run tests with `npm run test` (Vitest)
- Build with `npm run build` → outputs to `dist/`
