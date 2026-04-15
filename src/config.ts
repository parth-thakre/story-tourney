import { config as loadEnv } from "dotenv";
import path from "node:path";
import { z } from "zod";
import { ModelKey, ModelRegistryEntry } from "./types";

const APP_ROOT = path.resolve(__dirname, "..");

loadEnv({ path: path.join(APP_ROOT, ".env") });

const DEFAULT_MODELS = [
  {
    modelKey: "sonnet",
    displayName: "claude-sonnet-4.6",
    modelId: "claude-sonnet-4.6",
    providerModelId: "anthropic/claude-sonnet-4.6",
    providerOrder: ["google-vertex/us-east5"],
  },
  {
    modelKey: "gpt",
    displayName: "gpt-5.4",
    modelId: "gpt-5.4",
    providerModelId: "openai/gpt-5.4",
    providerOrder: ["azure"],
  },
  {
    modelKey: "glm5",
    displayName: "GLM-5",
    modelId: "glm-5",
    providerModelId: "z-ai/glm-5",
    providerOrder: ["venice/fp8"],
  },
  {
    modelKey: "kimi-k25",
    displayName: "kimi-k2-0905",
    modelId: "kimi-k2-0905",
    providerModelId: "moonshotai/kimi-k2-0905",
    providerOrder: ["groq"],
  },
] as const;

const modelDefinitionSchema = z.object({
  modelKey: z.string().trim().min(1),
  displayName: z.string().trim().min(1),
  modelId: z.string().trim().min(1).optional(),
  providerModelId: z.string().trim().min(1),
  providerOrder: z.array(z.string().trim().min(1)).optional(),
});

const modelRegistrySchema = z.array(modelDefinitionSchema).min(4).superRefine((models, ctx) => {
  const seen = new Set<string>();
  models.forEach((model, index) => {
    if (seen.has(model.modelKey)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: [index, "modelKey"],
        message: `Duplicate modelKey: ${model.modelKey}`,
      });
      return;
    }
    seen.add(model.modelKey);
  });
});

export const HOST = process.env.HOST ?? "127.0.0.1";
export const PORT = Number.parseInt(process.env.PORT ?? "9966", 10);
const rawDbPath = process.env.DB_PATH ?? path.join("data", "story-tourney.sqlite");
export const DB_PATH = path.isAbsolute(rawDbPath) ? rawDbPath : path.join(APP_ROOT, rawDbPath);

const configuredModels = loadModelDefinitions();
const modelRegistry = configuredModels.map((model) => buildModelConfig(model));
const modelRegistryByKey = new Map(modelRegistry.map((model) => [model.modelKey, model]));

export function getModelConfig(modelKey: ModelKey): ModelRegistryEntry {
  const config = modelRegistryByKey.get(modelKey);
  if (!config) {
    throw new Error(`Unknown model: ${modelKey}`);
  }
  return config;
}

export function getModelRegistry() {
  return modelRegistry;
}

function loadModelDefinitions() {
  if (!process.env.MODEL_REGISTRY_JSON) {
    return modelRegistrySchema.parse(DEFAULT_MODELS);
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(process.env.MODEL_REGISTRY_JSON);
  } catch (error) {
    throw new Error(`Invalid MODEL_REGISTRY_JSON: ${error instanceof Error ? error.message : String(error)}`);
  }

  return modelRegistrySchema.parse(parsed);
}

function buildModelConfig(model: z.infer<typeof modelDefinitionSchema>): ModelRegistryEntry {
  const prefix = toEnvPrefix(model.modelKey);
  const apiKey = process.env.OPENROUTER_API_KEY ?? process.env[`${prefix}_API_KEY`] ?? null;
  const siteUrl = process.env.OPENROUTER_SITE_URL ?? process.env[`${prefix}_SITE_URL`] ?? null;
  const appName = process.env.OPENROUTER_APP_NAME ?? process.env[`${prefix}_APP_NAME`] ?? null;
  const resolvedProviderModelId = process.env[`${prefix}_MODEL_ID`] ?? model.providerModelId;
  const resolvedModelId =
    process.env[`${prefix}_MODEL_ID_SHORT`] ??
    model.modelId ??
    resolvedProviderModelId.split("/").pop() ??
    resolvedProviderModelId;
  const providerOrder = (process.env[`${prefix}_PROVIDER_ORDER`] ?? (model.providerOrder ?? []).join(","))
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);

  return {
    modelKey: model.modelKey,
    displayName: process.env[`${prefix}_DISPLAY_NAME`] ?? resolvedModelId,
    modelId: resolvedModelId,
    provider: apiKey ? "openrouter" : "mock",
    providerModelId: resolvedProviderModelId,
    providerOrder,
    apiKey,
    siteUrl,
    appName,
  };
}

function toEnvPrefix(modelKey: string) {
  return modelKey.replace(/[^a-zA-Z0-9]+/g, "_").replace(/^_+|_+$/g, "").toUpperCase();
}
