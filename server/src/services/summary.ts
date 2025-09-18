import { huggingFaceService } from '../services/huggingface';

const OLLAMA_URL = process.env.OLLAMA_URL;
const SUMMARY_MODEL = process.env.OASIS_MODEL;
const TEMP = Number(process.env.OLLAMA_TEMP ?? 0.2);
const NUM_CTX = Number(process.env.OLLAMA_NUM_CTX ?? 8192);


// --- Utilities ---
function toBullets(lines: string[]): string {
  const cleaned = lines
    .map(s => s.trim())
    .filter(Boolean)
    .map(s => {
      if (s.startsWith('- ') || s.startsWith('* ')) return '' + s.slice(2).trim();
      return '' + s;
    });

  const max = Math.min(7, Math.max(5, cleaned.length));
  return cleaned.slice(0, max).join('\n');
}

function splitSentences(t: string): string[] {
  return (t || '')
    .replace(/\s+/g, ' ')
    .split(/(?<=[\.\?\!])\s+/)
    .map(s => s.trim())
    .filter(Boolean);
}

// --- Heuristic Fallback (without LLM) ---
function heuristicBullets(tRaw: string): string {
  const t = (tRaw || '').toLowerCase();

  const has = (re: RegExp) => re.test(t);
  const pick = (re: RegExp, def?: string) => t.match(re)?.[0] ?? def;

  const bullets: string[] = [];

  // Grooming (M1800)
  if (has(/\bgroom(ing)?[^.]*no physical help|groom(ing)?[^.]*without assistance|groom(ing)?[^.]*independent(ly)?/)) {
    bullets.push('Grooming: independent.');
  } else if (has(/\bgroom(ing)?[^.]*after setup|after setup[^.]*groom(ing)?/)) {
    bullets.push('Grooming: independent after setup.');
  } else if (has(/(assist|help)[^.]*groom/)) {
    bullets.push('Grooming: needs assistance.');
  } else if (has(/(depends entirely|totally dependent)[^.]*groom|groom[^.]*depends entirely/)) {
    bullets.push('Grooming: totally dependent.');
  }

  // Upper-body dressing (M1810)
  if (has(/upper[^.]*needs (help|assistance) to put on/)) {
    bullets.push('Upper-body dressing: needs help to put on.');
  } else if (has(/upper[^.]*?(laid out|handed)/)) {
    bullets.push('Upper-body dressing: independent if clothing is laid out/handed.');
  } else if (has(/upper[^.]*without assistance|can get clothes and dress without assistance/)) {
    bullets.push('Upper-body dressing: independent.');
  } else if (has(/upper[^.]*totally dependent|upper[^.]*depends entirely/)) {
    bullets.push('Upper-body dressing: totally dependent.');
  }

  // Lower-body dressing (M1820)
  if (has(/(partial assistance|needs help)[^.]*\b(socks?|shoes?)\b/) || has(/lower[^.]*needs (help|assistance) to put on/)) {
    bullets.push('Lower-body dressing: needs help for socks/shoes.');
  } else if (has(/lower[^.]*?(laid out|handed)/)) {
    bullets.push('Lower-body dressing: independent if clothing/shoes are laid out.');
  } else if (has(/lower[^.]*without assistance|lower[^.]*independent(ly)?/)) {
    bullets.push('Lower-body dressing: independent.');
  } else if (has(/lower[^.]*totally dependent|lower[^.]*depends entirely/)) {
    bullets.push('Lower-body dressing: totally dependent.');
  }

  // Bathing (M1830)
  if (has(/bathed entirely by another person/)) {
    bullets.push('Bathing: totally bathed by another person.');
  } else if (has(/bathe[^.]*sink[^.]*chair|seated[^.]*sink/)) {
    if (has(/needs (help|assistance)[^.]*\b(back|lower (leg|legs))\b/)) {
      bullets.push('Bathing: at sink seated, needs assistance for back/lower legs.');
    } else {
      bullets.push('Bathing: independent at sink while seated on a chair.');
    }
  } else if (has(/contact guard[^.]*?(step in|step out|in and out)|intermittent (assist|assistance|supervision)/)) {
    bullets.push('Bathing: intermittent assistance (e.g., for stepping in/out).');
  } else if (has(/bath(es)? independently in (the )?shower[^.]*\b(grab bars?|non[- ]?slip mat|shower chair)\b/)) {
    bullets.push('Bathing: independent in shower with devices (grab bars/non-slip/shower chair).');
  } else if (has(/bath(es)? independently in (the )?shower/)) {
    bullets.push('Bathing: independent in shower.');
  } else if (has(/cannot safely use (the )?shower/)) {
    bullets.push('Bathing: cannot safely use shower.');
  }

  // Toilet transfers (M1840)
  if (has(/toilet transfers? (are )?independent|independent[^.]*toilet transfers?/)) {
    bullets.push('Toilet transfers: independent (devices allowed, e.g., grab bars).');
  } else if (has(/bedside commode/)) {
    bullets.push('Toilet transfers: uses bedside commode.');
  } else if (has(/(reminded|assisted|supervised)[^.]*toilet transfers?|toilet transfers?[^.]*\b(reminded|assisted|supervised)\b/)) {
    bullets.push('Toilet transfers: requires supervision/assistance.');
  } else if (has(/(bedpan|urinal)[^.]*independent(ly)?/)) {
    bullets.push('Toilet: uses bedpan/urinal independently.');
  }

  // Bed↔chair transfers (M1850)
  if (has(/minimal assistance[^.]*\b(transfer|bed to chair|chair to bed)\b/)) {
    bullets.push('Transfers (bed↔chair): minimal assistance required.');
  } else if (has(/bear weight[^.]*pivot[^.]*cannot (complete )?transfer/)) {
    bullets.push('Transfers: bears weight/pivots but cannot complete transfer independently.');
  } else if (has(/\bindependent(ly)?\b[^.]*\b(transfer|bed to chair|chair to bed)\b/)) {
    bullets.push('Transfers: independent.');
  } else if (has(/bedfast[^.]*unable to transfer[^.]*unable to turn|unable to turn[^.]*bedfast/)) {
    bullets.push('Transfers: bedfast, unable to transfer or turn.');
  }

  if (has(/bedfast/)) {
    bullets.push('Locomotion: bedfast.');
  } else if (has(/chair[-\s]?fast[^.]*wheel(s)? self independently|able to wheel self independently/)) {
    bullets.push('Locomotion: wheelchair independent on level surfaces.');
  } else if (has(/\b(rolling )?walker\b|crutches/)) {
    if (has(/(cues|supervision).*(stairs|uneven)/)) {
      bullets.push('Ambulation: walker; requires supervision/cues for stairs/uneven surfaces.');
    } else {
      bullets.push('Ambulation: uses walker.');
    }
  } else if (has(/\b(cane|one-handed device)\b/)) {
    bullets.push('Ambulation: independent with one-handed device (cane/hemi-walker).');
  } else if (has(/\bindependent(ly)?\b[^.]*\b(walk|ambulat)/)) {
    bullets.push('Ambulation: independent without device.');
  }

  const dist = pick(/(\b\d{2,3}\b|\b\d+\s?(feet|ft|meters|m)\b)/, undefined);
  if (dist) bullets.push(`Distance/Context: mentions ${dist}.`);
  if (has(/fall(s)? risk|unstead(y|iness)|safety|fatigue/)) bullets.push('Risk/Plan: safety cues, fall risk or fatigue noted.');

  const sents = splitSentences(tRaw);
  for (const s of sents) {
    if (bullets.length >= 7) break;
    const short = s.replace(/^[-•*]\s*/, '').trim();
    if (short && !bullets.some(b => b.toLowerCase().includes(short.slice(0, 20)))) {
      bullets.push(short.endsWith('.') ? short : short + '.');
    }
  }

  return toBullets(bullets);
}

