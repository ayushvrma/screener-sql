(async function () {
  "use strict";
  const $ = (id) => document.getElementById(id);
  const input = $("input");
  const out = $("out");
  const warn = $("warn");
  const openLink = $("open");
  const go = $("go");

  const ontology = await ScreenerNL.loadOntology(chrome.runtime.getURL("src/ontology.json"));

  function run() {
    const nl = input.value.trim();
    if (!nl) return;
    const { query, warnings } = ScreenerNL.translate(nl, ontology);
    out.textContent = query || "(nothing matched)";
    warn.innerHTML = warnings.map((w) => `<div>⚠ ${w.replace(/[&<>"']/g, (c) => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]))}</div>`).join("");
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
