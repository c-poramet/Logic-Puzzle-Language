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
    const variables = [...staterVariables, ...(model.valueVariables || []).map(variable => ({ ...variable, domain: variable.domain.slice(), source: 'var' }))];
    const domains = Object.fromEntries(variables.map(variable => [variable.name, variable.domain.slice()]));
    const statementsById = Object.fromEntries(model.statements.map(statement => [statement.id, statement]));
    const constraints = [];
    if (model.staters.length === model.types.length) {
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
      contexts: [],
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
