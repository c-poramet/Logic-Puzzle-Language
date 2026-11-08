'use strict';

const assert = require('assert');
require('../lpl/model.js');
const constraints = require('../lpl/constraints.js');
require('../lpl/contexts.js');
require('../lpl/statements.js');
require('../lpl/explanations.js');
require('../lpl/search.js');
const propagate = require('../lpl/propagate.js');
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

const cardinalityModel = parser.parse(`SETUP
stater A B
type alpha beta gamma
exactly 1 of A B == alpha
STATEMENTS
A : A == alpha
B : B == alpha
>find type All`);
const cardinalityResult = solver.solve(cardinalityModel);
assert.strictEqual(cardinalityModel.cardinalityRules[0].operator, 'exactly');
assert.strictEqual(cardinalityResult.count, 4);

const propagated = propagate.run({
	variables: [{ name: 'x', domain: ['alpha'] }, { name: 'y', domain: ['alpha', 'beta'] }],
	cardinalityRules: [{ operator: 'exactly', amount: 1, variables: ['x', 'y'], value: 'alpha', line: 1 }]
});
assert.deepStrictEqual([...propagated.domains.x], ['alpha']);
assert.deepStrictEqual([...propagated.domains.y], ['beta']);
assert.strictEqual(propagated.contradiction, null);
assert.ok(propagated.reductions > 0);

const logicModel = parser.parse(`SETUP
stater A B
type alpha beta
STATEMENTS
A : A == alpha => B == beta
B : not (A == beta)`);
const logicValues = logicModel.statements.map(statement => solver.evaluate(statement.expr, { A: 'alpha', B: 'beta' }, logicModel, statement.subject));
assert.deepStrictEqual(logicModel.statements.map(statement => statement.expr.kind), ['implies', 'not']);
assert.deepStrictEqual(logicValues, [true, true]);

