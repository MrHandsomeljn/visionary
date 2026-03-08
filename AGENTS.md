# Visionary Development Rules

## UI and Interaction

1. UI text and controls should use as few emoji as possible.
2. Prefer plain text, icons from the design system, or simple ASCII symbols over emoji.
3. Keyboard shortcuts must avoid conflicts with existing shortcuts (`F`, `X`, camera controls, timeline controls).

## Editor Architecture

1. `public/editor.js` is for UI state and event wiring only.
2. Rendering, camera, model, and scene behavior must be exposed from `src/editor/editor-app.ts` (or manager classes) and called from UI.
3. New scene/model features must provide explicit API methods in `EditorApp` before wiring UI.

## Version and Consistency

1. Editor version updates must stay consistent across:
   - `public/editor.html`
   - `public/editor.css`
   - `public/editor.js`
   - `src/editor/editor-app.ts`
2. New UI blocks in `editor.html` must have corresponding styles in `editor.css` and event handling in `editor.js`.

## Logging and Debugging

1. Keep default console output concise; avoid noisy per-frame logs in production flow.
2. Debug-only logs should be gated or easy to remove.
3. Do not rely on browser cache behavior; version label should reflect active editor version.

## Change Quality

1. Do not mix unrelated refactors with feature fixes in one change.
2. Keep edits minimal and local to impacted modules.
3. When adding user-facing controls, include sane defaults and graceful fallback behavior.
