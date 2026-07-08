// Verify the extension end-to-end in a running Chromium-family browser.
// Assumes the browser was started with --remote-debugging-port=9222 and the
// extension already loaded (see README). Connects over CDP, waits for the
// content-script panel to inject, drives its UI, and asserts the translation.
//
// Usage:
//   node extension/tools/verify-in-browser.mjs [port]

const PORT = process.argv[2] || "9222";
const NL = "market cap over 5000 crore, roe above 20 and debt to equity under 0.5";
const EXPECTED = "Market Capitalization > 5000 AND Return on equity > 20 AND Debt to equity < 0.5";

const tabs = await (await fetch(`http://localhost:${PORT}/json`)).json();
const tab = tabs.find((t) => t.url && t.url.includes("screener.in") && t.webSocketDebuggerUrl);
if (!tab) {
  console.error("no screener.in tab — open one first");
  process.exit(2);
}

const ws = new WebSocket(tab.webSocketDebuggerUrl);
await new Promise((res, rej) => {
  ws.addEventListener("open", res);
  ws.addEventListener("error", rej);
});

let mid = 0;
const pending = new Map();
ws.addEventListener("message", (ev) => {
  const msg = JSON.parse(ev.data);
  if (msg.id && pending.has(msg.id)) {
    const { resolve, reject } = pending.get(msg.id);
    pending.delete(msg.id);
    if (msg.error) reject(new Error(msg.error.message));
    else resolve(msg.result);
  }
});
function cdp(method, params = {}) {
  const id = ++mid;
  return new Promise((resolve, reject) => {
    pending.set(id, { resolve, reject });
    ws.send(JSON.stringify({ id, method, params }));
  });
}
async function evalJS(expression, { awaitPromise = true } = {}) {
  const r = await cdp("Runtime.evaluate", { expression, returnByValue: true, awaitPromise });
  if (r.exceptionDetails) {
    throw new Error(r.exceptionDetails.text + " :: " + (r.exceptionDetails.exception?.description || ""));
  }
  return r.result.value;
}

await cdp("Runtime.enable");

let panelPresent = false;
for (let i = 0; i < 20; i++) {
  panelPresent = await evalJS(`!!document.getElementById('screener-nl-host')`);
  if (panelPresent) break;
  await new Promise((r) => setTimeout(r, 500));
}
console.log("panel injected:", panelPresent);
if (!panelPresent) {
  console.log("title:", await evalJS("document.title"));
  console.log("url:", await evalJS("location.href"));
  process.exit(3);
}

await evalJS(`
  (function(){
    const t = document.querySelector('#screener-nl-host .snl-input');
    t.value = ${JSON.stringify(NL)};
    document.querySelector('#screener-nl-host .snl-translate').click();
  })();
`);

let output = "";
for (let i = 0; i < 30; i++) {
  output = await evalJS(`document.querySelector('#screener-nl-host .snl-output').textContent || ''`);
  if (output && output !== "(nothing matched)") break;
  await new Promise((r) => setTimeout(r, 300));
}
const openHref = await evalJS(`document.querySelector('#screener-nl-host .snl-open').href`);
console.log("panel output:", JSON.stringify(output));
console.log("open link  :", openHref);

const shotPath = process.env.SCREENSHOT_PATH;
if (shotPath) {
  const { writeFileSync } = await import("node:fs");
  const shot = await cdp("Page.captureScreenshot", { format: "png" });
  writeFileSync(shotPath, Buffer.from(shot.data, "base64"));
  console.log("screenshot :", shotPath);
}

if (output.trim() === EXPECTED) {
  console.log("PASS: translated correctly through the extension UI");
  process.exit(0);
}
console.log("FAIL: expected:", EXPECTED);
process.exit(4);
