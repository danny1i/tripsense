import { TravelAgent } from '../src/agent/agent';
import { MockTravelProvider, type MockProviderOptions } from '../src/providers/travelProvider';
import type { IntentExtractor } from '../src/agent/intent';
import type { AgentResponse } from '../src/types/agent';
import type { TravelPreferences } from '../src/types/travel';

/** Fixed clock so "current month" is deterministic (October). */
export const FIXED_NOW = () => new Date('2026-10-01T09:00:00Z');

export function makeAgent(options: { provider?: MockProviderOptions; intentExtractor?: IntentExtractor } = {}) {
  return new TravelAgent({ provider: new MockTravelProvider(options.provider), intentExtractor: options.intentExtractor, now: FIXED_NOW });
}

/** Run a multi-turn conversation, carrying context like the frontend does. */
export async function converse(agent: TravelAgent, messages: string[], start: TravelPreferences = {}): Promise<AgentResponse[]> {
  let preferences = start;
  let visibleTripIds: string[] = [];
  const responses: AgentResponse[] = [];
  for (const message of messages) {
    const res = await agent.converse({ message, sessionId: 'test-session', preferences, history: [], visibleTripIds });
    responses.push(res);
    preferences = res.preferences;
    visibleTripIds = res.results.map((r) => r.trip.id);
  }
  return responses;
}
