import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

test('camera control number inputs use lazy sync and avoid overwriting active edits', () => {
    const source = readFileSync(new URL('../public/editor.js', import.meta.url), 'utf8');

    assert.match(source, /if \(dom\.cameraDisplayScaleValue && document\.activeElement !== dom\.cameraDisplayScaleValue\)/);
    assert.match(source, /function updateCameraSequenceDisplayScaleFromInput\(\)/);
    assert.match(source, /const parsed = extractNumericValue\(dom\.cameraDisplayScaleValue\.value\);/);
    assert.match(source, /function commitCameraSequenceDisplayScaleFromInput\(\)/);
    assert.match(source, /nudgeNumericInputValue\(\s*dom\.cameraDisplayScaleValue\.value,\s*0\.01/);
});
