// Feature: ai-escape-room, Property 10: Trust events are reported for player actions
// Feature: ai-escape-room, Property 11: Trust events accumulate across rooms without reset
// Validates: Requirements 6.2, 6.3, 6.4, 6.6, 6.9

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fc from 'fast-check';
import { 
  TrustEventReporter, 
  getTrustEventReporter, 
  resetTrustEventReporter
} from '../services/TrustEventReporter';
import { TrustEventType } from '../types/trust';

// Helper to create a fresh reporter for each test
function createFreshReporter(): TrustEventReporter {
  resetTrustEventReporter();
  return getTrustEventReporter();
}

// Generator for trust event types
const trustEventTypeArbitrary = fc.constantFrom(...Object.values(TrustEventType));

// Generator for detail strings
const detailArbitrary = fc.string({ minLength: 1, maxLength: 200 });

// Generator for puzzle IDs
const puzzleIdArbitrary = fc.string({ minLength: 1, maxLength: 50 });

// Generator for room IDs
const roomIdArbitrary = fc.string({ minLength: 1, maxLength: 20 });

describe('Property 10: Trust events are reported for player actions', () => {
  let reporter: TrustEventReporter;

  beforeEach(() => {
    reporter = createFreshReporter();
  });

  afterEach(() => {
    resetTrustEventReporter();
  });

  it('should report LiedAboutPuzzle event without dropping', () => {
    fc.assert(
      fc.property(
        puzzleIdArbitrary,
        detailArbitrary,
        (puzzleId, detail) => {
          reporter.clearHistory();
          
          const message = reporter.reportEvent(TrustEventType.LiedAboutPuzzle, detail, puzzleId);
          
          // Property: event is reported with correct type
          expect(message.event.type).toBe(TrustEventType.LiedAboutPuzzle);
          expect(message.event.detail).toBe(detail);
          expect(message.event.puzzleId).toBe(puzzleId);
          
          // Property: event is in history
          const history = reporter.getEventHistory();
          expect(history.length).toBe(1);
          expect(history[0].event.type).toBe(TrustEventType.LiedAboutPuzzle);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should report WithheldInfo event without dropping', () => {
    fc.assert(
      fc.property(
        puzzleIdArbitrary,
        detailArbitrary,
        (puzzleId, detail) => {
          reporter.clearHistory();
          
          const message = reporter.reportEvent(TrustEventType.WithheldInfo, detail, puzzleId);
          
          // Property: event is reported with correct type
          expect(message.event.type).toBe(TrustEventType.WithheldInfo);
          expect(message.event.detail).toBe(detail);
          
          // Property: event is in history
          const history = reporter.getEventHistory();
          expect(history.length).toBe(1);
          expect(history[0].event.type).toBe(TrustEventType.WithheldInfo);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should report SharedRiskyInfo event without dropping', () => {
    fc.assert(
      fc.property(
        puzzleIdArbitrary,
        detailArbitrary,
        (puzzleId, detail) => {
          reporter.clearHistory();
          
          const message = reporter.reportEvent(TrustEventType.SharedRiskyInfo, detail, puzzleId);
          
          // Property: event is reported with correct type
          expect(message.event.type).toBe(TrustEventType.SharedRiskyInfo);
          expect(message.event.detail).toBe(detail);
          
          // Property: event is in history
          const history = reporter.getEventHistory();
          expect(history.length).toBe(1);
          expect(history[0].event.type).toBe(TrustEventType.SharedRiskyInfo);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should report VerbalReassurance event without dropping', () => {
    fc.assert(
      fc.property(
        detailArbitrary,
        (detail) => {
          reporter.clearHistory();
          
          const message = reporter.reportEvent(TrustEventType.VerbalReassurance, detail);
          
          // Property: event is reported with correct type
          expect(message.event.type).toBe(TrustEventType.VerbalReassurance);
          expect(message.event.detail).toBe(detail);
          
          // Property: event is in history
          const history = reporter.getEventHistory();
          expect(history.length).toBe(1);
          expect(history[0].event.type).toBe(TrustEventType.VerbalReassurance);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should report CaughtInContradiction event without dropping', () => {
    fc.assert(
      fc.property(
        detailArbitrary,
        (detail) => {
          reporter.clearHistory();
          
          const message = reporter.reportEvent(TrustEventType.CaughtInContradiction, detail);
          
          // Property: event is reported with correct type
          expect(message.event.type).toBe(TrustEventType.CaughtInContradiction);
          expect(message.event.detail).toBe(detail);
          
          // Property: event is in history
          const history = reporter.getEventHistory();
          expect(history.length).toBe(1);
          expect(history[0].event.type).toBe(TrustEventType.CaughtInContradiction);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should report BrokePromise event without dropping', () => {
    fc.assert(
      fc.property(
        detailArbitrary,
        (detail) => {
          reporter.clearHistory();
          
          const message = reporter.reportEvent(TrustEventType.BrokePromise, detail);
          
          // Property: event is reported with correct type
          expect(message.event.type).toBe(TrustEventType.BrokePromise);
          expect(message.event.detail).toBe(detail);
          
          // Property: event is in history
          const history = reporter.getEventHistory();
          expect(history.length).toBe(1);
          expect(history[0].event.type).toBe(TrustEventType.BrokePromise);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should report all trust event types without dropping any', () => {
    fc.assert(
      fc.property(
        fc.array(trustEventTypeArbitrary, { minLength: 1, maxLength: 20 }),
        fc.array(detailArbitrary, { minLength: 1, maxLength: 20 }),
        (eventTypes, details) => {
          reporter.clearHistory();
          
          // Report each event type
          const reportedTypes = new Set<TrustEventType>();
          
          for (let i = 0; i < eventTypes.length; i++) {
            const detail = details[i % details.length];
            reporter.reportEvent(eventTypes[i], detail);
            reportedTypes.add(eventTypes[i]);
          }
          
          // Property: all reported events are in history
          const history = reporter.getEventHistory();
          expect(history.length).toBe(eventTypes.length);
          
          // Property: no event type is silently dropped
          for (const eventType of reportedTypes) {
            const hasEvent = history.some(msg => msg.event.type === eventType);
            expect(hasEvent).toBe(true);
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should call the report callback for each event', () => {
    fc.assert(
      fc.property(
        trustEventTypeArbitrary,
        detailArbitrary,
        (type, detail) => {
          reporter.clearHistory();
          
          let callbackCalled = false;
          let receivedMessage = null;
          
          reporter.setReportCallback((msg) => {
            callbackCalled = true;
            receivedMessage = msg;
          });
          
          reporter.reportEvent(type, detail);
          
          // Property: callback was called
          expect(callbackCalled).toBe(true);
          expect(receivedMessage).not.toBeNull();
          expect(receivedMessage!.event.type).toBe(type);
          expect(receivedMessage!.event.detail).toBe(detail);
          
          reporter.setReportCallback(null);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should include timestamp in reported events', () => {
    fc.assert(
      fc.property(
        trustEventTypeArbitrary,
        detailArbitrary,
        (type, detail) => {
          reporter.clearHistory();
          
          const beforeTime = Date.now();
          const message = reporter.reportEvent(type, detail);
          const afterTime = Date.now();
          
          // Property: timestamp is within valid range
          expect(message.event.timestamp).toBeGreaterThanOrEqual(beforeTime);
          expect(message.event.timestamp).toBeLessThanOrEqual(afterTime);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should format message with trust impact indicator', () => {
    fc.assert(
      fc.property(
        trustEventTypeArbitrary,
        detailArbitrary,
        (type, detail) => {
          reporter.clearHistory();
          
          const message = reporter.reportEvent(type, detail);
          const impact = reporter.getTrustImpact(type);
          
          // Property: message contains event type
          expect(message.message).toContain(type);
          
          // Property: message contains trust impact
          expect(message.message).toContain(`Impact: ${impact > 0 ? '+' : ''}${impact}`);
          
          // Property: message contains detail
          expect(message.message).toContain(detail);
        }
      ),
      { numRuns: 100 }
    );
  });
});

describe('Property 11: Trust events accumulate across rooms without reset', () => {
  let reporter: TrustEventReporter;

  beforeEach(() => {
    reporter = createFreshReporter();
  });

  afterEach(() => {
    resetTrustEventReporter();
  });

  it('should preserve all events when transitioning between rooms', () => {
    fc.assert(
      fc.property(
        fc.array(roomIdArbitrary, { minLength: 2, maxLength: 5 }),
        fc.array(
          fc.record({
            type: trustEventTypeArbitrary,
            detail: detailArbitrary,
          }),
          { minLength: 1, maxLength: 10 }
        ),
        (rooms, events) => {
          reporter.clearHistory();
          
          // Report events across multiple rooms
          let totalEvents = 0;
          
          for (const room of rooms) {
            reporter.setCurrentRoom(room);
            
            // Report some events in this room
            for (const event of events) {
              reporter.reportEvent(event.type, event.detail);
              totalEvents++;
            }
          }
          
          // Property: all events are present in history
          const history = reporter.getEventHistory();
          expect(history.length).toBe(totalEvents);
          
          // Property: events from all rooms are present
          for (const room of rooms) {
            const roomEvents = history.filter(msg => msg.event.roomId === room);
            expect(roomEvents.length).toBe(events.length);
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should not clear context between room transitions', () => {
    fc.assert(
      fc.property(
        roomIdArbitrary,
        roomIdArbitrary,
        fc.array(
          fc.record({
            type: trustEventTypeArbitrary,
            detail: detailArbitrary,
          }),
          { minLength: 1, maxLength: 5 }
        ),
        fc.array(
          fc.record({
            type: trustEventTypeArbitrary,
            detail: detailArbitrary,
          }),
          { minLength: 1, maxLength: 5 }
        ),
        (room1, room2, room1Events, room2Events) => {
          // Skip if rooms are the same
          fc.pre(room1 !== room2);
          
          reporter.clearHistory();
          
          // Report events in room 1
          reporter.setCurrentRoom(room1);
          for (const event of room1Events) {
            reporter.reportEvent(event.type, event.detail);
          }
          
          const room1History = reporter.getEventHistory();
          const room1Count = room1History.length;
          
          // Transition to room 2
          reporter.setCurrentRoom(room2);
          
          // Property: room 1 events still present after transition
          const historyAfterTransition = reporter.getEventHistory();
          expect(historyAfterTransition.length).toBe(room1Count);
          
          // Report events in room 2
          for (const event of room2Events) {
            reporter.reportEvent(event.type, event.detail);
          }
          
          // Property: all events from both rooms present
          const finalHistory = reporter.getEventHistory();
          expect(finalHistory.length).toBe(room1Events.length + room2Events.length);
          
          // Property: room 1 events still present
          const room1EventsAfter = finalHistory.filter(msg => msg.event.roomId === room1);
          expect(room1EventsAfter.length).toBe(room1Events.length);
          
          // Property: room 2 events present
          const room2EventsAfter = finalHistory.filter(msg => msg.event.roomId === room2);
          expect(room2EventsAfter.length).toBe(room2Events.length);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should accumulate trust impact across rooms', () => {
    fc.assert(
      fc.property(
        fc.array(roomIdArbitrary, { minLength: 2, maxLength: 4 }),
        fc.array(trustEventTypeArbitrary, { minLength: 1, maxLength: 10 }),
        detailArbitrary,
        (rooms, eventTypes, detail) => {
          reporter.clearHistory();
          
          let expectedTotalImpact = 0;
          
          // Report events across rooms
          for (const room of rooms) {
            reporter.setCurrentRoom(room);
            
            for (const type of eventTypes) {
              reporter.reportEvent(type, detail);
              expectedTotalImpact += reporter.getTrustImpact(type);
            }
          }
          
          // Property: total impact matches sum of all events
          const actualTotalImpact = reporter.getTotalTrustImpact();
          expect(actualTotalImpact).toBe(expectedTotalImpact);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should maintain event order across room transitions', () => {
    fc.assert(
      fc.property(
        fc.array(roomIdArbitrary, { minLength: 2, maxLength: 3 }),
        fc.array(
          fc.record({
            type: trustEventTypeArbitrary,
            detail: detailArbitrary,
          }),
          { minLength: 3, maxLength: 10 }
        ),
        (rooms, events) => {
          reporter.clearHistory();
          
          const reportedOrder: Array<{ type: TrustEventType; detail: string }> = [];
          
          // Report events across rooms
          let eventIndex = 0;
          for (const room of rooms) {
            reporter.setCurrentRoom(room);
            
            // Report a few events per room
            const eventsPerRoom = Math.ceil(events.length / rooms.length);
            for (let i = 0; i < eventsPerRoom && eventIndex < events.length; i++) {
              const event = events[eventIndex];
              reporter.reportEvent(event.type, event.detail);
              reportedOrder.push({ type: event.type, detail: event.detail });
              eventIndex++;
            }
          }
          
          // Property: events are in the same order as reported
          const history = reporter.getEventHistory();
          expect(history.length).toBe(reportedOrder.length);
          
          for (let i = 0; i < reportedOrder.length; i++) {
            expect(history[i].event.type).toBe(reportedOrder[i].type);
            expect(history[i].event.detail).toBe(reportedOrder[i].detail);
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should preserve events with puzzle IDs across room transitions', () => {
    fc.assert(
      fc.property(
        roomIdArbitrary,
        roomIdArbitrary,
        puzzleIdArbitrary,
        detailArbitrary,
        (room1, room2, puzzleId, detail) => {
          fc.pre(room1 !== room2);
          
          reporter.clearHistory();
          
          // Report event with puzzle ID in room 1
          reporter.setCurrentRoom(room1);
          reporter.reportEvent(TrustEventType.LiedAboutPuzzle, detail, puzzleId);
          
          // Transition to room 2
          reporter.setCurrentRoom(room2);
          reporter.reportEvent(TrustEventType.VerbalReassurance, detail);
          
          // Property: puzzle ID is preserved
          const history = reporter.getEventHistory();
          expect(history.length).toBe(2);
          
          const puzzleEvent = history.find(msg => msg.event.puzzleId === puzzleId);
          expect(puzzleEvent).toBeDefined();
          expect(puzzleEvent!.event.roomId).toBe(room1);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should never clear history automatically on room change', () => {
    fc.assert(
      fc.property(
        fc.array(roomIdArbitrary, { minLength: 3, maxLength: 5 }),
        fc.array(
          fc.record({
            type: trustEventTypeArbitrary,
            detail: detailArbitrary,
          }),
          { minLength: 5, maxLength: 15 }
        ),
        (rooms, events) => {
          reporter.clearHistory();
          
          let eventIndex = 0;
          const totalEvents = events.length;
          
          // Report all events across rooms
          for (const room of rooms) {
            reporter.setCurrentRoom(room);
            
            while (eventIndex < totalEvents) {
              const event = events[eventIndex];
              reporter.reportEvent(event.type, event.detail);
              eventIndex++;
            }
          }
          
          // Property: all events are preserved
          const history = reporter.getEventHistory();
          expect(history.length).toBe(totalEvents);
          
          // Property: no events were dropped
          for (const event of events) {
            const found = history.some(
              msg => msg.event.type === event.type && msg.event.detail === event.detail
            );
            expect(found).toBe(true);
          }
        }
      ),
      { numRuns: 100 }
    );
  });
});
