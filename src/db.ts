import fs from "node:fs";
import path from "node:path";
import Database from "better-sqlite3";
import { DB_PATH } from "./config";

const dir = path.dirname(DB_PATH);
if (!fs.existsSync(dir)) {
  fs.mkdirSync(dir, { recursive: true });
}

export const db = new Database(DB_PATH);
db.pragma("journal_mode = WAL");
db.pragma("foreign_keys = ON");

db.exec(`
CREATE TABLE IF NOT EXISTS tournaments (
  id TEXT PRIMARY KEY,
  prompt TEXT NOT NULL,
  genre_hint TEXT,
  min_words INTEGER NOT NULL,
  max_words INTEGER NOT NULL,
  status TEXT NOT NULL,
  created_at TEXT NOT NULL,
  completed_at TEXT
);

CREATE TABLE IF NOT EXISTS tournament_models (
  id TEXT PRIMARY KEY,
  tournament_id TEXT NOT NULL REFERENCES tournaments(id) ON DELETE CASCADE,
  model_key TEXT NOT NULL,
  provider_model_id TEXT NOT NULL,
  display_name TEXT NOT NULL,
  UNIQUE(tournament_id, model_key)
);

CREATE TABLE IF NOT EXISTS story_versions (
  id TEXT PRIMARY KEY,
  tournament_id TEXT NOT NULL REFERENCES tournaments(id) ON DELETE CASCADE,
  model_key TEXT NOT NULL,
  round TEXT NOT NULL,
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  word_count INTEGER NOT NULL,
  change_summary TEXT,
  created_at TEXT NOT NULL,
  UNIQUE(tournament_id, model_key, round)
);

CREATE TABLE IF NOT EXISTS reviews (
  id TEXT PRIMARY KEY,
  tournament_id TEXT NOT NULL REFERENCES tournaments(id) ON DELETE CASCADE,
  reviewer_model_key TEXT NOT NULL,
  target_story_version_id TEXT NOT NULL,
  anonymized_label TEXT NOT NULL,
  prompt_fit INTEGER NOT NULL,
  originality INTEGER NOT NULL,
  coherence INTEGER NOT NULL,
  prose INTEGER NOT NULL,
  emotional_impact INTEGER NOT NULL,
  strengths_json TEXT NOT NULL,
  weaknesses_json TEXT NOT NULL,
  revision_suggestion TEXT NOT NULL,
  overall_comment TEXT NOT NULL,
  created_at TEXT NOT NULL,
  UNIQUE(tournament_id, reviewer_model_key, target_story_version_id)
);

CREATE TABLE IF NOT EXISTS final_rankings (
  id TEXT PRIMARY KEY,
  tournament_id TEXT NOT NULL REFERENCES tournaments(id) ON DELETE CASCADE,
  reviewer_model_key TEXT NOT NULL,
  ranked_story_version_id TEXT NOT NULL,
  rank INTEGER NOT NULL,
  justification TEXT NOT NULL,
  created_at TEXT NOT NULL,
  UNIQUE(tournament_id, reviewer_model_key, ranked_story_version_id)
);

CREATE TABLE IF NOT EXISTS provider_calls (
  id TEXT PRIMARY KEY,
  tournament_id TEXT NOT NULL REFERENCES tournaments(id) ON DELETE CASCADE,
  phase TEXT NOT NULL,
  model_key TEXT NOT NULL,
  status TEXT NOT NULL,
  attempt INTEGER NOT NULL,
  request_json TEXT NOT NULL,
  response_json TEXT,
  context_json TEXT NOT NULL,
  error TEXT,
  created_at TEXT NOT NULL,
  completed_at TEXT
);

CREATE INDEX IF NOT EXISTS idx_provider_calls_tournament_phase_model ON provider_calls(tournament_id, phase, model_key);
CREATE INDEX IF NOT EXISTS idx_story_versions_tournament_round ON story_versions(tournament_id, round);
CREATE INDEX IF NOT EXISTS idx_reviews_tournament_target ON reviews(tournament_id, target_story_version_id);
CREATE INDEX IF NOT EXISTS idx_final_rankings_tournament_story ON final_rankings(tournament_id, ranked_story_version_id);

CREATE TABLE IF NOT EXISTS tournament_results (
  tournament_id TEXT NOT NULL REFERENCES tournaments(id) ON DELETE CASCADE,
  story_version_id TEXT NOT NULL REFERENCES story_versions(id) ON DELETE CASCADE,
  final_rank INTEGER NOT NULL,
  borda_points INTEGER NOT NULL,
  first_place_votes INTEGER NOT NULL,
  PRIMARY KEY (tournament_id, story_version_id)
);
`);
