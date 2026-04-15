"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import SetupForm from "@/components/setup/SetupForm";
import { createTournament } from "@/lib/api";
import type { ModelKey } from "@/types";

export default function SetupPage() {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(data: {
    prompt: string;
    genreHint: string;
    minWords: number;
    maxWords: number;
    selectedModels: ModelKey[];
  }) {
    setIsLoading(true);
    setError(null);
    try {
      const view = await createTournament({
        prompt: data.prompt,
        genreHint: data.genreHint || null,
        minWords: data.minWords,
        maxWords: data.maxWords,
        selectedModels: data.selectedModels,
      });
      router.push(`/tournament/${view.tournament.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to start tournament");
      setIsLoading(false);
    }
  }

  return (
    <main className="min-h-screen bg-[var(--bg)] flex flex-col items-center justify-start pt-16 sm:pt-24 px-4 sm:px-6 pb-16">
      <header className="text-center mb-10">
        <h1 className="font-serif text-4xl sm:text-5xl font-bold text-zinc-100 tracking-tight">
          Story Tournament
        </h1>
        <p className="mt-3 text-zinc-400 font-sans text-base max-w-md mx-auto">
          Two to four models. One prompt. Blind review. See who writes the best story.
        </p>
      </header>

      {error && (
        <div className="w-full max-w-2xl mb-6 px-4 py-3 rounded-lg bg-red-950/60 border border-red-800/50 text-red-300 text-sm font-sans">
          {error}
        </div>
      )}

      <SetupForm onSubmit={handleSubmit} isLoading={isLoading} />

      <div className="mt-12">
        <Link
          href="/history"
          className="text-zinc-500 hover:text-zinc-300 text-sm font-sans underline underline-offset-4 decoration-zinc-600 transition-colors"
        >
          View past tournaments
        </Link>
      </div>
    </main>
  );
}
