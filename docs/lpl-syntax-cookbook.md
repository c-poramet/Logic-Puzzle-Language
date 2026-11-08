# LPL Syntax Cookbook

This guide covers the supported syntax families. Each family has three examples, followed by the important differences from similar forms.

## Sections

```lpl
SETUP
stater A B
type alpha beta
```

```lpl
STATEMENTS
A : self == alpha
```

```lpl
GOALS
generate statements for A B
```

```lpl
SOLVE
>find type All
```

## Declarations

### `stater`

```lpl
stater A B
```

```lpl
stater Alice, Bob, Calvin
```

```lpl
stater Lion Unicorn
```

### `type`

```lpl
type alpha beta
```

```lpl
type god knight demon knave
```

```lpl
type truthful liar ordinary
```

### `types may repeat`

```lpl
stater A B
type alpha beta
types may repeat
```

```lpl
stater A B C
type thief innocent
types may repeat
```

```lpl
stater Ork Bork
type diurnal nocturnal
types may repeat
```

### `var`

```lpl
var thief in {A, B}
```

```lpl
var winner in {Alice, Bob, Calvin}
```

```lpl
var role in {thief, witness, guard}
```

### `case`

```lpl
case state awake asleep
```

```lpl
case day Mon Tue Wed Thu Fri Sat Sun wrap
```

```lpl
case round first second third
```

### `group`

```lpl
group workdays = {Mon, Tue, Wed, Thu, Fri}
```

```lpl
group weekend = {Sat, Sun}
```

```lpl
group upper = {A, B, C}
```

`type` assigns a value to every stater. `var` is one shared named choice. `case` is one shared context. `group` names a set of values.

## Policies and Setup Rules

### Constant role policies

```lpl
role god is truthful
```

```lpl
role demon is lying
```

```lpl
role knight is true
```

### One-line policy aliases

```lpl
policy god says true
```

```lpl
policy knave says false
```

```lpl
policy witness says true
```

### Context-dependent policies

```lpl
policy diurnal:
    awake => true
    asleep => false
```

```lpl
policy nocturnal:
    awake => false
    asleep => true
```

```lpl
policy weekday:
    work => true
    rest => false
```

### Conditional setup

```lpl
if workdays then
    Lion := alpha
end
```

```lpl
if workdays then
    Lion := beta
elseif weekend then
    Lion := alpha
end
```

```lpl
if workdays then
    Lion, Unicorn := beta, alpha
else
    Lion, Unicorn := alpha, beta
end
```

`role` and `policy ... says` are constant truth rules. An indented policy depends on a case. `:=` assigns inside setup; it is not a spoken statement.

## Statements and Expressions

### Subject and `self`

```lpl
A : A == alpha
```

```lpl
Alice : self == beta
```

```lpl
_ : B == gamma
```

`self` means the current subject. `_` makes an anonymous subject.

### Comparisons

```lpl
A : A == alpha
```

```lpl
B : B != beta
```

```lpl
C : thief == C
```

### `not`

```lpl
A : not (A == beta)
```

```lpl
B : not (B != alpha)
```

```lpl
C : not (A == alpha or B == beta)
```

### `and`

```lpl
A : A == alpha and B == beta
```

```lpl
B : (B == beta) and (thief == B)
```

```lpl
C : (C == gamma) and not (A == beta)
```

### `or`

```lpl
A : A == god or A == knight
```

```lpl
B : B == beta or B == gamma
```

```lpl
C : (A == alpha) or (B == beta and C == gamma)
```

### `=>` implication

```lpl
A : A == alpha => B == beta
```

```lpl
B : thief == B => B == beta
```

```lpl
C : (A == alpha and B == beta) => C == gamma
```

### `<=>` iff

```lpl
A : A == alpha <=> B == beta
```

```lpl
B : thief == B <=> B == beta
```

```lpl
C : (A == alpha or B == beta) <=> C == gamma
```

`and` needs both sides, `or` needs one side, `=>` is true when its premise is false, and `<=>` requires equal truth values.

## Contexts and References

### `on` guards

```lpl
Lion : on Sunday Lion == beta
```

```lpl
Unicorn : on {Mon, Tue} Unicorn == alpha
```

```lpl
Fox : on weekend Fox == gamma
```

