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
  reviews: z.array(reviewItemSchema).length(3),
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

export type GenerationOutput = z.infer<typeof generationOutputSchema>;
export type ReviewOutput = z.infer<typeof reviewOutputSchema>;
export type RevisionOutput = z.infer<typeof revisionOutputSchema>;
export type RankingOutput = z.infer<typeof rankingOutputSchema>;
