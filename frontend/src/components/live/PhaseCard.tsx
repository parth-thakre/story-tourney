"use client";

import { useState } from "react";
import { type TournamentView, type PhaseName, type ProviderCall, type DisplayPhase } from "@/types";
import DevDrawer from "@/components/live/DevDrawer";

interface PhaseCardProps {
  number: number;
  label: string;
  phaseKey: DisplayPhase;
  status: "pending" | "active" | "completed" | "failed";
  progress: { complete: number; total: number; failed: number };
  data: TournamentView;
  onRetry: () => void;
  retrying: boolean;
}

const ACCENT_MAP: Record<string, string> = {
  generation: "border-teal-600 text-teal-400",
  review: "border-orange-600 text-orange-400",
  revision: "border-blue-600 text-blue-400",
  ranking: "border-zinc-500 text-zinc-300",
  reveal: "border-amber-500 text-amber-400",
};

const ACCENT_BG: Record<string, string> = {
  generation: "bg-teal-950/40",
  review: "bg-orange-950/40",
  revision: "bg-blue-950/40",
  ranking: "bg-zinc-800/40",
  reveal: "bg-amber-950/40",
};

export default function PhaseCard({ number, label, phaseKey, status, progress, data, onRetry, retrying }: PhaseCardProps) {
  const [expanded, setExpanded] = useState(status !== "pending");

  const progressText = `${Math.min(progress.complete, progress.total)}/${progress.total}`;

  const accent = ACCENT_MAP[phaseKey] ?? "";
  const accentBg = ACCENT_BG[phaseKey] ?? "";

  return (
    <div
      className={`phase-card ${status === "active" ? "phase-card--active" : ""} ${status === "completed" ? "phase-card--completed" : ""} ${status === "failed" ? "phase-card--failed" : ""}`}
    >
      <button
        type="button"
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between gap-4 py-4 px-5"
      >
        <div className="flex items-center gap-4">
          <span
            className={`flex items-center justify-center w-9 h-9 rounded-full text-sm font-bold font-sans border-2 ${status === "completed" ? "bg-emerald-900/60 border-emerald-600 text-emerald-300" : status === "active" ? `${accentBg} ${accent} border-current` : status === "failed" ? "bg-red-950/60 border-red-600 text-red-400" : "bg-zinc-900 border-zinc-700 text-zinc-500"}`}
          >
            {status === "completed" ? "✓" : status === "failed" ? "!" : number}
          </span>
          <span className={`font-serif text-lg font-semibold ${status === "pending" ? "text-zinc-600" : "text-zinc-100"}`}>
            {label}
          </span>
        </div>

        <div className="flex items-center gap-3">
          {progress.failed > 0 && (
            <span className="text-xs text-red-400 font-sans">
              {progress.failed} failed
            </span>
          )}
          <span className={`font-sans text-sm tabular-nums ${status === "pending" ? "text-zinc-700" : status === "failed" ? "text-red-400" : "text-zinc-400"}`}>
            {progressText}
          </span>
          {status === "active" && <span className="pulse-dot" />}
          <span className={`text-xs font-sans ${expanded ? "text-zinc-400" : "text-zinc-600"}`}>
            {expanded ? "▲" : "▼"}
          </span>
        </div>
      </button>

      {expanded && phaseKey !== "reveal" && (
        <div className="px-5 pb-4 border-t border-zinc-800/60">
          <PhaseContent phaseKey={phaseKey as PhaseName} data={data} onRetry={onRetry} retrying={retrying} />
        </div>
      )}

      {expanded && phaseKey === "reveal" && (
        <div className="px-5 pb-4 border-t border-zinc-800/60">
          {data.results.length > 0 ? (
            <p className="text-amber-400 font-sans text-sm pt-3">
              Results ready — scroll down.
            </p>
          ) : (
            <p className="text-zinc-500 font-sans text-sm pt-3">Waiting for results...</p>
          )}
        </div>
      )}
    </div>
  );
}

