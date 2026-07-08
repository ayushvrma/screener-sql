(async function () {
  "use strict";
  const $ = (id) => document.getElementById(id);
  const providerSel = $("provider");
  const modelSel = $("model");
  const priceHint = $("pricing-hint");
  const keyInput = $("key");
  const keyLink = $("key-get-link");
  const save = $("save");
  const skip = $("skip");
  const status = $("status");

  const stored = await ScreenerNLSettings.readSettings();

  function renderProviderMeta(providerId) {
    const p = ScreenerNLProviders.getProvider(providerId);
    if (!p) return;
    modelSel.innerHTML = "";
    for (const m of p.models) {
      const opt = document.createElement("option");
      opt.value = m; opt.textContent = m;
      modelSel.appendChild(opt);
    }
    modelSel.value = stored.providerId === providerId && stored.model ? stored.model : p.defaultModel;
    priceHint.textContent = p.pricingHint;
    keyInput.placeholder = p.keyHint;
    keyLink.href = p.keyGetUrl;
    keyLink.textContent = `Get one from ${p.name} →`;
  }

  providerSel.value = stored.providerId || "gemini";
  renderProviderMeta(providerSel.value);
  if (stored.apiKey) keyInput.placeholder = `•••••• (saved with ${stored.providerId} — paste a new one to replace)`;

  providerSel.addEventListener("change", () => renderProviderMeta(providerSel.value));
  modelSel.addEventListener("change", () => {});
  keyInput.addEventListener("input", () => {
    save.disabled = keyInput.value.trim().length < 10;
  });

  function showGoToScreener(container) {
    if (document.querySelector(".cta")) return;
    const box = document.createElement("div");
    box.className = "cta";
    box.style.cssText = "margin-top:16px;padding:12px 14px;background:#ecfdf5;border:1px solid #a7f3d0;border-radius:8px;color:#065f46";
    box.innerHTML = `
      <strong style="display:block;margin-bottom:4px">You're all set 🎉</strong>
      <span style="font-size:13px">Open Screener now — the NL panel is waiting bottom-right.</span>
      <div style="margin-top:10px;display:flex;gap:8px;flex-wrap:wrap">
        <button class="primary" id="cta-raw" style="padding:8px 14px;border:1px solid #1d4ed8;background:#2563eb;color:#fff;border-radius:6px;cursor:pointer">Open screener.in/screen/raw/</button>
        <button id="cta-screens" style="padding:8px 14px;border:1px solid #d0d7de;background:#f6f8fa;border-radius:6px;cursor:pointer">Browse public screens</button>
      </div>
    `;
    container.appendChild(box);
    box.querySelector("#cta-raw").addEventListener("click", () => {
      chrome.tabs.create({ url: "https://www.screener.in/screen/raw/" });
    });
    box.querySelector("#cta-screens").addEventListener("click", () => {
      chrome.tabs.create({ url: "https://www.screener.in/screens/" });
    });
  }

  save.addEventListener("click", async () => {
    const k = keyInput.value.trim();
    if (!k) return;
    try {
      await ScreenerNLSettings.saveSettings({
        providerId: providerSel.value,
        apiKey: k,
        model: modelSel.value,
      });
      status.textContent = "saved";
      status.className = "ok";
      showGoToScreener(document.querySelector("main"));
    } catch (err) {
      status.textContent = "error: " + err.message;
      status.className = "err";
    }
  });

  skip.addEventListener("click", () => {
    status.textContent = "no problem — rules-only mode continues to work";
    status.className = "hint";
    showGoToScreener(document.querySelector("main"));
  });
})();
