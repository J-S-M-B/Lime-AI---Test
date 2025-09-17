# Lime AI Test answer – Made by Juan Sebastián Mosquera 
# AI Scribe – Home Health OASIS (Section G)

Backend system for processing clinical audio, transcription, and automated extraction of OASIS Section G data.

## 🚀 Quickstart

### Requirements
- Node.js 20+
- Docker + Docker Compose
- (Optional) Deepgram API Key (`DEEPGRAM_API_KEY`)
- (Optional) Local LLM via Ollama **or** OpenAI API

### Backend

#### Environment Variables
```env
DATABASE_URL=postgresql://app:app@localhost:5433/scribe?schema=public
PORT=4000
DEEPGRAM_API_KEY=your_deepgram_api_key_here
OLLAMA_URL=http://localhost:11435
OASIS_MODEL=llama3.2:3b
OLLAMA_NUM_CTX=8192
OLLAMA_TEMP=0.1
```

#### 1) Clone and install
```bash
cd server
npm install
```

#### 2) Start services
```bash
docker compose up -d db ollama
```

#### 3) Set up database
```bash
npx prisma generate
npx prisma migrate dev --name init
npm run db:seed
```

#### 4) Run API
```bash
npm run dev
```

## 🧩 API Endpoints

### POST `/api/notes`
Create a new note from clinical audio.

**Content-Type:** `multipart/form-data`

**Parameters:**
- `mrn` (string) – patient identifier
- `audio` (file) – .wav/.mp3/.m4a in English

**Response (200):** Creates note with:
- `transcriptRaw` - Full transcription
- `summary` - Clinical summary
- `oasisG` - M1800–M1860 codes + confidence
- `extractionMeta` - Extraction metadata (mode, model, llmRuns, sources, llmVotes)

### GET `/api/notes?mrn=...`
List patient notes (most recent first).

### GET `/api/notes/:id`
Get note details (includes patient information).

### GET `/api/patients`
List and filter patients (e.g., `?mrn=P0001`).

---

## 🖥️ Frontend

*(Space reserved for frontend information)*

<!-- 
### Frontend Setup
```bash
cd client
npm install
npm run dev
```

### Frontend Environment Variables
```env
VITE_API_URL=http://localhost:4000
VITE_APP_TITLE=AI Scribe OASIS
```
-->