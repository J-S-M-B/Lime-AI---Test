import { InferenceClient } from '@huggingface/inference';
import { OasisFeatures } from '../lib/oasisFeatures';
import { getCodesViaLLM } from '../services/oasisLLM';
import { reconcileAndFallback } from '../services/osasisReconcile';
import { summarizeBullets } from '../services/summary';

class HuggingFaceService {
  private hf: InferenceClient;
  private model: string;

  constructor() {
    this.hf = new InferenceClient(process.env.HUGGINGFACE_API_KEY);
    this.model = String(process.env.HF_MODEL);
  }

  async generateText(prompt: string): Promise<string> {
    try {
      console.log(`[HF] Using conversational model: ${this.model}`);
      
      const response = await this.hf.chatCompletion({
        model: this.model,
        messages: [
          {
            role: 'user',
            content: prompt
          }
        ],
        parameters: {
          max_tokens: 5000,
          temperature: 0.1,
          top_p: 0.9,
          repetition_penalty: 1.1
        }
      });

      const generatedText = response.choices[0]?.message?.content?.trim() || '';
      console.log(`[HF] Response received: ${generatedText.substring(0, 100)}...`);
      return generatedText;

    } catch (error: any) {
      console.error('[HF] Chat completion error:', error.message);
      throw new Error(`Hugging Face API error: ${error.message}`);
    }
  }

  async extractOasisData(transcript: string): Promise<any> {
  const shortTranscript = transcript.length > 1500 
    ? transcript.substring(0, 1500) + '...' 
    : transcript;

  const prompt = `Analyze this clinical transcript and extract OASIS Section G codes. 
    Return ONLY valid JSON with the exact structure below. For each item, provide:
    - "value": Use specific codes (0,1,2,3,4,5,6) NOT "unknown"
    - "evidence": Exact quotes from text supporting the code choice

    TRANSCRIPT:
    ${shortTranscript}

    Return ONLY this JSON structure:
    {
      "M1800": {"value": "0|1|2|3", "evidence": "specific text quote"},
      "M1810": {"value": "0|1|2|3", "evidence": "specific text quote"},
      "M1820": {"value": "0|1|2|3", "evidence": "specific text quote"},
      "M1830": {"value": "0|1|2|3|4|5|6", "evidence": "specific text quote"},
      "M1840": {"value": "0|1|2|3|4", "evidence": "specific text quote"},
      "M1850": {"value": "0|1|2|3|4|5", "evidence": "specific text quote"},
      "M1860": {"value": "0|1|2|3|4|5|6", "evidence": "specific text quote"}
    }

    Coding guidelines:
    - M1800 Grooming: 0=Independent, 1=Setup help, 2=Assistance, 3=Dependent
    - M1810 Upper dressing: 0=Independent, 1=Setup help, 2=Assistance, 3=Dependent
    - M1820 Lower dressing: 0=Independent, 1=Setup help, 2=Assistance, 3=Dependent
    - M1830 Bathing: 0=Independent shower, 1=Devices, 2=Intermittent assist, 3=Constant assist, 4=Independent sink, 5=Assist sink, 6=Total assist
    - M1840 Toilet transferring: 0=Independent, 1=Supervision, 2=Commode, 3=Bedpan, 4=Dependent
    - M1850 Bed/chair transfers: 0=Independent, 1=Minimal assist, 2=Weight bear+pivot, 3=No transfer, 4=Bedfast turns, 5=Bedfast no turn
    - M1860 Ambulation: 0=Independent no device, 1=One-handed device, 2=Two-handed device, 3=Constant supervision, 4=Wheelchair independent, 5=Wheelchair dependent, 6=Bedfast

    IMPORTANT: Use specific codes, NOT "unknown". Find evidence in the text.`;

  try {
    const response = await this.generateText(prompt);
    console.log('[HF] OASIS response:', response.substring(0, 300) + '...');
    
    try {
      const jsonMatch = response.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsedData = JSON.parse(jsonMatch[0]);
        
        const allUnknown = Object.values(parsedData).every((item: any) => 
          item.value === 'unknown' || item.value === ''
        );
        
        if (allUnknown) {
          throw new Error('All values are unknown');
        }
        
        return parsedData;
      }
      throw new Error('No JSON found in response');
      
    } catch (parseError: unknown) {
      const err = parseError as Error;
      console.error('[HF] JSON parse error:', err.message);
      throw new Error('Failed to parse OASIS data from response');
    }

  } catch (error: unknown) {
    const err = error as Error;
    console.error('[HF] OASIS extraction error:', err.message);
    throw err;
  }
}
}

