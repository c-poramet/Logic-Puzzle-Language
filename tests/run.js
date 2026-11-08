'use strict';

const assert = require('assert');
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

const alias = parser.parse(`SETUP
stater Alice Alina Bob
type alpha beta gamma
STATEMENTS
Alice : Alice == alpha
Alina : A == beta
Bob : B == gamma`);
assert.throws(() => solver.solve(alias), /Ambiguous name/);

assert.throws(() => parser.parse('SETUP\nstater A\nSTATEMENTS\nA : A == beta'), /No types declared/);
console.log('LPL parser and solver tests passed.');
