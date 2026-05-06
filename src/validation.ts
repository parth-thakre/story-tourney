import { z } from "zod";
import { PHASES } from "./types";

const uniqueStrings = (values: string[]) => new Set(values).size === values.length;

const PROMPT_MAX_CHARS = 6_000;
const GENRE_HINT_MAX_CHARS = 120;
const MIN_WORDS_FLOOR = 100;
const MIN_WORDS_CEILING = 5_000;
const MAX_WORDS_CEILING = 10_000;
const MIN_TOURNAMENT_MODELS = 2;
const MAX_TOURNAMENT_MODELS = 4;

export const createTournamentSchema = z.object({
  prompt: z.string().trim().min(1).max(PROMPT_MAX_CHARS),
  genreHint: z.string().trim().min(1).max(GENRE_HINT_MAX_CHARS).nullable().optional(),
  minWords: z.number().int().min(MIN_WORDS_FLOOR).max(MIN_WORDS_CEILING),
  maxWords: z.number().int().min(MIN_WORDS_FLOOR).max(MAX_WORDS_CEILING),
  selectedModels: z
    .array(z.string().trim().min(1))
    .min(MIN_TOURNAMENT_MODELS)
    .max(MAX_TOURNAMENT_MODELS)
    .refine(uniqueStrings, { message: "selectedModels must be unique" }),
}).refine((value) => value.minWords <= value.maxWords, {
  message: "minWords must be less than or equal to maxWords",
  path: ["maxWords"],
});

export const retryTournamentSchema = z.object({
  phase: z.enum(PHASES).optional(),
  modelKey: z.string().trim().min(1).optional(),
});

export const updateApiKeySchema = z.object({
  apiKey: z.string().trim().min(1).nullable(),
});

export const updateModelsSchema = z.object({
  models: z
    .array(
      z.object({
        modelKey: z.string().trim().min(1),
        displayName: z.string().trim().min(1),
        modelId: z.string().trim().min(1).optional(),
        providerModelId: z.string().trim().min(1),
        providerOrder: z.array(z.string().trim().min(1)).optional(),
      })
    )
    .min(MIN_TOURNAMENT_MODELS)
    .max(MAX_TOURNAMENT_MODELS)
    .refine((models) => uniqueStrings(models.map((model) => model.modelKey)), { message: "models must be unique" })
    .refine((models) => uniqueStrings(models.map((model) => model.providerModelId)), {
      message: "providerModelId values must be unique",
    }),
});

export const generationOutputSchema = z.object({
  title: z.string().min(1),
  story: z.string().min(1),
  word_count_estimate: z.number().int().nonnegative(),
  author_note: z.string().min(1),
});

const reviewItemSchema = z.object({
  story_label: z.string().min(1),
  scores: z.object({
    prompt_fit: z.number().int().min(1).max(10),
    originality: z.number().int().min(1).max(10),
    coherence: z.number().int().min(1).max(10),
    prose: z.number().int().min(1).max(10),
    emotional_impact: z.number().int().min(1).max(10),
  }),
  strengths: z.array(z.string().min(1)).length(2),
  weaknesses: z.array(z.string().min(1)).length(2),
  revision_suggestion: z.string().min(1),
  overall_comment: z.string().min(1),
});

export const reviewOutputSchema = z.object({
  reviews: z.array(reviewItemSchema).min(1).max(MAX_TOURNAMENT_MODELS - 1),
});

export const revisionOutputSchema = z.object({
  should_revise: z.boolean(),
  title: z.string().min(1),
  story: z.string().min(1),
  word_count_estimate: z.number().int().nonnegative(),
  change_summary: z.string(),
});

const rankingItemSchema = z.object({
  story_label: z.string().min(1),
  rank: z.number().int().min(1).max(MAX_TOURNAMENT_MODELS),
  justification: z.string().min(1),
});

export const rankingOutputSchema = z.object({
  ranking: z.array(rankingItemSchema).min(MIN_TOURNAMENT_MODELS).max(MAX_TOURNAMENT_MODELS),
  winner_callout: z.string().min(1),
});

export function validateReviewOutputCount(value: unknown, expectedCount: number) {
  const parsed = reviewOutputSchema.parse(value);
  if (parsed.reviews.length !== expectedCount) {
    throw new Error(`Review output must contain exactly ${expectedCount} review item(s)`);
  }
  return parsed;
}

export function validateRankingOutputCount(value: unknown, expectedCount: number) {
  const parsed = rankingOutputSchema.parse(value);
  if (parsed.ranking.length !== expectedCount) {
    throw new Error(`Ranking output must contain exactly ${expectedCount} ranking item(s)`);
  }
  return parsed;
}

export type GenerationOutput = z.infer<typeof generationOutputSchema>;
export type ReviewOutput = z.infer<typeof reviewOutputSchema>;
export type RevisionOutput = z.infer<typeof revisionOutputSchema>;
export type RankingOutput = z.infer<typeof rankingOutputSchema>;
