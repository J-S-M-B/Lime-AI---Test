# Lime AI Test Answer – AI Scribe (Home Health OASIS Section G)

Backend system for processing clinical audio, transcription, and automated extraction of OASIS Section G data.

## 🚀 Quickstart

### Requirements
- Node.js 20+
- Docker + Docker Compose
- Deepgram API Key (`DEEPGRAM_API_KEY`)
- HuggingFace (`HUGGINGFACE_API_KEY`)
- Local LLM via Ollama

### Backend Setup
### Package.json
```json
{
  "name": "server",
  "version": "1.0.0",
  "scripts": {
    "dev": "nodemon --watch src --ext ts --exec ts-node src/index.ts",
    "db:migrate": "prisma migrate dev --schema=prisma/schema.prisma",
    "db:seed": "ts-node prisma/seed.ts",
    "prisma:generate": "prisma generate --schema=prisma/schema.prisma"
  },
  "dependencies": {
    "@deepgram/sdk": "^4.11.2",
    "@huggingface/inference": "^4.8.0",
    "@prisma/client": "^6.16.1",
    "cors": "^2.8.5",
    "express": "^5.1.0",
    "multer": "^2.0.2",
    "zod": "^4.1.8"
  },
  "devDependencies": {
    "@types/express": "^5.0.3",
    "@types/multer": "^2.0.0",
    "nodemon": "^3.1.10",
    "ts-node": "^10.9.2",
    "typescript": "^5.9.2"
  }
}
```

#### Environment Variables
Create a `.env` file in the server directory:
```env
DATABASE_URL=postgresql://app:app@localhost:5433/scribe?schema=public
PORT=4000
DEEPGRAM_API_KEY="Your_api_key"
OLLAMA_URL=http://localhost:11435
OASIS_MODEL="phi3:mini"
OLLAMA_NUM_CTX=4096
OLLAMA_TEMP=0.1
HUGGINGFACE_API_KEY="Your_api_key"
HF_MODEL=Qwen/Qwen3-Next-80B-A3B-Instruct

```

#### 1) Clone and install dependencies
```bash
cd server
npm install
```

#### 2) Start services with Docker
```bash
docker compose up -d db ollama
```

#### 3). Start Docker containers (database and Ollama)
```bash
docker exec ollama ollama pull llama3.2:3b
```

#### 4). Download the Ollama model (required after Ollama container starts)
```bash
docker exec ollama ollama pull llama3.2:3b

```

#### 5) Set up database
```bash
npx prisma generate
npx prisma migrate dev --name init
npm run db:seed
```

#### 6) Run the API server
```bash
npm run dev
```

## ⚡ How interaction wiht LLM's works

### Fallback Mechanism
1. **Hugging Face Failure**: If the primary service fails or times out. (Primary) - Highest accuracy, cloud-based
2. **Ollama Backup**: switches to local Ollama instance with smaller models. (Secondary) - Local fallback, faster response  
3. **Heuristic Rules**: Final fallback uses rule-based extraction if both AI services fail. (Tertiary) - Rule-based, always available

## 🧩 API Endpoints

### POST `/api/notes`
Create a new note from clinical audio.

**Content-Type:** `multipart/form-data`

**Parameters:**
- `mrn` (string) – Patient identifier
- `audio` (file) – Audio file in .wav, .mp3, or .m4a format (English only)

**Response (200):** Returns a note object containing:
- `transcriptRaw` - Full transcription text
- `summary` - Clinical summary
- `oasisG` - M1800–M1860 codes with confidence scores
- `extractionMeta` - Extraction metadata (mode, model, llmRuns, sources, llmVotes)

### GET `/api/notes?mrn=...`
Retrieve patient notes sorted by most recent first.

### GET `/api/notes/:id`
Get detailed note information including patient data.

### GET `/api/patients`
List and filter patients (e.g., `?mrn=P0001`).

---

## 🖥️ Frontend Application

### ✨ Features

- Upload clinical audio files to generate automated notes
- List notes by Medical Record Number (MRN)
- View detailed notes including:
  - Full transcription
  - Clinical summary
  - OASIS G codes (M1800–M1860) with supporting evidence
  - Extraction metadata and confidence scores

## 📦 Technology Stack

- **Frontend**: Vite + React + TypeScript
- **Styling**: TailwindCSS with tailwind-merge, clsx, and tailwindcss-animate
- **UI Components**: shadcn/ui (Card, Button, Input, Textarea, Tabs, Dialog, Badge, Separator)
- **Icons**: lucide-react  

### Package.json
```json
{
  "name": "web",
  "private": true,
  "version": "0.0.0",
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "tsc -b && vite build",
    "preview": "vite preview"
  },
  "dependencies": {
    "react": "^19.1.1",
    "react-dom": "^19.1.1",
    "lucide-react": "^0.544.0"
  },
  "devDependencies": {
    "@types/react": "^19.1.10",
    "@types/react-dom": "^19.1.7",
    "@vitejs/plugin-react": "^5.0.0",
    "tailwindcss": "^4.1.13",
    "typescript": "~5.8.3",
    "vite": "^5.0.0"
  }
}
```

### Frontend Setup

```bash
cd web
npm install
npm run dev
```

Access the application at: [http://localhost:5173](http://localhost:5173)

> **API Base URL** can be adjusted from the settings icon in the top-right UI (default: `http://localhost:4000`). Settings are persisted in `localStorage`.

## ⚙️ Configuration

### API Base URL

- Editable at runtime via UI (persisted in `localStorage` under `oasis.api` key)
- **Optional**: Set default value via environment variable. Create `web/.env`:

  ```
  VITE_API_BASE=http://localhost:4000
  ```

  Then update `App.tsx` to use: `import.meta.env.VITE_API_BASE ?? "http://localhost:4000"`

### shadcn/ui Components

To regenerate or add components:

```bash
npx shadcn-ui@latest init
npx shadcn-ui@latest add button card input textarea badge dialog tabs separator
```

## 🧪 Usage

1. Select or enter an **MRN** (e.g., `P0003`)
2. Attach an **audio file** (English, clear audio recommended)
3. Click **Create Note** → note will be created and detail view opened
4. Open **OASIS G** tab to view M1800–M1860 codes with evidence
5. Open **Meta** tab to view extraction details: `mode`, `model`, `llmRuns`, `llmVotes`, `sources`

## 🛠️ Available Scripts

```bash
npm run dev       # Start development server
npm run build     # Create production build
npm run preview   # Preview production build locally
```

## 🔐 CORS Configuration

Backend must allow origin `http://localhost:5173`. For development, configure CORS with whitelist or `origin: true`.

## 🩹 Troubleshooting

- **CSS not applying** → Ensure `./src/index.css` is imported in `main.tsx` and `tailwind.config.js` has correct `content` paths
- **Import errors** (`@/components/ui/...`) → Re-run `shadcn-ui add...` and restart VSCode TS Server
- **Fetch 404/500 errors** → Verify backend is running on correct port and MRN exists
- **Upload not working** → Validate file size/type and ensure backend accepts `multipart/form-data`

---

**Developed by Juan Sebastián Mosquera**