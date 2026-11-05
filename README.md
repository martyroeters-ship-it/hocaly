# Kelime

A local-first Turkish vocabulary app for English-speaking learners (A1–C2). Words are learned in context, recalled from memory, and reviewed with FSRS spaced repetition.

## Stack

- Next.js 16 (App Router) + TypeScript
- Tailwind CSS + shadcn/ui
- SQLite via Prisma
- Gemini / OpenAI behind one server-side provider
- `ts-fsrs` for scheduling
- Browser speech synthesis for Turkish audio

No authentication. Data stays in `prisma/dev.db`. Auth, sync, and extra languages can be added later without rewriting the vocabulary or review model.

## Architecture

```
src/app/(app)          UI routes
src/app/api            Route handlers (DB + AI stay on the server)
src/components         Screens and shadcn primitives
src/lib/ai             Provider abstraction, Zod schemas, prompts
src/lib/import         Bulk parsers
src/lib/eval           Deterministic answer matching
src/lib/srs            FSRS adapter
src/lib/repos          Persistence
```

API keys are read from `.env` only. Nothing AI-related is bundled for the browser.

## Setup

```bash
cp .env.example .env
# optional: GEMINI_API_KEY or OPENAI_API_KEY
npx prisma db push
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). Settings → **Load sample words** if you want a starter list.

## Tests

```bash
npm run test:run
```

Covers import parsing, duplicate handling, FSRS scheduling, and answer evaluation.
