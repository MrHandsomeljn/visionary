# Proposal: Add Camera Interpolation Mode Selector With Initial Squad Support

## Why

The current camera timeline preview has no interpolation-mode selector and always uses the built-in linear path: position and FOV are interpolated linearly and rotation uses direct quaternion slerp between adjacent keyframes. This produces motion that is technically correct but visually rigid, and it gives users no way to opt into smoother alternatives.

**Current state**:
- The timeline offers only one implicit interpolation behavior.
- Position and FOV use straight linear interpolation per segment.
- Rotation uses direct slerp between adjacent keyframes.
- Scene save/load does not persist a camera interpolation mode because no mode is exposed.

**Desired state**:
- Users should be able to choose a camera interpolation mode directly from the timeline header.
- The first shipped nonlinear option should be `squad`, while preserving `linear` as the baseline mode.
- The UI should leave room for future interpolation modes without forcing those future modes to be implemented now.
- Timeline playback, scrubbing, visualization sampling, export, and scene save/load should all respect the chosen mode.

## What Changes

- Add an interpolation-mode selector beside the existing camera-sequence visibility control.
- Expose `linear` and `squad` as working options and reserve UI space for future modes.
- Implement initial `squad`-based camera interpolation while keeping `linear` as the default and fallback behavior.
- Route camera playback, scrubbing, sampled path generation, and scene persistence through the active interpolation mode.

## Initial Mode Design

The initial implementation scope is:

- **`linear` mode**: preserve the current behavior as the deterministic baseline.
- **`squad` mode**: use spherical quadrangle interpolation for quaternion rotation, while keeping the rest of the timeline evaluation path mode-aware and deterministic.
- **Future-ready selector**: structure the mode list so additional methods such as Bezier or Catmull-Rom variants can be added later without redesigning the timeline header.

This keeps the first release of interpolation choice small enough to verify, while still shipping a real nonlinear option that users can compare against the baseline.

## Impact

### Affected Specifications
- `spec/changes/update-camera-sequence-curved-interpolation/specs/editor-camera-timeline/spec-delta.md`

### Affected Code
- `public/editor.html` timeline header controls
- `public/editor.css` timeline header control styling
- `public/editor.js` interpolation mode state, timeline interpolation, sampled path generation, and scene save/load state

### User Impact
- Users can explicitly switch between the original linear interpolation and a smoother squad-based mode.
- Existing workflows remain stable because `linear` remains available and can stay the default.
- Future interpolation methods can be added to the same selector without moving controls again.

### API Changes
- No external API break is required.
- Scene timeline serialization will gain an interpolation-mode field.

### Migration Required
- [ ] Database migration
- [ ] API version bump
- [ ] User communication needed
- [x] Documentation updates

## Timeline Estimate

Small to medium. The change is localized to the editor camera timeline and header UI, but it touches playback, scrubbing, sampled path generation, export behavior, and persistence.

## Risks

- Squad control-point generation must remain numerically stable for short or nearly identical quaternion segments.
- Two-keyframe or degenerate segments must fall back cleanly to linear behavior.
- The selected interpolation mode must be applied consistently in playback, scrubbing, trajectory sampling, export, and save/load paths.
