// Ending type enum - four distinct narrative outcomes
// Validates: Requirements 9.1
export enum EndingType {
  Release = 'Release',      // both cooperate: AI revealed, both "escape"
  LeftBehind = 'LeftBehind', // player cooperates, AI defects: player trapped
  Alone = 'Alone',          // player defects, AI cooperates: player escapes, AI abandoned
  Reset = 'Reset',          // both defect: facility resets, cycle restarts
}
