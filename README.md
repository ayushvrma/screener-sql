# screener-sql

Turn plain English into a [screener.in](https://www.screener.in) custom-screen query.

![panel with Gemini fallback](docs/screenshots/06-panel-gemini-fallback.png)

See [`docs/screenshots/`](docs/screenshots/) for a walkthrough of every stage — install, setup, rules-only success, Gemini fallback.

Ships as:
- **Chrome extension** (`extension/`) — a floating panel on `screener.in/screen/*` that translates your English and fills the query box in-place. First-run onboarding lets you paste a Gemini API key for smarter fallback when rules don't match.
- **Python CLI** (`nl2screener/`) — same rule-based translator, scriptable for research / batch use.
- **Ontology JSON** (`ontology/`) — the machine-readable Screener variable + operator inventory both consumers rely on.

## How the translation pipeline works

1. **Rules run first (~1 ms).** Regex + synonym match against `ontology/screener_ontology.json`. Handles the vast majority of common ideas: PE, ROE, D/E, growth CAGRs, ownership %, Piotroski, DMA crossovers, `between X and Y` ranges, variable-on-RHS (`Current price < Book value`).
2. **Gemini fallback (~500 ms, BYOK).** Only fires if rules produce warnings AND the user has saved a Gemini API key. Uses gemini-2.5-flash with a system prompt that lists every ontology variable verbatim and gives few-shot approximations (e.g. "small cap" → `Market Capitalization < 5000`).
3. **Ontology guardrail.** Gemini's output is parsed and any variable name it emits is checked against the ontology JSON. If it hallucinates a Screener variable that doesn't exist, we reject with a warning instead of showing broken query text.
4. **No key + rules fail → setup prompt.** The panel surfaces a "Set up Gemini →" button that opens the options page. The extension never nags — you can Skip on the welcome screen and rules-only mode continues to work forever.

## Install (extension, unpacked)
1. Grab `screener-nl-*.zip` from the [latest release](../../releases/latest) — or run `node extension/tools/build.mjs` yourself.
2. Unzip it.
3. In Chrome/Edge/Brave/Arc → `chrome://extensions` → toggle **Developer mode** → **Load unpacked** → point to the unzipped folder.
4. Open `https://www.screener.in/screen/raw/`. A "NL → Screener" panel appears bottom-right.

Chrome Web Store submission is a manual step (screenshots + $5 dev fee); the zip in Releases is ready to upload as-is.

## CLI

```bash
python3 nl2screener/nl2screener.py "market cap over 5000 crore, roe above 20 and d/e under 0.5"
# Market Capitalization > 5000 AND Return on equity > 20 AND Debt to equity < 0.5
```

## Layout
```
ontology/           canonical JSON: variables, operators, functions, phrase hints
nl2screener/        Python CLI (no deps)
extension/          Chrome MV3 extension
  src/              content script, popup, translator.js port, panel.css, ontology.json
  test/             node --test suite
  tools/            build zip + icon generator
examples/           worked NL → query pairs
```

## Test
```bash
cd extension && node --test test/translator.test.mjs
```

## Sources for the ontology
See `ontology/README.md`.
