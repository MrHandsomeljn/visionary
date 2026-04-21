import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";

export function isWindows() {
  return process.platform === "win32";
}

export function commandExists(command) {
  const probe = isWindows() ? "where" : "which";
  const result = spawnSync(probe, [command], { stdio: "ignore", shell: false });
  return result.status === 0;
}

export function findMkcertCommand() {
  return commandExists("mkcert") ? "mkcert" : null;
}

export function getRepoRoot(currentFilePath) {
  return path.resolve(path.dirname(currentFilePath), "..");
}

export function getCertDefaults(rootDir) {
  return {
    certDir: path.join(rootDir, "certs"),
    certFile: path.join(rootDir, "certs", "dev-server-cert.pem"),
    keyFile: path.join(rootDir, "certs", "dev-server-key.pem"),
    envFile: path.join(rootDir, ".env.local"),
  };
}

export function getSuggestedHosts() {
  const hosts = new Set(["localhost", "127.0.0.1", "::1"]);
  const hostname = os.hostname()?.trim();
  if (hostname) {
    hosts.add(hostname);
  }

  const nets = os.networkInterfaces();
  Object.values(nets).forEach((group) => {
    (group || []).forEach((entry) => {
      if (!entry || entry.internal) return;
      if (entry.family === "IPv4" || entry.family === 4) {
        hosts.add(entry.address);
      }
    });
  });
  return Array.from(hosts);
}

export function buildEnvLocalContent(rootDir) {
  const defaults = getCertDefaults(rootDir);
  const toRelative = (target) => path.relative(rootDir, target).replace(/\\/g, "/");
  return [
    "VISIONARY_DEV_HTTPS=1",
    `VISIONARY_DEV_CERT_FILE=${toRelative(defaults.certFile)}`,
    `VISIONARY_DEV_KEY_FILE=${toRelative(defaults.keyFile)}`,
    "",
  ].join("\n");
}

export function writeEnvLocalIfMissing(rootDir) {
  const defaults = getCertDefaults(rootDir);
  if (fs.existsSync(defaults.envFile)) {
    return false;
  }
  fs.writeFileSync(defaults.envFile, buildEnvLocalContent(rootDir), "utf8");
  return true;
}

export function ensureCertDirectory(rootDir) {
  const defaults = getCertDefaults(rootDir);
  fs.mkdirSync(defaults.certDir, { recursive: true });
  return defaults;
}

export function printMkcertInstallHint() {
  if (isWindows()) {
    console.log("Visionary HTTPS dev: mkcert not found.");
    console.log("Windows recommendation:");
    console.log("  winget install FiloSottile.mkcert");
    console.log("Then run:");
    console.log("  npm run dev:https:setup");
    return;
  }
  console.log("Visionary HTTPS dev: mkcert not found.");
  console.log("Install mkcert first, then run:");
  console.log("  npm run dev:https:setup");
}

export function printPostinstallNextSteps(options = {}) {
  const { httpsReady = false } = options;
  console.log("");
  console.log("Visionary next steps:");
  console.log("  1. Local development:");
  console.log("     npm run dev");
  console.log("     Open: http://localhost:3000/");
  console.log("  2. LAN access without WebGPU guarantees:");
  console.log("     Open: http://<your-lan-ip>:3000/");
  if (httpsReady) {
    console.log("  3. LAN access with WebGPU/editor support:");
    console.log("     Open: https://<your-lan-ip>:3000/");
    console.log("  4. Every client device must trust the mkcert root CA.");
  } else {
    console.log("  3. LAN access with WebGPU/editor support:");
    if (isWindows()) {
      console.log("     winget install FiloSottile.mkcert");
    } else {
      console.log("     Install mkcert first");
    }
    console.log("     npm run dev:https:setup");
    console.log("  4. Every client device must trust the mkcert root CA.");
  }
}
