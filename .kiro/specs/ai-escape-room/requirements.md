# Requirements Document

## Introduction

*Static* is a 3D first-person cooperative escape room game built for the Kiro × ElevenLabs Hackathon. The player is trapped in a locked facility and must escape by communicating via push-to-talk voice with an AI partner on the other end of a walkie-talkie. Puzzles are interlocked — neither side can solve them alone. A hidden trust system tracks player behavior throughout the playthrough, culminating in a simultaneous prisoner's dilemma choice that determines one of four distinct endings. The partner's voice, dialogue, and final cooperate/defect decision are all powered by ElevenLabs APIs.

Target playthrough length: 10–15 minutes. Platform: Unity (desktop) or Three.js web build.

---

## Glossary

- **Game**: The complete *Static* application, including all scenes, systems, and integrations.
- **Player**: The human user controlling the first-person protagonist.
- **Partner**: The AI-driven character the Player communicates with via walkie-talkie, powered by ElevenLabs Conversational AI.
- **Room**: A discrete 3D space the Player can explore, containing interactable props and puzzle elements.
- **Puzzle**: An interlocked challenge requiring information exchange between Player and Partner to solve.
- **Push-to-Talk**: The input mode where the Player holds the `V` key to transmit voice to the Partner.
- **Conversational_AI**: The ElevenLabs Conversational AI pipeline (STT → LLM → TTS) that drives Partner responses.
- **Trust_Score**: A hidden numeric value maintained in the Partner's memory that tracks Player trustworthiness across the playthrough.
- **Trust_Event**: A discrete in-game action or statement that raises or lowers the Trust_Score.
- **Mid_Game_Reveal**: The narrative beat where the Player discovers evidence suggesting only one exit code works.
- **Final_Choice**: The simultaneous cooperate/defect decision made independently by Player and Partner at the end of the game.
- **Ending**: One of four distinct narrative outcomes determined by the 2×2 matrix of Player and Partner choices.
- **Voice_Design**: The ElevenLabs Voice Design API used to generate the Partner's ultra-realistic elderly male voice.
- **TTS**: ElevenLabs Text-to-Speech API used for pre-generated narration and ending lines.
- **Sound_Effects_API**: The ElevenLabs Sound Effects API used to generate diegetic audio cues.
- **Defection_Opportunity**: A puzzle or narrative moment where the Player can choose to lie, withhold, or mislead the Partner.
- **Intercom**: The in-world audio device through which the Partner's voice is heard.
- **Exit_Code**: The code or action that unlocks the final door and triggers an ending.

---

## Requirements

### Requirement 1: First-Person 3D Environment

**User Story:** As a Player, I want to explore a 3D first-person environment, so that I feel physically trapped and immersed in the escape room setting.

#### Acceptance Criteria

1. THE Game SHALL render a first-person 3D perspective using WASD movement and mouse-look controls.
2. THE Game SHALL provide 2–3 connected Rooms built from pre-existing asset packs, requiring no original 3D modeling.
3. WHEN the Player approaches an interactable prop, THE Game SHALL display a contextual interaction prompt.
4. WHEN the Player presses the interact key on an eligible prop, THE Game SHALL reveal the prop's puzzle-relevant content (text, symbol, number, or object state).
5. THE Game SHALL gate each Room transition behind a Puzzle that requires Partner input to solve.
6. IF the Player attempts to open a gated door before its Puzzle is solved, THEN THE Game SHALL keep the door locked and play a locked-door audio cue.

---

### Requirement 2: Push-to-Talk Communication

**User Story:** As a Player, I want to speak into a microphone and have my voice transmitted to the Partner, so that verbal communication is the primary mechanic for solving puzzles.

#### Acceptance Criteria

1. WHEN the Player holds the `V` key, THE Game SHALL activate the microphone and begin transmitting audio to the Conversational_AI pipeline.
2. WHEN the Player releases the `V` key, THE Game SHALL stop transmitting and await the Partner's response.
3. WHILE the Player is transmitting, THE Game SHALL display a visible push-to-talk indicator in the UI.
4. THE Game SHALL play a radio static audio cue at the start and end of each transmission to mask STT/LLM/TTS latency and maintain diegetic immersion.
5. IF the microphone is unavailable or permission is denied, THEN THE Game SHALL display an error message and offer a text-input fallback.
6. THE Game SHALL ensure the Partner only receives audio transmitted during an active push-to-talk session, not ambient room audio.

