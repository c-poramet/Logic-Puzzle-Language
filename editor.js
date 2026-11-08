'use strict';

(function () {
  const source = document.getElementById('source');
  const gutter = document.getElementById('gutter');
  const position = document.getElementById('position');
  const message = document.getElementById('message');
  const saved = localStorage.getItem('lpl.source');
  const example = `SETUP
stater Aimee Bob Calvin
type alpha beta gamma
STATEMENTS
A : A == beta
B : A == alpha
C : A == beta or A == gamma
>find type All`;
  source.value = saved || example;
  function updateGutter(errorLine) {
    gutter.innerHTML = source.value.split(/\r?\n/).map((_, index) => `<div class="${index + 1 === errorLine ? 'error' : ''}">${index + 1}</div>`).join('');
  }
  function updatePosition() {
    const before = source.value.slice(0, source.selectionStart);
    const lines = before.split('\n');
    position.textContent = `Ln ${lines.length}, Col ${lines[lines.length - 1].length + 1}`;
  }
  function setMessage(text, isError = false, line = 0) {
    message.textContent = text;
    message.className = isError ? 'error' : '';
    updateGutter(line);
  }
  source.addEventListener('input', () => { localStorage.setItem('lpl.source', source.value); updateGutter(); updatePosition(); document.getElementById('badge').textContent = 'edited'; });
  source.addEventListener('click', updatePosition);
  source.addEventListener('keyup', updatePosition);
  source.addEventListener('scroll', () => { gutter.scrollTop = source.scrollTop; });
  document.getElementById('example').addEventListener('click', () => { source.value = example; source.dispatchEvent(new Event('input')); });
  document.getElementById('clear').addEventListener('click', () => { source.value = ''; source.dispatchEvent(new Event('input')); });
  document.getElementById('copy').addEventListener('click', async () => { await navigator.clipboard?.writeText(source.value); setMessage('Copied source'); });
  updateGutter(); updatePosition();
  window.LPLEditor = { source, setMessage, updateGutter };
})();
