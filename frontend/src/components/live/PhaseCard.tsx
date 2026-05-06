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

// Border + text color for each phase when active
const PHASE_CIRCLE: Record<string, { border: string; text: string; bg: string }> = {
  generation: {
    border: "var(--phase-teal)",
    text: "var(--phase-teal)",
    bg: "oklch(67% 0.14 189 / 0.1)",
  },
  review: {
    border: "var(--phase-orange)",
    text: "var(--phase-orange)",
    bg: "oklch(70% 0.15 43 / 0.1)",
  },
  revision: {
    border: "var(--phase-blue)",
    text: "var(--phase-blue)",
    bg: "oklch(66% 0.15 260 / 0.1)",
  },
  ranking: {
    border: "var(--text-2)",
    text: "var(--text-2)",
    bg: "var(--surface-raised)",
  },
  reveal: {
    border: "var(--phase-amber)",
    text: "var(--phase-amber)",
    bg: "oklch(75% 0.15 80 / 0.1)",
  },
};

export default function PhaseCard({
  number,
  label,
  phaseKey,
  status,
  progress,
  data,
  onRetry,
  retrying,
}: PhaseCardProps) {
  const [expanded, setExpanded] = useState(status !== "pending");

  const progressText = `${Math.min(progress.complete, progress.total)}/${progress.total}`;
  const phase = PHASE_CIRCLE[phaseKey] ?? PHASE_CIRCLE.ranking;

  // Circle styles per status
  let circleStyle: React.CSSProperties;
  if (status === "completed") {
    circleStyle = {
      background: "oklch(70% 0.145 148 / 0.12)",
      border: "2px solid oklch(50% 0.10 148 / 0.7)",
      color: "var(--success)",
    };
  } else if (status === "active") {
    circleStyle = {
      background: phase.bg,
      border: `2px solid ${phase.border}`,
      color: phase.text,
    };
  } else if (status === "failed") {
    circleStyle = {
      background: "oklch(55% 0.175 22 / 0.1)",
      border: "2px solid oklch(50% 0.14 22 / 0.6)",
      color: "var(--error)",
    };
  } else {
    circleStyle = {
      background: "var(--bg)",
      border: "2px solid var(--border-muted)",
      color: "var(--text-3)",
    };
  }

  return (
    <div
      className={`phase-card ${
        status === "active" ? "phase-card--active" : ""
      } ${status === "completed" ? "phase-card--completed" : ""} ${
        status === "failed" ? "phase-card--failed" : ""
      }`}
    >
      <button
        type="button"
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between gap-4 py-4 px-5"
        style={{ background: "none" }}
      >
        <div className="flex items-center gap-3.5">
          {/* Phase number circle */}
          <span
            className="flex items-center justify-center w-8 h-8 rounded-full text-sm font-bold shrink-0"
            style={{
              fontFamily: "var(--font-sans)",
              ...circleStyle,
            }}
          >
            {status === "completed" ? "✓" : status === "failed" ? "!" : number}
          </span>

          {/* Phase label */}
          <span
            className="font-serif text-base font-semibold"
            style={{
              color: status === "pending" ? "var(--text-3)" : "var(--text-1)",
            }}
          >
            {label}
          </span>
        </div>

        <div className="flex items-center gap-3 shrink-0">
          {progress.failed > 0 && (
            <span
              className="text-xs"
              style={{ color: "var(--error)", fontFamily: "var(--font-sans)" }}
            >
              {progress.failed} failed
            </span>
          )}
          <span
            className="text-sm tabular-nums"
            style={{
              fontFamily: "var(--font-sans)",
              color:
                status === "pending"
                  ? "var(--text-3)"
                  : status === "failed"
                  ? "var(--error)"
                  : "var(--text-2)",
            }}
          >
            {progressText}
          </span>
          {status === "active" && <span className="pulse-dot" />}
          <span
            className="text-xs"
            style={{
              fontFamily: "var(--font-sans)",
              color: expanded ? "var(--text-2)" : "var(--text-3)",
            }}
          >
            {expanded ? "▲" : "▼"}
          </span>
        </div>
      </button>

      {expanded && phaseKey !== "reveal" && (
        <div className="px-5 pb-4" style={{ borderTop: "1px solid var(--border-muted)" }}>
          <PhaseContent
            phaseKey={phaseKey as PhaseName}
            data={data}
            onRetry={onRetry}
            retrying={retrying}
          />
        </div>
      )}

      {expanded && phaseKey === "reveal" && (
        <div className="px-5 pb-4" style={{ borderTop: "1px solid var(--border-muted)" }}>
          {data.results.length > 0 ? (
            <p
              className="text-sm pt-3"
              style={{ color: "var(--phase-amber)", fontFamily: "var(--font-sans)" }}
            >
              Results ready — scroll down.
            </p>
          ) : (
            <p
              className="text-sm pt-3"
              style={{ color: "var(--text-3)", fontFamily: "var(--font-sans)" }}
            >
              Waiting for results…
            </p>
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
      <div className="flex flex-col gap-1.5 pt-3">
        {models.map((model, i) => {
          const story = data.storyVersions.find(
            (s) => s.modelKey === model.modelKey && s.round === "original"
          );
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
              detail={
                done
                  ? `${story.title} · ${story.wordCount} words`
                  : failed
                  ? call!.error ?? "Error"
                  : call?.status === "pending"
                  ? "Running…"
                  : undefined
              }
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
      <div className="flex flex-col gap-1.5 pt-3">
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
              detail={
                done
                  ? `Reviewed ${reviews.length} stories`
                  : failed
                  ? call!.error ?? "Error"
                  : call?.status === "pending"
                  ? "Running…"
                  : undefined
              }
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
      <div className="flex flex-col gap-1.5 pt-3">
        {models.map((model, i) => {
          const revision = data.storyVersions.find(
            (s) => s.modelKey === model.modelKey && s.round === "revised"
          );
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
              detail={
                done
                  ? `${revision.title} · ${revision.wordCount} words`
                  : failed
                  ? call!.error ?? "Error"
                  : call?.status === "pending"
                  ? "Running…"
                  : undefined
              }
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
      <div className="flex flex-col gap-1.5 pt-3">
        {models.map((model, i) => {
          const rankings = data.finalRankings.filter(
            (r) => r.reviewerModelKey === model.modelKey
          );
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
              detail={
                done
                  ? "Ranked all stories"
                  : failed
                  ? call!.error ?? "Error"
                  : call?.status === "pending"
                  ? "Running…"
                  : undefined
              }
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

function latestCall(
  calls: ProviderCall[],
  phase: PhaseName,
  modelKey: string
): ProviderCall | undefined {
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
      <div
        className="flex items-center justify-between py-2 px-3 rounded"
        style={{
          background: failed ? "oklch(55% 0.175 22 / 0.04)" : "var(--bg)",
          border: `1px solid ${failed ? "oklch(50% 0.14 22 / 0.2)" : "var(--border-muted)"}`,
        }}
      >
        <div className="flex items-center gap-2.5">
          {done && (
            <span className="text-xs shrink-0" style={{ color: "var(--success)" }}>
              ✓
            </span>
          )}
          {failed && (
            <span className="text-xs shrink-0" style={{ color: "var(--error)" }}>
              ✗
            </span>
          )}
          {!done && !failed && (
            <span
              className="text-xs shrink-0"
              style={{ color: "var(--text-3)", fontFamily: "var(--font-sans)" }}
            >
              ○
            </span>
          )}
          <span
            className="text-sm"
            style={{ color: "var(--text-2)", fontFamily: "var(--font-sans)" }}
          >
            {label}
          </span>
        </div>

        <div className="flex items-center gap-3">
          {detail && (
            <span
              className="text-xs"
              style={{
                color: failed ? "var(--error)" : "var(--text-3)",
                fontFamily: "var(--font-sans)",
              }}
            >
              {detail}
            </span>
          )}
          {attempts > 1 && (
            <span
              className="text-[11px]"
              style={{ color: "var(--accent-dim)", fontFamily: "var(--font-sans)" }}
            >
              Attempt {attempts}
            </span>
          )}
          {failed && (
            <button
              onClick={onRetry}
              disabled={retrying}
              className="text-xs underline"
              style={{ color: "var(--error)", fontFamily: "var(--font-sans)" }}
            >
              {retrying ? "Retrying…" : "Retry"}
            </button>
          )}
          {call && (
            <button
              onClick={() => setShowLog(!showLog)}
              className="text-xs"
              style={{
                color: showLog ? "var(--text-2)" : "var(--text-3)",
                fontFamily: "var(--font-sans)",
              }}
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
