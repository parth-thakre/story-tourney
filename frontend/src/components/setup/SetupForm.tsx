"use client";

import { useState, useEffect } from "react";
import { type ModelKey, type ModelRegistryEntry } from "@/types";
import { getModels } from "@/lib/api";

const MIN_WORDS_DEFAULT = 800;
const MAX_WORDS_DEFAULT = 1200;
const MIN_WORDS_FLOOR = 100;
const MIN_WORDS_CEILING = 5000;
const MAX_WORDS_CEILING = 10000;
const MIN_SELECTED_MODELS = 2;
const MAX_SELECTED_MODELS = 4;

function parseWordCountInput(value: string) {
  if (value === "") {
    return null;
  }

  const parsed = Number.parseInt(value, 10);
  return Number.isNaN(parsed) ? null : parsed;
}

interface ModelChipProps {
  label: string;
  selected: boolean;
  onToggle: () => void;
}

function ModelChip({ label, selected, onToggle }: ModelChipProps) {
  return (
    <button
      type="button"
      onClick={onToggle}
      className={`model-chip ${selected ? "model-chip--selected" : "model-chip--unselected"}`}
    >
      {label}
    </button>
  );
}

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

export default function SetupForm({ onSubmit, isLoading }: SetupFormProps) {
  const [prompt, setPrompt] = useState("");
  const [genreHint, setGenreHint] = useState("");
  const [minWordsInput, setMinWordsInput] = useState(String(MIN_WORDS_DEFAULT));
  const [maxWordsInput, setMaxWordsInput] = useState(String(MAX_WORDS_DEFAULT));
  const [selectedModels, setSelectedModels] = useState<ModelKey[]>([]);
  const [availableModels, setAvailableModels] = useState<ModelRegistryEntry[]>([]);

  const minWords = parseWordCountInput(minWordsInput);
  const maxWords = parseWordCountInput(maxWordsInput);
  const hasValidWordCounts =
    minWords !== null &&
    maxWords !== null &&
    minWords >= MIN_WORDS_FLOOR &&
    minWords <= MIN_WORDS_CEILING &&
    maxWords >= MIN_WORDS_FLOOR &&
    maxWords <= MAX_WORDS_CEILING &&
    minWords <= maxWords;

  useEffect(() => {
    getModels()
      .then((models) => {
        setAvailableModels(models);
        setSelectedModels((current) => {
          const validCurrent = current.filter((modelKey) => models.some((model) => model.modelKey === modelKey));
          return validCurrent.length > 0 ? validCurrent : models.slice(0, MAX_SELECTED_MODELS).map((model) => model.modelKey);
        });
      })
      .catch(() => {});
  }, []);

  function toggleModel(model: ModelKey) {
    setSelectedModels((prev) => {
      if (prev.includes(model)) {
        return prev.filter((m) => m !== model);
      }

      if (prev.length >= MAX_SELECTED_MODELS) {
        return prev;
      }

      return [...prev, model];
    });
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!prompt.trim() || selectedModels.length < MIN_SELECTED_MODELS || selectedModels.length > MAX_SELECTED_MODELS || !hasValidWordCounts) return;
    onSubmit({
      prompt: prompt.trim(),
      genreHint: genreHint.trim(),
      minWords: minWords!,
      maxWords: maxWords!,
      selectedModels,
    });
  }

  const isValid = prompt.trim().length > 0 && selectedModels.length >= MIN_SELECTED_MODELS && selectedModels.length <= MAX_SELECTED_MODELS && hasValidWordCounts;

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-8 w-full max-w-2xl mx-auto">
      <div className="flex flex-col gap-2">
        <label htmlFor="prompt" className="text-sm text-zinc-400 uppercase tracking-widest font-sans">
          Story Prompt
        </label>
        <textarea
          id="prompt"
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          placeholder="Write a story about a clockmaker who discovers that time is running backwards in her workshop..."
          rows={5}
          maxLength={6000}
          className="input-field"
          autoFocus
        />
      </div>

      <div className="flex flex-col gap-2">
        <label htmlFor="genreHint" className="text-sm text-zinc-400 uppercase tracking-widest font-sans">
          Genre / Style Hint
          <span className="text-zinc-500 normal-case tracking-normal ml-2">optional</span>
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

      <div className="flex flex-col gap-2">
        <span className="text-sm text-zinc-400 uppercase tracking-widest font-sans">
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
          <span className="text-zinc-500 font-sans">to</span>
          <input
            type="number"
            value={maxWordsInput}
            onChange={(e) => setMaxWordsInput(e.target.value)}
            min={MIN_WORDS_FLOOR}
            max={MAX_WORDS_CEILING}
            className="input-field w-28 text-center"
          />
          <span className="text-zinc-500 text-sm font-sans ml-2">words</span>
        </div>
      </div>

      <div className="flex flex-col gap-3">
        <span className="text-sm text-zinc-400 uppercase tracking-widest font-sans">
          Models
          <span className="text-zinc-500 normal-case tracking-normal ml-2">select 2 to 4</span>
        </span>
        <div className="flex flex-wrap gap-3">
          {availableModels.map((model) => (
            <ModelChip
              key={model.modelKey}
              label={model.displayName}
              selected={selectedModels.includes(model.modelKey)}
              onToggle={() => toggleModel(model.modelKey)}
            />
          ))}
        </div>
        {availableModels.length < MIN_SELECTED_MODELS && (
          <p className="text-red-400 text-sm font-sans">
            Configure at least 2 models on the backend to run a tournament.
          </p>
        )}
        {(selectedModels.length < MIN_SELECTED_MODELS || selectedModels.length > MAX_SELECTED_MODELS) && (
          <p className="text-red-400 text-sm font-sans">
            {selectedModels.length < MIN_SELECTED_MODELS
              ? `Select ${MIN_SELECTED_MODELS - selectedModels.length} more model${MIN_SELECTED_MODELS - selectedModels.length > 1 ? "s" : ""}`
              : "Too many models selected — at most 4 allowed"}
          </p>
        )}
      </div>

      <div className="flex flex-col items-center gap-3 pt-2">
        <button
          type="submit"
          disabled={!isValid || isLoading}
          className="btn-primary w-full sm:w-auto"
        >
          {isLoading ? (
            <span className="flex items-center gap-2">
              <span className="spinner" />
              Starting...
            </span>
          ) : (
            "Run Tournament"
          )}
        </button>
        <span className="text-zinc-500 text-xs font-sans">
          ~4–8 minutes for all rounds
        </span>
      </div>
    </form>
  );
}
