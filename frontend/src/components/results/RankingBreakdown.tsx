"use client";

import { type FinalRanking } from "@/types";

interface RankingBreakdownProps {
  rankings: FinalRanking[];
  modelNames: Record<string, string>;
}

export default function RankingBreakdown({ rankings, modelNames }: RankingBreakdownProps) {
  const sorted = [...rankings].sort((a, b) => a.rank - b.rank);
  return (
    <div className="mt-3 pt-3 border-t border-zinc-800/60">
      <h3 className="text-sm text-zinc-500 uppercase tracking-widest font-sans mb-3">
        How Judges Ranked It
      </h3>
      <div className="flex flex-col gap-2">
        {sorted.map((ranking) => (
          <div key={ranking.id} className="ranking-row">
            <div className="flex items-center gap-3">
              <span className="ranking-judge font-sans text-xs text-zinc-500">
                {modelNames[ranking.reviewerModelKey] ?? ranking.reviewerModelKey}
              </span>
              <span className="ranking-position font-serif font-bold text-zinc-300">
                #{ranking.rank}
              </span>
            </div>
            <p className="font-sans text-sm text-zinc-400 italic">{ranking.justification}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
