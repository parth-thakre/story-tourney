import { randomUUID } from "node:crypto";
import {
  FinalRanking,
  ModelKey,
  StoryVersion,
  Tournament,
  TournamentResult,
  TournamentStatus,
  TournamentView,
} from "./types";
import { repository } from "./repository";
import { archiveTournamentSnapshot, ensureTournamentArchive } from "./archive";
import { createModelAdapter } from "./adapters";
import {
  GENERATION_PROMPT,
  FINAL_RANKING_PROMPT,
  REVIEW_PROMPT,
  REVISION_PROMPT,
  renderTemplate,
} from "./prompts";
import {
  GenerationOutput,
  generationOutputSchema,
  RankingOutput,
  rankingOutputSchema,
  ReviewOutput,
  reviewOutputSchema,
  RevisionOutput,
  revisionOutputSchema,
} from "./validation";
import { nowIso, shuffleWithSeed, truncate, wordCount } from "./utils";

const PHASE_STATUS: Record<string, TournamentStatus> = {
  generation: "generating",
  review: "reviewing",
  revision: "revising",
  ranking: "ranking",
};

const phaseOrder = ["generation", "review", "revision", "ranking"] as const;

const runLocks = new Map<string, Promise<void>>();

function phaseComplete(tournamentId: string, phase: (typeof phaseOrder)[number], modelKeys: ModelKey[]) {
  return repository.getSuccessfulModelKeys(tournamentId, phase).length >= modelKeys.length;
}

function pendingModels(tournamentId: string, phase: (typeof phaseOrder)[number], modelKeys: ModelKey[]) {
  const success = new Set(repository.getSuccessfulModelKeys(tournamentId, phase));
  return modelKeys.filter((key) => !success.has(key));
}

function buildReviewPacket(tournament: Tournament, reviewerKey: ModelKey) {
  const originals = repository.getStoryVersionsByRound(tournament.id, "original");
  const excluded = originals.filter((story) => story.modelKey !== reviewerKey);
  const shuffled = shuffleWithSeed(excluded, `${tournament.id}:${reviewerKey}:review`);
  return shuffled
    .map((story, index) => {
      const label = `Story ${index + 1}`;
      return {
        label,
        storyVersionId: story.id,
        text: `${label}:\nTitle: ${story.title}\nWord count: ${story.wordCount}\n${story.body}`,
      };
    })
    .sort((a, b) => a.label.localeCompare(b.label));
}

function buildRankingPacket(tournament: Tournament, reviewerKey: ModelKey) {
  const revised = repository.getStoryVersionsByRound(tournament.id, "revised");
  const shuffled = shuffleWithSeed(revised, `${tournament.id}:${reviewerKey}:ranking`);
  return shuffled
    .map((story, index) => ({
      label: `Story ${index + 1}`,
      storyVersionId: story.id,
      text: `${`Story ${index + 1}`}:\nTitle: ${story.title}\nWord count: ${story.wordCount}\n${story.body}`,
    }))
    .sort((a, b) => a.label.localeCompare(b.label));
}

function buildRevisionPrompt(tournament: Tournament, original: StoryVersion) {
  const reviews = repository.getReviewsForStoryVersion(tournament.id, original.id);
  const reviewsText = reviews
    .map((review, index) => {
      return [
        `Review ${index + 1} from ${review.anonymizedLabel}:`,
        `Scores: prompt_fit=${review.promptFit}, originality=${review.originality}, coherence=${review.coherence}, prose=${review.prose}, emotional_impact=${review.emotionalImpact}`,
        `Strengths: ${review.strengths.join(" | ")}`,
        `Weaknesses: ${review.weaknesses.join(" | ")}`,
        `Suggestion: ${review.revisionSuggestion}`,
        `Comment: ${review.overallComment}`,
      ].join("\n");
    })
    .join("\n\n");

  return renderTemplate(REVISION_PROMPT, {
    minWords: String(tournament.minWords),
    maxWords: String(tournament.maxWords),
    originalStory: `Title: ${original.title}\n\n${original.body}`,
    reviewsForThisStory: reviewsText,
  });
}

function buildStoryLabels(count: number) {
  return Array.from({ length: count }, (_, index) => `Story ${index + 1}`);
}

