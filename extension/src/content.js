// Content script — mounts a small floating panel on Screener's screen pages.
// Reads user's English, calls ScreenerNL.translate, writes into Screener's query textarea.

(function () {
  "use strict";

  const HOST_ID = "screener-nl-host";
  if (document.getElementById(HOST_ID)) return;

  const host = document.createElement("div");
  host.id = HOST_ID;
  host.className = "snl-host";
  host.innerHTML = `
    <div class="snl-header">
      <span class="snl-title">NL → Screener</span>
      <button class="snl-collapse" title="Collapse">–</button>
    </div>
    <div class="snl-body">
      <textarea class="snl-input" rows="3" placeholder="e.g. mcap over 5000 crore, roe above 20 and d/e under 0.5"></textarea>
      <div class="snl-actions">
        <button class="snl-translate">Translate</button>
        <button class="snl-fill" disabled>Fill query box</button>
        <a class="snl-open" href="#" target="_blank" rel="noopener" style="display:none">Open on Screener ↗</a>
      </div>
      <pre class="snl-output" aria-live="polite"></pre>
      <div class="snl-warn"></div>
    </div>
  `;
  document.body.appendChild(host);

  const $ = (sel) => host.querySelector(sel);
  const input = $(".snl-input");
  const output = $(".snl-output");
  const warn = $(".snl-warn");
  const btnTranslate = $(".snl-translate");
  const btnFill = $(".snl-fill");
  const btnCollapse = $(".snl-collapse");
  const openLink = $(".snl-open");
  const body = $(".snl-body");

  let lastQuery = "";
  let ontologyPromise = null;

  function getOntology() {
    if (!ontologyPromise) {
      const url = chrome.runtime.getURL("src/ontology.json");
      ontologyPromise = ScreenerNL.loadOntology(url);
    }
    return ontologyPromise;
  }

  async function doTranslate() {
    const nl = input.value.trim();
    if (!nl) return;
    try {
      const ontology = await getOntology();
      const { query, warnings } = ScreenerNL.translate(nl, ontology);
      lastQuery = query;
      output.textContent = query || "(nothing matched)";
      warn.innerHTML = warnings.map((w) => `<div>⚠ ${escapeHtml(w)}</div>`).join("");
      btnFill.disabled = !query;
      if (query) {
        openLink.href = ScreenerNL.screenerUrl(query);
        openLink.style.display = "inline";
      } else {
        openLink.style.display = "none";
      }
    } catch (err) {
      output.textContent = "";
      warn.textContent = "error: " + err.message;
    }
  }

  function findScreenerQueryTextarea() {
    // Screener's raw-query builder uses a textarea named "query".
    return (
      document.querySelector('textarea[name="query"]') ||
      document.querySelector('textarea#id_query') ||
      document.querySelector('form textarea')
    );
  }

  function fillScreenerTextarea() {
    if (!lastQuery) return;
    const ta = findScreenerQueryTextarea();
    if (!ta) {
      warn.textContent = "no query textarea found on this page — use the ↗ link instead";
      return;
    }
    ta.value = lastQuery;
    ta.dispatchEvent(new Event("input", { bubbles: true }));
    ta.dispatchEvent(new Event("change", { bubbles: true }));
    ta.focus();
    flash(ta);
  }

  function flash(el) {
    const prev = el.style.boxShadow;
    el.style.boxShadow = "0 0 0 3px #4ade80";
    setTimeout(() => (el.style.boxShadow = prev), 700);
  }

  function escapeHtml(s) {
    return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
  }

  btnTranslate.addEventListener("click", doTranslate);
  input.addEventListener("keydown", (e) => {
    if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
      e.preventDefault();
      doTranslate();
    }
  });
  btnFill.addEventListener("click", fillScreenerTextarea);
  btnCollapse.addEventListener("click", () => {
    const collapsed = host.classList.toggle("snl-collapsed");
    btnCollapse.textContent = collapsed ? "+" : "–";
  });
})();
