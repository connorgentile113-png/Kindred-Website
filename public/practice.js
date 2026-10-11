// A deliberately isolated exercise: no file access, network sends, or saved notes.
const practice = document.querySelector('[data-practice]');
const panels = [...document.querySelectorAll('[data-practice-panel]')];
const status = document.querySelector('[data-practice-status]');
const note = document.querySelector('#practice-note');
const confirmRemoval = document.querySelector('#practice-confirm');
let removedNote = '';

function showPanel(name) {
  for (const panel of panels) panel.hidden = panel.dataset.practicePanel !== name;
  status.textContent = '';
  document.querySelector(`[data-practice-panel="${name}"] h2`).focus();
}
practice.hidden = false;
document.querySelector('[data-practice-home]').addEventListener('click', () => showPanel('home'));
for (const button of document.querySelectorAll('[data-practice-open]')) {
  button.addEventListener('click', () => showPanel(button.dataset.practiceOpen));
}
document.querySelector('[data-practice-reply]').addEventListener('click', () => {
  document.querySelector('.sample-reply').hidden = false;
  document.querySelector('[data-practice-send]').focus();
});
document.querySelector('[data-practice-send]').addEventListener('click', () => {
  status.textContent = 'You’ve practiced sending a reply. No message was sent to anyone. You can try again or choose Practice home.';
});
document.querySelector('[data-practice-save]').addEventListener('click', () => {
  status.textContent = 'Your practice note is kept on this page while you explore. Reloading or leaving the page clears it. Your own documents are unchanged.';
});
document.querySelector('[data-practice-remove]').addEventListener('click', () => {
  confirmRemoval.returnValue = 'cancel';
  confirmRemoval.showModal();
});
confirmRemoval.addEventListener('close', () => {
  if (confirmRemoval.returnValue !== 'remove') return;
  removedNote = note.value;
  document.querySelector('[data-note-editor]').hidden = true;
  document.querySelector('[data-note-removed]').hidden = false;
  status.textContent = 'Practice note removed. Choose Undo to bring it back.';
  document.querySelector('[data-practice-undo]').focus();
});
document.querySelector('[data-practice-undo]').addEventListener('click', () => {
  note.value = removedNote;
  document.querySelector('[data-note-editor]').hidden = false;
  document.querySelector('[data-note-removed]').hidden = true;
  status.textContent = 'Your practice note is back, just as you left it.';
  note.focus();
});
document.querySelector('[data-practice-reading]').addEventListener('click', () => {
  const controls = document.querySelector('.reading-controls');
  controls.open = true;
  controls.querySelector('summary').focus();
  controls.scrollIntoView({block: 'center'});
});
