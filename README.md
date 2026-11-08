# Logic Puzzle Language

Logic Puzzle Language (LPL) is a no-build browser tool for exploring Knights-and-Knaves-style puzzles and their variants. It follows the local, explicit-update workflow of GridPuzzleSolver: open `index.html`, edit the program, and press **Update now** or `Ctrl/⌘ Enter`.

## Translate by intuition

The easiest way to translate a puzzle is to separate its facts into four questions:

1. **Who are the people making statements?** Declare them as `stater`s.
2. **What kind of person can each one be?** Declare the available `type`s.
3. **What objects, roles, or shared conditions need their own values?** Declare them with `var` or `case`.
4. **What does each person say?** Write one expression after that person's colon.

LPL does not require you to encode the story in one large formula. Give every named thing a small finite domain, then write the statements as direct comparisons. The solver searches the resulting possibility space and keeps only worlds in which every statement is compatible with its speaker's type.

### The translation dictionary

| Plain-language idea | Short LPL form | Explicit LPL form | Meaning |
|---|---|---|---|
| People who make statements | `stater A B` | `stater Aimee Bob` | Declares the statement subjects. |
| Possible kinds | `type alpha beta` | `type truthful liar` | Gives every stater the same type domain. |
| A person is a type | `self == beta` | `Aimee == liar` | `self` means the current statement subject. |
| A person says a proposition | `A : A == beta` | `Aimee : Aimee == liar` | The expression after `:` is the statement content. |
| A named finite choice | `var thief in {A, B}` | `var thief in {Aimee, Bob}` | The variable's value is one declared choice. |
| A shared finite condition | `case state awake asleep` | `case meeting_state awake asleep` | One assignment is shared wherever the case is referenced. |
| Exactly one of each declared type | implicit when counts match | `type alpha beta` with two staters | This is the compatibility default. |
| Repeated types allowed | `types may repeat` | `types may repeat` | Use when both people may have the same type. |
| Ask for a stater's type | `>find type A` | `>find type Aimee` | Lists possible type values for that stater. |
| Ask for a finite variable | `>find value thief` | `>find value meeting_state` | Lists possible values in surviving worlds. |

Short forms are readability conveniences, not different logic. Prefer full names while translating, then use `self` or a unique prefix when the meaning remains obvious. For example, `Aimee : self == beta` and `Aimee : Aimee == beta` mean the same thing.

### Defaults: types, elements, and values

LPL has a few built-in semantic conventions, but it does not invent the people, types, objects, or context values in your story. You must declare those explicitly.

#### Built-in type meanings

The names `alpha`, `beta`, and `gamma` have default truth behavior:

| Type | Required statement result | Intuition |
|---|---|---|
| `alpha` | `true` | Truthful in the current evaluation context. |
| `beta` | `false` | Lying in the current evaluation context. |
| `gamma` | `true` or `false` | Unrestricted or ordinary. |

These are semantic names, not automatically declared types. This program uses them:

```lpl
SETUP
stater Aimee Bob
type alpha beta

STATEMENTS
Aimee : self == beta
Bob : self == alpha
```

This program does not use them:

```lpl
SETUP
stater Aimee Bob
type truthful liar

STATEMENTS
Aimee : self == liar
Bob : self == truthful
```

`truthful` and `liar` are ordinary custom type names here. They do not automatically mean true and false. To give custom names truth behavior, either use `alpha` and `beta`, or define a context policy when the behavior depends on a case:

```lpl
SETUP
stater Aimee Bob
type truthful liar
case situation ordinary

policy truthful:
	ordinary => true

policy liar:
	ordinary => false

STATEMENTS
Aimee : self == liar
Bob : self == truthful
```

A type policy takes precedence over the ordinary `alpha`/`beta`/`gamma` fallback for that type. Policy values are looked up from declared `case` values. If a custom type has no policy, its statements are unrestricted like `gamma`; the engine does not infer meaning from the English name.

#### Default type distribution

When the number of declared staters equals the number of declared types, LPL assumes one stater receives each type. For example:

```lpl
SETUP
stater Aimee Bob Calvin
type alpha beta gamma
```

means the search considers permutations such as:

| Aimee | Bob | Calvin |
|---|---|---|
| `alpha` | `beta` | `gamma` |
| `beta` | `gamma` | `alpha` |
| `gamma` | `alpha` | `beta` |

It does not consider `alpha, alpha, beta` or `gamma, gamma, gamma` in that default mode. This is a distribution rule, separate from the meaning of the types.

