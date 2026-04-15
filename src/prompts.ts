import fs from "node:fs";
import path from "node:path";

const PROMPTS_DIR = path.resolve(__dirname, "..", "prompts");

export function renderTemplate(template: string, values: Record<string, string>) {
  return template.replace(/{{(\w+)}}/g, (_match, key: string) => values[key] ?? "");
}

function loadPromptFile(name: string) {
  const filePath = path.join(PROMPTS_DIR, name);
  return fs.readFileSync(filePath, "utf8");
}

export const GENERATION_PROMPT = loadPromptFile("generation.md");
export const REVIEW_PROMPT = loadPromptFile("review.md");
export const REVISION_PROMPT = loadPromptFile("revision.md");
export const FINAL_RANKING_PROMPT = loadPromptFile("ranking.md");
