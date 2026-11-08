'use strict';

(function (root) {
  const normalize = value => String(value).toLowerCase();

  function run(model) {
    const domains = Object.fromEntries((model.variables || []).map(variable => [variable.name, new Set(variable.domain)]));
    const rules = model.cardinalityRules || [];
    let reductions = 0;
    let rounds = 0;
    let changed = true;
    let contradiction = null;
    const findVariable = name => {
      const needle = normalize(name);
      const variable = (model.variables || []).find(item => normalize(item.name) === needle);
      return variable ? variable.name : null;
    };
    const hasValue = (domain, value) => [...domain].some(item => normalize(item) === normalize(value));
    const removeValue = (domain, value) => {
      for (const item of [...domain]) {
        if (normalize(item) === normalize(value)) { domain.delete(item); reductions++; }
      }
    };
    const keepOnly = (domain, value) => {
      for (const item of [...domain]) {
        if (normalize(item) !== normalize(value)) { domain.delete(item); reductions++; }
      }
    };
    const fail = message => { contradiction = contradiction || message; };
    while (changed && !contradiction) {
      changed = false;
      const before = reductions;
      rounds++;
      for (const rule of rules) {
        const variables = rule.variables.map(findVariable);
        if (variables.some(name => !name)) { fail(`Unknown variable in cardinality rule at line ${rule.line || '?'}`); break; }
        const domainsForRule = variables.map(name => domains[name]);
        if (domainsForRule.some(domain => !domain.size)) { fail('A variable has no remaining values'); break; }
        const fixed = domainsForRule.filter(domain => domain.size === 1 && hasValue(domain, rule.value)).length;
        const possible = domainsForRule.filter(domain => hasValue(domain, rule.value)).length;
        if (rule.operator === 'exactly' && (fixed > rule.amount || possible < rule.amount)) { fail(`Cardinality rule at line ${rule.line || '?'} is impossible`); break; }
        if (rule.operator === 'atleast' && possible < rule.amount) { fail(`Cardinality rule at line ${rule.line || '?'} is impossible`); break; }
        if (rule.operator === 'atmost' && fixed > rule.amount) { fail(`Cardinality rule at line ${rule.line || '?'} is impossible`); break; }
        for (let index = 0; index < domainsForRule.length; index++) {
          const domain = domainsForRule[index];
          if (rule.operator === 'exactly' && fixed === rule.amount && !(domain.size === 1 && hasValue(domain, rule.value))) removeValue(domain, rule.value);
          else if (rule.operator === 'exactly' && possible === rule.amount) keepOnly(domain, rule.value);
          else if (rule.operator === 'atmost' && fixed === rule.amount) removeValue(domain, rule.value);
        }
        if (domainsForRule.some(domain => !domain.size)) { fail('Propagation emptied a variable domain'); break; }
      }
      changed = reductions > before;
    }
    return { domains, rounds, reductions, contradiction };
  }

  const api = { run };
  root.LPLPropagate = api;
  if (typeof module !== 'undefined') module.exports = api;
})(typeof window === 'undefined' ? globalThis : window);
