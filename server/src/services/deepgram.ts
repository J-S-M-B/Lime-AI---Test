import { createClient } from '@deepgram/sdk';
import axios from 'axios';
import fs from 'fs';
import { lookup } from 'mime-types';

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

async function trySdk(u8: Uint8Array, model: string) {
  try {
    const resp: any = await dg.listen.prerecorded.transcribeFile(u8 as any, {
      model,
      language: 'en-US',          // fuerza inglés
      smart_format: true,
      punctuate: true,
    });
    const t = extractTranscript(resp);
    if (t?.trim()) return { transcript: t, meta: resp?.metadata };
    console.error(`[DG:sdk ${model}] vacío`, resp?.metadata || {});
    return { transcript: '', meta: resp?.metadata };
  } catch (e: any) {
    console.error(`[DG:sdk ${model}] error`, e?.message || e);
    return { transcript: '', meta: null };
  }
}

async function tryRest(buffer: Buffer, mimetype: string, model: string) {
  try {
    const url = `https://api.deepgram.com/v1/listen?model=${encodeURIComponent(model)}&language=en-US&smart_format=true&punctuate=true`;
    const resp = await axios.post(url, buffer, {
      headers: {
        Authorization: `Token ${process.env.DEEPGRAM_API_KEY!}`,
        'Content-Type': mimetype || 'application/octet-stream',
      },
      // evita compresión rara
      maxBodyLength: Infinity,
      maxContentLength: Infinity,
      validateStatus: () => true,
    });
    const data = resp.data;
    const t = extractTranscript(data);
    if (t?.trim()) return { transcript: t, meta: data?.metadata };
    console.error('[DG:rest] sin transcript', { status: resp.status, meta: data?.metadata, err: data?.error });
    return { transcript: '', meta: data?.metadata };
  } catch (e: any) {
    console.error('[DG:rest] fail', e?.message || e);
    return { transcript: '', meta: null };
  }
}

export async function transcribeFile(filePath: string): Promise<string> {
  const buf = await fs.promises.readFile(filePath);
  const u8 = new Uint8Array(buf.buffer, buf.byteOffset, buf.byteLength);
  const mimetype = String(lookup(filePath) || 'audio/wav');

  // 1) SDK con modelo principal
  let r = await trySdk(u8, 'nova-2');
  if (r.transcript) return r.transcript;

  // 2) SDK con fallback
  r = await trySdk(u8, 'whisper');
  if (r.transcript) return r.transcript;

  // 3) REST con axios (más permisivo con tipos)
  r = await tryRest(buf, mimetype, 'nova-2');
  if (r.transcript) return r.transcript;

  r = await tryRest(buf, mimetype, 'whisper');
  return r.transcript || '';
}
