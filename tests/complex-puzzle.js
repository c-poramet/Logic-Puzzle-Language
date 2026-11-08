'use strict';

const assert = require('assert');
const parser = require('../lpl/parser.js');
const solver = require('../lpl/solver.js');

const source = `SETUP
stater Ari Bea Cy
type alpha beta gamma
case DAY Sun Mon Tue Wed Thu Fri Sat wrap
group L_days = {Mon, Tue, Wed}
group U_days = {Thu, Fri, Sat}
var thief in {Ari, Bea, Cy}
exactly 1 of Ari Bea Cy == alpha
if L_days then
Ari := beta
Bea := alpha
Cy := gamma
elseif U_days then
Ari := alpha
Bea := gamma
Cy := beta
else
Ari, Bea, Cy := gamma, beta, alpha
end
rule thief made a false statement
STATEMENTS
1: Ari == alpha
Ari : Ari == alpha
Bea : Ari == beta
Cy : Bea == alpha or Ari == gamma
? : DAY == Sun
  _ : positive
  _ 1: blank
_ : if 1: then Cy == alpha
>find possible DAY
>find impossible thief`;

const model = parser.parse(source);
const result = solver.solve(model);
const queries = model.commands.map(command => solver.query(result, command));

assert.deepStrictEqual(model.contexts[0].values, ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']);
assert.strictEqual(model.rules.length, 1);
assert.strictEqual(model.questions.length, 1);
assert.strictEqual(model.entityRules.length, 1);
assert.strictEqual(result.count, 2);
assert.deepStrictEqual(result.solutions.map(solution => solution.assignment), [
  { Ari: 'gamma', Bea: 'beta', Cy: 'alpha', DAY: 'Sun', thief: 'Ari' },
  { Ari: 'gamma', Bea: 'beta', Cy: 'alpha', DAY: 'Sun', thief: 'Bea' }
]);
assert.deepStrictEqual(queries[0].choices[0].possible, ['Sun']);
assert.deepStrictEqual(queries[1].choices[0].possible.sort(), ['Ari', 'Bea']);
assert.deepStrictEqual(queries[1].choices[0].impossible, ['Cy']);

console.log('Complex LPL integration puzzle passed.');
