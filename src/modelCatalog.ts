import { z } from "zod";
import { StoredModelDefinition } from "./secureSettings";

const MODELS_DEV_API = "https://models.dev/api.json";

const modelsDevModelSchema = z.object({
  id: z.string().trim().min(1),
  name: z.string().trim().min(1).optional(),
  family: z.string().optional(),
  release_date: z.string().optional(),
  last_updated: z.string().optional(),
  cost: z
    .object({
      input: z.number().optional(),
      output: z.number().optional(),
    })
    .optional(),
  limit: z
    .object({
      context: z.number().optional(),
      output: z.number().optional(),
    })
    .optional(),
});

const modelsDevSchema = z.object({
  openrouter: z.object({
    models: z.record(modelsDevModelSchema),
  }),
});

export interface OpenRouterCatalogModel extends StoredModelDefinition {
  family: string | null;
  contextLength: number | null;
  inputCost: number | null;
  outputCost: number | null;
  releaseDate: string | null;
  lastUpdated: string | null;
}

let cachedCatalog: { fetchedAt: number; models: OpenRouterCatalogModel[] } | null = null;
const CATALOG_TTL_MS = 1000 * 60 * 30;

export async function getOpenRouterCatalog() {
  if (cachedCatalog && Date.now() - cachedCatalog.fetchedAt < CATALOG_TTL_MS) {
    return cachedCatalog.models;
  }

  const response = await fetch(MODELS_DEV_API);
  if (!response.ok) {
    throw new Error(`models.dev returned ${response.status}`);
  }

  const parsed = modelsDevSchema.parse(await response.json());
  const seen = new Set<string>();
  const models = Object.values(parsed.openrouter.models)
    .filter((model) => {
      if (seen.has(model.id)) {
        return false;
      }
      seen.add(model.id);
      return true;
    })
    .map((model) => ({
      modelKey: model.id,
      displayName: model.name ?? model.id,
      modelId: model.id.split("/").pop() ?? model.id,
      providerModelId: model.id,
      providerOrder: [],
      family: model.family ?? null,
      contextLength: model.limit?.context ?? null,
      inputCost: model.cost?.input ?? null,
      outputCost: model.cost?.output ?? null,
      releaseDate: model.release_date ?? null,
      lastUpdated: model.last_updated ?? null,
    }))
    .sort((a, b) => a.displayName.localeCompare(b.displayName));

  cachedCatalog = { fetchedAt: Date.now(), models };
  return models;
}
