(async function () {
  "use strict";
  const $ = (id) => document.getElementById(id);
  const providerSel = $("provider");
  const modelSel = $("model");
  const priceHint = $("pricing-hint");
  const keyInput = $("key");
  const keyLink = $("key-get-link");
  const status = $("status");
  const save = $("save");
  const clr = $("clear");

  const stored = await ScreenerNLSettings.readSettings();

  function renderProvider(providerId) {
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
    keyLink.textContent = `${p.name} dashboard →`;
  }

  providerSel.value = stored.providerId || "gemini";
  renderProvider(providerSel.value);
  if (stored.apiKey) keyInput.placeholder = `•••••• (saved with ${stored.providerId})`;

  providerSel.addEventListener("change", () => renderProvider(providerSel.value));

  function flash(msg, cls) {
    status.textContent = msg;
    status.className = cls;
    setTimeout(() => (status.textContent = ""), 2000);
  }

  save.addEventListener("click", async () => {
    try {
      await ScreenerNLSettings.saveSettings({
        providerId: providerSel.value,
        apiKey: keyInput.value.trim(),
        model: modelSel.value,
      });
      flash("saved", "ok");
      if (!document.getElementById("go-screener")) {
        const a = document.createElement("a");
        a.id = "go-screener";
        a.href = "https://www.screener.in/screen/raw/";
        a.target = "_blank";
        a.rel = "noopener";
        a.textContent = "Open screener.in/screen/raw/ →";
        a.style.cssText = "display:inline-block;margin-left:8px;color:#166534;text-decoration:underline";
        status.after(a);
      }
    } catch (err) {
      flash("error: " + err.message, "warn");
    }
  });
  clr.addEventListener("click", async () => {
    await ScreenerNLSettings.clearApiKey();
    keyInput.value = "";
    keyInput.placeholder = ScreenerNLProviders.getProvider(providerSel.value).keyHint;
    flash("cleared", "warn");
  });
})();
