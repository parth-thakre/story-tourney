const chunks = [];

for await (const chunk of process.stdin) {
  chunks.push(chunk);
}

const input = chunks.join("");
const status = JSON.parse(input);
const suffix = status.CurrentTailnet?.MagicDNSSuffix ?? "";
const hostname = status.Self?.HostName ?? "";
const dnsName = (status.Self?.DNSName ?? "").replace(/\.$/, "");
const ipv4 = (status.TailscaleIPs ?? []).find((ip) => /^\d+\.\d+\.\d+\.\d+$/.test(ip)) ?? "";

process.stdout.write([suffix, hostname, dnsName, ipv4].join("\n"));
