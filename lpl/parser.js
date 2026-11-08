'use strict';

(function (root) {
  const ErrorType = root.LPLRuntime?.Error || class extends Error {};
  const contexts = root.LPLContexts || { expandCase: values => values.filter(value => value !== '...') };
  const keywords = new Set(['and', 'or']);

  function tokenize(text, line) {
    const tokens = [];
    const pattern = /\s*(<=>|=>|==|!=|[+-]|[{}]|\(|\)|:|,|[A-Za-z_][A-Za-z0-9_]*|\d+)/g;
    let match;
    let end = 0;
    while ((match = pattern.exec(text))) {
      if (text.slice(end, match.index).trim()) throw new ErrorType(`Unexpected character "${text.slice(end, match.index).trim()[0]}"`, line);
      tokens.push(match[1]);
      end = pattern.lastIndex;
    }
    if (text.slice(end).trim()) throw new ErrorType(`Unexpected character "${text.slice(end).trim()[0]}"`, line);
    return tokens;
  }

  function expression(text, line) {
    const tokens = tokenize(text, line);
    let position = 0;
    const peek = () => tokens[position];
    const next = () => tokens[position++];
    const fail = message => { throw new ErrorType(message, line); };
    const primary = () => {
      if (peek() === '(') {
        next();
        const node = implication();
        if (next() !== ')') fail('Expected ")"');
        node.grouped = true;
        return node;
      }
      if (peek()?.toLowerCase() === 'on') {
        next();
        let values = [];
        const target = next();
        if (target === '{') {
          while (peek() && peek() !== '}') { if (peek() !== ',') values.push(next()); else next(); }
          if (next() !== '}') fail('Expected "}" after context guard');
        } else {
          values = [target];
        }
        if (!values[0]) fail('Expected a context value after "on"');
        return { kind: 'guard', values, value: implication() };
      }
      const value = next();
      if (!value || keywords.has(value.toLowerCase()) || value === ')' || value === '==' || value === '!=') fail('Expected a name');
      if ((peek() === '+' || peek() === '-') && /^\d+$/.test(tokens[position + 1] || '')) {
        const amount = Number(next() + next());
        return { kind: 'offset', name: value, amount };
      }
      return { kind: 'name', value };
    };
    const comparison = () => {
      if (peek()?.toLowerCase() === 'not') {
        next();
        return { kind: 'not', value: peek() === '(' ? primary() : comparison() };
      }
      const left = primary();
      if (left.kind === 'guard') return left;
      if (left.grouped && !['name', 'offset'].includes(left.kind)) return left;
      const operator = next();
      if (operator !== '==' && operator !== '!=') fail('Expected "==" or "!="');
      return { kind: 'compare', operator, left, right: primary() };
    };
    const conjunction = () => {
      let node = comparison();
      while (peek()?.toLowerCase() === 'and') { next(); node = { kind: 'and', left: node, right: comparison() }; }
      return node;
    };
    const disjunction = () => {
      let node = conjunction();
      while (peek()?.toLowerCase() === 'or') { next(); node = { kind: 'or', left: node, right: conjunction() }; }
      return node;
    };
    const implication = () => {
      const left = disjunction();
      if (peek() === '=>' || peek() === '<=>') {
        const operator = next();
        return { kind: operator === '=>' ? 'implies' : 'iff', left, right: implication() };
      }
      return left;
    };
    if (!tokens.length) fail('Statement cannot be blank');
    let result = implication();
    if (peek()?.toLowerCase() === 'on') {
      next();
      const context = next();
      if (!context) fail('Expected a context after "on"');
      let amount = 0;
      if (peek() === '+' || peek() === '-') {
        const sign = next();
        const digits = next();
        if (!/^\d+$/.test(digits || '')) fail('Expected an integer context offset');
        amount = Number(`${sign}${digits}`);
      }
      result = { kind: 'at', context, amount, value: result };
    }
    if (position < tokens.length) fail(`Unexpected "${peek()}"`);
    return result;
  }

  function splitStatementExpressions(text) {
    const parts = [];
    let start = 0;
    let depth = 0;
    for (let index = 0; index < text.length; index++) {
      const character = text[index];
      if ('([{'.includes(character)) depth++;
      else if (')]}'.includes(character)) depth--;
      else if (character === ':' && depth === 0 && !/if\s+(?:\d+|-)\s*$/i.test(text.slice(start, index))) {
        parts.push(text.slice(start, index).trim());
        start = index + 1;
      }
    }
    parts.push(text.slice(start).trim());
    return parts.filter(Boolean);
  }

  function parse(source) {
    const lines = source.split(/\r?\n/);
    let section = '';
    let activeQuestion = null;
    let activePolicy = null;
    const model = { staters: [], types: [], valueVariables: [], cardinalityRules: [], caseDeclarations: [], groups: [], rules: [], entityRules: [], policies: {}, truthPolicies: {}, goals: [], statements: [], questions: [], commands: [], options: {} };
    let activeRule = null;
    lines.forEach((raw, index) => {
      const line = index + 1;
      const text = raw.replace(/#.*/, '').trim();
      if (!text) return;
      const indent = raw.match(/^\s*/)[0].length;
      const upper = text.toUpperCase();
      if (upper === 'SETUP' || upper === 'STATEMENTS' || upper === 'GOALS') { section = upper; activePolicy = null; return; }
      if (upper === 'SOLVE') { section = 'SOLVE'; return; }
      if (section === 'STATEMENTS' && indent > 0 && activeQuestion) {
        const answer = text.match(/^_\s*(\d+)?\s*:\s*(positive|negative|blank)$/i);
        if (!answer) throw new ErrorType('Question answers must be positive, negative, or blank', line);
        activeQuestion.answers.push({ id: answer[1] ? Number(answer[1]) : activeQuestion.answers.length + 1, value: answer[2].toLowerCase(), line });
        return;
      }
      if (indent === 0) activeQuestion = null;
      if (section === 'SETUP') {
        const roleTruth = text.match(/^role\s+([A-Za-z_][A-Za-z0-9_]*)\s+is\s+(truthful|lying|true|false)$/i);
        if (roleTruth) {
          model.truthPolicies[roleTruth[1].toLowerCase()] = { truth: /^(truthful|true)$/i.test(roleTruth[2]), line };
          return;
        }
        const policyTruth = text.match(/^policy\s+([A-Za-z_][A-Za-z0-9_]*)\s+says\s+(true|false)$/i);
        if (policyTruth) {
          model.truthPolicies[policyTruth[1].toLowerCase()] = { truth: policyTruth[2].toLowerCase() === 'true', line };
          return;
        }
        const policyStart = text.match(/^policy\s+([A-Za-z_][A-Za-z0-9_]*)\s*:\s*$/i);
        if (policyStart) { activePolicy = { type: policyStart[1].toLowerCase(), states: {}, line }; model.policies[activePolicy.type] = activePolicy; return; }
        if (activePolicy && indent > 0) {
          const policyEntry = text.match(/^([A-Za-z_][A-Za-z0-9_]*)\s*=>\s*(true|false)$/i);
          if (!policyEntry) throw new ErrorType('Policy entries must map a context value to true or false', line);
          activePolicy.states[policyEntry[1].toLowerCase()] = policyEntry[2].toLowerCase() === 'true';
          return;
        }
        if (indent === 0) activePolicy = null;
          if (/^types\s+may\s+repeat$/i.test(text)) { model.options.exactOneEach = false; return; }
        let ruleMatch = text.match(/^if\s+([A-Za-z_][A-Za-z0-9_]*)\s+then$/i);
        if (ruleMatch) {
          activeRule = { branches: [{ condition: ruleMatch[1], assignments: [] }], line };
          model.rules.push(activeRule);
          return;
        }
        ruleMatch = text.match(/^elseif\s+([A-Za-z_][A-Za-z0-9_]*)\s+then$/i);
        if (ruleMatch && activeRule) { activeRule.branches.push({ condition: ruleMatch[1], assignments: [] }); return; }
        if (/^else$/i.test(text) && activeRule) { activeRule.branches.push({ condition: null, assignments: [] }); return; }
        if (/^end$/i.test(text) && activeRule) { activeRule = null; return; }
        if (activeRule) {
          const assignment = text.match(/^([^:]+?)\s*:=\s*(.+)$/);
          if (assignment) {
            const names = assignment[1].split(/[\s,]+/).filter(Boolean);
            const values = assignment[2].split(/[\s,]+/).filter(Boolean);
            if (names.length !== values.length) throw new ErrorType('Conditional assignments need one type per stater', line);
            activeRule.branches.at(-1).assignments.push(...names.map((name, index) => ({ name, value: values[index], line })));
            return;
          }
        }
        const entityRule = text.match(/^(?:rule|constraint)\s+([A-Za-z_][A-Za-z0-9_]*)\s+(?:made\s+)?(?:a\s+)?(true|false)\s+statement$/i);
        if (entityRule) { model.entityRules.push({ kind: 'entity-statement-truth', variable: entityRule[1], truth: entityRule[2].toLowerCase() === 'true', line }); return; }
        let match = text.match(/^stater\s+(.+)$/i);
        if (match) { model.staters.push(...match[1].split(/[\s,]+/).filter(Boolean)); return; }
        match = text.match(/^type\s+(.+)$/i);
        if (match) { model.types.push(...match[1].split(/[\s,]+/).filter(Boolean).map(value => value.toLowerCase())); return; }
        match = text.match(/^var\s+([A-Za-z_][A-Za-z0-9_]*)\s+in\s*\{([^}]*)\}$/i);
        if (match) {
          const values = match[2].split(/[\s,]+/).filter(Boolean);
          if (!values.length) throw new ErrorType(`Variable "${match[1]}" must have at least one value`, line);
          model.valueVariables.push({ name: match[1], kind: 'value', domain: values });
          return;
        }
        match = text.match(/^case\s+([A-Za-z_][A-Za-z0-9_]*)\s+(.+)$/i);
        if (match) {
          const rawValues = match[2].split(/[\s,]+/).filter(Boolean);
          const wrap = rawValues.some(value => value.toLowerCase() === 'wrap');
          const values = rawValues.filter(value => value.toLowerCase() !== 'wrap');
          const expanded = contexts.expandCase(values);
          if (!expanded.length) throw new ErrorType(`Case "${match[1]}" must have values`, line);
          model.caseDeclarations.push({ name: match[1], values: expanded, wrap, line });
          return;
        }
        match = text.match(/^group\s+([A-Za-z_][A-Za-z0-9_]*)\s*=\s*\{([^}]*)\}$/i);
        if (match) {
          const values = match[2].split(/[\s,]+/).filter(Boolean);
          if (!values.length) throw new ErrorType(`Group "${match[1]}" must have values`, line);
          model.groups.push({ name: match[1], values, line });
          return;
        }
        match = text.match(/^(exactly|atleast|atmost)\s+(\d+)\s+of\s+(.+?)\s*==\s*([A-Za-z_][A-Za-z0-9_]*)$/i);
        if (match) {
          const variables = match[3].split(/[\s,]+/).filter(Boolean);
          if (!variables.length) throw new ErrorType('A cardinality rule needs at least one variable', line);
          model.cardinalityRules.push({ kind: 'cardinality', operator: match[1].toLowerCase(), amount: Number(match[2]), variables, value: match[4], line });
          return;
        }
        match = text.match(/^threshold\s*=\s*(\d+)$/i);
        if (match) { model.options.threshold = Math.max(1, Number(match[1])); return; }
        throw new ErrorType('Expected a stater, type, or threshold declaration', line);
      }
      if (section === 'GOALS') {
        let goalMatch = text.match(/^generate\s+statements?\s+for\s+(.+)$/i);
        if (goalMatch) {
          const subjects = goalMatch[1].split(/[\s,]+/).filter(Boolean);
          if (!subjects.length) throw new ErrorType('Statement generation needs at least one subject', line);
          model.goals.push({ kind: 'statement-synthesis', subjects, line });
          return;
        }
        goalMatch = text.match(/^(?:together|jointly)\s+leave\s+exactly\s+(\d+)\s+possible\s+(.+?)\s+identit(?:y|ies)$/i);
        if (goalMatch) {
          model.goals.push({ kind: 'joint-possible-identities', amount: Number(goalMatch[1]), projection: goalMatch[2].replace(/^the\s+/i, '').trim(), line });
          return;
        }
        goalMatch = text.match(/^each\s+statement\s+alone\s+(?:leaves\s+(?:the\s+)?(.+?)\s+identit(?:y|ies)\s+unknown|is\s+insufficient)$/i);
        if (goalMatch) {
          model.goals.push({ kind: 'each-alone-insufficient', projection: goalMatch[1]?.replace(/^the\s+/i, '').trim() || 'identity', line });
          return;
        }
        goalMatch = text.match(/^([A-Za-z_][A-Za-z0-9_]*)\s+is\s+(?:definitely\s+)?a\s+([A-Za-z_][A-Za-z0-9_]*)$/i);
        if (goalMatch) {
          model.goals.push({ kind: 'identity-fixed', subject: goalMatch[1], value: goalMatch[2], line });
          return;
        }
        goalMatch = text.match(/^([A-Za-z_][A-Za-z0-9_]*)\s+(?:remains|is)\s+unknown$/i);
        if (goalMatch) {
          model.goals.push({ kind: 'identity-ambiguous', subject: goalMatch[1], line });
          return;
        }
        goalMatch = text.match(/^exactly\s+(\d+)\s+of\s+(.+?)\s+is\s+a\s+([A-Za-z_][A-Za-z0-9_]*)$/i);
        if (goalMatch) {
          model.goals.push({ kind: 'cardinality', operator: 'exactly', amount: Number(goalMatch[1]), variables: goalMatch[2].split(/[\s,]+/).filter(Boolean), value: goalMatch[3], line });
          return;
        }
        goalMatch = text.match(/^(.+?)\s+statements?\s+are\s+(true|false)$/i);
        if (goalMatch) {
          const roles = goalMatch[1].split(/\s+and\s+|,\s*/i).map(value => value.trim()).filter(Boolean);
          if (!roles.length) throw new ErrorType('A truth goal needs at least one role', line);
          model.goals.push({ kind: 'truth-policy', roles, truth: goalMatch[2].toLowerCase() === 'true', line });
          return;
        }
        throw new ErrorType('Expected a statement-generation or puzzle goal', line);
      }
      if (text.startsWith('>')) {
        const generate = text.match(/^>\s*generate\s+statements?\s+for\s+(.+?)(?:\s+(?:using\s+)?k-?map|\s+--kmap|\s+--method\s+k-?map)?$/i);
        if (generate) {
          const method = /(?:using\s+)?k-?map|--kmap|--method\s+k-?map$/i.test(text) ? 'kmap' : 'default';
          model.commands.push({ name: 'generate', target: 'statements', argument: generate[1].trim(), method, line });
          return;
        }
        const match = text.match(/^>\s*(find|solve|try)\s+(type|value|possible|impossible)?\s*(.*)$/i);
        if (!match) throw new ErrorType('Unknown command', line);
        model.commands.push({ name: match[1].toLowerCase(), target: (match[2] || '').toLowerCase(), argument: match[3].trim(), line });
        return;
      }
      if (section !== 'STATEMENTS') throw new ErrorType('Statements must follow a STATEMENTS section', line);
      const numbered = text.match(/^(\d+)\s*:\s*(.+)$/);
      const match = numbered ? null : text.match(/^([^:]+?)\s*:\s*(.+)$/);
      if (!numbered && !match) throw new ErrorType('Expected "subject : statement"', line);
      const statementId = numbered ? Number(numbered[1]) : model.statements.length + 1;
      const subjectMatch = numbered ? null : match[1].trim().match(/^(.+?)\s+(\d+)$/);
      const statementSubject = numbered ? '_' : subjectMatch ? subjectMatch[1].trim() : match[1].trim();
      const explicitSubjectId = subjectMatch ? Number(subjectMatch[2]) : null;
      const statementTexts = splitStatementExpressions(numbered ? numbered[2] : match[2]);
      statementTexts.forEach((statementText, offset) => {
        let expr;
        const conditional = statementText.match(/^if\s+(\d+|-)\s*:?\s+then\s+(.+)$/i);
        if (statementText === '_') expr = { kind: 'hole' };
        else if (conditional) {
          const reference = conditional[1] === '-' ? model.statements.at(-1)?.id : Number(conditional[1]);
          if (!reference) throw new ErrorType('Previous-statement reference has no previous statement', line);
          expr = { kind: 'implies', left: { kind: 'statementRef', id: reference }, right: expression(conditional[2], line) };
        }
        else expr = expression(statementText, line);
        const statement = { id: offset ? model.statements.length + 1 : explicitSubjectId || statementId, subject: statementSubject, expr, source: text, line };
        model.statements.push(statement);
        if (statement.subject === '?') {
          activeQuestion = { statementId: statement.id, statement, answers: [] };
          model.questions.push(activeQuestion);
        }
      });
    });
    if (!model.staters.length) throw new ErrorType('No staters declared');
    if (!model.types.length) throw new ErrorType('No types declared');
    if (!model.statements.length && !model.goals.some(goal => goal.kind === 'statement-synthesis')) throw new ErrorType('No statements declared');
    if (new Set(model.staters.map(value => value.toLowerCase())).size !== model.staters.length) throw new ErrorType('Stater names must be unique');
    if (new Set(model.types).size !== model.types.length) throw new ErrorType('Type names must be unique');
    const names = [...model.staters, ...model.valueVariables.map(variable => variable.name)].map(value => value.toLowerCase());
    if (new Set(names).size !== names.length) throw new ErrorType('Variable names must be unique');
    model.valueVariables.forEach(variable => {
      if (new Set(variable.domain.map(value => value.toLowerCase())).size !== variable.domain.length) throw new ErrorType(`Values for "${variable.name}" must be unique`);
    });
    return root.LPLModel ? root.LPLModel.attach(model) : model;
  }

  function complete(source, cursor = source.length) {
    const before = source.slice(0, cursor);
    const match = before.match(/[A-Za-z_][A-Za-z0-9_]*$/);
    const prefix = (match ? match[0] : '').toLowerCase();
    const values = new Map();
    const add = (value, detail) => { if (!value || (prefix && !value.toLowerCase().startsWith(prefix))) return; values.set(`${value}\0${detail}`, { value, detail }); };
    ['SETUP', 'STATEMENTS', 'SOLVE', 'GOALS', 'stater', 'type', 'types', 'may', 'repeat', 'var', 'role', 'truthful', 'lying', 'says', 'rule', 'constraint', 'policy', 'case', 'group', 'exactly', 'atleast', 'atmost', 'threshold', 'find', 'solve', 'try', 'generate', 'statements', 'using', 'kmap', 'k-map', 'together', 'possible', 'identities', 'each', 'alone', 'insufficient', 'unknown', 'definitely', 'remains', 'is', 'value', 'All', 'self', 'if', 'elseif', 'else', 'then', 'end', 'on', 'true', 'false', 'positive', 'negative', 'blank', 'and', 'or', 'not', 'wrap'].forEach(value => add(value, 'LPL keyword'));
    const lines = source.split(/\r?\n/);
    lines.forEach(line => {
      let found = line.match(/^\s*stater\s+(.+)$/i);
      if (found) found[1].split(/[\s,]+/).filter(Boolean).forEach(value => add(value, 'stater'));
      found = line.match(/^\s*type\s+(.+)$/i);
      if (found) found[1].split(/[\s,]+/).filter(Boolean).forEach(value => add(value, 'type'));
      found = line.match(/^\s*var\s+([A-Za-z_][A-Za-z0-9_]*)\s+in\s*\{([^}]*)\}/i);
      if (found) { add(found[1], 'variable'); found[2].split(/[\s,]+/).filter(Boolean).forEach(value => add(value, `${found[1]} value`)); }
      found = line.match(/^\s*case\s+([A-Za-z_][A-Za-z0-9_]*)\s+(.+)$/i);
      if (found) { add(found[1], 'context'); found[2].split(/[\s,]+/).filter(value => value !== '...').forEach(value => add(value, `${found[1]} value`)); }
      found = line.match(/^\s*group\s+([A-Za-z_][A-Za-z0-9_]*)/i);
      if (found) add(found[1], 'group');
      found = line.match(/^\s*policy\s+([A-Za-z_][A-Za-z0-9_]*)/i);
      if (found) add(found[1], 'policy type');
      found = line.match(/^\s*(\d+)\s*:/);
      if (found) add(`${found[1]}:`, 'statement reference');
    });
    return [...values.values()].slice(0, 100);
  }

  const api = { tokenize, expression, parse, complete };
  root.LPLParser = api;
  if (typeof module !== 'undefined') module.exports = api;
})(typeof window === 'undefined' ? globalThis : window);
