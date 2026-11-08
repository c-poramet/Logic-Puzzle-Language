'use strict';

(function () {
  const run = document.getElementById('run');
  const source = document.getElementById('source');
  const results = document.getElementById('results');
  const badge = document.getElementById('badge');
  function solve() {
    try {
      const model = LPLParser.parse(source.value);
      const result = LPLSolver.solve(model);
      const commands = model.commands.map(command => LPLSolver.query(result, command));
      results.innerHTML = LPLRender.render(result, commands);
      badge.textContent = `${result.count} worlds`;
      LPLEditor.setMessage('Solved');
    } catch (error) {
      const line = error.line || 0;
      results.innerHTML = `<div class="warn">${line ? `Line ${line}: ` : ''}${LPLRuntime.esc(error.message)}</div>`;
      badge.textContent = 'error';
      LPLEditor.setMessage(error.message, true, line);
    }
  }
  run.addEventListener('click', solve);
  source.addEventListener('keydown', event => { if ((event.ctrlKey || event.metaKey) && event.key === 'Enter') { event.preventDefault(); solve(); } });
  window.LPLApp = { solve };
  solve();
})();
