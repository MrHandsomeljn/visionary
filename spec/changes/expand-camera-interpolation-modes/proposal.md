# Proposal: Expand Camera Interpolation Modes With Parameter Control

## Why

The initial camera interpolation selector proved that mode-based interpolation switching is useful, but the first nonlinear option is not sufficient for real camera work by itself. In practice, different shots need different behavior: some only need smoother rotation, while others need controllable path curvature or eased motion timing. A single nonlinear mode cannot cover these distinct needs cleanly.

**Current state**:
- The timeline exposes `linear` and `squad` only.
- `Squad` is not a complete answer for camera path design because quaternion smoothing is most suitable for orientation, not arbitrary path shaping.
- There is no per-mode parameter control in the header, so users cannot tune curvature or easing strength.

**Desired state**:
- The timeline should offer multiple interpolation modes suited to different camera authoring intents.
- Modes that support tuning should expose a compact parameter control immediately to the right of the interpolation selector.
- The runtime, path visualization, export evaluation, and scene persistence must all remain mode-consistent.

## What Changes

- Add one or two additional working interpolation modes beyond `linear` and the initial `squad` option.
- Re-scope `squad` to the use case it fits best: smoothing rotation while keeping positional motion stable.
- Add at least one path-oriented interpolation mode with a user-adjustable curve parameter, such as Catmull-Rom/Hermite tension.
- Add an optional eased-timing style mode if it can be implemented cleanly within the same interpolation entry point.
- Place a compact parameter control directly to the right of the interpolation selector and update it dynamically based on the active mode.

## Initial Expanded Mode Design

The implementation target is:

- **`linear`**: exact baseline behavior.
- **`squad`**: smooth quaternion rotation with stable linear position.
- **`catmull`**: smooth camera path interpolation for position with a tension parameter that controls how strongly the curve bends between keyframes.
- **`ease`**: linear spatial path with nonlinear time remapping controlled by a strength parameter.

Parameter control behavior:
- Hidden or disabled for modes that do not use an extra parameter.
- Visible for modes that need tuning.
- Mode-specific label and range, while reusing one compact UI slot.

## Impact

### Affected Specifications
- `spec/changes/expand-camera-interpolation-modes/specs/editor-camera-timeline/spec-delta.md`

### Affected Code
- `public/editor.html` timeline header controls
- `public/editor.css` interpolation control styling
- `public/editor.js` interpolation mode registry, parameter state, evaluation logic, trajectory sampling, and scene persistence

### User Impact
- Users can choose a mode that matches the shot: strict linear, rotation smoothing, path smoothing, or eased motion.
- Users can tune curve behavior from the header without opening a separate settings panel.
- Camera helper paths better reflect what playback will actually do.

### API Changes
- Scene timeline serialization will add interpolation parameter metadata in addition to interpolation mode.

### Migration Required
- [ ] Database migration
- [ ] API version bump
- [ ] User communication needed
- [x] Documentation updates

## Risks

- More modes increase the chance of inconsistency unless all evaluation paths share the same interpolation entry point.
- Path-smoothing modes can still overshoot if their parameterization is not constrained.
- Dynamic parameter UI must remain understandable and not appear active for modes that ignore it.
