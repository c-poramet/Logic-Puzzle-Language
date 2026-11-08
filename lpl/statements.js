'use strict';

(function (root) {
  function get(model, id) {
    return model.statementsById?.[id] || null;
  }
  function isAnonymous(subject) {
    return String(subject).trim() === '_';
  }
  const api = { get, isAnonymous };
  root.LPLStatements = api;
  if (typeof module !== 'undefined') module.exports = api;
})(typeof window === 'undefined' ? globalThis : window);
