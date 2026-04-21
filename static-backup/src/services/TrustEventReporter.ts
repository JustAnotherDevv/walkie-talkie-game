import { TrustEventType } from '../types/trust';

/**
 * Trust event detail structure
 * Contains information about the trust event to be reported
 */
export interface TrustEventDetail {
  /** The type of trust event */
  type: TrustEventType;
  /** Additional context about the event */
  detail: string;
  /** Timestamp when the event occurred */
  timestamp: number;
  /** Optional puzzle ID if event is related to a puzzle */
  puzzleId?: string;
  /** Optional room ID where the event occurred */
  roomId?: string;
}

/**
 * Formatted trust event message for ConvAI agent context
 */
export interface TrustEventMessage {
  /** Structured message for agent context */
  message: string;
  /** The original event detail */
  event: TrustEventDetail;
}

/**
 * Event callback type for trust event reporting
 */
type TrustEventCallback = (message: TrustEventMessage) => void;

/**
 * TrustEventReporter class
 * Validates: Requirements 6.1, 6.2, 6.3, 6.4, 6.5, 6.6
 * 
 * Formats trust events as structured messages and injects them into
 * the ConvAI agent context via ElevenLabsService.
 * 
 * Trust events are triggered by:
 * - Lying during defection opportunities (LiedAboutPuzzle)
 * - Withholding information the partner requested (WithheldInfo)
 * - Sharing risky/disadvantageous information (SharedRiskyInfo)
 * - Being caught in a contradiction (CaughtInContradiction)
 * - Providing verbal reassurance (VerbalReassurance)
 * - Breaking a promise (BrokePromise)
 * 
 * The trust score is maintained in the AI partner's memory (ConvAI agent context),
 * not in React state. This reporter injects events into that context.
 */
export class TrustEventReporter {
  private onReportCallback: TrustEventCallback | null = null;
  private eventHistory: TrustEventMessage[] = [];
  private currentRoomId: string | null = null;

  /**
   * Set the callback to be called when a trust event is reported
   * This callback should inject the message into the ConvAI agent context
   * 
   * @param callback - Function to call with the formatted trust event message
   */
  setReportCallback(callback: TrustEventCallback | null): void {
    this.onReportCallback = callback;
  }

  /**
   * Set the current room ID for context
   * 
   * @param roomId - The current room ID
   */
  setCurrentRoom(roomId: string): void {
    this.currentRoomId = roomId;
  }

  /**
   * Report a trust event
   * Formats a structured message and injects it into the ConvAI agent context
   * 
   * @param type - The type of trust event
   * @param detail - Additional context about the event
   * @param puzzleId - Optional puzzle ID if related to a puzzle
   * @returns The formatted trust event message
   */
  reportEvent(type: TrustEventType, detail: string, puzzleId?: string): TrustEventMessage {
    const eventDetail: TrustEventDetail = {
      type,
      detail,
      timestamp: Date.now(),
      puzzleId,
      roomId: this.currentRoomId ?? undefined,
    };

    const message = this.formatMessage(eventDetail);
    const trustEventMessage: TrustEventMessage = {
      message,
      event: eventDetail,
    };

    // Store in history
    this.eventHistory.push(trustEventMessage);

    // Call the callback to inject into ConvAI context
    if (this.onReportCallback) {
      this.onReportCallback(trustEventMessage);
    }

    return trustEventMessage;
  }

  /**
   * Format a trust event as a structured message for the ConvAI agent context
   * 
   * @param event - The trust event detail
   * @returns Formatted message string
   */
  private formatMessage(event: TrustEventDetail): string {
    const trustImpact = this.getTrustImpact(event.type);
    const direction = trustImpact > 0 ? 'increased' : 'decreased';
    
    let message = `[TRUST_EVENT] Type: ${event.type} | Impact: ${trustImpact > 0 ? '+' : ''}${trustImpact} | Detail: ${event.detail}`;
    
    if (event.puzzleId) {
      message += ` | Puzzle: ${event.puzzleId}`;
    }
    
    if (event.roomId) {
      message += ` | Room: ${event.roomId}`;
    }
    
    message += ` | Trust ${direction}`;
    
    return message;
  }

  /**
   * Get the trust impact for a given event type
   * Positive values increase trust, negative values decrease trust
   * 
   * @param type - The trust event type
   * @returns The trust impact value
   */
  getTrustImpact(type: TrustEventType): number {
    switch (type) {
      case TrustEventType.LiedAboutPuzzle:
        return -2; // Significant negative: player stated false info
      case TrustEventType.WithheldInfo:
        return -1; // Moderate negative: player ignored explicit request
      case TrustEventType.SharedRiskyInfo:
        return 2; // Significant positive: player revealed disadvantageous info
      case TrustEventType.CaughtInContradiction:
        return -3; // Major negative: partner caught inconsistency
      case TrustEventType.VerbalReassurance:
        return 1; // Moderate positive: emotional engagement or promise
      case TrustEventType.BrokePromise:
        return -2; // Significant negative: player broke earlier commitment
      default:
        return 0;
    }
  }

  /**
   * Get all reported trust events
   * Used for testing and verification
   * 
   * @returns Array of all trust event messages
   */
  getEventHistory(): TrustEventMessage[] {
    return [...this.eventHistory];
  }

  /**
   * Get the total trust impact from all events
   * Note: This is for testing/verification only. The actual trust score
   * is maintained in the ConvAI agent's memory.
   * 
   * @returns The sum of all trust impacts
   */
  getTotalTrustImpact(): number {
    return this.eventHistory.reduce((sum, msg) => {
      return sum + this.getTrustImpact(msg.event.type);
    }, 0);
  }

  /**
   * Clear all event history
   * Note: This should NOT be called between rooms - trust accumulates
   * across the entire playthrough (Requirement 6.9)
   */
  clearHistory(): void {
    this.eventHistory = [];
  }

  /**
   * Check if any events of a specific type have been reported
   * 
   * @param type - The trust event type to check
   * @returns True if any events of this type have been reported
   */
  hasEventType(type: TrustEventType): boolean {
    return this.eventHistory.some(msg => msg.event.type === type);
  }

  /**
   * Get all events of a specific type
   * 
   * @param type - The trust event type to filter by
   * @returns Array of trust event messages of the specified type
   */
  getEventsByType(type: TrustEventType): TrustEventMessage[] {
    return this.eventHistory.filter(msg => msg.event.type === type);
  }

  /**
   * Get the number of events reported
   * 
   * @returns The count of all reported events
   */
  getEventCount(): number {
    return this.eventHistory.length;
  }
}

// Singleton instance for global access
let trustEventReporterInstance: TrustEventReporter | null = null;

/**
 * Get the singleton TrustEventReporter instance
 * Creates a new instance if one doesn't exist
 * 
 * @returns The TrustEventReporter singleton instance
 */
export function getTrustEventReporter(): TrustEventReporter {
  if (!trustEventReporterInstance) {
    trustEventReporterInstance = new TrustEventReporter();
  }
  return trustEventReporterInstance;
}

/**
 * Reset the TrustEventReporter singleton
 * Used for testing and game reset
 */
export function resetTrustEventReporter(): void {
  if (trustEventReporterInstance) {
    trustEventReporterInstance.clearHistory();
  }
  trustEventReporterInstance = null;
}
