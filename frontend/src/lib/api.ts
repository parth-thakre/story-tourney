import type { TournamentView, CreateTournamentRequest, ModelRegistryEntry } from "@/types";

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "/api";

async function fetchJSON<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${url}`, {
    headers: { "Content-Type": "application/json", ...init?.headers },
    ...init,
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`API ${res.status}: ${body}`);
  }
  return res.json();
}

export async function getModels(): Promise<ModelRegistryEntry[]> {
  const data = await fetchJSON<{ models: ModelRegistryEntry[] }>("/models");
  return data.models;
}

export async function createTournament(data: CreateTournamentRequest): Promise<TournamentView> {
  return fetchJSON<TournamentView>("/tournaments", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export async function getTournament(id: string): Promise<TournamentView> {
  return fetchJSON<TournamentView>(`/tournaments/${id}`);
}

export async function listTournaments(): Promise<TournamentView[]> {
  const data = await fetchJSON<{ tournaments: TournamentView[] }>("/tournaments");
  return data.tournaments;
}

export async function retryTournament(id: string): Promise<TournamentView> {
  return fetchJSON<TournamentView>(`/tournaments/${id}/retry`, { method: "POST" });
}

export async function exportTournament(id: string, format: "md" | "txt" = "md"): Promise<Blob> {
  const res = await fetch(`${API_BASE}/tournaments/${id}/export?format=${format}`);
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Export failed: ${body}`);
  }
  return res.blob();
}

export function getTournamentExportUrl(id: string, format: "md" | "txt" = "md"): string {
  return `${API_BASE}/tournaments/${id}/export?format=${format}`;
}
