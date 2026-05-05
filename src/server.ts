import express from "express";
import { HOST, PORT, getModelRegistry } from "./config";
import { createTournamentSchema, retryTournamentSchema } from "./validation";
import { repository } from "./repository";
import { getTournamentView, retryTournamentRun, startTournamentRun } from "./orchestrator";
import { buildMarkdownExport, buildPlainTextExport } from "./export";
import { ModelKey } from "./types";

const app = express();
let shuttingDown = false;

app.disable("x-powered-by");
app.use(express.json({ limit: "2mb" }));

function formatErrorForLog(error: unknown) {
  if (error instanceof Error) {
    return error.stack ?? error.message;
  }
  return String(error);
}

app.get("/health", (_req, res) => {
  res.status(shuttingDown ? 503 : 200).json({ ok: !shuttingDown });
});

app.get("/api/models", (_req, res) => {
  res.json({
    models: getModelRegistry().map((model) => ({
      modelKey: model.modelKey,
      displayName: model.displayName,
      provider: model.provider,
      providerModelId: model.providerModelId,
    })),
  });
});

app.post("/api/tournaments", async (req, res, next) => {
  try {
    const parsed = createTournamentSchema.parse(req.body);
    const selectedModels = parsed.selectedModels.map((modelKey: ModelKey) => {
      const model = getModelRegistry().find((entry) => entry.modelKey === modelKey);
      if (!model) {
        throw new Error(`Unknown model: ${modelKey}`);
      }
      return model;
    });

    const tournament = repository.createTournament({
      prompt: parsed.prompt,
      genreHint: parsed.genreHint ?? null,
      minWords: parsed.minWords,
      maxWords: parsed.maxWords,
      selectedModels,
    });

    void startTournamentRun(tournament.id).catch((error) => {
      console.error(`Tournament run failed: ${formatErrorForLog(error)}`);
    });

    res.status(201).json(getTournamentView(tournament.id));
  } catch (error) {
    next(error);
  }
});

app.get("/api/tournaments", (_req, res) => {
  res.json({ tournaments: repository.listTournaments() });
});

app.get("/api/tournaments/:id", (req, res, next) => {
  try {
    res.json(getTournamentView(req.params.id));
  } catch (error) {
    next(error);
  }
});

app.post("/api/tournaments/:id/retry", async (req, res, next) => {
  try {
    retryTournamentSchema.parse(req.body ?? {});
    void retryTournamentRun(req.params.id).catch((error) => {
      console.error(`Tournament retry failed: ${formatErrorForLog(error)}`);
    });
    res.json(getTournamentView(req.params.id));
  } catch (error) {
    next(error);
  }
});

app.get("/api/tournaments/:id/export", (req, res, next) => {
  try {
    const format = (req.query.format ?? "md") as string;
    const body = format === "txt" ? buildPlainTextExport(req.params.id) : buildMarkdownExport(req.params.id);
    res.type(format === "txt" ? "text/plain" : "text/markdown").send(body);
  } catch (error) {
    next(error);
  }
});

app.use((error: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  const message = error instanceof Error ? error.message : "Unknown error";
  res.status(400).json({ error: message });
});

const server = app.listen(PORT, HOST, () => {
  console.log(`Story tournament backend listening on http://${HOST}:${PORT}`);
});

function shutdown(signal: NodeJS.Signals) {
  if (shuttingDown) {
    return;
  }

  shuttingDown = true;
  console.log(`${signal} received, shutting down Story Tourney backend`);
  server.close((error) => {
    if (error) {
      console.error("Failed to close HTTP server cleanly", error);
      process.exit(1);
    }
    process.exit(0);
  });

  setTimeout(() => {
    console.error("Forcing shutdown after timeout");
    process.exit(1);
  }, 10_000).unref();
}

process.on("SIGINT", () => shutdown("SIGINT"));
process.on("SIGTERM", () => shutdown("SIGTERM"));
