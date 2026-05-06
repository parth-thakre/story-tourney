"use client";

import { useState } from "react";
import { type TournamentResult, type StoryVersion, type Review, type FinalRanking } from "@/types";
import RankingBreakdown from "@/components/results/RankingBreakdown";

interface StoryCardProps {
  result: TournamentResult;
  story: StoryVersion;
  originalStory: StoryVersion | null;
  reviews: Review[];
  rankings: FinalRanking[];
  modelName: string;
  modelNames: Record<string, string>;
}

const PLACE_LABELS: Record<number, string> = {
  1: "1st Place",
  2: "2nd Place",
  3: "3rd Place",
  4: "4th Place",
};

const PLACE_BADGE_CLASS: Record<number, string> = {
  1: "placement-badge--gold",
  2: "placement-badge--silver",
  3: "placement-badge--bronze",
  4: "",
};

const SCORE_LABELS: Record<string, string> = {
  promptFit: "Prompt Fit",
  originality: "Originality",
  coherence: "Coherence",
  prose: "Prose",
  emotionalImpact: "Impact",
};

export default function StoryCard({
  result,
  story,
  originalStory,
  reviews,
  rankings,
  modelName,
  modelNames,
}: StoryCardProps) {
  const [showOriginal, setShowOriginal] = useState(false);

  return (
    <div className="story-card">
      {/* Placement + model */}
      <div className="flex items-center gap-3 mb-5 flex-wrap">
        <span className={`placement-badge ${PLACE_BADGE_CLASS[result.finalRank] ?? ""}`}>
          {PLACE_LABELS[result.finalRank] ?? `${result.finalRank}th Place`}
        </span>
        <span
          className="font-serif text-lg font-semibold"
          style={{ color: "var(--text-1)" }}
        >
          {modelName}
        </span>
        <span
          className="text-sm"
          style={{ color: "var(--text-3)", fontFamily: "var(--font-sans)" }}
        >
          {result.bordaPoints} pts &middot; {result.firstPlaceVotes} first-place
          {result.firstPlaceVotes === 1 ? " vote" : " votes"}
        </span>
      </div>

      {/* Title */}
      <h2
        className="font-serif text-xl font-bold mb-4 leading-tight"
        style={{ color: "var(--text-1)" }}
      >
        {story.title}
      </h2>

      {/* Story body */}
      <div className="prose-content">
        {story.body.split("\n").filter(Boolean).map((p, i) => (
          <p key={i}>{p}</p>
        ))}
      </div>

      {/* What Changed */}
      {story.changeSummary && (
        <div
          className="mt-5 pt-4"
          style={{ borderTop: "1px solid var(--border-muted)" }}
        >
          <h3
            className="text-xs uppercase tracking-[0.12em] font-medium mb-1.5"
            style={{ color: "var(--text-3)", fontFamily: "var(--font-sans)" }}
          >
            What Changed
          </h3>
          <p
            className="text-sm leading-relaxed"
            style={{ color: "var(--text-3)", fontFamily: "var(--font-sans)" }}
          >
            {story.changeSummary}
          </p>
        </div>
      )}

      {/* Original toggle */}
      <div className="mt-4">
        <button
          type="button"
          onClick={() => setShowOriginal(!showOriginal)}
          className="text-sm underline underline-offset-4"
          style={{
            color: "var(--text-3)",
            fontFamily: "var(--font-sans)",
            textDecorationColor: "var(--border-muted)",
          }}
        >
          {showOriginal ? "Hide" : "Show"} original story
        </button>

        {showOriginal && originalStory && (
          <div className="original-section mt-3">
            <h3
              className="text-xs uppercase tracking-[0.12em] font-medium mb-3"
              style={{ color: "var(--text-3)", fontFamily: "var(--font-sans)" }}
            >
              Original — {originalStory.title}
            </h3>
            <div className="prose-content prose-content--dimmed">
              {originalStory.body.split("\n").filter(Boolean).map((p, i) => (
                <p key={i}>{p}</p>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Feedback */}
      {reviews.length > 0 && <FeedbackSummary reviews={reviews} />}

      {/* Rankings */}
      {rankings.length > 0 && (
        <RankingBreakdown rankings={rankings} modelNames={modelNames} />
      )}
    </div>
  );
}

function FeedbackSummary({ reviews }: { reviews: Review[] }) {
  return (
    <div
      className="mt-5 pt-4"
      style={{ borderTop: "1px solid var(--border-muted)" }}
    >
      <h3
        className="text-xs uppercase tracking-[0.12em] font-medium mb-3"
        style={{ color: "var(--text-3)", fontFamily: "var(--font-sans)" }}
      >
        Peer Feedback
      </h3>
      <div className="flex flex-col gap-2.5">
        {reviews.map((review) => (
          <div key={review.id} className="feedback-block">
            <div className="score-row">
              {(
                [
                  ["promptFit", review.promptFit],
                  ["originality", review.originality],
                  ["coherence", review.coherence],
                  ["prose", review.prose],
                  ["emotionalImpact", review.emotionalImpact],
                ] as [string, number][]
              ).map(([key, val]) => (
                <span key={key} className="score-pill">
                  <span className="score-pill__label">{SCORE_LABELS[key]}</span>
                  <span className="score-pill__value">{val}</span>
                </span>
              ))}
            </div>
            <p
              className="text-sm italic leading-relaxed mb-2"
              style={{ color: "var(--text-3)", fontFamily: "var(--font-sans)" }}
            >
              {review.overallComment}
            </p>
            {review.strengths.length > 0 && (
              <div className="flex flex-col gap-0.5 mt-1">
                {review.strengths.map((s, i) => (
                  <span
                    key={i}
                    className="text-xs"
                    style={{ color: "var(--success)", fontFamily: "var(--font-sans)" }}
                  >
                    + {s}
                  </span>
                ))}
              </div>
            )}
            {review.weaknesses.length > 0 && (
              <div className="flex flex-col gap-0.5 mt-1">
                {review.weaknesses.map((w, i) => (
                  <span
                    key={i}
                    className="text-xs"
                    style={{ color: "oklch(65% 0.13 22)", fontFamily: "var(--font-sans)" }}
                  >
                    &minus; {w}
                  </span>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