If the story only says that every person is one of the listed types and allows several people to share a type, write:

```lpl
SETUP
stater Ork Bork
type diurnal nocturnal
types may repeat
```

Now `diurnal, diurnal`, `diurnal, nocturnal`, `nocturnal, diurnal`, and `nocturnal, nocturnal` are all possible until the statements remove some of them. Use this whenever the source does not explicitly say “one of each,” “exactly one,” or an equivalent distribution.

#### What is and is not automatically declared

| Element | Default behavior | What to write |
|---|---|---|
| Stater/person | None are created automatically. | `stater Aimee Bob` |
| Type | No type list is assumed. | `type alpha beta` |
| `alpha`, `beta`, `gamma` | Have built-in truth meanings only when declared in `type`. | `type alpha beta gamma` |
| Custom type | Has no inferred truth meaning. Without a policy, it is unrestricted. | `type diurnal nocturnal` plus policies when needed |
| Stater domain | Every stater receives one declared type. | Declare the type list with `type`. |
| Finite variable | No variable exists until declared. | `var thief in {Aimee, Bob}` |
| Variable domain | Contains exactly the listed values; no values are added. | `var role in {thief, witness}` |
| Case/context | No context exists until declared. | `case state awake asleep` |
| Case domain | Contains exactly the listed context values, including expanded values such as weekdays. | `case day Mon Tue Wed` |
| `self` | Resolves to the current statement subject. | `Aimee : self == beta` |
| Unknown | Appears during partial search or for an unresolved question; it is not a type. | `? : Aimee == alpha` with `_ : blank` |
| Command target `All` | Means show the full surviving possibility space. | `>find type All` |

There is no default “awake,” “asleep,” “truthful,” “liar,” “witch doctor,” or “ordinary” value. Those are story concepts and must be represented with declared types, variables, cases, groups, or policies.

#### Default expression behavior

Expressions are evaluated against a complete candidate world. The logical operators use three-valued behavior while the solver is still building a world:

| Expression | Result |
|---|---|
| `true and unknown` | `unknown` |
| `false and unknown` | `false` |
| `true or unknown` | `true` |
| `false or unknown` | `unknown` |
| `false => unknown` | `true` |
| `true => unknown` | `unknown` |
| `not unknown` | `unknown` |

At a completed world, a stater's expression must match its type's required truth result. `unknown` therefore means “not determined yet,” not “the statement may remain unknown forever.” A question can explicitly allow `blank`; an ordinary alpha or beta statement cannot use unknown as a completed answer.

### 1. Start with the smallest puzzle

Plain language:

> Aimee, Bob, and Calvin are one truthful person, one liar, and one person who may say either truth or falsehood. Aimee says, “I am a liar.” Bob says, “Aimee is truthful.” Calvin says, “Aimee is a liar or may be either kind.”

Short form:

```lpl
SETUP
stater Aimee Bob Calvin
type alpha beta gamma

STATEMENTS
Aimee : self == beta
Bob : Aimee == alpha
Calvin : Aimee == beta or Aimee == gamma

>find type All
```

Long form:

```lpl
SETUP
stater Aimee Bob Calvin
type alpha beta gamma

STATEMENTS
Aimee : Aimee == beta
Bob : Aimee == alpha
Calvin : (Aimee == beta) or (Aimee == gamma)

>find type Aimee
>find type Bob
>find type Calvin
```

Here `alpha` means the statement must be true, `beta` means it must be false, and `gamma` imposes no truth requirement. Because there are three staters and three types, the default rule assigns exactly one stater to each type.

### 2. Translate comparisons directly

| Plain language | Short form | Long form |
|---|---|---|
| “I am a liar.” | `self == beta` | `Aimee == beta` |
| “Bob is truthful.” | `Bob == alpha` | `Bob == alpha` |
| “I am not a liar.” | `not (self == beta)` | `not (Aimee == beta)` |
| “Bob is a liar or normal.” | `Bob == beta or Bob == gamma` | `(Bob == beta) or (Bob == gamma)` |
| “Bob is not a liar.” | `Bob != beta` | `Bob != beta` |

Use the type names from the puzzle consistently. If the story calls the types `diurnal` and `nocturnal`, do not rename them to `alpha` and `beta` unless you explicitly want those names in the program.

### 3. Use parentheses for the story's grouping

Translate “if P, then Q” with `=>`, and translate “P if and only if Q” with `<=>`.

