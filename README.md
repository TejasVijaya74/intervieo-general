
# Intervieo: The Personalized AI Career Coach

An end-to-end, production-grade Next.js application that delivers a hyper-personalized mock interview experience grounded in a user’s resume and a target job description, powered by a Retrieval-Augmented Generation (RAG) pipeline, PostgreSQL, and Prisma—culminating in an asynchronous, data-rich performance report. This project is designed as a portfolio centerpiece to showcase strong AI/ML fundamentals and robust system design.

- Framework: Next.js (App Router; full-stack frontend + backend routes)
- Database: PostgreSQL
- ORM: Prisma
- Styling: Tailwind CSS
- AI: Gemini API (embeddings + text generation)
- Optional: Task queue + worker for asynchronous analysis
- Optional: Vector DB (future-ready; initial implementation stores vectors in Postgres JSON)

> Note: If any filenames or paths differ in your repository, adapt references accordingly. This README documents the complete architecture across Phases 1–4.

---

## Why Intervieo?

- Hyper-personalized interviews grounded in the candidate’s own resume and the targeted role.
- Real RAG: retrieves relevant resume/JD snippets before generation for context-aware questions.
- System design you can present confidently: ingestion, asynchronous analysis, persistence, and a scalable workflow.
- Practical ML: embeddings, similarity search, vectorized context, and prompt engineering.
- Modern web app: Next.js full-stack with clean UX, clear data flow, and production-ready patterns.

---

## Architecture Overview

Intervieo is built progressively in four phases while preserving clean boundaries and testable units.

### Phase 1 — Foundation
- Landing page introduces Intervieo and value proposition.
- Setup page (`/setup`) for uploading a resume (PDF) and providing a job URL with basic validation, error states, and loading states.
- Prisma schema for core entities: `User`, `Session`, `Message`, and `Report`.
- Backend route `/api/session/create` receives inputs, initializes a session, and redirects to `/interview/[sessionId]`.
- Placeholder interview page validates routing and session handoff.

### Phase 2 — RAG Pipeline
- PDF parsing extracts text from the resume.
- Web scraping cleans and extracts text from the job description URL.
- Text chunking prepares content for embeddings.
- Gemini embeddings are generated for each chunk.
- Resume/JD text and embeddings are stored in Postgres (JSON), simulating a vector store without additional infrastructure.

### Phase 3 — Personalized Interview
- Fully functional chat UI at `/interview/[sessionId]`.
- New API: `/api/interview/ask`
  - Converts user’s latest answer into an embedding.
  - Runs cosine similarity over stored vectors to retrieve top‑k relevant chunks.
  - Builds a grounded prompt and asks Gemini for the next, tailored question.
- The interview is a live RAG loop that ties together context, user messaging, and targeted questioning.

### Phase 4 — Analysis & Reporting (Asynchronous)
- “Finish Interview” triggers an asynchronous analysis workflow.
- Backend computes:
  - Pace (words/minute)
  - Clarity score (filler‑word heuristic)
  - Qualitative summary (Gemini) with strengths and areas to improve
- Report page at `/report/[sessionId]` initially shows “generating” and polls until ready.
- Final report presents metrics, visualizations, and feedback.

---

## System Design Highlights

- Retrieval‑Augmented Generation:
  - Embeddings from resume and JD chunks.
  - Cosine similarity to find relevant context.
  - Prompt construction grounded in retrieved snippets.

- Asynchronous Processing:
  - End interview → enqueue a work item (e.g., `process_interview(sessionId)`).
  - Worker performs heavy tasks (transcription, speech analysis, Gemini summarization).
  - UI polls a status endpoint; results persisted to DB.

- Modular Back‑End:
  - Session creation/intake
  - Interview Q/A generation
  - Report generation (async)
  - Clear separation of concerns and stateless handlers

- Data Privacy & Robustness:
  - Sanitization of scraped content.
  - Controlled file types/sizes for resume uploads.
  - Minimal logging of sensitive content.

---

## Data Model (Prisma)

Core models include:

- `User`
  - Owns sessions; extendable with auth (e.g., NextAuth)
- `Session`
  - Links to uploaded artifacts (resume), job URL
  - Stores raw extracted text and vectorStore (JSON arrays of embeddings and chunk metadata)
  - Tracks lifecycle (`created`, `interviewing`, `analyzing`, `complete`)
- `Message`
  - Role (`user` | `assistant`), content, timestamps
  - Represents the interview transcript
- `Report`
  - Metrics: words per minute, filler‑word‑based clarity
  - Qualitative AI‑generated summary
  - Status and timestamps

Run `prisma generate`/`migrate` to set up and evolve the schema.

---

## Project Structure

