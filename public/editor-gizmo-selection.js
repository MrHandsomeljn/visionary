export function resolveViewportSelectionKind({
    cameraSequenceDragEnabled,
    hasTimelineCamera,
    cameraGizmoTargetFrame,
    selectedModelId,
    playbackActive = false,
    isExportFrameTraversal = false,
}) {
    if (selectedModelId) {
        return 'model';
    }
    if (
        cameraSequenceDragEnabled
        && hasTimelineCamera
        && Number.isFinite(Number(cameraGizmoTargetFrame))
        && !isExportFrameTraversal
    ) {
        return 'camera';
    }
    return 'none';
}

export function resolveTimelineGizmoTarget({
    isExportFrameTraversal = false,
    cameraSequenceDragEnabled,
    cameraSequenceVisible,
    hasTimelineCamera,
    playbackActive = false,
    selectedModelId,
    currentFrame,
}) {
    if (isExportFrameTraversal) {
        return {
            kind: selectedModelId ? 'model' : 'none',
            frame: null,
            interactive: false,
        };
    }
    if (!cameraSequenceDragEnabled || !cameraSequenceVisible || !hasTimelineCamera) {
        return {
            kind: selectedModelId ? 'model' : 'none',
            frame: null,
            interactive: Boolean(selectedModelId),
        };
    }
    const frame = Math.max(0, Math.round(Number(currentFrame) || 0));
    return {
        kind: 'camera-current',
        frame,
        interactive: !playbackActive,
    };
}

export function normalizeViewportGizmoModeForSelection(mode, selectionKind) {
    if (selectionKind === 'camera' && mode === 'scale') {
        return 'translate';
    }
    return mode;
}
