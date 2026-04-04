export function resolveFloatingPanelPosition({
    shellRect,
    anchorRect,
    panelWidth,
    panelHeight,
    viewportWidth,
    viewportHeight,
    margin = 12,
    gap = 14,
}) {
    const safePanelWidth = Math.max(0, Number(panelWidth) || 0);
    const safePanelHeight = Math.max(0, Number(panelHeight) || 0);
    const safeViewportWidth = Math.max(1, Number(viewportWidth) || 1);
    const safeViewportHeight = Math.max(1, Number(viewportHeight) || 1);
    const safeShellLeft = Number(shellRect?.left) || 0;
    const safeShellRight = Number(shellRect?.right) || safeViewportWidth;
    const safeAnchorTop = Number(anchorRect?.top) || margin;
    const safeAnchorBottom = Number(anchorRect?.bottom) || safeAnchorTop;

    const minLeft = Math.max(margin, safeShellLeft + margin);
    const maxLeft = Math.max(minLeft, Math.min(safeViewportWidth - margin - safePanelWidth, safeShellRight - margin - safePanelWidth));
    const left = Math.max(minLeft, Math.min(maxLeft, minLeft));

    let top = safeAnchorTop - gap - safePanelHeight;
    if (top < margin) {
        top = safeAnchorBottom + gap;
    }
    const maxTop = Math.max(margin, safeViewportHeight - margin - safePanelHeight);

    return {
        left,
        top: Math.max(margin, Math.min(maxTop, top)),
    };
}

export function resolveFloatingPanelLayerZIndices(activePanelKey) {
    return activePanelKey === 'cameraSettings'
        ? { cameraSettings: 62, cameraPreview: 60 }
        : { cameraSettings: 60, cameraPreview: 62 };
}
