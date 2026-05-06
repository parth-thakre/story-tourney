import { randomUUID } from "node:crypto";
import { db } from "./db";
import { archiveProviderCall } from "./archive";
import {
  FinalRanking,
  ModelKey,
  PhaseName,
  ProviderCall,
  StoryVersion,
  Tournament,
  TournamentModel,
  TournamentResult,
  TournamentStatus,
  Review,
  TournamentProgress,
  TournamentView,
} from "./types";
import { nowIso } from "./utils";

type TournamentRow = {
  id: string;
  prompt: string;
  genre_hint: string | null;
  min_words: number;
  max_words: number;
  status: TournamentStatus;
  created_at: string;
  completed_at: string | null;
};

type TournamentModelRow = {
  id: string;
  tournament_id: string;
  model_key: ModelKey;
  provider_model_id: string;
  display_name: string;
};

type StoryVersionRow = {
  id: string;
  tournament_id: string;
  model_key: ModelKey;
  round: "original" | "revised";
  title: string;
  body: string;
  word_count: number;
  change_summary: string | null;
  created_at: string;
};

type ReviewRow = {
  id: string;
  tournament_id: string;
  reviewer_model_key: ModelKey;
  target_story_version_id: string;
  anonymized_label: string;
  prompt_fit: number;
  originality: number;
  coherence: number;
  prose: number;
  emotional_impact: number;
  strengths_json: string;
  weaknesses_json: string;
  revision_suggestion: string;
  overall_comment: string;
  created_at: string;
};

type FinalRankingRow = {
  id: string;
  tournament_id: string;
  reviewer_model_key: ModelKey;
  ranked_story_version_id: string;
  rank: number;
  justification: string;
  created_at: string;
};

type ProviderCallRow = {
  id: string;
  tournament_id: string;
  phase: PhaseName;
  model_key: ModelKey;
  status: "pending" | "succeeded" | "failed";
  attempt: number;
  request_json: string;
  response_json: string | null;
  context_json: string;
  error: string | null;
  created_at: string;
  completed_at: string | null;
};

type TournamentResultRow = {
  tournament_id: string;
  story_version_id: string;
  final_rank: number;
  borda_points: number;
  first_place_votes: number;
};

const tournamentSelect = `
  SELECT id, prompt, genre_hint, min_words, max_words, status, created_at, completed_at
  FROM tournaments
`;

function mapTournament(row: TournamentRow): Tournament {
  return {
    id: row.id,
    prompt: row.prompt,
    genreHint: row.genre_hint,
    minWords: row.min_words,
    maxWords: row.max_words,
    status: row.status,
    createdAt: row.created_at,
    completedAt: row.completed_at,
  };
}

function mapTournamentModel(row: TournamentModelRow): TournamentModel {
  return {
    id: row.id,
    tournamentId: row.tournament_id,
    modelKey: row.model_key,
    providerModelId: row.provider_model_id,
    displayName: row.display_name,
  };
}

function mapStoryVersion(row: StoryVersionRow): StoryVersion {
  return {
    id: row.id,
    tournamentId: row.tournament_id,
    modelKey: row.model_key,
    round: row.round,
    title: row.title,
    body: row.body,
    wordCount: row.word_count,
    changeSummary: row.change_summary,
    createdAt: row.created_at,
  };
}

function mapReview(row: ReviewRow): Review {
  return {
    id: row.id,
    tournamentId: row.tournament_id,
    reviewerModelKey: row.reviewer_model_key,
    targetStoryVersionId: row.target_story_version_id,
    anonymizedLabel: row.anonymized_label,
    promptFit: row.prompt_fit,
    originality: row.originality,
    coherence: row.coherence,
    prose: row.prose,
    emotionalImpact: row.emotional_impact,
    strengths: JSON.parse(row.strengths_json) as string[],
    weaknesses: JSON.parse(row.weaknesses_json) as string[],
    revisionSuggestion: row.revision_suggestion,
    overallComment: row.overall_comment,
    createdAt: row.created_at,
  };
}

