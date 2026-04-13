import { config as loadEnv } from "dotenv";
import { getModelRegistry } from "../src/config";

loadEnv();

const apiKey = process.env.OPENROUTER_API_KEY;

if (!apiKey) {
  console.error("OPENROUTER_API_KEY missing");
  process.exit(1);
}

const prompt = [
  "Write a 100-200 word scene about a person finding a note in an empty train station.",
  "Return valid JSON only.",
  'Schema: {"title":"string","story":"string"}',
].join(" ");

async function run() {
  const models = getModelRegistry();

  for (const model of models) {
    const body = {
      model: model.providerModelId,
      messages: [
        { role: "system", content: "Return valid JSON only. No markdown fences. No <think> tags." },
        { role: "user", content: prompt },
      ],
      temperature: 0.7,
      provider: {
        order: model.providerOrder,
        require_parameters: true,
        data_collection: "deny",
        zdr: true,
      },
      response_format: { type: "json_object" },
    };

    const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
        ...(model.siteUrl ? { "HTTP-Referer": model.siteUrl } : {}),
        ...(model.appName ? { "X-OpenRouter-Title": model.appName } : {}),
      },
      body: JSON.stringify(body),
    });

    const text = await response.text();
    console.log(`\n=== ${model.displayName} (${model.providerModelId}) ===`);
    console.log(`provider.order=${JSON.stringify(model.providerOrder)}`);
    console.log(`status=${response.status}`);
    console.log(text.slice(0, 1200));
  }
}

void run().catch((error) => {
  console.error(error);
  process.exit(1);
});