const huggingFaceService = new HuggingFaceService();
const OLLAMA_URL = String(process.env.OLLAMA_URL);
const MODEL = String(process.env.OASIS_MODEL);
const NUM_CTX = Number(process.env.OLLAMA_NUM_CTX);
const TEMP = Number(process.env.OLLAMA_TEMP);

function truncate(s: string, max = 4000) {
  return s.length > max ? s.slice(0, max) : s;
}

async function callOllamaChat(prompt: string): Promise<string | null> {
  try {
    const r = await fetch(`${OLLAMA_URL}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: MODEL, stream: false,
        options: { temperature: TEMP, num_ctx: NUM_CTX },
        messages: [
          { role: 'system', content: 'Answer ONLY with the requested format.' },
          { role: 'user', content: prompt }
        ]
      })
    });
    const j: any = await r.json();
    return j?.message?.content ?? j?.choices?.[0]?.message?.content ?? null;
  } catch { return null; }
}

async function callOllamaGenerate(prompt: string): Promise<string | null> {
  try {
    const r = await fetch(`${OLLAMA_URL}/api/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: MODEL, prompt, stream: false, options: { temperature: TEMP, num_ctx: NUM_CTX } })
    });
    const j: any = await r.json();
    return j?.response ?? null;
  } catch { return null; }
}

function naiveSummary(t: string): string {
  const sents = t.split(/(?<=[\.\?\!])\s+/).filter(x => x.trim().length > 0);
  const picks = sents.slice(0, 6);
  return picks.map(x => `• ${x.trim()}`).join('\n');
}

function cleanupJsonFence(s: string) {
  return s.trim().replace(/^```json\s*/i,'').replace(/```$/,'').trim();
}

async function callChat(prompt: string): Promise<string | null> {
  try {
    const r = await fetch(`${OLLAMA_URL}/api/chat`, {
      method: 'POST',
      headers: {'Content-Type':'application/json'},
      body: JSON.stringify({
        model: MODEL, stream: false,
        options: { temperature: TEMP, num_ctx: NUM_CTX },
        messages: [
          { role:'system', content:'Return ONLY the requested JSON.' },
          { role:'user', content: prompt }
        ]
      })
    });
    const j: any = await r.json();
    return j?.message?.content ?? j?.choices?.[0]?.message?.content ?? null;
  } catch { return null; }
}

async function callGenerate(prompt: string): Promise<string | null> {
  try {
    const r = await fetch(`${OLLAMA_URL}/api/generate`, {
      method: 'POST',
      headers: {'Content-Type':'application/json'},
      body: JSON.stringify({ model: MODEL, prompt, stream: false, options: { temperature: TEMP, num_ctx: NUM_CTX } })
    });
    const j: any = await r.json();
    return j?.response ?? null;
  } catch { return null; }
}