// --- LLM from HuggingFace ---
async function huggingFaceBullets(transcript: string): Promise<string> {
  try {
    const prompt = `Summarize the encounter in 1 line, not more than 25 words.
Return PLAIN TEXT bullets (each line begins with "• "), no JSON, no headings.

"""${transcript.substring(0, 3000)}"""`; 

    const content = await huggingFaceService.generateText(prompt);
    
    if (!content || typeof content !== 'string') return '';

    // Cleaning and normalization
    const cleaned = content
      .replace(/^```(?:markdown|md)?\s*/i, '')
      .replace(/```$/i, '')
      .trim();

    const lines = cleaned.split(/\r?\n/).map(s => s.trim()).filter(Boolean);
    if (!lines.length) return '';

    return toBullets(lines);
  } catch (error) {
    console.error('Hugging Face bullets error:', error);
    return '';
  }
}

// --- LLM Ollama ---
async function ollamaBullets(transcript: string): Promise<string> {
  try {
    const prompt = `Summarize the encounter in 2-3 bullet points covering: grooming, dressing (upper/lower), bathing, toilet transfers, bed/chair transfers, ambulation/locomotion; include assistive devices, assistance levels, distances, and risks. 
Return PLAIN TEXT bullets , no JSON, no headings.

"""${transcript}"""`;

    const r = await fetch(`${OLLAMA_URL}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: SUMMARY_MODEL,
        stream: false,
        options: { temperature: TEMP, num_ctx: NUM_CTX },
        messages: [
          { role: 'system', content: 'You write concise clinical bullet summaries.' },
          { role: 'user', content: prompt }
        ]
      })
    });
    const j: any = await r.json();
    const content: string = j?.message?.content ?? j?.response ?? '';
    if (!content || typeof content !== 'string') return '';

    // Cleaning and normalization
    const cleaned = content
      .replace(/^```(?:markdown|md)?\s*/i, '')
      .replace(/```$/i, '')
      .trim();

    const lines = cleaned.split(/\r?\n/).map(s => s.trim()).filter(Boolean);
    if (!lines.length) return '';

    return toBullets(lines);
  } catch {
    return '';
  }
}

// --- Main API  ---
export async function summarizeBullets(transcript: string): Promise<string> {
  const hfResult = await huggingFaceBullets(transcript);
  if (hfResult && hfResult.trim()) return hfResult;

  const llm = await ollamaBullets(transcript);
  if (llm && llm.trim()) return llm;

  return heuristicBullets(transcript);
}
