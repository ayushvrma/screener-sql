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

  // ---- LLM fallback (BYOK, provider-agnostic) -------------------------------
  // Rule-based runs first; if it produces warnings and the user has a key
  // saved, we call the selected provider through the registry in providers.js.

  const MAX_INPUT_CHARS = 2000; // caps prompt size (also blunts prompt-injection amplification)

  function buildSystemPrompt(ontology) {
    const variableNames = [];
    for (const group of Object.values(ontology.variables)) {
      for (const v of group) variableNames.push(v.name);
    }
    return [
      "You translate an English stock-screening idea for Indian equities into a screener.in query.",
      "The query must use ONLY these variable names (verbatim, case-sensitive):",
      variableNames.join(", "),
      "Operators: > < >= <= = AND OR ( ) . RHS may be a number, another variable, or an arithmetic expression using + - * /.",
      "",
      "APPROXIMATE liberally — this is a discovery tool, not a legal filing:",
      "- 'small cap' → Market Capitalization < 5000    'mid cap' → 5000..20000    'large cap' → > 20000",
      "- 'profitable' → Net profit > 0                 'growing' → Sales growth > 10 AND Profit growth > 10",
      "- 'cheap' → Price to earning < 15               'quality' → Return on capital employed > 20 AND Debt to equity < 0.5",
      "- 'dividend aristocrat' / 'dividend payer' → Dividend yield > 2 AND Average dividend payout 3years > 20",
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
  }

  function guardrail(query, ontology) {
    const variableNames = [];
    for (const group of Object.values(ontology.variables)) {
      for (const v of group) variableNames.push(v.name);
    }
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
    return badVars;
  }

  async function translateWithLLM(nl, ontology, { providerId, apiKey, model }) {
    if (!ScreenerNLProviders) throw new Error("providers.js not loaded");
    const provider = ScreenerNLProviders.getProvider(providerId);
    if (!provider) throw new Error(`unknown provider: ${providerId}`);
    const modelToUse = model || provider.defaultModel;

    const raw = await ScreenerNLProviders.callProvider({
      providerId, apiKey, model: modelToUse,
      system: buildSystemPrompt(ontology),
      user: nl.slice(0, MAX_INPUT_CHARS),
    });

    let parsed;
    try { parsed = JSON.parse(raw); }
    catch {
      // Some providers wrap JSON in markdown fences even when told not to. Salvage.
      const m = raw.match(/\{[\s\S]*\}/);
      if (!m) throw new Error(`${provider.name} returned non-JSON: ${raw.slice(0, 200)}`);
      parsed = JSON.parse(m[0]);
    }
    const query = (parsed.query || "").trim();
    const badge = `✨ ${provider.name.toLowerCase()} used`;
    if (!query) return { query: "", warnings: [`${provider.name}: could not express in ontology`] };
    const badVars = guardrail(query, ontology);
    if (badVars.length) {
      return { query: "", warnings: [`${provider.name} emitted unknown variables: ${badVars.slice(0, 3).join(", ")}`] };
    }
    return { query, warnings: [badge] };
  }

  async function translateWithFallback(nl, ontology, settings = {}) {
    const first = translate(nl, ontology);
    if (first.query && first.warnings.length === 0) return first;

    const { providerId, apiKey, model } = settings;
    if (!apiKey || !providerId) {
      return { query: first.query, warnings: first.warnings, needsSetup: true };
    }
    if (nl.length > MAX_INPUT_CHARS) {
      return {
        query: first.query,
        warnings: [...first.warnings, `input truncated at ${MAX_INPUT_CHARS} chars before calling LLM`],
      };
    }
    try {
      const fb = await translateWithLLM(nl, ontology, { providerId, apiKey, model });
      if (fb.query) return fb;
      return { query: first.query, warnings: [...first.warnings, ...fb.warnings] };
    } catch (err) {
      const msg = err && err.message ? err.message : String(err);
      return { query: first.query, warnings: [...first.warnings, `llm error: ${msg}`] };
    }
  }

  const api = { translate, translateWithFallback, screenerUrl, loadOntology, buildLookup, splitClauses, parseClause, MAX_INPUT_CHARS };
  root.ScreenerNL = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})(typeof globalThis !== "undefined" ? globalThis : this);
