import { commandExists } from "./dev-https-utils.mjs";

export function shouldEnableRouterLink(env = process.env) {
  const value = env.VISIONARY_ROUTER_LINK?.trim().toLowerCase();
  return value === "1" || value === "true";
}

export function resolvePythonCommand() {
  if (commandExists("python")) {
    return "python";
  }
  if (commandExists("python3")) {
    return "python3";
  }
  return null;
}

export function parseRouterIpOutput(output) {
  const trimmed = output.trim();
  if (!trimmed) {
    return { ok: false, reason: "empty output" };
  }
  if (trimmed.startsWith("STATE_ERROR:")) {
    const reason = trimmed.slice("STATE_ERROR:".length).trim() || "unknown error";
    return { ok: false, reason };
  }
  return { ok: true, ip: trimmed };
}

export function buildRouterEditorUrl({ host, port, protocol }) {
  return `${protocol}://${host}:${port}/editor.html`;
}

export function formatRouterLogLine(message) {
  return `  ➜  Router:   ${message}`;
}
