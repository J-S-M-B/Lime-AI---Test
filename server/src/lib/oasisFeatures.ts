import { z } from 'zod';

// --------- M1800 Grooming ---------
export const M1800Feat = z.object({
  status: z.enum(['unaided', 'setup_only', 'assist', 'dependent']).optional(),
  evidence: z.string().optional(),
});

// --------- M1810 / M1820 Dressing ---------
export const DressingFeat = z.object({
  status: z.enum(['unaided_full', 'unaided_if_laid_out', 'needs_help_put_on', 'dependent']).optional(),
  evidence: z.string().optional(),
});

// --------- M1830 Bathing ---------
export const M1830Feat = z.object({
  status: z.enum([
    'independent_shower',
    'independent_shower_with_device',
    'intermittent_assist',      // supervision OR in/out OR hard-to-reach
    'presence_throughout',
    'independent_sink_chair',
    'assist_sink_chair',
    'bathed_by_another'
  ]).optional(),
  evidence: z.string().optional(),
});

// --------- M1840 Toilet transferring ---------
export const M1840Feat = z.object({
  status: z.enum([
    'independent',
    'reminded_assisted_supervised',
    'bedside_commode',
    'bedpan_urinal_independent',
    'dependent'
  ]).optional(),
  evidence: z.string().optional(),
});

// --------- M1850 Transferring ---------
export const M1850Feat = z.object({
  status: z.enum([
    'independent',
    'minimal_assist_or_device',
    'bear_weight_pivot_cannot_transfer_self',
    'cannot_transfer_cannot_bear_weight',
    'bedfast_can_turn',
    'bedfast_cannot_turn'
  ]).optional(),
  evidence: z.string().optional(),
});

// --------- M1860 Ambulation/locomotion ---------
export const M1860Feat = z.object({
  status: z.enum([
    'independent_no_device',
    'independent_one_handed_device',          // cane, single crutch, hemi-walker
    'two_handed_device_or_supervision_stairs',// walker/crutches OR human supervision/assist for stairs/uneven
    'needs_supervision_all_times',
    'wheelchair_independent',
    'wheelchair_dependent',
    'bedfast'
  ]).optional(),
  evidence: z.string().optional(),
});

export const OasisFeaturesSchema = z.object({
  M1800: M1800Feat,
  M1810: DressingFeat,
  M1820: DressingFeat,
  M1830: M1830Feat,
  M1840: M1840Feat,
  M1850: M1850Feat,
  M1860: M1860Feat,
  notes: z.string().optional(),         // opcional para info adicional
  confidence: z.number().min(0).max(1).optional()
});

export type OasisFeatures = z.infer<typeof OasisFeaturesSchema>;
