// Narrative beat enum - tracks the current story state
// Validates: Requirements 11.1, 11.2
export enum NarrativeBeat {
  Opening = 'Opening',   // ~1 min: wake, first contact, tutorial puzzle
  Rising = 'Rising',     // ~4-5 min: puzzles 2-3, first defection opportunity
  Midpoint = 'Midpoint', // ~2-3 min: mid-game reveal, stakes change
  Climb = 'Climb',       // ~3-4 min: hardest puzzle, second defection opportunity
  Climax = 'Climax',     // ~2-3 min: final choice, ending
}