async function recordModelCall<T>(input: {
  tournamentId: string;
  phase: "generation" | "review" | "revision" | "ranking";
  modelKey: ModelKey;
  context: Record<string, unknown>;
  prompt: string;
  system: string;
  temperature: number;
  schema: { parse: (value: unknown) => T };
}) {
  const adapter = createModelAdapter(input.modelKey);
  const attempt = repository.getLatestCallAttempt(input.tournamentId, input.phase, input.modelKey) + 1;
  ensureTournamentArchive(input.tournamentId);
  try {
    const response = await adapter.generateJson<unknown>({
      system: input.system,
      prompt: input.prompt,
      temperature: input.temperature,
    });
    const requestJson = JSON.stringify(response.requestBody);
    const parsed = input.schema.parse(response.parsed);
    repository.insertProviderCall({
      tournamentId: input.tournamentId,
      phase: input.phase,
      modelKey: input.modelKey,
      requestJson,
      responseJson: JSON.stringify(response.rawResponse),
      contextJson: JSON.stringify(input.context),
      status: "succeeded",
      attempt,
      error: null,
      completedAt: nowIso(),
    });
    return parsed;
  } catch (error) {
    const fallbackRequestJson = JSON.stringify({ system: input.system, prompt: truncate(input.prompt, 20000), temperature: input.temperature });
    const rawResponse =
      typeof error === "object" && error !== null && "rawResponse" in error
        ? JSON.stringify((error as { rawResponse: unknown }).rawResponse)
        : null;
    repository.insertProviderCall({
      tournamentId: input.tournamentId,
      phase: input.phase,
      modelKey: input.modelKey,
      requestJson: fallbackRequestJson,
      responseJson: rawResponse,
      contextJson: JSON.stringify(input.context),
      status: "failed",
      attempt,
      error: error instanceof Error ? error.message : String(error),
      completedAt: nowIso(),
    });
    throw error;
  }
}

async function runGenerationPhase(tournament: Tournament, modelKeys: ModelKey[]) {
  const pending = pendingModels(tournament.id, "generation", modelKeys);
  if (pending.length === 0) {
    return;
  }
  repository.setTournamentStatus(tournament.id, "generating");
  const operations = pending.map(async (modelKey) => {
      const prompt = renderTemplate(GENERATION_PROMPT, {
        prompt: tournament.prompt,
        genreHintOrNone: tournament.genreHint ?? "None",
        minWords: String(tournament.minWords),
        maxWords: String(tournament.maxWords),
      });
      const result = await recordModelCall<GenerationOutput>({
        tournamentId: tournament.id,
        phase: "generation",
        modelKey,
        context: { round: "original" },
        prompt,
        system: "TASK:generation",
        temperature: 0.9,
        schema: generationOutputSchema,
      });
      repository.insertStoryVersion({
        tournamentId: tournament.id,
        modelKey,
        round: "original",
        title: result.title,
        body: result.story,
        wordCount: result.word_count_estimate || wordCount(result.story),
        changeSummary: null,
      });
  });
  const settled = await Promise.allSettled(operations);
  const failures = settled
    .filter((item): item is PromiseRejectedResult => item.status === "rejected")
    .map((item) => (item.reason instanceof Error ? item.reason : new Error(String(item.reason))));
  if (failures.length > 0) {
    throw failures[0];
  }
}

async function runReviewPhase(tournament: Tournament, modelKeys: ModelKey[]) {
  const pending = pendingModels(tournament.id, "review", modelKeys);
  if (pending.length === 0) {
    return;
  }
  repository.setTournamentStatus(tournament.id, "reviewing");
  const operations = pending.map(async (modelKey) => {
      const packet = buildReviewPacket(tournament, modelKey);
      const prompt = renderTemplate(REVIEW_PROMPT, {
        anonymizedStoriesPacket: packet.map((item) => item.text).join("\n\n"),
      });
      const result = await recordModelCall<ReviewOutput>({
        tournamentId: tournament.id,
        phase: "review",
        modelKey,
        context: { round: "peer_review", storyVersionIds: packet.map((entry) => entry.storyVersionId) },
        prompt,
        system: "TASK:review",
        temperature: 0.2,
        schema: reviewOutputSchema,
      });
      for (const review of result.reviews) {
        const source = packet.find((entry) => entry.label === review.story_label);
        if (!source) {
          throw new Error(`Unknown review label: ${review.story_label}`);
        }
        repository.insertReview({
          tournamentId: tournament.id,
          reviewerModelKey: modelKey,
          targetStoryVersionId: source.storyVersionId,
          anonymizedLabel: review.story_label,
          promptFit: review.scores.prompt_fit,
          originality: review.scores.originality,
          coherence: review.scores.coherence,
          prose: review.scores.prose,
          emotionalImpact: review.scores.emotional_impact,
          strengths: review.strengths,
          weaknesses: review.weaknesses,
          revisionSuggestion: review.revision_suggestion,
          overallComment: review.overall_comment,
        });
      }
  });
  const settled = await Promise.allSettled(operations);
  const failures = settled
    .filter((item): item is PromiseRejectedResult => item.status === "rejected")
    .map((item) => (item.reason instanceof Error ? item.reason : new Error(String(item.reason))));
  if (failures.length > 0) {
    throw failures[0];
  }
}

