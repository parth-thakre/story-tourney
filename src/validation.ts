import { z } from "zod";
import { MODEL_KEYS, PHASES } from "./types";

const uniqueStrings = (values: string[]) => new Set(values).size === values.length;

export const createTournamentSchema = z.object({
  prompt: z.string().trim().min(1),
  genreHint: z.string().trim().min(1).nullable().optional(),
  minWords: z.number().int().positive(),
  maxWords: z.number().int().positive(),
  selectedModels: z
    .array(z.enum(MODEL_KEYS))
    .length(4)
    .refine(uniqueStrings, { message: "selectedModels must be unique" }),
});

export const retryTournamentSchema = z.object({
  phase: z.enum(PHASES).optional(),
  modelKey: z.enum(MODEL_KEYS).optional(),
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
  rank: z.union([z.literal(1), z.literal(2), z.literal(3), z.literal(4)]),
  justification: z.string().min(1),
});

export const rankingOutputSchema = z.object({
  ranking: z.array(rankingItemSchema).length(4),
  winner_callout: z.string().min(1),
});

export type GenerationOutput = z.infer<typeof generationOutputSchema>;
export type ReviewOutput = z.infer<typeof reviewOutputSchema>;
export type RevisionOutput = z.infer<typeof revisionOutputSchema>;
export type RankingOutput = z.infer<typeof rankingOutputSchema>;
