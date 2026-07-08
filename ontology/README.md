# Screener.in Ontology

A machine-readable inventory of the query language used at [screener.in](https://www.screener.in).
Compiled from Screener's official guides, custom-query examples, and public screens.

## Files
- `screener_ontology.json` — all variables, operators, functions, and NL phrase hints, grouped by category.

## Query grammar (informal)

```
query      := expression
expression := clause ( logical clause )*
clause     := "(" expression ")" | condition
condition  := lhs comparator rhs
lhs        := variable
rhs        := variable | number ("%")? | arithmetic
arithmetic := term (("+"|"-"|"*"|"/") term)*
term       := variable | number | "(" arithmetic ")" | function_call
logical    := "AND" | "OR"
comparator := ">" | "<" | ">=" | "<=" | "="
```

## Two dialects on Screener

1. **Screen query** — an inequality expression, e.g.
   `Market Capitalization > 30000 AND Return on capital employed > 22`

2. **Custom ratio** — a pure formula, e.g.
   `If(Debt to equity < 0.5, 1, 0) + If(Sales growth 3Years > 15, 1, 0)`

The ontology JSON supports both; the translators (`nl2screener/` Python CLI and `extension/` Chrome extension) target **screen queries** by default.

## Functions (custom ratios only)

`If`, `power`, `least`, `abs`, `sqrt`, `log`, `coalesce`

## Sources
- https://www.screener.in/guides/creating-screens/
- https://support.screener.in/article/32-how-to-create-custom-ratios-in-screener
- https://blog.screener.in/post/175772798885/creating-custom-ratios-in-screener
- Public screens: `/135572`, `/298537`, `/428630`, `/1831601`, `/219394`, `/447`, `/27561`, `/137811`, `/406204`, `/131217`, `/1556145`, `/286416`