| Plain language | LPL |
|---|---|
| If Aimee is truthful, Bob is a liar. | `Aimee == alpha => Bob == beta` |
| Aimee is truthful if and only if Bob is a liar. | `Aimee == alpha <=> Bob == beta` |
| If Aimee is truthful and Bob is a liar, Calvin is truthful. | `(Aimee == alpha and Bob == beta) => Calvin == alpha` |
| Aimee is truthful or Bob is a liar, and Calvin is truthful. | `((Aimee == alpha) or (Bob == beta)) and Calvin == alpha` |

When a condition contains `and` or `or`, parenthesize it before attaching `=>` or `<=>`. This keeps the program visibly aligned with the English sentence and avoids relying on precedence when the sentence is dense.

### 4. Model roles and objects as finite variables

A role is usually not a stater type. If exactly one person is the witch doctor, make the variable's value the person who holds that role:

```lpl
SETUP
stater Ork Bork
type diurnal nocturnal
types may repeat
var witchdoctor in {Ork, Bork}

STATEMENTS
Ork : witchdoctor == self
Bork : witchdoctor == self

>find value witchdoctor
```

| Plain language | Short form | Long form |
|---|---|---|
| “I am the witch doctor.” | `witchdoctor == self` | `witchdoctor == Ork` |
| “The thief is Aimee.” | `thief == self` | `thief == Aimee` |
| “The person assigned to thief lied.” | `rule thief made a false statement` | Same rule, with `var thief in {...}` declared first. |

Use `types may repeat` when the source says everyone is one of the listed types but does not say one person has each type. Without it, two staters and two types activate the default one-of-each rule.

### 5. Model a shared condition once

If the story says two people were both in one of two conditions, declare one `case` rather than one variable per person:

```lpl
SETUP
stater Ork Bork
type diurnal nocturnal
types may repeat
var witchdoctor in {Ork, Bork}
case state awake asleep

policy diurnal:
	awake => true
	asleep => false

policy nocturnal:
	awake => false
	asleep => true

STATEMENTS
Ork : (self == diurnal and state == awake) => witchdoctor == self
Bork : ((self == diurnal and state == awake) or (self == nocturnal and state == asleep)) => witchdoctor == self

>find type Ork
>find type Bork
>find value witchdoctor
>find value state
```

The commands return:

| Query | Answer |
|---|---|
| `>find type Ork` | `nocturnal` |
| `>find type Bork` | `nocturnal` |
| `>find value witchdoctor` | `Bork` |
| `>find value state` | `asleep` |

The `policy` entries say whether a type's statement must be true in each case value. The case name and values are ordinary identifiers: `state`, `awake`, and `asleep` are not hard-coded engine keywords.

### 6. Add counting rules only when the story says to count

Do not infer counting from the number of declarations unless the language's default one-of-each rule applies. For an explicit rule, use a cardinality statement:

```lpl
SETUP
stater Aimee Bob Calvin
type alpha beta gamma
exactly 2 of Aimee Bob Calvin == alpha
atleast 1 of Aimee Bob Calvin == beta
atmost 1 of Aimee Bob Calvin == gamma

STATEMENTS
Aimee : self == alpha
Bob : self == alpha
Calvin : self == beta
```

| English phrase | LPL form |
|---|---|
| Exactly two people are truthful. | `exactly 2 of Aimee Bob == alpha` |
| At least one person is a liar. | `atleast 1 of Aimee Bob == beta` |
| At most one person is normal. | `atmost 1 of Aimee Bob == gamma` |

### 7. Use contexts for ordered or cyclic facts

For days, positions, rounds, or other ordered values, use `case`. Add `wrap` only when the order is circular:

```lpl
SETUP
stater Lion Unicorn
type alpha beta
case day Mon Tue Wed Thu Fri Sat Sun wrap
group workdays = {Mon, Tue, Wed, Thu, Fri}

STATEMENTS
Lion : day - 1 == workdays
Unicorn : on Sun Lion == beta

>find value day
```

| Plain language | LPL |
|---|---|
| “The day is one before Monday.” | `day - 1 == Mon` |
| “The previous day is a workday.” | `day - 1 == workdays` |
| “On Sunday, Lion says Bob is a liar.” | `on Sun Lion == beta` |
| “The day is Monday, Tuesday, or Wednesday.” | `day == workdays` with `group workdays = {Mon, Tue, Wed}` |

### 8. Translate questions and unknowns carefully

Use a question block when the puzzle explicitly allows positive, negative, or unknown answers:

