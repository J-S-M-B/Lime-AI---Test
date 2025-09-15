import { OasisFeatures } from './oasisFeatures';

export type OasisCodes = {
  M1800:{value:string,evidence?:string},
  M1810:{value:string,evidence?:string},
  M1820:{value:string,evidence?:string},
  M1830:{value:string,evidence?:string},
  M1840:{value:string,evidence?:string},
  M1850:{value:string,evidence?:string},
  M1860:{value:string,evidence?:string},
  confidence?: number
};

export function mapToCodes(f: OasisFeatures): OasisCodes {
  const out: OasisCodes = {
    M1800:{value:'unknown'}, M1810:{value:'unknown'}, M1820:{value:'unknown'},
    M1830:{value:'unknown'}, M1840:{value:'unknown'}, M1850:{value:'unknown'}, M1860:{value:'unknown'}
  };

  // M1800 Grooming
  switch (f.M1800?.status) {
    case 'unaided': out.M1800 = { value:'0', evidence:f.M1800.evidence }; break;
    case 'setup_only': out.M1800 = { value:'1', evidence:f.M1800.evidence }; break;
    case 'assist': out.M1800 = { value:'2', evidence:f.M1800.evidence }; break;
    case 'dependent': out.M1800 = { value:'3', evidence:f.M1800.evidence }; break;
  }

  // M1810 Upper-body dressing
  switch (f.M1810?.status) {
    case 'unaided_full': out.M1810 = { value:'0', evidence:f.M1810.evidence }; break;
    case 'unaided_if_laid_out': out.M1810 = { value:'1', evidence:f.M1810.evidence }; break;
    case 'needs_help_put_on': out.M1810 = { value:'2', evidence:f.M1810.evidence }; break;
    case 'dependent': out.M1810 = { value:'3', evidence:f.M1810.evidence }; break;
  }

  // M1820 Lower-body dressing
  switch (f.M1820?.status) {
    case 'unaided_full': out.M1820 = { value:'0', evidence:f.M1820.evidence }; break;
    case 'unaided_if_laid_out': out.M1820 = { value:'1', evidence:f.M1820.evidence }; break;
    case 'needs_help_put_on': out.M1820 = { value:'2', evidence:f.M1820.evidence }; break;
    case 'dependent': out.M1820 = { value:'3', evidence:f.M1820.evidence }; break;
  }

  // M1830 Bathing
  switch (f.M1830?.status) {
    case 'independent_shower': out.M1830 = { value:'0', evidence:f.M1830.evidence }; break;
    case 'independent_shower_with_device': out.M1830 = { value:'1', evidence:f.M1830.evidence }; break;
    case 'intermittent_assist': out.M1830 = { value:'2', evidence:f.M1830.evidence }; break;
    case 'presence_throughout': out.M1830 = { value:'3', evidence:f.M1830.evidence }; break;
    case 'independent_sink_chair': out.M1830 = { value:'4', evidence:f.M1830.evidence }; break;
    case 'assist_sink_chair': out.M1830 = { value:'5', evidence:f.M1830.evidence }; break;
    case 'bathed_by_another': out.M1830 = { value:'6', evidence:f.M1830.evidence }; break;
  }

  // M1840 Toilet transferring
  switch (f.M1840?.status) {
    case 'independent': out.M1840 = { value:'0', evidence:f.M1840.evidence }; break;
    case 'reminded_assisted_supervised': out.M1840 = { value:'1', evidence:f.M1840.evidence }; break;
    case 'bedside_commode': out.M1840 = { value:'2', evidence:f.M1840.evidence }; break;
    case 'bedpan_urinal_independent': out.M1840 = { value:'3', evidence:f.M1840.evidence }; break;
    case 'dependent': out.M1840 = { value:'4', evidence:f.M1840.evidence }; break;
  }

  // M1850 Transferring
  switch (f.M1850?.status) {
    case 'independent': out.M1850 = { value:'0', evidence:f.M1850.evidence }; break;
    case 'minimal_assist_or_device': out.M1850 = { value:'1', evidence:f.M1850.evidence }; break;
    case 'bear_weight_pivot_cannot_transfer_self': out.M1850 = { value:'2', evidence:f.M1850.evidence }; break;
    case 'cannot_transfer_cannot_bear_weight': out.M1850 = { value:'3', evidence:f.M1850.evidence }; break;
    case 'bedfast_can_turn': out.M1850 = { value:'4', evidence:f.M1850.evidence }; break;
    case 'bedfast_cannot_turn': out.M1850 = { value:'5', evidence:f.M1850.evidence }; break;
  }

  // M1860 Ambulation/locomotion
  switch (f.M1860?.status) {
    case 'independent_no_device': out.M1860 = { value:'0', evidence:f.M1860.evidence }; break;
    case 'independent_one_handed_device': out.M1860 = { value:'1', evidence:f.M1860.evidence }; break;
    case 'two_handed_device_or_supervision_stairs': out.M1860 = { value:'2', evidence:f.M1860.evidence }; break;
    case 'needs_supervision_all_times': out.M1860 = { value:'3', evidence:f.M1860.evidence }; break;
    case 'wheelchair_independent': out.M1860 = { value:'4', evidence:f.M1860.evidence }; break;
    case 'wheelchair_dependent': out.M1860 = { value:'5', evidence:f.M1860.evidence }; break;
    case 'bedfast': out.M1860 = { value:'6', evidence:f.M1860.evidence }; break;
  }

  out.confidence = f.confidence ?? 0.7;
  return out;
}
