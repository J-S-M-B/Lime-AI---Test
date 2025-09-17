// server/src/lib/oasisSchema.ts
import { z } from 'zod';

const item = (vals: readonly string[]) =>
  z.object({
    value: z.enum(vals as [string, ...string[]]),
    evidence: z.string().optional().default('')
  });

export const OasisCodesSchema = z.object({
  M1800: item(['0','1','2','3','unknown'] as const),
  M1810: item(['0','1','2','3','unknown'] as const),
  M1820: item(['0','1','2','3','unknown'] as const),
  M1830: item(['0','1','2','3','4','5','6','unknown'] as const),
  M1840: item(['0','1','2','3','4','unknown'] as const),
  M1850: item(['0','1','2','3','4','5','unknown'] as const),
  M1860: item(['0','1','2','3','4','5','6','unknown'] as const),
  confidence: z.number().min(0).max(1).optional().default(0.5)
});
export type OasisCodesZod = z.infer<typeof OasisCodesSchema>;
