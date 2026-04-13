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
      <main className="min-h-screen bg-[var(--bg)] flex flex-col items-center justify-center px-4">
        <p className="text-red-400 font-sans">{error}</p>
        <Link href="/" className="btn-primary mt-4">Back to Setup</Link>
      </main>
    );
  }

  if (!data) {
    return (
      <main className="min-h-screen bg-[var(--bg)] flex items-center justify-center">
        <div className="spinner-lg" />
      </main>
    );
  }

  const { tournament } = data;
  const status = tournament.status;

  if (status === "completed" && data.results.length > 0) {
    return <ResultsView data={data} onNewPrompt={() => router.push("/")} onRunAgain={handleRetry} />;
  }

  return (
    <main className="min-h-screen bg-[var(--bg)] flex flex-col items-center px-4 sm:px-6 pt-10 pb-16">
      <header className="w-full max-w-3xl mb-8">
        <Link href="/" className="text-zinc-500 hover:text-zinc-300 text-sm font-sans underline underline-offset-4 decoration-zinc-600 transition-colors">
          Back to Setup
        </Link>
        <h1 className="font-serif text-2xl sm:text-3xl font-bold text-zinc-100 mt-4 leading-snug">
          {tournament.prompt}
        </h1>
        {tournament.genreHint && (
          <p className="text-zinc-500 font-sans text-sm mt-1">
            Style: {tournament.genreHint}
          </p>
        )}
        <p className="text-zinc-600 font-sans text-xs mt-1">
          {tournament.minWords}–{tournament.maxWords} words · {data.models.length} models
        </p>
      </header>

      {error && (
        <div className="w-full max-w-3xl mb-4 px-4 py-3 rounded-lg bg-red-950/60 border border-red-800/50 text-red-300 text-sm font-sans">
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
        <button onClick={handleRetry} disabled={retrying} className="btn-primary mt-8">
          {retrying ? "Retrying..." : "Retry Failed Step"}
        </button>
      )}
    </main>
  );
}