import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

test('workspace indicator strings follow current UI language instead of bilingual concatenation', () => {
    const source = readFileSync(new URL('../public/editor.js', import.meta.url), 'utf8');

    assert.match(source, /return state\.uiLanguage === 'en' \? 'None' : '无';/);
    assert.match(source, /const isEnglish = state\.uiLanguage === 'en';/);
    assert.match(source, /label: isEnglish \? 'Offline' : '离线'/);
    assert.match(source, /const lastSavedLabel = state\.uiLanguage === 'en' \? 'Last staged' : '上次暂存';/);
    assert.match(source, /const ariaLabel = state\.uiLanguage === 'en' \? 'Workspace status' : '工作区状态';/);
    assert.doesNotMatch(source, /上次暂存 \/ Last staged/);
    assert.doesNotMatch(source, /工作区状态 \/ Workspace status/);
});
