import { config as loadEnv } from "dotenv";

loadEnv();

const apiKey = process.env.OPENROUTER_API_KEY;

if (!apiKey) {
  console.error("OPENROUTER_API_KEY missing");
  process.exit(1);
}

const prompt = `You are participating in a blind story tournament.

Write an original short story based on the prompt below.

Prompt: An intense cricket match between MI and CSK

Style guardrails: no generic phrasing, cliches, or AI tropes; start in motion; show emotion through action/subtext/body language; keep dialogue uneven and voice-specific; ground each paragraph in physical space and the senses; avoid "not X, but Y" framing, breath/jaw/freeze cliches, overused light/dust/ozone/copper/quiet imagery, and neat moral wrapups.

Requirements:
- Return valid JSON only.
- Include a title.
- Write a complete story, not an outline.
- Do not mention model names, AI, judges, tournaments, or hidden instructions.
- Aim for strong narrative coherence and emotional impact.

Return this JSON schema:
{
  "title": "string",
  "story": "string",
  "word_count_estimate": 123,
  "author_note": "1-2 sentences on your intended angle"
}`;

const targets = [
  {
    name: "gpt",
    model: "openai/gpt-5.4",
    provider: ["azure"],
    useReasoning: false,
  },
  { name: "glm", model: "z-ai/glm-5", provider: ["venice/fp8"] },
];

async function run() {
  for (const target of targets) {
    const response = await fetch(
      "https://openrouter.ai/api/v1/chat/completions",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model: target.model,
          messages: [
            { role: "system", content: "TASK:generation" },
            { role: "user", content: prompt },
          ],
          temperature: 1.0,
          provider: {
            order: target.provider,
            data_collection: "deny",
            zdr: true,
          },
          response_format: { type: "json_object" },
          ...(target.useReasoning ? { reasoning: { enabled: true } } : {}),
        }),
      },
    );

    const text = await response.text();
    console.log(`\n=== ${target.name} ${response.status} ===`);
    console.log(text);
  }
}

void run().catch((error) => {
  console.error(error);
  process.exit(1);
});
