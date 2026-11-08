'use strict';

(function () {
  const source = document.getElementById('source');
  const editor = document.getElementById('editor');
  const gutter = document.getElementById('gutter');
  const highlight = document.getElementById('highlight-lines');
  const bars = document.getElementById('editor-bars');
  const autocomplete = document.getElementById('autocomplete');
  const fixes = document.getElementById('quick-fixes');
  const position = document.getElementById('position');
  const message = document.getElementById('message');
  const example = `SETUP
stater Aimee Bob Calvin
type alpha beta gamma
STATEMENTS
A : A == beta
B : A == alpha
C : A == beta or A == gamma
>find type All`;
  const keywords = ['SETUP', 'STATEMENTS', 'SOLVE', 'stater', 'type', 'var', 'rule', 'constraint', 'policy', 'case', 'group', 'exactly', 'atleast', 'atmost', 'threshold', 'find', 'solve', 'try', 'type', 'value', 'All', 'self', 'if', 'elseif', 'else', 'then', 'end', 'on', 'true', 'false', 'positive', 'negative', 'blank', 'and', 'or', 'not', 'wrap'];
  const operators = ['==', '!=', '(', ')', ':', '>'];
  let analysis = { issues: [], lines: [], mode: '' };
  let completionItems = [];
  let completionIndex = 0;
  let fixIssue = null;

  source.value = localStorage.getItem('lpl.source') || example;
  const escape = value => String(value).replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
  const wordAt = () => {
    const start = source.selectionStart;
    const before = source.value.slice(0, start);
    const match = before.match(/[A-Za-z_][A-Za-z0-9_]*$/);
    return { from: match ? start - match[0].length : start, to: start, word: match ? match[0] : '' };
  };
  const lineAt = () => {
    const before = source.value.slice(0, source.selectionStart);
    return { index: before.split('\n').length - 1, text: before.split('\n').pop() || '' };
  };
  const setMessage = (text, isError = false, line = 0) => {
    message.textContent = text;
    message.className = isError ? 'error' : '';
    updateGutter(line);
  };
  function updatePosition() {
    const before = source.value.slice(0, source.selectionStart);
    const lines = before.split('\n');
    position.textContent = `Ln ${lines.length}, Col ${lines[lines.length - 1].length + 1}`;
  }
  function updateGutter(errorLine = 0) {
    gutter.innerHTML = source.value.split(/\r?\n/).map((_, index) => {
      const issue = analysis.issues.find(item => item.line === index + 1);
      return `<div class="gutter-line${index + 1 === errorLine ? ' error' : ''}${issue ? ' warning' : ''}" data-line="${index + 1}" title="${issue ? escape(issue.message) : ''}">${index + 1}</div>`;
    }).join('');
  }
  function classify(token) {
    if (/^(SETUP|STATEMENTS|SOLVE)$/i.test(token)) return 'syntax-section';
    if (/^(stater|type|var|rule|constraint|policy|case|group|exactly|atleast|atmost|threshold|find|solve|try|value|self|if|elseif|else|then|end|on|true|false|positive|negative|blank|All|wrap)$/i.test(token)) return 'syntax-keyword';
    if (/^(and|or|not)$/i.test(token)) return 'syntax-gate';
    if (/^(<=>|=>|==|!=|:=|:|>|\(|\))$/.test(token)) return 'syntax-operator';
    return 'syntax-name';
  }
  function highlightLine(line) {
    const commentAt = line.indexOf('#');
    const code = commentAt < 0 ? line : line.slice(0, commentAt);
    const comment = commentAt < 0 ? '' : line.slice(commentAt);
    const parts = [];
    const pattern = /<=>|=>|==|!=|:=|[+-]\d+|\d+|\(|\)|:|>|[A-Za-z_][A-Za-z0-9_]*/g;
    let last = 0;
    let match;
    while ((match = pattern.exec(code))) {
      parts.push(escape(code.slice(last, match.index)));
      parts.push(`<span class="${classify(match[0])}">${escape(match[0])}</span>`);
      last = pattern.lastIndex;
    }
    parts.push(escape(code.slice(last)));
    if (comment) parts.push(`<span class="syntax-comment">${escape(comment)}</span>`);
    return parts.join('') || '&nbsp;';
  }
  function inspect() {
    const lines = source.value.split(/\r?\n/);
    const issues = [];
    let mode = '';
    lines.forEach((raw, index) => {
      const text = raw.replace(/#.*/, '').trim();
      if (!text) return;
      if (/^(SETUP|STATEMENTS|SOLVE)$/i.test(text)) { mode = text.toUpperCase(); return; }
      if (mode === 'SETUP') {
        if (/^stater\s+/i.test(text) || /^type\s+/i.test(text) || /^var\s+/i.test(text) || /^policy\s+\w+\s*:\s*$/i.test(text) || /^[A-Za-z_]\w*\s*=>\s*(?:true|false)$/i.test(text) || /^(?:rule|constraint)\s+\w+\s+(?:made\s+)?(?:a\s+)?(?:true|false)\s+statement$/i.test(text) || /^case\s+/i.test(text) || /^group\s+/i.test(text) || /^(?:exactly|atleast|atmost)\s+\d+\s+of\s+/i.test(text) || /^(?:if|elseif)\s+\w+\s+then$/i.test(text) || /^(?:else|end)$/i.test(text) || /^(?:[^:]+):=\s*[\w,\s]+$/i.test(text) || /^threshold\s*=\s*\d+$/i.test(text)) return;
        issues.push({ line: index + 1, message: 'Expected a supported SETUP declaration', from: 0, to: raw.length, fixes: [{ label: 'Comment out this line', text: `# ${raw}` }] });
        return;
      }
      if (text.startsWith('>')) {
        if (!/^>\s*(find|solve|try)\b/i.test(text)) issues.push({ line: index + 1, message: 'Unknown command. Try find, solve, or try.', from: 0, to: raw.length, fixes: [{ label: 'Change to find', text: '>find type All' }] });
        return;
      }
      if (mode !== 'STATEMENTS') {
        issues.push({ line: index + 1, message: 'Put statements after a STATEMENTS section', from: 0, to: raw.length, fixes: [{ label: 'Add STATEMENTS above', text: `STATEMENTS\n${raw}` }] });
        return;
      }
      if (!/^\s*(?:\d+\s*)?[^:]+:\s*.+$/.test(raw)) issues.push({ line: index + 1, message: 'Expected "subject : statement"', from: 0, to: raw.length, fixes: [{ label: 'Add a statement prefix', text: `A : ${raw.trim()}` }] });
    });
    analysis = { issues, lines, mode };
  }
  function render() {
    inspect();
    highlight.innerHTML = analysis.lines.map(highlightLine).map((html, index) => `<div class="highlight-line${analysis.issues.some(issue => issue.line === index + 1) ? ' has-issue' : ''}">${html}</div>`).join('');
    gutter.style.setProperty('--line-count', analysis.lines.length);
    updateGutter();
    updatePosition();
    syncScroll();
    const current = lineAt().index + 1;
    const issue = analysis.issues.find(item => item.line === current);
    message.title = issue ? issue.message : 'Ctrl+Space for suggestions';
    if (!issue && !message.classList.contains('error')) message.textContent = 'Ctrl+Space for suggestions';
  }
  function syncScroll() {
    highlight.style.transform = `translate(${-source.scrollLeft}px, ${-source.scrollTop}px)`;
    gutter.scrollTop = source.scrollTop;
    if (!autocomplete.hidden) positionPopup(autocomplete);
    if (!fixes.hidden) positionPopup(fixes);
  }
  function positionPopup(element) {
    const rect = source.getBoundingClientRect();
    const line = lineAt().index;
    element.style.left = `${Math.min(rect.left + 44, window.innerWidth - 300)}px`;
    element.style.top = `${Math.min(rect.top + 34 + (line * 21) - source.scrollTop, window.innerHeight - 260)}px`;
  }
  function closePopups() { autocomplete.hidden = true; fixes.hidden = true; fixIssue = null; }
  function buildCompletions() {
    const { word } = wordAt();
    const declared = source.value.match(/^\s*(?:stater|type)\s+(.+)$/gim) || [];
    const names = declared.flatMap(line => line.replace(/^\s*(?:stater|type)\s+/i, '').split(/[\s,]+/)).filter(Boolean);
    const values = [...new Set([...keywords, ...names, ...operators])];
    return values.filter(value => !word || value.toLowerCase().startsWith(word.toLowerCase())).slice(0, 12).map(value => ({ value, detail: names.includes(value) ? 'declared name' : 'LPL keyword' }));
  }
  function showAutocomplete(manual = false) {
    const { word } = wordAt();
    if (!manual && !word) { autocomplete.hidden = true; return; }
    completionItems = buildCompletions();
    if (!completionItems.length) { autocomplete.hidden = true; return; }
    completionIndex = 0;
    autocomplete.innerHTML = `<div class="autocomplete-list">${completionItems.map((item, index) => `<button type="button" class="autocomplete-item${index === 0 ? ' selected' : ''}" data-index="${index}" role="option"><span>${escape(item.value)}</span><small>${escape(item.detail)}</small></button>`).join('')}</div><div class="autocomplete-hint">Enter or Tab to insert · Esc to close</div>`;
    autocomplete.hidden = false;
    positionPopup(autocomplete);
  }
  function acceptCompletion() {
    const item = completionItems[completionIndex];
    if (!item) return false;
    const { from, to } = wordAt();
    source.setRangeText(item.value, from, to, 'end');
    source.dispatchEvent(new Event('input', { bubbles: true }));
    closePopups();
    return true;
  }
  function showFixes() {
    const current = lineAt().index + 1;
    fixIssue = analysis.issues.find(issue => issue.line === current);
    if (!fixIssue) return;
    fixes.innerHTML = fixIssue.fixes.map((fix, index) => `<button type="button" data-index="${index}">Fix: ${escape(fix.label)}</button>`).join('');
    fixes.hidden = false;
    positionPopup(fixes);
    fixes.querySelector('button')?.focus();
  }
  function applyFix(index) {
    if (!fixIssue || !fixIssue.fixes[index]) return;
    const lines = source.value.split('\n');
    const fix = fixIssue.fixes[index];
    lines.splice(fixIssue.line - 1, 1, ...fix.text.split('\n'));
    source.value = lines.join('\n');
    source.dispatchEvent(new Event('input', { bubbles: true }));
    closePopups();
  }
  function toggleComment() {
    const lines = source.value.split('\n');
    const current = lineAt().index;
    lines[current] = /^\s*#/.test(lines[current]) ? lines[current].replace(/^(\s*)#\s?/, '$1') : `# ${lines[current]}`;
    source.value = lines.join('\n');
    source.dispatchEvent(new Event('input', { bubbles: true }));
  }
  source.addEventListener('input', () => { localStorage.setItem('lpl.source', source.value); document.getElementById('badge').textContent = 'edited'; render(); });
  source.addEventListener('click', () => { updatePosition(); closePopups(); render(); });
  source.addEventListener('scroll', syncScroll);
  source.addEventListener('keydown', event => {
    if ((event.ctrlKey || event.metaKey) && event.key === ' ') { event.preventDefault(); showAutocomplete(true); return; }
    if ((event.ctrlKey || event.metaKey) && event.key === '.') { event.preventDefault(); showFixes(); return; }
    if ((event.ctrlKey || event.metaKey) && event.key === '/') { event.preventDefault(); toggleComment(); return; }
    if (!autocomplete.hidden) {
      if (event.key === 'ArrowDown' || event.key === 'ArrowUp') { event.preventDefault(); completionIndex = (completionIndex + (event.key === 'ArrowDown' ? 1 : completionItems.length - 1)) % completionItems.length; showAutocomplete(true); return; }
      if (event.key === 'Enter' || event.key === 'Tab') { event.preventDefault(); acceptCompletion(); return; }
      if (event.key === 'Escape') { event.preventDefault(); closePopups(); return; }
    }
    if (event.key === 'Tab') { event.preventDefault(); source.setRangeText('  ', source.selectionStart, source.selectionEnd, 'end'); source.dispatchEvent(new Event('input', { bubbles: true })); }
  });
  autocomplete.addEventListener('mousedown', event => { const item = event.target.closest('[data-index]'); if (!item) return; event.preventDefault(); completionIndex = Number(item.dataset.index); acceptCompletion(); });
  fixes.addEventListener('mousedown', event => { const item = event.target.closest('[data-index]'); if (!item) return; event.preventDefault(); applyFix(Number(item.dataset.index)); });
  document.getElementById('example').addEventListener('click', () => { closePopups(); source.value = example; source.dispatchEvent(new Event('input')); });
  document.getElementById('clear').addEventListener('click', () => { closePopups(); source.value = ''; source.dispatchEvent(new Event('input')); });
  document.getElementById('copy').addEventListener('click', async () => { await navigator.clipboard?.writeText(source.value); setMessage('Copied source'); });
  window.addEventListener('resize', syncScroll);
  render();
  window.LPLEditor = { source, setMessage, updateGutter, render };
})();
