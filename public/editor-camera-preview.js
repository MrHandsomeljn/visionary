export const CAMERA_PREVIEW_ASPECT_OPTIONS = [
    { id: '16:9', label: '16:9', width: 16, height: 9, aspect: 16 / 9 },
    { id: '9:16', label: '9:16', width: 9, height: 16, aspect: 9 / 16 },
    { id: '1:1', label: '1:1', width: 1, height: 1, aspect: 1 },
    { id: '4:3', label: '4:3', width: 4, height: 3, aspect: 4 / 3 },
    { id: '3:4', label: '3:4', width: 3, height: 4, aspect: 3 / 4 },
    { id: '21:9', label: '21:9', width: 21, height: 9, aspect: 21 / 9 },
];

const CAMERA_PREVIEW_ASPECT_OPTION_MAP = new Map(
    CAMERA_PREVIEW_ASPECT_OPTIONS.map((item) => [item.id, item])
);

const DEFAULT_CAMERA_PREVIEW_ASPECT_ID = '16:9';

export function normalizeCameraPreviewAspectId(value) {
    const key = typeof value === 'string' ? value.trim() : '';
    return CAMERA_PREVIEW_ASPECT_OPTION_MAP.has(key)
        ? key
        : DEFAULT_CAMERA_PREVIEW_ASPECT_ID;
}

export function getCameraPreviewAspectOption(value) {
    return CAMERA_PREVIEW_ASPECT_OPTION_MAP.get(normalizeCameraPreviewAspectId(value))
        || CAMERA_PREVIEW_ASPECT_OPTION_MAP.get(DEFAULT_CAMERA_PREVIEW_ASPECT_ID)
        || CAMERA_PREVIEW_ASPECT_OPTIONS[0];
}
