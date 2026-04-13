export function nowIso() {
  return new Date().toISOString();
}

export function wordCount(text: string) {
  const matches = text.trim().match(/\b\S+\b/g);
  return matches ? matches.length : 0;
}

export function stableHash(input: string) {
  let hash = 2166136261;
  for (let index = 0; index < input.length; index += 1) {
    hash ^= input.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

export function shuffleWithSeed<T>(items: readonly T[], seedText: string) {
  const itemsCopy = [...items];
  let seed = stableHash(seedText) || 1;
  for (let index = itemsCopy.length - 1; index > 0; index -= 1) {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    const swapIndex = seed % (index + 1);
    [itemsCopy[index], itemsCopy[swapIndex]] = [itemsCopy[swapIndex], itemsCopy[index]];
  }
  return itemsCopy;
}

export function parseJsonText<T>(value: unknown): T {
  if (Array.isArray(value)) {
    if (value.length === 1 && typeof value[0] === "object" && value[0] !== null) {
      return value[0] as T;
    }
    return value as T;
  }
  if (typeof value === "object" && value !== null) {
    return value as T;
  }
  if (typeof value !== "string") {
    throw new Error("Provider returned a non-JSON response");
  }
  const strippedThink = value
    .replace(/<think>[\s\S]*?<\/think>/gi, "")
    .replace(/^<think>\s*/i, "");
  const trimmed = strippedThink.trim();
  const fenced = trimmed.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i);
  const candidate = fenced?.[1]?.trim() ?? trimmed;
  const start = candidate.indexOf("{");
  const end = candidate.lastIndexOf("}");
  const jsonText = start >= 0 && end > start ? candidate.slice(start, end + 1) : candidate;
  try {
    const parsed = JSON.parse(jsonText) as unknown;
    if (Array.isArray(parsed) && parsed.length === 1 && typeof parsed[0] === "object" && parsed[0] !== null) {
      return parsed[0] as T;
    }
    return parsed as T;
  } catch (error) {
    const repaired = jsonText
      .replace(/,\s*([}\]])/g, "$1")
      .replace(/\u0000/g, "")
      .trim();
    return JSON.parse(repaired) as T;
  }
}

export function truncate(text: string, maxLength: number) {
  return text.length <= maxLength ? text : `${text.slice(0, maxLength - 1)}…`;
}
