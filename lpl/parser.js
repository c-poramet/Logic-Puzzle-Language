'use strict';

(function (root) {
  const ErrorType = root.LPLRuntime?.Error || class extends Error {};
  const keywords = new Set(['and', 'or']);

  function tokenize(text, line) {
    const tokens = [];
    const pattern = /\s*(==|!=|\(|\)|:|,|[A-Za-z_][A-Za-z0-9_]*|\d+)/g;
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
      if (peek() === '(') { next(); const node = disjunction(); if (next() !== ')') fail('Expected ")"'); return node; }
      const value = next();
      if (!value || keywords.has(value.toLowerCase()) || value === ')' || value === '==' || value === '!=') fail('Expected a name');
      return { kind: 'name', value };
    };
    const comparison = () => {
      const left = primary();
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
    if (!tokens.length) fail('Statement cannot be blank');
    const result = disjunction();
    if (position < tokens.length) fail(`Unexpected "${peek()}"`);
    return result;
  }

  function parse(source) {
    const lines = source.split(/\r?\n/);
    let section = '';
    const model = { staters: [], types: [], statements: [], commands: [], options: {} };
    lines.forEach((raw, index) => {
      const line = index + 1;
      const text = raw.replace(/#.*/, '').trim();
      if (!text) return;
      const upper = text.toUpperCase();
      if (upper === 'SETUP' || upper === 'STATEMENTS') { section = upper; return; }
      if (upper === 'SOLVE') { section = 'SOLVE'; return; }
      if (section === 'SETUP') {
        let match = text.match(/^stater\s+(.+)$/i);
        if (match) { model.staters.push(...match[1].split(/[\s,]+/).filter(Boolean)); return; }
        match = text.match(/^type\s+(.+)$/i);
        if (match) { model.types.push(...match[1].split(/[\s,]+/).filter(Boolean).map(value => value.toLowerCase())); return; }
        match = text.match(/^threshold\s*=\s*(\d+)$/i);
        if (match) { model.options.threshold = Math.max(1, Number(match[1])); return; }
        throw new ErrorType('Expected a stater, type, or threshold declaration', line);
      }
      if (text.startsWith('>')) {
        const match = text.match(/^>\s*(find|solve|try)\s+(type|value)?\s*(.*)$/i);
        if (!match) throw new ErrorType('Unknown command', line);
        model.commands.push({ name: match[1].toLowerCase(), target: (match[2] || '').toLowerCase(), argument: match[3].trim(), line });
        return;
      }
      if (section !== 'STATEMENTS') throw new ErrorType('Statements must follow a STATEMENTS section', line);
      const match = text.match(/^(?:(\d+)\s*)?([^:]+?)\s*:\s*(.+)$/);
      if (!match) throw new ErrorType('Expected "subject : statement"', line);
      model.statements.push({ id: match[1] ? Number(match[1]) : model.statements.length + 1, subject: match[2].trim(), expr: expression(match[3], line), source: text, line });
    });
    if (!model.staters.length) throw new ErrorType('No staters declared');
    if (!model.types.length) throw new ErrorType('No types declared');
    if (!model.statements.length) throw new ErrorType('No statements declared');
    if (new Set(model.staters.map(value => value.toLowerCase())).size !== model.staters.length) throw new ErrorType('Stater names must be unique');
    if (new Set(model.types).size !== model.types.length) throw new ErrorType('Type names must be unique');
    return model;
  }

  const api = { tokenize, expression, parse };
  root.LPLParser = api;
  if (typeof module !== 'undefined') module.exports = api;
})(typeof window === 'undefined' ? globalThis : window);
