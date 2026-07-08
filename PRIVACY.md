# Privacy policy — Screener NL Query

**Last updated:** 2026-07-08

Screener NL Query ("the extension") is a Chrome extension that translates plain English into a query for the third-party website [screener.in](https://www.screener.in).

## What we collect

The extension processes exactly two kinds of user data:

1. **The English text you type into the panel.** This is only used to produce a Screener query and is never persisted by the extension.
2. **Your LLM provider API key** (Gemini, OpenAI, Anthropic, or DeepSeek), but only if you choose to paste one into the extension's welcome / options page. It is stored **locally in your browser** via `chrome.storage.local` and is never transmitted anywhere except to the provider you selected, at exactly one of these endpoints:
   - `generativelanguage.googleapis.com` (Google Gemini)
   - `api.openai.com` (OpenAI)
   - `api.anthropic.com` (Anthropic Claude)
   - `api.deepseek.com` (DeepSeek)

## What we do NOT collect

- No analytics, telemetry, or usage tracking of any kind.
- No account, login, cookies, or identifiers.
- No selling, sharing, renting, or monetisation of any user data.
- No transmission of any data to servers operated by the extension author.

The extension has **no backend**. All translation runs locally in your browser (rule engine) or against the LLM provider you selected, using the key you supplied.

## Data retention & deletion

Your Gemini API key stays in your browser's `chrome.storage.local` until you either (a) click **Clear key** on the options page, (b) uninstall the extension, or (c) clear your browser data for the extension. Uninstalling wipes all extension-stored data.

## Third-party services

The following are invoked only when you have provided a key **for that specific provider** and the local rule engine could not translate your input:

- **Google Gemini** — https://policies.google.com/privacy
- **OpenAI** — https://openai.com/policies/row-privacy-policy
- **Anthropic Claude** — https://www.anthropic.com/legal/privacy
- **DeepSeek** — https://cdn.deepseek.com/policies/en-US/deepseek-privacy-policy.html

The extension never calls a provider whose key you did not explicitly save.

**screener.in** — the extension injects a panel into screener.in pages you visit. It does not read, collect, or transmit any screener.in content.

## Permissions and why they are required

- `storage` — to save your LLM provider selection, API key, and preferred model in your browser only.
- `host_permissions` for the four LLM provider endpoints listed above — to route requests to the provider you selected. The extension makes zero network calls to any of these hosts unless you have saved a key for that specific provider.
- content scripts on `screener.in` — to render the translation panel inside Screener's own pages.

## Contact

Questions: file an issue at https://github.com/ayushvrma/screener-sql/issues
