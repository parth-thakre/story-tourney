import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { config as loadEnv } from "dotenv";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(scriptDir, "..");
const composeFile = path.join(repoRoot, "docker-compose.yml");
const envFile = path.join(repoRoot, ".env");

loadEnv({ path: envFile, quiet: true });

ensureCommand("docker", ["compose", "version"], "docker compose is required");

const env = {
  ...process.env,
  FRONTEND_BIND_IP: process.env.FRONTEND_BIND_IP ?? "127.0.0.1",
};

console.log("Starting Story Tourney");
console.log(`Frontend bind: ${env.FRONTEND_BIND_IP}:9965`);

const upResult = spawnSync(
  "docker",
  ["compose", "-f", composeFile, "up", "-d", "--build", "--wait"],
  {
    cwd: repoRoot,
    env,
    stdio: "inherit",
  },
);

if (upResult.error) {
  throw upResult.error;
}

if (upResult.status !== 0) {
  process.exit(upResult.status ?? 1);
}

console.log(`\nLocal URL: http://${env.FRONTEND_BIND_IP}:9965`);

function ensureCommand(command, args, message) {
  const result = spawnSync(command, args, { stdio: "ignore" });

  if (result.error && result.error.code === "ENOENT") {
    console.error(message);
    process.exit(1);
  }

  if (result.error) {
    throw result.error;
  }

  if (result.status !== 0) {
    console.error(message);
    process.exit(result.status ?? 1);
  }
}
