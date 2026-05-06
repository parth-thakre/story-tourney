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
    <main className="min-h-screen flex flex-col items-center justify-start px-5 sm:px-8 pb-28">

      {/* ── Hero ─────────────────────────────────────────────────────────── */}
      <header className="w-full max-w-2xl pt-20 sm:pt-32 mb-16 sm:mb-20">

        {/* Eyebrow */}
        <p
          className="text-[10px] uppercase tracking-[0.28em] mb-7 font-medium"
          style={{ color: "var(--accent-dim)", fontFamily: "var(--font-sans)" }}
        >
          Blind literary competition
        </p>

        {/* Display title */}
        <h1
          className="font-serif font-bold leading-[0.88] mb-8"
          style={{ letterSpacing: "-0.02em" }}
        >
          <span
            className="block italic"
            style={{
              fontSize: "clamp(3rem, 9vw, 5rem)",
              color: "var(--text-2)",
            }}
          >
            Story
          </span>
          <span
            className="block"
            style={{
              fontSize: "clamp(3.5rem, 11vw, 6.5rem)",
              color: "var(--text-1)",
            }}
          >
            Tournament
          </span>
        </h1>

        {/* Gold rule */}
        <div
          style={{
            width: "2.75rem",
            height: "1.5px",
            background: "var(--accent)",
            marginBottom: "1.25rem",
          }}
        />

        {/* Standfirst */}
        <p
          className="text-[0.9375rem] leading-relaxed"
          style={{
            color: "var(--text-3)",
            fontFamily: "var(--font-sans)",
            maxWidth: "30rem",
          }}
        >
          Four models. One prompt. Blind peer review, revision, and a ceremonial reveal of who wrote what.
        </p>
      </header>

      {/* ── Error ────────────────────────────────────────────────────────── */}
      {error && (
        <div
          className="w-full max-w-2xl mb-6 px-4 py-3 rounded-lg text-sm"
          style={{
            background: "oklch(55% 0.175 22 / 0.08)",
            border: "1px solid oklch(55% 0.175 22 / 0.35)",
            color: "oklch(70% 0.13 22)",
            fontFamily: "var(--font-sans)",
          }}
        >
          {error}
        </div>
      )}

      {/* ── Form ─────────────────────────────────────────────────────────── */}
      <SetupForm onSubmit={handleSubmit} isLoading={isLoading} />

      {/* ── Footer link ──────────────────────────────────────────────────── */}
      <div className="mt-14">
        <Link href="/history" className="back-link" style={{ transform: "none" }}>
          <span style={{ marginLeft: "0.25rem" }}>View past tournaments</span>
        </Link>
      </div>

    </main>
  );
}