### Context offsets

```lpl
Lion : DAY - 1 == workdays
```

```lpl
Unicorn : DAY + 1 == weekend
```

```lpl
Fox : on Sun Fox == beta
```

### Numbered references

```lpl
1: A == alpha
B : if 1: then B == beta
```

```lpl
4: thief == A
C : if 4: then C == gamma
```

```lpl
_ 1: A == alpha
_ : if -: then A == beta
```

`on` guards a context. `+` and `-` shift an ordered case. `-:` refers to the previous numbered statement.

## Multiple Statements, Questions, and Rules

### Multiple statements on one line

```lpl
_ : A == alpha : A == beta
```

```lpl
A : self == alpha : self != beta
```

```lpl
_ : (A == alpha) and (B == beta) : A == gamma
```

### Questions

```lpl
? : A == alpha
    _ : positive
```

```lpl
? : thief == A
    _ : positive
    _ : negative
```

```lpl
? : B == beta
    _ : blank
```

Question answers are `positive`, `negative`, or `blank`.

### Entity rules

```lpl
var thief in {A, B}
rule thief made a false statement
```

```lpl
var witness in {Alice, Bob}
constraint witness made a true statement
```

```lpl
var culprit in {A, B, C}
rule culprit made a false statement
```

### Cardinality rules

```lpl
exactly 1 of A B == alpha
```

```lpl
atleast 2 of A B C == beta
```

```lpl
atmost 1 of A B C == gamma
```

Rules connect a finite variable to a matching stater. Cardinality rules filter starting worlds.

## Statement Synthesis

### Generate statements

```lpl
GOALS
generate statements for A B
```

```lpl
GOALS
generate 3 statements for A B
```

```lpl
GOALS
generate statements for A B C
god and knight statements are true
demon and knave statements are false
```

### Identity goals

```lpl
together leave exactly 2 possible god identities
```

```lpl
A is definitely a thief
```

```lpl
B remains unknown
```

### Cardinality premises and conclusions

```lpl
exactly 1 of A B is a god
```

```lpl
together prove exactly 1 of A B is a god
```

```lpl
together prove at least 1 of A B C is a thief
```

```lpl
together prove at most 2 of A B C is a thief
```

The first form filters starting worlds. The `prove` forms require generated statements to establish the conclusion.

## Commands and Flags

### `find`

```lpl
>find type A
```

```lpl
>find value thief
```

```lpl
>find type All
```

### `try`

```lpl
>try A := alpha
```

```lpl
>try Aimee := beta
```

```lpl
>try B := gamma
```

### `solve`

```lpl
>solve DAY
```

```lpl
1: _
>solve 1: brute
```

```lpl
>solve value thief
```

### `generate` and K-map flags

```lpl
>generate statements for A B using k-map
```

```lpl
>generate statements for A B --kmap
```

```lpl
>generate statements for A B --method kmap
```

`find` reports possibilities, `try` tests one proposal, `solve` queries a context or blank, and `generate` invents statements.

## Similar Syntax Compared

`type`, `var`, and `case` all have finite values but different owners:

```lpl
type alpha beta
```

```lpl
var thief in {A, B}
```

```lpl
case state awake asleep
```

`type` belongs to every stater. `var` is one named shared choice. `case` is one shared context.

`==`, `:=`, and `<=>` differ:

```lpl
A : A == alpha
```

```lpl
if workdays then
    A := alpha
end
```

```lpl
A : A == alpha <=> B == beta
```

`==` compares values. `:=` assigns inside setup. `<=>` compares proposition truth values.

Premise versus proof is the most important synthesis distinction:

```lpl
exactly 1 of A B is a god
```

```lpl
together prove exactly 1 of A B is a god
```

```lpl
together leave exactly 2 possible god identities
```

The first assumes exactly one god. The second requires statements to establish it. The third controls the remaining ambiguity.

Finally, caps and minimization differ:

```lpl
threshold = 10
```

```lpl
SOLVE
--max 1000
```

```lpl
>generate statements for A B using k-map
```

`threshold` is a general cap, `--max` is a per-run cap that also raises synthesis budgets, and K-map chooses compact expression search. A truncated result is not proof that no candidate exists.
 
 ## Development
*** End Patch