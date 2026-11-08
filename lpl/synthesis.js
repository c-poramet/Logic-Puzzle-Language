'use strict';

(function (root) {
  const UNKNOWN = root.LPLSolver?.UNKNOWN ?? null;
  const normalize = value => String(value).toLowerCase();

  function expressionText(node) {
    if (node.kind === 'name') return node.value;
    if (node.kind === 'compare') return `${expressionText(node.left)} ${node.operator} ${expressionText(node.right)}`;
    if (node.kind === 'not') return `not (${expressionText(node.value)})`;
    if (node.kind === 'and' || node.kind === 'or') return `(${expressionText(node.left)} ${node.kind} ${expressionText(node.right)})`;
    return '?';
  }

  function cloneNode(node) {
    if (!node || typeof node !== 'object') return node;
    return Object.fromEntries(Object.entries(node).map(([key, value]) => [key, cloneNode(value)]));
  }

  function modelNames(model, subjects) {
    const names = ['self', ...subjects, ...model.staters, ...model.types];
    for (const variable of model.variables || []) {
      names.push(variable.name, ...(variable.domain || []));
    }
    return [...new Set(names.map(String))];
  }

  function atomExpressions(model, subjects) {
    const names = modelNames(model, subjects);
    const expressions = [];
    const seen = new Set();
    const add = (left, operator, right) => {
      if (left === right) return;
      const node = { kind: 'compare', operator, left: { kind: 'name', value: left }, right: { kind: 'name', value: right } };
      const text = expressionText(node);
      if (seen.has(text)) return;
      seen.add(text);
      expressions.push({ text, expr: node, depth: 0 });
    };
    for (const left of names) for (const right of names) {
      add(left, '==', right);
      add(left, '!=', right);
    }
    return expressions;
  }

  function generateExpressions(model, subjects, options) {
    const maxDepth = Math.max(0, Number.isInteger(options.maxDepth) ? options.maxDepth : 1);
    const maxExpressions = Math.max(1, Number.isInteger(options.maxExpressions) ? options.maxExpressions : 512);
    const atoms = atomExpressions(model, subjects);
    const expressions = atoms.slice(0, maxExpressions);
    if (maxDepth < 1 || expressions.length >= maxExpressions) return { expressions, truncated: atoms.length > expressions.length };

    const seen = new Set(expressions.map(item => item.text));
    const add = node => {
      const text = expressionText(node);
      if (seen.has(text) || expressions.length >= maxExpressions) return;
      seen.add(text);
      expressions.push({ text, expr: node, depth: 1 });
    };
    for (const atom of atoms) add({ kind: 'not', value: cloneNode(atom.expr) });
    for (let left = 0; left < atoms.length; left++) {
      for (let right = left; right < atoms.length; right++) {
        add({ kind: 'or', left: cloneNode(atoms[left].expr), right: cloneNode(atoms[right].expr) });
        add({ kind: 'and', left: cloneNode(atoms[left].expr), right: cloneNode(atoms[right].expr) });
        if (expressions.length >= maxExpressions) break;
      }
      if (expressions.length >= maxExpressions) break;
    }
    return { expressions, truncated: expressions.length >= maxExpressions };
  }

  function combineNodes(nodes, kind) {
    return nodes.slice(1).reduce((left, right) => ({ kind, left, right }), nodes[0]);
  }

  function kMapExpression(model, subjects, subject, worlds, evaluate, matchesType, goals, options) {
    const atoms = atomExpressions(model, subjects).map(candidate => ({
      ...candidate,
      values: worlds.map(world => evaluate(candidate.expr, world.assignment, model, subject))
    })).filter(candidate => candidate.values.every(value => value === true || value === false));
    const features = atoms.filter(candidate => new Set(candidate.values).size > 1).slice(0, options.maxKMapFeatures || 8);
    const desired = worlds.map(world => {
      const type = world.assignment[subject];
      const canBeTrue = matchesSpeaker(type, true, world.assignment, model, goals, matchesType);
      const canBeFalse = matchesSpeaker(type, false, world.assignment, model, goals, matchesType);
      return canBeTrue && !canBeFalse ? true : canBeFalse && !canBeTrue ? false : null;
    });
    const trueRows = desired.map((value, index) => value === true ? index : -1).filter(index => index >= 0);
    const falseRows = desired.map((value, index) => value === false ? index : -1).filter(index => index >= 0);
    if (!trueRows.length || !features.length) return null;

    const featureValue = (feature, row) => feature.values[row] === true;
    const literalOptions = trueRows.map(row => features.flatMap((feature, index) => {
      if (featureValue(feature, row)) return [{ index, positive: true }, { index, positive: false }];
      return [];
    }));
    const covers = literals => worlds.map((_, row) => row).filter(row => literals.every(literal => featureValue(features[literal.index], row) === literal.positive));
    const findTerm = row => {
      const optionsForRow = literalOptions[trueRows.indexOf(row)] || [];
      for (let size = 1; size <= Math.min(options.maxKMapLiterals || 3, optionsForRow.length); size++) {
        let found = null;
        const choose = (start, selected) => {
          if (found) return;
          if (selected.length === size) {
            if (new Set(selected.map(literal => literal.index)).size !== selected.length) return;
            const covered = covers(selected);
            if (!covered.includes(row) || covered.some(value => falseRows.includes(value))) return;
            found = { literals: selected.slice(), covered };
            return;
          }
          for (let index = start; index < optionsForRow.length; index++) choose(index + 1, [...selected, optionsForRow[index]]);
        };
        choose(0, []);
        if (found) return found;
      }
      return null;
    };
    const terms = trueRows.map(row => findTerm(row)).filter(Boolean);
    const selectedTerms = [];
    const uncovered = new Set(trueRows);
    while (uncovered.size && terms.length) {
      const best = terms.filter(term => term.covered.some(row => uncovered.has(row))).sort((left, right) => {
        const leftCoverage = left.covered.filter(row => uncovered.has(row)).length;
        const rightCoverage = right.covered.filter(row => uncovered.has(row)).length;
        return rightCoverage - leftCoverage || left.literals.length - right.literals.length;
      })[0];
      if (!best) break;
      selectedTerms.push(best);
      best.covered.forEach(row => uncovered.delete(row));
    }
    if (uncovered.size) return null;
    const termNodes = selectedTerms.map(term => combineNodes(term.literals.map(literal => literal.positive ? cloneNode(features[literal.index].expr) : { kind: 'not', value: cloneNode(features[literal.index].expr) }), 'and'));
    const expr = termNodes.length === 1 ? termNodes[0] : combineNodes(termNodes, 'or');
    return { text: expressionText(expr), expr, depth: 1, method: 'kmap' };
  }

  function kMapExpressions(model, subjects, worlds, evaluate, matchesType, goals, options) {
    return Object.fromEntries(subjects.map(subject => {
      const candidate = kMapExpression(model, subjects, subject, worlds, evaluate, matchesType, goals, options);
      return [subject, candidate ? [candidate] : []];
    }));
  }

  function goalPolicies(goals) {
    const policies = {};
    for (const goal of goals) {
      if (goal.kind !== 'truth-policy') continue;
      for (const role of goal.roles || []) policies[normalize(role)] = goal.truth;
    }
    return policies;
  }

  function matchesSpeaker(type, value, assignment, model, goals, matchesType) {
    const policies = goalPolicies(goals);
    const policy = policies[normalize(type)];
    if (policy !== undefined) return policy === value;
    return matchesType(type, value, assignment, model);
  }

  function goalProjection(goal, goals) {
    if (goal.projection && normalize(goal.projection) !== 'identity') return goal.projection;
    const joint = goals.find(item => item.kind === 'joint-possible-identities' && item.projection);
    return joint?.projection || 'god';
  }

  function identitySet(worlds, projection, subjects) {
    const identities = new Set();
    for (const world of worlds) {
      for (const subject of subjects) {
        if (normalize(world.assignment[subject]) === normalize(projection)) identities.add(subject);
      }
    }
    return [...identities].sort((left, right) => left.localeCompare(right));
  }

  function satisfiesCardinality(world, goal) {
    const matched = (goal.variables || []).filter(name => normalize(world.assignment[name]) === normalize(goal.value)).length;
    if (goal.operator === 'exactly') return matched === goal.amount;
    if (goal.operator === 'atleast') return matched >= goal.amount;
    if (goal.operator === 'atmost') return matched <= goal.amount;
    return false;
  }

  function applyWorldGoals(worlds, goals) {
    return worlds.filter(world => goals.filter(goal => goal.kind === 'cardinality').every(goal => satisfiesCardinality(world, goal)));
  }

  function evaluateCandidate(candidate, worlds, subject, model, evaluate, matchesType, goals) {
    return worlds.filter(world => {
      const value = evaluate(candidate.expr, world.assignment, model, subject);
      return value !== UNKNOWN && matchesSpeaker(world.assignment[subject], value, world.assignment, model, goals, matchesType);
    });
  }

  function checkGoals(tuple, baseWorlds, subjects, goals) {
    const jointGoals = goals.filter(goal => goal.kind === 'joint-possible-identities');
    const aloneGoals = goals.filter(goal => goal.kind === 'each-alone-insufficient');
    const fixedGoals = goals.filter(goal => goal.kind === 'identity-fixed');
    const ambiguousGoals = goals.filter(goal => goal.kind === 'identity-ambiguous');
    const jointProjection = jointGoals[0] ? goalProjection(jointGoals[0], goals) : 'god';
    const possibleIdentities = identitySet(tuple.jointWorlds, jointProjection, subjects);
    const checks = {
      cardinality: true,
      jointPossibleIdentities: jointGoals.every(goal => identitySet(tuple.jointWorlds, goalProjection(goal, goals), subjects).length === goal.amount),
      eachAloneInsufficient: aloneGoals.every(() => tuple.singleWorlds.every(worlds => identitySet(worlds, jointProjection, subjects).length > 1)),
      fixedIdentities: fixedGoals.every(goal => tuple.jointWorlds.length > 0 && tuple.jointWorlds.every(world => normalize(world.assignment[goal.subject]) === normalize(goal.value))),
      ambiguousIdentities: ambiguousGoals.every(goal => new Set(tuple.jointWorlds.map(world => normalize(world.assignment[goal.subject]))).size > 1)
    };
    return {
      pass: Object.values(checks).every(Boolean),
      checks,
      possibleIdentities,
      singlePossibleIdentities: tuple.singleWorlds.map(worlds => identitySet(worlds, jointProjection, subjects)),
      survivingWorlds: tuple.jointWorlds.length,
      baseWorlds: baseWorlds.length
    };
  }

  function generate(result, options = {}) {
    const model = result.model;
    const evaluate = options.evaluate;
    const matchesType = options.matchesType;
    const subjects = [...new Set((options.subjects || []).map(value => String(value)).filter(Boolean))];
    const goals = model.goals || [];
    const synthesisGoal = goals.find(goal => goal.kind === 'statement-synthesis');
    const sourceSubjects = subjects.length ? subjects : synthesisGoal?.subjects || [];
    const statementCount = options.statementCount || synthesisGoal?.statementCount || null;
    const requestedSubjects = statementCount && sourceSubjects.length
      ? Array.from({ length: statementCount }, (_, index) => sourceSubjects[index % sourceSubjects.length])
      : sourceSubjects;
    if (!requestedSubjects.length) return { kind: 'statement-synthesis', supported: false, message: 'Statement synthesis needs at least one subject.' };
    const unknownSubjects = requestedSubjects.filter(subject => !model.staters.some(name => normalize(name) === normalize(subject)));
    if (unknownSubjects.length) return { kind: 'statement-synthesis', supported: false, message: `Unknown statement subject(s): ${unknownSubjects.join(', ')}.` };
    if (typeof evaluate !== 'function' || typeof matchesType !== 'function') return { kind: 'statement-synthesis', supported: false, message: 'Statement synthesis is unavailable in this runtime.' };

    const baseWorlds = applyWorldGoals(result.solutions || [], goals);
    const expressionResult = generateExpressions(model, requestedSubjects, options);
    const kMapData = options.method === 'kmap' ? kMapExpressions(model, requestedSubjects, baseWorlds, evaluate, matchesType, goals, options) : null;
    const expressionData = requestedSubjects.map(subject => {
      const candidates = kMapData?.[subject]?.length ? [...kMapData[subject], ...expressionResult.expressions] : expressionResult.expressions;
      const seen = new Set();
      return candidates.filter(candidate => {
        if (seen.has(candidate.text)) return false;
        seen.add(candidate.text);
        return true;
      }).map(candidate => ({ ...candidate, subject }));
    });
    const candidateWorlds = expressionData.map(candidates => candidates.map(candidate => evaluateCandidate(candidate, baseWorlds, candidate.subject, model, evaluate, matchesType, goals)));
    const maxTuples = Math.max(1, Number.isInteger(options.maxTuples) ? options.maxTuples : 50000);
    const maxResults = Math.max(1, Number.isInteger(options.maxResults) ? options.maxResults : 25);
    const tuples = [];
    let tupleCount = 0;
    let truncated = expressionResult.truncated;
    const visit = (index, selected, worlds) => {
      if (tuples.length >= maxResults || tupleCount >= maxTuples) { truncated = true; return; }
      if (index === requestedSubjects.length) {
        tupleCount++;
        const singleWorlds = selected.map((candidate, candidateIndex) => candidateWorlds[candidateIndex][candidate.index]);
        const detail = checkGoals({ jointWorlds: worlds, singleWorlds }, baseWorlds, requestedSubjects, goals);
        if (!detail.pass) return;
        tuples.push({
          statements: selected.map((candidate, candidateIndex) => ({ subject: requestedSubjects[candidateIndex], text: candidate.text, expr: cloneNode(candidate.expr) })),
          ...detail
        });
        return;
      }
      for (let candidateIndex = 0; candidateIndex < expressionData[index].length; candidateIndex++) {
        const candidate = expressionData[index][candidateIndex];
        const nextWorlds = worlds.filter(world => candidateWorlds[index][candidateIndex].includes(world));
        visit(index + 1, [...selected, { ...candidate, index: candidateIndex }], nextWorlds);
        if (tuples.length >= maxResults || tupleCount >= maxTuples) { truncated = true; return; }
      }
    };
    visit(0, [], baseWorlds);
    return {
      kind: 'statement-synthesis',
      supported: true,
      subjects: requestedSubjects,
      tuples,
      baseWorlds: baseWorlds.length,
      expressionCount: expressionResult.expressions.length,
      tupleCount,
      truncated,
      method: options.method === 'kmap' ? 'kmap' : 'default',
      limits: { maxDepth: options.maxDepth ?? 1, maxExpressions: options.maxExpressions ?? 512, maxTuples, maxResults }
    };
  }

  const api = { generate, expressionText };
  root.LPLSynthesis = api;
  if (typeof module !== 'undefined') module.exports = api;
})(typeof window === 'undefined' ? globalThis : window);
