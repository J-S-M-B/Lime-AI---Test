import { inferOasisFromTranscript } from '../services/oasisRuleEngine';
import type { OasisCodes, OasisKey } from '../types/oasis';

export function reconcileAndFallback(llm: OasisCodes | null, transcript: string): {
  merged: OasisCodes;
  provenance: Record<OasisKey, 'llm' | 'rules' | 'adjusted'>;
} {
  const keys: OasisKey[] = ['M1800','M1810','M1820','M1830','M1840','M1850','M1860'];
  const prov: Record<OasisKey, 'llm' | 'rules' | 'adjusted'> = {
    M1800:'rules', M1810:'rules', M1820:'rules', M1830:'rules', M1840:'rules', M1850:'rules', M1860:'rules'
  };

  const out: OasisCodes = {
    M1800:{value:'unknown'}, M1810:{value:'unknown'}, M1820:{value:'unknown'},
    M1830:{value:'unknown'}, M1840:{value:'unknown'}, M1850:{value:'unknown'}, M1860:{value:'unknown'},
    confidence: llm?.confidence ?? 0
  };
  if (llm) {
    for (const k of keys) {
      if (llm[k].value !== 'unknown') { out[k] = { ...llm[k] }; prov[k] = 'llm'; }
    }
  }
  const t = transcript.toLowerCase();
  if (/\bwalker|rolling walker\b/.test(t) && ['0','1'].includes(out.M1860.value as any)) {
    out.M1860 = { value:'2', evidence: out.M1860.evidence || 'mentions walker' };
    prov.M1860 = 'adjusted';
  }

  const rules = inferOasisFromTranscript(transcript);
  for (const k of keys) {
    if (out[k].value === 'unknown' && rules[k].value !== 'unknown') {
      out[k] = { ...rules[k] };
      prov[k] = (prov[k] === 'llm' ? 'llm' : 'rules');
    }
  }

  out.confidence = Math.max(out.confidence ?? 0, rules.confidence ?? 0);
  return { merged: out, provenance: prov };
}
