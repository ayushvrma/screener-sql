# Chrome Web Store — submission pack

Everything you need to copy-paste into the [developer dashboard](https://chrome.google.com/webstore/devconsole/).

---

## 1. Upload

- **Package:** `screener-nl-0.1.0.zip` — download from https://github.com/ayushvrma/screener-sql/releases/tag/v0.1.0

## 2. Store listing

**Item name** (max 45 chars)
```
Screener NL Query
```

**Summary** (max 132 chars — appears under the title)
```
Type stock-screening ideas in plain English. Get a valid screener.in query. Optional Gemini fallback for fuzzy phrasings.
```

**Category**
```
Productivity
```

**Language**
```
English (United States)
```

**Description** (max 16 000 chars)
```
Type your investing idea in plain English. The extension turns it into a screener.in query and fills the query box for you.

Two translation engines, in order:

1) Rule-based (always on, ~1 ms, offline)
   Handles the vast majority of common screening ideas: P/E, ROE, ROCE, Debt to equity,
   Sales/Profit growth CAGRs, Piotroski, Altman Z, G-Factor, DMA crossovers, promoter/FII/DII
   ownership, `between X and Y` ranges, and variable-on-RHS comparisons like
   "current price below book value".

2) Gemini 2.5 Flash fallback (opt-in, BYOK)
   When your English uses colloquial phrasings the rule engine doesn't recognise
   ("dividend aristocrats", "compounders", "monopoly moats"), the extension can call
   Google Gemini using YOUR OWN free API key from aistudio.google.com/apikey. Every
   variable Gemini emits is validated against the Screener ontology, so it can't
   hallucinate a variable Screener doesn't support.

Features
• Floating panel on screener.in/screen/* that translates and fills the query textarea
• Popup for translating on any page
• First-run welcome screen for optional Gemini key setup
• Deep link that opens the translated query directly on screener.in
• Everything runs locally: no analytics, no telemetry, no backend

Privacy
• No user data leaves your machine except (a) the English string you type, sent only to
  Google Gemini via your own API key when you opt into the fallback.
• Full privacy policy: https://github.com/ayushvrma/screener-sql/blob/main/PRIVACY.md

Open source, MIT licensed: https://github.com/ayushvrma/screener-sql
```

**Screenshots** (1280 × 800 PNG, upload 3–5 of these from `docs/store-assets/`)

Recommended order:
1. `03-panel-rules-success.png` — the hero shot (panel actively translating on screener.in)
2. `06-panel-gemini-fallback.png` — same panel showing the Gemini badge
3. `02-panel-needs-setup.png` — the "Set up Gemini →" state (shows the guardrail UX)
4. `01-welcome-fresh.png` — the onboarding page
5. `05-welcome-after-save.png` — the "You're all set" CTA card

## 3. Privacy tab

**Single purpose**
```
Translate plain-English stock-screening ideas into screener.in query syntax and inject a helper panel on screener.in pages.
```

**Permission justifications**

- `storage`
  ```
  Stores the user's optional Gemini API key and preferred model locally in chrome.storage.local. No data is transmitted anywhere by this permission.
  ```

- `host_permissions: https://generativelanguage.googleapis.com/*`
  ```
  Sends the user's natural-language input to Google's Gemini API only when the local rule engine cannot translate it and the user has explicitly saved their own API key. No requests are made otherwise.
  ```

- `content_scripts` on `screener.in`
  ```
  Injects the translation panel into Screener's screen builder pages so users can translate and fill Screener's own query textarea in place.
  ```

**Data usage declarations** (check the following boxes)

- ✅ I do NOT sell or transfer user data to third parties, outside of the approved use cases
- ✅ I do NOT use or transfer user data for purposes unrelated to my item's single purpose
- ✅ I do NOT use or transfer user data to determine credit-worthiness or for lending purposes

**Data collected** (declare)
- Personally identifiable information: **None**
- Health information: **None**
- Financial and payment information: **None**
- Authentication information: **Yes** → user's Gemini API key, stored locally only
- Personal communications: **None**
- Location: **None**
- Web history: **None**
- User activity: **None**
- Website content: **None**

**Privacy policy URL**
```
https://github.com/ayushvrma/screener-sql/blob/main/PRIVACY.md
```

## 4. Distribution

- **Visibility:** Public
- **Regions:** all
- **Pricing:** free

## 5. Submit

Click **Submit for review**. Typical review is 1–3 business days for a first submission from a new developer; faster for later updates.

---

## Automating future updates (after first approval)

Once your first version is approved, you can push updates via the CWS API rather than the dashboard. Two steps:

1. **Get OAuth credentials** — one-time. Visit https://console.developers.google.com, create a project, enable "Chrome Web Store API", create an OAuth 2.0 Client ID (Desktop app), then walk through the [chrome-webstore-upload-cli auth flow](https://github.com/fregante/chrome-webstore-upload-cli) once to mint a refresh token.

2. **Wire the release workflow** — add these repo secrets to GitHub Actions:
   - `CWS_EXTENSION_ID` (48 chars, given after first approval)
   - `CWS_CLIENT_ID`, `CWS_CLIENT_SECRET`, `CWS_REFRESH_TOKEN`
   
   Then extend `.github/workflows/release.yml`:
   ```yaml
   - name: Publish to Chrome Web Store
     if: startsWith(github.ref, 'refs/tags/')
     run: |
       npx chrome-webstore-upload-cli@3 upload \
         --source extension/dist/screener-nl-${{ github.ref_name }}.zip \
         --extension-id "$CWS_EXTENSION_ID" \
         --client-id "$CWS_CLIENT_ID" --client-secret "$CWS_CLIENT_SECRET" \
         --refresh-token "$CWS_REFRESH_TOKEN" \
         --auto-publish
   ```

Now `git tag v0.2.0 && git push --tags` builds, uploads, and publishes in one shot.
