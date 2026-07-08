#!/usr/bin/env python3
"""
nl2screener — turn plain English into a screener.in custom-screen query.

Usage:
    python nl2screener.py "market cap over 5000 crore, roe above 20 and debt to equity under 0.5"
    python nl2screener.py --url "roce > 20 and promoter holding > 50"
"""
from __future__ import annotations

import argparse
import json
import re
import sys
import urllib.parse
from pathlib import Path
from typing import Iterable

ONTOLOGY_PATH = Path(__file__).resolve().parent.parent / "ontology" / "screener_ontology.json"


def load_ontology(path: Path = ONTOLOGY_PATH) -> dict:
    with path.open() as fh:
        return json.load(fh)


def _flatten_variables(ontology: dict) -> list[dict]:
    out = []
    for group in ontology["variables"].values():
        out.extend(group)
    return out


def _build_lookup(ontology: dict) -> list[tuple[str, str]]:
    pairs: list[tuple[str, str]] = []
    for v in _flatten_variables(ontology):
        canonical = v["name"]
        pairs.append((canonical.lower(), canonical))
        for syn in v.get("synonyms", []):
            pairs.append((syn.lower(), canonical))
    pairs.sort(key=lambda p: -len(p[0]))
    return pairs


COMPARATORS = [
    (">=", ["at least", "no less than", "minimum of", ">="]),
    ("<=", ["at most", "no more than", "maximum of", "<="]),
    (">", ["greater than", "more than", "higher than", "above", "over", "exceeds", "exceeding", ">"]),
    ("<", ["less than", "lower than", "below", "under", "<"]),
    ("=", ["equal to", "equals", "exactly", "="]),
]

NUMBER_RE = re.compile(
    r"([+-]?\d+(?:\.\d+)?)"
    r"\s*(%|percent|per cent)?"
    r"(?:\s*(cr|crore|crores|lakh|lakhs|k|thousand|m|mn|million|b|bn|billion))?",
    re.IGNORECASE,
)

MULTIPLIERS = {
    "cr": 1, "crore": 1, "crores": 1,
    "lakh": 0.01, "lakhs": 0.01,
    "k": 1e-5, "thousand": 1e-5,
    "m": 0.1, "mn": 0.1, "million": 0.1,
    "b": 100, "bn": 100, "billion": 100,
}


def _normalise_number(match: re.Match) -> str:
    raw, _pct, unit = match.group(1), match.group(2), match.group(3)
    value = float(raw)
    if unit:
        value *= MULTIPLIERS.get(unit.lower(), 1)
    if value.is_integer():
        return str(int(value))
    return ("%f" % value).rstrip("0").rstrip(".")


def _find_variable(fragment: str, lookup: Iterable[tuple[str, str]]) -> tuple[str, int] | None:
    lowered = fragment.lower()
    for pattern, canonical in lookup:
        if lowered.startswith(pattern):
            return canonical, len(pattern)
    return None


def _find_comparator(fragment: str) -> tuple[str, int] | None:
    lowered = fragment.lower().lstrip()
    offset = len(fragment) - len(fragment.lstrip())
    for op, phrases in COMPARATORS:
        for phrase in phrases:
            if lowered.startswith(phrase):
                return op, offset + len(phrase)
    return None


BETWEEN_RE = re.compile(
    r"\b(?P<var>[^,;]+?)\s+between\s+(?P<lo>\S+)\s+and\s+(?P<hi>\S+)(?=$|\s+and\b|\s+or\b|,|;)",
    re.IGNORECASE,
)


def _expand_between(text: str) -> str:
    def sub(m: re.Match) -> str:
        v = m.group("var").strip()
        return f"{v} >= {m.group('lo')} and {v} <= {m.group('hi')}"
    return BETWEEN_RE.sub(sub, text)


def _split_clauses(text: str) -> list[tuple[str, str]]:
    text = _expand_between(text)
    text = re.sub(r"\s*[;,]\s*", " and ", text)
    pieces = re.split(r"\b(and|or)\b", text, flags=re.IGNORECASE)
    clauses: list[tuple[str, str]] = []
    joiner = ""
    for token in pieces:
        token = token.strip()
        if not token:
            continue
        if token.lower() in {"and", "or"}:
            joiner = token.upper()
        else:
            clauses.append((joiner, token))
            joiner = "AND"
    return clauses


def _parse_clause(clause: str, lookup: list[tuple[str, str]]) -> str | None:
    hit = _find_variable(clause, lookup)
    if not hit:
        return None
    var_name, end = hit
    rest = clause[end:].strip()

    comp = _find_comparator(rest)
    if not comp:
        return None
    op, cend = comp
    tail = rest[cend:].strip()

    rhs_var = _find_variable(tail, lookup)
    if rhs_var:
        return f"{var_name} {op} {rhs_var[0]}"

    num_match = NUMBER_RE.match(tail)
    if not num_match:
        return None
    value = _normalise_number(num_match)
    return f"{var_name} {op} {value}"


def translate(nl: str, ontology: dict | None = None) -> dict:
    ontology = ontology or load_ontology()
    lookup = _build_lookup(ontology)
    clauses = _split_clauses(nl)

    parsed: list[str] = []
    warnings: list[str] = []
    for joiner, clause in clauses:
        result = _parse_clause(clause, lookup)
        if result is None:
            warnings.append(f"could not parse: {clause!r}")
            continue
        if joiner and parsed:
            parsed.append(joiner)
        parsed.append(result)

    query = " ".join(parsed)
    return {"query": query, "warnings": warnings}


def screener_url(query: str) -> str:
    return "https://www.screener.in/screen/raw/?query=" + urllib.parse.quote(query)


def main() -> int:
    ap = argparse.ArgumentParser(description="Translate plain English into a screener.in query")
    ap.add_argument("text", nargs="+")
    ap.add_argument("--url", action="store_true")
    ap.add_argument("--json", action="store_true")
    args = ap.parse_args()

    nl = " ".join(args.text)
    result = translate(nl)

    if args.json:
        payload = dict(result)
        if args.url and result["query"]:
            payload["url"] = screener_url(result["query"])
        print(json.dumps(payload, indent=2))
        return 0 if result["query"] else 1

    if not result["query"]:
        print("could not translate input", file=sys.stderr)
        for w in result["warnings"]:
            print(f"  - {w}", file=sys.stderr)
        return 1

    print(result["query"])
    if args.url:
        print(screener_url(result["query"]))
    for w in result["warnings"]:
        print(f"# warn: {w}", file=sys.stderr)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