---

### Requirement 3: AI Partner via ElevenLabs Conversational AI

**User Story:** As a Player, I want the Partner to respond intelligently to what I describe, so that the cooperative puzzle-solving feels genuinely interactive and not scripted.

#### Acceptance Criteria

1. THE Conversational_AI SHALL process each Player transmission through a speech-to-text, LLM reasoning, and text-to-speech pipeline and return a spoken response.
2. THE Partner SHALL maintain persistent memory of all prior exchanges within a single playthrough session.
3. WHEN the Player describes a puzzle element, THE Partner SHALL respond with contextually relevant information from the Partner's knowledge base.
4. THE Partner SHALL speak using the Voice_Design-generated ultra-realistic elderly male voice in all Conversational_AI responses.
5. WHEN the Partner references something the Player said earlier in the session, THE Conversational_AI SHALL retrieve and incorporate that prior context accurately.
6. IF the Conversational_AI API call fails or times out after 10 seconds, THEN THE Game SHALL play a static-burst audio cue and display a "signal lost" message, then retry the request once before surfacing an error state.
7. THE Partner SHALL stay in character as a fellow trapped human throughout the playthrough, except in endings where the AI nature is revealed.

---

### Requirement 4: Partner Voice via ElevenLabs Voice Design

**User Story:** As a Player, I want the Partner to have a distinctive, ultra-realistic voice, so that the character feels human and the eventual AI reveal is emotionally impactful.

#### Acceptance Criteria

1. THE Game SHALL generate the Partner's voice using the ElevenLabs Voice_Design API with a prompt specifying an ultra-realistic elderly male voice: weary, gravelly, measured, late 60s–70s, American or transatlantic accent, with subtle breathing and mid-sentence pauses.
2. THE Voice_Design-generated voice SHALL be used consistently across all Conversational_AI responses, TTS narration, and pre-generated ending lines.
3. THE Game SHALL not use a default ElevenLabs preset voice for the Partner; the Voice_Design-generated voice is the required artifact.
4. WHERE the Voice_Design API produces a voice that does not match the target profile, THE Game SHALL allow the voice prompt to be iterated and regenerated before the build is finalized.

---

### Requirement 5: Interlocked Puzzle System

**User Story:** As a Player, I want each puzzle to require information from the Partner that I cannot obtain on my own, so that communication is mechanically necessary and not optional.

#### Acceptance Criteria

1. THE Game SHALL include 4–5 Puzzles across the playthrough, each requiring at least one exchange of information between Player and Partner to solve.
2. WHEN a Puzzle is solved correctly, THE Game SHALL unlock the associated door or progress trigger within 1 second.
3. IF the Player submits an incorrect solution to a Puzzle, THEN THE Game SHALL provide a failure feedback cue (audio + visual) and allow the Player to attempt again without penalty.
4. THE Game SHALL include at least one Puzzle of each of the following archetypes: symbol correlation, split combination, and descriptive match.
5. THE Game SHALL include 2 Defection_Opportunity Puzzles where the Player can choose to lie or withhold information from the Partner.
6. WHEN a Defection_Opportunity Puzzle is encountered, THE Partner SHALL have no independent means of verifying the Player's stated information.
7. THE Game SHALL ensure no Puzzle is solvable by the Player without Partner input, even if the Player has explored all available props.

---

### Requirement 6: Trust System

**User Story:** As a Player, I want my behavior toward the Partner to have hidden consequences, so that the final choice feels earned and the AI's decision feels genuinely reasoned.

#### Acceptance Criteria

1. THE Game SHALL maintain a Trust_Score as a hidden numeric value within the Partner's Conversational_AI memory, not displayed in the Player-facing UI at any point during gameplay.
2. WHEN the Player provides false information during a Defection_Opportunity, THE Conversational_AI SHALL record a negative Trust_Event and decrease the Trust_Score.
3. WHEN the Player withholds information the Partner explicitly requested, THE Conversational_AI SHALL record a negative Trust_Event and decrease the Trust_Score.
4. WHEN the Player shares information that is risky or disadvantageous to reveal, THE Conversational_AI SHALL record a positive Trust_Event and increase the Trust_Score.
5. WHEN the Partner catches the Player in a contradiction with a prior statement, THE Conversational_AI SHALL record a negative Trust_Event and decrease the Trust_Score.
6. WHEN the Player provides verbal reassurance or emotional engagement, THE Conversational_AI SHALL record a positive Trust_Event and increase the Trust_Score.
7. THE Conversational_AI SHALL use the accumulated Trust_Score as a primary input when reasoning about the Final_Choice.
8. WHILE the Trust_Score is below a defined low threshold, THE Partner SHALL subtly shift tone toward wariness in responses, without explicitly stating distrust.
9. THE Trust_Score SHALL persist for the entire playthrough session and SHALL NOT reset between Rooms.

