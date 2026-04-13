import fs from "node:fs";
import path from "node:path";
import { PhaseName, ProviderCall, TournamentView } from "./types";

const TOURNEYS_DIR = path.resolve(process.cwd(), "tourneys");

function ensureDir(dirPath: string) {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
}

function safeJson(value: string | null) {
  if (!value) {
    return null;
  }
  try {
    return JSON.parse(value);
  } catch {
    return value;
  }
}

function tournamentDir(tournamentId: string) {
  return path.join(TOURNEYS_DIR, tournamentId);
}

export function ensureTournamentArchive(tournamentId: string) {
  ensureDir(TOURNEYS_DIR);
  ensureDir(tournamentDir(tournamentId));
  ensureDir(path.join(tournamentDir(tournamentId), "calls"));
  ensureDir(path.join(tournamentDir(tournamentId), "snapshots"));
}

export function archiveProviderCall(call: ProviderCall) {
  ensureTournamentArchive(call.tournamentId);
  const callBase = `${call.phase}-${call.modelKey}-attempt-${call.attempt}`;
  const callDir = path.join(tournamentDir(call.tournamentId), "calls", callBase);
  ensureDir(callDir);

  fs.writeFileSync(
    path.join(callDir, "meta.json"),
    JSON.stringify(
      {
        id: call.id,
        tournamentId: call.tournamentId,
        phase: call.phase,
        modelKey: call.modelKey,
        status: call.status,
        attempt: call.attempt,
        error: call.error,
        createdAt: call.createdAt,
        completedAt: call.completedAt,
      },
      null,
      2,
    ),
  );

  fs.writeFileSync(path.join(callDir, "request.json"), call.requestJson);
  fs.writeFileSync(path.join(callDir, "context.json"), call.contextJson);
  fs.writeFileSync(
    path.join(callDir, "response.json"),
    JSON.stringify(safeJson(call.responseJson), null, 2),
  );
}

export function archiveTournamentSnapshot(view: TournamentView, label: string) {
  ensureTournamentArchive(view.tournament.id);
  const snapshotPath = path.join(tournamentDir(view.tournament.id), "snapshots", `${label}.json`);
  fs.writeFileSync(snapshotPath, JSON.stringify(view, null, 2));
}
