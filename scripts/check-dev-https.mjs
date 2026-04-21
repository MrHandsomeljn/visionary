import fs from "node:fs";
import { fileURLToPath } from "node:url";

import {
  findMkcertCommand,
  getCertDefaults,
  getRepoRoot,
  printMkcertInstallHint,
  printPostinstallNextSteps,
} from "./dev-https-utils.mjs";

const rootDir = getRepoRoot(fileURLToPath(import.meta.url));
const defaults = getCertDefaults(rootDir);
const mkcert = findMkcertCommand();
const certReady = fs.existsSync(defaults.certFile) && fs.existsSync(defaults.keyFile);

if (mkcert && certReady) {
  console.log("Visionary HTTPS dev: mkcert detected and local cert files are present.");
  printPostinstallNextSteps({ httpsReady: true });
  process.exit(0);
}

console.log("Visionary HTTPS dev: optional LAN/WebGPU setup is not ready yet.");
if (!mkcert) {
  printMkcertInstallHint();
} else {
  console.log("mkcert is installed, but local dev cert files are missing.");
  console.log("Run:");
  console.log("  npm run dev:https:setup");
}
printPostinstallNextSteps({ httpsReady: false });
