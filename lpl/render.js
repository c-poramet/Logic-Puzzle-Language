'use strict';

(function (root) {
  const esc = root.LPLRuntime.esc;
  const solutionText = solution => Object.entries(solution.assignment).map(([name, type]) => `${name} = ${type}`).join('  ·  ');
  function render(result, commands) {
    const model = result.model;
    const output = [];
    const renderSynthesis = synthesis => {
      if (!synthesis.supported) return `<div class="warn">${esc(synthesis.message || 'Statement synthesis is unavailable.')}</div>`;
      const warning = synthesis.truncated ? '<div class="warn">Search limit reached. The listed candidates are not a proof that no other statements exist.</div>' : '';
      const tuples = synthesis.tuples?.length ? synthesis.tuples.map((tuple, tupleIndex) => `<div class="synthesis-card"><div class="query-title">candidate ${tupleIndex + 1}</div><div class="query-list">${tuple.statements.map(statement => `<div class="query-row"><strong>${esc(statement.subject)}</strong><span class="query-possible">${esc(statement.text)}</span></div>`).join('')}</div><div class="synthesis-evidence"><span>${tuple.survivingWorlds} worlds survive together</span><span>possible ${esc(tuple.possibleIdentities.join(', ') || 'none')}</span><span>alone: ${tuple.singlePossibleIdentities.map((identities, index) => `${esc(synthesis.subjects[index])} = ${esc(identities.join(', ') || 'none')}`).join(' · ')}</span><span>goals: ${Object.entries(tuple.checks || {}).map(([name, passed]) => `${esc(name)} ${passed ? 'pass' : 'fail'}`).join(' · ')}</span></div></div>`).join('') : '<div class="query-row"><span class="query-impossible">No candidate tuple satisfies the declared goals.</span></div>';
      return `${warning}<div class="query-result synthesis-result"><div class="query-title">generated statements · ${esc(synthesis.method || 'default')} · ${synthesis.expressionCount} expressions · ${synthesis.tupleCount} tuples checked</div>${tuples}</div>`;
    };
    const renderQuery = command => {
      if (!command.choices || command.all || command.name === 'try') return '';
      return `<div class="query-result"><div class="query-title">${esc(command.name)} ${esc(command.target || 'value')}</div><div class="query-list">${command.choices.map(choice => `<div class="query-row"><strong>${esc(choice.name)}</strong><span class="query-possible">${choice.possible.length ? choice.possible.map(esc).join(', ') : 'none'}</span>${choice.impossible.length ? `<span class="query-impossible">impossible: ${choice.impossible.map(esc).join(', ')}</span>` : ''}</div>`).join('')}</div></div>`;
    };
    output.push(`<div class="stats"><div class="stat has-tooltip" data-tooltip="Complete assignments that satisfy every declared rule."><strong>${result.count}</strong><span>surviving worlds</span></div><div class="stat has-tooltip" data-tooltip="People who have declared statements in this puzzle."><strong>${model.staters.length}</strong><span>staters</span></div><div class="stat has-tooltip" data-tooltip="Statement expressions checked by the solver."><strong>${model.statements.length}</strong><span>statements</span></div></div>`);
    const statsNote = result.statistics ? `${result.statistics.searchLeaves || 0} leaves · ${result.statistics.searchNodes || 0} nodes${result.statistics.truncated ? ' · threshold reached' : ''}` : '';
    output.push(`<div class="result-head"><h2>Possibility space</h2><span class="note">${result.exactOneEach ? 'exactly one of each type' : 'no cardinality rule'}${statsNote ? ` · ${statsNote}` : ''}</span></div>`);
    commands.forEach((command, index) => {
      const count = command.name === 'try' ? command.count : command.synthesis ? command.synthesis.tuples?.length || 0 : result.count;
      output.push(`<div class="step"><div class="step-head"><span class="step-number">${index + 1}</span><span class="step-command">${esc(command.name)} ${esc(command.target)} ${esc(command.argument)}</span><span class="step-count">${count} left</span></div>`);
      if (command.name === 'try') output.push(`<div class="chips"><span class="chip">${count ? 'possible' : 'impossible'}</span></div>`);
      else if (command.synthesis) output.push(renderSynthesis(command.synthesis));
      else if (command.brute) output.push(command.brute.error ? `<div class="warn">${esc(command.brute.error)}</div>` : `<div class="query-result"><div class="query-title">candidate statements</div><div class="query-list">${command.brute.candidates.map(candidate => `<div class="query-row"><span class="query-possible">${esc(candidate)}</span></div>`).join('') || '<div class="query-row"><span class="query-impossible">No compatible candidates</span></div>'}</div></div>`);
      else output.push(`<div class="solutions">${result.solutions.slice(0, 10).map(solution => `<div class="solution has-tooltip" data-tooltip="One complete world that survives all constraints.">${esc(solutionText(solution))}</div>`).join('') || '<div class="solution has-tooltip" data-tooltip="No assignment satisfies all the current rules.">No world satisfies the rules.</div>'}</div>`);
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
