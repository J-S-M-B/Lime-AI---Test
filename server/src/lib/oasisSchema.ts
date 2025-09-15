import { z } from 'zod';
import { ALLOWED_VALUES, OASIS_KEYS, OasisKey } from './oasisG';

const itemSchema = z.object({
  value: z.enum(ALLOWED_VALUES),
  evidence: z.string().min(1).optional()
});

export const OasisExtractionSchema = z.object(
  Object.fromEntries(OASIS_KEYS.map(k => [k, itemSchema])) as Record<OasisKey, typeof itemSchema>
).extend({
  confidence: z.number().min(0).max(1).optional()
});

export type OasisExtraction = z.infer<typeof OasisExtractionSchema>;
