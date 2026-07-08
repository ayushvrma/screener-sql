// Screener NL translator — pure JS port of nl2screener.py.
// Exposes globalThis.ScreenerNL = { translate, screenerUrl, loadOntology }.
// No dependencies. Safe to load as a content script or import from Node tests.

(function (root) {
  "use strict";

  const COMPARATORS = [
    [">=", ["at least", "no less than", "minimum of", ">="]],
    ["<=", ["at most", "no more than", "maximum of", "<="]],
    [">", ["greater than", "more than", "higher than", "above", "over", "exceeds", "exceeding", ">"]],
    ["<", ["less than", "lower than", "below", "under", "<"]],
    ["=", ["equal to", "equals", "exactly", "="]],
  ];

  const MULTIPLIERS = {
    cr: 1, crore: 1, crores: 1,
    lakh: 0.01, lakhs: 0.01,
    k: 1e-5, thousand: 1e-5,
    m: 0.1, mn: 0.1, million: 0.1,
    b: 100, bn: 100, billion: 100,
  };

  const NUMBER_RE = /^([+-]?\d+(?:\.\d+)?)\s*(?:%|percent|per cent)?(?:\s*(cr|crore|crores|lakh|lakhs|k|thousand|m|mn|million|b|bn|billion))?/i;
  const BETWEEN_RE = /\b([^,;]+?)\s+between\s+(\S+)\s+and\s+(\S+)(?=$|\s+and\b|\s+or\b|,|;)/gi;

  function flattenVariables(ontology) {
    const out = [];
    for (const group of Object.values(ontology.variables)) out.push(...group);
    return out;
  }

  function buildLookup(ontology) {
    const pairs = [];
    for (const v of flattenVariables(ontology)) {
      const canonical = v.name;
      pairs.push([canonical.toLowerCase(), canonical]);
      for (const syn of v.synonyms || []) pairs.push([syn.toLowerCase(), canonical]);
    }
    pairs.sort((a, b) => b[0].length - a[0].length);
    return pairs;
  }

  function normaliseNumber(match) {
    let value = parseFloat(match[1]);
    const unit = match[2] && match[2].toLowerCase();
    if (unit && MULTIPLIERS[unit] != null) value *= MULTIPLIERS[unit];
    if (Number.isInteger(value)) return String(value);
    return String(value).replace(/\.?0+$/, "");
  }

  function findVariable(fragment, lookup) {
    const lowered = fragment.toLowerCase();
    for (const [pattern, canonical] of lookup) {
      if (lowered.startsWith(pattern)) return [canonical, pattern.length];
    }
    return null;
  }

  function findComparator(fragment) {
    const trimmedLeft = fragment.replace(/^\s+/, "");
    const offset = fragment.length - trimmedLeft.length;
    const lowered = trimmedLeft.toLowerCase();
    for (const [op, phrases] of COMPARATORS) {
      for (const phrase of phrases) {
        if (lowered.startsWith(phrase)) return [op, offset + phrase.length];
      }
    }
    return null;
  }

  function expandBetween(text) {
    return text.replace(BETWEEN_RE, (_m, v, lo, hi) => `${v.trim()} >= ${lo} and ${v.trim()} <= ${hi}`);
  }

  function splitClauses(text) {
    let t = expandBetween(text);
    t = t.replace(/\s*[;,]\s*/g, " and ");
    const pieces = t.split(/\b(and|or)\b/i);
    const clauses = [];
    let joiner = "";
    for (const raw of pieces) {
      const token = raw.trim();
      if (!token) continue;
      const upper = token.toUpperCase();
      if (upper === "AND" || upper === "OR") {
        joiner = upper;
      } else {
        clauses.push([joiner, token]);
        joiner = "AND";
      }
    }
    return clauses;
  }

  function parseClause(clause, lookup) {
    const hit = findVariable(clause, lookup);
    if (!hit) return null;
    const [varName, end] = hit;
    const rest = clause.slice(end).trim();

    const comp = findComparator(rest);
    if (!comp) return null;
    const [op, cend] = comp;
    const tail = rest.slice(cend).trim();

    const rhsVar = findVariable(tail, lookup);
    if (rhsVar) return `${varName} ${op} ${rhsVar[0]}`;

    const numMatch = tail.match(NUMBER_RE);
    if (!numMatch) return null;
    return `${varName} ${op} ${normaliseNumber(numMatch)}`;
  }

  function translate(nl, ontology) {
    const lookup = buildLookup(ontology);
    const clauses = splitClauses(nl);
    const parsed = [];
    const warnings = [];
    for (const [joiner, clause] of clauses) {
      const r = parseClause(clause, lookup);
      if (r == null) {
        warnings.push(`could not parse: ${JSON.stringify(clause)}`);
        continue;
      }
      if (joiner && parsed.length) parsed.push(joiner);
      parsed.push(r);
    }
    return { query: parsed.join(" "), warnings };
  }

  function screenerUrl(query) {
    return "https://www.screener.in/screen/raw/?query=" + encodeURIComponent(query);
  }

  async function loadOntology(url) {
    const res = await fetch(url);
    if (!res.ok) throw new Error("failed to load ontology: " + res.status);
    return res.json();
  }

  // ---- Gemini fallback (BYOK) -----------------------------------------------
  // Only used when rule-based parse returns warnings AND user configured a key.
  // Never called during unit tests (they pass ontology directly to translate()).
  async function translateWithGemini(nl, ontology, { apiKey, model }) {
    const variableNames = [];
    for (const group of Object.values(ontology.variables)) {
      for (const v of group) variableNames.push(v.name);
    }
    const system = [
      "You translate an English stock-screening idea for Indian equities into a screener.in query.",
      "Return ONLY a JSON object {\"query\": \"...\"} — no prose, no code fences.",
      "The query must use ONLY these variable names (verbatim, case-sensitive):",
      variableNames.join(", "),
      "Operators: > < >= <= = AND OR ( )   RHS may be a number, another variable, or an arithmetic expression using + - * /.",
      "",
      "APPROXIMATE liberally — this is a discovery tool, not a legal filing:",
      "- 'small cap' → Market Capitalization < 5000    'mid cap' → 5000..20000    'large cap' → > 20000",
      "- 'profitable' → Net profit > 0                 'growing' → Sales growth > 10 AND Profit growth > 10",
      "- 'cheap' → Price to earning < 15               'quality' → Return on capital employed > 20 AND Debt to equity < 0.5",
      "- 'dividend aristocrat' / 'dividend payer' → Dividend yield > 2 AND Average dividend payout 3years > 20",
      "- 'fii buying / rising fii stake' → FII holding > 5 AND FII holding > FII holding    (use the QoQ variant if a preceding-period variable exists; otherwise absolute + increase heuristic)",
      "- 'strong momentum' → Current price > DMA 50 AND Current price > DMA 200",
      "- 'undervalued' → Price to earning < 15 AND Price to book value < 3",
      "- 'monopoly' / 'moat' → Return on capital employed > 25 AND OPM > 20 AND Debt to equity < 0.3",
      "",
      "Examples:",
      "input: 'profitable smallcaps growing fast' → {\"query\":\"Net profit > 0 AND Market Capitalization < 5000 AND Sales growth > 15 AND Profit growth > 15\"}",
      "input: 'debt-free compounders' → {\"query\":\"Debt to equity < 0.1 AND Average return on equity 5Years > 18 AND Profit growth 5Years > 12\"}",
      "input: 'stocks near 52w high with strong balance sheet' → {\"query\":\"Current price > 0.9 * High price AND Debt to equity < 0.5 AND Interest Coverage Ratio > 3\"}",
      "",
      "Only return {\"query\":\"\"} when the request is genuinely un-approximable (e.g. 'stocks with lots of insider buying today' — Screener has no insider-txn window).",
    ].join("\n");

    const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`;
    const res = await fetch(endpoint, {
      method: "POST",
      headers: { "content-type": "application/json", "x-goog-api-key": apiKey },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: system }] },
        contents: [{ role: "user", parts: [{ text: nl }] }],
        generationConfig: { responseMimeType: "application/json", temperature: 0 },
      }),
    });
    if (!res.ok) throw new Error(`gemini ${res.status}: ${await res.text()}`);
    const data = await res.json();
    const raw = data?.candidates?.[0]?.content?.parts?.[0]?.text || "";
    let parsed;
    try { parsed = JSON.parse(raw); } catch { throw new Error("gemini returned non-JSON: " + raw.slice(0, 200)); }
    const query = (parsed.query || "").trim();
    if (!query) return { query: "", warnings: ["gemini: could not express in ontology"] };

    // Guardrail: every LHS/RHS variable in the returned query must be in the ontology.
    const allowed = new Set(variableNames.map((n) => n.toLowerCase()));
    const tokens = query.split(/\bAND\b|\bOR\b|[()]/i).map((s) => s.trim()).filter(Boolean);
    const badVars = [];
    for (const clause of tokens) {
      const parts = clause.split(/>=|<=|>|<|=/).map((s) => s.trim()).filter(Boolean);
      for (const p of parts) {
        if (/^[-+*/\d.\s%()]+$/.test(p)) continue; // pure numeric expression
        const varHit = variableNames.find((n) => p.toLowerCase().includes(n.toLowerCase()));
        if (!varHit) badVars.push(p);
      }
    }
    if (badVars.length) {
      return { query: "", warnings: [`gemini emitted unknown variables: ${badVars.slice(0, 3).join(", ")}`] };
    }
    return { query, warnings: ["✨ gemini fallback used"] };
  }

  async function translateWithFallback(nl, ontology, { apiKey, model = "gemini-2.5-flash" } = {}) {
    const first = translate(nl, ontology);
    if (first.query && first.warnings.length === 0) return first;
    if (!apiKey) {
      // Rules failed AND no key set → signal to the UI that setup is required.
      return { query: first.query, warnings: first.warnings, needsSetup: true };
    }
    try {
      const fb = await translateWithGemini(nl, ontology, { apiKey, model });
      if (fb.query) return fb;
      return { query: first.query, warnings: [...first.warnings, ...fb.warnings] };
    } catch (err) {
      return { query: first.query, warnings: [...first.warnings, `gemini error: ${err.message}`] };
    }
  }

  const api = { translate, translateWithFallback, screenerUrl, loadOntology, buildLookup, splitClauses, parseClause };
  root.ScreenerNL = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})(typeof globalThis !== "undefined" ? globalThis : this);
