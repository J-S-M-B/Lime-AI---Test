import { OasisCodesSchema } from '../lib/oasisSchema';
import { buildCodesPrompt } from '../prompt/oasis';
import type { LLMResult } from '../types/LLM';
import type { Item, OasisCodes, OasisKey } from '../types/oasis';

const OLLAMA_URL = String(process.env.OLLAMA_URL);
const MODEL_PREF = String(process.env.OASIS_MODEL);
const TEMP = Number(process.env.OLLAMA_TEMP ?? 0.1);
const NUM_CTX = Number(process.env.OLLAMA_NUM_CTX ?? 8192);


async function listModels(): Promise<string[]> {
  try {
    const r = await fetch(`${OLLAMA_URL}/api/tags`);
    if (!r.ok) return [];
    const j: any = await r.json();
    const arr: any[] = j?.models ?? j?.data ?? [];
    return arr.map(m => m?.name || m?.model).filter(Boolean);
  } catch { return []; }
}

async function resolveModelName(): Promise<string> {
  const models = await listModels();
  if (models.includes(MODEL_PREF)) return MODEL_PREF;
  const m = models.find(n => n?.startsWith(MODEL_PREF + ':'));
  if (m) return m;
  return MODEL_PREF;
}

function coerceJSON(text: string): any | null {
  if (!text) return null;
  let s = text.trim();
  // quita fences
  s = s.replace(/^```(?:json)?\s*/i, '').replace(/```$/i, '').trim();

  try { return JSON.parse(s); } catch {}

  let start = s.indexOf('{');
  while (start !== -1) {
    let depth = 0;
    for (let i = start; i < s.length; i++) {
      const ch = s[i];
      if (ch === '{') depth++;
      else if (ch === '}') {
        depth--;
        if (depth === 0) {
          const candidate = s.slice(start, i + 1);
          try { return JSON.parse(candidate); } catch {}
        }
      }
    }
    start = s.indexOf('{', start + 1);
  }

  try {
    const fix = s.replace(/,\s*([}\]])/g, '$1');
    return JSON.parse(fix);
  } catch { return null; }
}

function toInternal(z: any): OasisCodes {
  const pick = (k: OasisKey): Item => ({ value: z[k]?.value ?? 'unknown', evidence: z[k]?.evidence || '' });
  return {
    M1800: pick('M1800'),
    M1810: pick('M1810'),
    M1820: pick('M1820'),
    M1830: pick('M1830'),
    M1840: pick('M1840'),
    M1850: pick('M1850'),
    M1860: pick('M1860'),
    confidence: typeof z.confidence === 'number' ? z.confidence : 0.6
  };
}

// ---------- Ollama Calls----------
async function callGenerateJSON(model: string, prompt: string, seed: number, withFormat: boolean): Promise<any | null> {
  try {
    const body: any = {
      model,
      prompt,
      stream: false,
      options: { temperature: TEMP, num_ctx: NUM_CTX, seed },
      format: 'json'
    };
    if (withFormat) body.format = 'json';

    console.log('[LLM-DEBUG] Calling Ollama with:', {
      url: `${OLLAMA_URL}/api/generate`,
      model,
      promptLength: prompt.length,
      seed,
      withFormat
    });

    const r = await fetch(`${OLLAMA_URL}/api/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });
    if (!r.ok) {
      console.warn('[LLM] HTTP error:', r.status, r.statusText);
      return null;
    }
    const j: any = await r.json();
    const txt: string = j?.response ?? '';
    if (!txt) {
      console.warn('[LLM] empty response from /generate');
      return null;
    }
    const parsed = coerceJSON(txt);
    if (!parsed) {
      console.warn('[LLM] could not parse JSON from /generate, first200=', txt.slice(0, 200));
    }
    return parsed;
  } catch (e) {
    console.warn('[LLM] /generate failed:', (e as Error)?.message);
    return null;
  }
}

async function callChatJSON(model: string, prompt: string, seed: number, withFormat: boolean): Promise<any | null> {
  try {
    const body: any = {
      model,
      stream: false,
      options: { temperature: TEMP, num_ctx: NUM_CTX, seed }, 
      format: 'json',
      messages: [
        { role: 'system', content: 'You return strict JSON for OASIS coding.' },
        { role: 'user', content: prompt }
      ]
    };
    if (withFormat) body.format = 'json';

    const r = await fetch(`${OLLAMA_URL}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });
    const j: any = await r.json();
    const txt: string = j?.message?.content ?? j?.response ?? '';
    if (!txt) {
      console.warn('[LLM] empty response from /chat');
      return null;
    }
    const parsed = coerceJSON(txt);
    if (!parsed) {
      console.warn('[LLM] could not parse JSON from /chat, first200=', txt.slice(0, 200));
    }
    return parsed;
  } catch (e) {
    console.warn('[LLM] /chat failed:', (e as Error)?.message);
    return null;
  }
}

// ---------- Main API  ----------
export async function getCodesViaLLM(transcript: string): Promise<LLMResult> {
  const MODEL = process.env.OASIS_MODEL ?? 'llama3.1';
  const model = await resolveModelName();
  const prompt = buildCodesPrompt(transcript);
  const seeds = [11, 23, 37];
  const runs: OasisCodes[] = [];

  for (const seed of seeds) {
    let raw = await callGenerateJSON(model, prompt, seed, true);
    if (!raw) raw = await callGenerateJSON(model, prompt, seed, false);
    if (!raw) raw = await callChatJSON(model, prompt, seed, true);
    if (!raw) raw = await callChatJSON(model, prompt, seed, false);

    if (!raw) {
      console.warn('[LLM] no JSON parsed after all modes, seed', seed);
      continue;
    }
    const parsed = OasisCodesSchema.safeParse(raw);
    if (!parsed.success) {
      console.warn('[LLM] Zod validation failed for seed', seed, parsed.error?.issues?.[0]);
      continue;
    }
    runs.push(toInternal(parsed.data));
  }

  if (!runs.length) return { codes: null, tried: true, model: MODEL, runs: [] };

  const KEYS: OasisKey[] = ['M1800','M1810','M1820','M1830','M1840','M1850','M1860'];
  const voted: OasisCodes = {
    M1800:{value:'unknown'}, M1810:{value:'unknown'}, M1820:{value:'unknown'},
    M1830:{value:'unknown'}, M1840:{value:'unknown'}, M1850:{value:'unknown'}, M1860:{value:'unknown'},
    confidence: Math.max(...runs.map(r => r.confidence ?? 0))
  };

  for (const k of KEYS) {
    const tally = new Map<string, number>();
    for (const r of runs) tally.set(r[k].value, (tally.get(r[k].value) ?? 0) + 1);
    const sorted = [...tally.entries()].sort((a,b)=>b[1]-a[1]);
    let winner = sorted[0][0];
    if (winner === 'unknown' && sorted[1] && sorted[1][1] === sorted[0][1]) winner = sorted[1][0];
    const best = runs.find(r => r[k].value === winner && r[k].evidence) ?? runs.find(r => r[k].value === winner);
    voted[k] = { value: winner as any, evidence: best?.[k].evidence || '' };
  }
  return { codes: voted, tried: true, model: MODEL, runs: runs };
}
