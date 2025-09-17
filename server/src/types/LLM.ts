import type { OasisCodes } from './oasis';

export type LLMResult = {
  codes: OasisCodes | null;
  tried: boolean;
  model: string;
  runs: OasisCodes[];
};
