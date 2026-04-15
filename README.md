# Story Tourney

Blind story tournaments across multiple LLMs.

Inspired by Theo.

## What It Does

Story Tourney runs the same prompt through four models, anonymizes the outputs, has them review each other, gives each one a revision pass, and then ranks the final stories.

## Stack

- Backend: `Node.js`, `TypeScript`, `Express`, `SQLite`
- Frontend: `Next.js 16`, `React 19`
- Model gateway: `OpenRouter`

## Quick Start

Install dependencies:

```bash
npm install
npm --prefix frontend install
```

Optional live model config:

```bash
cp .env.example .env
```

Set `OPENROUTER_API_KEY` in `.env` if you want live OpenRouter calls. Without it, the backend uses deterministic mock outputs.

Run locally:

```bash
npm run dev
```

Open:

- frontend: `http://localhost:9965`
- backend: `http://127.0.0.1:9966`

## Self-Hosting

Cross-platform private hosting (Windows, Linux, Raspberry Pi with Docker):

```bash
npm run host
```

Tailscale-friendly private hosting:

```bash
npm run host:tailscale
```

More deployment details are in [`selfhost.md`](./selfhost.md).
