import { TrustEventType } from '../types/trust';

export interface TrustEvent {
  type: TrustEventType;
  detail: string;
  timestamp: number;
  puzzleId?: string;
}

/**
 * Numeric trust delta per event type. Matches the deltas the ConvAI agent
 * will see in the system prompt when we add the live integration back.
 */
export function getTrustImpact(type: TrustEventType): number {
  switch (type) {
    case TrustEventType.LiedAboutPuzzle: return -2;
    case TrustEventType.WithheldInfo: return -1;
    case TrustEventType.CaughtInContradiction: return -3;
    case TrustEventType.BrokePromise: return -2;
    case TrustEventType.SharedRiskyInfo: return 2;
    case TrustEventType.VerbalReassurance: return 1;
    default: return 0;
  }
}

/**
 * Small standalone reporter. Holds history in-process. An optional
 * onReport callback lets ElevenLabsService forward every event into the
 * live ConvAI agent context as [TRUST_EVENT] ... via sendContextualUpdate.
 */
export class TrustEventReporter {
  private events: TrustEvent[] = [];
  private onReportCb: ((event: TrustEvent, formatted: string) => void) | null = null;

  setOnReport(cb: ((event: TrustEvent, formatted: string) => void) | null): void {
    this.onReportCb = cb;
  }

  reportEvent(type: TrustEventType, detail: string, puzzleId?: string): TrustEvent {
    const event: TrustEvent = {
      type,
      detail,
      timestamp: Date.now(),
      puzzleId,
    };
    this.events.push(event);
    const impact = getTrustImpact(type);
    const formatted =
      `[TRUST_EVENT] type=${type} | impact=${impact > 0 ? '+' : ''}${impact} | detail=${detail}` +
      (puzzleId ? ` | puzzle=${puzzleId}` : '');
    this.onReportCb?.(event, formatted);
    return event;
  }

  getHistory(): TrustEvent[] {
    return [...this.events];
  }

  getTotalImpact(): number {
    return this.events.reduce((acc, e) => acc + getTrustImpact(e.type), 0);
  }

  getCountByType(type: TrustEventType): number {
    return this.events.filter((e) => e.type === type).length;
  }

  clear(): void {
    this.events = [];
  }
}

let singleton: TrustEventReporter | null = null;

export function getTrustEventReporter(): TrustEventReporter {
  if (!singleton) singleton = new TrustEventReporter();
  return singleton;
}

export function resetTrustEventReporter(): void {
  singleton?.clear();
  singleton = null;
}
