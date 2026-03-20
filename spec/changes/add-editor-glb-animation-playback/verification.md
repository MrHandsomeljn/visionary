# Stage 1 Verification

## Scope

This checklist validates the minimal GLB animation playback implementation introduced in Stage 1.

## Manual Checks

1. Static GLB load
- Load a GLB or glTF asset with no animation clips.
- Confirm the asset appears in the viewport as a static mesh.
- Confirm no runtime errors are emitted during load.

2. Animated GLB load
- Load a GLB or glTF asset with at least one animation clip.
- Confirm the asset appears in the viewport.
- Confirm the asset is recorded as dynamic in editor debug/model state.

3. First-clip playback
- After loading an animated GLB, observe the viewport for motion.
- Confirm the first clip starts without requiring editor UI controls.

4. Pause and resume behavior
- Use browser devtools to pause and resume the wrapper if a debug hook is added later, or temporarily instrument the wrapper methods during development.
- Confirm pausing stops visible motion.
- Confirm resuming continues motion from the same animated asset.

5. Coexistence with Gaussian rendering
- Load at least one Gaussian asset and one animated GLB asset in the same scene.
- Confirm the animated GLB continues updating while the fused render path remains visible.
- Confirm color, depth, and normal preview modes still render the scene without runtime errors.

## Build Validation

- Run `npm run build`.
- Confirm the build completes successfully with the Stage 1 code changes.
