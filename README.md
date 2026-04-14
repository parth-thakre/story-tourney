# Story Tourney

Blind story tournaments across multiple LLMs, with generation, peer review, revision, final ranking, exports, and full run archives.

Inspired by Theo.

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

Create a root `.env` file if you want live OpenRouter calls.

Minimum setup:

```env
OPENROUTER_API_KEY=
```

That is the only required environment variable for live model calls.

If `OPENROUTER_API_KEY` is omitted, the backend falls back to deterministic mock outputs.

### Start Both Apps

From the repo root:

```bash
npm run dev
```

This starts:
- the frontend on `http://localhost:9965`
- the backend on `127.0.0.1:9966`

Only the frontend needs to be exposed externally. The frontend proxies both `/api/*` and `/health` to the private backend.

### Start Backend Only

```bash
npm run dev:backend
```

Useful endpoints:
- `http://127.0.0.1:9966/health`
- `http://127.0.0.1:9966/api/models`

### Start Frontend

```bash
cd frontend
npm run dev
```

Open:
- `http://localhost:9965`

The frontend expects the backend on `127.0.0.1:9966` by default and proxies requests through `frontend/next.config.ts`.

## Docker

For self-hosting, the repo includes a small two-container setup:

Fastest path:

```bash
npm run host
```

That starts the stack in Docker with the frontend bound to `127.0.0.1:9965` and the backend kept private behind it.

For tailnet access in one command:

```bash
npm run host:tailscale
```

To stop it:

```bash
npm run host:down
```

```bash
docker compose up --build
```

Published ports:
- frontend: `127.0.0.1:9965` by default

Internal service port:
- backend: `9966`

The frontend container proxies `/api/*` and `/health` to the backend container over the internal Docker network, so you only need to expose the frontend.

Docker publishes the frontend to loopback by default on purpose. This avoids the common `docker` plus `ufw` footgun where a `0.0.0.0` published port can bypass your expected firewall posture.

If you want a different bind address, set `FRONTEND_BIND_IP` explicitly.

To run detached:

```bash
docker compose up -d --build
```

To stop:

```bash
docker compose down
```

Helper script:

```bash
./scripts/start-selfhost.sh
```

The script creates `data/` and `tourneys/` if needed, sets safe Docker defaults, and starts the stack detached.

## Tailscale

Recommended setup with UFW enabled:

1. Keep the Docker default bind: `127.0.0.1:9965`
2. Use Tailscale to reach the app from trusted devices

Two workable options:

1. Bind Docker directly to your Tailscale IP:

```bash
export FRONTEND_BIND_IP="$(tailscale ip -4 | head -n 1)"
docker compose up -d --build
```

Then open:

```text
http://<your-tailscale-ip>:9965
```

You can also use your MagicDNS host name if enabled.

2. Keep Docker on loopback and use `tailscale serve` in front of it.

That keeps the app entirely local on the host while Tailscale exposes it only to your tailnet.

Helper script:

```bash
./scripts/tailscale-serve.sh
```

That script discovers the current machine's Tailscale identity dynamically and prints the usable tailnet URLs for this device. On a different machine or after an IP change, it will print that machine's addresses instead.

If you want the easiest private-hosting flow, use:

```bash
npm run host:tailscale
```

If you are using strict UFW rules, prefer one of those two approaches instead of binding Docker to `0.0.0.0`.

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
npm run build:backend
npm run start:backend
```

Frontend:

```bash
cd frontend
npm run build
npm start
```

Full stack from the repo root:

```bash
npm run build
npm start
```

## Notes

- `tourneys/`, `data/`, `.env`, and build artifacts are gitignored.
- The app is intentionally inspectable: request bodies, raw responses, retries, and phase snapshots are preserved.
