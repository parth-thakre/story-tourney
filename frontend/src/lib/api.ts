import type {
  TournamentView,
  CreateTournamentRequest,
  ModelRegistryEntry,
  OpenRouterCatalogModel,
  SettingsState,
} from "@/types";

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

export function getSettings(): Promise<SettingsState> {
  return fetchJSON<SettingsState>("/settings");
}

export async function saveOpenRouterApiKey(apiKey: string | null): Promise<{ hasOpenRouterApiKey: boolean }> {
  return fetchJSON<{ hasOpenRouterApiKey: boolean }>("/settings/openrouter-key", {
    method: "PUT",
    body: JSON.stringify({ apiKey }),
  });
}

export async function getOpenRouterCatalog(): Promise<OpenRouterCatalogModel[]> {
  const data = await fetchJSON<{ models: OpenRouterCatalogModel[] }>("/model-catalog/openrouter");
  return data.models;
}

export async function saveConfiguredModels(models: OpenRouterCatalogModel[]): Promise<ModelRegistryEntry[]> {
  const data = await fetchJSON<{ models: ModelRegistryEntry[] }>("/settings/models", {
    method: "PUT",
    body: JSON.stringify({
      models: models.map((model) => ({
        modelKey: model.modelKey,
        displayName: model.displayName,
        modelId: model.modelId,
        providerModelId: model.providerModelId,
        providerOrder: model.providerOrder,
      })),
    }),
  });
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