```lpl
SETUP
stater Aimee
type alpha beta

STATEMENTS
? : Aimee == alpha
	_ : positive
	_ : blank

>find type All
```

`positive` means true, `negative` means false, and `blank` means the expression is still unknown in a partial world. An unknown result is not the same as zero surviving worlds: zero worlds means the rules contradict one another.

### 9. Finish with answer commands

Use broad commands while developing and targeted commands when the puzzle asks specific questions:

| Command | Use it for |
|---|---|
| `>find type All` | Show every surviving stater assignment. |
| `>find value All` | Show every surviving finite-variable and context assignment. |
| `>find type Aimee` | Ask for Aimee's possible types. |
| `>find value thief` | Ask who can be the thief. |
| `>find value state` | Ask which shared condition survives. |
| `>find value 1:` | Ask whether numbered statement 1 is true, false, or unknown. |
| `>try Aimee := alpha` | Test one proposed assignment. |

Translate first, query second. If a targeted query returns multiple values, the puzzle has not determined that answer. If it returns no values, inspect the explanations and the premises for a contradiction.

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

Statements can be evaluated in a shifted context:

```lpl
L : L == beta on DAY - 1
```

The inner proposition is evaluated with `DAY` shifted before rules and comparisons are applied. Wrapped contexts support both positive and negative offsets.

Prefix guards can restrict a statement to one or more context values:

```lpl
L : on Sunday L == beta
_ : on {Sun, Sat} L == beta
```

Outside the guard, the proposition evaluates as `unknown`. Full weekday names and their abbreviated case values are equivalent.

Statements can be numbered and referenced conditionally:

```lpl
1: A == alpha
B : if 1: then A == beta
```

An anonymous statement can use `_` as its subject and/or a hole expression. Anonymous statements are evaluated for value but do not inherit an alpha/beta type restriction yet.

When candidate worlds are rejected, the result panel can expand **Why worlds were rejected** to show the constraint category, source line, and concise reason. Explanations are bounded so large searches do not overwhelm the browser.

The solver now checks cardinality feasibility during search, orders variables by smallest remaining domain first, and reports branch statistics such as visited nodes and complete leaves. The exhaustive search fallback remains in place for correctness.

Propagation also checks stater statements against their finite domains. A type is removed before search when no compatible completion can make that statement satisfy its alpha/beta rule; larger expression supports are skipped when their local completion space exceeds the bounded propagation budget.

Queries can focus the result on a particular variable or context:

```lpl
>find value thief
>solve DAY
```

The result shows possible values and values eliminated from the surviving worlds. `All` keeps the full-world listing and assignment table.

Statement truth values are queryable by numeric ID:

```lpl
>find value 1:
```

The result reports `true`, `false`, and `unknown` as separate possible values.

Explicit polarity queries are also accepted:

```lpl
>find possible DAY
>find impossible thief
```

One subject can provide multiple statements separated by top-level colons:

```lpl
_ : A == alpha : A == beta
```

Each expression receives its own generated statement ID. Colons inside `if 1: then ...` references are preserved.

Statement IDs can also be written after an anonymous subject, and `-:` refers to the previous statement:

```lpl
_ 1: A == alpha
_ : if -: then A == beta
```

Blank comparison statements can be synthesized with a bounded brute-force query:

```lpl
1: _
>solve 1: brute
```

The current synthesis explores single `==` and `!=` comparisons plus bounded `not`, `and`, and `or` expressions over declared variables, `self`, and declared values.

## Generate statements

LPL can search for several statements that satisfy requirements about the resulting possibility space. Role truth behavior is explicit, so names such as `god` and `knave` do not acquire special meaning accidentally:

```lpl
SETUP
stater A B
type god knight demon knave
types may repeat
role god is truthful
policy knight says true
role demon is lying
policy knave says false

GOALS
generate statements for A B
together leave exactly 2 possible god identities
each statement alone is insufficient
exactly 1 of A B is a god

SOLVE
>generate statements for A B
```

For compact boolean expressions, request Karnaugh-map-style minimization:

```lpl
>generate statements for A B using k-map
```

`--kmap` and `--method kmap` are accepted aliases. K-map mode builds a truth table from the surviving finite worlds, treats role states that allow either truth value as don't-care rows, and searches for short conjunctions that can be combined into a smaller `and`/`or` expression. It is still bounded; it is a minimization aid, not a proof-producing symbolic algebra system.

