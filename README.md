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

## Commands

- `>find type All` lists surviving type assignments.
- `>find value All` is accepted as the value-query spelling for the same possibility set.
- `>try Aimee := alpha` tests a proposed type against the surviving worlds.

## Development

Run the dependency-free tests with:

```sh
node tests/run.js
```

Temporal cases, `case`/`group` declarations, question blocks, partial brute-force statements, and richer unknown propagation are the next language layers. The parser and evaluator are kept separate so those additions can extend the current browser-first architecture without changing the UI contract.
