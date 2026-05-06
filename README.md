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

Run locally:

```bash
npm run dev
```

Open:

- frontend: `http://localhost:9965`
- backend: `http://127.0.0.1:9966`

Add your OpenRouter API key and choose 2 to 4 OpenRouter models from the setup screen. The key is stored encrypted under local `data/`; without a saved key, the backend uses deterministic mock outputs.

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