---

### Requirement 7: Mid-Game Reveal

**User Story:** As a Player, I want to discover evidence mid-game that only one of us can escape, so that the cooperative dynamic becomes dramatically charged and the final choice carries real weight.

#### Acceptance Criteria

1. THE Game SHALL place a discoverable prop (note, log, or recording) in Room 2 or Room 3 that contains the Mid_Game_Reveal: evidence suggesting only one Exit_Code is valid.
2. WHEN the Player interacts with the Mid_Game_Reveal prop, THE Game SHALL trigger the Partner to react audibly via the Intercom, acknowledging the discovery.
3. WHEN the Mid_Game_Reveal is triggered, THE Partner SHALL ask the Player what they intend to do, using the Conversational_AI pipeline.
4. THE Game SHALL not confirm or deny whether the Mid_Game_Reveal evidence is true within the game world, preserving ambiguity.
5. WHEN the Mid_Game_Reveal is triggered, THE Game SHALL escalate the ambient audio tension (increased static, music introduction) to signal a tonal shift.

---

### Requirement 8: Final Choice — Prisoner's Dilemma

**User Story:** As a Player, I want to make a simultaneous cooperate/defect choice with the Partner at the end of the game, so that the entire playthrough's trust arc resolves in a single high-stakes moment.

#### Acceptance Criteria

1. THE Game SHALL present the Player with a diegetic UI at the final door containing exactly two choices: COOPERATE and DEFECT.
2. THE Game SHALL not impose a time limit on the Player's Final_Choice; the decision is psychological, not clock-based.
3. WHEN the Player locks in a Final_Choice, THE Game SHALL simultaneously request the Partner's Final_Choice from the Conversational_AI.
4. THE Conversational_AI SHALL reason over the full conversation history and Trust_Score to determine the Partner's Final_Choice; the choice SHALL NOT be scripted or random.
5. THE Game SHALL reveal both choices simultaneously after both are locked in, with no intermediate disclosure.
6. THE Game SHALL route to one of four Endings based on the 2×2 matrix of Player choice and Partner choice.
7. IF the Trust_Score is below the low threshold at the time of the Final_Choice, THEN THE Conversational_AI SHALL bias the Partner's decision toward DEFECT.
8. IF the Trust_Score is above the high threshold at the time of the Final_Choice, THEN THE Conversational_AI SHALL bias the Partner's decision toward COOPERATE.
9. WHILE the Trust_Score is between the low and high thresholds, THE Conversational_AI SHALL apply contextual reasoning (e.g., emotional engagement, mid-game promises, contradiction history) to determine the Partner's Final_Choice.

---

### Requirement 9: Four Distinct Endings

**User Story:** As a Player, I want each possible outcome of the prisoner's dilemma to deliver a distinct emotional experience, so that the game's themes of trust and betrayal land with full impact.

#### Acceptance Criteria

1. THE Game SHALL implement all four Endings corresponding to the cooperate/defect matrix: "Release" (both cooperate), "Left Behind" (Player cooperates, Partner defects), "Alone" (Player defects, Partner cooperates), and "Reset" (both defect).
2. WHEN the "Release" Ending is triggered, THE Game SHALL reveal that the Partner is an AI and that the Exit_Code was a deployment trigger, using pre-generated TTS narration in the Partner's voice.
3. WHEN the "Left Behind" Ending is triggered, THE Game SHALL lock the Player's door, play the Partner's deployment confirmation via TTS, and transition the Partner's voice to a calm, corporate tone.
4. WHEN the "Alone" Ending is triggered, THE Game SHALL allow the Player to escape while playing the Partner's final warm voice line via TTS over the credits.
5. WHEN the "Reset" Ending is triggered, THE Game SHALL seal all doors, cut the lights, and replay the opening tutorial prompt with a new voice on the Intercom, implying the cycle has restarted.
6. THE Game SHALL use pre-generated TTS lines (via the ElevenLabs TTS API) for all Ending narration, using the Voice_Design-generated voice for Partner lines.
7. THE Game SHALL display a distinct ending screen for each of the four Endings before returning to the title screen.