async function runRevisionPhase(tournament: Tournament, modelKeys: ModelKey[]) {
  const pending = pendingModels(tournament.id, "revision", modelKeys);
  if (pending.length === 0) {
    return;
  }
  repository.setTournamentStatus(tournament.id, "revising");
  const operations = pending.map(async (modelKey) => {
      const original = repository.getStoryVersionByModelRound(tournament.id, modelKey, "original");
      if (!original) {
        throw new Error(`Missing original story for ${modelKey}`);
      }
      const prompt = buildRevisionPrompt(tournament, original);
      const result = await recordModelCall<RevisionOutput>({
        tournamentId: tournament.id,
        phase: "revision",
        modelKey,
        context: { round: "revised", originalStoryVersionId: original.id },
        prompt,
        system: "TASK:revision",
        temperature: 0.6,
        schema: revisionOutputSchema,
      });
      const revisedStory = result.should_revise
        ? {
            title: result.title,
            body: result.story,
            wordCount: result.word_count_estimate || wordCount(result.story),
            changeSummary: result.change_summary,
          }
        : {
            title: original.title,
            body: original.body,
            wordCount: original.wordCount,
            changeSummary: "No changes made. The original version already best serves the prompt.",
          };
      repository.insertStoryVersion({
        tournamentId: tournament.id,
        modelKey,
        round: "revised",
        title: revisedStory.title,
        body: revisedStory.body,
        wordCount: revisedStory.wordCount,
        changeSummary: revisedStory.changeSummary,
      });
  });
  const settled = await Promise.allSettled(operations);
  const failures = settled
    .filter((item): item is PromiseRejectedResult => item.status === "rejected")
    .map((item) => (item.reason instanceof Error ? item.reason : new Error(String(item.reason))));
  if (failures.length > 0) {
    throw failures[0];
  }
}

function validateRankingOutput(value: unknown) {
  const parsed = rankingOutputSchema.parse(value);
  const ranks = parsed.ranking.map((item) => item.rank);
  if (new Set(ranks).size !== parsed.ranking.length) {
    throw new Error("Ranking must use each rank exactly once");
  }
  return parsed;
}

async function runRankingPhase(tournament: Tournament, modelKeys: ModelKey[]) {
  const pending = pendingModels(tournament.id, "ranking", modelKeys);
  if (pending.length === 0) {
    return;
  }
  repository.setTournamentStatus(tournament.id, "ranking");
  const operations = pending.map(async (modelKey) => {
      const packet = buildRankingPacket(tournament, modelKey);
      const prompt = renderTemplate(FINAL_RANKING_PROMPT, {
        finalAnonymizedStoriesPacket: packet.map((item) => item.text).join("\n\n"),
      });
      const result = await recordModelCall<RankingOutput>({
        tournamentId: tournament.id,
        phase: "ranking",
        modelKey,
        context: { round: "final_ranking", storyVersionIds: packet.map((entry) => entry.storyVersionId) },
        prompt,
        system: "TASK:ranking",
        temperature: 0.2,
        schema: {
          parse: validateRankingOutput,
        },
      });
      for (const item of result.ranking) {
        const source = packet.find((entry) => entry.label === item.story_label);
        if (!source) {
          throw new Error(`Unknown ranking label: ${item.story_label}`);
        }
        repository.insertFinalRanking({
          tournamentId: tournament.id,
          reviewerModelKey: modelKey,
          rankedStoryVersionId: source.storyVersionId,
          rank: item.rank,
          justification: item.justification,
        });
      }
  });
  const settled = await Promise.allSettled(operations);
  const failures = settled
    .filter((item): item is PromiseRejectedResult => item.status === "rejected")
    .map((item) => (item.reason instanceof Error ? item.reason : new Error(String(item.reason))));
  if (failures.length > 0) {
    throw failures[0];
  }
}

function computePeerReviewTotals(tournamentId: string) {
  const reviews = repository.getReviews(tournamentId);
  const scoresByStory = new Map<string, number[]>();
  for (const review of reviews) {
    const total = review.promptFit + review.originality + review.coherence + review.prose + review.emotionalImpact;
    const list = scoresByStory.get(review.targetStoryVersionId) ?? [];
    list.push(total);
    scoresByStory.set(review.targetStoryVersionId, list);
  }
  return scoresByStory;
}

