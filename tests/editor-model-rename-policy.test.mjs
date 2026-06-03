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
    assert.match(source, /item\.addEventListener\('dblclick', \(event\) => \{/);
    assert.match(source, /class="model-name-input"/);
    assert.match(source, /sceneFs\.renameRootFile\(nextSourcePath, renamedSourcePath\)/);
    assert.match(source, /app\.renameModel\(modelId, nextName, \{/);
    assert.match(source, /await persistModelRenameNow\(\);/);
    assert.match(source, /const candidateName = sanitizeFileName\(model\.name \|\| extractFileName\(sourcePath\)\);/);

    assert.match(css, /\.model-name-edit\s*\{/);
    assert.match(css, /\.model-name-input\s*\{/);
    assert.match(css, /\.model-name-ext\s*\{/);
});
