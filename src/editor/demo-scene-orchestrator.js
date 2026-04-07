export const DEMO_SCENE_FOLDER_NAME = 'moon';
export const DEMO_SCENE_WORKFLOW_ID = 'scene-build';
export const DEMO_CAMERA_WORKFLOW_ID = 'camera-direct';

function normalizeFolderName(folderName) {
    return String(folderName || '').trim().toLowerCase();
}

function compareDemoNames(a, b) {
    return String(a || '').localeCompare(String(b || ''), 'en', {
        numeric: true,
        sensitivity: 'base',
    });
}

export function isDemoSceneFolder(folderName) {
    return normalizeFolderName(folderName) === DEMO_SCENE_FOLDER_NAME;
}

export function buildDemoModelRevealQueue(models = []) {
    return (Array.isArray(models) ? models : [])
        .map((item, index) => ({
            id: String(item?.id || ''),
            name: String(item?.name || ''),
            order: index,
        }))
        .filter((item) => item.id)
        .sort((a, b) => {
            const byName = compareDemoNames(a.name, b.name);
            return byName !== 0 ? byName : a.order - b.order;
        })
        .map(({ order, ...item }) => item);
}

export function buildDemoKeyframeRevealQueue(keyframes = []) {
    return (Array.isArray(keyframes) ? keyframes : [])
        .filter((item) => item && Number.isFinite(Number(item.frame)) && item.camera)
        .map((item) => ({
            frame: Math.round(Number(item.frame) || 0),
            time: Number(item.time) || 0,
            camera: item.camera,
        }))
        .sort((a, b) => {
            if (a.frame !== b.frame) return a.frame - b.frame;
            return a.time - b.time;
        });
}

export function createInactiveDemoSceneState() {
    return {
        active: false,
        folderName: '',
        sceneRevealStarted: false,
        sceneRevealCompleted: false,
        modelRevealQueue: [],
        nextModelIndex: 0,
        keyframeRevealQueue: [],
        nextKeyframeIndex: 0,
        cameraTimelineBackup: [],
        cameraPreviewKeyframes: [],
        cameraPreviewActive: false,
        cameraPreviewCompleted: false,
    };
}

export function createDemoSceneState({ folderName = '', models = [], keyframes = [] } = {}) {
    if (!isDemoSceneFolder(folderName)) {
        return createInactiveDemoSceneState();
    }
    return {
        active: true,
        folderName: String(folderName || ''),
        sceneRevealStarted: false,
        sceneRevealCompleted: false,
        modelRevealQueue: buildDemoModelRevealQueue(models),
        nextModelIndex: 0,
        keyframeRevealQueue: buildDemoKeyframeRevealQueue(keyframes),
        nextKeyframeIndex: 0,
        cameraTimelineBackup: [],
        cameraPreviewKeyframes: [],
        cameraPreviewActive: false,
        cameraPreviewCompleted: false,
    };
}

export function beginDemoCameraPreview(demoState, committedKeyframes = []) {
    if (!demoState?.active) return createInactiveDemoSceneState();
    const backup = demoState.cameraPreviewActive
        ? (Array.isArray(demoState.cameraTimelineBackup) ? demoState.cameraTimelineBackup : [])
        : buildDemoKeyframeRevealQueue(committedKeyframes);
    return {
        ...demoState,
        cameraTimelineBackup: backup,
        cameraPreviewKeyframes: [],
        cameraPreviewActive: true,
        cameraPreviewCompleted: false,
        nextKeyframeIndex: 0,
    };
}

export function revealDemoCameraPreviewThroughCount(demoState, targetCount) {
    if (!demoState?.active) return createInactiveDemoSceneState();
    const queue = Array.isArray(demoState.keyframeRevealQueue) ? demoState.keyframeRevealQueue : [];
    const safeTarget = Math.max(0, Math.min(queue.length, Math.floor(Number(targetCount) || 0)));
    return {
        ...demoState,
        cameraPreviewKeyframes: queue.slice(0, safeTarget),
        nextKeyframeIndex: safeTarget,
        cameraPreviewActive: true,
        cameraPreviewCompleted: safeTarget >= queue.length,
    };
}

export function commitDemoCameraPreview(demoState) {
    if (!demoState?.active) return createInactiveDemoSceneState();
    return {
        ...demoState,
        cameraPreviewActive: false,
        cameraPreviewCompleted: Array.isArray(demoState.cameraPreviewKeyframes)
            && demoState.cameraPreviewKeyframes.length >= (demoState.keyframeRevealQueue?.length || 0),
    };
}

export function restoreDemoCameraBackup(demoState) {
    if (!demoState?.active) return createInactiveDemoSceneState();
    return {
        ...demoState,
        cameraPreviewKeyframes: [],
        cameraPreviewActive: false,
        cameraPreviewCompleted: false,
        nextKeyframeIndex: 0,
    };
}