function PhaseContent({
  phaseKey,
  data,
  onRetry,
  retrying,
}: {
  phaseKey: PhaseName;
  data: TournamentView;
  onRetry: () => void;
  retrying: boolean;
}) {
  const models = data.models;

  if (phaseKey === "generation") {
    return (
      <div className="flex flex-col gap-2 pt-3">
        {models.map((model, i) => {
          const story = data.storyVersions.find((s) => s.modelKey === model.modelKey && s.round === "original");
          const call = latestCall(data.providerCalls, "generation", model.modelKey);
          const attempts = attemptCount(data.providerCalls, "generation", model.modelKey);
          const done = !!story;
          const failed = !done && call?.status === "failed";
          return (
            <ModelCallRow
              key={model.modelKey}
              label={`Story ${i + 1} · ${model.displayName}`}
              done={done}
              failed={failed}
              detail={done ? `${story.title} · ${story.wordCount} words` : failed ? call!.error ?? "Error" : call?.status === "pending" ? "Running..." : undefined}
              call={call}
              attempts={attempts}
              onRetry={onRetry}
              retrying={retrying}
            />
          );
        })}
      </div>
    );
  }

  if (phaseKey === "review") {
    return (
      <div className="flex flex-col gap-2 pt-3">
        {models.map((model, i) => {
          const reviews = data.reviews.filter((r) => r.reviewerModelKey === model.modelKey);
          const call = latestCall(data.providerCalls, "review", model.modelKey);
          const attempts = attemptCount(data.providerCalls, "review", model.modelKey);
          const done = reviews.length > 0;
          const failed = !done && call?.status === "failed";
          return (
            <ModelCallRow
              key={model.modelKey}
              label={`Reviewer ${i + 1} · ${model.displayName}`}
              done={done}
              failed={failed}
              detail={done ? `Reviewed ${reviews.length} stories` : failed ? call!.error ?? "Error" : call?.status === "pending" ? "Running..." : undefined}
              call={call}
              attempts={attempts}
              onRetry={onRetry}
              retrying={retrying}
            />
          );
        })}
      </div>
    );
  }

  if (phaseKey === "revision") {
    return (
      <div className="flex flex-col gap-2 pt-3">
        {models.map((model, i) => {
          const revision = data.storyVersions.find((s) => s.modelKey === model.modelKey && s.round === "revised");
          const call = latestCall(data.providerCalls, "revision", model.modelKey);
          const attempts = attemptCount(data.providerCalls, "revision", model.modelKey);
          const done = !!revision;
          const failed = !done && call?.status === "failed";
          return (
            <ModelCallRow
              key={model.modelKey}
              label={`Revision ${i + 1} · ${model.displayName}`}
              done={done}
              failed={failed}
              detail={done ? `${revision.title} · ${revision.wordCount} words` : failed ? call!.error ?? "Error" : call?.status === "pending" ? "Running..." : undefined}
              call={call}
              attempts={attempts}
              onRetry={onRetry}
              retrying={retrying}
            />
          );
        })}
      </div>
    );
  }

  if (phaseKey === "ranking") {
    return (
      <div className="flex flex-col gap-2 pt-3">
        {models.map((model, i) => {
          const rankings = data.finalRankings.filter((r) => r.reviewerModelKey === model.modelKey);
          const call = latestCall(data.providerCalls, "ranking", model.modelKey);
          const attempts = attemptCount(data.providerCalls, "ranking", model.modelKey);
          const done = rankings.length > 0;
          const failed = !done && call?.status === "failed";
          return (
            <ModelCallRow
              key={model.modelKey}
              label={`Judge ${i + 1} · ${model.displayName}`}
              done={done}
              failed={failed}
              detail={done ? "Ranked all stories" : failed ? call!.error ?? "Error" : call?.status === "pending" ? "Running..." : undefined}
              call={call}
              attempts={attempts}
              onRetry={onRetry}
              retrying={retrying}
            />
          );
        })}
      </div>
    );
  }

  return null;
}

function latestCall(calls: ProviderCall[], phase: PhaseName, modelKey: string): ProviderCall | undefined {
  const matching = calls.filter((c) => c.phase === phase && c.modelKey === modelKey);
  if (matching.length === 0) return undefined;
  return matching.reduce((a, b) => (b.attempt > a.attempt ? b : a));
}

function attemptCount(calls: ProviderCall[], phase: PhaseName, modelKey: string): number {
  return calls.filter((c) => c.phase === phase && c.modelKey === modelKey).length;
}

function ModelCallRow({
  label,
  done,
  failed,
  detail,
  call,
  attempts,
  onRetry,
  retrying,
}: {
  label: string;
  done: boolean;
  failed: boolean;
  detail?: string;
  call?: ProviderCall;
  attempts: number;
  onRetry: () => void;
  retrying: boolean;
}) {
  const [showLog, setShowLog] = useState(false);

  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center justify-between py-2 px-3 rounded-md bg-zinc-900/50">
        <div className="flex items-center gap-2">
          {done && <span className="text-emerald-400 text-sm">✓</span>}
          {failed && <span className="text-red-400 text-sm">✗</span>}
          {!done && !failed && <span className="text-zinc-600 text-sm">○</span>}
          <span className="font-sans text-sm text-zinc-300">{label}</span>
        </div>
        <div className="flex items-center gap-3">
          {detail && (
            <span className={`font-sans text-xs ${failed ? "text-red-400" : "text-zinc-500"}`}>
              {detail}
            </span>
          )}
          {attempts > 1 && (
            <span className="font-sans text-[11px] text-amber-400">
              Attempt {attempts}
            </span>
          )}
          {failed && (
            <button onClick={onRetry} disabled={retrying} className="text-xs text-red-400 hover:text-red-300 font-sans underline">
              {retrying ? "Retrying..." : "Retry"}
            </button>
          )}
          {call && (
            <button
              onClick={() => setShowLog(!showLog)}
              className="text-xs text-zinc-500 hover:text-zinc-300 font-sans"
            >
              {showLog ? "Hide" : "Dev"}
            </button>
          )}
        </div>
      </div>
      {showLog && call && <DevDrawer call={call} />}
    </div>
  );
}
