# Self-Hosting

## Goal

- frontend exposed on `9965`
- backend private on `9966`
- safe default for a host using UFW
- easy Tailscale access for trusted devices

## Requirements

- Docker with `docker compose`
- optional: Tailscale

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
./scripts/start-selfhost.sh
./scripts/tailscale-serve.sh
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
- `scripts/start-selfhost.sh`
- `scripts/tailscale-serve.sh`

## Helpful Commands

```bash
npm run host
npm run host:tailscale
npm run host:down
docker compose logs -f
tailscale serve status
```
