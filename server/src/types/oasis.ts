export type Code = '0' | '1' | '2' | '3' | '4' | '5' | '6' | 'unknown';

export type Item = {
  value: Code;
  evidence?: string;
};

export const OASIS_KEYS = ['M1800','M1810','M1820','M1830','M1840','M1850','M1860'] as const;
export type OasisKey = typeof OASIS_KEYS[number];

export type OasisCodes = {
  M1800: Item;
  M1810: Item;
  M1820: Item;
  M1830: Item;
  M1840: Item;
  M1850: Item;
  M1860: Item;
  confidence?: number;
};
