# Self-Hosting

## Goal

- frontend exposed on `9965`
- backend private on `9966`
- safe default for a host using UFW
- easy Tailscale access for trusted devices
- persistent data stored in Docker-managed volumes

## Requirements

- Docker with `docker compose`
- optional: Tailscale

The supported scripts work on Windows and Linux, including Raspberry Pi systems that can run Docker and Node.

## Environment

If you want live OpenRouter calls:

```bash
cp .env.example .env
```

Then set:

```env
OPENROUTER_API_KEY=
```

If `.env` is missing or the key is empty, the backend uses deterministic mock outputs.

The self-host scripts load `.env` automatically before starting Docker or Tailscale publishing.

### Model Catalog

The backend exposes the available model list from environment-backed config.

If `MODEL_REGISTRY_JSON` is unset, the built-in defaults are used:

- `sonnet`
- `gpt`
- `glm5`
- `kimi-k25`

You can override the catalog completely with a JSON array in `.env`:

```env
MODEL_REGISTRY_JSON=[{"modelKey":"sonnet","displayName":"Anthropic Sonnet","modelId":"claude-sonnet-4.6","providerModelId":"anthropic/claude-sonnet-4.6","providerOrder":["google-vertex/us-east5"]},{"modelKey":"gpt","displayName":"OpenAI GPT","modelId":"gpt-5.4","providerModelId":"openai/gpt-5.4","providerOrder":["azure"]},{"modelKey":"glm5","displayName":"GLM-5","modelId":"glm-5","providerModelId":"z-ai/glm-5","providerOrder":["venice/fp8"]},{"modelKey":"kimi-k25","displayName":"Kimi K2.5","modelId":"kimi-k2-0905","providerModelId":"moonshotai/kimi-k2-0905","providerOrder":["groq"]}]
```

Rules:

- keep at least 4 models configured
- tournaments still run with exactly 4 selected models
- `modelKey` can be any stable string

Per-model env overrides use the uppercased `modelKey` with non-alphanumeric characters converted to underscores.

Example:

- `gemini-2.5-pro` becomes `GEMINI_2_5_PRO_DISPLAY_NAME`
- `gemini-2.5-pro` becomes `GEMINI_2_5_PRO_MODEL_ID`
- `gemini-2.5-pro` becomes `GEMINI_2_5_PRO_API_KEY`
- `gemini-2.5-pro` becomes `GEMINI_2_5_PRO_PROVIDER_ORDER`

## Easiest Host Flow

Start the stack:

```bash
npm run host
```

Stop it:

```bash
npm run host:down
```

This runs:

- frontend on `127.0.0.1:9965`
- backend internally on `9966`
- waits for both containers to become healthy before returning

The frontend proxies `/api/*` and `/health` to the backend.

## Tailscale

Recommended private setup:

```bash
npm run host:tailscale
```

That:

- starts Docker
- keeps the frontend bound to loopback by default
- publishes access through `tailscale serve`
- prints the current device's MagicDNS name and Tailscale IP

This is portable across machines because it does not hardcode any IP. The helper reads the current machine's Tailscale identity at runtime.

You can also run the steps separately:

```bash
node scripts/start-selfhost.mjs
node scripts/tailscale-serve.mjs
```

## UFW Note

The Docker setup binds the frontend to `127.0.0.1:9965` by default on purpose. That avoids exposing the app broadly through Docker's published port behavior.

If you want to bind directly to a different interface, set:

```bash
export FRONTEND_BIND_IP=<desired-ip>
npm run host
```

For strict private hosting, prefer loopback plus Tailscale Serve.

## Files

- `docker-compose.yml`
- `Dockerfile.backend`
- `frontend/Dockerfile`
- `scripts/start-selfhost.mjs`
- `scripts/tailscale-serve.mjs`

## Helpful Commands

```bash
npm run host
npm run host:tailscale
npm run host:down
docker compose logs -f
tailscale serve status
```

## Production Notes

- The frontend container uses Next.js standalone output for a smaller runtime surface.
- Both containers run with `restart: unless-stopped`, `no-new-privileges`, dropped Linux capabilities, read-only root filesystems, and healthchecks.
- Persistent app data lives in the Docker volumes `backend-data` and `backend-tourneys`.
- Keep the frontend bound to loopback unless you intentionally want LAN exposure.
