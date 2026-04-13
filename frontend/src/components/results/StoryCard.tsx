"use client";

import { useState } from "react";
import { MODEL_DISPLAY, type TournamentResult, type StoryVersion, type Review, type FinalRanking, type ModelKey } from "@/types";
import RankingBreakdown from "@/components/results/RankingBreakdown";

interface StoryCardProps {
  result: TournamentResult;
  story: StoryVersion;
  originalStory: StoryVersion | null;
  reviews: Review[];
  rankings: FinalRanking[];
  modelKey: ModelKey;
}

const PLACE_LABELS: Record<number, string> = {
  1: "1st Place",
  2: "2nd Place",
  3: "3rd Place",
  4: "4th Place",
};

const PLACE_STYLES: Record<number, string> = {
  1: "placement-badge--gold",
  2: "placement-badge--silver",
  3: "placement-badge--bronze",
  4: "",
};

export default function StoryCard({ result, story, originalStory, reviews, rankings, modelKey }: StoryCardProps) {
  const [showOriginal, setShowOriginal] = useState(false);

  return (
    <div className="story-card">
      <div className="flex flex-col gap-4">
        <div className="flex items-center gap-3">
          <span className={`placement-badge ${PLACE_STYLES[result.finalRank] ?? ""}`}>
            {PLACE_LABELS[result.finalRank] ?? `${result.finalRank}th Place`}
          </span>
          <span className="font-serif text-lg font-bold text-zinc-200">{MODEL_DISPLAY[modelKey]}</span>
          <span className="text-zinc-600 font-sans text-sm">
            {result.bordaPoints} pts · {result.firstPlaceVotes} first-place
          </span>
        </div>

        <h2 className="font-serif text-xl font-bold text-zinc-100">{story.title}</h2>

        <div className="prose-content">
          {story.body.split("\n").map((p, i) => (
            <p key={i}>{p}</p>
          ))}
        </div>

        {story.changeSummary && (
          <div className="mt-2 pt-3 border-t border-zinc-800/60">
            <h3 className="text-sm text-zinc-500 uppercase tracking-widest font-sans mb-1">What Changed</h3>
            <p className="text-zinc-400 font-sans text-sm">{story.changeSummary}</p>
          </div>
        )}

        <button
          type="button"
          onClick={() => setShowOriginal(!showOriginal)}
          className="text-sm text-zinc-500 hover:text-zinc-300 font-sans underline underline-offset-4 decoration-zinc-700 transition-colors text-left"
        >
          {showOriginal ? "Hide" : "Show"} original story
        </button>

        {showOriginal && originalStory && (
          <div className="original-section">
            <h3 className="text-sm text-zinc-500 uppercase tracking-widest font-sans mb-2">
              Original — {originalStory.title}
            </h3>
            <div className="prose-content prose-content--dimmed">
              {originalStory.body.split("\n").map((p, i) => (
                <p key={i}>{p}</p>
              ))}
            </div>
          </div>
        )}

        {reviews.length > 0 && <FeedbackSummary reviews={reviews} />}
        {rankings.length > 0 && <RankingBreakdown rankings={rankings} />}
      </div>
    </div>
  );
}

function FeedbackSummary({ reviews }: { reviews: Review[] }) {
  return (
    <div className="mt-3 pt-3 border-t border-zinc-800/60">
      <h3 className="text-sm text-zinc-500 uppercase tracking-widest font-sans mb-3">
        Peer Feedback
      </h3>
      <div className="flex flex-col gap-3">
        {reviews.map((review) => (
          <div key={review.id} className="feedback-item">
            <div className="flex flex-wrap gap-2 mb-2">
              <span className="score-pill" title="Prompt Fit">PF: {review.promptFit}</span>
              <span className="score-pill" title="Originality">O: {review.originality}</span>
              <span className="score-pill" title="Coherence">C: {review.coherence}</span>
              <span className="score-pill" title="Prose">P: {review.prose}</span>
              <span className="score-pill" title="Emotional Impact">EI: {review.emotionalImpact}</span>
            </div>
            <p className="text-zinc-400 text-sm font-sans italic">{review.overallComment}</p>
            {review.strengths.length > 0 && (
              <div className="mt-1 flex flex-col gap-0.5">
                {review.strengths.map((s, i) => (
                  <span key={i} className="text-emerald-400/70 text-xs font-sans">+ {s}</span>
                ))}
              </div>
            )}
            {review.weaknesses.length > 0 && (
              <div className="mt-1 flex flex-col gap-0.5">
                {review.weaknesses.map((w, i) => (
                  <span key={i} className="text-red-400/60 text-xs font-sans">− {w}</span>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}