const contextModel = parser.parse(`SETUP
stater Lion Unicorn
type alpha beta
case DAY Sun Mon Tue ... wrap
group L_days = {Mon, Tue, Wed}
group U_days = {Thu, Fri, Sat}
STATEMENTS
Lion : DAY - 1 == L_days
Unicorn : DAY - 1 == U_days
>solve DAY`);
const contextResult = solver.solve(contextModel);
assert.deepStrictEqual(contextModel.contexts[0].values, ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']);
assert.strictEqual(contextResult.count, 6);

const referenceModel = parser.parse(`SETUP
stater A B
type alpha beta
STATEMENTS
1: A == alpha
B : if 1: then A == beta`);
const referenceValues = referenceModel.statements.map(statement => solver.evaluate(statement.expr, { A: 'alpha', B: 'beta' }, referenceModel, statement.subject));
assert.deepStrictEqual(referenceValues, [true, false]);

const anonymousModel = parser.parse(`SETUP
stater A
type alpha
STATEMENTS
_ : _`);
assert.strictEqual(solver.solve(anonymousModel).count, 1);

const contradictionModel = parser.parse(`SETUP
stater A
type alpha beta
STATEMENTS
A : A == beta`);
const contradictionResult = solver.solve(contradictionModel);
assert.strictEqual(contradictionResult.count, 0);
assert.ok(contradictionResult.explanations.some(entry => entry.message.includes('Statement at line 5')));

const searchModel = parser.parse(`SETUP
stater A B
type alpha beta gamma
exactly 1 of A B == alpha
STATEMENTS
A : A == alpha
B : B == alpha`);
const searchResult = solver.solve(searchModel);
assert.strictEqual(searchResult.statistics.searchLeaves, 4);
assert.deepStrictEqual(searchResult.statistics.variableOrder, ['A', 'B']);

const supportModel = parser.parse(`SETUP
stater A
type alpha beta gamma
STATEMENTS
A : A == beta`);
const supportResult = solver.solve(supportModel);
assert.strictEqual(supportResult.count, 1);
assert.strictEqual(supportResult.solutions[0].assignment.A, 'gamma');
assert.ok(supportResult.statistics.reductions >= 1);

const ruleModel = parser.parse(`SETUP
stater Lion Unicorn
type alpha beta
case DAY Sun Mon Tue ... wrap
group L_days = {Mon, Tue, Wed}
if L_days then
Lion := beta
Unicorn := alpha
else
Lion, Unicorn := alpha, beta
end
STATEMENTS
_ : _`);
const ruleResult = solver.solve(ruleModel);
assert.strictEqual(ruleModel.rules.length, 1);
assert.strictEqual(ruleResult.count, 7);
assert.ok(ruleResult.solutions.every(solution => solution.assignment.Lion !== solution.assignment.Unicorn));

const questionModel = parser.parse(`SETUP
stater A
type alpha beta gamma
STATEMENTS
? : A == alpha
	_ : positive`);
const questionResult = solver.solve(questionModel);
assert.strictEqual(questionModel.questions.length, 1);
assert.deepStrictEqual(questionModel.questions[0].answers.map(answer => answer.value), ['positive']);
assert.strictEqual(questionResult.count, 1);
assert.strictEqual(questionResult.solutions[0].assignment.A, 'alpha');

const entityModel = parser.parse(`SETUP
stater Aimee Bob Calvin
type alpha beta gamma
var thief in {Aimee, Bob, Calvin}
rule thief made a false statement
STATEMENTS
A : A == beta
B : A == alpha
C : A == beta or A == gamma`);
const entityResult = solver.solve(entityModel);
assert.strictEqual(entityModel.entityRules[0].kind, 'entity-statement-truth');
assert.strictEqual(entityResult.count, 2);
assert.deepStrictEqual([...new Set(entityResult.solutions.map(solution => solution.assignment.thief))].sort(), ['Aimee', 'Bob']);
entityModel.commands.push({ name: 'find', target: 'value', argument: 'thief', line: 1 });
entityModel.commands.push({ name: 'try', target: '', argument: 'Aimee := alpha', line: 1 });
const entityQueries = entityModel.commands.map(command => solver.query(entityResult, command));
assert.deepStrictEqual(entityQueries[0].choices[0].possible.sort(), ['Aimee', 'Bob']);
assert.strictEqual(entityQueries[1].count, 0);

const policyModel = parser.parse(`SETUP
stater A
type diurnal nocturnal
case WAKE awake asleep
policy diurnal:
	awake => true
	asleep => false
policy nocturnal:
	awake => false
	asleep => true
STATEMENTS
A : A == diurnal`);
const policyResult = solver.solve(policyModel);
assert.strictEqual(policyResult.count, 2);
assert.ok(policyResult.solutions.every(solution => solution.assignment.WAKE === 'awake'));

const onModel = parser.parse(`SETUP
stater L
type alpha beta
case DAY Sun Mon Tue ... wrap
group L_days = {Mon, Tue, Wed}
if L_days then
L := beta
else
L := alpha
end
STATEMENTS
L : L == beta on DAY - 1
>solve DAY`);
const onExpression = onModel.statements[0].expr;
assert.strictEqual(onExpression.kind, 'at');
assert.strictEqual(solver.evaluate(onExpression, { L: 'beta', DAY: 'Mon' }, onModel, 'L'), false);
assert.strictEqual(solver.evaluate(onExpression, { L: 'beta', DAY: 'Tue' }, onModel, 'L'), true);
const dayQuery = solver.query(solver.solve(onModel), onModel.commands[0]);
assert.strictEqual(dayQuery.choices[0].name, 'DAY');
assert.ok(dayQuery.choices[0].possible.length > 0);

const bruteModel = parser.parse(`SETUP
stater A
type alpha beta
STATEMENTS
A : _
>solve 1: brute`);
const bruteResult = solver.solve(bruteModel);
const bruteQuery = solver.query(bruteResult, bruteModel.commands[0]);
assert.strictEqual(bruteResult.count, 2);
assert.ok(bruteQuery.brute.candidates.includes('A == alpha'));

const thresholdModel = parser.parse(`SETUP
stater A B C
type alpha beta gamma
threshold = 1
STATEMENTS
_ : _`);
const thresholdResult = solver.solve(thresholdModel);
assert.strictEqual(thresholdResult.count, 1);
assert.strictEqual(thresholdResult.statistics.threshold, 1);
assert.strictEqual(thresholdResult.statistics.truncated, true);

const completionSource = `SETUP
stater Aimee Bob
type alpha beta
var thief in {Aimee, Bob}
case DAY Sun Mon Tue ... wrap
group L_days = {Mon, Tue}
1: A == alpha
STATEMENTS
`;
const completionValues = parser.complete(completionSource, completionSource.length).map(item => item.value);
assert.ok(['Aimee', 'thief', 'DAY', 'L_days', '1:'].every(value => completionValues.includes(value)));

const statementQueryModel = parser.parse(`SETUP
stater A
type alpha beta gamma
STATEMENTS
1: A == alpha
>find value 1:`);
const statementQueryResult = solver.solve(statementQueryModel);
const statementQuery = solver.query(statementQueryResult, statementQueryModel.commands[0]);
assert.deepStrictEqual(statementQuery.choices[0].possible.sort(), ['false', 'true']);
const polarityModel = parser.parse(`SETUP
stater A
type alpha beta
STATEMENTS
1: A == alpha
>find possible A
>find impossible A`);
const polarityResult = solver.solve(polarityModel);
const polarityQueries = polarityModel.commands.map(command => solver.query(polarityResult, command));
assert.strictEqual(polarityQueries[0].field, 'possible');
assert.strictEqual(polarityQueries[1].field, 'impossible');

const multipleModel = parser.parse(`SETUP
stater A
type alpha beta
STATEMENTS
_ : A == alpha : A == beta`);
assert.strictEqual(multipleModel.statements.length, 2);
assert.deepStrictEqual(multipleModel.statements.map(statement => statement.id), [1, 2]);
console.log('LPL parser and solver tests passed.');
