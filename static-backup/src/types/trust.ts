// Trust event type enum - discrete actions that affect trust score
// Validates: Requirements 6.1-6.6
export enum TrustEventType {
  LiedAboutPuzzle = 'LiedAboutPuzzle',        // -ve: player stated false info
  WithheldInfo = 'WithheldInfo',              // -ve: player ignored explicit request
  SharedRiskyInfo = 'SharedRiskyInfo',        // +ve: player revealed disadvantageous info
  CaughtInContradiction = 'CaughtInContradiction', // -ve: partner caught inconsistency
  VerbalReassurance = 'VerbalReassurance',    // +ve: emotional engagement or promise
  BrokePromise = 'BrokePromise',              // -ve: player broke earlier commitment
}
