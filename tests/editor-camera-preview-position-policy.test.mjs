import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

test('camera preview panel only uses editor stage for first-open anchor, not later drag/resize clamping', () => {
    const source = readFileSync(new URL('../public/editor.js', import.meta.url), 'utf8');

    assert.match(source, /if \(!Number\.isFinite\(left\) \|\| !Number\.isFinite\(top\)\) \{/);
    assert.match(source, /shellRect: dom\.editorStage\.getBoundingClientRect\(\),/);
    assert.match(source, /const minLeft = margin;/);
    assert.match(source, /const maxLeft = Math\.max\(minLeft, window\.innerWidth - margin - panelRect\.width\);/);
    assert.doesNotMatch(source, /const minLeft = Math\.max\(margin, shellRect\.left \+ margin\);/);
    assert.doesNotMatch(source, /shellRect\.right - margin - panelRect\.width/);
});
