'use strict';

(function (root) {
  const LIMIT = 200;
  function create() {
    const entries = [];
    function add(entry) {
      if (entries.length < LIMIT) entries.push({ ...entry });
    }
    function list() {
      return entries.slice();
    }
    return { add, list };
  }
  const api = { create, LIMIT };
  root.LPLExplanations = api;
  if (typeof module !== 'undefined') module.exports = api;
})(typeof window === 'undefined' ? globalThis : window);