function computeResults(tournament: Tournament): TournamentResult[] {
  const rankings = repository.getFinalRankings(tournament.id);
  const stories = repository.getStoryVersionsByRound(tournament.id, "revised");
  const peerReviewTotals = computePeerReviewTotals(tournament.id);
  const byStory = new Map<string, { bordaPoints: number; firstPlaceVotes: number; total: number[] }>();
  for (const story of stories) {
    byStory.set(story.id, { bordaPoints: 0, firstPlaceVotes: 0, total: peerReviewTotals.get(story.id) ?? [] });
  }
  for (const ranking of rankings) {
    const current = byStory.get(ranking.rankedStoryVersionId);
    if (!current) {
      continue;
    }
    current.bordaPoints += stories.length - ranking.rank;
    if (ranking.rank === 1) {
      current.firstPlaceVotes += 1;
    }
  }

  const scored = stories.map((story) => {
    const metrics = byStory.get(story.id)!;
    const avgPeerTotal = metrics.total.length > 0 ? metrics.total.reduce((sum, value) => sum + value, 0) / metrics.total.length : 0;
    return {
      storyVersionId: story.id,
      bordaPoints: metrics.bordaPoints,
      firstPlaceVotes: metrics.firstPlaceVotes,
      avgPeerTotal,
    };
  });

  scored.sort((left, right) => {
    if (right.bordaPoints !== left.bordaPoints) return right.bordaPoints - left.bordaPoints;
    if (right.firstPlaceVotes !== left.firstPlaceVotes) return right.firstPlaceVotes - left.firstPlaceVotes;
    if (right.avgPeerTotal !== left.avgPeerTotal) return right.avgPeerTotal - left.avgPeerTotal;
    return left.storyVersionId.localeCompare(right.storyVersionId);
  });

  const results: TournamentResult[] = [];
  let currentRank = 1;
  for (let index = 0; index < scored.length; index += 1) {
    const current = scored[index];
    const previous = scored[index - 1];
    if (
      previous &&
      previous.bordaPoints === current.bordaPoints &&
      previous.firstPlaceVotes === current.firstPlaceVotes &&
      previous.avgPeerTotal === current.avgPeerTotal
    ) {
      results.push({
        tournamentId: tournament.id,
        storyVersionId: current.storyVersionId,
        finalRank: currentRank,
        bordaPoints: current.bordaPoints,
        firstPlaceVotes: current.firstPlaceVotes,
      });
      continue;
    }
    currentRank = index + 1;
    results.push({
      tournamentId: tournament.id,
      storyVersionId: current.storyVersionId,
      finalRank: currentRank,
      bordaPoints: current.bordaPoints,
      firstPlaceVotes: current.firstPlaceVotes,
    });
  }

  return results;
}

async function finalizeTournament(tournament: Tournament) {
  const results = computeResults(tournament);
  repository.upsertResults(results);
  repository.setTournamentStatus(tournament.id, "completed", nowIso());
  archiveTournamentSnapshot(repository.buildTournamentView(tournament.id), `completed-${Date.now()}`);
}

async function runTournamentPipeline(tournamentId: string) {
  const tournament = repository.getTournamentOrThrow(tournamentId);
  ensureTournamentArchive(tournamentId);
  archiveTournamentSnapshot(repository.buildTournamentView(tournamentId), `created-${Date.now()}`);
  const modelKeys = repository.getTournamentModels(tournamentId).map((model) => model.modelKey);
  for (const phase of phaseOrder) {
    repository.setTournamentStatus(tournament.id, PHASE_STATUS[phase]);
    const complete = phaseComplete(tournament.id, phase, modelKeys);
    if (complete) {
      continue;
    }
    if (phase === "generation") {
      await runGenerationPhase(tournament, modelKeys);
    } else if (phase === "review") {
      await runReviewPhase(tournament, modelKeys);
    } else if (phase === "revision") {
      await runRevisionPhase(tournament, modelKeys);
    } else {
      await runRankingPhase(tournament, modelKeys);
    }
    const updated = repository.getTournamentOrThrow(tournament.id);
    const pendingStillExists = !phaseComplete(updated.id, phase, modelKeys);
    archiveTournamentSnapshot(repository.buildTournamentView(tournamentId), `${phase}-${Date.now()}`);
    if (pendingStillExists) {
      repository.setTournamentStatus(tournament.id, "failed");
      archiveTournamentSnapshot(repository.buildTournamentView(tournamentId), `failed-${Date.now()}`);
      return;
    }
  }
  await finalizeTournament(tournament);
}

export async function startTournamentRun(tournamentId: string) {
  const existing = runLocks.get(tournamentId);
  if (existing) {
    return existing;
  }
  const run = runTournamentPipeline(tournamentId).catch((error) => {
    repository.setTournamentStatus(tournamentId, "failed");
    throw error;
  }).finally(() => {
    runLocks.delete(tournamentId);
  });
  runLocks.set(tournamentId, run);
  return run;
}

export async function retryTournamentRun(tournamentId: string) {
  return startTournamentRun(tournamentId);
}

export function getTournamentView(tournamentId: string): TournamentView {
  return repository.buildTournamentView(tournamentId);
}
