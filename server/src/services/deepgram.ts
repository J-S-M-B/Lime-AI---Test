import { createClient } from '@deepgram/sdk';
import fs from 'fs';

const dg = createClient(process.env.DEEPGRAM_API_KEY!);

function extractTranscript(resp: any): string {
  const ch = resp?.results?.channels?.[0] ?? resp?.result?.channels?.[0] ?? resp?.channels?.[0];
  const alt = ch?.alternatives?.[0];
  return (
    alt?.transcript ||
    alt?.paragraphs?.transcript ||
    (Array.isArray(alt?.words) ? alt.words.map((w: any) => w.word).join(' ') : '') ||
    ''
  );
}

export async function transcribeFile(filePath: string): Promise<string> {
  const buf = await fs.promises.readFile(filePath);
  // SDK feliz con forma “web”: Uint8Array
  const u8 = new Uint8Array(buf.buffer, buf.byteOffset, buf.byteLength);

  // 1) modelo principal (inglés)
  try {
    const r1: any = await dg.listen.prerecorded.transcribeFile(u8 as any, {
      model: 'nova-2',
      language: 'en',
      smart_format: true,
      punctuate: true,
    });
    const t1 = extractTranscript(r1);
    if (t1?.trim()) return t1;
    console.error('[DG:sdk nova-2] vacío', r1?.metadata || {});
  } catch (e: any) {
    console.error('[DG:sdk nova-2] error', e?.message || e);
  }

  // 2) fallback (inglés)
  try {
    const r2: any = await dg.listen.prerecorded.transcribeFile(u8 as any, {
      model: 'whisper',
      language: 'en',
      smart_format: true,
      punctuate: true,
    });
    const t2 = extractTranscript(r2);
    if (t2?.trim()) return t2;
    console.error('[DG:sdk whisper] vacío', r2?.metadata || {});
  } catch (e: any) {
    console.error('[DG:sdk whisper] error', e?.message || e);
  }

  // Si todo falló:
  return '';
}
