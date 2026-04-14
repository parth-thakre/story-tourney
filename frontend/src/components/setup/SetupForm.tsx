"use client";

import { useState, useEffect } from "react";
import { ALL_MODELS, MODEL_DISPLAY, type ModelKey } from "@/types";
import { getModels } from "@/lib/api";

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
    selectedModels: [ModelKey, ModelKey, ModelKey, ModelKey];
  }) => void;
  isLoading: boolean;
}

export default function SetupForm({ onSubmit, isLoading }: SetupFormProps) {
  const [prompt, setPrompt] = useState("");
  const [genreHint, setGenreHint] = useState("");
  const [minWords, setMinWords] = useState(800);
  const [maxWords, setMaxWords] = useState(1200);
  const [selectedModels, setSelectedModels] = useState<ModelKey[]>([...ALL_MODELS]);
  const [availableModels, setAvailableModels] = useState<ModelKey[]>([...ALL_MODELS]);

  useEffect(() => {
    getModels()
      .then((models) => {
        setAvailableModels(models.map((m) => m.modelKey));
      })
      .catch(() => {});
  }, []);

  function toggleModel(model: ModelKey) {
    setSelectedModels((prev) =>
      prev.includes(model) ? prev.filter((m) => m !== model) : [...prev, model]
    );
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!prompt.trim() || selectedModels.length !== 4) return;
    onSubmit({
      prompt: prompt.trim(),
      genreHint: genreHint.trim(),
      minWords,
      maxWords,
      selectedModels: [selectedModels[0], selectedModels[1], selectedModels[2], selectedModels[3]],
    });
  }

  const isValid = prompt.trim().length > 0 && selectedModels.length === 4;

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
            value={minWords}
            onChange={(e) => setMinWords(Number(e.target.value))}
            min={100}
            max={5000}
            className="input-field w-28 text-center"
          />
          <span className="text-zinc-500 font-sans">to</span>
          <input
            type="number"
            value={maxWords}
            onChange={(e) => setMaxWords(Number(e.target.value))}
            min={100}
            max={10000}
            className="input-field w-28 text-center"
          />
          <span className="text-zinc-500 text-sm font-sans ml-2">words</span>
        </div>
      </div>

      <div className="flex flex-col gap-3">
        <span className="text-sm text-zinc-400 uppercase tracking-widest font-sans">
          Models
          <span className="text-zinc-500 normal-case tracking-normal ml-2">select exactly 4</span>
        </span>
        <div className="flex flex-wrap gap-3">
          {availableModels.map((modelKey) => (
            <ModelChip
              key={modelKey}
              label={MODEL_DISPLAY[modelKey]}
              selected={selectedModels.includes(modelKey)}
              onToggle={() => toggleModel(modelKey)}
            />
          ))}
        </div>
        {selectedModels.length !== 4 && (
          <p className="text-red-400 text-sm font-sans">
            {selectedModels.length < 4
              ? `Select ${4 - selectedModels.length} more model${4 - selectedModels.length > 1 ? "s" : ""}`
              : "Too many models selected — exactly 4 required"}
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
