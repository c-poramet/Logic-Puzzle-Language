'use strict';

const assert = require('assert');
require('../lpl/model.js');
const constraints = require('../lpl/constraints.js');
const parser = require('../lpl/parser.js');
const solver = require('../lpl/solver.js');

const example = `SETUP
stater Aimee Bob Calvin
type alpha beta gamma
STATEMENTS
A : A == beta
B : A == alpha
C : A == beta or A == gamma
>find type All`;

const model = parser.parse(example);
assert.deepStrictEqual(model.staters, ['Aimee', 'Bob', 'Calvin']);
assert.deepStrictEqual(model.types, ['alpha', 'beta', 'gamma']);
const result = solver.solve(model);
assert.strictEqual(result.count, 1);
assert.deepStrictEqual(result.solutions[0].assignment, { Aimee: 'gamma', Bob: 'beta', Calvin: 'alpha' });
assert.deepStrictEqual(model.variables.map(variable => variable.name), ['Aimee', 'Bob', 'Calvin']);
assert.deepStrictEqual(model.domains.Aimee, ['alpha', 'beta', 'gamma']);
assert.strictEqual(model.constraints[0].source, 'implicit exact-one-of-each');

assert.strictEqual(constraints.and(true, null), null);
assert.strictEqual(constraints.and(false, null), false);
assert.strictEqual(constraints.or(false, null), null);
assert.strictEqual(constraints.or(true, null), true);
assert.strictEqual(constraints.implies(false, null), true);
assert.strictEqual(constraints.implies(true, null), null);
assert.strictEqual(constraints.iff(true, false), false);
assert.strictEqual(constraints.iff(true, null), null);
assert.strictEqual(constraints.cardinality([true, null, false], 1, 'exactly'), null);
assert.strictEqual(constraints.cardinality([true, false, false], 1, 'exactly'), true);

const alias = parser.parse(`SETUP
stater Alice Alina Bob
type alpha beta gamma
STATEMENTS
Alice : Alice == alpha
Alina : A == beta
Bob : B == gamma`);
assert.throws(() => solver.solve(alias), /Ambiguous name/);

assert.throws(() => parser.parse('SETUP\nstater A\nSTATEMENTS\nA : A == beta'), /No types declared/);

const variableModel = parser.parse(`SETUP
stater A
type alpha
var thief in {A, B}
STATEMENTS
A : thief == A
>find value All`);
const variableResult = solver.solve(variableModel);
assert.deepStrictEqual(variableModel.variables.map(variable => variable.name), ['A', 'thief']);
assert.deepStrictEqual(variableModel.domains.thief, ['A', 'B']);
assert.strictEqual(variableResult.count, 1);
assert.strictEqual(variableResult.solutions[0].assignment.thief, 'A');
console.log('LPL parser and solver tests passed.');
