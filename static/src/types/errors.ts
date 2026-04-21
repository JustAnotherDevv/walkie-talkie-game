// ElevenLabs error interface
// Validates: Requirements 3.6, 10.6
export interface ElevenLabsError {
  apiName: 'ConversationalAI' | 'TTS' | 'SFX' | 'Music'
  statusCode: number
  message: string
  isRetryable: boolean
  assetKey: string | null           // for build-time pre-gen failures
}
