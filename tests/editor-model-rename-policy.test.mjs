import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

test('scene manager exposes inline rename input and rename commit flow', () => {
    const source = readFileSync(new URL('../public/editor.js', import.meta.url), 'utf8');
    const css = readFileSync(new URL('../public/editor.css', import.meta.url), 'utf8');

    assert.match(source, /let modelRenameState = null;/);
    assert.match(source, /function beginModelRename\(modelId\)/);
    assert.match(source, /function cancelModelRename\(\)/);
    assert.match(source, /async function commitModelRename\(modelId, options = \{\}\)/);
    assert.match(source, /splitEditableFileNameParts\(fileName\)/);
    assert.match(source, /sanitizeRenameStemInput\(value\)/);
    assert.match(source, /validateRenameStem\(stem\)/);
    assert.match(source, /function handleModelRenameInputBlur\(modelId\)\s*\{[\s\S]*if \(!document\.hasFocus\(\)\) return;[\s\S]*commitModelRename\(modelId, \{ keepEditingOnError: true \}\);[\s\S]*\}/);
    assert.match(source, /item\.addEventListener\('dblclick', \(event\) => \{/);
    assert.match(source, /class="model-name-input"/);
    assert.match(source, /input\.addEventListener\('blur', \(\) => \{[\s\S]*handleModelRenameInputBlur\(input\.dataset\.id\);[\s\S]*\}\);/);
    assert.match(source, /function renderModelVisibilityIcon\(visible\)/);
    assert.match(source, /<svg class="model-visibility-icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false">[\s\S]*<circle cx="12" cy="12" r="3" \/>/);
    assert.match(source, /<path d="M3 12c2\.4 3 5\.4 4\.5 9 4\.5s6\.6-1\.5 9-4\.5" \/>/);
    assert.match(source, /renderModelVisibilityIcon\(model\.visible\)/);
    assert.match(source, /sceneFs\.renameRootFile\(nextSourcePath, renamedSourcePath\)/);
    assert.match(source, /app\.renameModel\(modelId, nextName, \{/);
    assert.match(source, /await persistModelRenameNow\(\);/);
    assert.match(source, /const candidateName = sanitizeFileName\(model\.name \|\| extractFileName\(sourcePath\)\);/);

    assert.match(css, /\.model-name-edit\s*\{/);
    assert.match(css, /\.model-name-edit\s*\{[\s\S]*height:\s*16px;[\s\S]*margin-left:\s*-6px;[\s\S]*overflow:\s*visible;/);
    assert.match(css, /\.model-name-input\s*\{/);
    assert.match(css, /\.model-name-input\s*\{[\s\S]*height:\s*24px;[\s\S]*margin-top:\s*-4px;[\s\S]*margin-bottom:\s*-4px;/);
    assert.match(css, /\.model-name-ext\s*\{/);
    assert.match(css, /\.model-visibility-btn\s*\{[\s\S]*width:\s*20px;[\s\S]*height:\s*20px;/);
    assert.match(css, /\.model-visibility-icon\s*\{[\s\S]*width:\s*14px;[\s\S]*stroke:\s*currentColor;/);
});
