## ADDED Requirements

### Requirement: Rough-cut Render Mode Preview
WHEN a user previews or exports the scene,
the system SHALL support color, depth, and normal render modes.

#### Scenario: Change preview render mode
GIVEN the editor scene is active
WHEN the user selects color, depth, or normal mode
THEN the viewport updates to the chosen render mode
AND subsequent export actions default to the selected preview mode unless overridden in the export dialog

### Requirement: Image Export Workflow
WHEN a user requests a still render,
the system SHALL export a scene image using the selected resolution, render mode, and FOV.

#### Scenario: Export image rough cut
GIVEN the export dialog is open in image mode
WHEN the user confirms the export
THEN the system captures the current editor scene with the selected export settings
AND the system downloads or returns the generated image artifact

### Requirement: Video Export Workflow
WHEN a user requests a rough-cut video render,
the system SHALL export a video driven by the editor timeline.

#### Scenario: Export timeline-based video
GIVEN the export dialog is open in video mode
AND the scene contains camera timeline data
WHEN the user confirms the export
THEN the system renders frames using the current timeline state and export settings
AND the system records the rendered frames into a downloadable video artifact

#### Scenario: Export dialog communicates timeline context
GIVEN the export dialog is open
WHEN the requested export type depends on the timeline
THEN the system shows timeline-related guidance in the export dialog
