"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { listTournaments } from "@/lib/api";
import type { TournamentView, TournamentStatus } from "@/types";

const STATUS_LABELS: Record<TournamentStatus, string> = {
  created: "Created",
  generating: "Generating",
  reviewing: "Reviewing",
  revising: "Revising",
  ranking: "Ranking",
  completed: "Completed",
  failed: "Failed",
};

const STATUS_COLORS: Record<TournamentStatus, string> = {
  created: "text-zinc-500",
  generating: "text-teal-400",
  reviewing: "text-orange-400",
  revising: "text-blue-400",
  ranking: "text-zinc-300",
  completed: "text-amber-400",
  failed: "text-red-400",
};

export default function HistoryPage() {
  const [tournaments, setTournaments] = useState<TournamentView[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    listTournaments()
      .then(setTournaments)
      .catch((err) => setError(err instanceof Error ? err.message : "Failed to load history"))
      .finally(() => setLoading(false));
  }, []);

  return (
    <main className="min-h-screen bg-[var(--bg)] flex flex-col items-center px-4 sm:px-6 pt-16 pb-16">
      <header className="w-full max-w-3xl mb-8">
        <Link
          href="/"
          className="text-zinc-500 hover:text-zinc-300 text-sm font-sans underline underline-offset-4 decoration-zinc-600 transition-colors"
        >
          Back to Setup
        </Link>
        <h1 className="font-serif text-3xl font-bold text-zinc-100 mt-4">Tournament History</h1>
      </header>

      {loading && <div className="spinner-lg" />}

      {error && <p className="text-red-400 font-sans">{error}</p>}

      {!loading && !error && tournaments.length === 0 && (
        <div className="text-center py-20">
          <p className="text-zinc-600 font-sans text-lg">No tournaments yet.</p>
          <p className="text-zinc-700 font-sans text-sm mt-2">Start one from the setup page.</p>
        </div>
      )}

      {!loading && !error && tournaments.length > 0 && (
        <div className="w-full max-w-3xl flex flex-col gap-4">
          {tournaments
            .sort((a, b) => new Date(b.tournament.createdAt).getTime() - new Date(a.tournament.createdAt).getTime())
            .map((tv) => {
              const t = tv.tournament;
              return (
                <Link
                  key={t.id}
                  href={`/tournament/${t.id}`}
                  className="history-card group"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex flex-col gap-1 min-w-0">
                      <h2 className="font-serif text-lg font-semibold text-zinc-200 group-hover:text-amber-300 transition-colors truncate">
                        {t.prompt}
                      </h2>
                      <div className="flex items-center gap-3 text-xs font-sans text-zinc-500">
                        {t.genreHint && <span>{t.genreHint}</span>}
                        <span>{t.minWords}–{t.maxWords} words</span>
                        <span>{tv.models.length} models</span>
                      </div>
                    </div>
                    <span className={`text-sm font-sans font-medium shrink-0 ${STATUS_COLORS[t.status]}`}>
                      {STATUS_LABELS[t.status]}
                    </span>
                  </div>
                  <p className="text-xs text-zinc-600 font-sans mt-1">
                    {new Date(t.createdAt).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric", hour: "2-digit", minute: "2-digit" })}
                  </p>
                </Link>
              );
            })}
        </div>
      )}
    </main>
  );
}