import { config as loadEnv } from "dotenv";

loadEnv();

const apiKey = process.env.OPENROUTER_API_KEY;

if (!apiKey) {
  console.error("OPENROUTER_API_KEY missing");
  process.exit(1);
}

const tests = [
  {
    name: "azure+json+zdr",
    body: {
      model: "openai/gpt-5.4",
      messages: [{ role: "user", content: 'Return valid JSON only: {"ok":true}' }],
      provider: { order: ["azure"], require_parameters: true, data_collection: "deny", zdr: true },
      response_format: { type: "json_object" },
    },
  },
  {
    name: "azure+json",
    body: {
      model: "openai/gpt-5.4",
      messages: [{ role: "user", content: 'Return valid JSON only: {"ok":true}' }],
      provider: { order: ["azure"], require_parameters: true },
      response_format: { type: "json_object" },
    },
  },
  {
    name: "azure basic",
    body: {
      model: "openai/gpt-5.4",
      messages: [{ role: "user", content: 'Say ok in JSON: {"ok":true}' }],
      provider: { order: ["azure"] },
    },
  },
  {
    name: "no order json+zdr",
    body: {
      model: "openai/gpt-5.4",
      messages: [{ role: "user", content: 'Return valid JSON only: {"ok":true}' }],
      provider: { require_parameters: true, data_collection: "deny", zdr: true },
      response_format: { type: "json_object" },
    },
  },
];

async function run() {
  for (const test of tests) {
    const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify(test.body),
    });
    console.log(`\n${test.name} -> ${response.status}`);
    console.log((await response.text()).slice(0, 1200));
  }
}

void run().catch((error) => {
  console.error(error);
  process.exit(1);
});