The generator searches a bounded set of comparisons and small boolean expressions. It keeps a pair only when the statements together satisfy the declared goals and each statement alone leaves the requested identity ambiguous. The result shows the statements, surviving worlds, possible identities, and the individual evidence for each statement.

Identity outcomes can be targeted directly:

```lpl
GOALS
generate statements for A B
exactly 1 of A B is a thief
A is definitely a thief
B remains unknown
```

`A is definitely a thief` requires every surviving world to assign `thief` to A. `B remains unknown` requires B to retain more than one possible type. These goals are evaluated after the generated statements are applied.

The equivalent role policy spellings are `role god is truthful`, `role demon is lying`, `policy god says true`, and `policy demon says false`. The existing context form, `policy type:` followed by context values, keeps its original meaning.

Generation is deliberately bounded and deterministic. Search limits prevent a large expression space from freezing the browser; when a limit is reached, the result is marked as truncated and is not a proof that no other statement exists. Existing `>solve <id>: brute` behavior remains available for one blank statement.

An optional setup threshold bounds enumeration:

```lpl
threshold = 10
```

When the limit is reached, the result reports `threshold reached` and is marked truncated. Possible-value queries over truncated results are lower bounds rather than exhaustive impossibility proofs.

To cap a particular solve run, put `--max N` immediately after `SOLVE`:

```lpl
SOLVE
--max 1000
>find type All
```

The solver explores worlds and statement-generation candidates until it has reached `N` results or until every explored search space has been exhausted. If it reaches the cap, the result is marked truncated; if it explores everything first, the result is complete. `--max` takes precedence over `threshold = N` for that run and raises the expression/tuple budget used by `>generate` as well.

## Guide: Find the Statements

Some logic puzzles do not give you the statements. They ask you to **invent statements with a particular effect**:

> Make exactly one of A and B a god, but keep it impossible to tell which one. Neither statement alone should reveal the answer.

This is a statement-synthesis puzzle. The important distinction is:

- An ordinary LPL program supplies statements and asks which worlds survive.
- A synthesis program supplies the desired surviving worlds and asks LPL to find statements.

### The translation recipe

Translate this kind of puzzle in five steps:

1. List the speakers with `stater`.
2. List every possible role with `type`.
3. Decide whether types may repeat. Add `types may repeat` unless the puzzle explicitly says there is exactly one of every type.
4. Describe which roles must tell the truth or lie.
5. Describe the desired result in `GOALS`.

The engine then creates possible worlds, tries bounded expressions, and keeps expressions whose truth values agree with the speaker roles and the requested goals.

### Worked example: the god puzzle

The puzzle says:

- A and B are unknown beings.
- Each may be a god, knight, demon, or knave.
- Gods and knights tell the truth.
- Demons and knaves lie.
- Exactly one of A and B is a god.
- Both statements together must leave A and B as possible god identities.
- Either statement alone must be insufficient.

The compact LPL version is:

```lpl
SETUP
stater A B
type god knight demon knave
types may repeat

GOALS
generate statements for A B
god and knight statements are true
demon and knave statements are false
exactly 1 of A B is a god
together leave exactly 2 possible god identities
each statement alone is insufficient

SOLVE
>generate statements for A B using k-map
```

The role-truth lines belong in `GOALS` here because they describe the rules the generated statements must obey. They do not guess that the word `god` has a special meaning.

A compact result can be:

```lpl
A : self == god or self == knight
B : self == god or self == knight
```

Plain language:

> A says, “I am a god or knight.”
> B says, “I am a god or knight.”

For a truthful speaker, the expression is true. For a demon or knave, it is false. Therefore the expression is compatible with every role. The exact-one-god goal leaves these two possibilities:

```text
A = god, B != god
A != god, B = god
```

Because neither individual statement removes one of those possibilities, the “alone is insufficient” goal also passes.

### Fixed person, unknown partner

To force A to be a thief while leaving B unresolved:

```lpl
SETUP
stater A B
type thief innocent knight
types may repeat

GOALS
generate statements for A B
exactly 1 of A B is a thief
A is definitely a thief
B remains unknown

SOLVE
>generate statements for A B
```

The goals have precise meanings:

- `exactly 1 ... is a thief`: one and only one thief exists among A and B.
- `A is definitely a thief`: every surviving world assigns `thief` to A.
- `B remains unknown`: B has more than one possible type in the surviving worlds.

This is different from saying “B is not a thief.” B may be innocent or knight; the point is that LPL must not collapse those possibilities into one answer.

### Exactly two thieves

For three speakers where exactly two are thieves:

