import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { ClipboardList, ExternalLink, FileAudio2, Info, List, Loader2, RefreshCcw, Settings, Upload, User2 } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";

// -----------------------------
// Types
// -----------------------------

type Patient = {
  id: string;
  firstName: string;
  lastName: string;
  dob: string;
  mrn: string;
  createdAt: string;
};

type OasisItem = { value: string; evidence?: string };

type OasisCodes = {
  M1800: OasisItem;
  M1810: OasisItem;
  M1820: OasisItem;
  M1830: OasisItem;
  M1840: OasisItem;
  M1850: OasisItem;
  M1860: OasisItem;
  confidence?: number;
};

type ExtractionMeta = {
  mode?: string;
  model?: string;
  llmRuns?: boolean;
  llmVotes?: number;
  sources?: Record<keyof OasisCodes, 'llm' | 'rules' | 'adjusted'> & Record<string, unknown>;
};

type Note = {
  id: string;
  patientId: string;
  audioUrl?: string | null;
  transcriptRaw: string;
  summary: string;
  oasisG: OasisCodes;
  extractionMeta?: ExtractionMeta | null;
  createdAt: string;
  patient?: Patient;
};

// -----------------------------
// Helpers
// -----------------------------

const OASIS_LABELS: Record<keyof Omit<OasisCodes, 'confidence'>, string> = {
  M1800: "M1800 • Grooming",
  M1810: "M1810 • Dress Upper Body",
  M1820: "M1820 • Dress Lower Body",
  M1830: "M1830 • Bathing",
  M1840: "M1840 • Toilet Transferring",
  M1850: "M1850 • Transferring",
  M1860: "M1860 • Ambulation/Locomotion",
};

function fmtDate(iso?: string) {
  if (!iso) return "";
  const d = new Date(iso);
  return d.toLocaleString();
}

function useLocalStorage(key: string, initial: string) {
  const [v, setV] = useState<string>(() => localStorage.getItem(key) ?? initial);
  useEffect(() => { localStorage.setItem(key, v); }, [key, v]);
  return [v, setV] as const;
}