function mapFinalRanking(row: FinalRankingRow): FinalRanking {
  return {
    id: row.id,
    tournamentId: row.tournament_id,
    reviewerModelKey: row.reviewer_model_key,
    rankedStoryVersionId: row.ranked_story_version_id,
    rank: row.rank,
    justification: row.justification,
    createdAt: row.created_at,
  };
}

function mapProviderCall(row: ProviderCallRow): ProviderCall {
  return {
    id: row.id,
    tournamentId: row.tournament_id,
    phase: row.phase,
    modelKey: row.model_key,
    status: row.status,
    attempt: row.attempt,
    requestJson: row.request_json,
    responseJson: row.response_json,
    contextJson: row.context_json,
    error: row.error,
    createdAt: row.created_at,
    completedAt: row.completed_at,
  };
}

function mapTournamentResult(row: TournamentResultRow): TournamentResult {
  return {
    tournamentId: row.tournament_id,
    storyVersionId: row.story_version_id,
    finalRank: row.final_rank,
    bordaPoints: row.borda_points,
    firstPlaceVotes: row.first_place_votes,
  };
}

export class TournamentRepository {
  createTournament(input: {
    prompt: string;
    genreHint: string | null;
    minWords: number;
    maxWords: number;
    selectedModels: Array<{ modelKey: ModelKey; providerModelId: string; displayName: string }>;
  }) {
    const tournamentId = randomUUID();
    const createdAt = nowIso();
    const insertTournament = db.prepare(
      "INSERT INTO tournaments (id, prompt, genre_hint, min_words, max_words, status, created_at, completed_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)"
    );
    const insertModel = db.prepare(
      "INSERT INTO tournament_models (id, tournament_id, model_key, provider_model_id, display_name) VALUES (?, ?, ?, ?, ?)"
    );

    const transaction = db.transaction(() => {
      insertTournament.run(tournamentId, input.prompt, input.genreHint, input.minWords, input.maxWords, "created", createdAt, null);
      for (const model of input.selectedModels) {
        insertModel.run(randomUUID(), tournamentId, model.modelKey, model.providerModelId, model.displayName);
      }
    });

    transaction();
    return this.getTournamentOrThrow(tournamentId);
  }

  listTournaments() {
    const rows = db.prepare(`${tournamentSelect} ORDER BY created_at DESC`).all() as TournamentRow[];
    return rows.map((row) => this.buildTournamentViewFromRow(row));
  }

  getTournament(tournamentId: string) {
    const row = db.prepare(`${tournamentSelect} WHERE id = ?`).get(tournamentId) as TournamentRow | undefined;
    return row ? mapTournament(row) : undefined;
  }

  getTournamentOrThrow(tournamentId: string) {
    const tournament = this.getTournament(tournamentId);
    if (!tournament) {
      throw new Error(`Tournament not found: ${tournamentId}`);
    }
    return tournament;
  }

  getTournamentModels(tournamentId: string) {
    const rows = db
      .prepare("SELECT id, tournament_id, model_key, provider_model_id, display_name FROM tournament_models WHERE tournament_id = ? ORDER BY rowid ASC")
      .all(tournamentId) as TournamentModelRow[];
    return rows.map(mapTournamentModel);
  }

  setTournamentStatus(tournamentId: string, status: TournamentStatus, completedAt: string | null = null) {
    db.prepare("UPDATE tournaments SET status = ?, completed_at = ? WHERE id = ?").run(status, completedAt, tournamentId);
  }

