import { z } from 'zod';

const item = (vals: readonly string[]) => z.object({
  value: z.enum(vals as [string, ...string[]]),
  evidence: z.string().min(1).optional()
});

export const OasisExtractionSchema = z.object({
  M1800: item(['0','1','2','3','unknown']),
  M1810: item(['0','1','2','3','unknown']),
  M1820: item(['0','1','2','3','unknown']),
  M1830: item(['0','1','2','3','4','5','6','unknown']),
  M1840: item(['0','1','2','3','4','unknown']),
  M1850: item(['0','1','2','3','4','5','unknown']),
  M1860: item(['0','1','2','3','4','5','6','unknown']),
  confidence: z.number().min(0).max(1).optional()
});
export type OasisExtraction = z.infer<typeof OasisExtractionSchema>;