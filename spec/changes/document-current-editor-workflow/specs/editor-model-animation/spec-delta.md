## ADDED Requirements

### Requirement: Editable Model Transform Controls
WHEN a user selects a model in the editor,
the system SHALL provide direct transform controls for position, rotation, and scale.

#### Scenario: Edit selected model transform
GIVEN a model is selected in the editor
WHEN the user updates position, rotation, or scale values
THEN the system updates the selected model transform in the viewport
AND the system keeps the model settings panel synchronized with the active model state

#### Scenario: Reset selected model transform
GIVEN a model is selected in the editor
WHEN the user runs the reset transform action
THEN the system restores the model transform to its default editable state

### Requirement: Per-model Visibility Management
WHEN a scene contains editor models,
the system SHALL allow each model's visibility to be toggled from the model list.

#### Scenario: Toggle model visibility
GIVEN one or more models are listed in the scene
WHEN the user toggles a model visibility control
THEN the system updates the model visibility in the viewport
AND the model list reflects the new visible state

### Requirement: Per-model ONNX Animation Controls
WHEN a selected model supports ONNX animation playback,
the system SHALL provide play or pause, loop, speed, and time-bound controls for that model.

#### Scenario: Control ONNX animation playback
GIVEN a selected model supports ONNX animation
WHEN the user changes playback state, loop state, or playback speed
THEN the system applies those controls only to the selected model
AND the editor keeps the animation control UI synchronized with the model state

#### Scenario: Adjust animation time bounds from the timeline
GIVEN a selected dynamic ONNX model appears on the timeline
WHEN the user adjusts the model track bounds
THEN the system updates the model's animation start and end times
AND the global scene playback uses the updated time window