  insertProviderCall(input: {
    tournamentId: string;
    phase: PhaseName;
    modelKey: ModelKey;
    requestJson: string;
    responseJson: string | null;
    contextJson: string;
    status: "pending" | "succeeded" | "failed";
    attempt: number;
    error: string | null;
    completedAt: string | null;
  }) {
    const id = randomUUID();
    const createdAt = nowIso();
    db.prepare(
      `INSERT INTO provider_calls
       (id, tournament_id, phase, model_key, status, attempt, request_json, response_json, context_json, error, created_at, completed_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(
      id,
      input.tournamentId,
      input.phase,
      input.modelKey,
      input.status,
      input.attempt,
      input.requestJson,
      input.responseJson,
      input.contextJson,
      input.error,
      createdAt,
      input.completedAt
    );

    archiveProviderCall({
      id,
      tournamentId: input.tournamentId,
      phase: input.phase,
      modelKey: input.modelKey,
      status: input.status,
      attempt: input.attempt,
      requestJson: input.requestJson,
      responseJson: input.responseJson,
      contextJson: input.contextJson,
      error: input.error,
      createdAt,
      completedAt: input.completedAt,
    });
  }

  getProviderCalls(tournamentId: string) {
    const rows = db
      .prepare(
        "SELECT id, tournament_id, phase, model_key, status, attempt, request_json, response_json, context_json, error, created_at, completed_at FROM provider_calls WHERE tournament_id = ? ORDER BY created_at ASC"
      )
      .all(tournamentId) as ProviderCallRow[];
    return rows.map(mapProviderCall);
  }

  getProviderCallCount(tournamentId: string, phase: PhaseName, modelKey: ModelKey, status: "succeeded" | "failed") {
    const row = db
      .prepare("SELECT COUNT(*) as count FROM provider_calls WHERE tournament_id = ? AND phase = ? AND model_key = ? AND status = ?")
      .get(tournamentId, phase, modelKey, status) as { count: number };
    return row.count;
  }

  getSuccessfulModelKeys(tournamentId: string, phase: PhaseName) {
    const rows = db
      .prepare("SELECT DISTINCT model_key FROM provider_calls WHERE tournament_id = ? AND phase = ? AND status = 'succeeded'")
      .all(tournamentId, phase) as Array<{ model_key: ModelKey }>;
    return rows.map((row) => row.model_key);
  }

  getCompletedModelKeysForPhase(tournamentId: string, phase: PhaseName) {
    const modelKeys = this.getTournamentModels(tournamentId).map((model) => model.modelKey);
    if (phase === "generation") {
      const rows = db
        .prepare("SELECT DISTINCT model_key FROM story_versions WHERE tournament_id = ? AND round = 'original'")
        .all(tournamentId) as Array<{ model_key: ModelKey }>;
      return rows.map((row) => row.model_key);
    }

    if (phase === "revision") {
      const rows = db
        .prepare("SELECT DISTINCT model_key FROM story_versions WHERE tournament_id = ? AND round = 'revised'")
        .all(tournamentId) as Array<{ model_key: ModelKey }>;
      return rows.map((row) => row.model_key);
    }

    if (phase === "review") {
      const expectedCount = Math.max(modelKeys.length - 1, 0);
      const rows = db
        .prepare(
          "SELECT reviewer_model_key FROM reviews WHERE tournament_id = ? GROUP BY reviewer_model_key HAVING COUNT(*) >= ?"
        )
        .all(tournamentId, expectedCount) as Array<{ reviewer_model_key: ModelKey }>;
      return rows.map((row) => row.reviewer_model_key);
    }

    const expectedCount = modelKeys.length;
    const rows = db
      .prepare(
        "SELECT reviewer_model_key FROM final_rankings WHERE tournament_id = ? GROUP BY reviewer_model_key HAVING COUNT(*) >= ?"
      )
      .all(tournamentId, expectedCount) as Array<{ reviewer_model_key: ModelKey }>;
    return rows.map((row) => row.reviewer_model_key);
  }

  getLatestCallAttempt(tournamentId: string, phase: PhaseName, modelKey: ModelKey) {
    const row = db
      .prepare(
        "SELECT MAX(attempt) as attempt FROM provider_calls WHERE tournament_id = ? AND phase = ? AND model_key = ?"
      )
      .get(tournamentId, phase, modelKey) as { attempt: number | null };
    return row.attempt ?? 0;
  }

  insertStoryVersion(input: {
    tournamentId: string;
    modelKey: ModelKey;
    round: "original" | "revised";
    title: string;
    body: string;
    wordCount: number;
    changeSummary: string | null;
  }) {
    db.prepare(
      `INSERT INTO story_versions
       (id, tournament_id, model_key, round, title, body, word_count, change_summary, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(
      randomUUID(),
      input.tournamentId,
      input.modelKey,
      input.round,
      input.title,
      input.body,
      input.wordCount,
      input.changeSummary,
      nowIso()
    );
  }

  getStoryVersions(tournamentId: string) {
    const rows = db
      .prepare(
        "SELECT id, tournament_id, model_key, round, title, body, word_count, change_summary, created_at FROM story_versions WHERE tournament_id = ? ORDER BY created_at ASC"
      )
      .all(tournamentId) as StoryVersionRow[];
    return rows.map(mapStoryVersion);
  }

  getStoryVersionByModelRound(tournamentId: string, modelKey: ModelKey, round: "original" | "revised") {
    const row = db
      .prepare(
        "SELECT id, tournament_id, model_key, round, title, body, word_count, change_summary, created_at FROM story_versions WHERE tournament_id = ? AND model_key = ? AND round = ?"
      )
      .get(tournamentId, modelKey, round) as StoryVersionRow | undefined;
    return row ? mapStoryVersion(row) : undefined;
  }

  getStoryVersionsByRound(tournamentId: string, round: "original" | "revised") {
    const rows = db
      .prepare(
        "SELECT id, tournament_id, model_key, round, title, body, word_count, change_summary, created_at FROM story_versions WHERE tournament_id = ? AND round = ? ORDER BY created_at ASC"
      )
      .all(tournamentId, round) as StoryVersionRow[];
    return rows.map(mapStoryVersion);
  }

  insertReview(input: {
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
  }) {
    db.prepare(
      `INSERT INTO reviews
       (id, tournament_id, reviewer_model_key, target_story_version_id, anonymized_label, prompt_fit, originality, coherence, prose, emotional_impact, strengths_json, weaknesses_json, revision_suggestion, overall_comment, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(
      randomUUID(),
      input.tournamentId,
      input.reviewerModelKey,
      input.targetStoryVersionId,
      input.anonymizedLabel,
      input.promptFit,
      input.originality,
      input.coherence,
      input.prose,
      input.emotionalImpact,
      JSON.stringify(input.strengths),
      JSON.stringify(input.weaknesses),
      input.revisionSuggestion,
      input.overallComment,
      nowIso()
    );
  }

  getReviews(tournamentId: string) {
    const rows = db
      .prepare(
        "SELECT id, tournament_id, reviewer_model_key, target_story_version_id, anonymized_label, prompt_fit, originality, coherence, prose, emotional_impact, strengths_json, weaknesses_json, revision_suggestion, overall_comment, created_at FROM reviews WHERE tournament_id = ? ORDER BY created_at ASC"
      )
      .all(tournamentId) as ReviewRow[];
    return rows.map(mapReview);
  }

  getReviewsForStoryVersion(tournamentId: string, targetStoryVersionId: string) {
    const rows = db
      .prepare(
        "SELECT id, tournament_id, reviewer_model_key, target_story_version_id, anonymized_label, prompt_fit, originality, coherence, prose, emotional_impact, strengths_json, weaknesses_json, revision_suggestion, overall_comment, created_at FROM reviews WHERE tournament_id = ? AND target_story_version_id = ? ORDER BY created_at ASC"
      )
      .all(tournamentId, targetStoryVersionId) as ReviewRow[];
    return rows.map(mapReview);
  }

  insertFinalRanking(input: {
    tournamentId: string;
    reviewerModelKey: ModelKey;
    rankedStoryVersionId: string;
    rank: number;
    justification: string;
  }) {
    db.prepare(
      `INSERT INTO final_rankings
       (id, tournament_id, reviewer_model_key, ranked_story_version_id, rank, justification, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`
    ).run(
      randomUUID(),
      input.tournamentId,
      input.reviewerModelKey,
      input.rankedStoryVersionId,
      input.rank,
      input.justification,
      nowIso()
    );
  }

  getFinalRankings(tournamentId: string) {
    const rows = db
      .prepare(
        "SELECT id, tournament_id, reviewer_model_key, ranked_story_version_id, rank, justification, created_at FROM final_rankings WHERE tournament_id = ? ORDER BY created_at ASC"
      )
      .all(tournamentId) as FinalRankingRow[];
    return rows.map(mapFinalRanking);
  }

  upsertResults(rows: TournamentResult[]) {
    const statement = db.prepare(
      `INSERT INTO tournament_results (tournament_id, story_version_id, final_rank, borda_points, first_place_votes)
       VALUES (?, ?, ?, ?, ?)
       ON CONFLICT(tournament_id, story_version_id) DO UPDATE SET
         final_rank = excluded.final_rank,
         borda_points = excluded.borda_points,
         first_place_votes = excluded.first_place_votes`
    );
    const transaction = db.transaction(() => {
      for (const row of rows) {
        statement.run(row.tournamentId, row.storyVersionId, row.finalRank, row.bordaPoints, row.firstPlaceVotes);
      }
    });
    transaction();
  }

  getResults(tournamentId: string) {
    const rows = db
      .prepare(
        "SELECT tournament_id, story_version_id, final_rank, borda_points, first_place_votes FROM tournament_results WHERE tournament_id = ? ORDER BY final_rank ASC, borda_points DESC, first_place_votes DESC"
      )
      .all(tournamentId) as TournamentResultRow[];
    return rows.map(mapTournamentResult);
  }

  getLatestTournamentStatus(tournamentId: string) {
    const row = db.prepare("SELECT status FROM tournaments WHERE id = ?").get(tournamentId) as { status: TournamentStatus } | undefined;
    return row?.status ?? null;
  }

  getPhaseProgress(tournamentId: string, phase: PhaseName, total: number): TournamentProgress {
    const completedKeys = new Set(this.getCompletedModelKeysForPhase(tournamentId, phase));
    const complete = completedKeys.size;
    const failed = db
      .prepare("SELECT DISTINCT model_key FROM provider_calls WHERE tournament_id = ? AND phase = ? AND status = 'failed'")
      .all(tournamentId, phase) as Array<{ model_key: ModelKey }>;
    const unresolvedFailures = failed.filter((row) => !completedKeys.has(row.model_key)).length;
    return { phase, complete, total, failed: unresolvedFailures };
  }

  buildTournamentView(tournamentId: string): TournamentView {
    const tournament = this.getTournamentOrThrow(tournamentId);
    return this.buildTournamentViewFromRow({
      id: tournament.id,
      prompt: tournament.prompt,
      genre_hint: tournament.genreHint,
      min_words: tournament.minWords,
      max_words: tournament.maxWords,
      status: tournament.status,
      created_at: tournament.createdAt,
      completed_at: tournament.completedAt,
    });
  }

  private buildTournamentViewFromRow(row: TournamentRow): TournamentView {
    const tournament = mapTournament(row);
    const models = this.getTournamentModels(tournament.id);
    const storyVersions = this.getStoryVersions(tournament.id);
    const reviews = this.getReviews(tournament.id);
    const finalRankings = this.getFinalRankings(tournament.id);
    const results = this.getResults(tournament.id);
    const providerCalls = this.getProviderCalls(tournament.id);
    return {
      tournament,
      models,
      storyVersions,
      reviews,
      finalRankings,
      results,
      providerCalls,
      progress: {
        generation: this.getPhaseProgress(tournament.id, "generation", models.length),
        review: this.getPhaseProgress(tournament.id, "review", models.length),
        revision: this.getPhaseProgress(tournament.id, "revision", models.length),
        ranking: this.getPhaseProgress(tournament.id, "ranking", models.length),
      },
    };
  }
}

export const repository = new TournamentRepository();
