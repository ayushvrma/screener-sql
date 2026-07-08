// Type an NL string into the extension's panel and print the resulting query.
// Requires: Brave/Chrome with --remote-debugging-port=9222 and a screener.in tab open.
const NL = process.argv[2];
const PORT = process.argv[3] || "9222";
if (!NL) { console.error("usage: node run-nl.mjs \"<english>\" [port]"); process.exit(1); }

async function main() {
  const tabs = await (await fetch(`http://localhost:${PORT}/json`)).json();
  let tab = tabs.find((t) => t.type === "page" && (t.url || "").includes("screener.in"));
  if (!tab) {
    // Navigate an available tab to screener
    tab = tabs.find((t) => t.type === "page" && t.webSocketDebuggerUrl);
    if (!tab) { console.error("no page tab"); process.exit(2); }
    const ws0 = new WebSocket(tab.webSocketDebuggerUrl);
    await new Promise((r, j) => { ws0.addEventListener("open", r); ws0.addEventListener("error", j); });
    let mid0 = 0;
    ws0.send(JSON.stringify({ id: ++mid0, method: "Page.navigate", params: { url: "https://www.screener.in/screens/131217/query/" } }));
    ws0.close();
    // wait a bit and re-fetch
    await new Promise((r) => setTimeout(r, 4000));
    const tabs2 = await (await fetch(`http://localhost:${PORT}/json`)).json();
    tab = tabs2.find((t) => t.type === "page" && (t.url || "").includes("screener.in"));
    if (!tab) { console.error("still no screener tab"); process.exit(3); }
  }

  const ws = new WebSocket(tab.webSocketDebuggerUrl);
  await new Promise((r, j) => { ws.addEventListener("open", r); ws.addEventListener("error", j); });
  let mid = 0;
  const pending = new Map();
  ws.addEventListener("message", (ev) => {
    const m = JSON.parse(ev.data);
    if (m.id && pending.has(m.id)) {
      const p = pending.get(m.id); pending.delete(m.id);
      m.error ? p.reject(new Error(m.error.message)) : p.resolve(m.result);
    }
  });
  const cdp = (method, params = {}) => {
    const id = ++mid;
    return new Promise((r, j) => { pending.set(id, { resolve: r, reject: j }); ws.send(JSON.stringify({ id, method, params })); });
  };
  const evalJS = async (expression, opts = {}) => {
    const r = await cdp("Runtime.evaluate", { expression, returnByValue: true, awaitPromise: true, ...opts });
    if (r.exceptionDetails) throw new Error(r.exceptionDetails.text + " :: " + (r.exceptionDetails.exception?.description || ""));
    return r.result.value;
  };

  await cdp("Runtime.enable");

  // Wait for panel to inject (content script may re-run after nav)
  let injected = false;
  for (let i = 0; i < 30; i++) {
    injected = await evalJS(`!!document.getElementById('screener-nl-host')`);
    if (injected) break;
    await new Promise((r) => setTimeout(r, 400));
  }
  console.log("panel injected:", injected);
  if (!injected) process.exit(4);

  await evalJS(`(() => {
    const t = document.querySelector('#screener-nl-host .snl-input');
    t.value = ${JSON.stringify(NL)};
    document.querySelector('#screener-nl-host .snl-translate').click();
  })()`);

  let output = "";
  let warnings = "";
  for (let i = 0; i < 50; i++) {
    output = await evalJS(`document.querySelector('#screener-nl-host .snl-output').textContent || ''`);
    warnings = await evalJS(`document.querySelector('#screener-nl-host .snl-warn').textContent || ''`);
    if (output && output !== "…") break;
    await new Promise((r) => setTimeout(r, 400));
  }
  const href = await evalJS(`document.querySelector('#screener-nl-host .snl-open').href`);
  console.log("input     :", NL);
  console.log("output    :", output);
  console.log("warnings  :", warnings);
  console.log("open link :", href);
  process.exit(0);
}
main().catch((e) => { console.error(e); process.exit(9); });
