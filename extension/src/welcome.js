(async function () {
  "use strict";
  const key = document.getElementById("key");
  const save = document.getElementById("save");
  const skip = document.getElementById("skip");
  const status = document.getElementById("status");

  const existing = await chrome.storage.local.get(["geminiApiKey"]);
  if (existing.geminiApiKey) {
    key.placeholder = "•••••• (saved — paste a new one to replace)";
  }

  key.addEventListener("input", () => {
    save.disabled = key.value.trim().length < 10;
  });

  function showGoToScreener(container) {
    const box = document.createElement("div");
    box.className = "cta";
    box.style.cssText = "margin-top:16px;padding:12px 14px;background:#ecfdf5;border:1px solid #a7f3d0;border-radius:8px;color:#065f46";
    box.innerHTML = `
      <strong style="display:block;margin-bottom:4px">You're all set 🎉</strong>
      <span style="font-size:13px">Open Screener now — the NL panel is waiting bottom-right.</span>
      <div style="margin-top:10px;display:flex;gap:8px;flex-wrap:wrap">
        <button class="primary" id="cta-raw">Open screener.in/screen/raw/</button>
        <button id="cta-screens">Browse public screens</button>
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
    const k = key.value.trim();
    if (!k) return;
    await chrome.storage.local.set({ geminiApiKey: k, geminiModel: "gemini-2.5-flash" });
    status.textContent = "saved";
    status.className = "ok";
    if (!document.querySelector(".cta")) showGoToScreener(document.querySelector("main"));
  });

  skip.addEventListener("click", () => {
    status.textContent = "no problem — you can add it later from the extension options";
    status.className = "hint";
    if (!document.querySelector(".cta")) showGoToScreener(document.querySelector("main"));
  });
})();
