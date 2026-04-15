"use client";

import { useState } from "react";
import { type TournamentResult, type StoryVersion, type Review, type FinalRanking } from "@/types";
import RankingBreakdown from "@/components/results/RankingBreakdown";

interface WinnerCardProps {
  result: TournamentResult;
  story: StoryVersion;
  originalStory: StoryVersion | null;
  reviews: Review[];
  rankings: FinalRanking[];
  modelName: string;
  modelNames: Record<string, string>;
}

export default function WinnerCard({ result, story, originalStory, reviews, rankings, modelName, modelNames }: WinnerCardProps) {
  const [showOriginal, setShowOriginal] = useState(false);
  const [revealed, setRevealed] = useState(false);

  return (
    <div className="winner-card">
      <div className="flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="placement-badge placement-badge--gold">
              1st Place
            </span>
            <span className="text-zinc-500 font-sans text-sm">
              {result.bordaPoints} pts · {result.firstPlaceVotes} first-place votes
            </span>
          </div>
        </div>

        <div className="reveal-author" onClick={() => setRevealed(true)}>
          {revealed ? (
            <span className="reveal-author__name font-serif text-2xl font-bold text-amber-300">
              Written by {modelName}
            </span>
          ) : (
            <button className="reveal-author__btn" onClick={() => setRevealed(true)}>
              Reveal Author
            </button>
          )}
        </div>

        <h2 className="font-serif text-2xl font-bold text-zinc-100">{story.title}</h2>

        <div className="prose-content">
          {story.body.split("\n").map((p, i) => (
            <p key={i}>{p}</p>
          ))}
        </div>

        {story.changeSummary && (
          <div className="mt-4 pt-4 border-t border-zinc-800/60">
            <h3 className="text-sm text-zinc-400 uppercase tracking-widest font-sans mb-2">What Changed</h3>
            <p className="text-zinc-300 font-sans text-sm">{story.changeSummary}</p>
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

        {reviews.length > 0 && (
          <FeedbackSummary reviews={reviews} />
        )}

        {rankings.length > 0 && (
          <RankingBreakdown rankings={rankings} modelNames={modelNames} />
        )}
      </div>
    </div>
  );
}

function FeedbackSummary({ reviews }: { reviews: Review[] }) {
  return (
    <div className="mt-4 pt-4 border-t border-zinc-800/60">
      <h3 className="text-sm text-zinc-400 uppercase tracking-widest font-sans mb-3">
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
            <p className="text-zinc-300 text-sm font-sans italic">{review.overallComment}</p>
            {review.strengths.length > 0 && (
              <div className="mt-1 flex flex-col gap-0.5">
                {review.strengths.map((s, i) => (
                  <span key={i} className="text-emerald-400/80 text-xs font-sans">+ {s}</span>
                ))}
              </div>
            )}
            {review.weaknesses.length > 0 && (
              <div className="mt-1 flex flex-col gap-0.5">
                {review.weaknesses.map((w, i) => (
                  <span key={i} className="text-red-400/70 text-xs font-sans">− {w}</span>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
