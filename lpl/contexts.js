'use strict';

(function (root) {
  const weekdayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const same = (left, right) => String(left).toLowerCase() === String(right).toLowerCase();

  function expandCase(values) {
    const ellipsis = values.indexOf('...');
    const tokens = values.filter(token => token !== '...');
    if (!values.includes('...')) return tokens;
    const known = tokens.every(token => weekdayNames.some(day => same(day, token)));
    if (!known) return tokens;
    const before = values.slice(0, ellipsis).filter(token => token !== '...');
    const after = values.slice(ellipsis + 1).filter(token => token !== '...');
    const first = weekdayNames.findIndex(day => same(day, (before[0] || after[0])));
    const last = after.length ? weekdayNames.findIndex(day => same(day, after[after.length - 1])) : -1;
    if (last < 0 || last === first) return weekdayNames.slice(first).concat(weekdayNames.slice(0, first));
    const result = [];
    for (let index = first; ; index = (index + 1) % weekdayNames.length) {
      result.push(weekdayNames[index]);
      if (index === last) break;
    }
    return result;
  }

  function shift(context, value, amount) {
    const index = context.values.findIndex(item => same(item, value));
    if (index < 0) return undefined;
    const target = index + amount;
    if (context.wrap) return context.values[(target % context.values.length + context.values.length) % context.values.length];
    return context.values[target];
  }

  const api = { expandCase, shift };
  root.LPLContexts = api;
  if (typeof module !== 'undefined') module.exports = api;
})(typeof window === 'undefined' ? globalThis : window);
