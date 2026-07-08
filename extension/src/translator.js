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

  const api = { translate, screenerUrl, loadOntology, buildLookup, splitClauses, parseClause };
  root.ScreenerNL = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})(typeof globalThis !== "undefined" ? globalThis : this);
