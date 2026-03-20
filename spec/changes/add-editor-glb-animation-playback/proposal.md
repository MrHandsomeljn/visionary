# Proposal: Add Editor GLB Animation Playback

## Why

The editor can already load `.glb` and `.gltf` meshes, but it currently discards glTF animation clips during loading. As a result, animated GLB assets render as static meshes even though Three.js already provides native glTF animation support through `GLTFLoader` and `AnimationMixer`.

**Context**:
- The current editor render path already supports real-time Three.js mesh rendering and per-frame updates.
- The repository already contains an `FBXModelWrapper` that demonstrates a compatible pattern for driving mesh animation through a wrapper plus per-frame update loop.

**Current state**: GLB files load as `Object3D` scene graphs only; animation clips are not preserved, exposed, or updated in the editor runtime.

**Desired state**: The editor should incrementally gain GLB animation support through small, independently verifiable steps, starting with native playback of the first clip and later integrating editor controls, timeline sync, and persistence.

## What Changes

- Add a staged implementation plan for GLB animation support in the editor.
- Define a minimal Stage 1 that preserves glTF clips, instantiates a wrapper around Three.js `AnimationMixer`, and updates animated GLB models in the existing editor frame loop.
- Define a Stage 2 that exposes clip selection and playback controls, enables optional timeline synchronization, and persists GLB animation state in saved scenes.

## Impact

### Affected Specifications
- `spec/changes/add-editor-glb-animation-playback/specs/editor-model-animation/spec-delta.md` - adds GLB animation playback requirements and staged editor integration behavior

### Affected Code
- `src/io/threejs_adapters.ts` - preserve glTF animation clips during load
- `src/editor/editor-app.ts` - create GLB animation runtime state and update it per frame
- `src/models/*` - add or generalize a mesh animation wrapper around `AnimationMixer`
- `public/editor.js` and editor UI only in Stage 2
- scene save/load code only in Stage 2

### User Impact
- Stage 1 allows animated GLB assets to play in the editor with minimal behavior change.
- Stage 2 allows users to inspect and control GLB animation playback consistently with other editor animation workflows.

### API Changes
- No external API break is required.
- Internal loader and editor model structures will expand to retain glTF animation clips.

### Migration Required
- [ ] Database migration
- [ ] API version bump
- [ ] User communication needed
- [x] Documentation updates

## Timeline Estimate

Medium. Stage 1 is small-to-medium. Stage 2 is medium because it adds UI, timeline, and persistence integration.

## Risks

- Some GLB files may rely on optional glTF compression or texture extensions not currently configured in the loader path; this proposal only targets animation playback for already-loadable GLB assets.
- Timeline synchronization can create ambiguity between free-running playback and absolute-time control; Stage 2 separates those concerns into explicit tasks to keep each step testable.
