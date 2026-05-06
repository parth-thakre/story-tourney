"use client";

import { useState, useEffect, useRef } from "react";
import { type ModelKey, type ModelRegistryEntry, type OpenRouterCatalogModel } from "@/types";
import {
  getOpenRouterCatalog,
  getSettings,
  saveConfiguredModels,
  saveOpenRouterApiKey,
} from "@/lib/api";

const MIN_WORDS_DEFAULT = 800;
const MAX_WORDS_DEFAULT = 1200;
const MIN_WORDS_FLOOR = 100;
const MIN_WORDS_CEILING = 5000;
const MAX_WORDS_CEILING = 10000;
const MIN_SELECTED_MODELS = 2;
const MAX_SELECTED_MODELS = 4;
const PRESETS_STORAGE_KEY = "story-tourney:model-presets";

/* ─── Preset types ──────────────────────────────────────────────────────── */
interface ModelPreset {
  id: string;
  name: string;
  modelIds: string[]; // providerModelId values
  builtIn: boolean;
}

const BUILT_IN_PRESETS: ModelPreset[] = [
  {
    id: "frontier",
    name: "Frontier",
    modelIds: [
      "openai/gpt-5.5",
      "anthropic/claude-opus-4.7",
      "google/gemini-3.1-pro-preview",
      "x-ai/grok-4.3",
    ],
    builtIn: true,
  },
  {
    id: "balanced",
    name: "Balanced",
    modelIds: [
      "openai/gpt-5.4",
      "anthropic/claude-sonnet-4.6",
      "google/gemini-3-pro-preview",
      "deepseek/deepseek-v3.2",
    ],
    builtIn: true,
  },
  {
    id: "budget",
    name: "Budget",
    modelIds: [
      "openai/gpt-5.4-mini",
      "anthropic/claude-haiku-4.5",
      "google/gemini-2.5-flash-lite",
      "qwen/qwen3.5-flash-02-23",
    ],
    builtIn: true,
  },
  {
    id: "gpt-5-family",
    name: "GPT-5 Family",
    modelIds: [
      "openai/gpt-5.5",
      "openai/gpt-5.4",
      "openai/gpt-5.2",
      "openai/gpt-5.1",
    ],
    builtIn: true,
  },
];

function loadCustomPresets(): ModelPreset[] {
  try {
    const raw = localStorage.getItem(PRESETS_STORAGE_KEY);
    if (!raw) return [];
    return JSON.parse(raw) as ModelPreset[];
  } catch {
    return [];
  }
}

function persistCustomPresets(presets: ModelPreset[]) {
  localStorage.setItem(PRESETS_STORAGE_KEY, JSON.stringify(presets));
}

/* ─── Helpers ───────────────────────────────────────────────────────────── */
function parseWordCount(value: string) {
  if (value === "") return null;
  const n = Number.parseInt(value, 10);
  return Number.isNaN(n) ? null : n;
}

function dedupeModels(models: OpenRouterCatalogModel[]) {
  const seen = new Set<string>();
  return models.filter((m) => {
    if (seen.has(m.providerModelId)) return false;
    seen.add(m.providerModelId);
    return true;
  });
}

function sortedIds(models: OpenRouterCatalogModel[]) {
  return models.map((m) => m.providerModelId).sort().join(",");
}

