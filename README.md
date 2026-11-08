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
