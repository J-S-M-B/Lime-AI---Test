export const OASIS_KEYS = ['M1800','M1810','M1820','M1830','M1840','M1850','M1860'] as const;
export type OasisKey = typeof OASIS_KEYS[number];

export const ALLOWED_VALUES = ['0','1','2','3','4','5','6','unknown'] as const;


export const ITEM_LABEL: Record<OasisKey,string> = {
  M1800: 'Grooming',
  M1810: 'Upper body dressing',
  M1820: 'Lower body dressing',
  M1830: 'Bathing',
  M1840: 'Toilet transferring',
  M1850: 'Transferring',
  M1860: 'Ambulation/locomotion'
};
