# Story Tourney

Blind story tournaments across multiple LLMs, with generation, peer review, revision, final ranking, exports, and full run archives.

## Overview

Story Tourney runs the same prompt through four models, anonymizes the outputs, has the models critique one another, gives each model a revision pass, and then asks them to rank the final stories. Results are aggregated with Borda scoring and exposed through a backend API plus a Next.js frontend.

Current lineup:
- `claude-sonnet-4.6`
- `gpt-5.4`
- `glm-5`
- `kimi-k2-0905`

## Features

- Blind multi-model story generation
- Peer review and revision rounds
- Final ranking with Borda aggregation
- Markdown and plain-text exports
- Editable prompt templates in `prompts/*.md`
- Full filesystem archives for every tournament in `tourneys/`
- SQLite persistence
- OpenRouter-backed live routing with mock fallback for local development

## Stack

- Backend: `Node.js`, `TypeScript`, `Express`, `SQLite`, `better-sqlite3`, `zod`
- Frontend: `Next.js 16`, `React 19`, `TypeScript`
- Model gateway: `OpenRouter`

## Project Layout

```text
.
|- frontend/          Next.js app
|- prompts/           Editable generation/review/revision/ranking prompts
|- scripts/           Smoke and debug scripts
|- src/               Backend server, orchestration, adapters, exports
|- tourneys/          Archived requests, responses, and snapshots per run
|- openapi.yaml       Backend API spec
|- MVP_SPEC.md        Original product spec
```

## Running Locally

### Install

Backend:

```bash
npm install
```

Frontend:

```bash
cd frontend
npm install
```

### Configure

Create a root `.env` file.

Minimum setup:

```env
PORT=3001
DB_PATH=./data/story-tourney.sqlite
OPENROUTER_API_KEY=
OPENROUTER_SITE_URL=
OPENROUTER_APP_NAME=Story Tourney
```

If `OPENROUTER_API_KEY` is omitted, the backend falls back to deterministic mock outputs.

### Start Backend

```bash
npm run dev
```

Useful endpoints:
- `http://localhost:3001/health`
- `http://localhost:3001/api/models`

### Start Frontend

In another terminal:

```bash
cd frontend
npm run dev
```

Open:
- `http://localhost:3000`

The frontend proxies `/api/*` to the backend through `frontend/next.config.ts`.

## Model Routing

Default live routing:

- `anthropic/claude-sonnet-4.6` -> `google-vertex/us-east5`
- `openai/gpt-5.4` -> `azure`
- `z-ai/glm-5` -> `venice/fp8`
- `moonshotai/kimi-k2-0905` -> `groq`

OpenRouter requests are sent with ZDR-related provider settings.

## Archives

Every tournament is archived under:

```text
tourneys/<tournamentId>/
```

Each run stores:
- per-call request, response, context, and metadata files
- tournament snapshots as phases complete
- raw provider payloads for debugging retries and failures

## API

Main routes:

- `GET /health`
- `GET /api/models`
- `POST /api/tournaments`
- `GET /api/tournaments`
- `GET /api/tournaments/:id`
- `POST /api/tournaments/:id/retry`
- `GET /api/tournaments/:id/export?format=md|txt`

Full schema: `openapi.yaml`

## Prompt Editing

Prompt templates are plain Markdown files:

- `prompts/generation.md`
- `prompts/review.md`
- `prompts/revision.md`
- `prompts/ranking.md`

You can edit them directly without changing code.

## Build

Backend:

```bash
npm run build
npm start
```

Frontend:

```bash
cd frontend
npm run build
npm start
```

## Notes

- `tourneys/`, `data/`, `.env`, and build artifacts are gitignored.
- The app is intentionally inspectable: request bodies, raw responses, retries, and phase snapshots are preserved.
