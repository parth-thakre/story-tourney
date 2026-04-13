"use client";

import { PHASE_CONFIG, type TournamentView, type TournamentStatus, type DisplayPhase } from "@/types";
import PhaseCard from "@/components/live/PhaseCard";

interface PhasePipelineProps {
  data: TournamentView;
  status: TournamentStatus;
  onRetry: () => void;
  retrying: boolean;
}

function inferFailedPhase(data: TournamentView): DisplayPhase {
  const { progress } = data;
  if (progress.generation.failed > 0 || progress.generation.complete < progress.generation.total) {
    if (progress.generation.complete === 0 && progress.generation.failed > 0) return "generation";
  }
  if (progress.generation.complete < progress.generation.total) return "generation";
  if (progress.review.complete < progress.review.total) return "review";
  if (progress.revision.complete < progress.revision.total) return "revision";
  return "ranking";
}

function getPhaseStatus(
  phase: DisplayPhase,
  data: TournamentView,
  status: TournamentStatus
): "pending" | "active" | "completed" | "failed" {
  if (status === "created") return "pending";

  const phaseOrder: DisplayPhase[] = ["generation", "review", "revision", "ranking", "reveal"];
  const statusMap: Record<string, DisplayPhase> = {
    generating: "generation",
    reviewing: "review",
    revising: "revision",
    ranking: "ranking",
    completed: "reveal",
  };

  if (status === "failed") {
    const failedPhase = inferFailedPhase(data);
    const failedIdx = phaseOrder.indexOf(failedPhase);
    const phaseIdx = phaseOrder.indexOf(phase);
    if (phase === failedPhase) return "failed";
    return phaseIdx < failedIdx ? "completed" : "pending";
  }

  const currentPhase = statusMap[status];
  if (!currentPhase) return "pending";
  const currentIdx = phaseOrder.indexOf(currentPhase);
  const phaseIdx = phaseOrder.indexOf(phase);

  if (phaseIdx < currentIdx) return "completed";
  if (phaseIdx === currentIdx) return "active";
  return "pending";
}

export default function PhasePipeline({ data, status, onRetry, retrying }: PhasePipelineProps) {
  return (
    <div className="w-full max-w-3xl flex flex-col gap-2">
      {PHASE_CONFIG.map((phase) => {
        const phaseStatus = phase.key === "reveal"
          ? (status === "completed" && data.results.length > 0 ? "completed" : status === "completed" ? "active" : "pending")
          : getPhaseStatus(phase.key, data, status);

        const total = data.models.length;
        let complete: number;
        let failed: number;

        if (phase.key === "reveal") {
          complete = data.results.length > 0 ? total : 0;
          failed = 0;
        } else {
          const p = data.progress[phase.key];
          complete = p.complete;
          failed = p.failed;
        }

        return (
          <PhaseCard
            key={phase.key}
            number={phase.number}
            label={phase.label}
            phaseKey={phase.key}
            status={phaseStatus}
            progress={{ complete, total, failed }}
            data={data}
            onRetry={onRetry}
            retrying={retrying}
          />
        );
      })}
    </div>
  );
}