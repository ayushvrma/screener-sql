# Privacy policy — Screener NL Query

**Last updated:** 2026-07-08

Screener NL Query ("the extension") is a Chrome extension that translates plain English into a query for the third-party website [screener.in](https://www.screener.in).

## What we collect

The extension processes exactly two kinds of user data:

1. **The English text you type into the panel.** This is only used to produce a Screener query and is never persisted by the extension.
2. **Your Gemini API key**, but only if you choose to paste one into the extension's welcome / options page. It is stored **locally in your browser** via `chrome.storage.local` and is never transmitted anywhere except to Google's Generative Language API (`generativelanguage.googleapis.com`) when the extension needs to call Gemini on your behalf.

## What we do NOT collect

- No analytics, telemetry, or usage tracking of any kind.
- No account, login, cookies, or identifiers.
- No selling, sharing, renting, or monetisation of any user data.
- No transmission of any data to servers operated by the extension author.

The extension has **no backend**. All translation runs locally in your browser (rule engine) or against Google Gemini using the key you supplied.

## Data retention & deletion

Your Gemini API key stays in your browser's `chrome.storage.local` until you either (a) click **Clear key** on the options page, (b) uninstall the extension, or (c) clear your browser data for the extension. Uninstalling wipes all extension-stored data.

## Third-party services

- **Google Gemini (Generative Language API)** — invoked only when you have provided a key and the local rule engine could not translate your input. Google's own privacy policy applies to any request they receive from you: https://policies.google.com/privacy
- **screener.in** — the extension injects a panel into screener.in pages you visit. It does not read, collect, or transmit any screener.in content.

## Permissions and why they are required

- `storage` — to save your Gemini API key and preferred model in your browser only.
- `host_permissions: generativelanguage.googleapis.com` — to send your natural-language input to Google Gemini when the rule engine cannot translate it.
- content scripts on `screener.in` — to render the translation panel inside Screener's own pages.

## Contact

Questions: file an issue at https://github.com/ayushvrma/screener-sql/issues
