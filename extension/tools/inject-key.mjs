// Push $GEMINI_API_KEY (or an alt var) into the running browser's
// chrome.storage.local so the extension's Gemini fallback lights up.
// The key never touches disk in this repo.
//
// Usage:
//   GEMINI_API_KEY=... node extension/tools/inject-key.mjs [port]

const args = process.argv.slice(2);
const fileArg = args.find((a) => a.startsWith("--key-file="));
const PORT = args.find((a) => /^\d+$/.test(a)) || "9222";
const KEY_VARS = ["GEMINI_API_KEY", "GOOGLE_GEMINI_API_KEY", "GOOGLE_AI_API_KEY", "AISTUDIO_API_KEY", "GOOGLE_API_KEY"];
let key = "";
if (fileArg) {
  const { readFileSync } = await import("node:fs");
  key = readFileSync(fileArg.slice("--key-file=".length), "utf8").trim();
}
if (!key) for (const v of KEY_VARS) if (process.env[v]) { key = process.env[v]; break; }
if (!key) {
  console.error(`no key found (--key-file=... or env vars: ${KEY_VARS.join(", ")})`);
  process.exit(2);
}
const model = process.env.GEMINI_MODEL || "gemini-2.5-flash";

const tabs = await (await fetch(`http://localhost:${PORT}/json`)).json();
// Prefer the options page (has chrome.storage in the same extension origin),
// else use any screener.in tab (content script also has chrome.storage).
const tab = tabs.find((t) => t.url && t.url.includes("chrome-extension://") && t.url.includes("options"))
         || tabs.find((t) => t.url && t.url.includes("screener.in") && t.webSocketDebuggerUrl)
         || tabs.find((t) => t.webSocketDebuggerUrl);
if (!tab) { console.error("no debuggable tab"); process.exit(3); }

const ws = new WebSocket(tab.webSocketDebuggerUrl);
await new Promise((res, rej) => { ws.addEventListener("open", res); ws.addEventListener("error", rej); });
let mid = 0;
const pending = new Map();
ws.addEventListener("message", (ev) => {
  const msg = JSON.parse(ev.data);
  if (msg.id && pending.has(msg.id)) {
    const p = pending.get(msg.id); pending.delete(msg.id);
    msg.error ? p.reject(new Error(msg.error.message)) : p.resolve(msg.result);
  }
});
function cdp(method, params = {}) {
  const id = ++mid;
  return new Promise((resolve, reject) => {
    pending.set(id, { resolve, reject });
    ws.send(JSON.stringify({ id, method, params }));
  });
}

await cdp("Runtime.enable");

// If the tab is a screener.in page, its content script world DOES have chrome.storage,
// but Runtime.evaluate runs in the page's main world (no chrome.*). We need the
// isolated world. Use Page.createIsolatedWorld via the extension's execution context —
// easier: navigate to the extension's options page (same-origin, chrome.* available).
const currentUrl = await cdp("Runtime.evaluate", { expression: "location.href", returnByValue: true });
if (!currentUrl.result.value.includes("chrome-extension://")) {
  // Discover the extension id by asking for the ontology URL from a content-script world.
  // Content scripts have access to chrome.runtime.getURL. We use Page.createIsolatedWorld
  // to enter that world.
  await cdp("Page.enable");
  const frameTree = await cdp("Page.getFrameTree");
  const frameId = frameTree.frameTree.frame.id;
  const isolated = await cdp("Page.createIsolatedWorld", { frameId, worldName: "screener-nl-injector", grantUniveralAccess: true });
  const extIdRes = await cdp("Runtime.evaluate", {
    expression: `chrome.runtime.getURL('').replace('chrome-extension://','').replace(/\\/$/, '')`,
    contextId: isolated.executionContextId,
    returnByValue: true,
  });
  const extId = extIdRes.result.value;
  if (!extId) { console.error("could not resolve extension id"); process.exit(4); }
  // Navigate to the options page which is same-origin and has full chrome.storage access.
  await cdp("Page.navigate", { url: `chrome-extension://${extId}/src/options.html` });
  // Poll until page ready.
  for (let i = 0; i < 20; i++) {
    const ready = await cdp("Runtime.evaluate", { expression: "document.readyState === 'complete'", returnByValue: true });
    if (ready.result.value) break;
    await new Promise((r) => setTimeout(r, 250));
  }
}

const writeExpr = `
  (async () => {
    await chrome.storage.local.set({ geminiApiKey: ${JSON.stringify(key)}, geminiModel: ${JSON.stringify(model)} });
    const check = await chrome.storage.local.get(['geminiApiKey', 'geminiModel']);
    return { hasKey: !!check.geminiApiKey, keyLen: (check.geminiApiKey || '').length, model: check.geminiModel };
  })()
`;
const res = await cdp("Runtime.evaluate", { expression: writeExpr, awaitPromise: true, returnByValue: true });
if (res.exceptionDetails) { console.error(res.exceptionDetails.text); process.exit(5); }
console.log("stored:", res.result.value);
process.exit(0);
