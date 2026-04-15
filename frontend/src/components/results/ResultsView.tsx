"use client";

import { useState } from "react";
import { getTournamentExportUrl } from "@/lib/api";
import { type TournamentView } from "@/types";
import WinnerCard from "@/components/results/WinnerCard";
import StoryCard from "@/components/results/StoryCard";

interface ResultsViewProps {
  data: TournamentView;
  onNewPrompt: () => void;
  onRunAgain: () => void;
}

export default function ResultsView({ data, onNewPrompt, onRunAgain }: ResultsViewProps) {
  const [exporting, setExporting] = useState(false);

  const { tournament, storyVersions, reviews, finalRankings, results } = data;
  const modelNames = Object.fromEntries(data.models.map((model) => [model.modelKey, model.displayName])) as Record<string, string>;
  const originalStories = storyVersions.filter((s) => s.round === "original");
  const revisedStories = storyVersions.filter((s) => s.round === "revised");

  const sortedResults = [...results].sort((a, b) => a.finalRank - b.finalRank);
  const resultGroups = sortedResults.reduce<Array<{ rank: number; items: typeof sortedResults }>>((groups, result) => {
    const existing = groups.find((group) => group.rank === result.finalRank);
    if (existing) {
      existing.items.push(result);
      return groups;
    }
    groups.push({ rank: result.finalRank, items: [result] });
    return groups;
  }, []);

  function ordinal(rank: number) {
    if (rank === 1) return "1st";
    if (rank === 2) return "2nd";
    if (rank === 3) return "3rd";
    return `${rank}th`;
  }

  async function handleExport(format: "md" | "txt") {
    setExporting(true);
    try {
      const url = getTournamentExportUrl(tournament.id, format);
      const a = document.createElement("a");
      a.href = url;
      a.download = `tournament-${tournament.id}.${format}`;
      document.body.appendChild(a);
      a.click();
      a.remove();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Export failed");
    } finally {
      setExporting(false);
    }
  }

  return (
    <main className="min-h-screen bg-[var(--bg)] flex flex-col items-center px-4 sm:px-6 pt-10 pb-16">
      <header className="w-full max-w-3xl mb-10">
        <p className="text-amber-400 font-sans text-sm uppercase tracking-widest mb-2">
          Tournament Complete
        </p>
        <h1 className="font-serif text-3xl sm:text-4xl font-bold text-zinc-100 leading-snug">
          {tournament.prompt}
        </h1>
        {tournament.genreHint && (
          <p className="text-zinc-500 font-sans text-sm mt-1">
            Style: {tournament.genreHint}
          </p>
        )}
      </header>

      <div className="w-full max-w-3xl flex flex-col gap-8">
        {resultGroups.map((group, groupIndex) => (
          <div key={`rank-${group.rank}`} className="flex flex-col gap-6">
            {group.items.length > 1 && (
              <div className="rounded-xl border border-amber-800/40 bg-amber-950/20 px-4 py-3">
                <p className="font-sans text-xs uppercase tracking-[0.24em] text-amber-400">
                  Tie for {ordinal(group.rank)} Place
                </p>
              </div>
            )}
            {group.items.map((result) => {
              const revisedStory = revisedStories.find((s) => s.id === result.storyVersionId);
              const originalStory = originalStories.find((s) => s.modelKey === revisedStory?.modelKey) ?? null;
              if (!revisedStory) return null;

              const storyReviews = reviews.filter((r) =>
                originalStory ? r.targetStoryVersionId === originalStory.id : false
              );
              const storyRankings = finalRankings.filter(
                (r) => r.rankedStoryVersionId === result.storyVersionId
              );

              if (groupIndex === 0 && group.rank === 1) {
                return (
                  <WinnerCard
                    key={result.storyVersionId}
                    result={result}
                    story={revisedStory}
                    originalStory={originalStory}
                    reviews={storyReviews}
                    rankings={storyRankings}
                    modelName={modelNames[revisedStory.modelKey] ?? revisedStory.modelKey}
                    modelNames={modelNames}
                  />
                );
              }

              return (
                <StoryCard
                  key={result.storyVersionId}
                  result={result}
                  story={revisedStory}
                  originalStory={originalStory}
                  reviews={storyReviews}
                  rankings={storyRankings}
                  modelName={modelNames[revisedStory.modelKey] ?? revisedStory.modelKey}
                  modelNames={modelNames}
                />
              );
            })}
          </div>
        ))}
      </div>

      <div className="w-full max-w-3xl mt-12 flex flex-col sm:flex-row items-center justify-center gap-4">
        <button onClick={onRunAgain} className="btn-primary">
          Run Again
        </button>
        <button onClick={onNewPrompt} className="btn-secondary">
          Try New Prompt
        </button>
        <div className="flex gap-2">
          <button
            onClick={() => handleExport("md")}
            disabled={exporting}
            className="btn-ghost"
          >
            {exporting ? "Exporting..." : "Export Markdown"}
          </button>
          <button
            onClick={() => handleExport("txt")}
            disabled={exporting}
            className="btn-ghost"
          >
            Export Text
          </button>
        </div>
      </div>
    </main>
  );
}
