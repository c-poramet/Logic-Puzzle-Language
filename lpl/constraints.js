'use strict';

(function (root) {
  const UNKNOWN = null;
  const UNASSIGNED = Symbol('lpl.unassigned');

  function and(left, right) {
    if (left === false || right === false) return false;
    if (left === true && right === true) return true;
    return UNKNOWN;
  }
  function or(left, right) {
    if (left === true || right === true) return true;
    if (left === false && right === false) return false;
    return UNKNOWN;
  }
  function not(value) {
    return value === UNKNOWN ? UNKNOWN : !value;
  }
  function implies(left, right) {
    return or(not(left), right);
  }
  function iff(left, right) {
    if (left === UNKNOWN || right === UNKNOWN) return UNKNOWN;
    return left === right;
  }
  function cardinality(values, amount, operator) {
    const yes = values.filter(value => value === true).length;
    const unknown = values.filter(value => value === UNKNOWN).length;
    if (operator === 'exactly') {
      if (yes > amount || yes + unknown < amount) return false;
      return unknown === 0 ? yes === amount : UNKNOWN;
    }
    if (operator === 'atleast') {
      if (yes >= amount) return true;
      return yes + unknown < amount ? false : UNKNOWN;
    }
    if (operator === 'atmost') {
      if (yes > amount) return false;
      return yes + unknown <= amount ? true : UNKNOWN;
    }
    throw new Error(`Unknown cardinality operator "${operator}"`);
  }
  function cardinalityPossible(values, amount, operator) {
    return cardinality(values, amount, operator) !== false;
  }

  const api = { UNKNOWN, UNASSIGNED, and, or, not, implies, iff, cardinality, cardinalityPossible };
  root.LPLConstraints = api;
  if (typeof module !== 'undefined') module.exports = api;
})(typeof window === 'undefined' ? globalThis : window);
