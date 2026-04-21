import fs from "node:fs";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

import {
  ensureCertDirectory,
  findMkcertCommand,
  getCertDefaults,
  getRepoRoot,
  getSuggestedHosts,
  printMkcertInstallHint,
  writeEnvLocalIfMissing,
} from "./dev-https-utils.mjs";

const rootDir = getRepoRoot(fileURLToPath(import.meta.url));
const mkcert = findMkcertCommand();

if (!mkcert) {
  printMkcertInstallHint();
  process.exit(1);
}

const defaults = ensureCertDirectory(rootDir);
const hosts = getSuggestedHosts();

console.log("Visionary HTTPS dev: generating local certificate for:");
hosts.forEach((host) => console.log(`  - ${host}`));

const installResult = spawnSync(mkcert, ["-install"], {
  stdio: "inherit",
  shell: false,
});
if (installResult.status !== 0) {
  process.exit(installResult.status ?? 1);
}

const certResult = spawnSync(
  mkcert,
  [
    "-key-file",
    defaults.keyFile,
    "-cert-file",
    defaults.certFile,
    ...hosts,
  ],
  {
    stdio: "inherit",
    shell: false,
  }
);
if (certResult.status !== 0) {
  process.exit(certResult.status ?? 1);
}

const wroteEnv = writeEnvLocalIfMissing(rootDir);
const envFile = getCertDefaults(rootDir).envFile;

if (wroteEnv) {
  console.log(`Created ${envFile}`);
} else {
  console.log(`${envFile} already exists; kept current contents.`);
}

if (!fs.existsSync(defaults.certFile) || !fs.existsSync(defaults.keyFile)) {
  console.error("Visionary HTTPS dev: certificate generation did not produce the expected files.");
  process.exit(1);
}

console.log("Visionary HTTPS dev setup complete.");
console.log("Next steps:");
console.log("  1. Restart: npm run dev");
console.log("  2. Open locally with: https://localhost:3000/");
console.log("  3. Open from LAN with: https://<your-lan-ip>:3000/");
console.log("  4. Trust the mkcert root CA on every client device that needs remote WebGPU access.");
