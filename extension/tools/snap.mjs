// Snap a screenshot of the tab whose URL contains the given substring.
// Usage: node snap.mjs <output-path> <url-substring>
const [outPath, urlMatch] = process.argv.slice(2);
if (!outPath || !urlMatch) { console.error("usage: snap.mjs <path> <url-substring>"); process.exit(1); }

const port = "9222";
const tabs = await (await fetch(`http://localhost:${port}/json`)).json();
const tab = tabs.find((t) => t.type === "page" && (t.url || "").includes(urlMatch));
if (!tab) { console.error(`no tab matching ${urlMatch}`); process.exit(2); }

const ws = new WebSocket(tab.webSocketDebuggerUrl);
await new Promise((r, j) => { ws.addEventListener("open", r); ws.addEventListener("error", j); });
let mid = 0; const p = new Map();
ws.addEventListener("message", (ev) => {
  const m = JSON.parse(ev.data);
  if (m.id && p.has(m.id)) { const q = p.get(m.id); p.delete(m.id); m.error ? q.reject(new Error(m.error.message)) : q.resolve(m.result); }
});
const cdp = (method, params = {}) => {
  const id = ++mid;
  return new Promise((r, j) => { p.set(id, { resolve: r, reject: j }); ws.send(JSON.stringify({ id, method, params })); });
};
await cdp("Runtime.enable");
await cdp("Page.enable");
// bring tab forward
await cdp("Page.bringToFront").catch(() => {});
const shot = await cdp("Page.captureScreenshot", { format: "png" });
const { writeFileSync } = await import("node:fs");
writeFileSync(outPath, Buffer.from(shot.data, "base64"));
console.log("saved:", outPath, "from", tab.url);
process.exit(0);
