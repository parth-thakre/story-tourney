export const MODEL_KEYS = ["sonnet", "gpt", "glm5", "kimi-k25"] as const;
export type ModelKey = (typeof MODEL_KEYS)[number];

export const TOURNAMENT_STATUSES = [
  "created",
  "generating",
  "reviewing",
  "revising",
  "ranking",
  "completed",
  "failed",
] as const;
export type TournamentStatus = (typeof TOURNAMENT_STATUSES)[number];

export const PHASES = ["generation", "review", "revision", "ranking"] as const;
export type PhaseName = (typeof PHASES)[number];

export const PROVIDER_CALL_STATUSES = ["pending", "succeeded", "failed"] as const;
export type ProviderCallStatus = (typeof PROVIDER_CALL_STATUSES)[number];

export interface Tournament {
  id: string;
  prompt: string;
  genreHint: string | null;
  minWords: number;
  maxWords: number;
  status: TournamentStatus;
  createdAt: string;
  completedAt: string | null;
}

export interface TournamentModel {
  id: string;
  tournamentId: string;
  modelKey: ModelKey;
  providerModelId: string;
  displayName: string;
}

export interface StoryVersion {
  id: string;
  tournamentId: string;
  modelKey: ModelKey;
  round: "original" | "revised";
  title: string;
  body: string;
  wordCount: number;
  changeSummary: string | null;
  createdAt: string;
}

export interface Review {
  id: string;
  tournamentId: string;
  reviewerModelKey: ModelKey;
  targetStoryVersionId: string;
  anonymizedLabel: string;
  promptFit: number;
  originality: number;
  coherence: number;
  prose: number;
  emotionalImpact: number;
  strengths: string[];
  weaknesses: string[];
  revisionSuggestion: string;
  overallComment: string;
  createdAt: string;
}

export interface FinalRanking {
  id: string;
  tournamentId: string;
  reviewerModelKey: ModelKey;
  rankedStoryVersionId: string;
  rank: 1 | 2 | 3 | 4;
  justification: string;
  createdAt: string;
}

export interface TournamentResult {
  tournamentId: string;
  storyVersionId: string;
  finalRank: number;
  bordaPoints: number;
  firstPlaceVotes: number;
}

export interface ProviderCall {
  id: string;
  tournamentId: string;
  phase: PhaseName;
  modelKey: ModelKey;
  status: ProviderCallStatus;
  attempt: number;
  requestJson: string;
  responseJson: string | null;
  contextJson: string;
  error: string | null;
  createdAt: string;
  completedAt: string | null;
}

export interface TournamentProgress {
  phase: PhaseName;
  complete: number;
  total: number;
  failed: number;
}

export interface TournamentView {
  tournament: Tournament;
  models: TournamentModel[];
  storyVersions: StoryVersion[];
  reviews: Review[];
  finalRankings: FinalRanking[];
  results: TournamentResult[];
  providerCalls: ProviderCall[];
  progress: Record<PhaseName, TournamentProgress>;
}

export interface ModelRegistryEntry {
  modelKey: ModelKey;
  displayName: string;
  modelId: string;
  provider: "mock" | "openrouter";
  providerModelId: string;
  providerOrder: string[];
  apiKey: string | null;
  siteUrl: string | null;
  appName: string | null;
}

export interface ModelAdapter {
  modelKey: ModelKey;
  displayName: string;
  generateJson<T>(input: {
    system?: string;
    prompt: string;
    temperature?: number;
  }): Promise<{ parsed: T; rawResponse: unknown; requestBody: unknown }>;
}
