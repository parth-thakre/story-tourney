import { spawn } from "node:child_process";

const npmCommand = process.platform === "win32" ? "npm.cmd" : "npm";
const mode = process.argv[2];

if (mode !== "dev" && mode !== "start") {
  console.error("Usage: node scripts/run-stack.mjs <dev|start>");
  process.exit(1);
}

const scriptName = mode === "dev" ? "dev" : "start";
const children = [];
let shuttingDown = false;

function runProcess(name, args, extraEnv = {}) {
  const child = spawn(npmCommand, args, {
    cwd: process.cwd(),
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

runProcess("frontend", ["--prefix", "frontend", "run", scriptName], {
  API_PROXY_URL: process.env.API_PROXY_URL ?? "http://127.0.0.1:9966",
});
