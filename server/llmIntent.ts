import Anthropic from '@anthropic-ai/sdk';
import { z } from 'zod';
import type { IntentExtractor, ParsedIntent } from '../src/agent/intent';
import { parseIntent } from '../src/agent/intent';
import { preferencesSchema } from '../src/bff/schemas';
import { DESTINATIONS } from '../src/data/destinations';
import type { TravelPreferences } from '../src/types/travel';

/**
 * OPTIONAL AI intent extractor (server-side only).
 *
 * Used only when ANTHROPIC_API_KEY is set. The model turns free text into the
 * same `ParsedIntent` structure the rule-based extractor produces. Its output
 * is validated with Zod; anything invalid throws and the agent falls back to
 * rules. The API key never leaves the server.
 */

const parsedIntentSchema = z.object({
  set: preferencesSchema,
  remove: z.array(preferencesSchema.keyof()).default([]),
  relative: z
    .object({
      cheaper: z.boolean().optional(),
      closerToBeach: z.boolean().optional(),
      warmer: z.boolean().optional(),
      longer: z.boolean().optional(),
      shorter: z.boolean().optional(),
      quieter: z.boolean().optional(),
    })
    .default({}),
  mode: z.enum(['new', 'refine', 'reset']),
  focus: z.enum(['packages', 'hotels', 'flights']).default('packages'),
  travelRelated: z.boolean(),
  question: z.enum(['cheapest', 'top_rated', 'closest_beach']).optional(),
});

const SYSTEM_PROMPT = `You convert a traveller's message into structured search intent for a travel search product.
Return only facts the user stated. Never guess a month, budget, destination or duration they did not mention.
"cheap" means budgetLevel "low"; a £ amount means budgetMax. Relative requests like "cheaper" or "closer to the beach"
go in "relative", not "set". Use mode "refine" when the message builds on the current search (e.g. "make it cheaper",
"what about Tenerife?"), "new" for a fresh request, "reset" for "start over".
Valid destination ids: ${DESTINATIONS.map((d) => d.id).join(', ')}.`;

// JSON Schema for structured output. Kept permissive; Zod does the strict validation.
const OUTPUT_JSON_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['set', 'remove', 'relative', 'mode', 'focus', 'travelRelated'],
  properties: {
    set: {
      type: 'object',
      additionalProperties: false,
      properties: {
        destinationIds: { type: 'array', items: { type: 'string' } },
        europeOnly: { type: 'boolean' },
        month: { type: 'string' },
        durationDays: { type: 'integer' },
        temperature: { type: 'string', enum: ['mild', 'warm', 'hot'] },
        budgetMax: { type: 'integer' },
        budgetLevel: { type: 'string', enum: ['low', 'mid', 'luxury'] },
        beach: { type: 'boolean' },
        beachMaxDistance: { type: 'integer' },
        holidayTypes: { type: 'array', items: { type: 'string' } },
        nightlife: { type: 'string', enum: ['high'] },
        familyFriendly: { type: 'boolean' },
        coupleFriendly: { type: 'boolean' },
        minRating: { type: 'number' },
        travellers: { type: 'integer' },
      },
    },
    remove: { type: 'array', items: { type: 'string' } },
    relative: {
      type: 'object',
      additionalProperties: false,
      properties: {
        cheaper: { type: 'boolean' },
        closerToBeach: { type: 'boolean' },
        warmer: { type: 'boolean' },
        longer: { type: 'boolean' },
        shorter: { type: 'boolean' },
        quieter: { type: 'boolean' },
      },
    },
    mode: { type: 'string', enum: ['new', 'refine', 'reset'] },
    focus: { type: 'string', enum: ['packages', 'hotels', 'flights'] },
    travelRelated: { type: 'boolean' },
    question: { type: 'string', enum: ['cheapest', 'top_rated', 'closest_beach'] },
  },
} as const;

export interface LlmExtractorOptions {
  apiKey: string;
  model: string;
  timeoutMs: number;
}

export function createLlmIntentExtractor(options: LlmExtractorOptions): IntentExtractor {
  const client = new Anthropic({ apiKey: options.apiKey, timeout: options.timeoutMs, maxRetries: 1 });

  return {
    source: 'llm',
    async extract(message: string, current: TravelPreferences): Promise<ParsedIntent> {
      const response = await client.messages.create({
        model: options.model,
        max_tokens: 1024,
        system: SYSTEM_PROMPT,
        output_config: {
          effort: 'low',
          format: { type: 'json_schema', schema: OUTPUT_JSON_SCHEMA },
        },
        messages: [
          {
            role: 'user',
            content: `Current search: ${JSON.stringify(current)}\nTraveller message: ${JSON.stringify(message)}`,
          },
        ],
      });

      if (response.stop_reason === 'refusal') throw new Error('Model declined the request');
      const text = response.content.find((block) => block.type === 'text')?.text;
      if (!text) throw new Error('Model returned no text');

      const parsed = parsedIntentSchema.parse(JSON.parse(text));
      // Safety net: if the model missed a destination the rules can see, keep it.
      const rules = parseIntent(message);
      if (!parsed.set.destinationIds && rules.set.destinationIds) parsed.set.destinationIds = rules.set.destinationIds;
      return parsed as ParsedIntent;
    },
  };
}
