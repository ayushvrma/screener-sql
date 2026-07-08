(async function () {
  "use strict";
  const $ = (id) => document.getElementById(id);
  const input = $("input");
  const out = $("out");
  const warn = $("warn");
  const openLink = $("open");
  const go = $("go");

  const ontology = await ScreenerNL.loadOntology(chrome.runtime.getURL("src/ontology.json"));

  async function run() {
    const nl = input.value.trim();
    if (!nl) return;
    const settings = await chrome.storage.local.get(["geminiApiKey", "geminiModel"]);
    out.textContent = "…";
    const result = await ScreenerNL.translateWithFallback(nl, ontology, {
      apiKey: settings.geminiApiKey || "",
      model: settings.geminiModel || "gemini-2.5-flash",
    });
    const { query, warnings, needsSetup } = result;
    out.textContent = query || (needsSetup ? "" : "(nothing matched)");
    const esc = (w) => w.replace(/[&<>"']/g, (c) => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
    let warnHtml = warnings.map((w) => `<div>⚠ ${esc(w)}</div>`).join("");
    if (needsSetup && !query) {
      warnHtml = `<div style="background:#eff6ff;border:1px solid #bfdbfe;color:#1e3a8a;padding:8px;border-radius:6px;margin-bottom:6px">
        <strong>Need Gemini fallback.</strong> Rule engine couldn't match.
        <button id="setup-link" style="margin-top:6px;padding:4px 8px;border:1px solid #1d4ed8;background:#2563eb;color:#fff;border-radius:4px;cursor:pointer">Set up Gemini →</button>
      </div>` + warnHtml;
    }
    warn.innerHTML = warnHtml;
    const setupLink = document.getElementById("setup-link");
    if (setupLink) setupLink.addEventListener("click", () => chrome.runtime.openOptionsPage());
    if (query) {
      openLink.href = ScreenerNL.screenerUrl(query);
      openLink.style.display = "inline";
    } else {
      openLink.style.display = "none";
    }
  }

  go.addEventListener("click", run);
  input.addEventListener("keydown", (e) => {
    if ((e.metaKey || e.ctrlKey) && e.key === "Enter") { e.preventDefault(); run(); }
  });
})();
