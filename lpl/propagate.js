'use strict';

(function (root) {
  const normalize = value => String(value).toLowerCase();

  function run(model, evaluate, compatible) {
    const domains = Object.fromEntries((model.variables || []).map(variable => [variable.name, new Set(variable.domain)]));
    const rules = model.cardinalityRules || [];
    let reductions = 0;
    let rounds = 0;
    let changed = true;
    let contradiction = null;
    const findVariable = name => {
      const needle = normalize(name);
      const variables = model.variables || [];
      const exact = variables.find(item => normalize(item.name) === needle);
      if (exact) return exact.name;
      const matches = variables.filter(item => normalize(item.name).startsWith(needle));
      return matches.length === 1 ? matches[0].name : null;
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
    compatible = compatible || ((type, value) => type === 'alpha' ? value === true : type === 'beta' ? value === false : true);
    const namesIn = node => {
      if (!node) return [];
      if (node.kind === 'name' || node.kind === 'offset') return [node.name || node.value];
      if (node.kind === 'at') return [...namesIn(node.value), node.context];
      if (node.kind === 'guard') return [...namesIn(node.value), ...node.values];
      if (node.kind === 'compare' || node.kind === 'and' || node.kind === 'or' || node.kind === 'implies' || node.kind === 'iff') return [...namesIn(node.left), ...namesIn(node.right)];
      if (node.kind === 'not') return namesIn(node.value);
      return [];
    };
    const statementSupport = statement => {
      if (!evaluate || statement.subject.trim() === '_' || statement.expr.kind === 'hole') return;
      const subject = model.staters.find(name => normalize(name) === normalize(statement.subject) || normalize(name).startsWith(normalize(statement.subject)));
      if (!subject || !domains[subject]) return;
      const references = [...new Set(namesIn(statement.expr))].filter(name => !['self'].includes(normalize(name)));
      const variables = references.map(name => findVariable(name)).filter(Boolean).map(name => name);
      const options = variables.map(name => [...domains[name]]);
      const size = options.reduce((total, values) => total * values.length, 1);
      if (size > 2000) return;
      const supported = new Set();
      const visit = index => {
        if (index === variables.length) {
          const subjectDomain = domains[subject];
          for (const type of subjectDomain) {
            const assignment = Object.fromEntries(variables.map((name, position) => [name, current[position]]));
            assignment[subject] = type;
            const value = evaluate(statement.expr, assignment, model, subject);
            if (compatible(type, value)) supported.add(type);
          }
          return;
        }
        for (const value of options[index]) { current[index] = value; visit(index + 1); }
      };
      const current = [];
      visit(0);
      for (const type of [...domains[subject]]) if (!supported.has(type)) domains[subject].delete(type), reductions++;
      if (!domains[subject].size) fail(`Statement at line ${statement.line} has no compatible stater type`);
    };
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
      if (!contradiction) for (const statement of model.statements || []) statementSupport(statement);
      changed = reductions > before;
    }
    return { domains, rounds, reductions, contradiction };
  }

  const api = { run };
  root.LPLPropagate = api;
  if (typeof module !== 'undefined') module.exports = api;
})(typeof window === 'undefined' ? globalThis : window);