```lpl
SETUP
stater A B C
type thief innocent
types may repeat

GOALS
generate statements for A B C
exactly 2 of A B C is a thief
together leave exactly 3 possible thief identities
each statement alone is insufficient

SOLVE
>generate statements for A B C
```

The three possible identity sets are:

```text
A and B are thieves
A and C are thieves
B and C are thieves
```

The goal does not ask LPL to select one pair. It asks for statements that preserve all three pair possibilities while enforcing exactly two thieves in every surviving world.

### At least and at most

Use range goals when the puzzle gives a lower or upper bound rather than an exact count:

```lpl
GOALS
generate statements for A B C D
at least 1 of A B C D is a thief
at most 2 of A B C D is a thief
```

This keeps worlds with one or two thieves and rejects worlds with zero or more than two. The compact aliases `atleast` and `atmost` are also accepted:

```lpl
atleast 1 of A B C D is a thief
atmost 2 of A B C D is a thief
```

The generated statements are then tested only against the worlds that satisfy both bounds. As with `exactly`, the bound is a constraint on every surviving world, not a request to choose one particular thief.

### Requesting a number of statements

Normally, LPL creates one statement for each named speaker:

```lpl
>generate statements for A B
```

Use an explicit number when the puzzle needs a specific number of statement slots:

```lpl
>generate 3 statements for A B
```

This creates three slots and cycles through the named speakers when necessary. The result panel labels each slot and gives its plain-language reading. The same form works in `GOALS`:

```lpl
GOALS
generate 3 statements for A B
```

Use this when one speaker may make multiple statements or when the puzzle describes a fixed total number of statements.

### When to use K-map mode

Use the normal generator when you want any valid bounded expression:

```lpl
>generate statements for A B
```

Use K-map mode when you prefer compact boolean expressions:

```lpl
>generate statements for A B using k-map
```

K-map mode groups worlds by the truth value needed from a speaker and searches for short expressions such as:

```lpl
self == god or self == knight
```

It is a minimization aid. It does not understand arbitrary English and does not guarantee that the first result is the only or most elegant statement.

### Reading the result

For every candidate, inspect four pieces of evidence:

1. **Statements**: the exact expressions LPL generated.
2. **Plain language**: the rough reading under each expression.
3. **Possible identities**: which people can still have the requested role together.
4. **Alone**: which identities remain when each statement is tested by itself.

A candidate is conclusive for the declared finite model when all requested goal checks pass. For example:

```text
possible together: A, B
A alone: A, B
B alone: A, B
```

This proves that both identities remain possible and neither statement alone identifies one. It does not prove that no other wording could work.

### Common translation mistakes

Do not write this unless the puzzle really requires one of every role:

```lpl
stater A B
type god knight demon knave
```

When the number of staters equals the number of types, LPL normally activates one-of-each distribution. For two speakers and four roles, that default does not activate, but `types may repeat` still makes the intention explicit.

Do not rely on role names alone:

```lpl
type god demon
```

The names `god` and `demon` do not automatically mean truthful and lying. State the behavior in the goals or with explicit role policies.

Finally, “no candidates found” is not always a contradiction. Check whether the search was truncated, whether the role policies are complete, and whether the requested identity count is compatible with the cardinality goal.

## Commands

- `>find type All` lists surviving type assignments.
- `>find value All` is accepted as the value-query spelling for the same possibility set.
- `>try Aimee := alpha` tests a proposed type against the surviving worlds.

## Translator prompt

[docs/lpl-translator-prompt.md](docs/lpl-translator-prompt.md) is a strict prompt for translating plain-language puzzles into the currently supported LPL subset. It requires the translator to return executable LPL, assumptions, unsupported requirements, and validation notes instead of inventing future syntax.

## Expansion roadmap

The next implementation layers are deeper expression search, richer identity projections, source-linked candidate explanations, and broader natural-language goal aliases. The current bounded statement generator is supported by the parser, solver, renderer, tests, and editor.

## Development

Run the dependency-free tests with:

```sh
node tests/run.js
```

The regression suite includes a dense integration puzzle combining wrapped contexts, declarative branches, cardinality, entity truth rules, questions, references, and focused queries in [tests/complex-puzzle.js](tests/complex-puzzle.js).

Temporal cases, `case`/`group` declarations, question blocks, partial brute-force statements, and richer unknown propagation are not implemented yet. The parser, normalized model, constraint helpers, and evaluator are kept separate so those additions can extend the current browser-first architecture without changing the UI contract.
