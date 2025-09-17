const OLLAMA_URL = process.env.OLLAMA_URL;

export async function pingOllama(): Promise<boolean> {
  try {
    const r = await fetch(`${OLLAMA_URL}/api/tags`, { method: 'GET' });
    return r.ok;
  } catch {
    return false;
  }
}

export async function hasModel(model: string): Promise<boolean> {
  try {
    const r = await fetch(`${OLLAMA_URL}/api/tags`, { method: 'GET' });
    if (!r.ok) return false;
    const j: any = await r.json();
    const list: any[] = j?.models ?? j?.data ?? [];
    return list.some(m => m?.model === model || m?.name === model || m?.name?.startsWith(`${model}:`));
  } catch {
    return false;
  }
}

export async function ensureModel(model: string): Promise<void> {
  try {
    if (await hasModel(model)) return;
    // dispara el pull (puede tardar; no esperamos a que termine)
    await fetch(`${OLLAMA_URL}/api/pull`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: model, stream: false })
    }).catch(() => {});
  } catch {/*noop*/}
}
