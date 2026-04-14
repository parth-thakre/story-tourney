# Story Tourney Frontend

Next.js frontend for the Story Tourney app.

## Run

```bash
npm install
npm run dev
```

The app expects the backend at `http://127.0.0.1:9966` by default through the rewrite in `next.config.ts`.

The standard entrypoint for the full app is the repo root:

```bash
npm run dev
```

That starts the frontend on `9965` and the backend on `9966`.

Main UI surfaces:
- setup
- live tournament run
- results
- history

See the root `README.md` for full project setup.
