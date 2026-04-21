import test from "node:test";
import assert from "node:assert/strict";

import {
  buildRouterEditorUrl,
  formatRouterLogLine,
  parseRouterIpOutput,
  shouldEnableRouterLink,
} from "./router-dev-link-utils.mjs";

test("shouldEnableRouterLink supports explicit opt-in values", () => {
  assert.equal(shouldEnableRouterLink({ VISIONARY_ROUTER_LINK: "1" }), true);
  assert.equal(shouldEnableRouterLink({ VISIONARY_ROUTER_LINK: "true" }), true);
  assert.equal(shouldEnableRouterLink({ VISIONARY_ROUTER_LINK: "0" }), false);
  assert.equal(shouldEnableRouterLink({ VISIONARY_ROUTER_LINK: "" }), false);
});

test("parseRouterIpOutput accepts a plain IPv4 result", () => {
  assert.deepEqual(parseRouterIpOutput("219.242.244.211"), {
    ok: true,
    ip: "219.242.244.211",
  });
});

test("parseRouterIpOutput converts state errors into unavailable reasons", () => {
  assert.deepEqual(parseRouterIpOutput("STATE_ERROR: TimeoutError"), {
    ok: false,
    reason: "TimeoutError",
  });
});

test("buildRouterEditorUrl points to editor.html", () => {
  assert.equal(
    buildRouterEditorUrl({
      host: "219.242.244.211",
      port: "3000",
      protocol: "https",
    }),
    "https://219.242.244.211:3000/editor.html"
  );
});

test("formatRouterLogLine matches the Vite URL block style", () => {
  assert.equal(
    formatRouterLogLine("https://219.242.244.211:3000/editor.html"),
    "  ➜  Router:   https://219.242.244.211:3000/editor.html"
  );
});
