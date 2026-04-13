import { config as loadEnv } from "dotenv";
import { ModelKey, MODEL_KEYS, ModelRegistryEntry } from "./types";

loadEnv();

const DEFAULTS: Record<
  ModelKey,
  { displayName: string; modelId: string; providerModelId: string; providerOrder: string[] }
> = {
  sonnet: {
    displayName: "Anthropic Sonnet",
    modelId: "claude-sonnet-4.6",
    providerModelId: "anthropic/claude-sonnet-4.6",
    providerOrder: ["google-vertex/us-east5"],
  },
  gpt: {
    displayName: "OpenAI GPT",
    modelId: "gpt-5.4",
    providerModelId: "openai/gpt-5.4",
    providerOrder: ["azure"],
  },
  glm5: {
    displayName: "GLM-5",
    modelId: "glm-5",
    providerModelId: "z-ai/glm-5",
    providerOrder: ["venice/fp8"],
  },
  "kimi-k25": {
    displayName: "Kimi K2.5",
    modelId: "kimi-k2-0905",
    providerModelId: "moonshotai/kimi-k2-0905",
    providerOrder: ["groq"],
  },
};

const ENV_PREFIX: Record<ModelKey, string> = {
  sonnet: "SONNET",
  gpt: "GPT",
  glm5: "GLM5",
  "kimi-k25": "KIMI_K25",
};

export const PORT = Number.parseInt(process.env.PORT ?? "3001", 10);
export const DB_PATH = process.env.DB_PATH ?? "./data/story-tourney.sqlite";

export function getModelConfig(modelKey: ModelKey): ModelRegistryEntry {
  const prefix = ENV_PREFIX[modelKey];
  const apiKey = process.env.OPENROUTER_API_KEY ?? process.env[`${prefix}_API_KEY`] ?? null;
  const siteUrl = process.env.OPENROUTER_SITE_URL ?? process.env[`${prefix}_SITE_URL`] ?? null;
  const appName = process.env.OPENROUTER_APP_NAME ?? process.env[`${prefix}_APP_NAME`] ?? null;
  const providerOrder = (process.env[`${prefix}_PROVIDER_ORDER`] ?? DEFAULTS[modelKey].providerOrder.join(","))
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);
  return {
    modelKey,
    displayName: process.env[`${prefix}_DISPLAY_NAME`] ?? DEFAULTS[modelKey].displayName,
    modelId: process.env[`${prefix}_MODEL_ID_SHORT`] ?? DEFAULTS[modelKey].modelId,
    provider: apiKey ? "openrouter" : "mock",
    providerModelId: process.env[`${prefix}_MODEL_ID`] ?? DEFAULTS[modelKey].providerModelId,
    providerOrder,
    apiKey,
    siteUrl,
    appName,
  };
}

export function getModelRegistry() {
  return MODEL_KEYS.map((key) => getModelConfig(key));
}
