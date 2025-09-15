import { OASIS_KEYS } from '../lib/oasisG';
import { OasisExtraction, OasisExtractionSchema } from '../lib/oasisSchema';

// Si usas otro modelo HTTP, ajusta estas constantes:
const OLLAMA_URL = process.env.OLLAMA_URL ?? 'http://localhost:11434/api/chat';
const MODEL = process.env.OASIS_MODEL ?? 'llama3.1';

function buildPrompt(transcript: string) {
  // Pedimos JSON estricto con solo los campos requeridos
  return `
You are an expert clinical coder. From the following home health assessment transcript, extract EXACT values for OASIS Section G items M1800–M1860.

Return ONLY valid JSON with this exact shape:
{
  "M1800": {"value":"0|1|2|3|unknown","evidence":"short quote"},
  "M1810": {"value":"0|1|2|3|unknown","evidence":"short quote"},
  "M1820": {"value":"0|1|2|3|unknown","evidence":"short quote"},
  "M1830": {"value":"0|1|2|3|4|unknown","evidence":"short quote"},
  "M1840": {"value":"0|1|2|3|unknown","evidence":"short quote"},
  "M1850": {"value":"0|1|2|3|4|5|unknown","evidence":"short quote"},
  "M1860": {"value":"0|1|2|3|4|5|6|unknown","evidence":"short quote"},
  "confidence": 0.0-1.0
}

Rules:
- If unsure or missing evidence, use "unknown".
- Keep evidence short (≤ 200 chars). Quote the exact phrase(s) that justify the value.
- No extra keys, comments, markdown, or prose. JSON only.

Transcript:
"""${transcript}"""
`;
}

async function callOllama(prompt: string): Promise<string> {
  const res = await fetch(OLLAMA_URL, {
    method: 'POST',
    headers: {'Content-Type':'application/json'},
    body: JSON.stringify({
      model: MODEL,
      stream: false,
      messages: [
        { role: 'system', content: 'Answer ONLY with valid JSON conforming to the requested schema.' },
        { role: 'user', content: prompt }
      ]
    })
  });
  const json = await res.json();
  // Ollama responde { message: { content: '...'} } o { choices:[{message:{content}}]} según versión
  const content = json?.message?.content ?? json?.choices?.[0]?.message?.content ?? '';
  return typeof content === 'string' ? content : JSON.stringify(content);
}

function tryParseJson(raw: string) {
  // limpia fences si vinieron con ```json
  const cleaned = raw.trim().replace(/^```json\s*/i,'').replace(/```$/,'').trim();
  try { return JSON.parse(cleaned); } catch { return null; }
}

export async function extractOasis(transcript: string): Promise<{ oasis: OasisExtraction; summary: string; meta: any }> {
  // 1) resumen breve
  const sumPrompt = `Summarize the following clinical encounter in 5-7 bullets (patient context, mobility, ADLs, assistive devices, risks). Return plain text bullets.\n\n"""${transcript}"""`;
  const summary = await callOllama(sumPrompt);

  // 2) extracción estructurada
  const prompt = buildPrompt(transcript);
  let raw = await callOllama(prompt);
  let obj = tryParseJson(raw);

  // intento de reparación si no valida
  if (!obj) {
    const repair = await callOllama(`Your previous output was not valid JSON. Return ONLY the JSON. Schema keys: ${OASIS_KEYS.join(', ')}.\n\nPrevious:\n${raw}`);
    obj = tryParseJson(repair);
  }

  // Validación
  let parsed: OasisExtraction | null = null;
  if (obj) {
    const res = OasisExtractionSchema.safeParse(obj);
    if (res.success) parsed = res.data;
  }

  // Si aún falla, devuelve 'unknown' en todo para no romper el flujo
  if (!parsed) {
    parsed = {
      M1800:{ value:'unknown' },
      M1810:{ value:'unknown' },
      M1820:{ value:'unknown' },
      M1830:{ value:'unknown' },
      M1840:{ value:'unknown' },
      M1850:{ value:'unknown' },
      M1860:{ value:'unknown' },
      confidence: 0.0
    };
  }

  return { oasis: parsed, summary, meta: { model: MODEL, promptVersion: 'v1' } };
}
