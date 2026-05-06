"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { getTournament, retryTournament } from "@/lib/api";
import { type TournamentView } from "@/types";
import Link from "next/link";
import PhasePipeline from "@/components/live/PhasePipeline";
import ResultsView from "@/components/results/ResultsView";

interface LiveRunPageProps {
  tournamentId: string;
}

export default function TournamentRunPage({ tournamentId }: LiveRunPageProps) {
  const router = useRouter();
  const [data, setData] = useState<TournamentView | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [retrying, setRetrying] = useState(false);

  const fetchData = useCallback(async () => {
    try {
      const result = await getTournament(tournamentId);
      setData(result);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load tournament");
    }
  }, [tournamentId]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  useEffect(() => {
    if (!data) return;
    const status = data.tournament.status;
    if (status === "completed" || status === "failed") return;
    const interval = setInterval(fetchData, 3000);
    return () => clearInterval(interval);
  }, [data, fetchData]);

  async function handleRetry() {
    setRetrying(true);
    try {
      await retryTournament(tournamentId);
      await fetchData();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Retry failed");
    } finally {
      setRetrying(false);
    }
  }

  if (error && !data) {
    return (
      <main
        className="min-h-screen flex flex-col items-center justify-center px-4 gap-4"
      >
        <p className="text-sm" style={{ color: "oklch(65% 0.14 22)", fontFamily: "var(--font-sans)" }}>
          {error}
        </p>
        <Link href="/" className="btn-primary">
          Back to Setup
        </Link>
      </main>
    );
  }

  if (!data) {
    return (
      <main
        className="min-h-screen flex items-center justify-center"
      >
        <div className="spinner-lg" />
      </main>
    );
  }

  const { tournament } = data;
  const status = tournament.status;

  if (status === "completed" && data.results.length > 0) {
    return (
      <ResultsView data={data} onNewPrompt={() => router.push("/")} onRunAgain={handleRetry} />
    );
  }

  return (
    <main
      className="min-h-screen flex flex-col items-center px-4 sm:px-6 pt-10 pb-20"
    >
      <header className="w-full max-w-3xl mb-8">
        <Link href="/" className="back-link">
          <span style={{ marginLeft: "0.25rem" }}>Setup</span>
        </Link>

        <h1
          className="font-serif text-2xl sm:text-3xl font-semibold mt-5 leading-snug"
          style={{ color: "var(--text-1)" }}
        >
          {tournament.prompt}
        </h1>

        <div
          className="flex items-center gap-3 mt-2 text-xs flex-wrap"
          style={{ color: "var(--text-3)", fontFamily: "var(--font-sans)" }}
        >
          {tournament.genreHint && (
            <>
              <span>{tournament.genreHint}</span>
              <span style={{ color: "var(--border)" }}>·</span>
            </>
          )}
          <span>{tournament.minWords}–{tournament.maxWords} words</span>
          <span style={{ color: "var(--border)" }}>·</span>
          <span>{data.models.length} models</span>
        </div>
      </header>

      {error && (
        <div
          className="w-full max-w-3xl mb-5 px-4 py-3 rounded-lg text-sm"
          style={{
            background: "oklch(55% 0.175 22 / 0.07)",
            border: "1px solid oklch(55% 0.175 22 / 0.3)",
            color: "oklch(65% 0.14 22)",
            fontFamily: "var(--font-sans)",
          }}
        >
          {error}
        </div>
      )}

      <PhasePipeline
        data={data}
        status={status}
        onRetry={handleRetry}
        retrying={retrying}
      />

      {status === "failed" && (
        <button
          onClick={handleRetry}
          disabled={retrying}
          className="btn-primary mt-10"
        >
          {retrying ? "Retrying…" : "Retry Failed Step"}
        </button>
      )}
    </main>
  );
}
