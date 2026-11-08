'use strict';

const assert = require('assert');
const parser = require('../lpl/parser.js');
const solver = require('../lpl/solver.js');

function runCase(name, setup, goals, command = '>generate statements for A B') {
  const source = `SETUP
stater A B
${setup}
GOALS
generate statements for A B
${goals}
SOLVE
--max 300
${command}`;
  const model = parser.parse(source);
  const result = solver.solve(model);
  const query = solver.query(result, model.commands[0]);
  assert.ok(query.synthesis.supported, `${name}: synthesis should be supported`);
  assert.ok(query.synthesis.tuples.length > 0, `${name}: expected at least one candidate`);
  assert.ok(query.synthesis.tuples[0].survivingWorlds > 0, `${name}: candidate should leave worlds`);
  return query.synthesis.tuples[0];
}

const exact = runCase('exact proof', `type alpha beta
types may repeat`, 'together prove exactly 1 of A B is a alpha');
assert.strictEqual(exact.checks.provedCardinality, true);

const atLeast = runCase('at least proof', `type alpha beta
types may repeat`, 'together prove at least 1 of A B is a alpha');
assert.strictEqual(atLeast.checks.provedCardinality, true);

const atMost = runCase('at most proof', `type alpha beta
types may repeat`, 'together prove at most 1 of A B is a alpha');
assert.strictEqual(atMost.checks.provedCardinality, true);

const fixedAndUnknown = runCase('fixed and unknown identities', `type thief innocent knight
types may repeat
role thief is truthful`, `exactly 1 of A B is a thief
A is definitely a thief
B remains unknown`);
assert.strictEqual(fixedAndUnknown.checks.fixedIdentities, true);
assert.strictEqual(fixedAndUnknown.checks.ambiguousIdentities, true);

const ambiguousGod = runCase('ambiguous god identities', `type god knight demon knave
types may repeat`, `god and knight statements are true
demon and knave statements are false
together prove exactly 1 of A B is a god
together leave exactly 2 possible god identities
each statement alone is insufficient`, '>generate statements for A B using k-map');
assert.strictEqual(ambiguousGod.checks.provedCardinality, true);
assert.strictEqual(ambiguousGod.checks.jointPossibleIdentities, true);
assert.strictEqual(ambiguousGod.checks.eachAloneInsufficient, true);

const counted = runCase('counted statements', `type alpha beta
types may repeat`, '', '>generate 3 statements for A B');
assert.strictEqual(counted.statements.length, 3);

const maxModel = parser.parse(`SETUP
stater A B
type god knight demon knave
types may repeat
GOALS
generate statements for A B
god and knight statements are true
demon and knave statements are false
together prove exactly 1 of A B is a god
SOLVE
--max 600
>generate statements for A B`);
const maxQuery = solver.query(solver.solve(maxModel), maxModel.commands[0]);
assert.strictEqual(maxQuery.synthesis.limits.maxExpressions, 600);
assert.ok(maxQuery.synthesis.expressionCount > 512);

console.log('LPL synthesis matrix passed.');
