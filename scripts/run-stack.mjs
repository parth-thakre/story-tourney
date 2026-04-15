import { spawn, spawnSync } from "node:child_process";
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
let requestedExitCode = 0;
const savedTerminalState = captureTerminalState();
let terminalRestored = false;

function runProcess(name, args, extraEnv = {}, cwd = repoRoot) {
  const command = process.platform === "win32" ? shellCommand : npmCommand;
  const spawnArgs =
    process.platform === "win32"
      ? ["-NoLogo", "-NoProfile", "-Command", toPowerShellCommand([npmCommand, ...args])]
      : args;

  const child = spawn(command, spawnArgs, {
    cwd,
    env: { ...process.env, ...extraEnv },
    stdio: ["ignore", "inherit", "inherit"],
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
  requestedExitCode = exitCode;
  let remainingChildren = children.filter((child) => child.exitCode === null && child.signalCode === null).length;

  if (remainingChildren === 0) {
    restoreTerminalState();
    process.exit(requestedExitCode);
  }

  const maybeExit = () => {
    remainingChildren -= 1;
    if (remainingChildren <= 0) {
      restoreTerminalState();
      process.exit(requestedExitCode);
    }
  };

  for (const child of children) {
    if (child.exitCode === null && child.signalCode === null) {
      child.once("exit", maybeExit);
    }

    if (!child.killed && child.exitCode === null && child.signalCode === null) {
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
}

function captureTerminalState() {
  if (process.platform === "win32" || !process.stdin.isTTY) {
    return null;
  }

  const result = spawnSync("stty", ["-g"], {
    stdio: ["inherit", "pipe", "ignore"],
    encoding: "utf8",
  });

  if (result.error || result.status !== 0) {
    return null;
  }

  return result.stdout.trim() || null;
}

function restoreTerminalState() {
  if (terminalRestored || process.platform === "win32" || !process.stdin.isTTY) {
    return;
  }

  terminalRestored = true;

  if (savedTerminalState) {
    const result = spawnSync("stty", [savedTerminalState], { stdio: "inherit" });
    if (!result.error && result.status === 0) {
      return;
    }
  }

  spawnSync("stty", ["sane"], { stdio: "inherit" });
}

process.on("SIGINT", () => shutdown(0));
process.on("SIGTERM", () => shutdown(0));
process.on("exit", restoreTerminalState);

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
