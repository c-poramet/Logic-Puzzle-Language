'use strict';

(function () {
  const source = document.getElementById('source');
  const editor = document.getElementById('editor');
  const gutter = document.getElementById('gutter');
  const highlight = document.getElementById('highlight-lines');
  const bars = document.getElementById('editor-bars');
  const autocomplete = document.getElementById('autocomplete');
  const fixes = document.getElementById('quick-fixes');
  const translatorLine = document.getElementById('translator-line');
  const translatorText = document.getElementById('translator-text');
  const translatorSource = document.getElementById('translator-source');
  const palette = document.getElementById('palette');
  const workspace = document.querySelector('.workspace');
  const splitter = document.getElementById('splitter');
  const exampleModal = document.getElementById('example-modal');
  const exampleGrid = document.getElementById('example-grid');
  const closeExamples = document.getElementById('close-examples');
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
    const examples = [
    { title: 'The Two Claims', type: 'Knights and knaves', difficulty: 'Warm-up', description: 'A compact truth-versus-lie puzzle with one statement per person.', source: `SETUP
  stater Aimee Bob
  type alpha beta

  STATEMENTS
  Aimee : self == beta
  Bob : Aimee == beta

  >find type All` },
    { title: 'Three Voices', type: 'Three types', difficulty: 'Easy', description: 'Practice alpha, beta, gamma, and the default one-of-each distribution.', source: example },
    { title: 'The Missing Muffin', type: 'Role assignment', difficulty: 'Medium', description: 'A finite role variable identifies which person made a false statement.', source: `SETUP
  stater Aimee Bob Calvin
  type alpha beta gamma
  var thief in {Aimee, Bob, Calvin}
  rule thief made a false statement

  STATEMENTS
  Aimee : Aimee == beta
  Bob : Aimee == alpha
  Calvin : Aimee == beta or Aimee == gamma

  >find value thief` },
    { title: 'Isle of Dreams', type: 'Shared-state policy', difficulty: 'Challenging', description: 'Diurnal and nocturnal truth policies share one awake/asleep context.', source: `SETUP
  stater Ork Bork
  type diurnal nocturnal
  types may repeat
  var witchdoctor in {Ork, Bork}
  case state awake asleep

  policy diurnal:
    awake => true
    asleep => false

  policy nocturnal:
    awake => false
    asleep => true

  STATEMENTS
  Ork : (self == diurnal and state == awake) => witchdoctor == self
  Bork : ((self == diurnal and state == awake) or (self == nocturnal and state == asleep)) => witchdoctor == self

  >find type Ork
  >find type Bork
  >find value witchdoctor
  >find value state` },
    { title: 'The Rotating Day', type: 'Ordered context', difficulty: 'Medium', description: 'Use a wrapped case, a named group, and an offset comparison.', source: `SETUP
  stater Lion Unicorn
  type alpha beta
  case day Mon Tue Wed Thu Fri Sat Sun wrap
  group workdays = {Mon, Tue, Wed, Thu, Fri}

  STATEMENTS
  Lion : day - 1 == workdays
  Unicorn : on Sun Lion == beta

  >find value day` },
    { title: 'Balanced Voices', type: 'Cardinality', difficulty: 'Hard', description: 'Explicitly require exactly two truthful and two lying speakers.', source: `SETUP
  stater A B C D
  type alpha beta
  types may repeat
  exactly 2 of A B C D == alpha

  STATEMENTS
  A : self == alpha
  B : self == alpha
  C : self == beta
  D : self == beta

  >find type All` },
    { title: 'Echoed Evidence', type: 'Statement references', difficulty: 'Hard', description: 'Number a statement and use it as the condition for another claim.', source: `SETUP
  stater A B
  type alpha beta

  STATEMENTS
  1: A == alpha
  B : if 1: then A == beta

  >find type All
  >find value 1:` }
    ];
  const keywords = ['SETUP', 'STATEMENTS', 'SOLVE', 'stater', 'type', 'types', 'may', 'repeat', 'var', 'rule', 'constraint', 'policy', 'case', 'group', 'exactly', 'atleast', 'atmost', 'threshold', 'find', 'solve', 'try', 'type', 'value', 'All', 'self', 'if', 'elseif', 'else', 'then', 'end', 'on', 'true', 'false', 'positive', 'negative', 'blank', 'and', 'or', 'not', 'wrap'];
  const operators = ['==', '!=', '(', ')', ':', '>'];
  let analysis = { issues: [], lines: [], mode: '' };
  let completionItems = [];
  let completionIndex = 0;
  let fixIssue = null;

  source.value = localStorage.getItem('lpl.source') || example;
  const escape = value => String(value).replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
  function renderExamplePicker() {
    if (!exampleGrid) return;
    exampleGrid.innerHTML = examples.map((item, index) => `<button class="example-card" type="button" data-example-index="${index}"><span class="example-card-top"><span class="example-type">${escape(item.type)}</span><span class="example-difficulty">${escape(item.difficulty)}</span></span><strong>${escape(item.title)}</strong><span>${escape(item.description)}</span><small>Load puzzle</small></button>`).join('');
  }
  function openExamplePicker() {
    if (!exampleModal) return;
    renderExamplePicker();
    exampleModal.hidden = false;
    exampleGrid?.querySelector('button')?.focus();
  }
  function closeExamplePicker() {
    if (exampleModal) exampleModal.hidden = true;
  }
  function loadExample(index) {
    const selected = examples[index];
    if (!selected) return;
    closePopups();
    closeExamplePicker();
    source.value = selected.source;
    source.dispatchEvent(new Event('input'));
    source.focus();
    source.setSelectionRange(0, 0);
    render();
  }
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
    if (/^(stater|type|types|may|repeat|var|rule|constraint|policy|case|group|exactly|atleast|atmost|threshold|find|solve|try|value|self|if|elseif|else|then|end|on|true|false|positive|negative|blank|All|wrap)$/i.test(token)) return 'syntax-keyword';
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
        if (/^stater\s+/i.test(text) || /^type\s+/i.test(text) || /^types\s+may\s+repeat$/i.test(text) || /^var\s+/i.test(text) || /^policy\s+\w+\s*:\s*$/i.test(text) || /^[A-Za-z_]\w*\s*=>\s*(?:true|false)$/i.test(text) || /^(?:rule|constraint)\s+\w+\s+(?:made\s+)?(?:a\s+)?(?:true|false)\s+statement$/i.test(text) || /^case\s+/i.test(text) || /^group\s+/i.test(text) || /^(?:exactly|atleast|atmost)\s+\d+\s+of\s+/i.test(text) || /^(?:if|elseif)\s+\w+\s+then$/i.test(text) || /^(?:else|end)$/i.test(text) || /^(?:[^:]+):=\s*[\w,\s]+$/i.test(text) || /^threshold\s*=\s*\d+$/i.test(text)) return;
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
    const currentLine = lineAt().index;
    highlight.innerHTML = analysis.lines.map(highlightLine).map((html, index) => `<div class="highlight-line${analysis.issues.some(issue => issue.line === index + 1) ? ' has-issue' : ''}${index === currentLine ? ' current' : ''}">${html}</div>`).join('');
    gutter.style.setProperty('--line-count', analysis.lines.length);
    updateGutter();
    updatePosition();
    syncScroll();
    const current = lineAt().index + 1;
    const issue = analysis.issues.find(item => item.line === current);
    message.title = issue ? issue.message : 'Ctrl+Space for suggestions';
    if (!issue && !message.classList.contains('error')) message.textContent = 'Ctrl+Space for suggestions';
    updateTranslator();
  }

  function readableExpression(expression, subject) {
    const speaker = subject && subject !== '_' ? subject : 'the speaker';
    return expression.replace(/\bself\b/gi, speaker).replace(/<=>/g, ' exactly when ').replace(/=>/g, ' then ').replace(/!=/g, ' is not ').replace(/==/g, ' is ').replace(/\bnot\b/gi, 'not').replace(/\band\b/gi, ' and ').replace(/\bor\b/gi, ' or ').replace(/\bon\b/gi, ' when ').replace(/[()]/g, '').replace(/\s+/g, ' ').trim();
  }

  function translateLine(rawLine) {
    const line = rawLine.replace(/#.*/, '').trim();
    if (!line) return 'Blank line: no puzzle rule is declared here.';
    if (/^(SETUP|STATEMENTS|SOLVE)$/i.test(line)) return `${line.toUpperCase()} starts the ${line.toLowerCase()} section.`;
    let match = line.match(/^stater\s+(.+)$/i);
    if (match) return `Declares ${match[1]} as people who can make statements.`;
    match = line.match(/^type\s+(.+)$/i);
    if (match) return `Declares ${match[1]} as the possible types for every stater.`;
    if (/^types\s+may\s+repeat$/i.test(line)) return 'Allows more than one person to receive the same type.';
    match = line.match(/^var\s+([A-Za-z_][A-Za-z0-9_]*)\s+in\s*\{([^}]*)\}/i);
    if (match) return `Creates a finite choice named ${match[1]}; its value must be one of ${match[2]}.`;
    match = line.match(/^case\s+([A-Za-z_][A-Za-z0-9_]*)\s+(.+)$/i);
    if (match) return `Creates one shared context named ${match[1]} with values ${match[2].replace(/\s+wrap\s*$/i, '')}.`;
    match = line.match(/^group\s+([A-Za-z_][A-Za-z0-9_]*)\s*=\s*\{([^}]*)\}/i);
    if (match) return `Groups ${match[2]} under the name ${match[1]}.`;
    match = line.match(/^policy\s+([A-Za-z_][A-Za-z0-9_]*)/i);
    if (match) return `Starts the truth policy for the ${match[1]} type.`;
    match = line.match(/^([A-Za-z_][A-Za-z0-9_]*)\s*=>\s*(true|false)$/i);
    if (match) return `When the context is ${match[1]}, this policy requires statements to be ${match[2]}.`;
    if (/^(?:else|end)$/i.test(line)) return `${line.toLowerCase()} ends the current conditional setup block.`;
    match = line.match(/^(exactly|atleast|atmost)\s+(\d+)\s+of\s+(.+?)\s*==\s*(\w+)$/i);
    if (match) return `Requires ${match[1]} ${match[2]} of ${match[3]} to have type or value ${match[4]}.`;
    if (line.startsWith('>')) return `Asks the solver to ${line.slice(1).trim().replace(/\s+/g, ' ')}.`;
    match = line.match(/^(?:\d+\s*:\s*)?([^:]+?)\s*:\s*(.+)$/);
    if (match) {
      const subject = /^\d+\s*$/.test(match[1].trim()) ? '_' : match[1].trim();
      return `${subject === '_' ? 'An anonymous speaker' : subject} says: ${readableExpression(match[2], subject)}.`;
    }
    return 'This line contains LPL syntax that the rough translator does not recognize yet.';
  }

  function updateTranslator() {
    if (!translatorLine || !translatorText || !translatorSource) return;
    const index = Math.max(0, lineAt().index);
    const lines = source.value.split(/\r?\n/);
    translatorLine.textContent = `Line ${index + 1}`;
    translatorText.textContent = translateLine(lines[index] || '');
    translatorSource.textContent = lines[index] || ' ';
  }

  function applyPalette(value) {
    const selected = ['ember', 'moss', 'ocean', 'paper'].includes(value) ? value : 'ember';
    document.documentElement.dataset.palette = selected;
    if (palette) palette.value = selected;
    localStorage.setItem('lpl.palette', selected);
  }

  function setEditorWidth(value) {
    const width = Math.max(25, Math.min(65, value));
    document.documentElement.style.setProperty('--editor-width', `${width}%`);
    splitter?.setAttribute('aria-valuenow', String(Math.round(width)));
    localStorage.setItem('lpl.editorWidth', String(width));
  }

  function resizeFromPointer(event) {
    const rect = workspace.getBoundingClientRect();
    setEditorWidth(((event.clientX - rect.left) / rect.width) * 100);
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
    if (window.LPLParser?.complete) return LPLParser.complete(source.value, source.selectionStart).map(item => ({ value: item.value, detail: item.detail }));
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
  source.addEventListener('select', render);
  document.addEventListener('selectionchange', () => { if (document.activeElement === source) { updatePosition(); render(); } });
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
  document.getElementById('example').addEventListener('click', openExamplePicker);
  exampleGrid?.addEventListener('click', event => { const card = event.target.closest('[data-example-index]'); if (card) loadExample(Number(card.dataset.exampleIndex)); });
  closeExamples?.addEventListener('click', closeExamplePicker);
  exampleModal?.addEventListener('click', event => { if (event.target.matches('[data-close-examples]')) closeExamplePicker(); });
  document.addEventListener('keydown', event => { if (event.key === 'Escape' && exampleModal && !exampleModal.hidden) closeExamplePicker(); });
  document.getElementById('clear').addEventListener('click', () => { closePopups(); source.value = ''; source.dispatchEvent(new Event('input')); });
  document.getElementById('copy').addEventListener('click', async () => { await navigator.clipboard?.writeText(source.value); setMessage('Copied source'); });
  window.addEventListener('resize', syncScroll);
  palette?.addEventListener('change', event => applyPalette(event.target.value));
  applyPalette(localStorage.getItem('lpl.palette') || 'ember');
  const savedWidth = Number(localStorage.getItem('lpl.editorWidth'));
  if (Number.isFinite(savedWidth)) setEditorWidth(savedWidth);
  splitter?.addEventListener('pointerdown', event => { splitter.setPointerCapture(event.pointerId); splitter.classList.add('is-dragging'); resizeFromPointer(event); });
  splitter?.addEventListener('pointermove', event => { if (splitter.classList.contains('is-dragging')) resizeFromPointer(event); });
  splitter?.addEventListener('pointerup', event => { splitter.releasePointerCapture(event.pointerId); splitter.classList.remove('is-dragging'); });
  splitter?.addEventListener('keydown', event => { if (!['ArrowLeft', 'ArrowRight'].includes(event.key)) return; event.preventDefault(); const current = Number(splitter.getAttribute('aria-valuenow')) || 42; setEditorWidth(current + (event.key === 'ArrowRight' ? 2 : -2)); });
  render();
  window.LPLEditor = { source, setMessage, updateGutter, render };
})();