function heuristicFill(o: any, tRaw: string) {
  const t = tRaw.toLowerCase();
  const HAS = (re: RegExp) => re.test(t);
  const QUOTE = (re: RegExp, def?: string) => (t.match(re)?.[0] || def);

  const DEPENDS = /(depends entirely|totally dependent)/;
  const BEDFAST = /bedfast/;

  if (o.M1800.value === 'unknown') {
    if (HAS(new RegExp(`groom(ing)?[\\s\\S]*${DEPENDS.source}`)) || HAS(new RegExp(`${DEPENDS.source}[\\s\\S]*groom`))) {
      o.M1800.value = '3';
      o.M1800.evidence ||= QUOTE(/(depends entirely|totally dependent)[^.]*groom|groom[^.]*?(depends entirely|totally dependent)/, 'totally dependent for grooming');
    }
  }

  if (o.M1810.value === 'unknown') {
    if (HAS(/upper[^.]*totally dependent/) || HAS(/for both upper[^.]*totally dependent/) || HAS(/upper[^.]*depends entirely/)) {
      o.M1810.value = '3';
      o.M1810.evidence ||= QUOTE(/upper[^.]*totally dependent|for both upper[^.]*totally dependent|upper[^.]*depends entirely/, 'totally dependent (upper dressing)');
    }
  }

  if (o.M1820.value === 'unknown') {
    if (HAS(/lower[^.]*totally dependent/) || HAS(/for both[^.]*lower[^.]*totally dependent/) || HAS(/lower[^.]*depends entirely/)) {
      o.M1820.value = '3';
      o.M1820.evidence ||= QUOTE(/lower[^.]*totally dependent|for both[^.]*lower[^.]*totally dependent|lower[^.]*depends entirely/, 'totally dependent (lower dressing)');
    }
  }

  if (o.M1830.value === 'unknown') {
    if (HAS(/bathed entirely by another person/)) {
      o.M1830.value = '6';
      o.M1830.evidence ||= 'bathed entirely by another person';
    } else if (HAS(/presence throughout/)) {
      o.M1830.value = '3';
      o.M1830.evidence ||= 'presence throughout';
    }
  }

  if (o.M1840.value === 'unknown') {
    if (HAS(/totally dependent[^.]*toilet transfer|toilet transfers?[^.]*totally dependent/)) {
      o.M1840.value = '4';
      o.M1840.evidence ||= QUOTE(/totally dependent[^.]*toilet transfers?|toilet transfers?[^.]*totally dependent/, 'totally dependent for toilet transfers');
    }
  }

  if (o.M1850.value === 'unknown') {
    if (HAS(new RegExp(`${BEDFAST.source}[\\s\\S]*unable to transfer[\\s\\S]*unable to turn|unable to turn[\\s\\S]*${BEDFAST.source}`))) {
      o.M1850.value = '5';
      o.M1850.evidence ||= 'bedfast, unable to transfer and unable to turn or position self';
    } else if (HAS(/bear weight.*pivot.*cannot transfer/)) {
      o.M1850.value = '2';
      o.M1850.evidence ||= 'bear weight and pivot, cannot transfer self';
    }
  }

  if (o.M1860.value === 'unknown') {
    if (HAS(BEDFAST)) {
      o.M1860.value = '6';
      o.M1860.evidence ||= 'bedfast';
    } else if (HAS(/wheel(s|chair).*independent/)) {
      o.M1860.value = '4';
      o.M1860.evidence ||= QUOTE(/wheel[^.]*independent|chair[^.]*independent/, 'wheel self independently');
    }
  }

  if (o.confidence == null) o.confidence = 0.6;
  return o;
}

