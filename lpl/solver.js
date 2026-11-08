'use strict';

(function (root) {
  const ErrorType = root.LPLRuntime?.Error || class extends Error {};
  const UNKNOWN = null;
  const UNASSIGNED = root.LPLConstraints?.UNASSIGNED || Symbol('lpl.unassigned');
  const contextOps = root.LPLContexts || { shift: () => undefined };
  const statementOps = root.LPLStatements || { get: (model, id) => model.statementsById?.[id] || null, isAnonymous: subject => String(subject).trim() === '_' };
  const explanationOps = root.LPLExplanations || { create: () => ({ add: () => {}, list: () => [] }) };
  const searchOps = root.LPLSearch || { orderVariables: variables => variables.slice() };
  const logic = root.LPLConstraints || {
    and: (left, right) => left === false || right === false ? false : left === true && right === true ? true : UNKNOWN,
    or: (left, right) => left === true || right === true ? true : left === false && right === false ? false : UNKNOWN,
    not: value => value === UNKNOWN ? UNKNOWN : !value,
    implies: (left, right) => left === false || right === true ? true : left === true && right === false ? false : UNKNOWN,
    iff: (left, right) => left === UNKNOWN || right === UNKNOWN ? UNKNOWN : left === right
  };
  const normalize = value => String(value).toLowerCase();
  const contextName = value => ({ sunday: 'sun', monday: 'mon', tuesday: 'tue', wednesday: 'wed', thursday: 'thu', friday: 'fri', saturday: 'sat' }[normalize(value)] || normalize(value));

  function resolveName(name, model, subject) {
    const needle = normalize(name);
    if (needle === 'self') return subject;
    const exactVariable = model.variables?.find(variable => normalize(variable.name) === needle);
    if (exactVariable) return exactVariable.name;
    const exactStater = model.staters.find(value => normalize(value) === needle);
    if (exactStater) return exactStater;
    const exactType = model.types.find(value => normalize(value) === needle);
    if (exactType) return exactType;
    const matches = (model.variables || model.staters.map(name => ({ name }))).filter(variable => normalize(variable.name).startsWith(needle));
    if (matches.length === 1) return matches[0].name;
    if (matches.length > 1) throw new ErrorType(`Ambiguous name "${name}"`, 0);
    throw new ErrorType(`Unknown name "${name}"`, 0);
  }

  function effectiveValue(name, assignment, model) {
    const base = assignment[name];
    for (const rule of model.rules || []) {
      let selected = null;
      for (const branch of rule.branches) {
        if (branch.condition == null) { selected = branch; break; }
        const group = Object.values(model.groups || {}).find(item => normalize(item.name) === normalize(branch.condition));
        const context = (model.contexts || []).find(item => group && group.values.some(value => normalize(value) === normalize(assignment[item.name])));
        if (context) { selected = branch; break; }
      }
      const override = selected?.assignments.find(item => normalize(resolveName(item.name, model, item.name)) === normalize(name));
      if (override) return override.value;
    }
    return base;
  }

  function evaluate(node, assignment, model, subject, seen = new Set()) {
    if (node.kind === 'guard') {
      const context = (model.contexts || []).find(item => node.values.some(value => item.values.some(candidate => contextName(candidate) === contextName(value))));
      if (!context || !node.values.some(value => contextName(value) === contextName(assignment[context.name]))) return UNKNOWN;
      return evaluate(node.value, assignment, model, subject, seen);
    }
    if (node.kind === 'at') {
      const context = model.contexts?.find(item => normalize(item.name) === normalize(node.context));
      const current = context && assignment[context.name];
      if (!context || current == null) return UNKNOWN;
      const shifted = contextOps.shift(context, current, node.amount);
      if (shifted == null) return UNKNOWN;
      return evaluate(node.value, { ...assignment, [context.name]: shifted }, model, subject, seen);
    }
    if (node.kind === 'hole') return UNKNOWN;
    if (node.kind === 'statementRef') {
      if (seen.has(node.id)) return UNKNOWN;
      const statement = statementOps.get(model, node.id);
      if (!statement) throw new ErrorType(`Unknown statement reference "${node.id}:"`, 0);
      const nextSeen = new Set(seen); nextSeen.add(node.id);
      return evaluate(statement.expr, assignment, model, statement.subject, nextSeen);
    }
    if (node.kind === 'not') return logic.not(evaluate(node.value, assignment, model, subject, seen));
    if (node.kind === 'name') return node.value.toLowerCase() === 'self' && subject === '?' ? UNKNOWN : resolveName(node.value, model, subject);
    if (node.kind === 'compare') {
      const leftRaw = node.left.name || node.left.value;
      const rightRaw = node.right.name || node.right.value;
      const leftGroup = node.left.kind === 'name' ? model.groups?.[node.left.value] : null;
      const rightGroup = node.right.kind === 'name' ? model.groups?.[node.right.value] : null;
      const left = leftGroup ? leftRaw : resolveName(leftRaw, model, subject);
      const right = rightGroup ? rightRaw : resolveName(rightRaw, model, subject);
      const leftVariable = model.variables?.find(variable => variable.name === left);
      const rightVariable = model.variables?.find(variable => variable.name === right);
      const leftIsDomainLiteral = rightVariable?.domain.some(value => normalize(value) === normalize(leftRaw));
      const rightIsDomainLiteral = leftVariable?.domain.some(value => normalize(value) === normalize(rightRaw));
      const leftValue = node.left.kind === 'offset'
        ? (() => { const context = model.contexts?.find(item => normalize(item.name) === normalize(leftRaw)); const current = assignment[context?.name]; return context && current !== undefined ? contextOps.shift(context, current, node.left.amount) : UNASSIGNED; })()
        : leftIsDomainLiteral ? leftRaw : leftVariable && !Object.prototype.hasOwnProperty.call(assignment, left) ? UNASSIGNED : effectiveValue(left, assignment, model) ?? left;
      const rightValue = node.right.kind === 'offset'
        ? (() => { const context = model.contexts?.find(item => normalize(item.name) === normalize(rightRaw)); const current = assignment[context?.name]; return context && current !== undefined ? contextOps.shift(context, current, node.right.amount) : UNASSIGNED; })()
        : rightIsDomainLiteral ? rightRaw : rightVariable && !Object.prototype.hasOwnProperty.call(assignment, right) ? UNASSIGNED : effectiveValue(right, assignment, model) ?? right;
      if (leftValue === UNASSIGNED || rightValue === UNASSIGNED) return UNKNOWN;
      if (rightGroup) return rightGroup.values.some(value => normalize(value) === normalize(leftValue));
      if (leftGroup) return leftGroup.values.some(value => normalize(value) === normalize(rightValue));
      const equal = normalize(leftValue) === normalize(rightValue);
      return node.operator === '==' ? equal : !equal;
    }
    const left = evaluate(node.left, assignment, model, subject, seen);
    const right = evaluate(node.right, assignment, model, subject, seen);
    if (node.kind === 'and') return logic.and(left, right);
    if (node.kind === 'or') return logic.or(left, right);
    if (node.kind === 'implies') return logic.implies(left, right);
    if (node.kind === 'iff') return logic.iff(left, right);
    return UNKNOWN;
  }

  function matchesType(type, value, assignment = {}, model = {}) {
    const policy = model.policies?.[normalize(type)];
    if (policy) {
      const state = Object.values(model.contexts || {}).map(context => assignment[context.name]).find(current => current != null && Object.prototype.hasOwnProperty.call(policy.states, normalize(current)));
      return state == null ? true : policy.states[normalize(state)] === value;
    }
    return type === 'alpha' ? value === true : type === 'beta' ? value === false : true;
  }

  function satisfiesCardinality(rule, assignment, model) {
    const values = rule.variables.map(name => {
      const variable = resolveName(name, model, name);
      return normalize(assignment[variable]) === normalize(rule.value);
    });
    const matched = values.filter(Boolean).length;
    if (rule.operator === 'exactly') return matched === rule.amount;
    if (rule.operator === 'atleast') return matched >= rule.amount;
    if (rule.operator === 'atmost') return matched <= rule.amount;
    return false;
  }

  function cardinalityCanStillSatisfy(rule, assignment, model) {
    const values = rule.variables.map(name => {
      const variable = resolveName(name, model, name);
      if (Object.prototype.hasOwnProperty.call(assignment, variable)) return normalize(assignment[variable]) === normalize(rule.value);
      const definition = model.variables?.find(item => item.name === variable);
      return definition?.domain.some(value => normalize(value) === normalize(rule.value)) ? UNKNOWN : false;
    });
    return (root.LPLConstraints?.cardinalityPossible || ((items, amount, operator) => {
      const yes = items.filter(value => value === true).length;
      const possible = yes + items.filter(value => value === UNKNOWN).length;
      return operator === 'exactly' ? yes <= amount && possible >= amount : operator === 'atleast' ? possible >= amount : yes <= amount;
    }))(values, rule.amount, rule.operator);
  }

  function conditionalRulesSatisfied(model, assignment) {
    for (const rule of model.rules || []) {
      let selected = null;
      for (const branch of rule.branches) {
        if (branch.condition == null) { selected = branch; break; }
        const group = Object.values(model.groups || {}).find(item => normalize(item.name) === normalize(branch.condition));
        const context = (model.contexts || []).find(item => group && group.values.some(value => normalize(value) === normalize(assignment[item.name])));
        if (context) { selected = branch; break; }
      }
      if (!selected) continue;
      for (const item of selected.assignments) {
        const name = resolveName(item.name, model, item.name);
        if (normalize(assignment[name]) !== normalize(item.value)) return false;
      }
    }
    return true;
  }

  function questionsSatisfied(model, assignment) {
    for (const question of model.questions || []) {
      if (!question.answers.length) continue;
      const value = evaluate(question.statement.expr, assignment, model, '?');
      const answer = value === true ? 'positive' : value === false ? 'negative' : 'blank';
      if (!question.answers.some(option => option.value === answer)) return false;
    }
    return true;
  }

  function entityRulesSatisfied(model, assignment) {
    for (const rule of model.entityRules || []) {
      const variable = resolveName(rule.variable, model, rule.variable);
      const target = assignment[variable];
      const statements = model.statements.filter(statement => {
        const subject = normalize(statement.subject);
        return subject === normalize(target) || normalize(target).startsWith(subject);
      });
      if (!statements.length) return false;
      const truth = statements.map(statement => evaluate(statement.expr, assignment, model, statement.subject));
      if (!truth.some(value => value === rule.truth)) return false;
    }
    return true;
  }

  function solve(model) {
    const solutions = [];
    const explanations = explanationOps.create();
    let searchNodes = 0;
    let searchLeaves = 0;
    let truncated = false;
    const threshold = Number.isInteger(model.options?.threshold) ? model.options.threshold : Infinity;
    const assignment = {};
    const typeNames = model.types;
    const exactOneEach = model.staters.length === typeNames.length;
    const counts = Object.fromEntries(typeNames.map(type => [type, 0]));
    const subjects = new Map(model.staters.map(value => [normalize(value), value]));
    const statementFor = subject => model.statements.filter(statement => {
      const key = normalize(statement.subject);
      return key === normalize(subject) || subjects.get(key) === subject;
    });
    const compatible = (type, value, assignment = {}) => matchesType(type, value, assignment, model);
    const propagated = root.LPLPropagate?.run(model, evaluate, compatible) || { domains: {}, rounds: 0, reductions: 0, contradiction: null };
    if (propagated.contradiction) {
      explanations.add({ kind: 'propagation', line: 0, message: propagated.contradiction });
      return { model, solutions, count: 0, exactOneEach, statistics: propagated, explanations: explanations.list() };
    }
    const variables = searchOps.orderVariables((model.variables || model.staters.map(name => ({ name, kind: 'stater', domain: typeNames }))).map(variable => ({
      ...variable,
      domain: propagated.domains[variable.name] ? [...propagated.domains[variable.name]] : variable.domain
    })));
    const visit = index => {
      if (truncated) return;
      searchNodes++;
      const failedPossibleRule = (model.cardinalityRules || []).find(rule => !cardinalityCanStillSatisfy(rule, assignment, model));
      if (failedPossibleRule) {
        explanations.add({ kind: 'cardinality', line: failedPossibleRule.line, message: `No remaining values can satisfy ${failedPossibleRule.operator} ${failedPossibleRule.amount} of ${failedPossibleRule.variables.join(', ')} == ${failedPossibleRule.value}.` });
        return;
      }
      if (index === variables.length) {
        searchLeaves++;
        if (exactOneEach && typeNames.some(type => counts[type] !== 1)) {
          explanations.add({ kind: 'cardinality', line: 0, message: 'A world did not assign exactly one stater to each type.' });
          return;
        }
        if (!conditionalRulesSatisfied(model, assignment)) return;
        if (!entityRulesSatisfied(model, assignment)) {
          explanations.add({ kind: 'entity rule', line: 0, message: 'An entity statement-truth rule is not satisfied.' });
          return;
        }
        if (!questionsSatisfied(model, assignment)) {
          explanations.add({ kind: 'question', line: 0, message: 'A question answer is not allowed by its answer block.' });
          return;
        }
        const failedRule = (model.cardinalityRules || []).find(rule => !satisfiesCardinality(rule, assignment, model));
        if (failedRule) {
          explanations.add({ kind: 'cardinality', line: failedRule.line, message: `${failedRule.operator} ${failedRule.amount} of ${failedRule.variables.join(', ')} must equal ${failedRule.value}.` });
          return;
        }
        const values = model.statements.map(statement => ({ statement, value: evaluate(statement.expr, assignment, model, statement.subject) }));
        const failedStatement = values.find(({ statement, value }) => statement.expr.kind !== 'hole' && statement.subject !== '?' && !statementOps.isAnonymous(statement.subject) && !matchesType(assignment[resolveName(statement.subject, model, statement.subject)], value, assignment, model));
        if (failedStatement) {
          explanations.add({ kind: 'statement', line: failedStatement.statement.line, message: `${failedStatement.statement.subject}'s statement is incompatible with ${assignment[resolveName(failedStatement.statement.subject, model, failedStatement.statement.subject)]}.` });
          return;
        }
        solutions.push({ assignment: { ...assignment }, values });
        if (solutions.length >= threshold) truncated = true;
        return;
      }
      const variable = variables[index];
      for (const value of variable.domain) {
        if (variable.kind === 'stater' && exactOneEach && counts[value]) continue;
        assignment[variable.name] = value;
        if (variable.kind === 'stater') counts[value]++;
        const relevant = variable.kind === 'stater' ? statementFor(variable.name) : [];
        const failedPartial = relevant.find(statement => {
          const value = evaluate(statement.expr, assignment, model, variable.name);
          return value !== UNKNOWN && !matchesType(assignment[variable.name], value, assignment, model);
        });
        if (failedPartial) explanations.add({ kind: 'statement', line: failedPartial.line, message: `${failedPartial.subject}'s statement is incompatible with ${assignment[variable.name]}.` });
        else visit(index + 1);
        if (variable.kind === 'stater') counts[value]--;
        delete assignment[variable.name];
      }
    };
    visit(0);
    return { model, solutions, count: solutions.length, exactOneEach, statistics: { ...propagated, searchNodes, searchLeaves, variableOrder: variables.map(variable => variable.name), threshold, truncated }, explanations: explanations.list() };
  }

  function query(result, command) {
    const argument = command.argument;
    if (command.name === 'try') {
      const match = argument.match(/^([^:=]+)\s*:=\s*([A-Za-z_][A-Za-z0-9_]*)$/);
      if (!match) throw new ErrorType('Try expects "Stater := type"', command.line);
      const stater = resolveName(match[1].trim(), result.model, match[1].trim());
      const type = normalize(match[2]);
      return { ...command, count: result.solutions.filter(solution => normalize(solution.assignment[stater]) === type).length };
    }
    const brute = argument.match(/^(\d+)\s*:\s*brute$/i);
    if (brute) return { ...command, brute: synthesize(result, Number(brute[1])) };
    const all = !argument || /^all$/i.test(argument);
    const references = !all ? argument.split(/[\s,]+/).filter(Boolean).filter(name => /^\d+:$/.test(name)) : [];
    const names = all ? (result.model.variables || result.model.staters.map(name => ({ name }))).map(variable => variable.name) : argument.split(/[\s,]+/).filter(Boolean).filter(name => !/^\d+:$/.test(name)).map(name => resolveName(name, result.model, name));
    const field = ['value', 'possible', 'impossible'].includes(command.target) ? command.target : 'assignment';
    const choices = names.map(name => {
      const variable = result.model.variables?.find(item => item.name === name);
      const possible = [...new Set(result.solutions.map(solution => solution.assignment[name]).filter(value => value != null))];
      const impossible = variable ? variable.domain.filter(value => !possible.some(candidate => normalize(candidate) === normalize(value))) : [];
      return { name, possible, impossible };
    });
    references.forEach(reference => {
      const id = Number(reference.slice(0, -1));
      const possible = [...new Set(result.solutions.map(solution => {
        const value = solution.values.find(item => item.statement.id === id)?.value;
        return value === true ? 'true' : value === false ? 'false' : 'unknown';
      }))];
      choices.push({ name: reference, possible, impossible: ['true', 'false', 'unknown'].filter(value => !possible.includes(value)) });
    });
    return { ...command, names, field, all, choices };
  }

  function synthesize(result, id) {
    const statement = result.model.statementsById?.[id] || result.model.statements.find(item => item.id === id);
    if (!statement || statement.expr.kind !== 'hole') return { error: 'Brute synthesis requires a blank statement.' };
    const names = ['self', ...(result.model.variables || []).map(variable => variable.name), ...result.model.types];
    const candidates = [];
    const seen = new Set();
    const add = (left, operator, right) => {
      const text = `${left} ${operator} ${right}`;
      if (seen.has(text)) return;
      seen.add(text);
      const expr = { kind: 'compare', operator, left: { kind: 'name', value: left }, right: { kind: 'name', value: right } };
      const compatible = result.solutions.some(solution => {
        const value = evaluate(expr, solution.assignment, result.model, statement.subject);
        return statement.subject === '?' || statement.subject === '_' || matchesType(solution.assignment[resolveName(statement.subject, result.model, statement.subject)], value, solution.assignment, result.model);
      });
      if (compatible) candidates.push({ text, expr });
    };
    for (const left of names) for (const right of names) { add(left, '==', right); add(left, '!=', right); }
    return { statementId: id, candidates: candidates.slice(0, 100).map(candidate => candidate.text), truncated: candidates.length > 100 };
  }

  const api = { evaluate, solve, query, UNKNOWN };
  root.LPLSolver = api;
  if (typeof module !== 'undefined') module.exports = api;
})(typeof window === 'undefined' ? globalThis : window);
