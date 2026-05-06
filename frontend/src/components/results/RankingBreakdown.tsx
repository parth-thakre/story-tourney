"use client";

import { type FinalRanking } from "@/types";

interface RankingBreakdownProps {
  rankings: FinalRanking[];
  modelNames: Record<string, string>;
}

const RANK_LABELS: Record<number, string> = { 1: "1st", 2: "2nd", 3: "3rd", 4: "4th" };

export default function RankingBreakdown({ rankings, modelNames }: RankingBreakdownProps) {
  const sorted = [...rankings].sort((a, b) => a.rank - b.rank);

  return (
    <div
      className="mt-5 pt-4"
      style={{ borderTop: "1px solid var(--border-muted)" }}
    >
      <h3
        className="text-xs uppercase tracking-[0.12em] font-medium mb-3"
        style={{ color: "var(--text-3)", fontFamily: "var(--font-sans)" }}
      >
        How Judges Ranked It
      </h3>
      <div className="flex flex-col">
        {sorted.map((ranking) => (
          <div key={ranking.id} className="ranking-row">
            <div className="flex items-center gap-3">
              <span
                className="font-serif font-bold text-base w-8 shrink-0"
                style={{ color: "var(--text-1)" }}
              >
                {RANK_LABELS[ranking.rank] ?? `#${ranking.rank}`}
              </span>
              <span
                className="text-xs"
                style={{ color: "var(--text-3)", fontFamily: "var(--font-sans)" }}
              >
                by {modelNames[ranking.reviewerModelKey] ?? ranking.reviewerModelKey}
              </span>
            </div>
            <p
              className="text-sm italic leading-relaxed pl-11"
              style={{ color: "var(--text-3)", fontFamily: "var(--font-sans)" }}
            >
              {ranking.justification}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}