function backfillFeaturesWithRegex(f: OasisFeatures, raw: string): OasisFeatures {
  const t = raw.toLowerCase();
  const has = (re: RegExp) => re.test(t);
  const quote = (re: RegExp) => t.match(re)?.[0];

  if (!f.M1800?.status) {
    if (has(/groom(ing)?.*(no physical help|independent)/)) f.M1800 = { status:'unaided', evidence: quote(/groom[^.]*?(no physical help|independent)/) };
    else if (has(/groom(ing)?.*(after setup|within reach)/)) f.M1800 = { status:'setup_only', evidence: quote(/groom[^.]*?(after setup|within reach)/) };
    else if (has(/(assist|help).*groom/)) f.M1800 = { status:'assist', evidence: quote(/(assist|help)[^.]*groom/) };
    else if (has(/(depends entirely|totally dependent)[^.]*groom|groom[^.]*?(depends entirely|totally dependent)/)) f.M1800 = { status:'dependent', evidence: 'totally dependent for grooming' };
  }

  const fillDress = (cur:any, upper:boolean) => {
    if (cur?.status) return cur;
    const tag = upper ? 'upper' : 'lower';
    if (has(new RegExp(`${tag}[^.]*totally dependent|${tag}[^.]*depends entirely`))) return { status:'dependent', evidence: quote(new RegExp(`${tag}[^.]*totally dependent|${tag}[^.]*depends entirely`)) };
    if (has(new RegExp(`${tag}.*(laid out|handed)`))) return { status:'unaided_if_laid_out', evidence: quote(new RegExp(`${tag}[^.]*?(laid out|handed)`)) };
    if (has(new RegExp(`${tag}.*(help|assist)`)) || (!upper && has(/(partial assistance|needs help).*socks|shoes/))) return { status:'needs_help_put_on', evidence: quote(new RegExp(`(${tag}[^.]*?(help|assist)|partial assistance[^.]*?(socks|shoes)|needs help[^.]*?(socks|shoes))`)) };
    if (has(new RegExp(`${tag}.*without assistance`))) return { status:'unaided_full', evidence: quote(new RegExp(`${tag}[^.]*without assistance`)) };
    return cur ?? {};
  };
  f.M1810 = fillDress(f.M1810, true);
  f.M1820 = fillDress(f.M1820, false);

  if (!f.M1830?.status) {
    if (has(/bathed entirely by another person/)) f.M1830 = { status:'bathed_by_another', evidence:'bathed entirely by another person' };
    else if (has(/presence throughout/)) f.M1830 = { status:'presence_throughout', evidence:'presence throughout' };
    else if (has(/cannot safely use the shower/) && has(/bathe.*independent(ly)?.*sink.*(chair|seated)/))
      f.M1830 = { status:'independent_sink_chair', evidence: quote(/bathe[^.]*independent[^.]*sink[^.]*chair|cannot safely use the shower/) };
    else if (has(/contact guard.*(step in|step out|in and out)/))
      f.M1830 = { status:'intermittent_assist', evidence: quote(/contact guard[^.]*?(step in|step out|in and out)/) };
  }

  if (!f.M1840?.status) {
    if (has(/bedside commode/)) f.M1840 = { status:'bedside_commode', evidence:'uses bedside commode' };
    else if (has(/(reminded|assisted|supervised).*toilet transfers?|toilet transfers?.*(reminded|assisted|supervised)/))
      f.M1840 = { status:'reminded_assisted_supervised', evidence: quote(/(reminded|assisted|supervised)[^.]*toilet transfers?|toilet transfers?[^.]*?(reminded|assisted|supervised)/) };
    else if (has(/totally dependent[^.]*toilet transfers?|toilet transfers?[^.]*totally dependent/))
      f.M1840 = { status:'dependent', evidence: 'totally dependent for toilet transfers' };
  }

  if (!f.M1850?.status) {
    if (has(/bedfast/) && has(/unable to transfer/) && has(/unable to turn/)) f.M1850 = { status:'bedfast_cannot_turn', evidence:'bedfast, unable to transfer and to turn' };
    else if (has(/bear weight.*pivot.*cannot (complete )?transfer/)) f.M1850 = { status:'bear_weight_pivot_cannot_transfer_self', evidence: quote(/bear weight[^.]*pivot[^.]*cannot (complete )?transfer/) };
    else if (has(/minimal assistance.*(transfer|bed to chair|chair to bed)/)) f.M1850 = { status:'minimal_assist_or_device', evidence: quote(/minimal assistance[^.]*?(transfer|bed to chair|chair to bed)/) };
  }

  if (!f.M1860?.status) {
    if (has(/bedfast/)) f.M1860 = { status:'bedfast', evidence:'bedfast' };
    else if (has(/with a cane|one-handed device/)) f.M1860 = { status:'independent_one_handed_device', evidence: quote(/with a cane|one-handed device/) };
    else if (has(/(walker|crutches)/) || has(/(cues|supervision).*(stairs|uneven)/)) f.M1860 = { status:'two_handed_device_or_supervision_stairs', evidence: quote(/walker|crutches|cues.*(stairs|uneven)|supervision.*(stairs|uneven)/) };
  }

  return f;
}

export async function extractOasis(transcript: string) {
  try {
    const oasisData = await huggingFaceService.extractOasisData(transcript);
    const summary = await summarizeBullets(transcript);
    
    return {
      oasis: oasisData,
      summary,
      meta: {
        mode: 'huggingface',
        model: process.env.HF_MODEL,
        llmRuns: 1,
        llmVotes: 1,
        sources: ['huggingface']
      }
    };
  } catch (error) {
    const { codes: llmCodes, tried, model, runs } = await getCodesViaLLM(transcript); 
    const { merged, provenance } = reconcileAndFallback(llmCodes, transcript);
    const summary = await summarizeBullets(transcript);

    return {
      oasis: merged,
      summary,
      meta: {
        mode: 'llm+rules',
        model,
        llmRuns: tried,
        llmVotes: runs?.length ?? 0,
        sources: provenance
      }
    };
  }
}