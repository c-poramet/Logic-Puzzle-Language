'use strict';

(function (root) {
  function orderVariables(variables) {
    return variables.slice().sort((left, right) => left.domain.length - right.domain.length || (left.kind === 'stater' ? -1 : 1) - (right.kind === 'stater' ? -1 : 1) || left.name.localeCompare(right.name));
  }
  const api = { orderVariables };
  root.LPLSearch = api;
  if (typeof module !== 'undefined') module.exports = api;
})(typeof window === 'undefined' ? globalThis : window);