function normalizeSearch(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

/* ─── Props ─────────────────────────────────────────────────────────────── */
interface SetupFormProps {
  onSubmit: (data: {
    prompt: string;
    genreHint: string;
    minWords: number;
    maxWords: number;
    selectedModels: ModelKey[];
  }) => void;
  isLoading: boolean;
}

/* ─── Component ─────────────────────────────────────────────────────────── */
export default function SetupForm({ onSubmit, isLoading }: SetupFormProps) {
  // Story fields
  const [prompt, setPrompt] = useState("");
  const [genreHint, setGenreHint] = useState("");
  const [minWordsInput, setMinWordsInput] = useState(String(MIN_WORDS_DEFAULT));
  const [maxWordsInput, setMaxWordsInput] = useState(String(MAX_WORDS_DEFAULT));

  // Model state
  const [selectedModels, setSelectedModels] = useState<ModelKey[]>([]);
  const [availableModels, setAvailableModels] = useState<ModelRegistryEntry[]>([]);
  const [catalogModels, setCatalogModels] = useState<OpenRouterCatalogModel[]>([]);
  const [configuredModels, setConfiguredModels] = useState<OpenRouterCatalogModel[]>([]);

  // Search dropdown
  const [modelSearch, setModelSearch] = useState("");
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const searchRef = useRef<HTMLInputElement>(null);
  const dropdownWrapRef = useRef<HTMLDivElement>(null);

  // API key
  const [apiKeyInput, setApiKeyInput] = useState("");
  const [hasApiKey, setHasApiKey] = useState(false);
  const [apiKeyMsg, setApiKeyMsg] = useState("");
  const [isSavingKey, setIsSavingKey] = useState(false);

  // Auto-save
  type SaveStatus = "idle" | "saving" | "saved" | "error";
  const [saveStatus, setSaveStatus] = useState<SaveStatus>("idle");
  const lastSavedIds = useRef<string | null>(null); // null = not loaded yet

  // Presets
  const [customPresets, setCustomPresets] = useState<ModelPreset[]>([]);
  const [presetOpen, setPresetOpen] = useState(false);
  const [presetName, setPresetName] = useState("");
  const presetInputRef = useRef<HTMLInputElement>(null);

  const minWords = parseWordCount(minWordsInput);
  const maxWords = parseWordCount(maxWordsInput);
  const validWordCounts =
    minWords !== null &&
    maxWords !== null &&
    minWords >= MIN_WORDS_FLOOR &&
    minWords <= MIN_WORDS_CEILING &&
    maxWords >= MIN_WORDS_FLOOR &&
    maxWords <= MAX_WORDS_CEILING &&
    minWords <= maxWords;

  /* ── Initial load ─────────────────────────────────────────────────────── */
  useEffect(() => {
    setCustomPresets(loadCustomPresets());

    Promise.all([getSettings(), getOpenRouterCatalog()])
      .then(([settings, catalog]) => {
        setHasApiKey(settings.hasOpenRouterApiKey);
        setAvailableModels(settings.models);
        setCatalogModels(catalog);

        const byId = new Map(catalog.map((m) => [m.providerModelId, m]));
        const configured = dedupeModels(
          settings.models.slice(0, MAX_SELECTED_MODELS).map(
            (m) =>
              byId.get(m.providerModelId) ?? {
                modelKey: m.modelKey,
                displayName: m.displayName,
                modelId: m.providerModelId.split("/").pop() ?? m.providerModelId,
                providerModelId: m.providerModelId,
                providerOrder: [],
                family: null,
                contextLength: null,
                inputCost: null,
                outputCost: null,
                releaseDate: null,
                lastUpdated: null,
              }
          )
        );

        lastSavedIds.current = sortedIds(configured);
        setConfiguredModels(configured);
        setSelectedModels(settings.models.slice(0, MAX_SELECTED_MODELS).map((m) => m.modelKey));
      })
      .catch((err) =>
        setApiKeyMsg(err instanceof Error ? err.message : "Failed to load settings")
      );
  }, []);

  /* ── Auto-save on model change ────────────────────────────────────────── */
  useEffect(() => {
    if (lastSavedIds.current === null) return; // still loading
    const current = sortedIds(configuredModels);
    if (current === lastSavedIds.current) return; // nothing changed

    setSaveStatus("saving");
    const timer = setTimeout(async () => {
      try {
        const deduped = dedupeModels(configuredModels);
        const saved = await saveConfiguredModels(deduped);
        setAvailableModels(saved);
        setSelectedModels(saved.map((m) => m.modelKey));
        lastSavedIds.current = current;
        setSaveStatus("saved");
        setTimeout(() => setSaveStatus("idle"), 2000);
      } catch {
        setSaveStatus("error");
      }
    }, 500);

    return () => clearTimeout(timer);
  }, [configuredModels]);

  /* ── Close dropdown on outside click ─────────────────────────────────── */
  useEffect(() => {
    function onMouseDown(e: MouseEvent) {
      if (!dropdownWrapRef.current?.contains(e.target as Node)) {
        setDropdownOpen(false);
        setActiveIndex(-1);
      }
    }
    document.addEventListener("mousedown", onMouseDown);
    return () => document.removeEventListener("mousedown", onMouseDown);
  }, []);

  /* ── Focus preset input when it opens ────────────────────────────────── */
  useEffect(() => {
    if (presetOpen) presetInputRef.current?.focus();
  }, [presetOpen]);

  /* ── Filtered catalog ─────────────────────────────────────────────────── */
  const filteredCatalog = catalogModels
    .filter((m) => {
      const q = normalizeSearch(modelSearch);
      if (!q) return false;
      return normalizeSearch(`${m.displayName} ${m.providerModelId} ${m.family ?? ""}`).includes(q);
    })
    .filter((m) => !configuredModels.some((s) => s.providerModelId === m.providerModelId))
    .slice(0, 8);

  const canAddMore = configuredModels.length < MAX_SELECTED_MODELS;
  const showDropdown = dropdownOpen && modelSearch.trim().length > 0 && canAddMore;

  /* ── Model actions ────────────────────────────────────────────────────── */
  function addModel(providerModelId: string) {
    const model = catalogModels.find((m) => m.providerModelId === providerModelId);
    if (!model) return;
    setConfiguredModels((prev) => {
      if (prev.length >= MAX_SELECTED_MODELS || prev.some((m) => m.providerModelId === providerModelId))
        return prev;
      return [...prev, model];
    });
    setModelSearch("");
    setDropdownOpen(false);
    setActiveIndex(-1);
    searchRef.current?.focus();
  }

  function removeModel(providerModelId: string) {
    setConfiguredModels((prev) => prev.filter((m) => m.providerModelId !== providerModelId));
  }

  function handleSearchKey(e: React.KeyboardEvent<HTMLInputElement>) {
    if (!showDropdown) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIndex((i) => Math.min(i + 1, filteredCatalog.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIndex((i) => Math.max(i - 1, 0));
    } else if (e.key === "Enter" && activeIndex >= 0) {
      e.preventDefault();
      addModel(filteredCatalog[activeIndex].providerModelId);
    } else if (e.key === "Escape") {
      setDropdownOpen(false);
      setActiveIndex(-1);
    }
  }

  /* ── Preset actions ───────────────────────────────────────────────────── */
  const allPresets = [...BUILT_IN_PRESETS, ...customPresets];

  function activePresetId(): string | null {
    const current = sortedIds(configuredModels);
    return allPresets.find((p) => [...p.modelIds].sort().join(",") === current)?.id ?? null;
  }

  function applyPreset(preset: ModelPreset) {
    const byId = new Map(catalogModels.map((m) => [m.providerModelId, m]));
    const models = preset.modelIds
      .map((id) => byId.get(id))
      .filter((m): m is OpenRouterCatalogModel => !!m)
      .slice(0, MAX_SELECTED_MODELS);
    setConfiguredModels(models);
  }

  function deletePreset(id: string) {
    setCustomPresets((prev) => {
      const next = prev.filter((p) => p.id !== id);
      persistCustomPresets(next);
      return next;
    });
  }

  function savePreset() {
    const name = presetName.trim();
    if (!name) return;
    const preset: ModelPreset = {
      id: `custom-${Date.now()}`,
      name,
      modelIds: configuredModels.map((m) => m.providerModelId),
      builtIn: false,
    };
    setCustomPresets((prev) => {
      const next = [...prev, preset];
      persistCustomPresets(next);
      return next;
    });
    setPresetName("");
    setPresetOpen(false);
  }

  /* ── API key ──────────────────────────────────────────────────────────── */
  async function handleSaveKey() {
    setIsSavingKey(true);
    setApiKeyMsg("");
    try {
      const result = await saveOpenRouterApiKey(apiKeyInput.trim() || null);
      setHasApiKey(result.hasOpenRouterApiKey);
      setApiKeyInput("");
      setApiKeyMsg(result.hasOpenRouterApiKey ? "Key saved." : "Key cleared.");
    } catch (err) {
      setApiKeyMsg(err instanceof Error ? err.message : "Failed to save key");
    } finally {
      setIsSavingKey(false);
    }
  }

  /* ── Submit ───────────────────────────────────────────────────────────── */
  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (
      !prompt.trim() ||
      selectedModels.length < MIN_SELECTED_MODELS ||
      selectedModels.length > MAX_SELECTED_MODELS ||
      !validWordCounts
    )
      return;
    onSubmit({
      prompt: prompt.trim(),
      genreHint: genreHint.trim(),
      minWords: minWords!,
      maxWords: maxWords!,
      selectedModels: [...new Set(selectedModels)],
    });
  }

  const isValid =
    prompt.trim().length > 0 &&
    selectedModels.length >= MIN_SELECTED_MODELS &&
    selectedModels.length <= MAX_SELECTED_MODELS &&
    validWordCounts;

  const currentPresetId = activePresetId();

  /* ─── Render ──────────────────────────────────────────────────────────── */
  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-7 w-full max-w-2xl mx-auto">

      {/* Story Prompt */}
      <div className="flex flex-col gap-2.5">
        <label
          htmlFor="prompt"
          className="font-serif italic text-base font-semibold"
          style={{ color: "var(--text-2)" }}
        >
          Your prompt
        </label>
        <textarea
          id="prompt"
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          placeholder="Write a story about a clockmaker who discovers that time is running backwards in her workshop…"
          rows={6}
          maxLength={6000}
          className="input-manuscript"
          style={{ resize: "vertical" }}
          autoFocus
        />
      </div>

      {/* Genre / Style Hint */}
      <div className="flex flex-col gap-2">
        <label
          htmlFor="genreHint"
          className="text-xs uppercase tracking-[0.12em] font-medium flex items-center gap-2"
          style={{ color: "var(--text-3)", fontFamily: "var(--font-sans)" }}
        >
          Genre / Style Hint
          <span
            className="normal-case tracking-normal font-normal"
            style={{ color: "var(--text-3)", opacity: 0.6 }}
          >
            optional
          </span>
        </label>
        <input
          id="genreHint"
          type="text"
          value={genreHint}
          onChange={(e) => setGenreHint(e.target.value)}
          placeholder="e.g. magical realism, noir, literary fiction"
          maxLength={120}
          className="input-field"
        />
      </div>

      {/* Word Count */}
      <div className="flex flex-col gap-2">
        <span
          className="text-xs uppercase tracking-[0.12em] font-medium"
          style={{ color: "var(--text-3)", fontFamily: "var(--font-sans)" }}
        >
          Word Count Range
        </span>
        <div className="flex items-center gap-3">
          <input
            type="number"
            value={minWordsInput}
            onChange={(e) => setMinWordsInput(e.target.value)}
            min={MIN_WORDS_FLOOR}
            max={MIN_WORDS_CEILING}
            className="input-field w-28 text-center"
          />
          <span className="text-sm" style={{ color: "var(--text-3)", fontFamily: "var(--font-sans)" }}>
            to
          </span>
          <input
            type="number"
            value={maxWordsInput}
            onChange={(e) => setMaxWordsInput(e.target.value)}
            min={MIN_WORDS_FLOOR}
            max={MAX_WORDS_CEILING}
            className="input-field w-28 text-center"
          />
          <span className="text-sm" style={{ color: "var(--text-3)", fontFamily: "var(--font-sans)" }}>
            words
          </span>
        </div>
      </div>

      {/* Settings panel */}
      <div className="settings-panel flex flex-col gap-0">

        {/* API Key */}
        <div className="flex flex-col gap-2.5">
          <span
            className="text-xs uppercase tracking-[0.12em] font-medium flex items-center gap-2"
            style={{ color: "var(--text-3)", fontFamily: "var(--font-sans)" }}
          >
            OpenRouter API Key
            <span
              className="normal-case tracking-normal font-normal text-[11px]"
              style={{
                color: hasApiKey ? "var(--success)" : "var(--text-3)",
                opacity: hasApiKey ? 0.9 : 0.6,
              }}
            >
              {hasApiKey ? "saved" : "required"}
            </span>
          </span>
          <div className="flex flex-col sm:flex-row gap-2.5">
            <input
              type="password"
              value={apiKeyInput}
              onChange={(e) => setApiKeyInput(e.target.value)}
              placeholder={hasApiKey ? "Enter a new key to replace the saved one" : "sk-or-v1-…"}
              className="input-field"
              autoComplete="off"
            />
            <button
              type="button"
              onClick={handleSaveKey}
              disabled={isSavingKey}
              className="btn-secondary shrink-0"
            >
              {apiKeyInput.trim() ? "Save Key" : "Clear Key"}
            </button>
          </div>
          {apiKeyMsg && (
            <p
              className="text-sm"
              style={{ color: "var(--text-3)", fontFamily: "var(--font-sans)" }}
            >
              {apiKeyMsg}
            </p>
          )}
        </div>

        {/* Models section */}
        <div className="settings-section flex flex-col gap-3">

          {/* Header row */}
          <div className="flex items-center justify-between gap-3">
            <span
              className="text-xs uppercase tracking-[0.12em] font-medium flex items-center gap-2"
              style={{ color: "var(--text-3)", fontFamily: "var(--font-sans)" }}
            >
              Models
              <span
                className="normal-case tracking-normal font-normal text-[11px]"
                style={{ color: "var(--text-3)", opacity: 0.6 }}
              >
                {configuredModels.length}/{MAX_SELECTED_MODELS} selected
              </span>
            </span>
            <span
              className="text-xs"
              style={{
                fontFamily: "var(--font-sans)",
                color:
                  saveStatus === "saved"
                    ? "var(--success)"
                    : saveStatus === "error"
                    ? "oklch(65% 0.14 22)"
                    : "var(--text-3)",
                opacity: saveStatus === "idle" ? 0 : 0.85,
                transition: "opacity 0.3s",
              }}
            >
              {saveStatus === "saving" && "Saving…"}
              {saveStatus === "saved" && "Saved"}
              {saveStatus === "error" && "Save failed"}
            </span>
          </div>

          {/* Presets */}
          <div className="preset-bar">
            <span
              className="text-[11px] shrink-0"
              style={{ color: "var(--text-3)", fontFamily: "var(--font-sans)", opacity: 0.6 }}
            >
              Presets:
            </span>
            {allPresets.map((preset) => (
              <button
                key={preset.id}
                type="button"
                onClick={() => applyPreset(preset)}
                className={`preset-btn${currentPresetId === preset.id ? " preset-btn--active" : ""}`}
              >
                {preset.name}
                {!preset.builtIn && (
                  <span
                    className="preset-btn__remove"
                    role="button"
                    tabIndex={0}
                    aria-label={`Delete ${preset.name} preset`}
                    onClick={(e) => { e.stopPropagation(); deletePreset(preset.id); }}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.stopPropagation();
                        deletePreset(preset.id);
                      }
                    }}
                  >
                    ✕
                  </span>
                )}
              </button>
            ))}
          </div>

          {/* Selected chips */}
          {configuredModels.length > 0 && (
            <div className="model-chips">
              {configuredModels.map((m) => (
                <span key={m.providerModelId} className="model-chip">
                  <span className="model-chip__name">{m.displayName}</span>
                  <button
                    type="button"
                    className="model-chip__remove"
                    onClick={() => removeModel(m.providerModelId)}
                    aria-label={`Remove ${m.displayName}`}
                  >
                    ✕
                  </button>
                </span>
              ))}
            </div>
          )}

          {/* Search + dropdown */}
          {canAddMore && (
            <div className="model-search-wrap" ref={dropdownWrapRef}>
              <input
                ref={searchRef}
                type="search"
                value={modelSearch}
                onChange={(e) => {
                  setModelSearch(e.target.value);
                  setDropdownOpen(true);
                  setActiveIndex(-1);
                }}
                onFocus={() => setDropdownOpen(true)}
                onKeyDown={handleSearchKey}
                placeholder={
                  configuredModels.length === 0
                    ? "Search to add models…"
                    : "Add another model…"
                }
                className="input-field"
                autoComplete="off"
              />
              {showDropdown && (
                <div className="model-dropdown" role="listbox">
                  {filteredCatalog.length === 0 ? (
                    <div className="model-dropdown__empty">No models found</div>
                  ) : (
                    filteredCatalog.map((m, i) => (
                      <div
                        key={m.providerModelId}
                        role="option"
                        aria-selected={i === activeIndex}
                        className={`model-dropdown__item${i === activeIndex ? " model-dropdown__item--active" : ""}`}
                        onMouseDown={(e) => { e.preventDefault(); addModel(m.providerModelId); }}
                        onMouseEnter={() => setActiveIndex(i)}
                      >
                        <span className="model-dropdown__item-name">{m.displayName}</span>
                        <span className="model-dropdown__item-id">{m.providerModelId}</span>
                      </div>
                    ))
                  )}
                </div>
              )}
            </div>
          )}

          {/* Save as preset */}
          {configuredModels.length >= MIN_SELECTED_MODELS && (
            <div>
              {presetOpen ? (
                <div className="flex items-center gap-2">
                  <input
                    ref={presetInputRef}
                    type="text"
                    value={presetName}
                    onChange={(e) => setPresetName(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") { e.preventDefault(); savePreset(); }
                      else if (e.key === "Escape") { setPresetOpen(false); setPresetName(""); }
                    }}
                    placeholder="Preset name…"
                    maxLength={40}
                    className="input-field"
                    style={{ fontSize: "0.875rem", padding: "0.4375rem 0.75rem" }}
                  />
                  <button
                    type="button"
                    onClick={savePreset}
                    disabled={!presetName.trim()}
                    className="btn-ghost shrink-0"
                  >
                    Save
                  </button>
                  <button
                    type="button"
                    onClick={() => { setPresetOpen(false); setPresetName(""); }}
                    className="btn-ghost shrink-0"
                  >
                    Cancel
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => setPresetOpen(true)}
                  style={{
                    background: "none",
                    border: "none",
                    cursor: "pointer",
                    padding: 0,
                    color: "var(--text-3)",
                    fontFamily: "var(--font-sans)",
                    fontSize: "0.75rem",
                    textDecoration: "underline",
                    textDecorationColor: "var(--border-muted)",
                    textUnderlineOffset: "3px",
                  }}
                >
                  Save current selection as preset
                </button>
              )}
            </div>
          )}

          {/* Validation hints */}
          {availableModels.length < MIN_SELECTED_MODELS && (
            <p
              className="text-sm"
              style={{ color: "oklch(65% 0.14 22)", fontFamily: "var(--font-sans)" }}
            >
              Save at least 2 models to run a tournament.
            </p>
          )}
          {selectedModels.length < MIN_SELECTED_MODELS && selectedModels.length > 0 && (
            <p
              className="text-sm"
              style={{ color: "oklch(65% 0.14 22)", fontFamily: "var(--font-sans)" }}
            >
              {MIN_SELECTED_MODELS - selectedModels.length === 1
                ? "Select 1 more model"
                : `Select ${MIN_SELECTED_MODELS - selectedModels.length} more models`}
            </p>
          )}
        </div>
      </div>

      {/* Submit */}
      <div className="flex flex-col items-center gap-2.5 pt-1">
        <button
          type="submit"
          disabled={!isValid || isLoading}
          className="btn-primary w-full sm:w-auto"
        >
          {isLoading ? (
            <span className="flex items-center gap-2">
              <span className="spinner" />
              Starting…
            </span>
          ) : (
            "Run Tournament"
          )}
        </button>
        <span
          className="text-xs"
          style={{ color: "var(--text-3)", fontFamily: "var(--font-sans)" }}
        >
          ~4–8 minutes for all rounds
        </span>
      </div>
    </form>
  );
}
