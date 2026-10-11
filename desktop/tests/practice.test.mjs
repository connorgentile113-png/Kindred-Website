import test from 'node:test';
import assert from 'node:assert/strict';
import {PracticeNote} from '../native/practice.mjs';

test('practice removal requires explicit confirmation and Undo restores exact words', () => {
    const note = new PracticeNote();
    note.edit('A letter with café, 日本語, and a\nsecond line.');
    assert.equal(note.remove(false), false);
    assert.equal(note.remove(), false);
    assert.equal(note.removed, false);
    note.save();
    assert.equal(note.saved, true);
    assert.equal(note.remove(true), true);
    assert.equal(note.remove(true), false);
    assert.equal(note.undo(), true);
    assert.equal(note.text, 'A letter with café, 日本語, and a\nsecond line.');
    assert.equal(note.undo(), false);
});

test('practice is independent, including blank notes and repeated remove/undo', () => {
    const first = new PracticeNote();
    const second = new PracticeNote();
    first.edit(''); first.remove(true); first.undo();
    assert.equal(first.text, '');
    assert.equal(second.text, 'Remember to enjoy a cup of tea.');
    first.edit('New words'); first.remove(true); first.undo();
    assert.equal(first.text, 'New words');
    assert.equal(new PracticeNote().removed, false);
});
