'use strict';

(function (root) {
  const normalize = value => String(value).toLowerCase();

  function attach(model) {
    const staterVariables = model.staters.map(name => ({
      name,
      kind: 'stater',
      domain: model.types.slice(),
      source: 'stater'
    }));
    const valueVariables = (model.valueVariables || []).map(variable => ({ ...variable, domain: variable.domain.slice(), source: 'var' }));
    const contextVariables = (model.caseDeclarations || []).map(context => ({
      name: context.name,
      kind: 'context',
      domain: context.values.slice(),
      wrap: context.wrap,
      source: 'case'
    }));
    const variables = [...staterVariables, ...valueVariables, ...contextVariables];
    const domains = Object.fromEntries(variables.map(variable => [variable.name, variable.domain.slice()]));
    const statementsById = Object.fromEntries(model.statements.map(statement => [statement.id, statement]));
    const constraints = [];
    if (model.options?.exactOneEach !== false && model.staters.length === model.types.length) {
      constraints.push({
        kind: 'cardinality',
        operator: 'exactly',
        amount: 1,
        values: model.types.slice(),
        variables: model.staters.slice(),
        source: 'implicit exact-one-of-each'
      });
    }
    constraints.push(...(model.cardinalityRules || []).map(rule => ({ ...rule, source: `line ${rule.line}` })));
    return Object.assign(model, {
      variables,
      domains,
      constraints,
      contexts: (model.caseDeclarations || []).map(context => ({ ...context, values: context.values.slice() })),
      groups: Object.fromEntries((model.groups || []).map(group => [group.name, { ...group, values: group.values.slice() }])),
      rules: (model.rules || []).map(rule => ({ ...rule, branches: rule.branches.map(branch => ({ ...branch, assignments: branch.assignments.map(assignment => ({ ...assignment })) })) })),
      questions: (model.questions || []).map(question => ({ ...question, answers: question.answers.map(answer => ({ ...answer })) })),
      entityRules: (model.entityRules || []).map(rule => ({ ...rule })),
      policies: Object.fromEntries(Object.entries(model.policies || {}).map(([type, policy]) => [type, { ...policy, states: { ...policy.states } }])),
      statementsById,
      diagnostics: [],
      variable(name) {
        return variables.find(variable => normalize(variable.name) === normalize(name));
      }
    });
  }

  const api = { attach };
  root.LPLModel = api;
  if (typeof module !== 'undefined') module.exports = api;
})(typeof window === 'undefined' ? globalThis : window);
