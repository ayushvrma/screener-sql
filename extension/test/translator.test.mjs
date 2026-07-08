// Node test harness for the JS translator. Uses only built-ins.
import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import assert from "node:assert/strict";
import { test } from "node:test";

const HERE = dirname(fileURLToPath(import.meta.url));
const translatorSrc = readFileSync(resolve(HERE, "..", "src", "translator.js"), "utf8");
const ontology = JSON.parse(readFileSync(resolve(HERE, "..", "src", "ontology.json"), "utf8"));

// Evaluate the IIFE — attaches to globalThis, same as <script> loading in the browser.
new Function(translatorSrc)();
const NL = globalThis.ScreenerNL;
assert.ok(NL, "ScreenerNL should be attached to globalThis");

const CASES = [
  {
    nl: "market cap over 5000 crore, roe above 20 and debt to equity under 0.5",
    query: "Market Capitalization > 5000 AND Return on equity > 20 AND Debt to equity < 0.5",
  },
  {
    nl: "5 year avg roe at least 15 and pledged percentage under 1 and profit growth 3years above 10",
    query: "Average return on equity 5Years >= 15 AND Pledged percentage < 1 AND Profit growth 3Years > 10",
  },
  {
    nl: "piotroski above 7 and altman z above 3 and g-factor at least 5",
    query: "Piotroski score > 7 AND Altman Z Score > 3 AND G Factor >= 5",
  },
  {
    nl: "current price below book value and promoter holding above 50 and pledged percentage equals 0",
    query: "Current price < Book value AND Promoter holding > 50 AND Pledged percentage = 0",
  },
  {
    nl: "50 dma above 200 dma",
    query: "DMA 50 > DMA 200",
  },
  {
    nl: "price between 100 and 300 and dividend yield above 1.5 and debt to equity under 0.5",
    query: "Current price >= 100 AND Current price <= 300 AND Dividend yield > 1.5 AND Debt to equity < 0.5",
  },
  {
    nl: "mcap between 1000 and 10000",
    query: "Market Capitalization >= 1000 AND Market Capitalization <= 10000",
  },
];

for (const c of CASES) {
  test(c.nl, () => {
    const out = NL.translate(c.nl, ontology);
    assert.equal(out.query, c.query, `warnings: ${out.warnings.join("; ")}`);
    assert.deepEqual(out.warnings, []);
  });
}

test("URL round-trip encodes AND/OR safely", () => {
  const url = NL.screenerUrl("Return on equity > 20 AND Debt to equity < 0.5");
  assert.match(url, /^https:\/\/www\.screener\.in\/screen\/raw\/\?query=/);
  assert.match(url, /Return%20on%20equity/);
});

test("garbage in produces warnings, not throws", () => {
  const out = NL.translate("banana panic sell everything", ontology);
  assert.equal(out.query, "");
  assert.ok(out.warnings.length > 0);
});

test("percent suffix is stripped in numeric parse", () => {
  const out = NL.translate("roe above 22%", ontology);
  assert.equal(out.query, "Return on equity > 22");
});