```
app/
  page.tsx                       # Landing page
  setup/page.tsx                 # Resume + JD intake UI
  interview/[sessionId]/page.tsx # Chat interface
  report/[sessionId]/page.tsx    # Report UI with polling
  api/
    session/create/route.ts      # Intake: parse, scrape, chunk, embed, persist, redirect
    interview/ask/route.ts       # Embedding + similarity search + Gemini question
    report/generate/route.ts     # Trigger async analysis
    report/status/route.ts       # Polling endpoint for report readiness
prisma/
  schema.prisma
  migrations/
lib/
  pdf.ts         # PDF parsing
  scrape.ts      # Job scraping & cleaning
  chunk.ts       # Chunking strategy
  embed.ts       # Gemini embedding utilities
  similarity.ts  # Cosine similarity & top‑k retrieval
  prompts.ts     # Prompt builders (questions & report)
  analysis.ts    # Pace/clarity metrics & report assembly
components/
  # UI components (forms, chat bubbles, loaders, charts)
styles/
  globals.css     # Tailwind setup
```

> Paths may vary—use this as a logical map.

---

## Getting Started

### Prerequisites
- Node.js (LTS)
- PostgreSQL (local or managed)
- Prisma CLI
- Gemini API key
- pnpm or npm

### Environment Variables

Create `.env` from `.env.example` and set:

```
DATABASE_URL=postgres://USER:PASSWORD@HOST:PORT/DB
GEMINI_API_KEY=your_key
NEXT_PUBLIC_APP_URL=http://localhost:3000
# Optional tuning
CHUNK_SIZE=1200
CHUNK_OVERLAP=200
REPORT_POLL_INTERVAL_MS=1500
MAX_UPLOAD_MB=10
```

### Install & Run

```
pnpm install              # or npm install
npx prisma generate
npx prisma migrate dev
pnpm dev                  # or npm run dev
# open http://localhost:3000
```

---

## Usage

1) Intake
- Go to `/setup`
- Upload resume (PDF) and paste job description URL
- Submit to create a session; system parses/scrapes, chunks, embeds, stores vectorStore
- Redirected to `/interview/[sessionId]`

2) Interview
- Chat UI presents questions personalized to resume + JD
- Each answer is embedded; server runs similarity over stored chunks and generates the next question grounded in retrieved context

3) Finish & Analyze
- Click “Finish Interview”
- App triggers asynchronous analysis job
- Redirect to `/report/[sessionId]` which shows a generating state and polls server

4) Report
- View pace (WPM), clarity score, conversation stats
- Read qualitative summary (Gemini) with actionable feedback

---

## Implementation Notes

- PDF Parsing: robust extraction and cleanup to minimize noise.
- Web Scraping: sanitize HTML, remove scripts/styles, extract readable text; handle timeouts and retries.
- Chunking: token/char‑based with overlap to preserve context; tune sizes for cost/quality.
- Embeddings: Gemini embedding model; store as JSON number arrays for portability.
- Similarity Search: cosine similarity; configurable top‑k and score threshold.
- Async Analysis:
  - Compute WPM from transcript length and timestamps.
  - Clarity: heuristic counting filler words (configurable list).
  - Summary: instruct Gemini with structured, concise rubric.

---

## Scripts

```
pnpm dev                  # Start development server
pnpm build                # Production build
pnpm start                # Start production server
pnpm lint                 # Lint codebase
pnpm typecheck            # TypeScript checks
npx prisma generate       # Generate Prisma client
npx prisma migrate dev    # Create/apply migrations
```

---

## Testing

- Unit tests:
  - Parsing, scraping, chunking
  - Embeddings and similarity search
  - Prompt construction
  - Metrics (pace, clarity)
- Integration/e2e:
  - Intake → Interview → Report flow
- Use a test DB or shadow DB via Prisma

---

## Deployment

- Database: managed Postgres (e.g., Neon/Supabase/RDS)
- ENV: `DATABASE_URL`, `GEMINI_API_KEY`
- Build: `pnpm build`; deploy on a platform supporting Next.js App Router
- File uploads: ensure body size limits; optionally offload resumes to object storage (S3/GCS) and store references in DB
- Observability: basic logs; consider tracing/metrics for ingestion and ask/report endpoints

---

## Security & Privacy

- Validate file type/size; sanitize URLs and scraped content.
- Avoid logging raw resume/job text or embeddings.
- Use HTTPS; secure cookie/session handling if auth is enabled.
- Keep secrets out of source control; use environment managers.

---

## Roadmap

- Replace JSON vectors with `pgvector` or an external vector DB (Pinecone, Qdrant)
- Authentication and multi‑tenant support (NextAuth)
- Advanced analytics (topic strengths, charts, timelines)
- Prompt versioning and evaluation harness
- Multi‑modal: audio capture, transcription, and sentiment/tone analysis
- Horizontal workers with a proper queue (e.g., Redis queue, Cloud Tasks)

---

## Troubleshooting

- Migrations failing:
  - Check `DATABASE_URL` and DB connectivity
  - Run `npx prisma migrate reset` (drops data) if schema diverged locally
- Gemini errors:
  - Verify `GEMINI_API_KEY`, quotas, and model names
- Large PDFs fail:
  - Increase request body limit; consider streaming extraction
- Report never completes:
  - Ensure async worker updates report status; polling endpoint reads correct state

---

## License

MIT (recommended). Include a `LICENSE` file in the repo root.

---

## Acknowledgments

Inspired by modern RAG patterns and production‑grade web architecture with Next.js, Prisma, and Postgres. Thanks to the open‑source community for tools enabling robust AI applications.
