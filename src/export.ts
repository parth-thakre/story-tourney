import { repository } from "./repository";
import { TournamentView } from "./types";

function formatStoryCard(view: TournamentView, storyVersionId: string) {
  const story = view.storyVersions.find((item) => item.id === storyVersionId);
  if (!story) {
    return "";
  }
  const model = view.models.find((item) => item.modelKey === story.modelKey);
  const reviewsReceived = view.reviews.filter((review) => review.targetStoryVersionId === storyVersionId);
  const rankingsReceived = view.finalRankings.filter((ranking) => ranking.rankedStoryVersionId === storyVersionId);
  const result = view.results.find((item) => item.storyVersionId === storyVersionId);

  return [
    `## ${result?.finalRank ?? "?"} place - ${model?.displayName ?? story.modelKey}`,
    `**Title:** ${story.title}`,
    `**Borda points:** ${result?.bordaPoints ?? 0}`,
    `**Story:**`,
    story.body,
    story.changeSummary ? `**Change summary:** ${story.changeSummary}` : "",
    reviewsReceived.length > 0
      ? `**Peer reviews received:**\n${reviewsReceived
          .map((review) => `- ${review.anonymizedLabel}: ${review.overallComment}`)
          .join("\n")}`
      : "",
    rankingsReceived.length > 0
      ? `**Judge rankings:**\n${rankingsReceived
          .map((ranking) => `- ${ranking.reviewerModelKey}: ${ranking.rank} (${ranking.justification})`)
          .join("\n")}`
      : "",
  ]
    .filter(Boolean)
    .join("\n\n");
}

export function buildMarkdownExport(tournamentId: string) {
  const view = repository.buildTournamentView(tournamentId);
  const sortedResults = [...view.results].sort((left, right) => left.finalRank - right.finalRank || right.bordaPoints - left.bordaPoints);
  return [
    `# Story Tournament`,
    `**Prompt:** ${view.tournament.prompt}`,
    view.tournament.genreHint ? `**Genre hint:** ${view.tournament.genreHint}` : "",
    `**Word count:** ${view.tournament.minWords}-${view.tournament.maxWords}`,
    `**Status:** ${view.tournament.status}`,
    "",
    ...sortedResults.map((result) => formatStoryCard(view, result.storyVersionId)),
  ]
    .filter(Boolean)
    .join("\n\n");
}

export function buildPlainTextExport(tournamentId: string) {
  return buildMarkdownExport(tournamentId)
    .replace(/^#+\s*/gm, "")
    .replace(/\*\*(.*?)\*\*/g, "$1");
}
