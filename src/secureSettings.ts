import crypto from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { z } from "zod";

const APP_ROOT = path.resolve(__dirname, "..");
const DATA_DIR = path.join(APP_ROOT, "data");
const KEY_PATH = path.join(DATA_DIR, ".story-tourney-settings.key");
const SETTINGS_PATH = path.join(DATA_DIR, "settings.enc.json");

const settingsSchema = z.object({
  openrouterApiKey: z.string().trim().min(1).nullable().default(null),
  models: z
    .array(
      z.object({
        modelKey: z.string().trim().min(1),
        displayName: z.string().trim().min(1),
        modelId: z.string().trim().min(1).optional(),
        providerModelId: z.string().trim().min(1),
        providerOrder: z.array(z.string().trim().min(1)).default([]),
      })
    )
    .default([]),
});

export type SecureSettings = z.infer<typeof settingsSchema>;
export type StoredModelDefinition = SecureSettings["models"][number];

interface EncryptedPayload {
  version: 1;
  algorithm: "aes-256-gcm";
  iv: string;
  tag: string;
  ciphertext: string;
}

const DEFAULT_SETTINGS: SecureSettings = {
  openrouterApiKey: null,
  models: [],
};

export function getSecureSettings(): SecureSettings {
  if (!fs.existsSync(SETTINGS_PATH)) {
    return DEFAULT_SETTINGS;
  }

  const key = getOrCreateEncryptionKey();
  const payload = JSON.parse(fs.readFileSync(SETTINGS_PATH, "utf8")) as EncryptedPayload;
  const decipher = crypto.createDecipheriv("aes-256-gcm", key, Buffer.from(payload.iv, "base64"));
  decipher.setAuthTag(Buffer.from(payload.tag, "base64"));
  const plaintext = Buffer.concat([
    decipher.update(Buffer.from(payload.ciphertext, "base64")),
    decipher.final(),
  ]).toString("utf8");

  return settingsSchema.parse(JSON.parse(plaintext));
}

export function updateSecureSettings(updater: (settings: SecureSettings) => SecureSettings): SecureSettings {
  const next = settingsSchema.parse(updater(getSecureSettings()));
  writeSecureSettings(next);
  return next;
}

export function getOpenRouterApiKey() {
  return getSecureSettings().openrouterApiKey;
}

function writeSecureSettings(settings: SecureSettings) {
  ensureDataDir();
  const key = getOrCreateEncryptionKey();
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);
  const ciphertext = Buffer.concat([cipher.update(JSON.stringify(settings), "utf8"), cipher.final()]);
  const payload: EncryptedPayload = {
    version: 1,
    algorithm: "aes-256-gcm",
    iv: iv.toString("base64"),
    tag: cipher.getAuthTag().toString("base64"),
    ciphertext: ciphertext.toString("base64"),
  };
  fs.writeFileSync(SETTINGS_PATH, `${JSON.stringify(payload, null, 2)}\n`, { mode: 0o600 });
}

function getOrCreateEncryptionKey() {
  ensureDataDir();
  if (fs.existsSync(KEY_PATH)) {
    return Buffer.from(fs.readFileSync(KEY_PATH, "utf8").trim(), "base64");
  }

  const key = crypto.randomBytes(32);
  fs.writeFileSync(KEY_PATH, `${key.toString("base64")}\n`, { mode: 0o600 });
  if (os.platform() !== "win32") {
    fs.chmodSync(KEY_PATH, 0o600);
  }
  return key;
}

function ensureDataDir() {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}
