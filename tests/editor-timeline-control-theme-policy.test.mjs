import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

test('timeline speed and fps selects share the panel-like base styling', () => {
    const css = readFileSync(new URL('../public/editor.css', import.meta.url), 'utf8');

    assert.match(css, /#timelineFps,\s*#timelineSpeed/);
    assert.match(css, /background:\s*var\(--input-bg\);/);
    assert.match(css, /color:\s*var\(--text-primary\);/);
    assert.match(css, /border:\s*1px solid var\(--input-border\);/);
});

test('light theme applies the same select color treatment to timeline speed and fps controls', () => {
    const css = readFileSync(new URL('../public/editor.css', import.meta.url), 'utf8');

    assert.match(css, /body\.theme-light #timelineFps,\s*body\.theme-light #timelineSpeed/);
    assert.match(css, /body\.theme-light \.property-inputs input\[type="number"\],[\s\S]*body\.theme-light #timelineFps,[\s\S]*body\.theme-light #timelineSpeed,[\s\S]*background:\s*rgba\(255,\s*255,\s*255,\s*0\.42\);/);
});

test('timeline and camera preview selects define explicit option colors for opened dropdown menus', () => {
    const css = readFileSync(new URL('../public/editor.css', import.meta.url), 'utf8');

    assert.match(css, /#timelineFps option,\s*#timelineSpeed option,\s*#cameraPreviewPanel \.property-inputs select option/);
    assert.match(css, /background:\s*var\(--panel-bg\);/);
    assert.match(css, /color:\s*var\(--text-primary\);/);
    assert.match(css, /body\.theme-light #timelineFps option,\s*body\.theme-light #timelineSpeed option,\s*body\.theme-light #cameraPreviewPanel \.property-inputs select option/);
});

test('light theme render mode active button keeps selected text visible', () => {
    const css = readFileSync(new URL('../public/editor.css', import.meta.url), 'utf8');

    assert.match(css, /body\.theme-light \.button-primary,\s*body\.theme-light \.menu-btn\.menu-btn-active \{[\s\S]*background:\s*rgba\(107,\s*159,\s*249,\s*0\.24\);[\s\S]*border-color:\s*rgba\(47,\s*104,\s*196,\s*0\.72\);[\s\S]*color:\s*#0b3d91;/);
    assert.match(css, /body\.theme-light \.menu-btn\.menu-btn-active \.menu-btn-text \{[\s\S]*color:\s*#0b3d91;/);
});
