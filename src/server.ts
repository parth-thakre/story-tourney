import express from "express";
import cors from "cors";
import { PORT, getModelRegistry } from "./config";
import { createTournamentSchema, retryTournamentSchema } from "./validation";
import { repository } from "./repository";
import { getTournamentView, retryTournamentRun, startTournamentRun } from "./orchestrator";
import { buildMarkdownExport, buildPlainTextExport } from "./export";
import { ModelKey } from "./types";

const app = express();

app.use(cors());
app.use(express.json({ limit: "2mb" }));

app.get("/health", (_req, res) => {
  res.json({ ok: true });
});

app.get("/api/models", (_req, res) => {
  res.json({ models: getModelRegistry() });
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
      console.error("Tournament run failed", error);
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
      console.error("Tournament retry failed", error);
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

app.listen(PORT, () => {
  console.log(`Story tournament backend listening on http://localhost:${PORT}`);
});
