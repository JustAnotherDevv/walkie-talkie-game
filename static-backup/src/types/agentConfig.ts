// Conversational AI agent configuration
// Validates: Requirements 3.1, 3.3, 6.1, 8.4
export interface ConversationalAIAgentConfig {
  systemPrompt: string              // partner persona, trust rules, decision rules
  initialMemory: string             // partner's "room" knowledge base
  voiceId: string                   // Voice Design artifact ID
  trustScoreInstructions: string    // how to update and use trust score
  finalChoiceInstructions: string   // decision rules for cooperate/defect
}
