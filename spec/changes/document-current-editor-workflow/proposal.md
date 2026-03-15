# Proposal: Document Current Editor Workflow

## Why

The current repository has no tracked OpenSpec baseline for the editor, even though `MrHandsomeljn` and `10086mea` have already shipped a substantial subset of the intended filmmaking workflow. The shipped code now supports scene assembly, model transforms, ONNX animation controls, camera keyframing, timeline playback, and rough-cut image/video export, but these behaviors only exist in code and release notes.

Without a formal spec baseline, future work on AI generation, scene refinement, and handoff into later pipeline stages will drift against the current editor behavior.

## What Changes

- Add baseline specs for the implemented editor subset.
- Capture the scene authoring workflow already present in the editor UI and `EditorApp` API.
- Capture the per-model animation and timeline behaviors delivered across `v0.05` to `v0.0.9`.
- Capture the rough-cut export workflow for image/video, including render modes and timeline-driven playback.

## Impact

- Affected areas: editor UI, `public/editor.js`, `src/editor/editor-app.ts`, export pipeline.
- Affected users: contributors extending the editor toward the larger filmmaking workflow.
- This proposal documents existing shipped behavior; it does not require product behavior changes.
