(async function () {
  "use strict";
  const $ = (id) => document.getElementById(id);
  const key = $("key");
  const model = $("model");
  const status = $("status");
  const save = $("save");
  const clr = $("clear");

  const stored = await chrome.storage.local.get(["geminiApiKey", "geminiModel"]);
  if (stored.geminiApiKey) key.value = stored.geminiApiKey;
  if (stored.geminiModel) model.value = stored.geminiModel;

  function flash(msg, cls) {
    status.textContent = msg;
    status.className = cls;
    setTimeout(() => (status.textContent = ""), 2000);
  }

  save.addEventListener("click", async () => {
    await chrome.storage.local.set({
      geminiApiKey: key.value.trim(),
      geminiModel: (model.value || "gemini-2.5-flash").trim(),
    });
    flash("saved", "ok");
    // Small nudge to head over and use it.
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
  });
  clr.addEventListener("click", async () => {
    await chrome.storage.local.remove(["geminiApiKey"]);
    key.value = "";
    flash("cleared", "warn");
  });
})();
