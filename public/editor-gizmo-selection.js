export function resolveViewportSelectionKind({
    cameraSequenceDragEnabled,
    selectedCameraSequenceFrame,
    selectedModelId,
}) {
    if (selectedModelId) {
        return 'model';
    }
    if (cameraSequenceDragEnabled && Number.isFinite(Number(selectedCameraSequenceFrame))) {
        return 'camera';
    }
    return 'none';
}

export function normalizeViewportGizmoModeForSelection(mode, selectionKind) {
    if (selectionKind === 'camera' && mode === 'scale') {
        return 'translate';
    }
    return mode;
}