async function api<T>(baseUrl: string, path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${baseUrl}${path}`, init);
  if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
  return res.json();
}

// -----------------------------
// Main App
// -----------------------------

export default function App() {
  const [baseUrl, setBaseUrl] = useLocalStorage("oasis.api", "http://localhost:4000");
  const [loading, setLoading] = useState(false);
  const [patients, setPatients] = useState<Patient[]>([]);
  const [mrn, setMrn] = useLocalStorage("oasis.mrn", "");
  const [notes, setNotes] = useState<Note[]>([]);
  const [selected, setSelected] = useState<Note | null>(null);
  const [error, setError] = useState<string>("");

  // Upload state
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Initial load patients
  useEffect(() => {
    (async () => {
      try {
        const data = await api<Patient[]>(baseUrl, "/api/patients");
        setPatients(data);
        console.log("Patients loaded:", data);
      } catch (e: unknown) {
        setError(e instanceof Error ? e.message : String(e));
      }
    })();
  }, [baseUrl]);

  async function refreshNotes() {
    if (!mrn) { setNotes([]); return; }
    setLoading(true);
    setError("");
    try {
      const data = await api<Note[]>(baseUrl, `/api/notes?mrn=${encodeURIComponent(mrn)}`);
      // sort desc by createdAt just in case
      data.sort((a,b)=> new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      setNotes(data);
    } catch (e:unknown) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }

  async function openNote(id: string) {
    try {
      const n = await api<Note>(baseUrl, `/api/notes/${id}`);
      setSelected(n);
    } catch (e:unknown) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }

  async function doUpload() {
    if (!mrn) { setError("Enter an MRN first"); return; }
    if (!file) { setError("Choose an audio file"); return; }
    setUploading(true);
    setError("");
    try {
      const fd = new FormData();
      fd.append("mrn", mrn);
      fd.append("audio", file);
      const res = await fetch(`${baseUrl}/api/notes`, { method: "POST", body: fd });
      if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
      const created: Note = await res.json();
      setFile(null);
      if (fileInputRef.current) fileInputRef.current.value = "";
      // prepend
      setNotes(prev => [created, ...prev]);
      setSelected(created);
    } catch (e:unknown) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setUploading(false);
    }
  }

  const currentPatient = useMemo(() => patients.find(p => p.mrn === mrn) || null, [patients, mrn]);

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-white">
      <div className="max-w-6xl mx-auto p-4 md:p-8">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center gap-4 mb-6">
          <div className="flex items-center gap-2">
            <ClipboardList className="h-6 w-6" />
            <h1 className="text-2xl font-semibold">AI Scribe – OASIS Section G</h1>
          </div>
          <div className="md:ml-auto flex items-center gap-2">
            <Settings className="h-4 w-4" />
            <Input
              value={baseUrl}
              onChange={(e)=>setBaseUrl(e.target.value)}
              className="w-[320px]"
              placeholder="API base URL (http://localhost:4000)"
            />
            <Button variant="outline" onClick={refreshNotes} title="Refresh notes">
              <RefreshCcw className="h-4 w-4 mr-1" /> Refresh
            </Button>
          </div>
        </div>

        {/* MRN + Upload */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><User2 className="h-5 w-5" /> Patient & Upload</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div className="space-y-1">
                <label className="text-sm text-slate-600">Select Patient</label>
                <select 
                  value={mrn} 
                  onChange={(e) => {
                    setMrn(e.target.value);
                    if (e.target.value) refreshNotes();
                  }}
                  className="w-full p-2 border rounded-md bg-white"
                >
                  <option value="">Select a patient...</option>
                  {patients.map(patient => (
                    <option key={patient.id} value={patient.mrn}>
                      {patient.mrn}: {patient.firstName} {patient.lastName}
                    </option>
                  ))}
                </select>
                
                {currentPatient && (
                  <div className="text-xs text-slate-500 mt-1">
                    DOB: {fmtDate(currentPatient.dob)} • Created: {fmtDate(currentPatient.createdAt)}
                  </div>
                )}
              </div>

              <div className="space-y-1 md:col-span-2">
                <label className="text-sm text-slate-600">Audio (wav/mp3/m4a) – English</label>
                <div className="flex items-center gap-2">
                  <Input ref={fileInputRef} type="file" accept="audio/*" onChange={(e)=> setFile(e.target.files?.[0] ?? null)} />
                    <Button variant="secondary" onClick={doUpload} disabled={uploading}>
                      {uploading ? <Loader2 className="h-4 w-4 mr-2 animate-spin"/> : <Upload className="h-4 w-4 mr-2"/>}
                      Create Note
                    </Button>
                </div>
                {file && <div className="text-xs text-slate-500">Selected: {file.name} ({Math.round(file.size/1024)} KB)</div>}
              </div>
            </div>
            {error && (
              <div className="text-red-600 text-sm flex items-center gap-2"><Info className="h-4 w-4"/> {error}</div>
            )}
          </CardContent>
        </Card>

        {/* Notes List */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><List className="h-5 w-5"/> Notes {mrn ? <span className="text-slate-500 text-base">for {mrn}</span> : null}</CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="py-10 text-center text-slate-500 flex items-center justify-center gap-2">
                <Loader2 className="h-4 w-4 animate-spin"/> Loading...
              </div>
            ) : notes.length === 0 ? (
              <div className="py-10 text-center text-slate-500">No notes yet. Upload an audio to create one.</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full text-sm">
                  <thead>
                    <tr className="text-left text-slate-600">
                      <th className="py-2 pr-4">Created</th>
                      <th className="py-2 pr-4">Patient</th>
                      <th className="py-2 pr-4">Summary</th>
                      <th className="py-2 pr-4">OASIS G (confidence)</th>
                      <th className="py-2 pr-4">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {notes.map(n => (
                      <tr key={n.id} className="border-t">
                        <td className="py-2 pr-4 whitespace-nowrap">{fmtDate(n.createdAt)}</td>
                        <td className="py-2 pr-4 whitespace-nowrap">
                          {n.patient ? (
                            <span>{n.patient.firstName} {n.patient.lastName} <Badge variant="secondary" className="ml-2">{n.patient.mrn}</Badge></span>
                          ) : (
                            <Badge variant="outline">{mrn || n.patientId}</Badge>
                          )}
                        </td>
                        <td className="py-2 pr-4 max-w-[420px]">
                          <div className="line-clamp-2 text-slate-700 whitespace-pre-wrap">{n.summary || '—'}</div>
                        </td>
                        <td className="py-2 pr-4 whitespace-nowrap">
                          <Badge>{typeof n.oasisG?.confidence === 'number' ? `${Math.round(n.oasisG.confidence*100)}%` : '—'}</Badge>
                        </td>
                        <td className="py-2 pr-4">
                          <Button size="sm" variant="outline" onClick={()=>openNote(n.id)}>Open</Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Note Detail Dialog */}
      <Dialog open={!!selected} onOpenChange={(o)=> !o && setSelected(null)}>
        <DialogContent className="max-w-4xl">
          {selected ? (
            <div className="space-y-4">
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <ClipboardList className="h-5 w-5"/> Note · {selected.id}
                </DialogTitle>
                <DialogDescription>
                  Created {fmtDate(selected.createdAt)} · {selected.patient ? `${selected.patient.firstName} ${selected.patient.lastName} (${selected.patient.mrn})` : selected.patientId}
                </DialogDescription>
              </DialogHeader>

              <Tabs defaultValue="summary">
                <TabsList>
                  <TabsTrigger value="summary">Summary</TabsTrigger>
                  <TabsTrigger value="oasis">OASIS G</TabsTrigger>
                  <TabsTrigger value="transcript">Transcript</TabsTrigger>
                  <TabsTrigger value="meta">Meta</TabsTrigger>
                </TabsList>

                <TabsContent value="summary" className="mt-3">
                  <Card>
                    <CardContent className="pt-4">
                      <pre className="whitespace-pre-wrap text-sm leading-relaxed text-slate-800">{selected.summary || '—'}</pre>
                    </CardContent>
                  </Card>
                </TabsContent>

                <TabsContent value="oasis" className="mt-3">
                  <Card>
                    <CardContent className="pt-4">
                      <div className="flex items-center gap-2 mb-3">
                        <Badge variant="secondary">Confidence: {typeof selected.oasisG?.confidence === 'number' ? `${Math.round(selected.oasisG.confidence*100)}%` : '—'}</Badge>
                      </div>
                      <div className="overflow-x-auto">
                        <table className="min-w-full text-sm">
                          <thead>
                            <tr className="text-left text-slate-600">
                              <th className="py-2 pr-4">Item</th>
                              <th className="py-2 pr-4">Code</th>
                              <th className="py-2 pr-4">Evidence</th>
                            </tr>
                          </thead>
                          <tbody>
                            {(["M1800","M1810","M1820","M1830","M1840","M1850","M1860"] as const).map(k => {
                              const it = selected.oasisG?.[k];
                              return (
                                <tr key={k} className="border-t align-top">
                                  <td className="py-2 pr-4 font-medium whitespace-nowrap">{OASIS_LABELS[k]}</td>
                                  <td className="py-2 pr-4 whitespace-nowrap"><Badge variant="outline">{it?.value ?? 'unknown'}</Badge></td>
                                  <td className="py-2 pr-4 text-slate-700"><span className="block min-w-[260px]">{it?.evidence || '—'}</span></td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    </CardContent>
                  </Card>
                </TabsContent>

                <TabsContent value="transcript" className="mt-3">
                  <Card>
                    <CardContent className="pt-4">
                      <div className="flex items-center gap-2 mb-3">
                        {selected.audioUrl && (
                          <a className="inline-flex items-center gap-1 text-sm text-blue-600 hover:underline" href={selected.audioUrl} target="_blank" rel="noreferrer">
                            <FileAudio2 className="h-4 w-4"/> Open audio <ExternalLink className="h-3 w-3"/>
                          </a>
                        )}
                      </div>
                      <Textarea value={selected.transcriptRaw || ''} readOnly className="min-h-[220px]" />
                    </CardContent>
                  </Card>
                </TabsContent>

                <TabsContent value="meta" className="mt-3">
                  <Card>
                    <CardContent className="pt-4 space-y-2">
                      <div className="text-sm text-slate-700">Mode: <Badge variant="outline">{selected.extractionMeta?.mode || '—'}</Badge></div>
                      <div className="text-sm text-slate-700">Model: <Badge variant="outline">{selected.extractionMeta?.model || '—'}</Badge></div>
                      <div className="text-sm text-slate-700">LLM Runs: <Badge variant="outline">{String(selected.extractionMeta?.llmRuns ?? false)}</Badge></div>
                      {typeof selected.extractionMeta?.llmVotes === 'number' && (
                        <div className="text-sm text-slate-700">Votes: <Badge variant="outline">{selected.extractionMeta?.llmVotes}</Badge></div>
                      )}
                      <Separator className="my-2" />
                      <pre className="bg-slate-50 p-3 rounded-md text-xs overflow-auto max-h-[260px]">{JSON.stringify(selected.extractionMeta, null, 2)}</pre>
                    </CardContent>
                  </Card>
                </TabsContent>
              </Tabs>

              <DialogFooter>
                <Button variant="outline" onClick={()=>setSelected(null)}>Close</Button>
              </DialogFooter>
            </div>
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  );
}
