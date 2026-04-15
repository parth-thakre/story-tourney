import { spawn } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const npmCommand = process.platform === "win32" ? "npm.cmd" : "npm";
const shellCommand = process.env.PWSH ?? "pwsh.exe";
const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(scriptDir, "..");
const frontendRoot = path.join(repoRoot, "frontend");
const mode = process.argv[2];

if (mode !== "dev" && mode !== "start") {
  console.error("Usage: node scripts/run-stack.mjs <dev|start>");
  process.exit(1);
}

const scriptName = mode === "dev" ? "dev" : "start";
const children = [];
let shuttingDown = false;

function runProcess(name, args, extraEnv = {}, cwd = repoRoot) {
  const command = process.platform === "win32" ? shellCommand : npmCommand;
  const spawnArgs =
    process.platform === "win32"
      ? ["-NoLogo", "-NoProfile", "-Command", toPowerShellCommand([npmCommand, ...args])]
      : args;

  const child = spawn(command, spawnArgs, {
    cwd,
    env: { ...process.env, ...extraEnv },
    stdio: "inherit",
  });

  child.on("exit", (code, signal) => {
    if (shuttingDown) {
      return;
    }

    const reason = signal ? `signal ${signal}` : `code ${code ?? 0}`;
    console.error(`${name} exited with ${reason}`);
    shutdown(typeof code === "number" ? code : 1);
  });

  children.push(child);
  return child;
}

function toPowerShellCommand(args) {
  return `& ${args.map(quoteForPowerShell).join(" ")}`;
}

function quoteForPowerShell(value) {
  return `'${String(value).replaceAll("'", "''")}'`;
}

function shutdown(exitCode = 0) {
  if (shuttingDown) {
    return;
  }

  shuttingDown = true;
  for (const child of children) {
    if (!child.killed) {
      child.kill("SIGTERM");
    }
  }

  setTimeout(() => {
    for (const child of children) {
      if (!child.killed) {
        child.kill("SIGKILL");
      }
    }
  }, 5_000).unref();

  process.exit(exitCode);
}

process.on("SIGINT", () => shutdown(0));
process.on("SIGTERM", () => shutdown(0));

runProcess("backend", ["run", `${scriptName}:backend`], {
  HOST: process.env.HOST ?? "127.0.0.1",
  PORT: process.env.PORT ?? "9966",
});

runProcess(
  "frontend",
  ["run", scriptName],
  {
    API_PROXY_URL: process.env.API_PROXY_URL ?? "http://127.0.0.1:9966",
  },
  frontendRoot,
);