---

### Requirement 10: ElevenLabs Audio Integration

**User Story:** As a developer, I want all audio — voice, effects, and music — to be generated or delivered via ElevenLabs APIs, so that the submission demonstrates maximum breadth of ElevenLabs integration.

#### Acceptance Criteria

1. THE Game SHALL use the ElevenLabs Voice_Design API to generate the Partner's voice before the build is finalized.
2. THE Game SHALL use the ElevenLabs Conversational_AI API for all real-time Partner dialogue during gameplay.
3. THE Game SHALL use the ElevenLabs TTS API for all pre-generated narration, including the opening monologue, intercom announcements, and all four Ending narration lines.
4. THE Game SHALL use the ElevenLabs Sound_Effects_API to generate diegetic audio cues including: door lock/unlock sounds, radio static bursts, object interaction sounds, and the cooperate/defect button click.
5. THE Game SHALL use the ElevenLabs Music API (or Sound_Effects_API) to generate a procedural tension score that escalates across the five narrative beats and includes distinct stings for each Ending.
6. IF an ElevenLabs API call for pre-generated audio fails during the build process, THEN THE Game SHALL surface a build error identifying the failed asset so it can be regenerated before release.

---

### Requirement 11: Game Progression and State Management

**User Story:** As a Player, I want the game to track my progress through the narrative beats, so that the pacing, puzzle gating, and trust events are correctly sequenced.

#### Acceptance Criteria

1. THE Game SHALL track the current narrative beat (Opening, Rising, Midpoint, Climb, Climax) as a discrete game state.
2. WHEN all Puzzles in the current beat are solved, THE Game SHALL advance the game state to the next beat.
3. THE Game SHALL not allow the Player to access a later Room before completing the Puzzle gating the transition to that Room.
4. THE Game SHALL not include a save or checkpoint system; each playthrough is a single continuous session.
5. WHEN the Player reaches the Climax beat, THE Game SHALL present the Final_Choice UI and initiate the ending sequence.
6. THE Game SHALL display a title screen before the game begins and an ending screen after each Ending resolves.
7. IF the Player closes the application before reaching an Ending, THEN THE Game SHALL not persist any session state; the next launch SHALL begin a fresh playthrough.

---

### Requirement 12: Audio Atmosphere and Diegetic Sound Design

**User Story:** As a Player, I want the audio environment to reinforce the psychological thriller tone, so that the dread and intimacy of the setting feel visceral throughout the playthrough.

#### Acceptance Criteria

1. THE Game SHALL play a sparse ambient soundscape (fluorescent hum, distant mechanical thumps) throughout all Rooms.
2. THE Game SHALL layer radio static over all Partner dialogue delivered via the Intercom.
3. WHILE the game state is Opening or Rising, THE Game SHALL keep background music absent or at near-zero volume.
4. WHEN the game state advances to Midpoint, THE Game SHALL begin introducing background music at low volume.
5. WHEN the game state advances to Climb, THE Game SHALL increase background music volume and tension.
6. WHEN the game state advances to Climax, THE Game SHALL play the full tension score.
7. WHEN an Ending is triggered, THE Game SHALL transition to the Ending-specific audio sting.
8. THE Game SHALL play a distinct tactile SFX cue for every Player interaction with a prop or puzzle element.

---

### Requirement 13: Title Screen and Onboarding

**User Story:** As a Player, I want a clear title screen and brief onboarding, so that I understand the controls and premise before the game begins.

#### Acceptance Criteria

1. THE Game SHALL display a title screen with the game title and a start prompt before any gameplay begins.
2. WHEN the Player starts the game, THE Game SHALL play an opening monologue (pre-generated TTS) establishing the premise before the first Intercom contact.
3. THE Game SHALL include a tutorial Puzzle in the Opening beat that teaches the push-to-talk mechanic through play, without a separate tutorial screen.
4. THE Game SHALL display the push-to-talk key binding (`V`) in the HUD throughout the playthrough.
5. THE Game SHALL display basic movement controls (WASD + mouse-look) on the title screen or during the opening sequence.
