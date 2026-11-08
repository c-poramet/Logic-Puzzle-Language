'use strict';

window.LPLRuntime = window.LPLRuntime || {};
LPLRuntime.esc = value => String(value).replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
LPLRuntime.Error = class LPLError extends Error {
  constructor(message, line = 0) {
    super(message);
    this.line = line;
  }
};

if (typeof module !== 'undefined') module.exports = LPLRuntime;
