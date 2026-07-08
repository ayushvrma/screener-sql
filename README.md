# screener-sql

Turn plain English into a [screener.in](https://www.screener.in) custom-screen query.

Ships as:
- **Chrome extension** (`extension/`) — a floating panel on `screener.in/screen/*` that translates your English and fills the query box in-place.
- **Python CLI** (`nl2screener/`) — same translator, scriptable for research / batch use.
- **Ontology JSON** (`ontology/`) — the machine-readable Screener variable + operator inventory both consumers rely on.

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
