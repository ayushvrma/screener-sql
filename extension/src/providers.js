// Provider registry for the LLM fallback. Rates snapshotted 2026-07-09;
// display them in the UI but don't hardcode into any pricing logic.
//
// Each provider owns: endpoint URL, header builder, request body builder,
// and response parser. Adding a new one is one entry in PROVIDERS.

(function (root) {
  "use strict";

  const SYSTEM_JSON_HINT = "Return ONLY a JSON object {\"query\":\"…\"}. No prose. No code fences.";

  const PROVIDERS = {
    gemini: {
      id: "gemini",
      name: "Google Gemini",
      defaultModel: "gemini-2.5-flash-lite",
      models: ["gemini-2.5-flash-lite", "gemini-2.5-flash", "gemini-2.5-pro"],
      pricingHint: "$0.10 / $0.40 per M tokens · has free tier",
      keyHint: "AIza…",
      keyGetUrl: "https://aistudio.google.com/apikey",
      endpoint: (model) => `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`,
      buildHeaders: (apiKey) => ({ "content-type": "application/json", "x-goog-api-key": apiKey }),
      buildBody: (system, user, _model) => ({
        systemInstruction: { parts: [{ text: system + "\n" + SYSTEM_JSON_HINT }] },
        contents: [{ role: "user", parts: [{ text: user }] }],
        generationConfig: { responseMimeType: "application/json", temperature: 0 },
      }),
      parseResponse: (data) => data?.candidates?.[0]?.content?.parts?.[0]?.text || "",
    },

    openai: {
      id: "openai",
      name: "OpenAI",
      defaultModel: "gpt-5-nano",
      models: ["gpt-5-nano", "gpt-5-mini", "gpt-4.1-mini", "gpt-4o-mini"],
      pricingHint: "$0.05 / $0.40 per M (gpt-5-nano)",
      keyHint: "sk-…",
      keyGetUrl: "https://platform.openai.com/api-keys",
      endpoint: (_model) => "https://api.openai.com/v1/chat/completions",
      buildHeaders: (apiKey) => ({ "content-type": "application/json", "authorization": `Bearer ${apiKey}` }),
      buildBody: (system, user, model) => ({
        model,
        messages: [
          { role: "system", content: system + "\n" + SYSTEM_JSON_HINT },
          { role: "user", content: user },
        ],
        response_format: { type: "json_object" },
        temperature: 0,
      }),
      parseResponse: (data) => data?.choices?.[0]?.message?.content || "",
    },

    anthropic: {
      id: "anthropic",
      name: "Anthropic Claude",
      defaultModel: "claude-haiku-4-5",
      models: ["claude-haiku-4-5", "claude-sonnet-4-6"],
      pricingHint: "$1.00 / $5.00 per M (Haiku 4.5)",
      keyHint: "sk-ant-…",
      keyGetUrl: "https://console.anthropic.com/settings/keys",
      endpoint: (_model) => "https://api.anthropic.com/v1/messages",
      buildHeaders: (apiKey) => ({
        "content-type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
        // Required for browser (extension) origins; user consents by pasting the key.
        "anthropic-dangerous-direct-browser-access": "true",
      }),
      buildBody: (system, user, model) => ({
        model,
        max_tokens: 512,
        system: system + "\n" + SYSTEM_JSON_HINT,
        messages: [{ role: "user", content: user }],
      }),
      parseResponse: (data) => {
        const parts = data?.content || [];
        for (const p of parts) if (p.type === "text") return p.text || "";
        return "";
      },
    },

    deepseek: {
      id: "deepseek",
      name: "DeepSeek",
      defaultModel: "deepseek-v4-flash",
      models: ["deepseek-v4-flash", "deepseek-v4-pro"],
      pricingHint: "$0.14 / $0.28 per M (v4-flash)",
      keyHint: "sk-…",
      keyGetUrl: "https://platform.deepseek.com/api_keys",
      endpoint: (_model) => "https://api.deepseek.com/v1/chat/completions",
      buildHeaders: (apiKey) => ({ "content-type": "application/json", "authorization": `Bearer ${apiKey}` }),
      buildBody: (system, user, model) => ({
        model,
        messages: [
          { role: "system", content: system + "\n" + SYSTEM_JSON_HINT },
          { role: "user", content: user },
        ],
        response_format: { type: "json_object" },
        temperature: 0,
      }),
      parseResponse: (data) => data?.choices?.[0]?.message?.content || "",
    },
  };

  function getProvider(id) {
    return PROVIDERS[id] || null;
  }

  function listProviders() {
    return Object.values(PROVIDERS);
  }

  async function callProvider({ providerId, apiKey, model, system, user, timeoutMs = 12000 }) {
    const provider = getProvider(providerId);
    if (!provider) throw new Error(`unknown provider: ${providerId}`);
    const modelToUse = model || provider.defaultModel;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(new Error("timeout")), timeoutMs);
    try {
      const res = await fetch(provider.endpoint(modelToUse), {
        method: "POST",
        headers: provider.buildHeaders(apiKey),
        body: JSON.stringify(provider.buildBody(system, user, modelToUse)),
        signal: controller.signal,
      });
      if (!res.ok) {
        const text = await res.text().catch(() => "");
        throw new Error(`${provider.name} ${res.status}: ${text.slice(0, 200)}`);
      }
      const data = await res.json();
      const raw = provider.parseResponse(data);
      if (!raw) throw new Error(`${provider.name}: empty response`);
      return raw;
    } finally {
      clearTimeout(timer);
    }
  }

  const api = { PROVIDERS, getProvider, listProviders, callProvider };
  root.ScreenerNLProviders = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})(typeof globalThis !== "undefined" ? globalThis : this);
