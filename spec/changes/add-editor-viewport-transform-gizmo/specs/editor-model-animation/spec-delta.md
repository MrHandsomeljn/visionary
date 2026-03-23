## MODIFIED Requirements

### Requirement: Editable Model Transform Controls
WHEN a user selects a model in the editor,
the system SHALL provide direct transform controls for position, rotation, and scale through both the settings panel and the viewport gizmo workflow.

#### Scenario: Edit selected model transform from the settings panel
GIVEN a model is selected in the editor
WHEN the user updates position, rotation, or scale values in the settings panel
THEN the system updates the selected model transform in the viewport
AND the system keeps the model settings panel synchronized with the active model state
AND the viewport gizmo target, when visible, stays aligned with the updated transform.

#### Scenario: Edit selected model transform from the viewport gizmo
GIVEN a model is selected in the editor
AND the viewport gizmo is enabled for that selection
WHEN the user drags the gizmo to translate, rotate, or scale the selected model
THEN the system updates the selected model transform in the viewport
AND the system keeps the settings panel inputs synchronized with the updated transform state.

#### Scenario: Reset selected model transform
GIVEN a model is selected in the editor
WHEN the user runs the reset transform action
THEN the system restores the model transform to its default editable state
AND the viewport gizmo, when visible, resets to the restored model transform.

## ADDED Requirements

### Requirement: Selected-model Viewport Transform Gizmo
WHEN the editor has an active selected model that supports editor transforms,
the system SHALL allow that model to be manipulated directly in the viewport with a transform gizmo.

#### Scenario: Show gizmo for the selected model only
GIVEN one or more models exist in the editor
WHEN the user selects a model that supports editor transforms
THEN the system shows a transform gizmo for the selected model in the viewport
AND the system hides or disables the gizmo for all non-selected models.

#### Scenario: Switch viewport transform mode
GIVEN a transform gizmo is visible for the selected model
WHEN the user switches the gizmo mode between translate, rotate, and scale
THEN the system applies the requested transform mode to subsequent gizmo drags
AND the selected model remains the active gizmo target.

#### Scenario: Prevent camera-control conflicts during gizmo drags
GIVEN a transform gizmo is visible for the selected model
WHEN the user begins dragging the gizmo
THEN the system suppresses viewport camera manipulation for the duration of the drag
AND WHEN the drag ends
THEN the system restores normal viewport camera controls.
