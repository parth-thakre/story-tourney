import { getModelConfig } from "../config";
import { ModelAdapter, ModelKey } from "../types";
import { MockModelAdapter } from "./mockAdapter";
import { OpenRouterAdapter } from "./openrouterAdapter";

export function createModelAdapter(modelKey: ModelKey): ModelAdapter {
  const config = getModelConfig(modelKey);
  if (config.provider === "openrouter" && config.apiKey) {
    return new OpenRouterAdapter(modelKey, config.displayName, {
      apiKey: config.apiKey,
      modelId: config.providerModelId,
      providerOrder: config.providerOrder,
      siteUrl: config.siteUrl,
      appName: config.appName,
    });
  }
  return new MockModelAdapter(modelKey, config.displayName);
}
