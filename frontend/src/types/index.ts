export type ModelKey = string;

export type TournamentStatus =
  | "created"
  | "generating"
  | "reviewing"
  | "revising"
  | "ranking"
  | "completed"
  | "failed";

export type PhaseName = "generation" | "review" | "revision" | "ranking";

export type ProviderCallStatus = "pending" | "succeeded" | "failed";

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
  rank: number;
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
  provider: "mock" | "openrouter";
  providerModelId: string;
}

export interface OpenRouterCatalogModel {
  modelKey: ModelKey;
  displayName: string;
  modelId: string;
  providerModelId: string;
  providerOrder: string[];
  family: string | null;
  contextLength: number | null;
  inputCost: number | null;
  outputCost: number | null;
  releaseDate: string | null;
  lastUpdated: string | null;
}

export interface SettingsState {
  hasOpenRouterApiKey: boolean;
  models: ModelRegistryEntry[];
}

export interface CreateTournamentRequest {
  prompt: string;
  genreHint?: string | null;
  minWords: number;
  maxWords: number;
  selectedModels: ModelKey[];
}

export const PHASE_CONFIG = [
  { key: "generation" as const, label: "Generate", number: 1 },
  { key: "review" as const, label: "Blind Review", number: 2 },
  { key: "revision" as const, label: "Revise", number: 3 },
  { key: "ranking" as const, label: "Final Rank", number: 4 },
  { key: "reveal" as const, label: "Reveal", number: 5 },
];

export type DisplayPhase = "generation" | "review" | "revision" | "ranking" | "reveal";

export const STATUS_TO_PHASE: Record<TournamentStatus, DisplayPhase | "idle" | "failed"> = {
  created: "idle",
  generating: "generation",
  reviewing: "review",
  revising: "revision",
  ranking: "ranking",
  completed: "reveal",
  failed: "failed",
};
