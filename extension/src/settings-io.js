// Shared read/save of extension settings with legacy-key migration.
// Old schema: { geminiApiKey, geminiModel }
// New schema: { providerId, apiKey, model }
(function (root) {
  "use strict";

  async function readSettings() {
    const s = await chrome.storage.local.get(["providerId", "apiKey", "model", "geminiApiKey", "geminiModel"]);
    // Migration: old {geminiApiKey, geminiModel} → new {providerId:"gemini", apiKey, model}
    if (!s.providerId && s.geminiApiKey) {
      const migrated = {
        providerId: "gemini",
        apiKey: s.geminiApiKey,
        model: s.geminiModel || "gemini-2.5-flash-lite",
      };
      await chrome.storage.local.set(migrated);
      await chrome.storage.local.remove(["geminiApiKey", "geminiModel"]);
      return migrated;
    }
    return {
      providerId: s.providerId || "",
      apiKey: s.apiKey || "",
      model: s.model || "",
    };
  }

  async function saveSettings({ providerId, apiKey, model }) {
    if (!providerId || !apiKey) throw new Error("providerId + apiKey required");
    await chrome.storage.local.set({
      providerId,
      apiKey: apiKey.trim(),
      model: (model || "").trim(),
    });
  }

  async function clearApiKey() {
    await chrome.storage.local.remove(["apiKey", "providerId", "model"]);
  }

  root.ScreenerNLSettings = { readSettings, saveSettings, clearApiKey };
})(typeof globalThis !== "undefined" ? globalThis : this);
