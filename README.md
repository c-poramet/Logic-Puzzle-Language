# Logic Puzzle Language

Logic Puzzle Language (LPL) is a no-build browser tool for exploring Knights-and-Knaves-style puzzles and their variants. It follows the local, explicit-update workflow of GridPuzzleSolver: open `index.html`, edit the program, and press **Update now** or `Ctrl/⌘ Enter`.

## Current language

The first engine slice supports:

```lpl
SETUP
stater Aimee Bob Calvin
type alpha beta gamma

STATEMENTS
A : A == beta
B : A == alpha
C : A == beta or A == gamma
>find type All
```

`alpha` statements must evaluate true, `beta` statements must evaluate false, and `gamma` statements may evaluate either way. When the number of staters equals the number of types, LPL applies the common exact-one-of-each rule. Names can use a unique initial prefix, and `self` refers to the statement's subject.

The result panel shows the surviving worlds, staged command results, and an assignment table. Source and editor state are local to the browser; no server is required.

## Architecture status

The engine is being expanded underneath this syntax rather than replaced. The current parser now exposes an additive normalized model with finite-domain stater variables, domain maps, statement lookup, context slots, diagnostics, and an internal exact-one-of-each constraint. The existing exhaustive solver and result shape remain the compatibility path while propagation and broader constraints are added.

Three-valued operations are centralized for the next solver stages:

| Operation | Result behavior |
|---|---|
| `true and unknown` | `unknown` |
| `false and unknown` | `false` |
| `false or unknown` | `unknown` |
| `true or unknown` | `true` |
| `false implies unknown` | `true` |
| `true implies unknown` | `unknown` |

The normalized model and constraint helpers are additive implementation APIs; they are not yet additional source syntax.

Finite-domain variables are now supported in `SETUP`:

```lpl
var thief in {Aimee, Bob, Calvin}
```

They can be compared from statements, and their possible values are included in each surviving world. A variable that has not been assigned during partial search evaluates as `unknown`, never as its source name.

Explicit cardinality rules are also supported:

```lpl
exactly 1 of A B C == alpha
atleast 2 of A B C == gamma
atmost 1 of A B C == beta
```

The rule is checked against every candidate world and also participates in a first domain-propagation pass. The solver still keeps exhaustive search as a correctness fallback, while reporting propagation rounds and reductions in its result metadata.

Statements also support three-valued negation, implication, and iff:

```lpl
A : not (A == beta)
B : A == alpha => B == beta
C : A == alpha <=> B == beta
```

Finite contexts and named groups are supported for ordered or cyclic cases:

```lpl
case DAY Sun Mon Tue ... wrap
group L_days = {Mon, Tue, Wed}

STATEMENTS
Lion : DAY - 1 == L_days
```

`wrap` makes offsets circular. Context groups can drive declarative assignments:

```lpl
if L_days then
	Lion := beta
	Unicorn := alpha
else
	Lion, Unicorn := alpha, beta
end
```

The first matching branch applies to each complete world. Richer `on` statements and arbitrary procedural expressions remain future syntax.

Question blocks can constrain a proposition to allowed answers:

```lpl
? : A == alpha
	_ : positive
	_ 1: blank
```

`positive`, `negative`, and `blank` correspond to true, false, and unknown. Questions do not impose an alpha/beta type rule on their `?` subject.

Entity variables can be connected to the truth of the matching stater statement:

```lpl
var thief in {Aimee, Bob, Calvin}
rule thief made a false statement
```

This makes the muffin puzzle’s “the thief lied” condition executable. The rule requires the assigned entity to have at least one matching statement with the requested truth value.

Types can define context-dependent truth policies:

```lpl
type diurnal nocturnal
case WAKE awake asleep

policy diurnal:
	awake => true
	asleep => false

policy nocturnal:
	awake => false
	asleep => true
```

Policy types use the assigned finite context value to determine whether their statements must be true or false. This supports the diurnal/nocturnal example from the design.

Statements can be numbered and referenced conditionally:

```lpl
1: A == alpha
B : if 1: then A == beta
```

An anonymous statement can use `_` as its subject and/or a hole expression. Anonymous statements are evaluated for value but do not inherit an alpha/beta type restriction yet.

When candidate worlds are rejected, the result panel can expand **Why worlds were rejected** to show the constraint category, source line, and concise reason. Explanations are bounded so large searches do not overwhelm the browser.

The solver now checks cardinality feasibility during search, orders variables by smallest remaining domain first, and reports branch statistics such as visited nodes and complete leaves. The exhaustive search fallback remains in place for correctness.

Propagation also checks stater statements against their finite domains. A type is removed before search when no compatible completion can make that statement satisfy its alpha/beta rule; larger expression supports are skipped when their local completion space exceeds the bounded propagation budget.

## Commands

- `>find type All` lists surviving type assignments.
- `>find value All` is accepted as the value-query spelling for the same possibility set.
- `>try Aimee := alpha` tests a proposed type against the surviving worlds.

## Translator prompt

[docs/lpl-translator-prompt.md](docs/lpl-translator-prompt.md) is a strict prompt for translating plain-language puzzles into the currently supported LPL subset. It requires the translator to return executable LPL, assumptions, unsupported requirements, and validation notes instead of inventing future syntax.

## Expansion roadmap

The next implementation layers are general finite-domain variables, cardinality constraints, propagation/search, case and time contexts, statement references, blank-statement synthesis, and source-linked explanations. Planned syntax is documented as unsupported until its parser, solver, tests, and editor support exist.

## Development

Run the dependency-free tests with:

```sh
node tests/run.js
```

Temporal cases, `case`/`group` declarations, question blocks, partial brute-force statements, and richer unknown propagation are not implemented yet. The parser, normalized model, constraint helpers, and evaluator are kept separate so those additions can extend the current browser-first architecture without changing the UI contract.
