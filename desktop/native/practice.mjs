// Practice never reads or writes a Store, invokes an app, or touches user files.
export class PracticeNote {
    constructor() {
        this.text = 'Remember to enjoy a cup of tea.';
        this.removed = false;
        this.saved = false;
        this.previous = '';
    }
    edit(text) { this.text = String(text); this.saved = false; }
    save() { this.saved = true; }
    remove(confirmed) {
        if (confirmed !== true || this.removed) return false;
        this.previous = this.text;
        this.removed = true;
        return true;
    }
    undo() {
        if (!this.removed) return false;
        this.text = this.previous;
        this.removed = false;
        return true;
    }
}
