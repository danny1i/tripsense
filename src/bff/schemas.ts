import { z } from 'zod';
import { HOLIDAY_TYPES, MONTHS } from '../types/travel';

/**
 * Request validation for the BFF. Everything that crosses the network is
 * validated here before it reaches the agent.
 */

export const MAX_MESSAGE_LENGTH = 500;

const idSchema = z.string().regex(/^[a-z0-9-]{1,40}$/, 'Invalid id');

export const preferencesSchema = z
  .object({
    destinationIds: z.array(idSchema).max(12).optional(),
    europeOnly: z.boolean().optional(),
    month: z.enum(MONTHS).optional(),
    durationDays: z.number().int().min(1).max(30).optional(),
    temperature: z.enum(['mild', 'warm', 'hot']).optional(),
    budgetMax: z.number().int().min(50).max(20000).optional(),
    budgetLevel: z.enum(['low', 'mid', 'luxury']).optional(),
    beach: z.boolean().optional(),
    beachMaxDistance: z.number().int().min(50).max(20000).optional(),
    holidayTypes: z.array(z.enum(HOLIDAY_TYPES)).max(HOLIDAY_TYPES.length).optional(),
    nightlife: z.literal('high').optional(),
    familyFriendly: z.boolean().optional(),
    coupleFriendly: z.boolean().optional(),
    minRating: z.number().min(1).max(5).optional(),
    travellers: z.number().int().min(1).max(12).optional(),
  })
  .strict();

const sessionIdSchema = z.string().regex(/^[A-Za-z0-9_-]{6,64}$/, 'Invalid session id');

/** Strip control characters so logs and UI never receive odd input. */
const cleanText = (max: number) =>
  z
    .string()
    .transform((s) => s.replace(/[\u0000-\u001f\u007f]/g, ' ').trim())
    .pipe(z.string().min(1, 'Message is empty').max(max, `Message must be ${max} characters or fewer`));

export const conversationRequestSchema = z.object({
  message: cleanText(MAX_MESSAGE_LENGTH),
  sessionId: sessionIdSchema,
  preferences: preferencesSchema.default({}),
  history: z
    .array(z.object({ role: z.enum(['user', 'assistant']), text: z.string().max(2000) }))
    .max(20)
    .default([]),
  visibleTripIds: z.array(idSchema).max(50).default([]),
});

export const searchRequestSchema = z.object({
  preferences: preferencesSchema,
  sessionId: sessionIdSchema,
});

export const tripQuestionSchema = z.object({
  question: cleanText(300),
  preferences: preferencesSchema.default({}),
});

export const tripIdSchema = idSchema;

export const analyticsEventSchema = z.object({
  events: z
    .array(
      z.object({
        name: z.enum([
          'search_started',
          'search_completed',
          'conversation_message_sent',
          'agent_tool_called',
          'result_viewed',
          'filter_applied',
          'trip_selected',
          'recommendation_clicked',
          'trip_question_asked',
          'error_shown',
        ]),
        sessionId: sessionIdSchema,
        timestamp: z.number(),
        properties: z.record(z.union([z.string().max(200), z.number(), z.boolean(), z.null()])).default({}),
      }),
    )
    .max(50),
});
