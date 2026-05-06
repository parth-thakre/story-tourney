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

const STATUS_COLOR: Record<TournamentStatus, string> = {
  created: "var(--text-3)",
  generating: "var(--phase-teal)",
  reviewing: "var(--phase-orange)",
  revising: "var(--phase-blue)",
  ranking: "var(--text-2)",
  completed: "var(--accent)",
  failed: "var(--error)",
};

export default function HistoryPage() {
  const [tournaments, setTournaments] = useState<TournamentView[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    listTournaments()
      .then(setTournaments)
      .catch((err) =>
        setError(err instanceof Error ? err.message : "Failed to load history")
      )
      .finally(() => setLoading(false));
  }, []);

  return (
    <main
      className="min-h-screen flex flex-col items-center px-4 sm:px-6 pt-16 pb-20"
    >
      <header className="w-full max-w-3xl mb-10">
        <Link href="/" className="back-link">
          <span style={{ marginLeft: "0.25rem" }}>Setup</span>
        </Link>
        <h1
          className="font-serif text-3xl font-bold mt-5"
          style={{ color: "var(--text-1)" }}
        >
          Tournament History
        </h1>
      </header>

      {loading && (
        <div className="flex items-center justify-center py-20">
          <div className="spinner-lg" />
        </div>
      )}

      {error && (
        <p
          className="text-sm"
          style={{ color: "var(--error)", fontFamily: "var(--font-sans)" }}
        >
          {error}
        </p>
      )}

      {!loading && !error && tournaments.length === 0 && (
        <div className="text-center py-24">
          <p
            className="text-lg mb-1"
            style={{ color: "var(--text-3)", fontFamily: "var(--font-sans)" }}
          >
            No tournaments yet.
          </p>
          <p
            className="text-sm"
            style={{ color: "var(--text-3)", opacity: 0.6, fontFamily: "var(--font-sans)" }}
          >
            Start one from the setup page.
          </p>
        </div>
      )}

      {!loading && !error && tournaments.length > 0 && (
        <div className="w-full max-w-3xl flex flex-col gap-3">
          {tournaments
            .sort(
              (a, b) =>
                new Date(b.tournament.createdAt).getTime() -
                new Date(a.tournament.createdAt).getTime()
            )
            .map((tv) => {
              const t = tv.tournament;
              return (
                <Link key={t.id} href={`/tournament/${t.id}`} className="history-card group">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex flex-col gap-1 min-w-0">
                      <h2
                        className="font-serif text-base font-semibold leading-snug line-clamp-2 group-hover:text-[var(--accent)] transition-colors"
                        style={{ color: "var(--text-1)" }}
                      >
                        {t.prompt}
                      </h2>
                      <div
                        className="flex items-center gap-2 text-xs flex-wrap mt-0.5"
                        style={{ color: "var(--text-3)", fontFamily: "var(--font-sans)" }}
                      >
                        {t.genreHint && (
                          <>
                            <span>{t.genreHint}</span>
                            <span style={{ color: "var(--border)" }}>·</span>
                          </>
                        )}
                        <span>{t.minWords}–{t.maxWords} words</span>
                        <span style={{ color: "var(--border)" }}>·</span>
                        <span>{tv.models.length} models</span>
                      </div>
                    </div>
                    <span
                      className="text-xs font-medium shrink-0 mt-0.5"
                      style={{
                        color: STATUS_COLOR[t.status],
                        fontFamily: "var(--font-sans)",
                      }}
                    >
                      {STATUS_LABELS[t.status]}
                    </span>
                  </div>
                  <p
                    className="text-xs mt-2"
                    style={{ color: "var(--text-3)", fontFamily: "var(--font-sans)", opacity: 0.7 }}
                  >
                    {new Date(t.createdAt).toLocaleDateString(undefined, {
                      month: "short",
                      day: "numeric",
                      year: "numeric",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </p>
                </Link>
              );
            })}
        </div>
      )}
    </main>
  );
}
