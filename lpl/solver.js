'use strict';

(function (root) {
  const ErrorType = root.LPLRuntime?.Error || class extends Error {};
  const UNKNOWN = null;
  const UNASSIGNED = root.LPLConstraints?.UNASSIGNED || Symbol('lpl.unassigned');
  const normalize = value => String(value).toLowerCase();

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

  function evaluate(node, assignment, model, subject) {
    if (node.kind === 'name') return resolveName(node.value, model, subject);
    if (node.kind === 'compare') {
      const left = resolveName(node.left.value, model, subject);
      const right = resolveName(node.right.value, model, subject);
      const leftVariable = model.variables?.find(variable => variable.name === left);
      const rightVariable = model.variables?.find(variable => variable.name === right);
      const leftIsDomainLiteral = rightVariable?.domain.some(value => normalize(value) === normalize(node.left.value));
      const rightIsDomainLiteral = leftVariable?.domain.some(value => normalize(value) === normalize(node.right.value));
      const leftValue = leftIsDomainLiteral ? node.left.value : leftVariable && !Object.prototype.hasOwnProperty.call(assignment, left) ? UNASSIGNED : assignment[left] ?? left;
      const rightValue = rightIsDomainLiteral ? node.right.value : rightVariable && !Object.prototype.hasOwnProperty.call(assignment, right) ? UNASSIGNED : assignment[right] ?? right;
      if (leftValue === UNASSIGNED || rightValue === UNASSIGNED) return UNKNOWN;
      const equal = normalize(leftValue) === normalize(rightValue);
      return node.operator === '==' ? equal : !equal;
    }
    const left = evaluate(node.left, assignment, model, subject);
    const right = evaluate(node.right, assignment, model, subject);
    if (node.kind === 'and') return left === false || right === false ? false : left === true && right === true ? true : UNKNOWN;
    if (node.kind === 'or') return left === true || right === true ? true : left === false && right === false ? false : UNKNOWN;
    return UNKNOWN;
  }

  function matchesType(type, value) {
    return type === 'alpha' ? value === true : type === 'beta' ? value === false : true;
  }

  function solve(model) {
    const solutions = [];
    const assignment = {};
    const typeNames = model.types;
    const exactOneEach = model.staters.length === typeNames.length;
    const counts = Object.fromEntries(typeNames.map(type => [type, 0]));
    const subjects = new Map(model.staters.map(value => [normalize(value), value]));
    const statementFor = subject => model.statements.filter(statement => {
      const key = normalize(statement.subject);
      return key === normalize(subject) || subjects.get(key) === subject;
    });
    const variables = model.variables || model.staters.map(name => ({ name, kind: 'stater', domain: typeNames }));
    const visit = index => {
      if (index === variables.length) {
        if (exactOneEach && typeNames.some(type => counts[type] !== 1)) return;
        const values = model.statements.map(statement => ({ statement, value: evaluate(statement.expr, assignment, model, statement.subject) }));
        if (values.some(({ statement, value }) => !matchesType(assignment[resolveName(statement.subject, model, statement.subject)], value))) return;
        solutions.push({ assignment: { ...assignment }, values });
        return;
      }
      const variable = variables[index];
      for (const value of variable.domain) {
        if (variable.kind === 'stater' && exactOneEach && counts[value]) continue;
        assignment[variable.name] = value;
        if (variable.kind === 'stater') counts[value]++;
        const relevant = variable.kind === 'stater' ? statementFor(variable.name) : [];
        const valid = relevant.every(statement => {
          const value = evaluate(statement.expr, assignment, model, variable.name);
          return value === UNKNOWN || matchesType(assignment[variable.name], value);
        });
        if (valid) visit(index + 1);
        if (variable.kind === 'stater') counts[value]--;
        delete assignment[variable.name];
      }
    };
    visit(0);
    return { model, solutions, count: solutions.length, exactOneEach };
  }

  function query(result, command) {
    const argument = command.argument;
    const names = argument && !/^all$/i.test(argument) ? argument.split(/[\s,]+/).filter(Boolean).map(name => resolveName(name, result.model, name)) : result.model.staters;
    if (command.name === 'try') {
      const match = argument.match(/^([^:=]+)\s*:=\s*([A-Za-z_][A-Za-z0-9_]*)$/);
      if (!match) throw new ErrorType('Try expects "Stater := type"', command.line);
      const stater = resolveName(match[1].trim(), result.model, match[1].trim());
      const type = normalize(match[2]);
      return { ...command, count: result.solutions.filter(solution => normalize(solution.assignment[stater]) === type).length };
    }
    const field = command.target === 'value' ? 'values' : 'assignment';
    return { ...command, names, field };
  }

  const api = { evaluate, solve, query, UNKNOWN };
  root.LPLSolver = api;
  if (typeof module !== 'undefined') module.exports = api;
})(typeof window === 'undefined' ? globalThis : window);
