'use strict';

(function (root) {
  const esc = root.LPLRuntime.esc;
  const solutionText = solution => Object.entries(solution.assignment).map(([name, type]) => `${name} = ${type}`).join('  ·  ');
  function render(result, commands) {
    const model = result.model;
    const output = [];
    const renderQuery = command => {
      if (!command.choices || command.all || command.name === 'try') return '';
      return `<div class="query-result"><div class="query-title">${esc(command.name)} ${esc(command.target || 'value')}</div><div class="query-list">${command.choices.map(choice => `<div class="query-row"><strong>${esc(choice.name)}</strong><span class="query-possible">${choice.possible.length ? choice.possible.map(esc).join(', ') : 'none'}</span>${choice.impossible.length ? `<span class="query-impossible">impossible: ${choice.impossible.map(esc).join(', ')}</span>` : ''}</div>`).join('')}</div></div>`;
    };
    output.push(`<div class="stats"><div class="stat"><strong>${result.count}</strong><span>surviving worlds</span></div><div class="stat"><strong>${model.staters.length}</strong><span>staters</span></div><div class="stat"><strong>${model.statements.length}</strong><span>statements</span></div></div>`);
    const statsNote = result.statistics ? `${result.statistics.searchLeaves || 0} leaves · ${result.statistics.searchNodes || 0} nodes` : '';
    output.push(`<div class="result-head"><h2>Possibility space</h2><span class="note">${result.exactOneEach ? 'exactly one of each type' : 'no cardinality rule'}${statsNote ? ` · ${statsNote}` : ''}</span></div>`);
    commands.forEach((command, index) => {
      const count = command.name === 'try' ? command.count : result.count;
      output.push(`<div class="step"><div class="step-head"><span class="step-number">${index + 1}</span><span class="step-command">${esc(command.name)} ${esc(command.target)} ${esc(command.argument)}</span><span class="step-count">${count} left</span></div>`);
      if (command.name === 'try') output.push(`<div class="chips"><span class="chip">${count ? 'possible' : 'impossible'}</span></div>`);
      else if (command.brute) output.push(command.brute.error ? `<div class="warn">${esc(command.brute.error)}</div>` : `<div class="query-result"><div class="query-title">candidate statements</div><div class="query-list">${command.brute.candidates.map(candidate => `<div class="query-row"><span class="query-possible">${esc(candidate)}</span></div>`).join('') || '<div class="query-row"><span class="query-impossible">No compatible candidates</span></div>'}</div></div>`);
      else output.push(`<div class="solutions">${result.solutions.slice(0, 10).map(solution => `<div class="solution">${esc(solutionText(solution))}</div>`).join('') || '<div class="solution">No world satisfies the rules.</div>'}</div>`);
      output.push(renderQuery(command));
      output.push('</div>');
    });
    output.push('<div class="answer"><div class="answer-title">Surviving assignments</div><div class="table-wrap"><table class="table"><thead><tr>' + model.staters.map(name => `<th>${esc(name)}</th>`).join('') + '</tr></thead><tbody>' + result.solutions.slice(0, 50).map(solution => `<tr>${model.staters.map(name => `<td>${esc(solution.assignment[name])}</td>`).join('')}</tr>`).join('') + '</tbody></table></div></div>');
    if (result.explanations?.length) {
      output.push(`<details class="explanations"><summary>Why worlds were rejected <span>${result.explanations.length}</span></summary><div class="explanation-list">${result.explanations.slice(0, 20).map(entry => `<div class="explanation"><span class="explanation-kind">${esc(entry.kind)}</span>${entry.line ? `<span class="explanation-line">line ${entry.line}</span>` : ''}<span>${esc(entry.message)}</span></div>`).join('')}</div></details>`);
    }
    return output.join('');
  }
  root.LPLRender = { render };
  if (typeof module !== 'undefined') module.exports = root.LPLRender;
})(typeof window === 'undefined' ? globalThis : window);
