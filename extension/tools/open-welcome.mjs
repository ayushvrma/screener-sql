// Navigate the current debuggable tab to the extension's welcome page.
// Useful during dev + verification.
const PORT = process.argv[2] || "9222";
const tabs = await (await fetch(`http://localhost:${PORT}/json`)).json();
// The extension's service worker or an extension page reveals the ID directly via its URL.
const extTarget = tabs.find((t) => /^chrome-extension:\/\//.test(t.url || ""));
const extId = extTarget ? new URL(extTarget.url).host : null;
const tab = tabs.find((t) => t.type === "page" && t.webSocketDebuggerUrl);
if (!tab) { console.error("no page tab"); process.exit(2); }

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
function cdp(m, params = {}) {
  const id = ++mid;
  return new Promise((r, j) => { pending.set(id, { resolve: r, reject: j }); ws.send(JSON.stringify({ id, method: m, params })); });
}

await cdp("Runtime.enable");
await cdp("Page.enable");

let resolvedId = extId;
if (!resolvedId) {
  // Fallback: peek at chrome://extensions via the page.
  const frameTree = await cdp("Page.getFrameTree");
  const iso = await cdp("Page.createIsolatedWorld", { frameId: frameTree.frameTree.frame.id, worldName: "extid-lookup", grantUniveralAccess: true });
  const idRes = await cdp("Runtime.evaluate", {
    expression: `typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.id`,
    contextId: iso.executionContextId,
    returnByValue: true,
  });
  resolvedId = idRes.result.value;
}
if (!resolvedId) { console.error("no ext id"); process.exit(3); }
console.log("extension id:", resolvedId);
await cdp("Page.navigate", { url: `chrome-extension://${resolvedId}/src/welcome.html` });
console.log("navigated to welcome page — paste your key there");
process.exit(0);
