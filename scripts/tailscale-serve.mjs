import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { config as loadEnv } from "dotenv";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(scriptDir, "..");

loadEnv({ path: path.join(repoRoot, ".env"), quiet: true });

const appPort = process.env.APP_PORT ?? "9965";
const localTarget = process.env.LOCAL_TARGET ?? `http://127.0.0.1:${appPort}`;
const servePort = process.env.TAILSCALE_SERVE_PORT ?? "80";

ensureCommand("tailscale", ["status", "--json"], "tailscale is required");

const statusResult = spawnSync("tailscale", ["status", "--json"], {
  encoding: "utf8",
  stdio: ["ignore", "pipe", "inherit"],
});

if (statusResult.error) {
  throw statusResult.error;
}

if (statusResult.status !== 0) {
  process.exit(statusResult.status ?? 1);
}

const status = JSON.parse(statusResult.stdout);
const suffix = status.CurrentTailnet?.MagicDNSSuffix ?? "";
const hostname = status.Self?.HostName ?? "";
const dnsName = (status.Self?.DNSName ?? "").replace(/\.$/, "");
const ipv4 = [
  ...(status.Self?.TailscaleIPs ?? []),
  ...(status.TailscaleIPs ?? []),
].find((ip) => /^\d+\.\d+\.\d+\.\d+$/.test(ip)) ?? "";

if (!hostname && !dnsName && !ipv4) {
  console.error("could not determine this node's Tailscale address");
  process.exit(1);
}

console.log(`Publishing ${localTarget} over Tailscale Serve`);

const serveResult = spawnSync(
  "tailscale",
  ["serve", `--http=${servePort}`, "--bg", "--yes", localTarget],
  { stdio: "inherit" },
);

if (serveResult.error) {
  throw serveResult.error;
}

if (serveResult.status !== 0) {
  if (process.platform === "win32") {
    console.error("If Tailscale requires elevation on this machine, rerun the terminal as Administrator.");
  } else {
    console.error("If Tailscale requires elevated access on this machine, rerun the command with the required privileges.");
  }
  process.exit(serveResult.status ?? 1);
}

console.log("\nReach it from trusted tailnet devices using one of:");

if (dnsName) {
  console.log(`  ${formatHttpUrl(dnsName, servePort)}`);
}

if (hostname && suffix) {
  console.log(`  ${formatHttpUrl(`${hostname}.${suffix}`, servePort)}`);
}

if (ipv4) {
  console.log(`  ${formatHttpUrl(ipv4, servePort)}`);
}

console.log("\nCurrent serve config:");

const serveStatusResult = spawnSync("tailscale", ["serve", "status"], { stdio: "inherit" });

if (serveStatusResult.error) {
  throw serveStatusResult.error;
}

if (serveStatusResult.status !== 0) {
  process.exit(serveStatusResult.status ?? 1);
}

function formatHttpUrl(host, port) {
  return port === "80" ? `http://${host}` : `http://${host}:${port}`;
}

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
