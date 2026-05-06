import path from "node:path";
import { z } from "zod";
import { ModelKey, ModelRegistryEntry } from "./types";
import { getOpenRouterApiKey, getSecureSettings } from "./secureSettings";

const APP_ROOT = path.resolve(__dirname, "..");

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

const modelRegistrySchema = z.array(modelDefinitionSchema).min(2).superRefine((models, ctx) => {
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

export function getModelConfig(modelKey: ModelKey): ModelRegistryEntry {
  const modelRegistry = getModelRegistry();
  const config = modelRegistry.find((model) => model.modelKey === modelKey);
  if (!config) {
    throw new Error(`Unknown model: ${modelKey}`);
  }
  return config;
}

export function getModelRegistry() {
  return loadModelDefinitions().map((model) => buildModelConfig(model));
}

function loadModelDefinitions() {
  const secureModels = getSecureSettings().models;
  if (secureModels.length >= 2) {
    return modelRegistrySchema.parse(secureModels);
  }

  return modelRegistrySchema.parse(DEFAULT_MODELS);
}

function buildModelConfig(model: z.infer<typeof modelDefinitionSchema>): ModelRegistryEntry {
  const apiKey = getOpenRouterApiKey();
  const resolvedProviderModelId = model.providerModelId;
  const resolvedModelId = model.modelId ?? resolvedProviderModelId.split("/").pop() ?? resolvedProviderModelId;

  return {
    modelKey: model.modelKey,
    displayName: model.displayName,
    modelId: resolvedModelId,
    provider: apiKey ? "openrouter" : "mock",
    providerModelId: resolvedProviderModelId,
    providerOrder: model.providerOrder ?? [],
    apiKey,
    siteUrl: null,
    appName: null,
  };
}
