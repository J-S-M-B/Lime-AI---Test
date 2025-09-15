import { Prisma, PrismaClient } from '@prisma/client';
import cors from 'cors';
import 'dotenv/config';
import express from 'express';
import fs from 'fs';
import multer from 'multer';
import path from 'path';
import { transcribeFile } from './services/deepgram';
import { extractOasis } from './services/extractOasis';


const app = express();
const prisma = new PrismaClient();

app.use(cors());
app.use(express.json());

app.get('/health', (_req, res) => res.json({ ok: true }));

app.get('/api/patients', async (_req, res) => {
  const pts = await prisma.patient.findMany({ orderBy: { lastName: 'asc' } });
  res.json(pts);
});

const PORT = process.env.PORT ? Number(process.env.PORT) : 4000;
app.listen(PORT, () => console.log(`server on :${PORT}`));

const uploadDir = path.join(process.cwd(), 'uploads');
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, uploadDir),
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname || '');
    cb(null, `${Date.now()}-${Math.random().toString(16).slice(2)}${ext}`);
  }
});
const upload = multer({ storage });
app.use('/uploads', express.static(uploadDir));

app.post('/api/notes', upload.single('audio'), async (req, res) => {
  try {
    const mrn = req.body?.mrn as string | undefined;
    if (!mrn) return res.status(400).json({ error: 'mrn required' });
    if (!req.file) return res.status(400).json({ error: 'audio missing' });

    const patient = await prisma.patient.findUnique({ where: { mrn } });
    if (!patient) return res.status(404).json({ error: 'patient not found' });

    const transcriptRaw = await transcribeFile(req.file.path);

    if (!transcriptRaw?.trim()) {
      return res.status(422).json({ error:'Audio must be English and audible.' });
    }

    const { oasis, summary, meta } = await extractOasis(transcriptRaw);

    const note = await prisma.note.create({
      data: {
        patient: { connect: { id: patient.id } },
        audioUrl: `/uploads/${req.file.filename}`,
        transcriptRaw,
        summary,
        oasisG: oasis as any,
        extractionMeta: meta as any
      } satisfies Prisma.NoteCreateInput,
      include: { patient: true }
    });


    res.json(note);
  } catch (e:any) {
      console.error('create note error:', e?.message || e);
      return res.status(502).json({
        error: 'ASR or extraction failed',
        detail: e?.message || String(e)
      });
    }
});

app.get('/api/notes', async (req, res) => {
  const mrn = req.query.mrn as string | undefined;
  const notes = await prisma.note.findMany({
    where: mrn ? { patient: { mrn } } : {},
    include: { patient: true },
    orderBy: { createdAt: 'desc' }
  });
  res.json(notes);
});

app.get('/api/debug/transcribe', async (req, res) => {
  const file = req.query.file as string;
  if (!file) return res.status(400).json({ error: 'file query required' });
  const filePath = path.join(process.cwd(), 'uploads', file);
  if (!fs.existsSync(filePath)) return res.status(404).json({ error: 'file not found' });

  const transcript = await transcribeFile(filePath); 
  res.json({ ok: true, transcript });
});

const memUpload = multer({ storage: multer.memoryStorage() }); 

app.post('/api/debug/transcribe-upload', memUpload.single('audio'), async (req, res) => {
  try {
    const fs = await import('fs');
    const path = await import('path');
    const tmp = path.join(process.cwd(), 'uploads', `tmp-${Date.now()}.wav`);
    await fs.promises.mkdir(path.join(process.cwd(), 'uploads'), { recursive: true });
    await fs.promises.writeFile(tmp, req.file!.buffer);

    const transcript = await transcribeFile(tmp);
    await fs.promises.unlink(tmp);

    res.json({ ok: true, transcript });
  } catch (e:any) {
    console.error(e);
    res.status(500).json({ error: 'debug transcribe failed' });
  }
});

// server/src/index.ts
app.get('/api/debug/extract-from-note', async (req, res) => {
  const id = req.query.id as string;
  if (!id) return res.status(400).json({ error: 'id required' });
  const note = await prisma.note.findUnique({ where: { id } });
  if (!note) return res.status(404).json({ error: 'note not found' });
  const { oasis, summary, meta } = await extractOasis(note.transcriptRaw);
  return res.json({ oasis, summary, meta });
});


