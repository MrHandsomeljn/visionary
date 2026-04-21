/**
 * Visionary Editor UI Controller 0.1.8
 * Handles UI interactions and connects to EditorApp
 */

import {
    resolveAgentMessageRefreshScrollTop,
    shouldForceAgentMessageBottomAfterRender,
} from './editor-agent-scroll.js';
import {
    appendAgentSessionRetryAttempt,
    createAgentGenerationAttempt,
    createAgentSession,
    createAgentThreadMessage,
    getAgentSessionActiveAttempt,
    patchAgentSessionAttemptBlock,
    resolveAgentSessionActionAvailability,
    resolveAgentSessionPagerItems,
    setAgentSessionArchiveState,
    toggleAgentSessionCollapsed,
    updateAgentSessionAttempt,
} from '../src/editor/agent-session-model.js';
import { AgentSessionStore } from '../src/editor/agent-session-store.js';
import {
    beginDemoCameraPreview,
    buildDemoKeyframeRevealQueue,
    commitDemoCameraPreview,
    createDemoSceneState,
    createInactiveDemoSceneState,
    DEMO_CAMERA_WORKFLOW_ID,
    DEMO_SCENE_WORKFLOW_ID,
    isDemoSceneFolder,
    restoreDemoCameraBackup,
    revealDemoCameraPreviewThroughCount,
} from '../src/editor/demo-scene-orchestrator.js';
import {
    CAMERA_PREVIEW_ASPECT_OPTIONS,
    getCameraPreviewAspectOption,
    normalizeCameraPreviewAspectId,
} from './editor-camera-preview.js';
import {
    normalizeViewportGizmoModeForSelection,
    resolveTimelineGizmoTarget,
    resolveViewportSelectionKind,
} from './editor-gizmo-selection.js';
import {
    resolveFloatingPanelPosition,
    resolveFloatingPanelLayerZIndices,
} from './editor-floating-panels.js';
import { SceneFS } from '../src/app/scene-fs.ts';
import { ProjectApiClient } from '../src/editor/project-api-client.js';

// DOM 元素引用
const dom = {
    app: document.getElementById('app'),
    editorShell: document.getElementById('editor-shell'),
    editorStage: document.getElementById('editor-stage'),
    agentWorkbench: document.getElementById('agent-workbench'),
    agentWorkbenchResizer: document.getElementById('agent-workbench-resizer'),
    btnToggleAgentWorkbench: document.getElementById('btnToggleAgentWorkbench'),
    agentWorkflowStatus: document.getElementById('agentWorkflowStatus'),
    agentWorkflowTabs: document.getElementById('agentWorkflowTabs'),
    btnUserSession: document.getElementById('btnUserSession'),
    agentContextSummary: document.getElementById('agentContextSummary'),
    btnAgentClearConversation: document.getElementById('btnAgentClearConversation'),
    agentMessageScroll: document.querySelector('.agent-message-scroll'),
    agentMessageList: document.getElementById('agentMessageList'),
    agentMessageScrollbar: document.getElementById('agentMessageScrollbar'),
    agentMessageScrollbarThumb: document.getElementById('agentMessageScrollbarThumb'),
    agentTaskCards: document.getElementById('agentTaskCards'),
    agentSuggestionChips: document.getElementById('agentSuggestionChips'),
    agentComposer: document.getElementById('agentComposer'),
    agentComposerDock: document.getElementById('agentComposerDock'),
    agentComposerAttachments: document.getElementById('agentComposerAttachments'),
    agentImageInput: document.getElementById('agentImageInput'),
    agentComposerInput: document.getElementById('agentComposerInput'),
    btnAgentAddImage: document.getElementById('btnAgentAddImage'),
    btnAgentSend: document.getElementById('btnAgentSend'),

    // Canvas 相关
    canvasContainer: document.getElementById('canvas-container'),
    canvas: document.getElementById('canvas'),
    loadingOverlay: document.getElementById('loadingOverlay'),
    progressFill: document.querySelector('#loadingOverlay .progress-fill'),
    progressText: document.querySelector('#loadingOverlay .progress-text'),
    noWebGPU: document.getElementById('noWebGPU'),

    // 顶部菜单
    btnSaveScene: document.getElementById('btnSaveScene'),
    btnLoadScene: document.getElementById('btnLoadScene'),
    btnClearScene: document.getElementById('btnClearScene'),
    btnHelpTips: document.getElementById('btnHelpTips'),
    btnThemeToggle: document.getElementById('btnThemeToggle'),
    btnLanguageToggle: document.getElementById('btnLanguageToggle'),
    workspaceStatusIndicator: document.getElementById('workspaceStatusIndicator'),
    btnClearScreen: document.getElementById('btnClearScreen'),
    exportToolFlyout: document.getElementById('exportToolFlyout'),
    btnExportFlyout: document.getElementById('btnExportFlyout'),

    // 模式按钮
    modeColor: document.getElementById('modeColor'),
    modeDepth: document.getElementById('modeDepth'),
    modeNormal: document.getElementById('modeNormal'),
    btnRenderVideo: document.getElementById('renderVideo'),
    btnRenderImage: document.getElementById('renderImage'),

    // 中部区域
    middleSection: document.getElementById('middle-section'),
    leftSidebar: document.getElementById('left-sidebar'),
    leftSidebarResizer: document.getElementById('left-sidebar-resizer'),
    centerViewport: document.getElementById('center-viewport'),
    modelCountBadge: document.getElementById('modelCountBadge'),
    modelList: document.getElementById('modelList'),
    btnAddModel: document.getElementById('btnAddModel'),

    // 右侧边栏 - 模型编辑器
    rightSidebarResizer: document.getElementById('right-sidebar-resizer'),
    rightSidebar: document.getElementById('right-sidebar'),
    modelSettingsCard: document.getElementById('modelSettingsCard'),
    modelTransformSection: document.getElementById('modelTransformSection'),
    selectedModelName: document.getElementById('selectedModelName'),
    btnCloseEditor: document.getElementById('btnCloseEditor'),
    btnToggleSceneSettings: document.getElementById('btnToggleSceneSettings'),
    btnSceneSettingsClose: document.getElementById('btnSceneSettingsClose'),
    sceneSettingsPanel: document.getElementById('sceneSettingsPanel'),
    sceneBgColorPicker: document.getElementById('sceneBgColorPicker'),
    sceneBgColorHex: document.getElementById('sceneBgColorHex'),
    skyPresetGrid: document.getElementById('skyPresetGrid'),
    sceneDepthScale: document.getElementById('sceneDepthScale'),
    sceneDepthScaleNumber: document.getElementById('sceneDepthScaleNumber'),
    sceneFovRange: document.getElementById('sceneFovRange'),
    sceneFovNumber: document.getElementById('sceneFovNumber'),

    // 变换控件
    btnResetTransform: document.getElementById('btnResetTransform'),
    btnGizmoTranslate: document.getElementById('btnGizmoTranslate'),
    btnGizmoRotate: document.getElementById('btnGizmoRotate'),
    btnGizmoScale: document.getElementById('btnGizmoScale'),

    // 位置
    posX: document.getElementById('posX'),
    posY: document.getElementById('posY'),
    posZ: document.getElementById('posZ'),

    // 旋转
    rotX: document.getElementById('rotX'),
    rotY: document.getElementById('rotY'),
    rotZ: document.getElementById('rotZ'),

    // 缩放
    scaleS: document.getElementById('scaleS'),

    // 模型动画
    onnxAnimSection: document.getElementById('onnxAnimSection'),
    modelAnimSpeed: document.getElementById('modelAnimSpeed'),
    modelAnimSpeedValue: document.getElementById('modelAnimSpeedValue'),

    // 相机模式
    cameraMode: document.getElementById('cameraMode'),
    presetBtns: document.querySelectorAll('.preset-btn'),

    // 时间轴
    bottomTimeline: document.getElementById('bottom-timeline'),
    btnAddKeyframe: document.getElementById('btnAddKeyframe'),
    btnRemoveKeyframe: document.getElementById('btnRemoveKeyframe'),
    btnImportCameraSequence: document.getElementById('btnImportCameraSequence'),
    btnExportCameraSequence: document.getElementById('btnExportCameraSequence'),
    btnClearCameraSequence: document.getElementById('btnClearCameraSequence'),
    btnPlayCamera: document.getElementById('btnPlayCamera'),
    btnLoopCamera: document.getElementById('btnLoopCamera'),
    btnToggleCameraPreview: document.getElementById('btnToggleCameraPreview'),
    btnToggleCameraSettings: document.getElementById('btnToggleCameraSettings'),
    btnCameraPreviewClose: document.getElementById('btnCameraPreviewClose'),
    cameraPreviewPanel: document.getElementById('cameraPreviewPanel'),
    cameraPreviewCanvas: document.getElementById('cameraPreviewCanvas'),
    cameraPreviewViewport: document.getElementById('cameraPreviewViewport'),
    cameraPreviewAspectRatio: document.getElementById('cameraPreviewAspectRatio'),
    cameraPreviewResizeHandle: document.getElementById('cameraPreviewResizeHandle'),
    btnCameraSettingsClose: document.getElementById('btnCameraSettingsClose'),
    cameraSettingsPanel: document.getElementById('cameraSettingsPanel'),
    btnToggleCameraSequence: document.getElementById('btnToggleCameraSequence'),
    btnToggleCameraSequenceDrag: document.getElementById('btnToggleCameraSequenceDrag'),
    timelinePositionInterpolationLabel: document.getElementById('timelinePositionInterpolationLabel'),
    timelineRotationInterpolationLabel: document.getElementById('timelineRotationInterpolationLabel'),
    timelineTimingInterpolationLabel: document.getElementById('timelineTimingInterpolationLabel'),
    timelineCatmullParam: document.getElementById('timelineCatmullParam'),
    timelineRotationParam: document.getElementById('timelineRotationParam'),
    timelineEaseParam: document.getElementById('timelineEaseParam'),
    cameraDisplayScale: document.getElementById('cameraDisplayScale'),
    cameraDisplayScaleValue: document.getElementById('cameraDisplayScaleValue'),
    timelineCameraFovRange: document.getElementById('timelineCameraFovRange'),
    timelineCameraFovNumber: document.getElementById('timelineCameraFovNumber'),
    timelineSpeed: document.getElementById('timelineSpeed'),
    timelineFps: document.getElementById('timelineFps'),
    timelineRuler: document.getElementById('timelineRuler'),
    timelineTrack: document.getElementById('timelineTrack'),
    timelineSlider: document.getElementById('timelineSlider'),
    timeValue: document.getElementById('timeValue'),

    // 文件输入
    fileInput: document.getElementById('fileInput'),
    cameraSequenceFileInput: document.getElementById('cameraSequenceFileInput'),
    modalFileInput: document.getElementById('modalFileInput'),

    // 模态框
    modelModal: document.getElementById('modelModal'),
    modalCancel: document.getElementById('modalCancel'),
    modalConfirm: document.getElementById('modalConfirm'),
    exportModal: document.getElementById('exportModal'),
    exportModalTitle: document.getElementById('exportModalTitle'),
    exportResolution: document.getElementById('exportResolution'),
    exportAspectRatioRow: document.getElementById('exportAspectRatioRow'),
    exportAspectRatio: document.getElementById('exportAspectRatio'),
    exportVideoSpeedRow: document.getElementById('exportVideoSpeedRow'),
    exportVideoSpeed: document.getElementById('exportVideoSpeed'),
    exportVideoFpsRow: document.getElementById('exportVideoFpsRow'),
    exportVideoFps: document.getElementById('exportVideoFps'),
    exportMode: document.getElementById('exportMode'),
    exportFovRow: document.getElementById('exportFovRow'),
    exportFov: document.getElementById('exportFov'),
    exportTimelineHint: document.getElementById('exportTimelineHint'),
    exportProgress: document.getElementById('exportProgress'),
    exportProgressFill: document.getElementById('exportProgressFill'),
    exportProgressText: document.getElementById('exportProgressText'),
    exportCancel: document.getElementById('exportCancel'),
    exportConfirm: document.getElementById('exportConfirm'),
    helpTipsModal: document.getElementById('helpTipsModal'),
    helpTipsClose: document.getElementById('helpTipsClose'),
    helpTipsConfirm: document.getElementById('helpTipsConfirm'),
    btnLoginModalClose: document.getElementById('btnLoginModalClose'),
    btnProjectSessionClose: document.getElementById('btnProjectSessionClose'),
    projectSessionTitle: document.getElementById('projectSessionTitle'),
    projectSessionPrompt: document.getElementById('projectSessionPrompt'),
    projectSessionUsernameInput: document.getElementById('projectSessionUsernameInput'),
    btnProjectSessionLogin: document.getElementById('btnProjectSessionLogin'),
    btnProjectSessionLoginCancel: document.getElementById('btnProjectSessionLoginCancel'),
    projectSessionUserSummary: document.getElementById('projectSessionUserSummary'),
    projectSessionNewProjectName: document.getElementById('projectSessionNewProjectName'),
    projectSessionNewProjectNameError: document.getElementById('projectSessionNewProjectNameError'),
    btnProjectSessionCreateProject: document.getElementById('btnProjectSessionCreateProject'),
    btnProjectSessionDiscard: document.getElementById('btnProjectSessionDiscard'),
    loginModal: document.getElementById('loginModal'),
    postLoginProjectModal: document.getElementById('postLoginProjectModal'),
    projectBrowserModal: document.getElementById('projectBrowserModal'),
    projectBrowserTitle: document.getElementById('projectBrowserTitle'),
    projectBrowserUserSummary: document.getElementById('projectBrowserUserSummary'),
    projectBrowserProjectGrid: document.getElementById('projectBrowserProjectGrid'),
    projectBrowserSaveAsPanel: document.getElementById('projectBrowserSaveAsPanel'),
    projectBrowserSaveAsName: document.getElementById('projectBrowserSaveAsName'),
    projectBrowserSaveAsNameError: document.getElementById('projectBrowserSaveAsNameError'),
    btnProjectBrowserClose: document.getElementById('btnProjectBrowserClose'),
    btnProjectBrowserSaveAs: document.getElementById('btnProjectBrowserSaveAs'),
    btnProjectBrowserSaveAsCancel: document.getElementById('btnProjectBrowserSaveAsCancel'),
    btnProjectBrowserSaveAsConfirm: document.getElementById('btnProjectBrowserSaveAsConfirm'),
    btnProjectBrowserLogout: document.getElementById('btnProjectBrowserLogout'),
    workspaceTargetModal: document.getElementById('workspaceTargetModal'),
    workspaceTargetTitle: document.getElementById('workspaceTargetTitle'),
    workspaceTargetPrompt: document.getElementById('workspaceTargetPrompt'),
    btnWorkspaceTargetClose: document.getElementById('btnWorkspaceTargetClose'),
    btnWorkspaceTargetServer: document.getElementById('btnWorkspaceTargetServer'),
    btnWorkspaceTargetLocal: document.getElementById('btnWorkspaceTargetLocal'),
    btnWorkspaceTargetCancel: document.getElementById('btnWorkspaceTargetCancel'),
    adminProjectModal: document.getElementById('adminProjectModal'),
    adminProjectTitle: document.getElementById('adminProjectTitle'),
    adminProjectSummary: document.getElementById('adminProjectSummary'),
    adminUserList: document.getElementById('adminUserList'),
    adminSceneOwnerLabel: document.getElementById('adminSceneOwnerLabel'),
    adminProjectGrid: document.getElementById('adminProjectGrid'),
    btnAdminProjectClose: document.getElementById('btnAdminProjectClose'),
    btnAdminProjectLogout: document.getElementById('btnAdminProjectLogout'),

    // 版本标签
    versionLabel: document.getElementById('versionLabel'),
};

function createWorkspaceState() {
    return {
        name: null,
        writable: false,
        mode: 'local',
        dirty: false,
        saving: false,
        lastSavedAt: null,
        error: null,
        agentDirty: false,
        agentSaving: false,
        agentLastSavedAt: null,
        agentError: null,
        syncStatus: 'no-workspace',
    };
}

function createProjectSessionState() {
    return {
        user: '',
        authenticated: false,
        isAdmin: false,
        activeProjectId: '',
        activeProjectName: '',
        activeProjectSceneAssetPaths: new Set(),
        activeProjectAgentAssetPaths: new Set(),
        projects: [],
        loadingProjects: false,
        lastError: null,
        adminUsers: [],
        loadingAdminUsers: false,
        adminSelectedUser: '',
    };
}

// 应用状态
const state = {
    VERSION: '0.1.8',
    exportMode: 'color', // 'color' | 'depth' | 'normal'
    selectedModelId: null,
    cameraSequenceVisible: true,
    cameraSequenceDragEnabled: false,
    cameraSequenceDragEnabledBeforeHidden: null,
    selectedCameraSequenceFrame: null,
    cameraMode: 'orbit',
    currentTime: 0,
    isPlaying: false,
    isLooping: false,
    keyframes: [],
    cameraFovKeyframes: [],
    currentKeyframeIndex: -1,
    selectedFrame: 0,
    timelineFps: 24,
    timelinePlaybackSpeed: 1.0,
    cameraPositionInterpolation: 'linear',
    cameraRotationInterpolation: 'slerp',
    cameraTimingInterpolation: 'linear',
    cameraCatmullTension: 1,
    cameraRotationStrength: 0,
    cameraEaseStrength: 0,
    cameraSequenceDisplayScale: 1.0,
    timelineDurationSec: 10,
    sceneBackgroundHex: '#707070',
    sceneSkyPresetId: 'night',
    sceneDepthRangeScale: 1.0,
    sceneCameraFov: 45.0,
    viewportGizmoMode: null,
    sceneSettingsOpen: false,
    cameraPreviewOpen: false,
    cameraPreviewAspectId: '16:9',
    cameraPreviewMaxSize: 320 / 3,
    cameraSettingsOpen: false,
    exportFlyoutOpen: false,
    clearScreenMode: false,
    clearScreenPreview: false,
    uiLanguage: 'zh',
    leftSidebarCollapsed: false,
    agentWorkbenchCollapsed: false,
    agentWorkflow: 'scene-build',
    agentWorkflowThreads: {},
    agentMessages: [],
    agentPendingImages: [],
    demoScene: createInactiveDemoSceneState(),
    workspace: createWorkspaceState(),
    projectSession: createProjectSessionState(),
    pendingWorkspaceTargetAction: null,
    forceFullWorkspaceAssetMigration: false,
    forceFullServerAssetMigration: false,
};

// EditorApp 实例 (会在 init 后设置)
let app = null;
const sceneFs = new SceneFS();
let animationUiSyncTimer = null;
let labelDragState = null;
let isInputLabelDragging = false;
let timelinePlaybackRaf = 0;
let timelinePlaybackLastTime = 0;
let imageExportApi = null;
let videoExportApi = null;
let pendingExportType = null;
let isExporting = false;
let syncingCameraSequenceSelection = false;
let syncingSelectedModelSelection = false;
let cameraPreviewDragState = null;
let cameraPreviewResizeState = null;
let activeFloatingPanelKey = 'cameraPreview';
let keyframeMarkerDrag = null;
let suppressMarkerClickOnce = false;
let sidebarResizeState = null;
let agentWorkbenchResizeState = null;
let agentMessageScrollbarDragState = null;
let agentPreviewManagerPromise = null;
let agentMessageBottomPinRaf = 0;
let agentMessageBottomPinFramesRemaining = 0;
let agentMessageScrollbarSyncRaf = 0;
let agentWorkbenchResizeRaf = 0;
let agentSessionStore = null;
let agentSessionPersistTimer = 0;
let preferredLeftSidebarWidth = null;
let preferredRightSidebarWidth = null;
let preferredAgentWorkbenchWidth = null;
let sidebarWidthDebugHistory = [];
let cameraControlDebugSamples = [];
let cameraControlDebugLastDragLogAt = 0;
let demoSceneModelRevealTimer = 0;
let workspaceAutosaveTimer = 0;
let workspaceSaveInFlight = null;
let workspaceSaveQueued = false;
let serverProjectAutosaveInFlight = null;
let serverProjectAutosaveQueued = false;
let lastCanvasViewportSync = null;
const projectApi = new ProjectApiClient();
const agentSessionActionHandlers = {
    onCancel: null,
    onRetry: null,
    onApply: null,
};
const THEME_STORAGE_KEY = 'visionary_editor_theme';
const UI_LANGUAGE_STORAGE_KEY = 'visionary_editor_ui_language_v1';
const PROJECT_SESSION_USER_STORAGE_KEY = 'visionary_editor_project_session_user_v1';
const AGENT_WORKBENCH_WIDTH_STORAGE_KEY = 'visionary_editor_agent_workbench_width_v1';
const AGENT_WORKBENCH_COLLAPSED_STORAGE_KEY = 'visionary_editor_agent_workbench_collapsed_v1';
const AGENT_WORKBENCH_WORKFLOW_STORAGE_KEY = 'visionary_editor_agent_workbench_workflow_v1';
const AGENT_WORKBENCH_DEFAULT_WIDTH = 360;
const AGENT_WORKBENCH_MIN_WIDTH = 314;
const AGENT_WORKBENCH_MAX_WIDTH = 520;
const AGENT_WORKBENCH_COLLAPSED_WIDTH = 64;
const LEFT_SIDEBAR_WIDTH_STORAGE_KEY = 'visionary_editor_left_sidebar_width_v4';
const RIGHT_SIDEBAR_WIDTH_STORAGE_KEY = 'visionary_editor_right_sidebar_width';
const TIMELINE_FPS_OPTIONS = [12, 24, 30, 60];
const TIMELINE_MIN_DURATION_SEC = 10;
const TIMELINE_SLIDER_THUMB_PX = 16;
const EXPORT_FALLBACK_FPS = 24;
const LEGACY_CAMERA_INTERPOLATION_MODE_LINEAR = 'linear';
const LEGACY_CAMERA_INTERPOLATION_MODE_SQUAD = 'squad';
const LEGACY_CAMERA_INTERPOLATION_MODE_CATMULL = 'catmull';
const LEGACY_CAMERA_INTERPOLATION_MODE_EASE = 'ease';
const LEGACY_CAMERA_INTERPOLATION_PARAM_STORAGE_KEY = 'visionary_editor_camera_interpolation_param';
const LEGACY_CAMERA_INTERPOLATION_MODE_STORAGE_KEY = 'visionary_editor_camera_interpolation_mode';
const CAMERA_POSITION_INTERPOLATION_LINEAR = 'linear';
const CAMERA_POSITION_INTERPOLATION_CATMULL = 'catmull';
const CAMERA_ROTATION_INTERPOLATION_SLERP = 'slerp';
const CAMERA_ROTATION_INTERPOLATION_SQUAD = 'squad';
const CAMERA_TIMING_INTERPOLATION_LINEAR = 'linear';
const CAMERA_TIMING_INTERPOLATION_EASE = 'ease';
const CAMERA_POSITION_INTERPOLATION_STORAGE_KEY = 'visionary_editor_camera_position_interpolation_mode';
const CAMERA_ROTATION_INTERPOLATION_STORAGE_KEY = 'visionary_editor_camera_rotation_interpolation_mode';
const CAMERA_TIMING_INTERPOLATION_STORAGE_KEY = 'visionary_editor_camera_timing_interpolation_mode';
const CAMERA_POSITION_INTERPOLATION_STRENGTH_STORAGE_KEY = 'visionary_editor_camera_position_interpolation_strength';
const CAMERA_CATMULL_TENSION_STORAGE_KEY = 'visionary_editor_camera_catmull_tension';
const CAMERA_ROTATION_STRENGTH_STORAGE_KEY = 'visionary_editor_camera_rotation_strength';
const CAMERA_EASE_STRENGTH_STORAGE_KEY = 'visionary_editor_camera_ease_strength';
const CAMERA_DISPLAY_SCALE_STORAGE_KEY = 'visionary_editor_camera_display_scale';
const CAMERA_PREVIEW_ASPECT_STORAGE_KEY = 'visionary_editor_camera_preview_aspect_ratio_v1';
const CAMERA_DISPLAY_SCALE_MIN = 0.25;
const CAMERA_DISPLAY_SCALE_MAX = 3.0;
const CAMERA_DISPLAY_SCALE_DEFAULT = 1.0;
const CAMERA_PREVIEW_MAX_SIZE_DEFAULT = 320 / 3;
const CAMERA_PREVIEW_MAX_SIZE_MIN = 72;
const CAMERA_PREVIEW_MAX_SIZE_MAX = 220;
const CAMERA_PREVIEW_PANEL_HORIZONTAL_PADDING = 24;
const CAMERA_PREVIEW_PANEL_DEFAULT_GAP = 12;
const CAMERA_POSITION_INTERPOLATION_CONFIGS = {
    [CAMERA_POSITION_INTERPOLATION_LINEAR]: {
        get label() { return t('timeline.interpolationModes.linear'); },
    },
    [CAMERA_POSITION_INTERPOLATION_CATMULL]: {
        get label() { return t('timeline.interpolationModes.catmull'); },
        tunable: true,
        get paramLabel() { return t('timeline.interpolationParams.catmull'); },
        min: 0,
        max: 1,
        step: 0.01,
        defaultParam: 1,
        format: (value) => value.toFixed(2),
    },
};
const CAMERA_ROTATION_INTERPOLATION_CONFIGS = {
    [CAMERA_ROTATION_INTERPOLATION_SLERP]: {
        get label() { return t('timeline.rotationModes.slerp'); },
    },
    [CAMERA_ROTATION_INTERPOLATION_SQUAD]: {
        get label() { return t('timeline.interpolationModes.squad'); },
    },
};
const CAMERA_ROTATION_INTERPOLATION_STRENGTH_CONFIG = {
    min: 0,
    max: 1,
    step: 0.01,
    defaultParam: 0,
    format: (value) => value.toFixed(2),
};
const CAMERA_TIMING_INTERPOLATION_CONFIGS = {
    [CAMERA_TIMING_INTERPOLATION_LINEAR]: {
        get label() { return t('timeline.interpolationModes.linear'); },
    },
    [CAMERA_TIMING_INTERPOLATION_EASE]: {
        get label() { return t('timeline.interpolationModes.ease'); },
        tunable: true,
        get paramLabel() { return t('timeline.interpolationParams.ease'); },
        min: -1,
        max: 1,
        step: 0.01,
        defaultParam: 0,
        format: (value) => value.toFixed(2),
    },
};
const MODEL_ANIM_SPEED_MIN = 0.01;
const MODEL_ANIM_SPEED_MAX = 100;
const MODEL_ANIM_SPEED_STEP = 0.001;
const MODEL_ANIM_SPEED_MIN_LOG = Math.log10(MODEL_ANIM_SPEED_MIN);
const MODEL_ANIM_SPEED_MAX_LOG = Math.log10(MODEL_ANIM_SPEED_MAX);
const SCENE_DEPTH_SCALE_MIN = 0.01;
const SCENE_DEPTH_SCALE_MAX = 100;
const SCENE_DEPTH_SCALE_STEP = 0.001;
const SCENE_DEPTH_SCALE_MIN_LOG = Math.log10(SCENE_DEPTH_SCALE_MIN);
const SCENE_DEPTH_SCALE_MAX_LOG = Math.log10(SCENE_DEPTH_SCALE_MAX);
const MODEL_ANIM_DURATION_FALLBACK_SEC = 2.5;
const LEFT_SIDEBAR_DEFAULT_WIDTH = 290;
const LEFT_SIDEBAR_MIN_WIDTH = 220;
const LEFT_SIDEBAR_COMPACT_WIDTH = 230;
const RIGHT_SIDEBAR_DEFAULT_WIDTH = 380;
const RIGHT_SIDEBAR_MIN_WIDTH = 272;
const RIGHT_SIDEBAR_NARROW_WIDTH = 360;
const RIGHT_SIDEBAR_XNARROW_WIDTH = 330;
const CENTER_VIEWPORT_MIN_WIDTH = 350;
const DEMO_SCENE_MODEL_REVEAL_INTERVAL_MS = 260;
const EXPORT_PRESET_RESOLUTIONS = [
    { width: 1280, height: 720, label: '1280 x 720 (720p)' },
    { width: 1920, height: 1080, label: '1920 x 1080 (1080p)' },
    { width: 2560, height: 1440, label: '2560 x 1440 (2K)' },
    { width: 3840, height: 2160, label: '3840 x 2160 (4K)' },
];

const UI_TEXT = {
    zh: {
        editor: {
            title: 'Visionary Editor 0.1.8',
        },
        loading: {
            default: '加载中...',
            loadingModel: '加载模型中... ({current}/{total})',
            renderingVideo: '渲染视频中...',
            renderingImage: '渲染图片中...',
            savingAssets: '保存资源中... ({current}/{total})',
            writingSceneJson: '写入 scene.json ...',
            loadingSceneAssets: '加载场景资源中... ({current}/{total})',
        },
        common: {
            agent: 'Agent',
            addImage: '添加图片',
            send: '发送',
            remove: '移除',
            removeImage: '移除图片 {name}',
            expand: '展开',
            collapse: '收起',
            close: '关闭',
            settings: '设置',
            cancel: '取消',
            confirm: '确定',
            render: '渲染',
            rendering: '渲染中...',
            reset: '重置',
            archived: '已归档',
            version: '版本 {current}/{total}',
            previousPage: '上一页',
            nextPage: '下一页',
            retryVersions: '重试版本',
            switchToVersion: '切换到版本 {page}',
            errorPrefix: '错误',
            currentWindow: '当前窗口',
            active: '已开启',
            inactive: '已关闭',
            visible: '可见',
            hidden: '隐藏',
            applied: '已应用',
            canceled: '已取消',
            completed: '已完成',
            generating: '生成中',
            failed: '失败',
            user: '用户',
            none: '无',
        },
        workspaceStatus: {
            localOnly: '仅本地同步',
            localChanges: '本地有未导出更改',
            localFolder: '本地目录：{name}',
            localFolderSet: '工作区已设置到本地目录“{name}”',
            loginToSync: '登录后可同步到服务器项目',
            noLocalWorkspace: '未选择同步工作区',
            offline: '离线',
            cannotSync: '无法同步到服务器项目',
            syncFailed: '同步失败',
            syncing: '正在同步',
            projectLabel: '项目：{name}',
            projectSyncInProgress: '项目同步中',
            unsyncedChanges: '有未同步更改',
            noActiveProjectSelected: '尚未选择项目',
            noActiveProject: '未打开项目',
            chooseProjectBeforeSync: '同步前需要先选择服务器项目',
            synced: '已同步',
            lastStaged: '上次暂存',
            ariaLabel: '工作区状态',
            chooserTitle: '设置工作区',
            chooserPrompt: '选择工作区目标',
            chooserPromptLoadScene: '当前未设置工作区。请先选择工作区目标，再继续加载场景。',
            setServer: '设置工作区到服务器',
            resetServer: '重设工作区到服务器',
            setLocal: '设置工作区到本地',
            resetLocal: '重设工作区到本地',
        },
        projectSession: {
            userButtonLogin: '登录',
            userButtonTooltipLoggedIn: '项目与退出',
            loginTitle: '登录',
            usernameLabel: '用户名',
            usernamePlaceholder: '输入用户名',
            loginAction: '登录',
            loginSuccessTitle: '登录成功',
            savePrompt: '是否将当前场景改动保存到新项目中？',
            currentUser: '当前用户：{user}',
            newProjectLabel: '新项目名',
            discardAction: '丢弃',
            saveAsNewAction: '保存为新项目',
            browserTitle: '我的项目',
            saveAsLabel: '另存为项目名',
            saveAction: '保存',
            saveCurrentAsAction: '当前项目另存为',
            logoutAction: '退出登录',
            adminTitle: '管理员面板',
            adminSummary: '管理所有用户及其服务器项目',
            userListLabel: '用户列表',
            sceneListLabel: '场景列表',
            loadingProjects: '正在加载项目...',
            noProjectsYet: '暂无历史项目',
            currentBadge: '当前项目',
            openAction: '打开',
            loadingUsers: '正在加载用户...',
            noUsersFound: '暂无用户',
            projectCount: '{count} 个项目',
            deleteUserAria: '删除用户',
            deleteProjectAria: '删除项目',
            projectsOfUser: '{user} 的场景',
            selectUser: '请选择一个用户',
            selectUserToViewProjects: '选择用户后查看项目',
            noAdminProjectsYet: '暂无项目',
            loginRequired: '请先登录',
            enterUsername: '请输入用户名',
            loggedInAs: '已登录为 {user}',
            keptWithoutCreating: '已保留当前场景，未创建新项目',
            projectSynced: '项目已同步：{name}',
            loadingProject: '正在加载项目...',
            openedProject: '已打开项目“{name}”',
            openProjectFailedEmpty: '打开项目失败：未能恢复历史场景内容，已阻止空场景覆盖服务器项目',
            savingProject: '正在保存项目...',
            duplicateProjectName: '项目名称与现有名称重复',
            exportingProject: '正在导出项目...',
            exportProject: '导出项目',
            projectExported: '项目已导出到“{name}”',
            exportCancelled: '已取消导出项目',
            exportFailed: '导出项目失败',
            folderFallback: '文件夹',
        },
        theme: {
            switchToLight: '切换到白天',
            switchToDark: '切换到夜间',
            toggle: '切换主题',
        },
        language: {
            buttonWhenZh: 'En',
            buttonWhenEn: '简',
            switchToEnglish: '切换到英文',
            switchToChinese: '切换到中文',
            toggle: '切换语言',
        },
        canvas: {
            loading: '加载中...',
            noWebgpuTitle: '不支持 WebGPU',
            noWebgpuIntro: '此应用需要浏览器支持 WebGPU。',
            noWebgpuBrowserHint: '请使用以下浏览器之一：',
            noWebgpuBrowserChrome: 'Chrome/Edge 113 或更高版本',
            noWebgpuBrowserFirefox: 'Firefox Nightly',
            noWebgpuCheck: '检查浏览器支持',
        },
        agent: {
            workbench: 'Agent 工作台',
            workflowTabs: 'Agent 流程',
            messageHistory: '对话记录',
            pendingImages: '待发送图片',
            inputPlaceholder: '输入一句自然语言，触发当前流程的占位 Agent 响应',
            collapsedTooltip: '收起 Agent 工作台',
            expandedTooltip: '展开 Agent 工作台',
            resizeAria: '调整 Agent 工作台宽度',
            promptProcessing: '处理中',
            imageLoading: '图像生成中',
            resetView: '重置视角',
            archivePreview: '展开查看',
            collapseSession: '收起',
            actions: {
                cancel: '取消',
                retry: '重试',
                apply: '应用',
            },
            workflows: {
                'scene-build': {
                    title: '场景构建',
                    short: '场景',
                    starter: '可以从一张参考图或一句场景描述开始。我会先帮你拆出空间结构、主体布置和光照氛围，再给出可继续编辑的场景草案。',
                    suggestions: [
                        '帮我生成这张图对应的场景',
                        '补全这个房间，保持原有镜头方向',
                        '把这个空场景扩展成可拍摄的电影空间',
                        '先给我一个室内场景搭建方案',
                    ],
                    progressTitle: '场景构建中',
                    reply: '占位 Agent：已收到“场景构建”指令。\n建议先基于参考图抽取主体、地面和光照，再生成一个可人工接管的场景草案。\n当前不会直接改动右侧场景，后续可把这一步接到真实场景装配。',
                    sceneSketch: '场景草图',
                    sceneSketchAlt: '场景草图预览',
                },
                'object-insert': {
                    title: '物体插入',
                    short: '物体',
                    starter: '这个流程适合补充场景里的关键资产。你可以给我一张参考图、一段文字，或者后续在画布上选点，我会把物体生成和放置策略一起整理出来。',
                    suggestions: [
                        '在画面左侧补一张沙发和小茶几',
                        '帮我生成一个工业风吊灯并放到天花板中央',
                        '在镜头前景插入一辆停靠的摩托车',
                        '根据这张参考图补一个带金属质感的路灯',
                    ],
                    progressTitle: '物体生成中',
                    reply: '占位 Agent：我会把“物体插入”拆成“生成资产”和“放置策略”两步。\n如果后续接入 canvas 选点，我会优先使用选点深度和法向来推导物体落位。\n当前仅回显方案，不执行插入。',
                    objectPreview: '物体预览',
                },
                'character-create': {
                    title: '人物创造',
                    short: '人物',
                    starter: '这里用来处理角色创建。可以先做 T-Pose 人物，再继续到骨骼绑定和动作生成。我会优先把角色设定、动作来源和接入顺序整理清楚。',
                    suggestions: [
                        '生成一个长风衣女主的 T-Pose 角色',
                        '帮我做一个适合近景表演的男性角色草案',
                        '为现有人物准备骨骼绑定步骤',
                        '根据参考视频生成一个缓慢转身动作',
                    ],
                    progressTitle: '人物创建中',
                    reply: '占位 Agent：当前在“人物创造”流程中，我会优先把需求拆成角色形象、骨骼结构和动作来源三部分。\n这一步适合先输出流程卡和资产需求清单，再逐步接入角色工具链。',
                    characterConcept: '人物概念图',
                    characterConceptAlt: '人物概念图预览',
                    characterPreview: '角色模型预览',
                },
                'camera-direct': {
                    title: '运镜生成',
                    short: '运镜',
                    starter: '这里可以直接用自然语言生成镜头设计。我会先理解主体、节奏和情绪，再把它拆成相机路径、关键帧和时长分配。',
                    suggestions: [
                        '给这个场景做一个 8 秒推进镜头',
                        '生成一个从门外推进到人物特写的镜头序列',
                        '围绕主体做一段缓慢环绕运镜',
                        '帮我设计一个结尾停留在窗边的镜头',
                    ],
                    progressTitle: '镜头规划中',
                    reply: '占位 Agent：已进入“运镜生成”模式。\n我会先把自然语言拆成镜头目标、镜头运动和时长分配，再映射成相机关键帧草案。\n当前不会写入时间轴，但会按这个结构返回建议。',
                },
            },
            blocks: {
                progress: '进度',
                image: '图像',
                viewer3d: '3D 预览',
                placeholder: '占位',
                ready: '已完成',
                progressQueued: '等待 Agent 启动',
                progressParse: '解析任务目标',
                progressPlan: '整理生成步骤',
                progressCompose: '组合输出内容',
                progressDone: '已完成',
            },
        },
        sidebar: {
            title: '场景管理',
            loadModel: '加载模型',
            loadScene: '加载场景',
            saveScene: '保存场景',
            clearScene: '清空场景',
            collapsePanel: '收起模型面板',
            expandPanel: '展开模型面板',
            emptyTitle: '暂无模型',
            emptyHint: '拖拽文件到此处，或点击加号按钮',
            transform: '变换',
            animation: '动画',
            position: '位置',
            rotation: '旋转',
            scale: '缩放',
            speed: '速率',
            pointCount: '{count} 点',
            toggleVisibility: '切换可见性',
            deleteModel: '删除',
            resizeModelList: '调整模型列表宽度',
        },
        sceneSettings: {
            title: '场景设置',
            close: '收起设置',
            resizePanel: '调整设置面板宽度',
            background: '背景色',
            preset: '预设',
            mode: '模式',
            depthScale: '深度倍率',
            aspect: '比例',
            fov: 'FOV',
            renderModes: {
                color: '图片',
                depth: '深度图',
                normal: '法向图',
            },
            skyPresets: {
                studio: '工作室',
                black: '纯黑',
                white: '纯白',
                clear_day: '晴空',
                sunset: '日落',
                dusk: '暮光',
                night: '夜空',
            },
        },
        toolbar: {
            transformTools: '变换工具',
            clearTools: '清屏工具',
            exportTools: '导出工具',
            panelTools: '面板工具',
            translate: '移动',
            rotate: '旋转',
            scale: '缩放',
            clearScreen: '清屏',
            export: '导出',
            exportImage: '导出图片',
            exportVideo: '导出视频',
            sceneSettings: '场景设置',
            help: '操作提示',
        },
        timeline: {
            title: '相机关键帧',
            cameraPreview: '预览',
            cameraPreviewTitle: '相机预览',
            cameraSettings: '控制',
            cameraSettingsTitle: '相机控制',
            openCameraPreview: '打开相机预览',
            closeCameraPreview: '关闭相机预览',
            openCameraSettings: '打开相机设置',
            previewRatio: '比例',
            track: '轨迹',
            drag: '拖动',
            dragHint: '在自由视角下拖动相机关键帧',
            toggleSequenceVisibility: '切换相机序列可见性',
            size: '大小',
            fov: 'FOV',
            interpolation: '插值',
            positionInterpolation: '位置插值',
            rotationInterpolation: '旋转插值',
            timingInterpolation: '时间节奏',
            parameter: '参数',
            keyframes: '关键帧',
            cameraSequence: '相机序列',
            addKeyframe: '新增关键帧',
            removeKeyframe: '删除关键帧',
            pauseCamera: '暂停相机动画',
            importSequence: '导入相机序列',
            exportSequence: '导出相机序列',
            clearSequence: '清空相机序列',
            playbackControls: '播放控制',
            playCamera: '播放相机动画',
            loopPlayback: '循环播放',
            speed: '倍速',
            placeholder: '添加关键帧开始录制相机运动',
            interpolationModes: {
                linear: '线性',
                squad: 'Squad',
                catmull: 'Catmull',
                ease: 'Ease',
            },
            rotationModes: {
                slerp: 'Slerp',
            },
            interpolationParams: {
                catmull: '张力',
                ease: '强度',
            },
        },
        modal: {
            modelTitle: '选择模型文件',
            modelHint: '选择要添加的模型文件（支持 .ply, .onnx, .glb, .gltf, .obj, .fbx, .stl, .splat, .ksplat, .spz, .sog）',
            exportTitle: '导出',
            exportVideoTitle: '渲染视频',
            exportImageTitle: '渲染图片',
            resolution: '分辨率',
            aspectRatio: '相机比例',
            playbackSpeed: '导出倍速',
            exportFps: '导出 FPS',
            renderMode: '渲染模式',
            exportRenderModes: {
                rgb: '彩色图',
                depth: '深度图',
                normal: '法向图',
            },
            exportProgressIdle: '准备渲染',
            exportProgressValue: '渲染进度 {percent}%',
            helpTitle: '操作提示',
            closeHelp: '关闭操作提示',
            gotIt: '知道了',
            helpSections: {
                mouse: '鼠标操作',
                keyboard: '键盘快捷键',
                camera: '相机移动',
            },
            helpItems: {
                mouseRotate: '旋转视角',
                mousePan: '平移视角',
                mouseZoom: '缩放视角',
                mouseLookAt: '聚焦到双击位置的场景点',
                dropFiles: '导入模型到场景',
                playPause: '播放 / 暂停相机动画',
                focusModel: '聚焦当前选中模型',
                addKeyframe: '在当前视角和时间新增相机关键帧；若后方无关键帧则时间轴前进 1 秒',
                toggleClean: '切换清屏模式',
                toggleGizmo: '切换位移 / 旋转 / 缩放 gizmo；重复按同键可关闭',
                uprightCamera: '相机回正',
                openHelp: '打开操作提示',
                closeOverlay: '关闭操作提示或导出窗口',
                movePlane: '前后左右移动',
                moveVertical: '上升 / 下降',
                speedUp: '加速移动',
            },
            exportCurrentFrame: '将导出当前视角的单帧图像',
            exportTimeline: '时间轴导出: {duration}s, {fps} FPS, {frames} 帧, 关键帧 {keyframes}',
        },
        messages: {
            agentOperationFailed: 'Agent 操作失败: {message}',
            imagesAddedToComposer: '已添加 {count} 张图片到输入区',
            imageAddedToComposer: '图片已加入输入区',
            retryRequest: '重试任务',
            imageInput: '图片输入',
            demoSceneAlreadyFilled: 'Demo 场景已完成填充',
            demoSceneRevealStarted: 'Demo 场景开始填充',
            demoCameraPreviewMissing: '当前没有待应用的 Demo 相机预览',
            demoCameraTimelineApplied: 'Demo 相机时间轴已应用',
            demoCameraPreviewCanceled: 'Demo 相机预览已取消，并恢复原时间轴',
            demoCameraCompletion: '请查看当前相机，并确认是否应用。',
            agentExecutionFailed: 'Agent 执行失败',
            agentPreviewPlaceholder: 'Agent 生成预览占位',
            invalidDepthScale: '深度倍率格式错误',
            setDepthScaleFailed: '设置深度倍率失败',
            depthScaleSet: '深度倍率: {value}x',
            invalidFov: 'FOV 格式错误',
            timelineFovSet: '时间轴 FOV: {value}°',
            fovSet: 'FOV: {value}°',
            setFovFailed: '设置 FOV 失败',
            invalidBackgroundColor: '背景色格式错误，请使用 #RRGGBB',
            setBackgroundFailed: '设置背景色失败',
            skyPresetMissing: '天空球预设不存在: {id}',
            skyPresetSet: '天空球预设: {name}',
            cameraKeyframeMoveRotateOnly: '相机关键帧仅支持移动和旋转',
            viewportGizmoSet: '视口控件: {mode}',
            viewportGizmoOff: '视口控件: 已关闭',
            switchToFreeCamera: '请先切换到自由视角',
            cameraKeyframeDragState: '相机关键帧拖动: {state}',
            cameraPreviewState: '相机预览: {state}',
            cameraPreviewAspectSet: '相机预览比例: {label}',
            setCameraSequenceVisibilityFailed: '设置相机序列可见性失败',
            setCameraDisplaySizeFailed: '设置相机显示大小失败',
            modelVisibility: '模型可见性: {state}',
            modelSelectionCleared: '已取消选中模型',
            selectedModel: '选中模型: {name}',
            modelUpdated: '模型已更新',
            transformReset: '变换已重置',
            noModelSelected: '未选中模型',
            switchRenderModeFailed: '切换渲染模式失败: {mode}',
            displayModeSet: '显示模式: {mode}',
            exportDialogNotInitialized: '导出弹窗未初始化',
            editorNotInitializedExport: '编辑器尚未初始化，无法导出',
            invalidResolution: '分辨率格式错误',
            invalidRenderMode: '渲染模式无效: {mode}',
            invalidPlaybackSpeed: '倍速格式错误',
            imageExportDataUnavailable: '无法导出图片数据',
            renderContextUnavailableImage: '渲染上下文不可用，无法导出图片',
            recordingCameraInitFailed: '录制相机初始化失败',
            addKeyframeBeforeVideoExport: '请先在时间轴添加至少 1 个相机关键帧',
            renderContextUnavailableVideo: '渲染上下文不可用，无法导出视频',
            imageExported: '图片导出完成: {width}x{height}, {mode}',
            videoExported: '视频导出完成: {width}x{height}, {mode}',
            exportFailed: '导出失败: {message}',
            invalidAssetPath: '无效资源路径: {path}',
            sceneSavedToWorkspace: '场景已保存到工作区 "{name}"：{count} 个资源{skipped}',
            sceneSavedSkippedAssets: '，跳过 {count} 个无源模型',
            editorNotInitializedExportProject: '编辑器尚未初始化，无法导出项目',
            editorNotInitializedLoadScene: '编辑器尚未初始化，无法加载场景',
            emptySceneAssets: 'scene.json 中没有可加载的 assets/scenes 模型条目',
            loadSceneClearConfirm: '加载场景会先清空当前模型，是否继续？',
            openProjectReplaceConfirm: '打开项目会替换当前场景，是否继续？',
            urlAssetLoadFailed: 'URL 资源加载失败: {status}',
            fallbackUrlAssetLoadFailed: 'Fallback URL 资源加载失败: {status}',
            missingAssetPath: '资产缺少可读取路径: {name}',
            loadModelFailed: '加载模型失败: {name}',
            sceneLoaded: '场景加载完成（{name}）：成功 {loaded}，失败 {failed}',
            demoSceneLoaded: '场景加载完成（{name} Demo）：成功 {loaded}，失败 {failed}',
            loadSceneFailed: '加载场景失败: {message}',
            editorNotInitialized: '编辑器尚未初始化',
            projectSavedAsCurrent: '已将当前内容保存为项目“{name}”',
            confirmDeleteProject: '确认删除用户“{user}”的项目“{projectId}”？',
            deletingProject: '正在删除项目...',
            projectDeleted: '项目已删除',
            confirmDeleteUser: '确认删除用户“{user}”及其所有项目？',
            deletingUser: '正在删除用户...',
            userDeleted: '用户已删除',
            clearSceneConfirm: '确定要清空所有模型吗？',
            sceneCleared: '场景已清空',
            cameraInterpolationSet: '相机插值: {mode}',
            cameraInterpolationAxisSet: '{axis}: {mode}',
            parameterSet: '{label}: {value}',
            invalidFps: 'FPS 格式错误',
            keyframeAdjusted: '关键帧已调整: {time}s',
            modelAnimationClipUpdated: '模型动画片段已更新',
            modelTrackLoopEnds: '循环结束 {time}s',
            modelAnimationOverflow: '模型动画播放时长超过当前 clip 时长',
            cameraPoseReadFailed: '无法读取当前相机位姿',
            keyframeOverwritten: '关键帧已覆盖: {time}s',
            keyframeAdded: '关键帧已新增: {time}s',
            fovKeyframeDeleted: 'FOV 关键帧已删除: {time}s',
            noKeyframeAtCurrentTime: '当前时间戳无关键帧: {time}s',
            keyframeDeleted: '关键帧已删除: {time}s',
            cameraSequenceExported: '相机序列已导出: {poseCount} 个位姿关键帧，{fovCount} 个 FOV 关键帧',
            clearCameraSequenceConfirm: '确定要清空当前相机序列吗？',
            cameraSequenceCleared: '相机序列已清空',
            missingKeyframesArray: '缺少 keyframes 数组',
            cameraSequenceImported: '相机序列已导入: {poseCount} 个位姿关键帧，{fovCount} 个 FOV 关键帧',
            cameraSequenceImportFailed: '导入相机序列失败: {message}',
            cameraAnimationPaused: '相机动画: 暂停',
            cameraAnimationPlaying: '相机动画: 播放',
            cameraAnimationLoopState: '相机动画循环: {state}',
            cameraPresetSet: '相机预设: {preset}',
            focusModel: '聚焦模型: {name}',
            cameraUpright: '相机回正',
            cameraModeSet: '相机模式: {mode}',
            playbackSpeedSet: '全局播放倍速: {speed}x',
            timelineAutoFit: '时间轴已自动适配到 {duration}s',
            canvasNotFound: 'Canvas element not found',
            editorAppModuleLoadFailed: 'Failed to load EditorApp module: {message}',
            editorInitFailed: 'Failed to initialize editor',
        },
    },
    en: {
        editor: {
            title: 'Visionary Editor 0.1.8',
        },
        loading: {
            default: 'Loading...',
            loadingModel: 'Loading models... ({current}/{total})',
            renderingVideo: 'Rendering video...',
            renderingImage: 'Rendering image...',
            savingAssets: 'Saving assets... ({current}/{total})',
            writingSceneJson: 'Writing scene.json ...',
            loadingSceneAssets: 'Loading scene assets... ({current}/{total})',
        },
        common: {
            agent: 'Agent',
            addImage: 'Add image',
            send: 'Send',
            remove: 'Remove',
            removeImage: 'Remove image {name}',
            expand: 'Expand',
            collapse: 'Collapse',
            close: 'Close',
            settings: 'Settings',
            cancel: 'Cancel',
            confirm: 'Confirm',
            render: 'Render',
            rendering: 'Rendering...',
            reset: 'Reset',
            archived: 'Archived',
            version: 'Version {current}/{total}',
            previousPage: 'Previous page',
            nextPage: 'Next page',
            retryVersions: 'Retry versions',
            switchToVersion: 'Switch to version {page}',
            errorPrefix: 'Error',
            currentWindow: 'Current viewport',
            active: 'On',
            inactive: 'Off',
            visible: 'Visible',
            hidden: 'Hidden',
            applied: 'Applied',
            canceled: 'Canceled',
            completed: 'Completed',
            generating: 'Generating',
            failed: 'Failed',
            user: 'User',
            none: 'None',
        },
        workspaceStatus: {
            localOnly: 'Local sync only',
            localChanges: 'Local changes not exported',
            localFolder: 'Local folder: {name}',
            localFolderSet: 'Workspace set to local folder "{name}"',
            loginToSync: 'Login to sync with server projects',
            noLocalWorkspace: 'No sync workspace selected',
            offline: 'Offline',
            cannotSync: 'Cannot sync to server project',
            syncFailed: 'Sync failed',
            syncing: 'Syncing',
            projectLabel: 'Project: {name}',
            projectSyncInProgress: 'Project sync in progress',
            unsyncedChanges: 'Unsynced changes',
            noActiveProjectSelected: 'No active project selected',
            noActiveProject: 'No active project',
            chooseProjectBeforeSync: 'Choose a server project before syncing',
            synced: 'Synced',
            lastStaged: 'Last staged',
            ariaLabel: 'Workspace status',
            chooserTitle: 'Set workspace',
            chooserPrompt: 'Choose the workspace target',
            chooserPromptLoadScene: 'No workspace is configured. Choose a workspace target before opening a scene.',
            setServer: 'Set workspace to server',
            resetServer: 'Reset workspace to server',
            setLocal: 'Set workspace to local',
            resetLocal: 'Reset workspace to local',
        },
        projectSession: {
            userButtonLogin: 'Login',
            userButtonTooltipLoggedIn: 'Projects and logout',
            loginTitle: 'Login',
            usernameLabel: 'Username',
            usernamePlaceholder: 'Enter username',
            loginAction: 'Login',
            loginSuccessTitle: 'Login successful',
            savePrompt: 'Do you want to save the current scene changes into a new project?',
            currentUser: 'Current user: {user}',
            newProjectLabel: 'New project name',
            discardAction: 'Discard',
            saveAsNewAction: 'Save as New Project',
            browserTitle: 'My Projects',
            saveAsLabel: 'Save as project name',
            saveAction: 'Save',
            saveCurrentAsAction: 'Save Current As',
            logoutAction: 'Logout',
            adminTitle: 'Admin Panel',
            adminSummary: 'Manage users and all server projects',
            userListLabel: 'Users',
            sceneListLabel: 'Projects',
            loadingProjects: 'Loading projects...',
            noProjectsYet: 'No projects yet',
            currentBadge: 'Current',
            openAction: 'Open',
            loadingUsers: 'Loading users...',
            noUsersFound: 'No users found',
            projectCount: '{count} projects',
            deleteUserAria: 'Delete user',
            deleteProjectAria: 'Delete project',
            projectsOfUser: 'Projects of {user}',
            selectUser: 'Select a user',
            selectUserToViewProjects: 'Select a user to view projects',
            noAdminProjectsYet: 'No projects yet',
            loginRequired: 'Please login first',
            enterUsername: 'Please enter a username',
            loggedInAs: 'Logged in as {user}',
            keptWithoutCreating: 'Current scene kept without creating a project',
            projectSynced: 'Project synced: {name}',
            loadingProject: 'Loading project...',
            openedProject: 'Opened project "{name}"',
            openProjectFailedEmpty: 'Failed to open project: no persisted scene content was restored, so server overwrite was blocked',
            savingProject: 'Saving project...',
            duplicateProjectName: 'Project name already exists',
            exportingProject: 'Exporting project...',
            exportProject: 'Export Project',
            projectExported: 'Project exported to "{name}"',
            exportCancelled: 'Project export cancelled',
            exportFailed: 'Project export failed',
            folderFallback: 'folder',
        },
        theme: {
            switchToLight: 'Switch to light mode',
            switchToDark: 'Switch to dark mode',
            toggle: 'Toggle theme',
        },
        language: {
            buttonWhenZh: 'En',
            buttonWhenEn: '简',
            switchToEnglish: 'Switch to English',
            switchToChinese: '切换到中文',
            toggle: 'Toggle language',
        },
        canvas: {
            loading: 'Loading...',
            noWebgpuTitle: 'WebGPU Not Supported',
            noWebgpuIntro: 'This application requires WebGPU support.',
            noWebgpuBrowserHint: 'Please use one of the following browsers:',
            noWebgpuBrowserChrome: 'Chrome/Edge 113 or later',
            noWebgpuBrowserFirefox: 'Firefox Nightly',
            noWebgpuCheck: 'Check Browser Support',
        },
        agent: {
            workbench: 'Agent Workbench',
            workflowTabs: 'Agent Workflows',
            messageHistory: 'Conversation history',
            pendingImages: 'Pending images',
            inputPlaceholder: 'Type a natural-language request to trigger the placeholder agent for the current workflow',
            collapsedTooltip: 'Collapse agent workbench',
            expandedTooltip: 'Expand agent workbench',
            resizeAria: 'Resize agent workbench',
            promptProcessing: 'Processing',
            imageLoading: 'Generating image',
            resetView: 'Reset view',
            archivePreview: 'Expand details',
            collapseSession: 'Collapse',
            actions: {
                cancel: 'Cancel',
                retry: 'Retry',
                apply: 'Apply',
            },
            workflows: {
                'scene-build': {
                    title: 'Scene Build',
                    short: 'Scene',
                    starter: 'Start from one reference image or a scene prompt. I will break down the spatial structure, subject layout, and lighting mood first, then return an editable scene draft.',
                    suggestions: [
                        'Build the scene that matches this image',
                        'Complete this room while keeping the current camera direction',
                        'Expand this empty setup into a filmable cinematic space',
                        'Give me an indoor scene construction plan first',
                    ],
                    progressTitle: 'Building scene',
                    reply: 'Placeholder agent: the scene-build request is received.\nI would first extract the main subject, ground plane, and lighting from the reference, then assemble an editable scene draft for manual takeover.\nThis demo does not modify the scene on the right yet, but it is structured to connect to real scene assembly later.',
                    sceneSketch: 'Scene sketch',
                    sceneSketchAlt: 'Scene sketch preview',
                },
                'object-insert': {
                    title: 'Object Insert',
                    short: 'Object',
                    starter: 'Use this workflow to add key assets into the scene. You can provide a reference image, text, or later pick a point on the canvas. I will organize both asset generation and placement strategy.',
                    suggestions: [
                        'Add a sofa and a small tea table on the left side of the frame',
                        'Generate an industrial pendant light and place it at the center of the ceiling',
                        'Insert a parked motorcycle into the foreground',
                        'Use this reference image to add a metallic street lamp',
                    ],
                    progressTitle: 'Generating object',
                    reply: 'Placeholder agent: I would split object insertion into asset generation and placement strategy.\nOnce canvas point picking is connected, I will prefer pick depth and normals to infer placement.\nThis demo only echoes the plan and does not insert anything yet.',
                    objectPreview: 'Object preview',
                },
                'character-create': {
                    title: 'Character Create',
                    short: 'Character',
                    starter: 'Use this workflow for character creation. Start with a T-pose character, then continue to rigging and animation generation. I will clarify the character concept, motion source, and integration order first.',
                    suggestions: [
                        'Generate a T-pose heroine in a long trench coat',
                        'Draft a male character suitable for close-up acting shots',
                        'Prepare a rigging workflow for the current character',
                        'Generate a slow turning motion from this reference video',
                    ],
                    progressTitle: 'Creating character',
                    reply: 'Placeholder agent: in the character-creation workflow, I would break the request into character identity, skeleton structure, and motion source.\nThis step is best for producing a process card and asset checklist first, then connecting the character toolchain incrementally.',
                    characterConcept: 'Character concept',
                    characterConceptAlt: 'Character concept preview',
                    characterPreview: 'Character model preview',
                },
                'camera-direct': {
                    title: 'Camera Direct',
                    short: 'Camera',
                    starter: 'Use natural language here to generate shot design directly. I will parse the subject, rhythm, and mood first, then map them into camera paths, keyframes, and timing.',
                    suggestions: [
                        'Create an 8-second push-in shot for this scene',
                        'Generate a shot sequence that pushes from the doorway to a character close-up',
                        'Make a slow orbit around the main subject',
                        'Design an ending shot that settles by the window',
                    ],
                    progressTitle: 'Planning camera motion',
                    reply: 'Placeholder agent: camera-direct mode is active.\nI would first decompose the prompt into shot goal, camera motion, and duration allocation, then map that into a draft camera keyframe sequence.\nThis demo does not write into the timeline yet, but it will return suggestions in that structure.',
                },
            },
            blocks: {
                progress: 'Progress',
                image: 'Image',
                viewer3d: '3D preview',
                placeholder: 'Placeholder',
                ready: 'Ready',
                progressQueued: 'Waiting for agent start',
                progressParse: 'Parsing request',
                progressPlan: 'Organizing generation steps',
                progressCompose: 'Composing output',
                progressDone: 'Completed',
            },
        },
        sidebar: {
            title: 'Scene Manager',
            loadModel: 'Load model',
            loadScene: 'Load scene',
            saveScene: 'Save scene',
            clearScene: 'Clear scene',
            collapsePanel: 'Collapse scene panel',
            expandPanel: 'Expand scene panel',
            emptyTitle: 'No models yet',
            emptyHint: 'Drop files here, or click the plus button',
            transform: 'Transform',
            animation: 'Animation',
            position: 'Position',
            rotation: 'Rotation',
            scale: 'Scale',
            speed: 'Speed',
            pointCount: '{count} pts',
            toggleVisibility: 'Toggle visibility',
            deleteModel: 'Delete',
            resizeModelList: 'Resize model list',
        },
        sceneSettings: {
            title: 'Scene Settings',
            close: 'Close settings',
            resizePanel: 'Resize settings panel',
            background: 'Background',
            preset: 'Preset',
            mode: 'Mode',
            depthScale: 'Depth scale',
            aspect: 'Aspect',
            fov: 'FOV',
            renderModes: {
                color: 'Color',
                depth: 'Depth',
                normal: 'Normal',
            },
            skyPresets: {
                studio: 'Studio',
                black: 'Pure black',
                white: 'Pure white',
                clear_day: 'Clear day',
                sunset: 'Sunset',
                dusk: 'Dusk',
                night: 'Night',
            },
        },
        toolbar: {
            transformTools: 'Transform tools',
            clearTools: 'Clean-view tools',
            exportTools: 'Export tools',
            panelTools: 'Panel tools',
            translate: 'Translate',
            rotate: 'Rotate',
            scale: 'Scale',
            clearScreen: 'Clean view',
            export: 'Export',
            exportImage: 'Export image',
            exportVideo: 'Export video',
            sceneSettings: 'Scene settings',
            help: 'Help',
        },
        timeline: {
            title: 'Camera Keyframes',
            cameraPreview: 'Preview',
            cameraPreviewTitle: 'Camera Preview',
            cameraSettings: 'Control',
            cameraSettingsTitle: 'Camera Control',
            openCameraPreview: 'Open camera preview',
            closeCameraPreview: 'Close camera preview',
            openCameraSettings: 'Open camera settings',
            previewRatio: 'Aspect',
            track: 'Path',
            drag: 'Drag',
            dragHint: 'Drag camera keyframes in free camera mode',
            toggleSequenceVisibility: 'Toggle camera sequence visibility',
            size: 'Size',
            fov: 'FOV',
            interpolation: 'Interpolation',
            positionInterpolation: 'Position interpolation',
            rotationInterpolation: 'Rotation interpolation',
            timingInterpolation: 'Timing',
            parameter: 'Parameter',
            keyframes: 'Keyframes',
            cameraSequence: 'Camera sequence',
            addKeyframe: 'Add keyframe',
            removeKeyframe: 'Remove keyframe',
            pauseCamera: 'Pause camera animation',
            importSequence: 'Import camera sequence',
            exportSequence: 'Export camera sequence',
            clearSequence: 'Clear camera sequence',
            playbackControls: 'Playback controls',
            playCamera: 'Play camera animation',
            loopPlayback: 'Loop playback',
            speed: 'Speed',
            placeholder: 'Add a keyframe to start recording camera motion',
            interpolationModes: {
                linear: 'Linear',
                squad: 'Squad',
                catmull: 'Catmull',
                ease: 'Ease',
            },
            rotationModes: {
                slerp: 'Slerp',
            },
            interpolationParams: {
                catmull: 'Tension',
                ease: 'Strength',
            },
        },
        modal: {
            modelTitle: 'Select model files',
            modelHint: 'Choose model files to add (.ply, .onnx, .glb, .gltf, .obj, .fbx, .stl, .splat, .ksplat, .spz, .sog supported)',
            exportTitle: 'Export',
            exportVideoTitle: 'Render Video',
            exportImageTitle: 'Render Image',
            resolution: 'Resolution',
            aspectRatio: 'Camera aspect',
            playbackSpeed: 'Export speed',
            exportFps: 'Export FPS',
            renderMode: 'Render mode',
            exportRenderModes: {
                rgb: 'RGB',
                depth: 'Depth',
                normal: 'Normal',
            },
            exportProgressIdle: 'Ready to render',
            exportProgressValue: 'Rendering {percent}%',
            helpTitle: 'Help',
            closeHelp: 'Close help',
            gotIt: 'Got it',
            helpSections: {
                mouse: 'Mouse',
                keyboard: 'Keyboard shortcuts',
                camera: 'Camera movement',
            },
            helpItems: {
                mouseRotate: 'Rotate view',
                mousePan: 'Pan view',
                mouseZoom: 'Zoom view',
                mouseLookAt: 'Focus the scene point under the double-click',
                dropFiles: 'Import models into the scene',
                playPause: 'Play / pause camera animation',
                focusModel: 'Focus the selected model',
                addKeyframe: 'Add a camera keyframe at the current view and time; advance the timeline by 1 second if there is no later keyframe',
                toggleClean: 'Toggle clean-view mode',
                toggleGizmo: 'Switch translate / rotate / scale gizmo; press the same key again to disable it',
                uprightCamera: 'Upright the camera',
                openHelp: 'Open help',
                closeOverlay: 'Close help or the export dialog',
                movePlane: 'Move forward / backward / sideways',
                moveVertical: 'Move up / down',
                speedUp: 'Move faster',
            },
            exportCurrentFrame: 'Exports a single frame from the current view',
            exportTimeline: 'Timeline export: {duration}s, {fps} FPS, {frames} frames, {keyframes} keyframes',
        },
        messages: {
            agentOperationFailed: 'Agent operation failed: {message}',
            imagesAddedToComposer: 'Added {count} images to the input area',
            imageAddedToComposer: 'Image added to input',
            retryRequest: 'Retry request',
            imageInput: 'Image input',
            demoSceneAlreadyFilled: 'Demo scene is already filled',
            demoSceneRevealStarted: 'Demo scene reveal started',
            demoCameraPreviewMissing: 'No demo camera preview is waiting to be applied',
            demoCameraTimelineApplied: 'Demo camera timeline applied',
            demoCameraPreviewCanceled: 'Demo camera preview was canceled and restored',
            demoCameraCompletion: 'Please review the current camera preview and confirm whether to apply it.',
            agentExecutionFailed: 'Agent execution failed',
            agentPreviewPlaceholder: 'Agent preview placeholder',
            invalidDepthScale: 'Invalid depth scale',
            setDepthScaleFailed: 'Failed to set depth scale',
            depthScaleSet: 'Depth scale: {value}x',
            invalidFov: 'Invalid FOV',
            timelineFovSet: 'Timeline FOV: {value}°',
            fovSet: 'FOV: {value}°',
            setFovFailed: 'Failed to set FOV',
            invalidBackgroundColor: 'Invalid background color. Use #RRGGBB',
            setBackgroundFailed: 'Failed to set background color',
            skyPresetMissing: 'Sky preset does not exist: {id}',
            skyPresetSet: 'Sky preset: {name}',
            cameraKeyframeMoveRotateOnly: 'Camera keyframes only support translate and rotate',
            viewportGizmoSet: 'Viewport gizmo: {mode}',
            viewportGizmoOff: 'Viewport gizmo: off',
            switchToFreeCamera: 'Switch to free camera first',
            cameraKeyframeDragState: 'Camera keyframe drag: {state}',
            cameraPreviewState: 'Camera preview: {state}',
            cameraPreviewAspectSet: 'Camera preview aspect: {label}',
            setCameraSequenceVisibilityFailed: 'Failed to set camera sequence visibility',
            setCameraDisplaySizeFailed: 'Failed to set camera display size',
            modelVisibility: 'Model visibility: {state}',
            modelSelectionCleared: 'Model selection cleared',
            selectedModel: 'Selected model: {name}',
            modelUpdated: 'Model updated',
            transformReset: 'Transform reset',
            noModelSelected: 'No model selected',
            switchRenderModeFailed: 'Failed to switch render mode: {mode}',
            displayModeSet: 'Display mode: {mode}',
            exportDialogNotInitialized: 'Export dialog is not initialized',
            editorNotInitializedExport: 'Editor is not initialized, cannot export',
            invalidResolution: 'Invalid resolution',
            invalidRenderMode: 'Invalid render mode: {mode}',
            invalidPlaybackSpeed: 'Invalid playback speed',
            imageExportDataUnavailable: 'Unable to export image data',
            renderContextUnavailableImage: 'Render context is unavailable, cannot export image',
            recordingCameraInitFailed: 'Failed to initialize recording camera',
            addKeyframeBeforeVideoExport: 'Add at least 1 camera keyframe on the timeline first',
            renderContextUnavailableVideo: 'Render context is unavailable, cannot export video',
            imageExported: 'Image exported: {width}x{height}, {mode}',
            videoExported: 'Video exported: {width}x{height}, {mode}',
            exportFailed: 'Export failed: {message}',
            invalidAssetPath: 'Invalid asset path: {path}',
            sceneSavedToWorkspace: 'Scene saved to workspace "{name}": {count} assets{skipped}',
            sceneSavedSkippedAssets: ', skipped {count} sourceless models',
            editorNotInitializedExportProject: 'Editor is not initialized, cannot export project',
            editorNotInitializedLoadScene: 'Editor is not initialized, cannot load scene',
            emptySceneAssets: 'scene.json has no loadable assets/scenes model entries',
            loadSceneClearConfirm: 'Loading a scene will clear the current models first. Continue?',
            openProjectReplaceConfirm: 'Opening a project will replace the current scene. Continue?',
            urlAssetLoadFailed: 'URL asset load failed: {status}',
            fallbackUrlAssetLoadFailed: 'Fallback URL asset load failed: {status}',
            missingAssetPath: 'Asset is missing a readable path: {name}',
            loadModelFailed: 'Failed to load model: {name}',
            sceneLoaded: 'Scene loaded ({name}): {loaded} succeeded, {failed} failed',
            demoSceneLoaded: 'Scene loaded ({name} Demo): {loaded} succeeded, {failed} failed',
            loadSceneFailed: 'Failed to load scene: {message}',
            editorNotInitialized: 'Editor is not initialized',
            projectSavedAsCurrent: 'Saved current content as project "{name}"',
            confirmDeleteProject: 'Delete project "{projectId}" for user "{user}"?',
            deletingProject: 'Deleting project...',
            projectDeleted: 'Project deleted',
            confirmDeleteUser: 'Delete user "{user}" and all projects?',
            deletingUser: 'Deleting user...',
            userDeleted: 'User deleted',
            clearSceneConfirm: 'Clear all models?',
            sceneCleared: 'Scene cleared',
            cameraInterpolationSet: 'Camera interpolation: {mode}',
            cameraInterpolationAxisSet: '{axis}: {mode}',
            parameterSet: '{label}: {value}',
            invalidFps: 'Invalid FPS',
            keyframeAdjusted: 'Keyframe adjusted: {time}s',
            modelAnimationClipUpdated: 'Model animation clip updated',
            modelTrackLoopEnds: 'Loop ends {time}s',
            modelAnimationOverflow: 'Model animation duration exceeds the current clip length',
            cameraPoseReadFailed: 'Unable to read current camera pose',
            keyframeOverwritten: 'Keyframe overwritten: {time}s',
            keyframeAdded: 'Keyframe added: {time}s',
            fovKeyframeDeleted: 'FOV keyframe deleted: {time}s',
            noKeyframeAtCurrentTime: 'No keyframe at current timestamp: {time}s',
            keyframeDeleted: 'Keyframe deleted: {time}s',
            cameraSequenceExported: 'Camera sequence exported: {poseCount} pose keyframes, {fovCount} FOV keyframes',
            clearCameraSequenceConfirm: 'Clear the current camera sequence?',
            cameraSequenceCleared: 'Camera sequence cleared',
            missingKeyframesArray: 'Missing keyframes array',
            cameraSequenceImported: 'Camera sequence imported: {poseCount} pose keyframes, {fovCount} FOV keyframes',
            cameraSequenceImportFailed: 'Failed to import camera sequence: {message}',
            cameraAnimationPaused: 'Camera animation: paused',
            cameraAnimationPlaying: 'Camera animation: playing',
            cameraAnimationLoopState: 'Camera animation loop: {state}',
            cameraPresetSet: 'Camera preset: {preset}',
            focusModel: 'Focus model: {name}',
            cameraUpright: 'Camera upright',
            cameraModeSet: 'Camera mode: {mode}',
            playbackSpeedSet: 'Global playback speed: {speed}x',
            timelineAutoFit: 'Timeline auto-fitted to {duration}s',
            canvasNotFound: 'Canvas element not found',
            editorAppModuleLoadFailed: 'Failed to load EditorApp module: {message}',
            editorInitFailed: 'Failed to initialize editor',
        },
    },
};

function getUiTextValue(language, key) {
    if (!key) return undefined;
    return key.split('.').reduce((value, segment) => {
        if (value == null) return undefined;
        return value[segment];
    }, UI_TEXT[language]);
}

function formatUiText(template, params = {}) {
    if (typeof template !== 'string') return template;
    return template.replace(/\{(\w+)\}/g, (_, key) => {
        const value = params[key];
        return value == null ? '' : String(value);
    });
}

function t(key, params = {}) {
    const preferred = state.uiLanguage === 'en' ? 'en' : 'zh';
    const fallback = preferred === 'en' ? 'zh' : 'en';
    let entry = getUiTextValue(preferred, key);
    if (entry === undefined) {
        entry = getUiTextValue(fallback, key);
    }
    if (typeof entry === 'function') {
        return entry(params);
    }
    if (Array.isArray(entry)) {
        return entry.map((item) => formatUiText(item, params));
    }
    return formatUiText(entry, params);
}

function normalizeUiLanguage(value) {
    return value === 'en' ? 'en' : 'zh';
}

function getCurrentTheme() {
    return document.body.classList.contains('theme-light') ? 'light' : 'dark';
}

function setElementText(element, text) {
    if (element) {
        element.textContent = text;
    }
}

function clearProjectNameConflictState(input, errorElement) {
    input?.classList.remove('has-error');
    if (errorElement) {
        errorElement.textContent = '';
        errorElement.classList.add('hidden');
    }
}

function setProjectNameConflictState(input, errorElement) {
    if (input) {
        input.classList.add('has-error');
        input.focus();
        input.select?.();
    }
    if (errorElement) {
        errorElement.textContent = t('projectSession.duplicateProjectName');
        errorElement.classList.remove('hidden');
    }
}

function isDuplicateProjectNameError(error) {
    const code = String(error?.code || '').trim().toUpperCase();
    const message = String(error?.message || '').trim().toLowerCase();
    return code === 'CONFLICT' || message.includes('project name already exists');
}

function logCameraControlDebug(kind = 'unknown') {
    const info = app?.getCameraControlDebugInfo?.();
    if (!info) return null;
    const now = performance.now();
    if (kind === 'drag' && now - cameraControlDebugLastDragLogAt < 120) {
        return info;
    }
    if (kind === 'drag') {
        cameraControlDebugLastDragLogAt = now;
    }
    const sample = {
        time: new Date().toISOString(),
        kind,
        info,
    };
    cameraControlDebugSamples.push(sample);
    if (cameraControlDebugSamples.length > 40) {
        cameraControlDebugSamples = cameraControlDebugSamples.slice(-40);
    }
    console.log(`[CameraControlDebug:${kind}]`, sample);
    return sample;
}

function setButtonTooltip(button, tooltip, ariaLabel = tooltip) {
    if (!button) return;
    button.title = tooltip;
    button.setAttribute('data-tooltip', tooltip);
    button.setAttribute('aria-label', ariaLabel);
}

function applyDeclarativeI18n(root = document) {
    root.querySelectorAll('[data-i18n]').forEach((element) => {
        const key = element.getAttribute('data-i18n');
        if (!key) return;
        element.textContent = t(key);
    });
    root.querySelectorAll('[data-i18n-placeholder]').forEach((element) => {
        const key = element.getAttribute('data-i18n-placeholder');
        if (!key) return;
        element.setAttribute('placeholder', t(key));
    });
    root.querySelectorAll('[data-i18n-attrs]').forEach((element) => {
        const raw = element.getAttribute('data-i18n-attrs');
        if (!raw) return;
        raw.split(';').forEach((entry) => {
            const trimmed = entry.trim();
            if (!trimmed) return;
            const separatorIndex = trimmed.indexOf(':');
            if (separatorIndex <= 0) return;
            const attrName = trimmed.slice(0, separatorIndex).trim();
            const key = trimmed.slice(separatorIndex + 1).trim();
            if (!attrName || !key) return;
            const value = t(key);
            element.setAttribute(attrName, value);
            if (attrName === 'title') {
                element.setAttribute('data-tooltip', value);
            }
        });
    });
}

function formatWorkspaceSavedAt(savedAt) {
    if (!Number.isFinite(savedAt) || savedAt <= 0) {
        return state.uiLanguage === 'en' ? 'None' : '无';
    }
    try {
        return new Intl.DateTimeFormat(undefined, {
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit',
            hour12: false,
        }).format(new Date(savedAt));
    } catch (error) {
        return new Date(savedAt).toLocaleString();
    }
}

function getWorkspaceCombinedLastSavedAt() {
    const sceneSavedAt = Number(state.workspace?.lastSavedAt) || 0;
    const agentSavedAt = Number(state.workspace?.agentLastSavedAt) || 0;
    const latest = Math.max(sceneSavedAt, agentSavedAt);
    return latest > 0 ? latest : null;
}

function isServerProjectSessionActive() {
    return Boolean(
        state.projectSession?.authenticated
        && state.projectSession?.activeProjectId
        && state.workspace?.mode === 'server'
    );
}

function isLocalWorkspaceSyncMode() {
    return !isServerProjectSessionActive();
}

function resolveWorkspaceIndicatorStatus() {
    const workspace = state.workspace || createWorkspaceState();
    const online = typeof navigator === 'undefined' ? true : navigator.onLine !== false;
    const combinedError = workspace.error || workspace.agentError || null;
    const combinedSaving = Boolean(workspace.saving || workspace.agentSaving);
    const combinedDirty = Boolean(workspace.dirty || workspace.agentDirty);
    const isEnglish = state.uiLanguage === 'en';

    if (isLocalWorkspaceSyncMode()) {
        if (combinedError) {
            return {
                code: 'error',
                label: t('workspaceStatus.syncFailed'),
                detail: String(combinedError),
            };
        }
        if (combinedSaving) {
            return {
                code: 'saving',
                label: t('workspaceStatus.syncing'),
                detail: workspace.name
                    ? t('workspaceStatus.localFolder', { name: workspace.name })
                    : t('workspaceStatus.loginToSync'),
            };
        }
        return {
            code: combinedDirty ? 'dirty' : (workspace.name ? 'clean' : 'no-workspace'),
            label: combinedDirty
                ? t('workspaceStatus.localChanges')
                : (workspace.name ? t('workspaceStatus.localOnly') : t('workspaceStatus.noLocalWorkspace')),
            detail: workspace.name
                ? t('workspaceStatus.localFolder', { name: workspace.name })
                : t('workspaceStatus.loginToSync'),
        };
    }

    if (!online) {
        return {
            code: 'offline',
            label: isEnglish ? 'Offline' : '离线',
            detail: t('workspaceStatus.cannotSync'),
        };
    }
    if (combinedError) {
        return {
            code: 'error',
            label: t('workspaceStatus.syncFailed'),
            detail: String(combinedError),
        };
    }
    if (combinedSaving) {
        return {
            code: 'saving',
            label: t('workspaceStatus.syncing'),
            detail: workspace.name
                ? t('workspaceStatus.projectLabel', { name: workspace.name })
                : t('workspaceStatus.projectSyncInProgress'),
        };
    }
    if (combinedDirty) {
        return {
            code: 'dirty',
            label: t('workspaceStatus.unsyncedChanges'),
            detail: workspace.name
                ? t('workspaceStatus.projectLabel', { name: workspace.name })
                : t('workspaceStatus.noActiveProjectSelected'),
        };
    }
    if (!workspace.name) {
        return {
            code: 'no-workspace',
            label: t('workspaceStatus.noActiveProject'),
            detail: t('workspaceStatus.chooseProjectBeforeSync'),
        };
    }
    return {
        code: 'clean',
        label: t('workspaceStatus.synced'),
        detail: t('workspaceStatus.projectLabel', { name: workspace.name }),
    };
}

function updateWorkspaceStatusIndicator() {
    if (!dom.workspaceStatusIndicator) return;
    const status = resolveWorkspaceIndicatorStatus();
    const savedAtLabel = formatWorkspaceSavedAt(getWorkspaceCombinedLastSavedAt());
    const lastSavedLabel = state.uiLanguage === 'en' ? 'Last staged' : '上次暂存';
    const ariaLabel = state.uiLanguage === 'en' ? 'Workspace status' : '工作区状态';
    const tooltip = `${status.label}\n${status.detail}\n${lastSavedLabel}: ${savedAtLabel}`;
    dom.workspaceStatusIndicator.dataset.status = status.code;
    setButtonTooltip(dom.workspaceStatusIndicator, tooltip, ariaLabel);
}

function getProjectSessionDefaultProjectName() {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    const hours = String(now.getHours()).padStart(2, '0');
    const minutes = String(now.getMinutes()).padStart(2, '0');
    return `Untitled Project ${year}-${month}-${day} ${hours}-${minutes}`;
}

function getProjectSessionAvatarToken(user) {
    const trimmed = String(user || '').trim();
    if (!trimmed) return '';
    return Array.from(trimmed)[0] || '';
}

function getProjectSessionAvatarGradient(token) {
    const normalized = String(token || '').trim();
    if (!normalized) {
        return {
            start: '#66758d',
            end: '#465267',
        };
    }
    const codePoint = Array.from(normalized)[0]?.codePointAt(0) || 0;
    const startHue = codePoint % 360;
    const endHue = (startHue + 42) % 360;
    return {
        start: `hsl(${startHue} 72% 58%)`,
        end: `hsl(${endHue} 74% 44%)`,
    };
}

function syncProjectSessionButton() {
    if (!dom.btnUserSession) return;
    const authenticated = Boolean(state.projectSession?.authenticated);
    const user = state.projectSession?.user || '';
    const avatarToken = authenticated ? getProjectSessionAvatarToken(user) : '';
    const avatarLabel = avatarToken ? avatarToken.toLocaleUpperCase() : '';
    const gradient = getProjectSessionAvatarGradient(avatarToken);
    dom.btnUserSession.dataset.authenticated = String(authenticated);
    dom.btnUserSession.style.setProperty('--agent-user-avatar-start', gradient.start);
    dom.btnUserSession.style.setProperty('--agent-user-avatar-end', gradient.end);
    setElementText(dom.btnUserSession.querySelector('.agent-user-avatar-text'), avatarLabel);
    setButtonTooltip(
        dom.btnUserSession,
        authenticated
            ? t('projectSession.userButtonTooltipLoggedIn')
            : t('projectSession.userButtonLogin'),
        authenticated
            ? t('projectSession.currentUser', { user })
            : t('projectSession.userButtonLogin'),
    );
}

function isAdminUser(user) {
    return String(user || '').trim().toLowerCase() === 'admin';
}

function openLoginModal() {
    dom.loginModal?.classList.remove('hidden');
    if (dom.projectSessionUsernameInput) {
        dom.projectSessionUsernameInput.value = state.projectSession?.user || '';
        dom.projectSessionUsernameInput.focus();
        dom.projectSessionUsernameInput.select?.();
    }
}

function closeLoginModal() {
    dom.loginModal?.classList.add('hidden');
}

function openPostLoginProjectModal() {
    if (dom.projectSessionTitle) {
        dom.projectSessionTitle.textContent = t('projectSession.loginSuccessTitle');
    }
    if (dom.projectSessionPrompt) {
        dom.projectSessionPrompt.textContent = t('projectSession.savePrompt');
    }
    if (dom.projectSessionUserSummary) {
        dom.projectSessionUserSummary.textContent = state.projectSession?.user
            ? t('projectSession.currentUser', { user: state.projectSession.user })
            : '';
    }
    if (dom.projectSessionNewProjectName) {
        dom.projectSessionNewProjectName.value = getProjectSessionDefaultProjectName();
    }
    dom.postLoginProjectModal?.classList.remove('hidden');
    void refreshProjectSessionProjects();
}

function closePostLoginProjectModal() {
    clearProjectNameConflictState(dom.projectSessionNewProjectName, dom.projectSessionNewProjectNameError);
    dom.postLoginProjectModal?.classList.add('hidden');
}

function openProjectBrowserModal() {
    if (dom.projectBrowserTitle) {
        dom.projectBrowserTitle.textContent = t('projectSession.browserTitle');
    }
    if (dom.projectBrowserUserSummary) {
        dom.projectBrowserUserSummary.textContent = state.projectSession?.user
            ? t('projectSession.currentUser', { user: state.projectSession.user })
            : '';
    }
    if (dom.projectBrowserSaveAsName) {
        dom.projectBrowserSaveAsName.value = state.projectSession.activeProjectName || getProjectSessionDefaultProjectName();
    }
    closeProjectBrowserSaveAsPanel();
    dom.projectBrowserModal?.classList.remove('hidden');
    void refreshProjectSessionProjects();
}

function closeProjectBrowserModal() {
    clearProjectNameConflictState(dom.projectBrowserSaveAsName, dom.projectBrowserSaveAsNameError);
    closeProjectBrowserSaveAsPanel();
    dom.projectBrowserModal?.classList.add('hidden');
}

function hasConfiguredWorkspaceTarget() {
    return Boolean(
        (state.workspace?.mode === 'server' && state.projectSession?.authenticated)
        || state.workspace?.writable
        || sceneFs.isWorkspaceWritable?.()
    );
}

function syncWorkspaceTargetModalLabels(mode = 'status') {
    if (dom.workspaceTargetTitle) {
        dom.workspaceTargetTitle.textContent = t('workspaceStatus.chooserTitle');
    }
    if (dom.workspaceTargetPrompt) {
        dom.workspaceTargetPrompt.textContent = mode === 'load-scene'
            ? t('workspaceStatus.chooserPromptLoadScene')
            : t('workspaceStatus.chooserPrompt');
    }
    const hasWorkspace = hasConfiguredWorkspaceTarget();
    setButtonTooltip(dom.btnWorkspaceTargetClose, t('common.close'), t('common.close'));
    setElementText(
        dom.btnWorkspaceTargetServer,
        hasWorkspace ? t('workspaceStatus.resetServer') : t('workspaceStatus.setServer'),
    );
    setElementText(
        dom.btnWorkspaceTargetLocal,
        hasWorkspace ? t('workspaceStatus.resetLocal') : t('workspaceStatus.setLocal'),
    );
    setElementText(dom.btnWorkspaceTargetCancel, t('common.cancel'));
}

function openWorkspaceTargetModal(mode = 'status') {
    syncWorkspaceTargetModalLabels(mode);
    if (dom.workspaceTargetModal) {
        dom.workspaceTargetModal.dataset.reason = mode;
    }
    dom.workspaceTargetModal?.classList.remove('hidden');
}

function closeWorkspaceTargetModal() {
    if (dom.workspaceTargetModal) {
        delete dom.workspaceTargetModal.dataset.reason;
    }
    dom.workspaceTargetModal?.classList.add('hidden');
}

function setPendingWorkspaceTargetAction(action = null) {
    state.pendingWorkspaceTargetAction = action;
}

function markWorkspaceTargetMigrationRequired(target) {
    if (target === 'local') {
        state.forceFullWorkspaceAssetMigration = true;
        return;
    }
    if (target === 'server') {
        state.forceFullServerAssetMigration = true;
    }
}

function clearActiveServerProjectSelection() {
    state.projectSession.activeProjectId = '';
    state.projectSession.activeProjectName = '';
    clearActiveServerProjectAssetCaches();
}

async function selectLocalWorkspace(options = {}) {
    const { silentCancel = true } = options;
    try {
        await sceneFs.openWorkspaceReadWrite();
        const workspaceInfo = sceneFs.getWorkspaceInfo();
        clearActiveServerProjectSelection();
        syncWorkspaceStateFromSceneFS({
            mode: 'local',
            name: workspaceInfo.name,
            writable: workspaceInfo.writable,
            dirty: false,
            saving: false,
            error: null,
            syncStatus: 'clean',
        });
        syncProjectSessionButton();
        updateWorkspaceStatusIndicator();
        return sceneFs.getWorkspaceHandle();
    } catch (error) {
        if (silentCancel && isWorkspaceSelectionCancelledError(error)) {
            return null;
        }
        throw error;
    }
}

async function pickLocalSceneFolder(options = {}) {
    const { silentCancel = true } = options;
    try {
        const handle = await window.showDirectoryPicker({
            mode: 'readwrite',
        });
        return handle;
    } catch (error) {
        if (silentCancel && isWorkspaceSelectionCancelledError(error)) {
            return null;
        }
        throw error;
    }
}

async function handleWorkspaceTargetServerSelection(options = {}) {
    const { reason = 'status' } = options;
    closeWorkspaceTargetModal();
    if (reason === 'load-scene-after-load') {
        setPendingWorkspaceTargetAction({
            type: 'create-server-project-from-loaded-scene',
        });
    } else {
        setPendingWorkspaceTargetAction(null);
    }
    if (state.projectSession.authenticated) {
        if (state.projectSession.isAdmin) {
            openAdminProjectModal();
            return true;
        }
        if (reason === 'load-scene-after-load') {
            openPostLoginProjectModal();
        } else {
            openProjectBrowserModal();
        }
        return true;
    }
    openLoginModal();
    return true;
}

async function handleWorkspaceTargetLocalSelection(options = {}) {
    const { reason = 'status' } = options;
    closeWorkspaceTargetModal();
    const handle = await selectLocalWorkspace({ silentCancel: true });
    if (!handle) {
        return null;
    }
    markWorkspaceTargetMigrationRequired('local');
    showInfo(t('workspaceStatus.localFolderSet', { name: handle.name || 'workspace' }));
    return handle;
}

function openAdminProjectModal() {
    if (dom.adminProjectTitle) {
        dom.adminProjectTitle.textContent = t('projectSession.adminTitle');
    }
    if (dom.adminProjectSummary) {
        dom.adminProjectSummary.textContent = t('projectSession.adminSummary');
    }
    dom.adminProjectModal?.classList.remove('hidden');
    void refreshAdminUsers();
}

function closeAdminProjectModal() {
    dom.adminProjectModal?.classList.add('hidden');
}

function openProjectBrowserSaveAsPanel() {
    clearProjectNameConflictState(dom.projectBrowserSaveAsName, dom.projectBrowserSaveAsNameError);
    dom.projectBrowserSaveAsPanel?.classList.remove('hidden');
    if (dom.projectBrowserSaveAsName) {
        dom.projectBrowserSaveAsName.value = state.projectSession.activeProjectName || getProjectSessionDefaultProjectName();
        dom.projectBrowserSaveAsName.focus();
        dom.projectBrowserSaveAsName.select?.();
    }
}

function closeProjectBrowserSaveAsPanel() {
    clearProjectNameConflictState(dom.projectBrowserSaveAsName, dom.projectBrowserSaveAsNameError);
    dom.projectBrowserSaveAsPanel?.classList.add('hidden');
}

function renderProjectBrowserProjectGrid() {
    if (!dom.projectBrowserProjectGrid) return;
    const projects = Array.isArray(state.projectSession?.projects) ? state.projectSession.projects : [];
    if (state.projectSession?.loadingProjects) {
        dom.projectBrowserProjectGrid.innerHTML = `<div class="project-session-empty">${t('projectSession.loadingProjects')}</div>`;
        return;
    }
    if (projects.length === 0) {
        dom.projectBrowserProjectGrid.innerHTML = `<div class="project-session-empty">${t('projectSession.noProjectsYet')}</div>`;
        return;
    }
    dom.projectBrowserProjectGrid.innerHTML = projects.map((project) => {
        const isActive = (project.id || '') === (state.projectSession.activeProjectId || '');
        return `
        <div class="project-browser-project-card${isActive ? ' is-active' : ''}">
            <div class="project-browser-project-card-header">
                ${isActive ? `<span class="project-browser-project-card-badge">${escapeHtml(t('projectSession.currentBadge'))}</span>` : ''}
                <span class="project-browser-project-card-title">${escapeHtml(project.name || project.id || '')}</span>
                <span class="project-browser-project-card-subtitle">${escapeHtml(project.updatedAt || '')}</span>
            </div>
            <div class="project-browser-project-card-actions">
                <button type="button" class="button button-secondary" data-project-open="${escapeHtml(project.id || '')}">
                    ${escapeHtml(t('projectSession.openAction'))}
                </button>
            </div>
        </div>
    `;
    }).join('');
}

function renderAdminUserList() {
    if (!dom.adminUserList) return;
    const users = Array.isArray(state.projectSession.adminUsers) ? state.projectSession.adminUsers : [];
    if (state.projectSession.loadingAdminUsers) {
        dom.adminUserList.innerHTML = `<div class="project-session-empty">${t('projectSession.loadingUsers')}</div>`;
        return;
    }
    if (users.length === 0) {
        dom.adminUserList.innerHTML = `<div class="project-session-empty">${t('projectSession.noUsersFound')}</div>`;
        return;
    }
    dom.adminUserList.innerHTML = users.map((user) => {
        const isActive = user.user === state.projectSession.adminSelectedUser;
        return `
        <div class="admin-user-card${isActive ? ' is-active' : ''}" data-admin-user-select="${escapeHtml(user.user || '')}">
            <div class="admin-user-card-meta">
                <div class="admin-user-card-title">${escapeHtml(user.user || '')}</div>
                <div class="admin-user-card-subtitle">${escapeHtml(t('projectSession.projectCount', { count: user.projectCount || 0 }))}</div>
            </div>
            <button type="button" class="admin-delete-btn" data-admin-user-delete="${escapeHtml(user.user || '')}" aria-label="${escapeHtml(t('projectSession.deleteUserAria'))}">×</button>
        </div>
    `;
    }).join('');
}

function renderAdminProjectGrid() {
    if (!dom.adminProjectGrid) return;
    if (dom.adminSceneOwnerLabel) {
        dom.adminSceneOwnerLabel.textContent = state.projectSession.adminSelectedUser
            ? t('projectSession.projectsOfUser', { user: state.projectSession.adminSelectedUser })
            : t('projectSession.selectUser');
    }
    if (!state.projectSession.adminSelectedUser) {
        dom.adminProjectGrid.innerHTML = `<div class="project-session-empty">${t('projectSession.selectUserToViewProjects')}</div>`;
        return;
    }
    if (state.projectSession.loadingProjects) {
        dom.adminProjectGrid.innerHTML = `<div class="project-session-empty">${t('projectSession.loadingProjects')}</div>`;
        return;
    }
    const projects = Array.isArray(state.projectSession.projects) ? state.projectSession.projects : [];
    if (projects.length === 0) {
        dom.adminProjectGrid.innerHTML = `<div class="project-session-empty">${t('projectSession.noAdminProjectsYet')}</div>`;
        return;
    }
    dom.adminProjectGrid.innerHTML = projects.map((project) => `
        <div class="project-browser-project-card">
            <button type="button" class="admin-delete-btn admin-project-card-delete" data-admin-project-delete="${escapeHtml(project.id || '')}" aria-label="${escapeHtml(t('projectSession.deleteProjectAria'))}">×</button>
            <div class="project-browser-project-card-header">
                <span class="project-browser-project-card-title">${escapeHtml(project.name || project.id || '')}</span>
                <span class="project-browser-project-card-subtitle">${escapeHtml(project.updatedAt || '')}</span>
            </div>
        </div>
    `).join('');
}

async function refreshAdminUsers() {
    state.projectSession.loadingAdminUsers = true;
    renderAdminUserList();
    try {
        state.projectSession.adminUsers = await projectApi.listUsers();
        state.projectSession.lastError = null;
        if (!state.projectSession.adminSelectedUser || !state.projectSession.adminUsers.some((item) => item.user === state.projectSession.adminSelectedUser)) {
            state.projectSession.adminSelectedUser = state.projectSession.adminUsers[0]?.user || '';
        }
        renderAdminUserList();
        await refreshAdminSelectedUserProjects();
    } catch (error) {
        state.projectSession.lastError = error?.message || String(error);
        showError(state.projectSession.lastError);
    } finally {
        state.projectSession.loadingAdminUsers = false;
        renderAdminUserList();
    }
}

async function refreshAdminSelectedUserProjects() {
    if (!state.projectSession.adminSelectedUser) {
        state.projectSession.projects = [];
        state.projectSession.loadingProjects = false;
        renderAdminProjectGrid();
        return;
    }
    state.projectSession.loadingProjects = true;
    renderAdminProjectGrid();
    try {
        state.projectSession.projects = await projectApi.listProjects(state.projectSession.adminSelectedUser);
        state.projectSession.lastError = null;
    } catch (error) {
        state.projectSession.lastError = error?.message || String(error);
        showError(state.projectSession.lastError);
    } finally {
        state.projectSession.loadingProjects = false;
        renderAdminProjectGrid();
    }
}

async function refreshProjectSessionProjects() {
    if (state.projectSession?.isAdmin) {
        renderAdminProjectGrid();
        return;
    }
    if (!state.projectSession?.authenticated || !state.projectSession.user) {
        state.projectSession.projects = [];
        state.projectSession.loadingProjects = false;
        renderProjectBrowserProjectGrid();
        return;
    }
    state.projectSession.loadingProjects = true;
    renderProjectBrowserProjectGrid();
    try {
        state.projectSession.projects = await projectApi.listProjects(state.projectSession.user);
        state.projectSession.lastError = null;
    } catch (error) {
        state.projectSession.lastError = error?.message || String(error);
        showError(state.projectSession.lastError);
    } finally {
        state.projectSession.loadingProjects = false;
        renderProjectBrowserProjectGrid();
    }
}

async function openProjectSessionPopover() {
    if (state.projectSession.authenticated) {
        if (state.projectSession.isAdmin) {
            openAdminProjectModal();
            return;
        }
        openProjectBrowserModal();
        return;
    }
    openLoginModal();
}

function setProjectSessionUser(user) {
    const normalized = String(user || '').trim();
    state.projectSession.user = normalized;
    state.projectSession.authenticated = Boolean(normalized);
    state.projectSession.isAdmin = isAdminUser(normalized);
    if (normalized) {
        localStorage.setItem(PROJECT_SESSION_USER_STORAGE_KEY, normalized);
    } else {
        localStorage.removeItem(PROJECT_SESSION_USER_STORAGE_KEY);
    }
    syncProjectSessionButton();
    updateWorkspaceStatusIndicator();
}

function getSkyPresetDisplayName(presetOrId) {
    const presetId = typeof presetOrId === 'string' ? presetOrId : presetOrId?.id;
    const fallbackName = typeof presetOrId === 'object' ? presetOrId?.name : '';
    if (!presetId) return fallbackName || '';
    return t(`sceneSettings.skyPresets.${presetId}`) || fallbackName || presetId;
}

function getAgentWorkflowShortLabel(workflowId) {
    return AGENT_WORKFLOW_DEFS[workflowId]?.shortLabel || AGENT_WORKFLOW_DEFS[workflowId]?.label || workflowId;
}

function getAgentBlockStatusLabel(status) {
    if (status === 'ready') return t('agent.blocks.ready');
    if (status === 'placeholder') return t('agent.blocks.placeholder');
    if (status === 'error') return t('common.failed');
    return status || '';
}

function updateLanguageToggleLabel() {
    if (!dom.btnLanguageToggle) return;
    const nextLanguage = state.uiLanguage === 'en' ? 'zh' : 'en';
    const tooltip = nextLanguage === 'en'
        ? t('language.switchToEnglish')
        : t('language.switchToChinese');
    dom.btnLanguageToggle.textContent = state.uiLanguage === 'en'
        ? t('language.buttonWhenEn')
        : t('language.buttonWhenZh');
    dom.btnLanguageToggle.title = tooltip;
    dom.btnLanguageToggle.setAttribute('data-tooltip', tooltip);
    dom.btnLanguageToggle.setAttribute('aria-label', t('language.toggle'));
}

function updateLocalizedStaticUi() {
    document.documentElement.lang = state.uiLanguage === 'en' ? 'en' : 'zh-CN';
    applyDeclarativeI18n();

    if (dom.loadingOverlay && dom.loadingOverlay.classList.contains('hidden')) {
        setElementText(dom.loadingOverlay.querySelector('.loading-text'), t('canvas.loading'));
    }
    if (dom.agentComposerInput) {
        dom.agentComposerInput.placeholder = t('agent.inputPlaceholder');
    }
    document.querySelectorAll('.agent-workflow-tab').forEach((button) => {
        const workflowId = button.dataset.workflow;
        if (!workflowId) return;
        const label = AGENT_WORKFLOW_DEFS[workflowId]?.label || workflowId;
        const shortLabel = getAgentWorkflowShortLabel(workflowId);
        button.title = label;
        button.setAttribute('aria-label', label);
        setElementText(button.querySelector('.agent-workflow-label'), shortLabel);
    });
    syncProjectSessionButton();
    syncProjectSessionModalLabels();

    setButtonTooltip(dom.btnAddModel, t('sidebar.loadModel'));
    setButtonTooltip(dom.btnLoadScene, t('sidebar.loadScene'));
    setButtonTooltip(dom.btnSaveScene, t('projectSession.exportProject'));
    setButtonTooltip(dom.btnClearScene, t('sidebar.clearScene'));
    setButtonTooltip(dom.btnResetTransform, t('common.reset'));
    const transformLabels = dom.modelTransformSection?.querySelectorAll('.transform-property-row .property-label span') || [];
    setElementText(transformLabels[0], t('sidebar.position'));
    setElementText(transformLabels[1], t('sidebar.rotation'));
    setElementText(transformLabels[2], t('sidebar.scale'));
    dom.modelAnimSpeedValue?.setAttribute('aria-label', t('sidebar.speed'));

    setButtonTooltip(dom.btnSceneSettingsClose, t('sceneSettings.close'), t('sceneSettings.close'));
    const sceneSettingLabels = dom.sceneSettingsPanel?.querySelectorAll('.property-row .property-label span') || [];
    setElementText(sceneSettingLabels[0], t('sceneSettings.background'));
    setElementText(sceneSettingLabels[1], t('sceneSettings.preset'));
    setElementText(sceneSettingLabels[2], t('sceneSettings.mode'));
    setElementText(sceneSettingLabels[3], t('sceneSettings.depthScale'));
    setElementText(sceneSettingLabels[4], t('sceneSettings.fov'));
    setElementText(dom.modeColor?.querySelector('.menu-btn-text'), t('sceneSettings.renderModes.color'));
    setElementText(dom.modeDepth?.querySelector('.menu-btn-text'), t('sceneSettings.renderModes.depth'));
    setElementText(dom.modeNormal?.querySelector('.menu-btn-text'), t('sceneSettings.renderModes.normal'));
    dom.sceneDepthScaleNumber?.setAttribute('aria-label', t('sceneSettings.depthScale'));

    const floatingGroups = dom.rightSidebar?.querySelectorAll('.floating-tool-group') || [];
    floatingGroups[0]?.setAttribute('aria-label', t('toolbar.transformTools'));
    floatingGroups[1]?.setAttribute('aria-label', t('toolbar.clearTools'));
    floatingGroups[2]?.setAttribute('aria-label', t('toolbar.exportTools'));
    floatingGroups[3]?.setAttribute('aria-label', t('toolbar.panelTools'));
    setButtonTooltip(dom.btnGizmoTranslate, t('toolbar.translate'));
    setButtonTooltip(dom.btnGizmoRotate, t('toolbar.rotate'));
    setButtonTooltip(dom.btnGizmoScale, t('toolbar.scale'));
    setButtonTooltip(dom.btnClearScreen, t('toolbar.clearScreen'));
    dom.exportToolFlyout?.setAttribute('aria-label', t('toolbar.export'));
    setButtonTooltip(dom.btnRenderImage, t('toolbar.exportImage'), t('toolbar.exportImage'));
    setButtonTooltip(dom.btnRenderVideo, t('toolbar.exportVideo'), t('toolbar.exportVideo'));
    setButtonTooltip(dom.btnExportFlyout, t('toolbar.export'));
    setButtonTooltip(dom.btnToggleSceneSettings, t('toolbar.sceneSettings'));
    setButtonTooltip(dom.btnHelpTips, t('toolbar.help'));
    updateWorkspaceStatusIndicator();

    setButtonTooltip(dom.btnToggleCameraPreview, t('timeline.openCameraPreview'), t('timeline.openCameraPreview'));
    setElementText(dom.btnToggleCameraPreview?.querySelector('.btn-text'), t('timeline.cameraPreview'));
    setButtonTooltip(dom.btnToggleCameraSettings, t('timeline.openCameraSettings'), t('timeline.openCameraSettings'));
    setElementText(dom.btnToggleCameraSettings?.querySelector('.btn-text'), t('timeline.cameraSettings'));
    setButtonTooltip(dom.btnCameraPreviewClose, t('timeline.closeCameraPreview'), t('timeline.closeCameraPreview'));
    setButtonTooltip(dom.btnCameraSettingsClose, t('sceneSettings.close'), t('sceneSettings.close'));
    const cameraSettingLabels = dom.cameraSettingsPanel?.querySelectorAll('.property-row .property-label') || [];
    setElementText(cameraSettingLabels[0], t('timeline.track'));
    setElementText(cameraSettingLabels[1], t('timeline.size'));
    setElementText(cameraSettingLabels[2], t('timeline.fov'));
    setElementText(dom.timelinePositionInterpolationLabel, t('timeline.positionInterpolation'));
    setElementText(dom.timelineRotationInterpolationLabel, t('timeline.rotationInterpolation'));
    setElementText(dom.timelineTimingInterpolationLabel, t('timeline.timingInterpolation'));
    setElementText(dom.btnToggleCameraSequenceDrag?.querySelector('.btn-text'), t('timeline.drag'));
    setButtonTooltip(dom.btnToggleCameraSequenceDrag, t('timeline.dragHint'), t('timeline.dragHint'));
    dom.btnToggleCameraSequence?.setAttribute('title', t('timeline.toggleSequenceVisibility'));
    dom.btnToggleCameraSequence?.setAttribute('aria-label', t('timeline.toggleSequenceVisibility'));
    dom.btnAddKeyframe?.closest('.timeline-control-group')?.setAttribute('aria-label', t('timeline.keyframes'));
    dom.btnImportCameraSequence?.closest('.timeline-control-group')?.setAttribute('aria-label', t('timeline.cameraSequence'));
    setButtonTooltip(dom.btnAddKeyframe, t('timeline.addKeyframe'), t('timeline.addKeyframe'));
    setButtonTooltip(dom.btnRemoveKeyframe, t('timeline.removeKeyframe'), t('timeline.removeKeyframe'));
    setButtonTooltip(dom.btnImportCameraSequence, t('timeline.importSequence'), t('timeline.importSequence'));
    setButtonTooltip(dom.btnExportCameraSequence, t('timeline.exportSequence'), t('timeline.exportSequence'));
    setButtonTooltip(dom.btnClearCameraSequence, t('timeline.clearSequence'), t('timeline.clearSequence'));
    dom.btnPlayCamera?.closest('.timeline-control-group')?.setAttribute('aria-label', t('timeline.playbackControls'));
    setButtonTooltip(dom.btnPlayCamera, t('timeline.playCamera'), t('timeline.playCamera'));
    setButtonTooltip(dom.btnLoopCamera, t('timeline.loopPlayback'), t('timeline.loopPlayback'));

    if (!pendingExportType) {
        setElementText(dom.exportModalTitle, t('modal.exportTitle'));
    }
    const exportModeOptions = dom.exportMode?.options || [];
    if (exportModeOptions[0]) exportModeOptions[0].textContent = t('modal.exportRenderModes.rgb');
    if (exportModeOptions[1]) exportModeOptions[1].textContent = t('modal.exportRenderModes.depth');
    if (exportModeOptions[2]) exportModeOptions[2].textContent = t('modal.exportRenderModes.normal');
    if (dom.exportProgressText && !isExporting) {
        dom.exportProgressText.textContent = t('modal.exportProgressIdle');
    }
    setButtonTooltip(dom.helpTipsClose, t('modal.closeHelp'), t('modal.closeHelp'));
    const helpSectionTitles = dom.helpTipsModal?.querySelectorAll('.help-section h4') || [];
    setElementText(helpSectionTitles[0], t('modal.helpSections.mouse'));
    setElementText(helpSectionTitles[1], t('modal.helpSections.keyboard'));
    setElementText(helpSectionTitles[2], t('modal.helpSections.camera'));
    const helpSpans = dom.helpTipsModal?.querySelectorAll('.help-list span') || [];
    const helpTexts = [
        t('modal.helpItems.mouseRotate'),
        t('modal.helpItems.mousePan'),
        t('modal.helpItems.mouseZoom'),
        t('modal.helpItems.mouseLookAt'),
        t('modal.helpItems.dropFiles'),
        t('modal.helpItems.playPause'),
        t('modal.helpItems.focusModel'),
        t('modal.helpItems.addKeyframe'),
        t('modal.helpItems.toggleClean'),
        t('modal.helpItems.toggleGizmo'),
        t('modal.helpItems.uprightCamera'),
        t('modal.helpItems.openHelp'),
        t('modal.helpItems.closeOverlay'),
        t('modal.helpItems.movePlane'),
        t('modal.helpItems.movePlane'),
        t('modal.helpItems.moveVertical'),
        t('modal.helpItems.speedUp'),
    ];
    helpSpans.forEach((span, index) => setElementText(span, helpTexts[index] || span.textContent));
}

function syncProjectSessionModalLabels() {
    setButtonTooltip(dom.btnLoginModalClose, t('common.close'), t('common.close'));
    setButtonTooltip(dom.btnProjectSessionClose, t('common.close'), t('common.close'));
    setButtonTooltip(dom.btnProjectBrowserClose, t('common.close'), t('common.close'));
    syncWorkspaceTargetModalLabels(dom.workspaceTargetModal?.dataset.reason || 'status');
    if (dom.projectSessionNewProjectName) {
        dom.projectSessionNewProjectName.placeholder = getProjectSessionDefaultProjectName();
    }
    if (dom.projectBrowserSaveAsName) {
        dom.projectBrowserSaveAsName.placeholder = getProjectSessionDefaultProjectName();
    }
    setElementText(dom.btnProjectBrowserSaveAs, t('projectSession.saveCurrentAsAction'));
    setElementText(dom.btnProjectBrowserSaveAsCancel, t('common.cancel'));
    setElementText(dom.btnProjectBrowserSaveAsConfirm, t('projectSession.saveAction'));
    setElementText(dom.btnProjectBrowserLogout, t('projectSession.logoutAction'));

    setButtonTooltip(dom.btnAdminProjectClose, t('common.close'), t('common.close'));
    setElementText(dom.btnAdminProjectLogout, t('projectSession.logoutAction'));
}

function refreshAgentWorkflowLanguageState() {
    for (const workflowId of Object.keys(AGENT_WORKFLOW_DEFS)) {
        const thread = state.agentWorkflowThreads[workflowId];
        if (!thread) continue;
        thread.label = AGENT_WORKFLOW_DEFS[workflowId]?.label || workflowId;
        if (
            Array.isArray(thread.items)
            && thread.items.length === 1
            && thread.items[0]?.kind !== 'session'
            && thread.items[0]?.role === 'assistant'
        ) {
            thread.items[0].text = AGENT_WORKFLOW_DEFS[workflowId]?.starter || '';
            thread.items[0].promptSuggestions = [...(AGENT_WORKFLOW_DEFS[workflowId]?.starterSuggestions || [])];
        }
    }
}

function applyLanguage(language, persist = false) {
    state.uiLanguage = normalizeUiLanguage(language);
    updateLocalizedStaticUi();
    updateThemeToggleLabel(getCurrentTheme());
    updateLanguageToggleLabel();
    refreshAgentWorkflowLanguageState();
    renderAgentComposerAttachments();
    renderAgentMessages();
    renderSkyPresetGrid();
    updateModelList();
    updateCameraSequenceToggleButton();
    syncCameraSequenceDragButton();
    updatePlayButtonUI();
    syncLeftSidebarCollapsedState();
    syncAgentWorkbenchCollapsedState();
    setExportModalBusy(Boolean(isExporting));
    updateExportTimelineHint(pendingExportType);
    if (persist) {
        try {
            localStorage.setItem(UI_LANGUAGE_STORAGE_KEY, state.uiLanguage);
        } catch (error) {
            console.warn(`[Editor ${state.VERSION}] Failed to persist language:`, error);
        }
    }
}

function initLanguage() {
    let savedLanguage = 'zh';
    try {
        savedLanguage = normalizeUiLanguage(localStorage.getItem(UI_LANGUAGE_STORAGE_KEY));
    } catch (error) {
        console.warn(`[Editor ${state.VERSION}] Failed to load language:`, error);
    }
    applyLanguage(savedLanguage, false);
}

function toggleLanguage() {
    applyLanguage(state.uiLanguage === 'en' ? 'zh' : 'en', true);
}

const FALLBACK_SKY_PRESETS = [
    { id: 'studio', get name() { return t('sceneSettings.skyPresets.studio'); }, colorHex: '#10131C' },
    { id: 'clear_day', get name() { return t('sceneSettings.skyPresets.clear_day'); }, colorHex: '#6EAEEA' },
    { id: 'sunset', get name() { return t('sceneSettings.skyPresets.sunset'); }, colorHex: '#E9875A' },
    { id: 'dusk', get name() { return t('sceneSettings.skyPresets.dusk'); }, colorHex: '#4A5D86' },
    { id: 'night', get name() { return t('sceneSettings.skyPresets.night'); }, colorHex: '#707070' },
];

const AGENT_WORKFLOW_DEFS = {
    'scene-build': {
        get label() { return t('agent.workflows.scene-build.title'); },
        get shortLabel() { return t('agent.workflows.scene-build.short'); },
        get starter() { return t('agent.workflows.scene-build.starter'); },
        get starterSuggestions() { return t('agent.workflows.scene-build.suggestions'); },
        get previewLabel() { return t('agent.workflows.scene-build.sceneSketch'); },
        get progressTitle() { return t('agent.workflows.scene-build.progressTitle'); },
        reply: () => t('agent.workflows.scene-build.reply'),
    },
    'object-insert': {
        get label() { return t('agent.workflows.object-insert.title'); },
        get shortLabel() { return t('agent.workflows.object-insert.short'); },
        get starter() { return t('agent.workflows.object-insert.starter'); },
        get starterSuggestions() { return t('agent.workflows.object-insert.suggestions'); },
        get previewLabel() { return t('agent.workflows.object-insert.objectPreview'); },
        get progressTitle() { return t('agent.workflows.object-insert.progressTitle'); },
        reply: () => t('agent.workflows.object-insert.reply'),
    },
    'character-create': {
        get label() { return t('agent.workflows.character-create.title'); },
        get shortLabel() { return t('agent.workflows.character-create.short'); },
        get starter() { return t('agent.workflows.character-create.starter'); },
        get starterSuggestions() { return t('agent.workflows.character-create.suggestions'); },
        get previewLabel() { return t('agent.workflows.character-create.characterConcept'); },
        get progressTitle() { return t('agent.workflows.character-create.progressTitle'); },
        reply: () => t('agent.workflows.character-create.reply'),
    },
    'camera-direct': {
        get label() { return t('agent.workflows.camera-direct.title'); },
        get shortLabel() { return t('agent.workflows.camera-direct.short'); },
        get starter() { return t('agent.workflows.camera-direct.starter'); },
        get starterSuggestions() { return t('agent.workflows.camera-direct.suggestions'); },
        get previewLabel() { return t('agent.workflows.camera-direct.title'); },
        get progressTitle() { return t('agent.workflows.camera-direct.progressTitle'); },
        reply: () => t('agent.workflows.camera-direct.reply'),
    },
};

function createDefaultAgentMessages(workflowId = state.agentWorkflow) {
    const workflow = AGENT_WORKFLOW_DEFS[workflowId] || getActiveAgentWorkflowDef();
    return [
        createAgentThreadMessage({
            role: 'assistant',
            workflow: workflowId,
            text: workflow.starter,
            promptSuggestions: workflow.starterSuggestions,
        }),
    ];
}

function normalizeHexColor(value) {
    if (!value) return null;
    const text = String(value).trim();
    const matched = text.match(/^#?([0-9a-fA-F]{6})$/);
    if (!matched) return null;
    return `#${matched[1].toUpperCase()}`;
}

function hexToRgb(hex) {
    const normalized = normalizeHexColor(hex);
    if (!normalized) return null;
    return {
        r: Number.parseInt(normalized.slice(1, 3), 16),
        g: Number.parseInt(normalized.slice(3, 5), 16),
        b: Number.parseInt(normalized.slice(5, 7), 16),
    };
}

function clampColorChannel(value) {
    return Math.min(255, Math.max(0, Math.round(Number(value) || 0)));
}

function rgbToHex(r, g, b) {
    return `#${[r, g, b].map((value) => clampColorChannel(value).toString(16).padStart(2, '0')).join('').toUpperCase()}`;
}

function linearChannelToSrgb(channel) {
    const value = Math.min(1, Math.max(0, Number(channel) || 0));
    if (value <= 0.0031308) {
        return value * 12.92;
    }
    return (1.055 * (value ** (1 / 2.4))) - 0.055;
}

// Agent/workbench 不能直接复用场景设置里的原始 #RRGGBB。
// left-sidebar 看到的是 canvas 最终显示出来的背景色，而编辑器渲染链会把
// scene background 当作线性空间 clear color，再经过 linear -> sRGB 输出。
// 因此如果 agent 直接吃原始 hex，会稳定比 left-sidebar 更灰、更暗。
// 这里先把场景设置值转换成“canvas 实际可见背景色”，再同步给 agent 的底层。
function sceneHexToVisibleCanvasHex(hex) {
    const rgb = hexToRgb(hex);
    if (!rgb) return '#707070';
    return rgbToHex(
        linearChannelToSrgb(rgb.r / 255) * 255,
        linearChannelToSrgb(rgb.g / 255) * 255,
        linearChannelToSrgb(rgb.b / 255) * 255
    );
}

function syncAgentWorkbenchLayoutVars() {
    const width = state.agentWorkbenchCollapsed
        ? AGENT_WORKBENCH_COLLAPSED_WIDTH
        : clampAgentWorkbenchWidth(preferredAgentWorkbenchWidth ?? AGENT_WORKBENCH_DEFAULT_WIDTH);
    document.documentElement.style.setProperty(
        '--agent-workbench-shell-offset',
        `${width}px`
    );
}

function syncAgentWorkbenchSceneBackground() {
    const normalized = normalizeHexColor(state.sceneBackgroundHex) || '#707070';
    const visibleHex = sceneHexToVisibleCanvasHex(normalized);
    document.documentElement.style.setProperty('--agent-workbench-scene-bg', visibleHex);
}

function escapeHtml(value) {
    return String(value ?? '')
        .replaceAll('&', '&amp;')
        .replaceAll('<', '&lt;')
        .replaceAll('>', '&gt;')
        .replaceAll('"', '&quot;')
        .replaceAll("'", '&#39;');
}

function clampAgentWorkbenchWidth(value) {
    if (value === null || value === undefined || value === '') {
        return AGENT_WORKBENCH_DEFAULT_WIDTH;
    }
    const n = Number(value);
    if (!Number.isFinite(n)) return AGENT_WORKBENCH_DEFAULT_WIDTH;
    return Math.min(AGENT_WORKBENCH_MAX_WIDTH, Math.max(AGENT_WORKBENCH_MIN_WIDTH, Math.round(n)));
}

function getActiveAgentWorkflowDef() {
    return AGENT_WORKFLOW_DEFS[state.agentWorkflow] || AGENT_WORKFLOW_DEFS['scene-build'];
}

function createAgentMessage(role, text, workflow = state.agentWorkflow) {
    return createAgentThreadMessage({
        role,
        workflow,
        text,
    });
}

function ensureAgentSessionStore() {
    if (!agentSessionStore) {
        agentSessionStore = new AgentSessionStore();
    }
    return agentSessionStore;
}

function syncAgentWorkspacePersistenceState(overrides = {}) {
    state.workspace = {
        ...state.workspace,
        agentDirty: false,
        agentSaving: false,
        agentLastSavedAt: null,
        agentError: null,
        ...overrides,
    };
    updateWorkspaceStatusIndicator();
    return state.workspace;
}

function syncAgentSessionStoreWorkspaceBinding() {
    const store = ensureAgentSessionStore();
    const workspaceHandle = sceneFs.getWorkspaceHandle?.() || null;
    if (workspaceHandle && sceneFs.isWorkspaceWritable?.()) {
        store.bindWorkspaceRoot(workspaceHandle);
        if (store.getStatus().storageMode === 'workspace') {
            syncAgentWorkspacePersistenceState({
                agentError: null,
            });
        }
        return store.getStatus();
    }
    if (store.getStatus().storageMode === 'workspace') {
        store.bindWorkspaceRoot(null);
        syncAgentWorkspacePersistenceState();
    }
    return store.getStatus();
}

function ensureAgentWorkflowThread(workflowId = state.agentWorkflow) {
    if (!AGENT_WORKFLOW_DEFS[workflowId]) {
        workflowId = 'scene-build';
    }
    if (!state.agentWorkflowThreads[workflowId]) {
        state.agentWorkflowThreads[workflowId] = {
            workflow: workflowId,
            label: AGENT_WORKFLOW_DEFS[workflowId]?.label || workflowId,
            items: createDefaultAgentMessages(workflowId),
        };
    }
    return state.agentWorkflowThreads[workflowId];
}

function setCurrentAgentWorkflowThread(workflowId = state.agentWorkflow) {
    const thread = ensureAgentWorkflowThread(workflowId);
    state.agentMessages = thread.items;
    return thread;
}

function isDefaultAgentStarterMessage(item, workflowId) {
    const workflow = AGENT_WORKFLOW_DEFS[workflowId];
    if (!workflow || !item || item.kind !== 'message' || item.role !== 'assistant') {
        return false;
    }
    const itemSuggestions = Array.isArray(item.promptSuggestions) ? item.promptSuggestions : [];
    const starterSuggestions = Array.isArray(workflow.starterSuggestions) ? workflow.starterSuggestions : [];
    return String(item.text || '') === String(workflow.starter || '')
        && itemSuggestions.length === starterSuggestions.length
        && itemSuggestions.every((value, index) => value === starterSuggestions[index])
        && (!Array.isArray(item.attachments) || item.attachments.length === 0)
        && (!Array.isArray(item.blocks) || item.blocks.length === 0);
}

function hasMeaningfulAgentConversation() {
    return Object.keys(AGENT_WORKFLOW_DEFS).some((workflowId) => {
        const items = state.agentWorkflowThreads[workflowId]?.items;
        if (!Array.isArray(items) || items.length === 0) {
            return false;
        }
        if (items.length > 1) {
            return true;
        }
        return !isDefaultAgentStarterMessage(items[0], workflowId);
    });
}

function hasCurrentSceneDraftToSave() {
    const modelCount = Array.isArray(app?.getModels?.()) ? app.getModels().length : 0;
    return modelCount > 0 || hasMeaningfulAgentConversation();
}

function buildAgentConversationSnapshot() {
        const legacyInterpolation = buildLegacyCameraInterpolationSnapshot();
        return {
            version: 2,
        savedAt: new Date().toISOString(),
        workflows: Object.keys(AGENT_WORKFLOW_DEFS).map((workflowId) => {
            const thread = ensureAgentWorkflowThread(workflowId);
            return {
                workflow: workflowId,
                label: thread.label,
                items: thread.items,
            };
        }),
    };
}

async function buildPersistableAgentConversationExport(options = {}) {
    const store = ensureAgentSessionStore();
    return store.exportSnapshot(buildAgentConversationSnapshot(), {
        includeAssets: options.includeAssets !== false,
        includeAssetPayloads: options.includeAssetPayloads === true,
    });
}

function hydrateAgentConversationAssetUrls(snapshot, resolveAssetUrl) {
    if (!snapshot || typeof resolveAssetUrl !== 'function') {
        return snapshot;
    }
    const nextSnapshot = JSON.parse(JSON.stringify(snapshot));
    const workflows = Array.isArray(nextSnapshot.workflows) ? nextSnapshot.workflows : [];
    workflows.forEach((workflow) => {
        const items = Array.isArray(workflow?.items) ? workflow.items : [];
        items.forEach((item) => {
            if (Array.isArray(item?.attachments)) {
                item.attachments = item.attachments.map((attachment) => {
                    const assetPath = String(attachment?.assetPath || '');
                    if (!assetPath) {
                        return attachment;
                    }
                    return {
                        ...attachment,
                        previewUrl: resolveAssetUrl(assetPath),
                    };
                });
            }
            if (item?.kind === 'session' && Array.isArray(item?.attempts)) {
                item.attempts = item.attempts.map((attempt) => ({
                    ...attempt,
                    blocks: Array.isArray(attempt?.blocks)
                        ? attempt.blocks.map((block) => {
                            const assetPath = String(block?.assetPath || '');
                            if (!assetPath) {
                                return block;
                            }
                            if (block.type === 'image') {
                                return {
                                    ...block,
                                    src: resolveAssetUrl(assetPath),
                                };
                            }
                            if (block.type === 'viewer3d') {
                                return {
                                    ...block,
                                    assetUrl: resolveAssetUrl(assetPath),
                                };
                            }
                            return block;
                        })
                        : [],
                }));
            }
        });
    });
    return nextSnapshot;
}

async function hydrateAgentConversationLocalWorkspaceAssets(snapshot, rootHandle) {
    if (!snapshot || !rootHandle || typeof URL === 'undefined' || typeof URL.createObjectURL !== 'function') {
        return snapshot;
    }
    const nextSnapshot = JSON.parse(JSON.stringify(snapshot));
    const workflows = Array.isArray(nextSnapshot.workflows) ? nextSnapshot.workflows : [];

    async function resolveLocalAssetUrl(relativePath) {
        const file = await readFileByRelativePath(rootHandle, relativePath);
        return URL.createObjectURL(file);
    }

    for (const workflow of workflows) {
        const items = Array.isArray(workflow?.items) ? workflow.items : [];
        for (const item of items) {
            if (Array.isArray(item?.attachments)) {
                for (const attachment of item.attachments) {
                    const assetPath = String(attachment?.assetPath || '');
                    if (!assetPath) continue;
                    try {
                        attachment.previewUrl = await resolveLocalAssetUrl(assetPath);
                    } catch (error) {
                        console.warn('[Agent Sessions] failed to hydrate local attachment asset', assetPath, error);
                    }
                }
            }
            if (item?.kind === 'session' && Array.isArray(item?.attempts)) {
                for (const attempt of item.attempts) {
                    const blocks = Array.isArray(attempt?.blocks) ? attempt.blocks : [];
                    for (const block of blocks) {
                        const assetPath = String(block?.assetPath || '');
                        if (!assetPath) continue;
                        try {
                            const assetUrl = await resolveLocalAssetUrl(assetPath);
                            if (block.type === 'image') {
                                block.src = assetUrl;
                            } else if (block.type === 'viewer3d') {
                                block.assetUrl = assetUrl;
                            }
                        } catch (error) {
                            console.warn('[Agent Sessions] failed to hydrate local block asset', assetPath, error);
                        }
                    }
                }
            }
        }
    }

    return nextSnapshot;
}

function hydrateAgentConversationSnapshot(snapshot) {
    const workflows = Array.isArray(snapshot?.workflows) ? snapshot.workflows : [];
    state.agentWorkflowThreads = {};
    Object.keys(AGENT_WORKFLOW_DEFS).forEach((workflowId) => {
        const matched = workflows.find((workflow) => workflow?.workflow === workflowId);
        state.agentWorkflowThreads[workflowId] = {
            workflow: workflowId,
            label: matched?.label || AGENT_WORKFLOW_DEFS[workflowId]?.label || workflowId,
            items: Array.isArray(matched?.items) && matched.items.length > 0
                ? matched.items
                : createDefaultAgentMessages(workflowId),
        };
    });
    setCurrentAgentWorkflowThread(state.agentWorkflow);
    renderAgentMessages({ autoScroll: 'always' });
}

async function persistAgentConversationsNow() {
    const store = ensureAgentSessionStore();
    syncAgentSessionStoreWorkspaceBinding();
    if (!store.getStatus().enabled) return null;
    if (store.getStatus().storageMode === 'workspace') {
        syncAgentWorkspacePersistenceState({
            agentSaving: true,
            agentError: null,
        });
    }
    try {
        console.debug('[AgentSync] persistAgentConversationsNow:start', {
            storageMode: store.getStatus().storageMode,
            storageName: store.getStatus().storageName,
        });
        const result = await store.persistSnapshot(buildAgentConversationSnapshot());
        console.debug('[AgentSync] persistAgentConversationsNow:complete', {
            storageMode: store.getStatus().storageMode,
            lastSavedAt: result?.lastSavedAt || null,
        });
        if (store.getStatus().storageMode === 'workspace') {
            syncAgentWorkspacePersistenceState({
                agentDirty: false,
                agentSaving: false,
                agentLastSavedAt: result?.lastSavedAt ? Date.parse(result.lastSavedAt) : Date.now(),
                agentError: null,
            });
        }
        return result;
    } catch (error) {
        console.debug('[AgentSync] persistAgentConversationsNow:error', {
            storageMode: store.getStatus().storageMode,
            error: error?.message || String(error),
        });
        if (store.getStatus().storageMode === 'workspace') {
            syncAgentWorkspacePersistenceState({
                agentDirty: true,
                agentSaving: false,
                agentError: error?.message || String(error),
            });
        }
        throw error;
    }
}

function schedulePersistAgentConversations() {
    window.clearTimeout(agentSessionPersistTimer);
    const store = ensureAgentSessionStore();
    syncAgentSessionStoreWorkspaceBinding();
    if (isServerProjectSessionActive()) {
        syncAgentWorkspacePersistenceState({
            agentDirty: true,
            agentError: null,
        });
        agentSessionPersistTimer = window.setTimeout(() => {
            scheduleWorkspaceAutosave();
        }, 160);
        return;
    }
    if (store.getStatus().storageMode === 'workspace') {
        syncAgentWorkspacePersistenceState({
            agentDirty: true,
            agentError: null,
        });
    }
    agentSessionPersistTimer = window.setTimeout(() => {
        persistAgentConversationsNow().catch((error) => {
            console.warn('[Agent Sessions] persist failed', error);
        });
    }, 160);
}

// 真实后端接入约定：
// registerAgentSessionActionHandlers({
//   onCancel: async ({ workflow, session, attempt }) => {},
//   onRetry: async ({ workflow, session, attempt, nextAttempt }) => {},
//   onApply: async ({ workflow, session, attempt }) => {},
// })
// 当前 UI 会先完成本地占位状态切换，再调用这些回调，方便后续把真实取消/重试/应用逻辑接进来。
function registerAgentSessionActionHandlers(handlers = {}) {
    agentSessionActionHandlers.onCancel = typeof handlers.onCancel === 'function' ? handlers.onCancel : null;
    agentSessionActionHandlers.onRetry = typeof handlers.onRetry === 'function' ? handlers.onRetry : null;
    agentSessionActionHandlers.onApply = typeof handlers.onApply === 'function' ? handlers.onApply : null;
}

function invokeAgentSessionActionHandler(actionName, payload) {
    const handler = agentSessionActionHandlers[actionName];
    if (typeof handler !== 'function') return Promise.resolve();
    return Promise.resolve(handler(payload));
}

function clearDemoSceneModelRevealTimer() {
    if (demoSceneModelRevealTimer) {
        clearTimeout(demoSceneModelRevealTimer);
        demoSceneModelRevealTimer = 0;
    }
}

function resetDemoSceneState() {
    clearDemoSceneModelRevealTimer();
    state.demoScene = createInactiveDemoSceneState();
}

function setDemoSceneState(nextState) {
    state.demoScene = nextState && typeof nextState === 'object'
        ? nextState
        : createInactiveDemoSceneState();
}

function revealNextDemoSceneModel() {
    if (!state.demoScene?.active) return false;
    const index = Number(state.demoScene.nextModelIndex || 0);
    const nextEntry = state.demoScene.modelRevealQueue[index];
    if (!nextEntry?.id) {
        state.demoScene.sceneRevealCompleted = true;
        state.demoScene.sceneRevealStarted = true;
        clearDemoSceneModelRevealTimer();
        return false;
    }
    app?.setModelVisibility?.(nextEntry.id, true);
    state.demoScene.nextModelIndex = index + 1;
    if (state.demoScene.nextModelIndex >= state.demoScene.modelRevealQueue.length) {
        state.demoScene.sceneRevealCompleted = true;
        clearDemoSceneModelRevealTimer();
    }
    return true;
}

function scheduleDemoSceneModelReveal() {
    clearDemoSceneModelRevealTimer();
    if (!state.demoScene?.active || state.demoScene.sceneRevealCompleted) return;
    demoSceneModelRevealTimer = window.setTimeout(() => {
        demoSceneModelRevealTimer = 0;
        const revealed = revealNextDemoSceneModel();
        if (revealed && !state.demoScene.sceneRevealCompleted) {
            scheduleDemoSceneModelReveal();
        }
    }, DEMO_SCENE_MODEL_REVEAL_INTERVAL_MS);
}

function startDemoSceneModelReveal() {
    if (!state.demoScene?.active) return false;
    if (state.demoScene.sceneRevealStarted) {
        return false;
    }
    state.demoScene.sceneRevealStarted = true;
    if (!state.demoScene.modelRevealQueue.length) {
        state.demoScene.sceneRevealCompleted = true;
        return true;
    }
    revealNextDemoSceneModel();
    if (!state.demoScene.sceneRevealCompleted) {
        scheduleDemoSceneModelReveal();
    }
    return true;
}

function syncDemoCameraPreviewTimeline({
    focusLatest = true,
    resetToBackup = false,
} = {}) {
    if (!state.demoScene?.active) return;
    const previewKeyframes = resetToBackup
        ? (Array.isArray(state.demoScene.cameraTimelineBackup) ? state.demoScene.cameraTimelineBackup : [])
        : (Array.isArray(state.demoScene.cameraPreviewKeyframes) ? state.demoScene.cameraPreviewKeyframes : []);
    state.keyframes = previewKeyframes.map((item) => ({
        frame: Math.round(Number(item.frame) || 0),
        time: Number(item.time) || 0,
        camera: item.camera,
    }));
    state.currentKeyframeIndex = -1;
    const lastFrame = state.keyframes.length > 0
        ? clampTimelineFrame(state.keyframes[state.keyframes.length - 1].frame)
        : 0;
    state.selectedCameraSequenceFrame = state.keyframes.length > 0 ? lastFrame : null;
    setCameraSequenceVisibility(state.keyframes.length > 0, true);
    setTimelineFrame(focusLatest ? lastFrame : 0, { applyPose: false, syncSlider: true });
    updateTimelineUI();
    syncCameraSequenceVisualization();
}

function startDemoCameraWorkflowPreview() {
    if (!state.demoScene?.active) return false;
    stopTimelinePlayback(false);
    setDemoSceneState(beginDemoCameraPreview(state.demoScene, state.keyframes));
    syncDemoCameraPreviewTimeline({ focusLatest: false });
    return true;
}

function revealDemoCameraPreviewForProgress(progressValue) {
    if (!state.demoScene?.active) return null;
    const total = Array.isArray(state.demoScene.keyframeRevealQueue) ? state.demoScene.keyframeRevealQueue.length : 0;
    const normalized = Math.max(0, Math.min(1, Number(progressValue) || 0));
    const targetCount = total <= 0 ? 0 : Math.max(1, Math.min(total, Math.ceil(total * normalized)));
    const nextState = revealDemoCameraPreviewThroughCount(state.demoScene, targetCount);
    setDemoSceneState(nextState);
    syncDemoCameraPreviewTimeline({ focusLatest: true });
    return nextState.cameraPreviewKeyframes[nextState.cameraPreviewKeyframes.length - 1] || null;
}

async function handleDemoSceneAgentApply({ workflow }) {
    if (!state.demoScene?.active) return;
    if (workflow === DEMO_SCENE_WORKFLOW_ID) {
        const started = startDemoSceneModelReveal();
        if (!started) {
            if (state.demoScene.sceneRevealCompleted) {
                showInfo(t('messages.demoSceneAlreadyFilled'));
            }
            return;
        }
        showInfo(t('messages.demoSceneRevealStarted'));
        return;
    }
    if (workflow === DEMO_CAMERA_WORKFLOW_ID) {
        if (!state.demoScene.cameraPreviewActive) {
            showInfo(t('messages.demoCameraPreviewMissing'));
            return;
        }
        setDemoSceneState(commitDemoCameraPreview(state.demoScene));
        showInfo(t('messages.demoCameraTimelineApplied'));
    }
}

async function handleDemoSceneAgentCancel({ workflow }) {
    if (!state.demoScene?.active || workflow !== DEMO_CAMERA_WORKFLOW_ID || !state.demoScene.cameraPreviewActive) return;
    setDemoSceneState(restoreDemoCameraBackup(state.demoScene));
    syncDemoCameraPreviewTimeline({ focusLatest: false, resetToBackup: true });
    showInfo(t('messages.demoCameraPreviewCanceled'));
}

async function handleDemoSceneAgentRetry({ workflow }) {
    if (!state.demoScene?.active || workflow !== DEMO_CAMERA_WORKFLOW_ID) return;
    if (!state.demoScene.cameraPreviewActive) return;
    setDemoSceneState(restoreDemoCameraBackup(state.demoScene));
    syncDemoCameraPreviewTimeline({ focusLatest: false, resetToBackup: true });
}

function getDemoCameraWorkflowCompletionText() {
    return t('messages.demoCameraCompletion');
}

function finalizeDemoCameraWorkflowPreview(handle) {
    if (!state.demoScene?.active) return;
    const total = Array.isArray(state.demoScene.keyframeRevealQueue) ? state.demoScene.keyframeRevealQueue.length : 0;
    if (total > 0) {
        revealDemoCameraPreviewForProgress(1);
    }
    handle.updateText(getDemoCameraWorkflowCompletionText());
    setCameraPreviewOpen(true, { markDirty: false, silent: true });
}

function getAgentSessionArchiveThumbnail(session) {
    if (session?.archiveSummary?.thumbnailUrl) return session.archiveSummary.thumbnailUrl;
    for (const attempt of session?.attempts || []) {
        for (const block of attempt.blocks || []) {
            if (block.type === 'image' && block.status === 'ready' && block.src) {
                return block.src;
            }
        }
    }
    return '';
}

function getAgentItemIndexById(itemId) {
    return state.agentMessages.findIndex((item) => item.id === itemId);
}

function updateAgentSessionById(sessionId, updater, {
    autoScroll = 'preserve-or-pin-bottom',
} = {}) {
    const index = getAgentItemIndexById(sessionId);
    if (index < 0) return null;
    const session = state.agentMessages[index];
    if (!session || session.kind !== 'session') return null;
    const nextSession = updater(session);
    if (!nextSession) return null;
    state.agentMessages[index] = nextSession;
    renderAgentMessages({ autoScroll });
    schedulePersistAgentConversations();
    return nextSession;
}

function createAgentBlockId(prefix = 'block') {
    return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function createAgentProgressBlock({
    id = createAgentBlockId('progress'),
    title = '',
    statusText = '',
    value = 0,
    indeterminate = false,
} = {}) {
    return {
        id,
        type: 'progress',
        title,
        statusText,
        value,
        indeterminate,
    };
}

function createAgentImageBlock({
    id = createAgentBlockId('image'),
    title = '',
    status = 'placeholder',
    src = '',
    alt = '',
} = {}) {
    return {
        id,
        type: 'image',
        title,
        status,
        src,
        alt,
    };
}

function createAgentViewer3DBlock({
    id = createAgentBlockId('viewer3d'),
    title = '',
    status = 'placeholder',
    assetUrl = '',
    format = 'gltf',
    cameraPreset = 'orbit',
    interaction = {},
} = {}) {
    return {
        id,
        type: 'viewer3d',
        title,
        status,
        assetUrl,
        format,
        cameraPreset,
        interaction: {
            rotate: interaction.rotate !== false,
            zoom: interaction.zoom !== false,
            pan: false,
            reset: interaction.reset !== false,
        },
    };
}

function isReadyAgentViewer3DBlock(block) {
    return block?.type === 'viewer3d'
        && block.status === 'ready'
        && Boolean(block.assetUrl)
        && (block.format === 'glb' || block.format === 'gltf');
}

function isImageFile(file) {
    if (!(file instanceof File)) return false;
    if (typeof file.type === 'string' && file.type.startsWith('image/')) return true;
    return /\.(png|jpe?g|webp|gif|bmp|svg)$/i.test(file.name || '');
}

function renderAgentComposerAttachments() {
    if (!dom.agentComposerAttachments) return;
    const attachments = state.agentPendingImages || [];
    dom.agentComposerAttachments.classList.toggle('hidden', attachments.length === 0);
    dom.agentComposerAttachments.innerHTML = attachments.map((file, index) => `
        <span class="agent-composer-attachment">
            <span class="agent-composer-attachment-name">${escapeHtml(file.name)}</span>
            <button
                type="button"
                class="agent-composer-attachment-remove"
                data-agent-attachment-remove="${index}"
                aria-label="${escapeHtml(t('common.removeImage', { name: file.name }))}"
                title="${escapeHtml(t('common.remove'))}"
            >×</button>
        </span>
    `).join('');
}

function queueAgentComposerImages(files) {
    const images = Array.from(files || []).filter(isImageFile);
    if (images.length === 0) return 0;
    state.agentPendingImages = [...state.agentPendingImages, ...images];
    renderAgentComposerAttachments();
    return images.length;
}

function getAgentMessageIndexById(messageId) {
    return state.agentMessages.findIndex((message) => message.id === messageId);
}

function updateAgentMessageById(messageId, updater) {
    const index = getAgentMessageIndexById(messageId);
    if (index < 0) return null;
    const message = state.agentMessages[index];
    if (message?.kind === 'session') return null;
    updater(message);
    renderAgentMessages({ autoScroll: 'preserve-or-pin-bottom' });
    schedulePersistAgentConversations();
    return message;
}

function createAgentMessageHandle(messageId) {
    return {
        messageId,
        updateText(nextText) {
            updateAgentMessageById(messageId, (message) => {
                message.text = String(nextText ?? '');
            });
        },
        setBlocks(blocks) {
            updateAgentMessageById(messageId, (message) => {
                message.blocks = Array.isArray(blocks) ? blocks.map((block) => ({ ...block })) : [];
            });
        },
        patchBlock(blockId, patch) {
            updateAgentMessageById(messageId, (message) => {
                const nextBlocks = Array.isArray(message.blocks) ? message.blocks : [];
                message.blocks = nextBlocks.map((block) => (
                    block.id === blockId ? { ...block, ...patch } : block
                ));
            });
        },
        finish() {
            updateAgentMessageById(messageId, (message) => {
                message.isComplete = true;
            });
        },
        fail(errorText) {
            updateAgentMessageById(messageId, (message) => {
                message.text = String(errorText ?? t('messages.agentExecutionFailed'));
                message.blocks = (message.blocks || []).map((block) => (
                    block.type === 'progress'
                        ? { ...block, indeterminate: false, statusText: t('common.failed') }
                        : (block.type === 'image' || block.type === 'viewer3d')
                            ? { ...block, status: 'error' }
                            : block
                ));
            });
        },
    };
}

function createAgentSessionHandle(sessionId, attemptId) {
    return {
        sessionId,
        attemptId,
        updateText(nextText) {
            updateAgentSessionById(sessionId, (session) => updateAgentSessionAttempt(session, {
                attemptId,
                text: nextText,
            }));
        },
        setBlocks(blocks) {
            updateAgentSessionById(sessionId, (session) => updateAgentSessionAttempt(session, {
                attemptId,
                blocks,
            }));
        },
        patchBlock(blockId, patch) {
            updateAgentSessionById(sessionId, (session) => patchAgentSessionAttemptBlock(session, {
                attemptId,
                blockId,
                patch,
            }));
        },
        finish({ promptSuggestions = null } = {}) {
            updateAgentSessionById(sessionId, (session) => updateAgentSessionAttempt(session, {
                attemptId,
                status: 'complete',
                promptSuggestions,
            }));
        },
        fail(errorText) {
            updateAgentSessionById(sessionId, (session) => {
                const activeAttempt = getAgentSessionActiveAttempt(session);
                const failedBlocks = (activeAttempt?.blocks || []).map((block) => (
                    block.type === 'progress'
                        ? { ...block, indeterminate: false, statusText: t('common.failed') }
                        : (block.type === 'image' || block.type === 'viewer3d')
                            ? { ...block, status: 'error' }
                            : block
                ));
                return updateAgentSessionAttempt(session, {
                    attemptId,
                    text: String(errorText ?? t('messages.agentExecutionFailed')),
                    status: 'failed',
                    blocks: failedBlocks,
                });
            });
        },
    };
}

function openAgentAssistantMessage({
    workflow = state.agentWorkflow,
    text = '',
    blocks = [],
    promptSuggestions = null,
} = {}) {
    const message = createAgentMessage('assistant', text, workflow);
    message.blocks = Array.isArray(blocks) ? blocks : [];
    message.promptSuggestions = Array.isArray(promptSuggestions) ? promptSuggestions : null;
    state.agentMessages.push(message);
    renderAgentMessages({ autoScroll: 'always' });
    schedulePersistAgentConversations();
    return createAgentMessageHandle(message.id);
}

function uint8ArrayToBase64(bytes) {
    let binary = '';
    const chunkSize = 0x8000;
    for (let i = 0; i < bytes.length; i += chunkSize) {
        const chunk = bytes.subarray(i, i + chunkSize);
        binary += String.fromCharCode(...chunk);
    }
    return btoa(binary);
}

function createMockImageDataUrl(label, tint = '#7aa2ff') {
    const canvas = document.createElement('canvas');
    canvas.width = 640;
    canvas.height = 480;
    const ctx = canvas.getContext('2d');
    if (!ctx) return '';

    const gradient = ctx.createLinearGradient(0, 0, canvas.width, canvas.height);
    gradient.addColorStop(0, tint);
    gradient.addColorStop(1, '#111827');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    ctx.fillStyle = 'rgba(255,255,255,0.16)';
    ctx.fillRect(28, 28, canvas.width - 56, canvas.height - 56);

    ctx.fillStyle = '#f8fafc';
    ctx.font = '600 28px Segoe UI';
    ctx.fillText(label, 48, 88);
    ctx.font = '400 18px Segoe UI';
    ctx.fillStyle = 'rgba(248,250,252,0.88)';
    ctx.fillText(t('messages.agentPreviewPlaceholder'), 48, 124);

    ctx.strokeStyle = 'rgba(255,255,255,0.22)';
    ctx.lineWidth = 2;
    ctx.strokeRect(48, 152, canvas.width - 96, canvas.height - 210);
    ctx.beginPath();
    ctx.moveTo(80, 356);
    ctx.lineTo(220, 240);
    ctx.lineTo(320, 310);
    ctx.lineTo(430, 208);
    ctx.lineTo(560, 330);
    ctx.stroke();

    return canvas.toDataURL('image/png');
}

function createMockGltfDataUrl(color = [0.53, 0.68, 1, 1]) {
    const positions = new Float32Array([
        0, 0.75, 0,
        -0.55, -0.45, 0.55,
        0.55, -0.45, 0.55,
        0.55, -0.45, -0.55,
        -0.55, -0.45, -0.55,
    ]);
    const indices = new Uint16Array([
        0, 1, 2,
        0, 2, 3,
        0, 3, 4,
        0, 4, 1,
        1, 4, 3,
        1, 3, 2,
    ]);
    const posBytes = new Uint8Array(positions.buffer);
    const idxBytes = new Uint8Array(indices.buffer);
    const buffer = new Uint8Array(posBytes.byteLength + idxBytes.byteLength);
    buffer.set(posBytes, 0);
    buffer.set(idxBytes, posBytes.byteLength);

    const gltf = {
        asset: { version: '2.0' },
        scene: 0,
        scenes: [{ nodes: [0] }],
        nodes: [{ mesh: 0 }],
        meshes: [{ primitives: [{ attributes: { POSITION: 0 }, indices: 1, material: 0 }] }],
        materials: [{
            pbrMetallicRoughness: {
                baseColorFactor: color,
                metallicFactor: 0.08,
                roughnessFactor: 0.84,
            },
        }],
        buffers: [{
            byteLength: buffer.byteLength,
            uri: `data:application/octet-stream;base64,${uint8ArrayToBase64(buffer)}`,
        }],
        bufferViews: [
            { buffer: 0, byteOffset: 0, byteLength: posBytes.byteLength, target: 34962 },
            { buffer: 0, byteOffset: posBytes.byteLength, byteLength: idxBytes.byteLength, target: 34963 },
        ],
        accessors: [
            {
                bufferView: 0,
                componentType: 5126,
                count: positions.length / 3,
                type: 'VEC3',
                min: [-0.55, -0.45, -0.55],
                max: [0.55, 0.75, 0.55],
            },
            {
                bufferView: 1,
                componentType: 5123,
                count: indices.length,
                type: 'SCALAR',
            },
        ],
    };

    return `data:model/gltf+json;base64,${btoa(JSON.stringify(gltf))}`;
}

async function ensureAgentPreviewManager() {
    if (!agentPreviewManagerPromise) {
        agentPreviewManagerPromise = import('../src/editor/agent-preview-manager.js')
            .then((module) => new module.AgentPreviewManager())
            .catch((error) => {
                agentPreviewManagerPromise = null;
                console.warn('[Agent Preview] failed to load preview manager', error);
                throw error;
            });
    }
    return agentPreviewManagerPromise;
}

async function syncAgent3DBlocks() {
    const viewerBlocks = [];
    for (const item of state.agentMessages) {
        const blocks = item?.kind === 'session'
            ? (getAgentSessionActiveAttempt(item)?.blocks || [])
            : (item.blocks || []);
        for (const block of blocks) {
            if (!isReadyAgentViewer3DBlock(block)) continue;
            const host = dom.agentMessageList?.querySelector(`[data-agent-viewer-block-id="${block.id}"]`);
            if (host instanceof HTMLElement) {
                viewerBlocks.push({ block, host });
            }
        }
    }

    if (viewerBlocks.length === 0) {
        if (!agentPreviewManagerPromise) return;
        const manager = await agentPreviewManagerPromise;
        manager.disposeAll();
        return;
    }

    try {
        const manager = await ensureAgentPreviewManager();
        manager.sync(viewerBlocks);
    } catch (error) {
        console.warn('[Agent Preview] sync failed', error);
    }
}

function renderAgentProgressBlock(block) {
    const progress = Math.max(0, Math.min(1, Number(block.value) || 0));
    const percentText = block.indeterminate ? t('agent.promptProcessing') : `${Math.round(progress * 100)}%`;
    return `
        <section class="agent-block agent-block-progress" data-agent-block-id="${block.id}">
            <div class="agent-block-header">
                <span class="agent-block-title">${escapeHtml(block.title || t('agent.blocks.progress'))}</span>
                <span class="agent-block-meta">${percentText}</span>
            </div>
            <div class="agent-progress-track ${block.indeterminate ? 'is-indeterminate' : ''}">
                <div class="agent-progress-fill" style="width:${Math.round(progress * 100)}%"></div>
            </div>
            ${block.statusText ? `<div class="agent-block-status">${escapeHtml(block.statusText)}</div>` : ''}
        </section>
    `;
}

function renderAgentImageBlock(block) {
    const ready = block.status === 'ready' && block.src;
    return `
        <section class="agent-block agent-block-image" data-agent-block-id="${block.id}">
            <div class="agent-block-header">
                <span class="agent-block-title">${escapeHtml(block.title || t('agent.blocks.image'))}</span>
                <span class="agent-block-meta">${escapeHtml(getAgentBlockStatusLabel(block.status))}</span>
            </div>
            <div class="agent-image-frame ${ready ? 'is-ready' : ''}">
                ${ready
                    ? `<img src="${escapeHtml(block.src)}" alt="${escapeHtml(block.alt || block.title || t('agent.blocks.image'))}" loading="lazy">`
                    : `<div class="agent-image-placeholder">${escapeHtml(t('agent.imageLoading'))}</div>`}
            </div>
        </section>
    `;
}

function renderAgentViewer3DBlock(block) {
    const allowReset = block.interaction?.reset !== false;
    const isReady = block.status === 'ready';
    return `
        <section class="agent-block agent-block-viewer3d ${isReady ? 'is-ready' : 'is-disabled'}" data-agent-block-id="${block.id}">
            <div class="agent-block-header">
                <span class="agent-block-title">${escapeHtml(block.title || t('agent.blocks.viewer3d'))}</span>
                <div class="agent-block-header-actions">
                    <span class="agent-block-meta">${escapeHtml(getAgentBlockStatusLabel(block.status))}</span>
                    ${allowReset ? `<button type="button" class="agent-viewer-reset" data-agent-viewer-reset="${block.id}" ${isReady ? '' : 'disabled'}>${escapeHtml(t('agent.resetView'))}</button>` : ''}
                </div>
            </div>
            <div class="agent-viewer-frame ${isReady ? 'is-ready' : 'is-disabled'}">
                <div class="agent-viewer-surface" data-agent-viewer-block-id="${block.id}"></div>
            </div>
        </section>
    `;
}

function renderAgentBlocks(blocks) {
    if (!Array.isArray(blocks) || blocks.length === 0) return '';
    return `
        <div class="agent-message-blocks">
            ${blocks.map((block) => {
                if (block.type === 'progress') return renderAgentProgressBlock(block);
                if (block.type === 'image') return renderAgentImageBlock(block);
                if (block.type === 'viewer3d') return renderAgentViewer3DBlock(block);
                return '';
            }).join('')}
        </div>
    `;
}

function isAgentImageAttachment(attachment) {
    if (!attachment || typeof attachment !== 'object') return false;
    const type = String(attachment.type || '').toLowerCase();
    if (type.startsWith('image/')) return true;
    const dataUrl = String(attachment.dataUrl || '').toLowerCase();
    if (dataUrl.startsWith('data:image/')) return true;
    const name = String(attachment.name || '').toLowerCase();
    return /\.(png|jpe?g|webp|gif|bmp|svg)$/i.test(name);
}

function resolveAgentAttachmentPreviewUrl(attachment) {
    if (!isAgentImageAttachment(attachment)) return '';
    if (typeof attachment.previewUrl === 'string' && attachment.previewUrl) {
        return attachment.previewUrl;
    }
    if (typeof attachment.dataUrl === 'string' && attachment.dataUrl.startsWith('data:image/')) {
        return attachment.dataUrl;
    }
    const blobLike = attachment.file instanceof Blob
        ? attachment.file
        : attachment.blob instanceof Blob
            ? attachment.blob
            : null;
    if (!blobLike || typeof URL === 'undefined' || typeof URL.createObjectURL !== 'function') {
        return '';
    }
    // Keep one preview URL per in-memory attachment so rerenders do not recreate blob URLs.
    attachment.previewUrl = URL.createObjectURL(blobLike);
    return attachment.previewUrl;
}

function renderAgentAttachment(attachment) {
    const isImage = isAgentImageAttachment(attachment);
    const previewUrl = isImage ? resolveAgentAttachmentPreviewUrl(attachment) : '';
    const attachmentName = escapeHtml(attachment?.name || '');
    return `
        <div class="agent-message-attachment ${isImage ? 'is-image' : ''}">
            <div class="agent-message-attachment-frame ${previewUrl ? 'is-ready' : ''}">
                ${previewUrl
                    ? `<img src="${escapeHtml(previewUrl)}" alt="${attachmentName}" loading="lazy">`
                    : ''}
            </div>
            ${attachmentName ? `<span class="agent-message-attachment-label">${attachmentName}</span>` : ''}
        </div>
    `;
}

function renderAgentAttachments(attachments) {
    if (!Array.isArray(attachments) || attachments.length === 0) return '';
    return `
        <div class="agent-message-attachments">
            ${attachments.map((attachment) => renderAgentAttachment(attachment)).join('')}
        </div>
    `;
}

function renderAgentPromptSuggestions(promptSuggestions) {
    if (!Array.isArray(promptSuggestions) || promptSuggestions.length === 0) return '';
    return `
        <div class="agent-message-suggestions">
            ${promptSuggestions.map((suggestion) => `
                <button
                    type="button"
                    class="agent-message-suggestion"
                    data-agent-suggestion-text="${escapeHtml(suggestion)}"
                >${escapeHtml(suggestion)}</button>
            `).join('')}
        </div>
    `;
}

function renderAgentMessageItem(message) {
    return `
        <div class="agent-message ${message.role === 'user' ? 'is-user' : 'is-assistant'}">
            <div class="agent-message-bubble">
                ${message.role === 'user' ? '' : `<span class="agent-message-role">${escapeHtml(t('common.agent'))}</span>`}
                ${renderAgentAttachments(message.attachments)}
                <div class="agent-message-text">${escapeHtml(message.text)}</div>
                ${renderAgentBlocks(message.blocks)}
                ${renderAgentPromptSuggestions(message.promptSuggestions)}
            </div>
        </div>
    `;
}

function renderAgentSessionPager(session) {
    const total = session?.attempts?.length || 0;
    if (total <= 1) return '';
    const items = resolveAgentSessionPagerItems({
        total,
        activeIndex: session.activeAttemptIndex,
    });
    return `
        <div class="agent-session-pager" aria-label="${escapeHtml(t('common.retryVersions'))}">
            ${items.map((item) => {
                if (item.type === 'nav') {
                    return `
                        <button
                            type="button"
                            class="agent-session-page agent-session-page-nav"
                            data-agent-session-page="${session.id}"
                            data-agent-session-page-index="${item.targetIndex}"
                            title="${escapeHtml(item.direction === 'prev' ? t('common.previousPage') : t('common.nextPage'))}"
                            aria-label="${escapeHtml(item.direction === 'prev' ? t('common.previousPage') : t('common.nextPage'))}"
                            ${item.disabled ? 'disabled' : ''}
                        >${item.direction === 'prev' ? '‹' : '›'}</button>
                    `;
                }
                return `
                    <button
                        type="button"
                        class="agent-session-page ${item.active ? 'is-active' : ''}"
                        data-agent-session-page="${session.id}"
                        data-agent-session-page-index="${item.index}"
                        title="${escapeHtml(t('common.version', { current: item.page, total }))}"
                        aria-label="${escapeHtml(t('common.switchToVersion', { page: item.page }))}"
                    >${item.page}</button>
                `;
            }).join('')}
        </div>
    `;
}

function renderAgentSessionArchiveTag(session) {
    const summary = session.archiveSummary || {};
    const thumbnail = summary.thumbnailUrl || getAgentSessionArchiveThumbnail(session);
    const archiveStateClass = session.archiveState === 'applied'
        ? 'is-applied'
        : session.archiveState === 'canceled'
            ? 'is-canceled'
            : '';
    return `
        <button
            type="button"
            class="agent-session-archive-tag ${archiveStateClass}"
            data-agent-session-toggle="${session.id}"
            aria-expanded="false"
            title="${escapeHtml(t('agent.archivePreview'))}"
        >
            <span class="agent-session-archive-thumb ${thumbnail ? 'has-image' : ''}">
                ${thumbnail ? `<img src="${escapeHtml(thumbnail)}" alt="">` : `<span>${escapeHtml(t('common.archived'))}</span>`}
            </span>
            <span class="agent-session-archive-meta">
                <span class="agent-session-archive-title">${escapeHtml(session.archiveState === 'applied' ? t('common.applied') : session.archiveState === 'canceled' ? t('common.canceled') : (summary.label || t('common.archived')))}</span>
                <span class="agent-session-archive-subtitle">${escapeHtml(session.prompt || AGENT_WORKFLOW_DEFS[session.workflow]?.label || '')}</span>
            </span>
        </button>
    `;
}

function renderAgentSessionItem(session) {
    if (!session || session.kind !== 'session') return '';
    if (session.collapsed && session.archiveState !== 'active') {
        return `
            <div class="agent-message is-assistant is-session is-session-collapsed">
                ${renderAgentSessionArchiveTag(session)}
            </div>
        `;
    }

    const attempt = getAgentSessionActiveAttempt(session);
    const totalAttempts = session.attempts?.length || 0;
    const archiveStateLabel = session.archiveState === 'canceled'
        ? t('common.canceled')
        : session.archiveState === 'applied'
            ? t('common.applied')
            : attempt?.status === 'failed'
                ? t('common.failed')
                : attempt?.status === 'complete'
                    ? t('common.completed')
                    : t('common.generating');
    const isArchivedExpanded = session.archiveState !== 'active' && !session.collapsed;
    const actionAvailability = resolveAgentSessionActionAvailability({
        archiveState: session.archiveState,
        attemptStatus: attempt?.status || 'running',
    });

    return `
        <div class="agent-message is-assistant is-session">
            <div class="agent-session-stack">
                <div class="agent-message-bubble agent-session-bubble">
                    <div class="agent-session-header">
                        <span class="agent-message-role">${escapeHtml(t('common.agent'))}</span>
                        <div class="agent-session-header-meta">
                            ${totalAttempts > 1 ? `<span class="agent-session-attempt-label">${escapeHtml(t('common.version', { current: session.activeAttemptIndex + 1, total: totalAttempts }))}</span>` : ''}
                            <span class="agent-session-status">${archiveStateLabel}</span>
                            ${isArchivedExpanded ? `
                                <button
                                    type="button"
                                    class="agent-session-collapse-btn"
                                    data-agent-session-toggle="${session.id}"
                                    aria-expanded="true"
                                    title="${escapeHtml(t('agent.collapseSession'))}"
                                    aria-label="${escapeHtml(t('agent.collapseSession'))}"
                                >${escapeHtml(t('agent.collapseSession'))}</button>
                            ` : ''}
                        </div>
                    </div>
                    <div class="agent-message-text">${escapeHtml(attempt?.text || '')}</div>
                    ${renderAgentBlocks(attempt?.blocks)}
                    ${renderAgentPromptSuggestions(attempt?.promptSuggestions)}
                    <div class="agent-session-footer">
                        ${isArchivedExpanded ? '' : `
                            <div class="agent-session-actions">
                                <button type="button" class="agent-inline-btn" data-agent-session-action="cancel" data-agent-session-id="${session.id}">${escapeHtml(t('agent.actions.cancel'))}</button>
                                <button type="button" class="agent-inline-btn" data-agent-session-action="retry" data-agent-session-id="${session.id}" ${actionAvailability.canRetry ? '' : 'disabled'}>${escapeHtml(t('agent.actions.retry'))}</button>
                                <button type="button" class="agent-inline-btn" data-agent-session-action="apply" data-agent-session-id="${session.id}" ${actionAvailability.canApply ? '' : 'disabled'}>${escapeHtml(t('agent.actions.apply'))}</button>
                            </div>
                        `}
                    </div>
                </div>
                ${renderAgentSessionPager(session)}
            </div>
        </div>
    `;
}

function getAgentMessageScrollbarMetrics() {
    if (!dom.agentMessageScroll || !dom.agentMessageScrollbar) return null;
    const clientHeight = dom.agentMessageScroll.clientHeight;
    const scrollHeight = dom.agentMessageScroll.scrollHeight;
    const maxScrollTop = Math.max(0, scrollHeight - clientHeight);
    const trackHeight = dom.agentMessageScrollbar.clientHeight;
    if (trackHeight <= 0) {
        return {
            clientHeight,
            scrollHeight,
            maxScrollTop,
            trackHeight: 0,
            thumbHeight: 0,
            thumbTravel: 0,
            thumbTop: 0,
        };
    }
    const thumbHeight = maxScrollTop <= 0
        ? trackHeight
        : Math.max(36, Math.min(trackHeight, (clientHeight / scrollHeight) * trackHeight));
    const thumbTravel = Math.max(0, trackHeight - thumbHeight);
    const thumbTop = maxScrollTop <= 0 || thumbTravel <= 0
        ? 0
        : (dom.agentMessageScroll.scrollTop / maxScrollTop) * thumbTravel;
    return {
        clientHeight,
        scrollHeight,
        maxScrollTop,
        trackHeight,
        thumbHeight,
        thumbTravel,
        thumbTop,
    };
}

function syncAgentMessageScrollbar() {
    if (!dom.agentMessageScroll || !dom.agentMessageScrollbar || !dom.agentMessageScrollbarThumb) return;
    const metrics = getAgentMessageScrollbarMetrics();
    if (!metrics) return;
    const shouldHide = metrics.maxScrollTop <= 0 || metrics.trackHeight <= 0 || state.agentWorkbenchCollapsed;
    dom.agentMessageScrollbar.classList.toggle('is-hidden', shouldHide);
    dom.agentMessageScrollbarThumb.style.height = `${Math.max(0, metrics.thumbHeight)}px`;
    dom.agentMessageScrollbarThumb.style.transform = `translateY(${Math.max(0, metrics.thumbTop)}px)`;
}

function scheduleAgentMessageScrollbarSync() {
    if (agentMessageScrollbarSyncRaf !== 0) return;
    agentMessageScrollbarSyncRaf = requestAnimationFrame(() => {
        agentMessageScrollbarSyncRaf = 0;
        syncAgentMessageScrollbar();
    });
}

function beginAgentMessageScrollbarDrag(event) {
    if (event.button !== 0 || !dom.agentMessageScroll) return;
    const metrics = getAgentMessageScrollbarMetrics();
    if (!metrics || metrics.maxScrollTop <= 0 || metrics.thumbTravel <= 0) return;
    const trackRect = dom.agentMessageScrollbar?.getBoundingClientRect();
    const thumbRect = dom.agentMessageScrollbarThumb?.getBoundingClientRect();
    if (!trackRect || !thumbRect) return;

    if (event.target === dom.agentMessageScrollbar) {
        const targetThumbTop = Math.max(
            0,
            Math.min(metrics.thumbTravel, event.clientY - trackRect.top - metrics.thumbHeight / 2)
        );
        const ratio = metrics.thumbTravel > 0 ? targetThumbTop / metrics.thumbTravel : 0;
        dom.agentMessageScroll.scrollTop = ratio * metrics.maxScrollTop;
    }

    agentMessageScrollbarDragState = {
        startY: event.clientY,
        startScrollTop: dom.agentMessageScroll.scrollTop,
        maxScrollTop: metrics.maxScrollTop,
        thumbTravel: metrics.thumbTravel,
    };
    dom.agentMessageScroll.classList.add('is-dragging-scrollbar');
    window.addEventListener('mousemove', onAgentMessageScrollbarDragMove);
    window.addEventListener('mouseup', endAgentMessageScrollbarDrag);
    window.addEventListener('blur', endAgentMessageScrollbarDrag);
    syncAgentMessageScrollbar();
    event.preventDefault();
}

function onAgentMessageScrollbarDragMove(event) {
    if (!agentMessageScrollbarDragState || !dom.agentMessageScroll) return;
    const { startY, startScrollTop, maxScrollTop, thumbTravel } = agentMessageScrollbarDragState;
    if (thumbTravel <= 0 || maxScrollTop <= 0) return;
    const deltaY = event.clientY - startY;
    const nextScrollTop = startScrollTop + (deltaY / thumbTravel) * maxScrollTop;
    dom.agentMessageScroll.scrollTop = Math.max(0, Math.min(maxScrollTop, nextScrollTop));
    syncAgentMessageScrollbar();
    event.preventDefault();
}

function endAgentMessageScrollbarDrag() {
    if (!agentMessageScrollbarDragState) return;
    agentMessageScrollbarDragState = null;
    dom.agentMessageScroll?.classList.remove('is-dragging-scrollbar');
    window.removeEventListener('mousemove', onAgentMessageScrollbarDragMove);
    window.removeEventListener('mouseup', endAgentMessageScrollbarDrag);
    window.removeEventListener('blur', endAgentMessageScrollbarDrag);
}

function forceAgentMessageScrollToBottom() {
    if (!dom.agentMessageScroll) return;
    dom.agentMessageScroll.scrollTop = dom.agentMessageScroll.scrollHeight;
    syncAgentMessageScrollbar();
}

function runAgentMessageBottomPinLoop() {
    agentMessageBottomPinRaf = 0;
    forceAgentMessageScrollToBottom();
    if (agentMessageBottomPinFramesRemaining <= 0) {
        return;
    }
    agentMessageBottomPinFramesRemaining -= 1;
    agentMessageBottomPinRaf = requestAnimationFrame(runAgentMessageBottomPinLoop);
}

function scheduleAgentMessageBottomPin(frames = 6) {
    const safeFrames = Math.max(0, Number(frames) || 0);
    if (safeFrames <= 0) return;
    agentMessageBottomPinFramesRemaining = Math.max(agentMessageBottomPinFramesRemaining, safeFrames);
    if (agentMessageBottomPinRaf !== 0) return;
    agentMessageBottomPinRaf = requestAnimationFrame(runAgentMessageBottomPinLoop);
}

function bindAgentMessageAsyncBottomPin() {
    if (!dom.agentMessageList) return;
    dom.agentMessageList.querySelectorAll('.agent-image-frame.is-ready img, .agent-message-attachment-frame.is-ready img').forEach((img) => {
        if (!(img instanceof HTMLImageElement) || img.complete) return;
        img.addEventListener('load', () => {
            scheduleAgentMessageBottomPin(4);
        }, { once: true });
        img.addEventListener('error', () => {
            scheduleAgentMessageBottomPin(2);
        }, { once: true });
    });
}

function renderAgentMessages({ autoScroll = 'preserve-or-pin-bottom' } = {}) {
    if (!dom.agentMessageList) return;
    const prevScrollTop = dom.agentMessageScroll?.scrollTop ?? 0;
    const prevClientHeight = dom.agentMessageScroll?.clientHeight ?? 0;
    const prevScrollHeight = dom.agentMessageScroll?.scrollHeight ?? 0;
    const shouldForceBottomAfterRender = shouldForceAgentMessageBottomAfterRender({
        mode: autoScroll,
        prevScrollTop,
        prevClientHeight,
        prevScrollHeight,
    });
    dom.agentMessageList.innerHTML = state.agentMessages.map((item) => (
        item?.kind === 'session'
            ? renderAgentSessionItem(item)
            : renderAgentMessageItem(item)
    )).join('');
    if (dom.agentMessageScroll) {
        dom.agentMessageScroll.scrollTop = resolveAgentMessageRefreshScrollTop({
            mode: autoScroll,
            prevScrollTop,
            prevClientHeight,
            prevScrollHeight,
            nextScrollHeight: dom.agentMessageScroll.scrollHeight,
        });
    }
    syncAgentMessageScrollbar();
    requestAnimationFrame(() => {
        if (shouldForceBottomAfterRender) {
            scheduleAgentMessageBottomPin(8);
            bindAgentMessageAsyncBottomPin();
            return;
        }
        syncAgentMessageScrollbar();
    });
    void syncAgent3DBlocks();
}

function syncAgentWorkflowTabs() {
    dom.agentWorkflowTabs?.querySelectorAll('[data-workflow]').forEach((button) => {
        const isActive = button.dataset.workflow === state.agentWorkflow;
        button.classList.toggle('active', isActive);
        button.setAttribute('aria-pressed', String(isActive));
    });
}

function refreshAgentWorkbench() {
    syncAgentWorkflowTabs();
    renderAgentComposerAttachments();
    renderAgentMessages();
}

function syncAgentWorkbenchCollapsedState() {
    const collapsed = Boolean(state.agentWorkbenchCollapsed);
    dom.agentWorkbench?.classList.toggle('is-collapsed', collapsed);
    if (dom.btnToggleAgentWorkbench) {
        dom.btnToggleAgentWorkbench.textContent = collapsed ? '›' : '‹';
        dom.btnToggleAgentWorkbench.setAttribute('aria-expanded', String(!collapsed));
        const label = collapsed ? t('agent.expandedTooltip') : t('agent.collapsedTooltip');
        dom.btnToggleAgentWorkbench.title = label;
        dom.btnToggleAgentWorkbench.setAttribute('aria-label', label);
    }
    syncAgentWorkbenchLayoutVars();
    scheduleAgentMessageScrollbarSync();
}

function applyAgentWorkbenchWidth(width, persist = true, {
    syncViewport = true,
    syncScrollbar = true,
} = {}) {
    const nextWidth = clampAgentWorkbenchWidth(width);
    const widthChanged = preferredAgentWorkbenchWidth !== nextWidth;
    preferredAgentWorkbenchWidth = nextWidth;
    if (widthChanged) {
        document.documentElement.style.setProperty('--agent-workbench-width', `${preferredAgentWorkbenchWidth}px`);
        syncAgentWorkbenchLayoutVars();
    }
    if (persist) {
        localStorage.setItem(AGENT_WORKBENCH_WIDTH_STORAGE_KEY, String(preferredAgentWorkbenchWidth));
    }
    if (syncViewport) {
        syncCanvasContainerToViewport();
    }
    if (syncScrollbar) {
        scheduleAgentMessageScrollbarSync();
    }
}

function setAgentWorkbenchCollapsed(collapsed, persist = true) {
    state.agentWorkbenchCollapsed = Boolean(collapsed);
    syncAgentWorkbenchCollapsedState();
    if (persist) {
        localStorage.setItem(AGENT_WORKBENCH_COLLAPSED_STORAGE_KEY, String(state.agentWorkbenchCollapsed));
    }
    syncCanvasContainerToViewport();
}

function setAgentWorkflow(workflowId, persist = true) {
    if (!AGENT_WORKFLOW_DEFS[workflowId]) return;
    state.agentWorkflow = workflowId;
    if (persist) {
        localStorage.setItem(AGENT_WORKBENCH_WORKFLOW_STORAGE_KEY, workflowId);
    }
    syncAgentWorkflowTabs();
    setCurrentAgentWorkflowThread(workflowId);
    renderAgentMessages({ autoScroll: 'always' });
}

function appendAgentMessage(role, text, workflow = state.agentWorkflow) {
    state.agentMessages.push(createAgentMessage(role, text, workflow));
    renderAgentMessages({ autoScroll: 'always' });
    schedulePersistAgentConversations();
}

function resetAgentConversation() {
    const thread = ensureAgentWorkflowThread(state.agentWorkflow);
    thread.items = createDefaultAgentMessages(state.agentWorkflow);
    state.agentMessages = thread.items;
    state.agentPendingImages = [];
    renderAgentComposerAttachments();
    renderAgentMessages({ autoScroll: 'always' });
    schedulePersistAgentConversations();
}

function handleAgentMessageListClick(event) {
    if (!(event.target instanceof Element)) return;
    const resetButton = event.target.closest('[data-agent-viewer-reset]');
    if (resetButton instanceof HTMLElement) {
        const blockId = resetButton.dataset.agentViewerReset;
        if (blockId && agentPreviewManagerPromise) {
            agentPreviewManagerPromise.then((manager) => manager.resetViewer(blockId)).catch(() => {});
        }
        return;
    }
    const sessionToggle = event.target.closest('[data-agent-session-toggle]');
    if (sessionToggle instanceof HTMLElement) {
        const sessionId = sessionToggle.dataset.agentSessionToggle;
        if (!sessionId) return;
        updateAgentSessionById(sessionId, (session) => toggleAgentSessionCollapsed(session, !session.collapsed), {
            autoScroll: 'preserve-or-pin-bottom',
        });
        return;
    }
    const sessionPageButton = event.target.closest('[data-agent-session-page]');
    if (sessionPageButton instanceof HTMLElement) {
        const sessionId = sessionPageButton.dataset.agentSessionPage;
        const nextIndex = Number(sessionPageButton.dataset.agentSessionPageIndex);
        if (!sessionId || !Number.isFinite(nextIndex)) return;
        updateAgentSessionById(sessionId, (session) => ({
            ...session,
            activeAttemptIndex: Math.max(0, Math.min(nextIndex, (session.attempts?.length || 1) - 1)),
            updatedAt: new Date().toISOString(),
        }));
        return;
    }
    const sessionActionButton = event.target.closest('[data-agent-session-action]');
    if (sessionActionButton instanceof HTMLElement) {
        const action = sessionActionButton.dataset.agentSessionAction;
        const sessionId = sessionActionButton.dataset.agentSessionId;
        if (!action || !sessionId) return;
        handleAgentSessionAction(sessionId, action).catch((error) => {
            console.warn('[Agent Sessions] action failed', error);
            showError(t('messages.agentOperationFailed', { message: error?.message || String(error) }));
        });
        return;
    }
    const button = event.target.closest('[data-agent-suggestion-text]');
    if (!(button instanceof HTMLElement)) return;
    const prompt = button.dataset.agentSuggestionText;
    if (!prompt) return;
    submitAgentPrompt(prompt);
}

function handleAgentWorkflowClick(event) {
    if (!(event.target instanceof Element)) return;
    const button = event.target.closest('[data-workflow]');
    if (!(button instanceof HTMLElement)) return;
    const workflowId = button.dataset.workflow;
    if (!workflowId) return;

    if (workflowId === state.agentWorkflow && !state.agentWorkbenchCollapsed) {
        syncAgentWorkflowTabs();
        return;
    }

    if (state.agentWorkbenchCollapsed) {
        setAgentWorkbenchCollapsed(false);
    }
    setAgentWorkflow(workflowId);
}

function handleAgentComposerKeydown(event) {
    if (event.key !== 'Enter' || event.shiftKey) return;
    event.preventDefault();
    dom.agentComposer?.requestSubmit();
}

function handleAgentComposerAttachmentClick(event) {
    if (!(event.target instanceof Element)) return;
    const button = event.target.closest('[data-agent-attachment-remove]');
    if (!(button instanceof HTMLElement)) return;
    const index = Number(button.dataset.agentAttachmentRemove);
    if (!Number.isFinite(index) || index < 0) return;
    state.agentPendingImages = state.agentPendingImages.filter((_, itemIndex) => itemIndex !== index);
    renderAgentComposerAttachments();
}

function handleAgentComposerDragOver(event) {
    if (!event.dataTransfer) return;
    const hasImages = Array.from(event.dataTransfer.items || []).some((item) => item.kind === 'file' && item.type.startsWith('image/'));
    if (!hasImages) return;
    event.preventDefault();
    event.dataTransfer.dropEffect = 'copy';
    dom.agentComposerDock?.classList.add('is-drop-target');
}

function clearAgentComposerDropTarget() {
    dom.agentComposerDock?.classList.remove('is-drop-target');
}

function handleAgentComposerDrop(event) {
    if (!event.dataTransfer) return;
    const count = queueAgentComposerImages(event.dataTransfer.files);
    if (count > 0) {
        event.preventDefault();
        event.stopPropagation();
        showInfo(t('messages.imagesAddedToComposer', { count }));
    }
    clearAgentComposerDropTarget();
}

function openAgentImagePicker() {
    dom.agentImageInput?.click();
}

function handleAgentImageInputChange(event) {
    const input = event.target;
    if (!(input instanceof HTMLInputElement)) return;
    const count = queueAgentComposerImages(input.files);
    if (count > 0) {
        showInfo(t('messages.imagesAddedToComposer', { count }));
    }
    input.value = '';
}

function simulateProgressUpdates(handle, blockId, updates, onDone, onStep) {
    const runStep = (index) => {
        const step = updates[index];
        if (!step) {
            onDone?.();
            return;
        }
        window.setTimeout(() => {
            handle.patchBlock(blockId, step.patch);
            onStep?.(step, index);
            runStep(index + 1);
        }, step.delayMs);
    };
    runStep(0);
}

function createMockAgentAttemptBlocks(workflowId) {
    const workflow = AGENT_WORKFLOW_DEFS[workflowId] || getActiveAgentWorkflowDef();
    const progressBlock = createAgentProgressBlock({
        title: workflow.progressTitle,
        statusText: t('agent.blocks.progressQueued'),
        value: 0.08,
    });
    const blocks = [progressBlock];

    let imageBlock = null;
    let viewerBlock = null;

    if (workflowId === 'scene-build') {
        imageBlock = createAgentImageBlock({
            title: t('agent.workflows.scene-build.sceneSketch'),
            status: 'placeholder',
        });
        blocks.push(imageBlock);
    } else if (workflowId === 'object-insert') {
        viewerBlock = createAgentViewer3DBlock({
            title: t('agent.workflows.object-insert.objectPreview'),
            status: 'placeholder',
            interaction: { rotate: true, zoom: true, pan: false, reset: true },
        });
        blocks.push(viewerBlock);
    } else if (workflowId === 'character-create') {
        imageBlock = createAgentImageBlock({
            title: t('agent.workflows.character-create.characterConcept'),
            status: 'placeholder',
        });
        viewerBlock = createAgentViewer3DBlock({
            title: t('agent.workflows.character-create.characterPreview'),
            status: 'placeholder',
            interaction: { rotate: true, zoom: true, pan: false, reset: true },
        });
        blocks.push(imageBlock, viewerBlock);
    }

    return {
        workflow,
        progressBlock,
        imageBlock,
        viewerBlock,
        blocks,
    };
}

function runMockAgentSessionAttempt({
    workflowId,
    prompt,
    sessionId,
    attemptId,
    progressBlock,
    imageBlock,
    viewerBlock,
}) {
    const workflow = AGENT_WORKFLOW_DEFS[workflowId] || getActiveAgentWorkflowDef();
    const handle = createAgentSessionHandle(sessionId, attemptId);
    const demoCameraWorkflowActive = state.demoScene?.active && workflowId === DEMO_CAMERA_WORKFLOW_ID;
    if (demoCameraWorkflowActive) {
        startDemoCameraWorkflowPreview();
    }

    const progressUpdates = [
        { delayMs: 380, patch: { value: 0.22, statusText: t('agent.blocks.progressParse') } },
        { delayMs: 520, patch: { value: 0.46, statusText: t('agent.blocks.progressPlan') } },
        { delayMs: 620, patch: { value: 0.74, statusText: t('agent.blocks.progressCompose') } },
        { delayMs: 520, patch: { value: 1, statusText: t('agent.blocks.progressDone') } },
    ];

    simulateProgressUpdates(handle, progressBlock.id, progressUpdates, () => {
        if (workflowId === 'scene-build' && imageBlock) {
            handle.patchBlock(imageBlock.id, {
                status: 'ready',
                src: createMockImageDataUrl(t('agent.workflows.scene-build.sceneSketch'), '#6ea8ff'),
                alt: t('agent.workflows.scene-build.sceneSketchAlt'),
            });
        }
        if (workflowId === 'object-insert' && viewerBlock) {
            handle.patchBlock(viewerBlock.id, {
                status: 'ready',
                assetUrl: createMockGltfDataUrl([0.91, 0.66, 0.28, 1]),
                format: 'gltf',
            });
        }
        if (workflowId === 'character-create') {
            if (imageBlock) {
                handle.patchBlock(imageBlock.id, {
                    status: 'ready',
                    src: createMockImageDataUrl(t('agent.workflows.character-create.characterConcept'), '#ff8fb3'),
                    alt: t('agent.workflows.character-create.characterConceptAlt'),
                });
            }
            if (viewerBlock) {
                handle.patchBlock(viewerBlock.id, {
                    status: 'ready',
                    assetUrl: createMockGltfDataUrl([0.82, 0.56, 0.92, 1]),
                    format: 'gltf',
                });
            }
        }
        if (demoCameraWorkflowActive) {
            finalizeDemoCameraWorkflowPreview(handle);
        } else {
            handle.updateText(workflow.reply(prompt));
        }
        handle.finish();
    }, (step) => {
        if (demoCameraWorkflowActive) {
            revealDemoCameraPreviewForProgress(step?.patch?.value);
        }
    });

    return handle;
}

function startMockAgentResponse(workflowId, prompt, attachments = []) {
    const { blocks, progressBlock, imageBlock, viewerBlock } = createMockAgentAttemptBlocks(workflowId);
    const attempt = createAgentGenerationAttempt({
        workflow: workflowId,
        text: `${t('common.generating')}: ${prompt}`,
        blocks,
    });
    const session = createAgentSession({
        workflow: workflowId,
        prompt,
        attachments,
        attempt,
    });
    state.agentMessages.push(session);
    renderAgentMessages({ autoScroll: 'always' });
    schedulePersistAgentConversations();
    return runMockAgentSessionAttempt({
        workflowId,
        prompt,
        sessionId: session.id,
        attemptId: attempt.id,
        progressBlock,
        imageBlock,
        viewerBlock,
    });
}

async function handleAgentSessionAction(sessionId, action) {
    const index = getAgentItemIndexById(sessionId);
    if (index < 0) return;
    const session = state.agentMessages[index];
    if (!session || session.kind !== 'session') return;
    const activeAttempt = getAgentSessionActiveAttempt(session);
    const thumbnailUrl = getAgentSessionArchiveThumbnail(session);
    const payload = {
        workflow: session.workflow,
        session,
        attempt: activeAttempt,
        registerCallbacks: registerAgentSessionActionHandlers,
    };

    if (action === 'cancel') {
        updateAgentSessionById(sessionId, (current) => setAgentSessionArchiveState(current, {
            archiveState: 'canceled',
            summaryLabel: t('common.canceled'),
            thumbnailUrl,
        }));
        await invokeAgentSessionActionHandler('onCancel', payload);
        return;
    }

    if (action === 'apply') {
        updateAgentSessionById(sessionId, (current) => setAgentSessionArchiveState(current, {
            archiveState: 'applied',
            summaryLabel: t('common.applied'),
            thumbnailUrl,
        }));
        await invokeAgentSessionActionHandler('onApply', payload);
        return;
    }

    if (action === 'retry') {
        const retryPrompt = session.prompt || activeAttempt?.text || t('messages.retryRequest');
        const { blocks, progressBlock, imageBlock, viewerBlock } = createMockAgentAttemptBlocks(session.workflow);
        const nextAttempt = createAgentGenerationAttempt({
            workflow: session.workflow,
            text: `${t('common.generating')}: ${retryPrompt}`,
            blocks,
        });
        updateAgentSessionById(sessionId, (current) => appendAgentSessionRetryAttempt(current, nextAttempt), {
            autoScroll: 'preserve-or-pin-bottom',
        });
        await invokeAgentSessionActionHandler('onRetry', {
            ...payload,
            nextAttempt,
        });
        runMockAgentSessionAttempt({
            workflowId: session.workflow,
            prompt: retryPrompt,
            sessionId,
            attemptId: nextAttempt.id,
            progressBlock,
            imageBlock,
            viewerBlock,
        });
    }
}

function submitAgentPrompt(promptText, attachments = []) {
    const prompt = String(promptText || '').trim();
    if (!prompt && attachments.length === 0) return;
    const attachmentFallback = t('messages.imageInput');

    const userMessage = createAgentMessage('user', prompt || attachmentFallback);
    userMessage.attachments = attachments;
    state.agentMessages.push(userMessage);
    renderAgentMessages({ autoScroll: 'always' });
    schedulePersistAgentConversations();
    startMockAgentResponse(state.agentWorkflow, prompt || attachmentFallback, attachments);
}

function handleAgentComposerSubmit(event) {
    event.preventDefault();
    if (!dom.agentComposerInput) return;
    const prompt = dom.agentComposerInput.value.trim();
    const attachments = state.agentPendingImages.map((file, index) => ({
        id: `attachment-${Date.now()}-${index}`,
        name: file.name,
        type: file.type || 'image/*',
        file,
    }));
    if (!prompt && attachments.length === 0) return;

    submitAgentPrompt(prompt, attachments);
    dom.agentComposerInput.value = '';
    state.agentPendingImages = [];
    renderAgentComposerAttachments();
}

function scheduleAgentWorkbenchResizeWidth(width) {
    if (!agentWorkbenchResizeState) return;
    agentWorkbenchResizeState.latestWidth = clampAgentWorkbenchWidth(width);
    if (agentWorkbenchResizeRaf !== 0) return;
    agentWorkbenchResizeRaf = requestAnimationFrame(() => {
        agentWorkbenchResizeRaf = 0;
        if (!agentWorkbenchResizeState) return;
        // Keep drag feedback responsive by deferring viewport/canvas relayout until drag end.
        applyAgentWorkbenchWidth(agentWorkbenchResizeState.latestWidth, false, {
            syncViewport: false,
            syncScrollbar: false,
        });
    });
}

function beginAgentWorkbenchResize(event) {
    if (event.button !== 0 || state.agentWorkbenchCollapsed) return;
    agentWorkbenchResizeState = {
        startX: event.clientX,
        width: preferredAgentWorkbenchWidth ?? AGENT_WORKBENCH_DEFAULT_WIDTH,
        latestWidth: preferredAgentWorkbenchWidth ?? AGENT_WORKBENCH_DEFAULT_WIDTH,
    };
    dom.agentWorkbenchResizer?.classList.add('is-active');
    document.body.classList.add('sidebar-resizing');
    document.body.classList.add('agent-workbench-resizing');
    window.addEventListener('mousemove', onAgentWorkbenchResizeMove);
    window.addEventListener('mouseup', endAgentWorkbenchResize);
    window.addEventListener('blur', endAgentWorkbenchResize);
    event.preventDefault();
}

function onAgentWorkbenchResizeMove(event) {
    if (!agentWorkbenchResizeState) return;
    const deltaX = event.clientX - agentWorkbenchResizeState.startX;
    scheduleAgentWorkbenchResizeWidth(agentWorkbenchResizeState.width + deltaX);
    event.preventDefault();
}

function endAgentWorkbenchResize() {
    if (!agentWorkbenchResizeState) return;
    if (agentWorkbenchResizeRaf !== 0) {
        cancelAnimationFrame(agentWorkbenchResizeRaf);
        agentWorkbenchResizeRaf = 0;
    }
    applyAgentWorkbenchWidth(agentWorkbenchResizeState.latestWidth, true);
    agentWorkbenchResizeState = null;
    dom.agentWorkbenchResizer?.classList.remove('is-active');
    document.body.classList.remove('sidebar-resizing');
    document.body.classList.remove('agent-workbench-resizing');
    window.removeEventListener('mousemove', onAgentWorkbenchResizeMove);
    window.removeEventListener('mouseup', endAgentWorkbenchResize);
    window.removeEventListener('blur', endAgentWorkbenchResize);
}

function initializeAgentWorkbench() {
    const savedWidth = localStorage.getItem(AGENT_WORKBENCH_WIDTH_STORAGE_KEY);
    const savedCollapsed = localStorage.getItem(AGENT_WORKBENCH_COLLAPSED_STORAGE_KEY);
    const savedWorkflow = localStorage.getItem(AGENT_WORKBENCH_WORKFLOW_STORAGE_KEY);
    const initialWorkbenchWidth = clampAgentWorkbenchWidth(savedWidth);

    if (savedWorkflow && AGENT_WORKFLOW_DEFS[savedWorkflow]) {
        state.agentWorkflow = savedWorkflow;
    }
    state.agentWorkbenchCollapsed = savedCollapsed === 'true';
    setCurrentAgentWorkflowThread(state.agentWorkflow);

    applyAgentWorkbenchWidth(initialWorkbenchWidth, false);
    syncAgentWorkbenchCollapsedState();
    refreshAgentWorkbench();
}

function clampSidebarWidth(value, fallback, min) {
    const n = Number(value);
    if (!Number.isFinite(n)) return fallback;
    return Math.max(min, Math.round(n));
}

function getSidebarHandleWidth(handle) {
    return handle instanceof HTMLElement ? handle.offsetWidth || 10 : 10;
}

function isRightSidebarVisible() {
    if (!dom.rightSidebar) return false;
    if (dom.rightSidebar.classList.contains('floating-toolbar-host')) return false;
    return !dom.rightSidebar.classList.contains('hidden');
}

function getCurrentSidebarWidths() {
    return {
        left: LEFT_SIDEBAR_DEFAULT_WIDTH,
        right: clampSidebarWidth(dom.rightSidebar?.offsetWidth, RIGHT_SIDEBAR_DEFAULT_WIDTH, RIGHT_SIDEBAR_MIN_WIDTH),
    };
}

function getSidebarLayoutBounds() {
    const containerWidth = dom.middleSection?.clientWidth || window.innerWidth;
    const leftHandleWidth = 0;
    const rightHandleWidth = isRightSidebarVisible() ? getSidebarHandleWidth(dom.rightSidebarResizer) : 0;
    const rightWidth = isRightSidebarVisible()
        ? clampSidebarWidth(dom.rightSidebar?.offsetWidth, RIGHT_SIDEBAR_DEFAULT_WIDTH, RIGHT_SIDEBAR_MIN_WIDTH)
        : 0;
    const leftWidth = 0;

    return {
        containerWidth,
        leftHandleWidth,
        rightHandleWidth,
        currentLeftWidth: leftWidth,
        currentRightWidth: rightWidth,
    };
}

function applySidebarWidthClasses(leftWidth, rightWidth) {
    dom.leftSidebar?.classList.toggle('sidebar-compact', leftWidth <= LEFT_SIDEBAR_COMPACT_WIDTH);
    if (dom.rightSidebar) {
        dom.rightSidebar.classList.toggle('sidebar-narrow', rightWidth <= RIGHT_SIDEBAR_NARROW_WIDTH);
        dom.rightSidebar.classList.toggle('sidebar-xnarrow', rightWidth <= RIGHT_SIDEBAR_XNARROW_WIDTH);
    }
}

function applySidebarWidths(nextLeftWidth, nextRightWidth, persist = true) {
    preferredLeftSidebarWidth = LEFT_SIDEBAR_DEFAULT_WIDTH;
    preferredRightSidebarWidth = isRightSidebarVisible()
        ? clampSidebarWidth(nextRightWidth, RIGHT_SIDEBAR_DEFAULT_WIDTH, RIGHT_SIDEBAR_MIN_WIDTH)
        : 0;

    const bounds = getSidebarLayoutBounds();
    const leftWidth = LEFT_SIDEBAR_DEFAULT_WIDTH;
    const leftReservedWidth = 0;
    let rightWidth = isRightSidebarVisible()
        ? clampSidebarWidth(nextRightWidth, RIGHT_SIDEBAR_DEFAULT_WIDTH, RIGHT_SIDEBAR_MIN_WIDTH)
        : 0;

    const totalReserved = bounds.leftHandleWidth + bounds.rightHandleWidth;
    const maxLeft = LEFT_SIDEBAR_DEFAULT_WIDTH;

    if (isRightSidebarVisible()) {
        const maxRight = Math.max(RIGHT_SIDEBAR_MIN_WIDTH, bounds.containerWidth - totalReserved - leftReservedWidth - CENTER_VIEWPORT_MIN_WIDTH);
        rightWidth = Math.min(rightWidth, maxRight);

        const minCenter = bounds.containerWidth - totalReserved - leftReservedWidth - rightWidth;
        if (minCenter < CENTER_VIEWPORT_MIN_WIDTH) {
            const deficit = CENTER_VIEWPORT_MIN_WIDTH - minCenter;
            rightWidth = Math.max(RIGHT_SIDEBAR_MIN_WIDTH, rightWidth - deficit);
        }
    }

    const debugEntry = {
        time: new Date().toISOString(),
        persist,
        requestedLeft: nextLeftWidth,
        requestedRight: nextRightWidth,
        preferredLeft: preferredLeftSidebarWidth,
        preferredRight: preferredRightSidebarWidth,
        containerWidth: bounds.containerWidth,
        totalReserved,
        currentLeftWidth: bounds.currentLeftWidth,
        currentRightWidth: bounds.currentRightWidth,
        maxLeft,
        appliedLeft: leftWidth,
        appliedRight: rightWidth,
        centerMinWidth: CENTER_VIEWPORT_MIN_WIDTH,
        rightVisible: isRightSidebarVisible(),
    };
    sidebarWidthDebugHistory.push(debugEntry);
    if (sidebarWidthDebugHistory.length > 30) {
        sidebarWidthDebugHistory = sidebarWidthDebugHistory.slice(-30);
    }

    if (dom.leftSidebar) {
        dom.leftSidebar.style.width = `${LEFT_SIDEBAR_DEFAULT_WIDTH}px`;
    }
    if (dom.rightSidebar) {
        dom.rightSidebar.style.width = isRightSidebarVisible() ? `${rightWidth}px` : '';
    }
    document.documentElement.style.setProperty('--left-sidebar-width', `${leftWidth}px`);
    document.documentElement.style.setProperty('--right-sidebar-width', `${Math.max(RIGHT_SIDEBAR_MIN_WIDTH, rightWidth || RIGHT_SIDEBAR_DEFAULT_WIDTH)}px`);
    dom.rightSidebarResizer?.classList.toggle('hidden', !isRightSidebarVisible());
    applySidebarWidthClasses(leftWidth, rightWidth || RIGHT_SIDEBAR_DEFAULT_WIDTH);
    syncCanvasContainerToViewport();

    if (persist) {
        if (isRightSidebarVisible()) {
            localStorage.setItem(RIGHT_SIDEBAR_WIDTH_STORAGE_KEY, String(rightWidth));
        }
    }
}

function beginSidebarResize(kind, event) {
    if (event.button !== 0) return;
    const current = getCurrentSidebarWidths();
    sidebarResizeState = {
        kind,
        startX: event.clientX,
        leftWidth: current.left,
        rightWidth: current.right,
    };
    document.body.classList.add('sidebar-resizing');
    if (kind === 'left') {
        dom.leftSidebarResizer?.classList.add('is-active');
    } else {
        dom.rightSidebarResizer?.classList.add('is-active');
    }
    window.addEventListener('mousemove', onSidebarResizeMove);
    window.addEventListener('mouseup', endSidebarResize);
    window.addEventListener('blur', endSidebarResize);
    event.preventDefault();
}

function onSidebarResizeMove(event) {
    if (!sidebarResizeState) return;
    const deltaX = event.clientX - sidebarResizeState.startX;
    if (sidebarResizeState.kind === 'left') {
        applySidebarWidths(sidebarResizeState.leftWidth + deltaX, getCurrentSidebarWidths().right, true);
    } else {
        applySidebarWidths(getCurrentSidebarWidths().left, sidebarResizeState.rightWidth - deltaX, true);
    }
    event.preventDefault();
}

function endSidebarResize() {
    if (!sidebarResizeState) return;
    sidebarResizeState = null;
    document.body.classList.remove('sidebar-resizing');
    dom.leftSidebarResizer?.classList.remove('is-active');
    dom.rightSidebarResizer?.classList.remove('is-active');
    window.removeEventListener('mousemove', onSidebarResizeMove);
    window.removeEventListener('mouseup', endSidebarResize);
    window.removeEventListener('blur', endSidebarResize);
}

function initializeSidebarLayout() {
    const savedRight = localStorage.getItem(RIGHT_SIDEBAR_WIDTH_STORAGE_KEY);
    const rightWidth = clampSidebarWidth(savedRight, RIGHT_SIDEBAR_DEFAULT_WIDTH, RIGHT_SIDEBAR_MIN_WIDTH);
    preferredLeftSidebarWidth = LEFT_SIDEBAR_DEFAULT_WIDTH;
    preferredRightSidebarWidth = rightWidth;
    applySidebarWidths(LEFT_SIDEBAR_DEFAULT_WIDTH, rightWidth, false);
    requestAnimationFrame(() => {
        applySidebarWidths(
            LEFT_SIDEBAR_DEFAULT_WIDTH,
            preferredRightSidebarWidth ?? RIGHT_SIDEBAR_DEFAULT_WIDTH,
            false
        );
    });
}

function syncCanvasContainerToViewport() {
    if (!dom.canvasContainer || !dom.centerViewport) return;
    const viewportRect = dom.centerViewport.getBoundingClientRect();
    const hostRect = dom.editorShell?.getBoundingClientRect?.() || dom.app?.getBoundingClientRect?.();
    const hostLeft = hostRect?.left || 0;
    const hostTop = hostRect?.top || 0;
    const width = Math.max(1, Math.round(viewportRect.width || 0));
    const height = Math.max(1, Math.round(viewportRect.height || 0));
    const left = Math.round(viewportRect.left - hostLeft);
    const top = Math.round(viewportRect.top - hostTop);
    const nextViewportSync = { left, top, width, height };
    const viewportChanged = !lastCanvasViewportSync
        || lastCanvasViewportSync.left !== left
        || lastCanvasViewportSync.top !== top
        || lastCanvasViewportSync.width !== width
        || lastCanvasViewportSync.height !== height;

    dom.canvasContainer.style.left = `${left}px`;
    dom.canvasContainer.style.top = `${top}px`;
    dom.canvasContainer.style.width = `${width}px`;
    dom.canvasContainer.style.height = `${height}px`;
    dom.canvasContainer.style.right = 'auto';
    dom.canvasContainer.style.bottom = 'auto';

    if (viewportChanged) {
        lastCanvasViewportSync = nextViewportSync;
        app?.refreshViewportLayout?.();
    }
}

function clampModelAnimationSpeed(value) {
    if (!Number.isFinite(value)) return 1;
    const stepped = Math.round(value / MODEL_ANIM_SPEED_STEP) * MODEL_ANIM_SPEED_STEP;
    return Math.min(MODEL_ANIM_SPEED_MAX, Math.max(MODEL_ANIM_SPEED_MIN, stepped));
}

function clampModelAnimationSpeedForSlider(value) {
    if (!Number.isFinite(value)) return 1;
    return Math.min(MODEL_ANIM_SPEED_MAX, Math.max(MODEL_ANIM_SPEED_MIN, value));
}

function extractNumericValue(value) {
    const text = String(value ?? '').trim();
    if (!text) return null;
    const matched = text.match(/[+-]?(?:\d+\.?\d*|\.\d+)(?:[eE][+-]?\d+)?/);
    if (!matched) return null;
    const parsed = Number(matched[0]);
    return Number.isFinite(parsed) ? parsed : null;
}

function nudgeNumericInputValue(rawValue, step, fallbackValue, direction) {
    const parsed = extractNumericValue(rawValue);
    const baseValue = parsed === null ? fallbackValue : parsed;
    const safeBase = Number.isFinite(baseValue) ? baseValue : 0;
    const nextValue = safeBase + step * direction;
    return Number(nextValue.toFixed(3));
}

function speedToSliderValue(speed) {
    const safeSpeed = clampModelAnimationSpeedForSlider(speed);
    const logSpeed = Math.log10(safeSpeed);
    const ratio = (logSpeed - MODEL_ANIM_SPEED_MIN_LOG) / (MODEL_ANIM_SPEED_MAX_LOG - MODEL_ANIM_SPEED_MIN_LOG);
    return Math.min(1, Math.max(0, ratio));
}

function sliderValueToSpeed(value) {
    const ratio = Math.min(1, Math.max(0, Number(value) || 0));
    const logSpeed = MODEL_ANIM_SPEED_MIN_LOG + ratio * (MODEL_ANIM_SPEED_MAX_LOG - MODEL_ANIM_SPEED_MIN_LOG);
    return clampModelAnimationSpeed(10 ** logSpeed);
}

function clampSceneDepthRangeScale(value) {
    if (!Number.isFinite(value)) return 1;
    const stepped = Math.round(value / SCENE_DEPTH_SCALE_STEP) * SCENE_DEPTH_SCALE_STEP;
    return Math.min(SCENE_DEPTH_SCALE_MAX, Math.max(SCENE_DEPTH_SCALE_MIN, stepped));
}

function clampSceneDepthRangeScaleForSlider(value) {
    if (!Number.isFinite(value)) return 1;
    return Math.min(SCENE_DEPTH_SCALE_MAX, Math.max(SCENE_DEPTH_SCALE_MIN, value));
}

function depthScaleToSliderValue(scale) {
    const safeScale = clampSceneDepthRangeScaleForSlider(scale);
    const logScale = Math.log10(safeScale);
    const ratio = (logScale - SCENE_DEPTH_SCALE_MIN_LOG) / (SCENE_DEPTH_SCALE_MAX_LOG - SCENE_DEPTH_SCALE_MIN_LOG);
    return Math.min(1, Math.max(0, ratio));
}

function sliderValueToDepthScale(value) {
    const ratio = Math.min(1, Math.max(0, Number(value) || 0));
    const logScale = SCENE_DEPTH_SCALE_MIN_LOG + ratio * (SCENE_DEPTH_SCALE_MAX_LOG - SCENE_DEPTH_SCALE_MIN_LOG);
    return clampSceneDepthRangeScale(10 ** logScale);
}

function renderSkyPresetGrid() {
    if (!dom.skyPresetGrid) return;
    const presets = (app?.getSceneSkyPresets?.() || FALLBACK_SKY_PRESETS);
    dom.skyPresetGrid.innerHTML = presets.map((preset) => `
        <button class="sky-preset-btn ${state.sceneSkyPresetId === preset.id ? 'active' : ''}" data-sky-id="${preset.id}" title="${getSkyPresetDisplayName(preset)}">
            <span class="sky-preset-swatch" style="background:${preset.colorHex};"></span>
        </button>
    `).join('');
}

function syncSceneBackgroundInputs() {
    if (dom.sceneBgColorPicker) dom.sceneBgColorPicker.value = state.sceneBackgroundHex;
    if (dom.sceneBgColorHex) dom.sceneBgColorHex.value = state.sceneBackgroundHex;
}

function syncSceneDepthRangeInputs() {
    const scale = Number(state.sceneDepthRangeScale || 1);
    if (dom.sceneDepthScale) dom.sceneDepthScale.value = depthScaleToSliderValue(scale).toFixed(3);
    if (dom.sceneDepthScaleNumber && document.activeElement !== dom.sceneDepthScaleNumber) {
        dom.sceneDepthScaleNumber.value = scale.toFixed(3);
    }
}

function applySceneDepthRangeScale(value, silent = false, syncInputText = true) {
    const safe = Number(value);
    if (!Number.isFinite(safe)) {
        showError(t('messages.invalidDepthScale'));
        return;
    }

    const ok = app?.setSceneDepthRangeScale?.(safe);
    if (!ok) {
        showError(t('messages.setDepthScaleFailed'));
        return;
    }

    state.sceneDepthRangeScale = clampSceneDepthRangeScale(safe);
    if (dom.sceneDepthScale) {
        dom.sceneDepthScale.value = depthScaleToSliderValue(state.sceneDepthRangeScale).toFixed(3);
    }
    if (syncInputText && dom.sceneDepthScaleNumber) {
        dom.sceneDepthScaleNumber.value = String(safe);
    }
    if (!silent) {
        showInfo(t('messages.depthScaleSet', { value: state.sceneDepthRangeScale.toFixed(3) }));
    }
}

function updateSceneDepthRangeScaleFromSlider() {
    if (!dom.sceneDepthScale) return;
    applySceneDepthRangeScale(sliderValueToDepthScale(dom.sceneDepthScale.value), true, true);
}

function updateSceneDepthRangeScaleFromInput() {
    if (!dom.sceneDepthScaleNumber) return;
    const rawValue = dom.sceneDepthScaleNumber.value;
    const parsed = extractNumericValue(rawValue);
    if (parsed === null) return;
    applySceneDepthRangeScale(parsed, false, false);
}

function commitSceneDepthRangeScaleFromInput() {
    if (!dom.sceneDepthScaleNumber) return;
    const parsed = extractNumericValue(dom.sceneDepthScaleNumber.value);
    if (parsed === null) {
        dom.sceneDepthScaleNumber.value = Number(state.sceneDepthRangeScale || 1).toFixed(3);
        return;
    }
    applySceneDepthRangeScale(parsed, false, false);
    dom.sceneDepthScaleNumber.value = Number(state.sceneDepthRangeScale || 1).toFixed(3);
}

function handleSceneDepthRangeScaleInputKeydown(e) {
    if (!dom.sceneDepthScaleNumber) return;
    if (e.key === 'Enter') {
        commitSceneDepthRangeScaleFromInput();
        dom.sceneDepthScaleNumber.blur();
        return;
    }
    if (e.key !== 'ArrowUp' && e.key !== 'ArrowDown') return;

    e.preventDefault();
    const direction = e.key === 'ArrowUp' ? 1 : -1;
    const nextValue = nudgeNumericInputValue(
        dom.sceneDepthScaleNumber.value,
        SCENE_DEPTH_SCALE_STEP,
        Number(state.sceneDepthRangeScale || 1),
        direction
    );
    dom.sceneDepthScaleNumber.value = nextValue.toFixed(3);
    applySceneDepthRangeScale(nextValue, false, false);
}

function clampSceneFov(value) {
    const n = Number(value);
    if (!Number.isFinite(n)) return null;
    return Math.max(1, Math.min(179, n));
}

function findCameraFovKeyframeIndexByFrame(frame) {
    const safeFrame = clampTimelineFrame(frame);
    return state.cameraFovKeyframes.findIndex((keyframe) => Number(keyframe.frame) === safeFrame);
}

function getFallbackTimelineCameraFov() {
    return clampSceneFov(state.sceneCameraFov) || 45;
}

function getTimelineCameraFovAtTime(timeSec) {
    const keyframes = Array.isArray(state.cameraFovKeyframes) ? state.cameraFovKeyframes : [];
    if (keyframes.length === 0) {
        return getFallbackTimelineCameraFov();
    }
    if (keyframes.length === 1) {
        return clampSceneFov(keyframes[0]?.fovDegrees) || getFallbackTimelineCameraFov();
    }
    if (timeSec <= keyframes[0].time) {
        return clampSceneFov(keyframes[0]?.fovDegrees) || getFallbackTimelineCameraFov();
    }
    const last = keyframes[keyframes.length - 1];
    if (timeSec >= last.time) {
        return clampSceneFov(last?.fovDegrees) || getFallbackTimelineCameraFov();
    }
    for (let i = 0; i < keyframes.length - 1; i++) {
        const a = keyframes[i];
        const b = keyframes[i + 1];
        if (timeSec < a.time || timeSec > b.time) continue;
        const safeA = clampSceneFov(a?.fovDegrees) || getFallbackTimelineCameraFov();
        const safeB = clampSceneFov(b?.fovDegrees) || safeA;
        const span = Math.max(1e-6, Number(b.time) - Number(a.time));
        const t = (timeSec - Number(a.time)) / span;
        return lerpNumber(safeA, safeB, t);
    }
    return clampSceneFov(last?.fovDegrees) || getFallbackTimelineCameraFov();
}

function applyTimelineFovToPose(pose, timeSec) {
    if (!pose) return null;
    return {
        ...pose,
        fovDegrees: getTimelineCameraFovAtTime(Number(timeSec) || 0),
    };
}

function syncTimelineCameraFovInputs() {
    const currentFov = getTimelineCameraFovAtTime(Number(state.currentTime) || 0);
    const fixed = Number(currentFov || getFallbackTimelineCameraFov()).toFixed(3);
    if (dom.timelineCameraFovRange) dom.timelineCameraFovRange.value = fixed;
    if (dom.timelineCameraFovNumber) dom.timelineCameraFovNumber.value = fixed;
}

function applyTimelineCameraFov(value, silent = false, markDirty = true) {
    const safe = clampSceneFov(value);
    if (safe === null) {
        showError(t('messages.invalidFov'));
        return false;
    }
    const frame = clampTimelineFrame(state.selectedFrame);
    const existingIndex = findCameraFovKeyframeIndexByFrame(frame);
    if (existingIndex >= 0) {
        const existingFov = clampSceneFov(state.cameraFovKeyframes[existingIndex]?.fovDegrees);
        if (existingFov !== null && Math.abs(existingFov - safe) <= 1e-6) {
            syncTimelineCameraFovInputs();
            return true;
        }
    } else {
        const currentFov = getTimelineCameraFovAtTime(Number(state.currentTime) || 0);
        if (Math.abs(currentFov - safe) <= 1e-6) {
            syncTimelineCameraFovInputs();
            return true;
        }
    }
    const keyframe = {
        frame,
        time: frameToTime(frame),
        fovDegrees: safe,
    };
    if (existingIndex >= 0) {
        state.cameraFovKeyframes[existingIndex] = keyframe;
    } else {
        state.cameraFovKeyframes.push(keyframe);
        state.cameraFovKeyframes.sort((a, b) => a.frame - b.frame);
    }
    syncTimelineCameraFovInputs();
    syncTimelineDrivenCameraPreviewPose();
    syncCameraSequenceVisualization();
    updateTimelineUI();
    if (pendingExportType === 'video' && dom.exportModal && !dom.exportModal.classList.contains('hidden')) {
        updateExportTimelineHint('video');
    }
    if (markDirty) {
        markWorkspaceDirty('timeline-camera-fov');
    }
    if (!silent) {
        showInfo(t('messages.timelineFovSet', { value: safe.toFixed(3) }));
    }
    return true;
}

function commitTimelineCameraFovFromInput() {
    if (!dom.timelineCameraFovNumber) return;
    applyTimelineCameraFov(dom.timelineCameraFovNumber.value, false);
}

function handleTimelineCameraFovInputKeydown(e) {
    if (!dom.timelineCameraFovNumber) return;
    if (e.key === 'Enter') {
        commitTimelineCameraFovFromInput();
        dom.timelineCameraFovNumber.blur();
    }
}

function syncSceneFovInputs() {
    const fixed = Number(state.sceneCameraFov || 45).toFixed(3);
    if (dom.sceneFovRange) dom.sceneFovRange.value = fixed;
    if (dom.sceneFovNumber) dom.sceneFovNumber.value = fixed;
}

function applySceneCameraFov(value, silent = false, markDirty = true) {
    const safe = clampSceneFov(value);
    if (safe === null) {
        showError(t('messages.invalidFov'));
        return;
    }
    if (Math.abs((Number(state.sceneCameraFov) || 45) - safe) <= 1e-6) {
        syncSceneFovInputs();
        return;
    }

    const ok = app?.setSceneCameraFovDegrees?.(safe);
    if (!ok) {
        showError(t('messages.setFovFailed'));
        return;
    }

    state.sceneCameraFov = safe;
    syncSceneFovInputs();
    if (state.keyframes.length === 0) {
        syncTimelineDrivenCameraPreviewPose();
    }
    if (markDirty) {
        markWorkspaceDirty('scene-camera-fov');
    }
    if (!silent) {
        showInfo(t('messages.fovSet', { value: safe.toFixed(3) }));
    }
}

function applySceneBackgroundHex(hex, skyPresetId = 'custom', markDirty = true) {
    const normalized = normalizeHexColor(hex);
    if (!normalized) {
        showError(t('messages.invalidBackgroundColor'));
        return;
    }
    if (normalized === state.sceneBackgroundHex && skyPresetId === state.sceneSkyPresetId) {
        syncSceneBackgroundInputs();
        return;
    }

    const ok = app?.setSceneBackgroundColorHex?.(normalized);
    if (!ok) {
        showError(t('messages.setBackgroundFailed'));
        return;
    }

    state.sceneBackgroundHex = normalized;
    state.sceneSkyPresetId = skyPresetId;
    syncAgentWorkbenchSceneBackground();
    syncSceneBackgroundInputs();
    renderSkyPresetGrid();
    if (markDirty) {
        markWorkspaceDirty('scene-background');
    }
}

function applySkyPreset(presetId) {
    if (!app) return;
    const preset = app.applySceneSkyPreset?.(presetId);
    if (!preset) {
        showError(t('messages.skyPresetMissing', { id: presetId }));
        return;
    }

    state.sceneSkyPresetId = preset.id;
    state.sceneBackgroundHex = normalizeHexColor(preset.colorHex) || '#000000';
    syncAgentWorkbenchSceneBackground();
    syncSceneBackgroundInputs();
    renderSkyPresetGrid();
    showInfo(t('messages.skyPresetSet', { name: preset.name }));
}

function initSceneSettingsUI() {
    if (!app) return;

    state.sceneBackgroundHex = normalizeHexColor(app.getSceneBackgroundColorHex?.()) || state.sceneBackgroundHex;
    state.sceneSkyPresetId = app.getSceneSkyPresetId?.() || state.sceneSkyPresetId;
    state.sceneDepthRangeScale = Number(app.getSceneDepthRangeScale?.() || state.sceneDepthRangeScale || 1.0);
    state.sceneCameraFov = clampSceneFov(
        Number(app.getSceneCameraFovDegrees?.() || state.sceneCameraFov || 45.0)
    ) || 45.0;

    syncAgentWorkbenchSceneBackground();
    syncSceneBackgroundInputs();
    syncSceneDepthRangeInputs();
    syncSceneFovInputs();
    syncTimelineCameraFovInputs();
    renderSkyPresetGrid();
}

function setModelEditorActive(active) {
    dom.modelSettingsCard?.classList.toggle('inactive', !active);
    syncViewportGizmoControls();
}

function syncViewportGizmoControls() {
    const selectionKind = resolveViewportSelectionKind({
        cameraSequenceDragEnabled: state.cameraSequenceDragEnabled,
        hasTimelineCamera: hasTimelineCameraPose(),
        cameraGizmoTargetFrame: state.selectedCameraSequenceFrame,
        selectedModelId: state.selectedModelId,
        playbackActive: state.isPlaying,
    });
    const cameraSelectionActive = selectionKind === 'camera';
    const buttons = [
        [dom.btnGizmoTranslate, 'translate'],
        [dom.btnGizmoRotate, 'rotate'],
        [dom.btnGizmoScale, 'scale'],
    ];
    for (const [button, mode] of buttons) {
        if (!button) continue;
        const disabled = !app || (mode === 'scale' && cameraSelectionActive) || (cameraSelectionActive && state.isPlaying);
        button.disabled = disabled;
        button.classList.toggle('active', !disabled && state.viewportGizmoMode === mode);
    }
}

function setViewportGizmoMode(mode, silent = false) {
    if (!app) return false;
    const nextMode = state.viewportGizmoMode === mode ? null : mode;
    const selectionKind = resolveViewportSelectionKind({
        cameraSequenceDragEnabled: state.cameraSequenceDragEnabled,
        hasTimelineCamera: hasTimelineCameraPose(),
        cameraGizmoTargetFrame: state.selectedCameraSequenceFrame,
        selectedModelId: state.selectedModelId,
        playbackActive: state.isPlaying,
    });
    if (nextMode === 'scale' && selectionKind === 'camera') {
        if (!silent) {
            showInfo(t('messages.cameraKeyframeMoveRotateOnly'));
        }
        return false;
    }
    if (!app.setViewportGizmoMode?.(nextMode)) {
        return false;
    }
    state.viewportGizmoMode = nextMode;
    syncViewportGizmoControls();
    if (!silent) {
        const labels = { translate: t('toolbar.translate'), rotate: t('toolbar.rotate'), scale: t('toolbar.scale') };
        showInfo(nextMode ? t('messages.viewportGizmoSet', { mode: labels[nextMode] || nextMode }) : t('messages.viewportGizmoOff'));
    }
    return true;
}

function syncCameraSequenceInteractionEnabled() {
    app?.setCameraSequenceInteractionEnabled?.(!state.isPlaying);
}

function isFreeCameraMode() {
    if (!dom.cameraMode) {
        return true;
    }
    return state.cameraMode === 'fps';
}

function syncCameraSequenceDragButton() {
    if (!dom.btnToggleCameraSequenceDrag) return;
    const disabled = !syncCameraSequenceVisibilityState();
    dom.btnToggleCameraSequenceDrag.disabled = disabled;
    dom.btnToggleCameraSequenceDrag.setAttribute('aria-disabled', disabled ? 'true' : 'false');
    dom.btnToggleCameraSequenceDrag.classList.toggle('active', state.cameraSequenceDragEnabled);
    const textEl = dom.btnToggleCameraSequenceDrag.querySelector('.btn-text');
    if (textEl) {
        textEl.textContent = t('timeline.drag');
    } else {
        dom.btnToggleCameraSequenceDrag.textContent = t('timeline.drag');
    }
}

function syncSelectedCameraSequenceFrameToApp() {
    if (!app?.setSelectedCameraSequenceFrame) return;
    const frame = Number.isFinite(Number(state.selectedCameraSequenceFrame))
        ? clampTimelineFrame(state.selectedCameraSequenceFrame)
        : null;
    syncingCameraSequenceSelection = true;
    try {
        app.setSelectedCameraSequenceFrame(frame);
    } finally {
        syncingCameraSequenceSelection = false;
    }
}

function hasTimelineCameraPose() {
    return Array.isArray(state.keyframes) && state.keyframes.length > 0;
}

function syncManualTimelineCameraSelection(frame) {
    const safeFrame = clampTimelineFrame(frame);
    if (!state.cameraSequenceDragEnabled || !state.cameraSequenceVisible) {
        if (state.selectedCameraSequenceFrame !== null) {
            state.selectedCameraSequenceFrame = null;
            syncCameraSequenceVisualization();
            syncViewportGizmoControls();
            syncSelectedCameraSequenceFrameToApp();
        }
        return safeFrame;
    }
    state.selectedCameraSequenceFrame = safeFrame;
    syncCameraSequenceVisualization();
    syncViewportGizmoControls();
    syncSelectedCameraSequenceFrameToApp();
    return safeFrame;
}

function syncTimelineFrameToCameraGizmo(frame = state.selectedFrame) {
    const target = resolveTimelineGizmoTarget({
        cameraSequenceDragEnabled: state.cameraSequenceDragEnabled,
        cameraSequenceVisible: state.cameraSequenceVisible,
        hasTimelineCamera: hasTimelineCameraPose(),
        playbackActive: state.isPlaying,
        selectedModelId: state.selectedModelId,
        currentFrame: frame,
    });
    if (target.kind !== 'camera-current' || target.frame === null) return false;
    if (!app?.setSelectedCameraSequenceFrame) return false;
    const safeFrame = clampTimelineFrame(target.frame);
    if (state.selectedModelId) {
        closeEditor();
    }
    state.selectedCameraSequenceFrame = safeFrame;
    state.viewportGizmoMode = normalizeViewportGizmoModeForSelection(state.viewportGizmoMode, 'camera');
    syncSelectedCameraSequenceFrameToApp();
    syncCameraSequenceInteractionEnabled();
    syncViewportGizmoControls();
    return Number.isFinite(Number(safeFrame));
}

function activateTimelineCameraKeyframeSelection(frame, { silent = false } = {}) {
    const safeFrame = clampTimelineFrame(frame);
    if (!syncCameraSequenceVisibilityState()) {
        return safeFrame;
    }
    if (!state.cameraSequenceDragEnabled) {
        setCameraSequenceDragEnabled(true, silent);
    }
    syncTimelineFrameToCameraGizmo(safeFrame);
    return safeFrame;
}

function setCameraSequenceDragEnabled(enabled, silent = false) {
    if (!app?.setCameraSequenceEditEnabled) return false;
    const nextEnabled = Boolean(enabled);
    if (nextEnabled && !syncCameraSequenceVisibilityState()) {
        return false;
    }
    if (nextEnabled && !isFreeCameraMode()) {
        if (!silent) {
            showInfo(t('messages.switchToFreeCamera'));
        }
        return false;
    }
    if (!app.setCameraSequenceEditEnabled(nextEnabled)) {
        return false;
    }
    state.cameraSequenceDragEnabled = nextEnabled;
    if (nextEnabled && hasTimelineCameraPose()) {
        state.selectedCameraSequenceFrame = clampTimelineFrame(state.selectedFrame);
        syncSelectedCameraSequenceFrameToApp();
    }
    if (!nextEnabled) {
        state.selectedCameraSequenceFrame = null;
        syncSelectedCameraSequenceFrameToApp();
    }
    state.viewportGizmoMode = normalizeViewportGizmoModeForSelection(
        state.viewportGizmoMode,
        resolveViewportSelectionKind({
            cameraSequenceDragEnabled: state.cameraSequenceDragEnabled,
            hasTimelineCamera: hasTimelineCameraPose(),
            cameraGizmoTargetFrame: state.selectedCameraSequenceFrame,
            selectedModelId: state.selectedModelId,
            playbackActive: state.isPlaying,
        })
    );
    syncCameraSequenceDragButton();
    syncCameraSequenceVisualization();
    syncCameraSequenceInteractionEnabled();
    syncViewportGizmoControls();
    if (!silent) {
        showInfo(t('messages.cameraKeyframeDragState', { state: nextEnabled ? t('common.active') : t('common.inactive') }));
    }
    return true;
}

function suspendCameraSequenceDragForHiddenTrajectory() {
    if (state.cameraSequenceDragEnabledBeforeHidden === null) {
        state.cameraSequenceDragEnabledBeforeHidden = Boolean(state.cameraSequenceDragEnabled);
    }
    if (state.cameraSequenceDragEnabled) {
        setCameraSequenceDragEnabled(false, true);
    } else {
        state.selectedCameraSequenceFrame = null;
        syncSelectedCameraSequenceFrameToApp();
    }
    syncCameraSequenceDragButton();
    syncViewportGizmoControls();
    syncCameraSequenceVisualization();
}

function restoreCameraSequenceDragAfterVisibleTrajectory() {
    const shouldRestore = state.cameraSequenceDragEnabledBeforeHidden === true;
    state.cameraSequenceDragEnabledBeforeHidden = null;
    syncCameraSequenceDragButton();
    if (shouldRestore) {
        setCameraSequenceDragEnabled(true, true);
        syncTimelineFrameToCameraGizmo(state.selectedFrame);
    } else {
        syncCameraSequenceVisualization();
        syncViewportGizmoControls();
    }
}

function syncSceneSettingsPanel() {
    dom.sceneSettingsPanel?.classList.toggle('hidden', !state.sceneSettingsOpen);
    dom.btnToggleSceneSettings?.classList.toggle('active', state.sceneSettingsOpen);
}

function setSceneSettingsOpen(open) {
    state.sceneSettingsOpen = Boolean(open);
    syncSceneSettingsPanel();
}

function positionCameraSettingsPanel() {
    if (!dom.cameraSettingsPanel || !dom.btnToggleCameraSettings || !dom.editorStage) return;
    const position = resolveFloatingPanelPosition({
        shellRect: dom.editorStage.getBoundingClientRect(),
        anchorRect: dom.btnToggleCameraSettings.getBoundingClientRect(),
        panelWidth: dom.cameraSettingsPanel.offsetWidth || 290,
        panelHeight: dom.cameraSettingsPanel.offsetHeight || 0,
        viewportWidth: window.innerWidth,
        viewportHeight: window.innerHeight,
    });

    dom.cameraSettingsPanel.style.left = `${position.left}px`;
    dom.cameraSettingsPanel.style.top = `${position.top}px`;
}

function syncCameraSettingsPanel() {
    dom.cameraSettingsPanel?.classList.toggle('hidden', !state.cameraSettingsOpen);
    dom.btnToggleCameraSettings?.classList.toggle('active', state.cameraSettingsOpen);
    syncFloatingPanelLayerOrder();
    if (state.cameraSettingsOpen) {
        requestAnimationFrame(positionCameraSettingsPanel);
    }
}

function setCameraSettingsOpen(open) {
    state.cameraSettingsOpen = Boolean(open);
    if (state.cameraSettingsOpen) {
        activeFloatingPanelKey = 'cameraSettings';
    }
    syncCameraSettingsPanel();
}

function mountCameraSettingsPanelToMainUi() {
    const mainUi = document.getElementById('main-ui');
    if (!mainUi || !dom.cameraSettingsPanel) return;
    if (dom.cameraSettingsPanel.parentElement === mainUi) return;
    mainUi.appendChild(dom.cameraSettingsPanel);
}

function syncCameraPreviewViewportAspect() {
    const option = getCameraPreviewAspectOption(state.cameraPreviewAspectId);
    dom.cameraPreviewAspectRatio && (dom.cameraPreviewAspectRatio.value = option.id);
    dom.cameraPreviewViewport?.style.setProperty('--camera-preview-aspect', String(option.aspect));
    applyCameraPreviewPanelSize();
}

function clampCameraPreviewMaxSize(value) {
    const numeric = Number(value);
    const viewportLimitedMax = Math.min(
        CAMERA_PREVIEW_MAX_SIZE_MAX,
        Math.max(CAMERA_PREVIEW_MAX_SIZE_MIN, (window.innerWidth - 48 - CAMERA_PREVIEW_PANEL_HORIZONTAL_PADDING) / 3),
        Math.max(CAMERA_PREVIEW_MAX_SIZE_MIN, (window.innerHeight - 120) / 4),
    );
    if (!Number.isFinite(numeric)) {
        return Math.min(CAMERA_PREVIEW_MAX_SIZE_DEFAULT, viewportLimitedMax);
    }
    return Math.max(CAMERA_PREVIEW_MAX_SIZE_MIN, Math.min(viewportLimitedMax, numeric));
}

function resolveCameraPreviewViewportSize(maxSize = state.cameraPreviewMaxSize, aspect = getCameraPreviewAspectOption(state.cameraPreviewAspectId).aspect) {
    const safeMaxSize = clampCameraPreviewMaxSize(maxSize);
    const safeAspect = Number.isFinite(aspect) && aspect > 0 ? aspect : (16 / 9);
    const maxWidth = safeMaxSize * 3;
    const maxHeight = safeMaxSize * 4;
    let width = maxWidth;
    let height = width / safeAspect;
    if (height > maxHeight) {
        height = maxHeight;
        width = height * safeAspect;
    }
    return {
        width,
        height,
        maxSize: safeMaxSize,
    };
}

function applyCameraPreviewPanelSize() {
    if (!dom.cameraPreviewPanel || !dom.cameraPreviewViewport) return;
    const { width, height, maxSize } = resolveCameraPreviewViewportSize();
    state.cameraPreviewMaxSize = maxSize;
    dom.cameraPreviewPanel.style.width = `${Math.ceil(width + CAMERA_PREVIEW_PANEL_HORIZONTAL_PADDING)}px`;
    dom.cameraPreviewViewport.style.width = `${Math.round(width)}px`;
    dom.cameraPreviewViewport.style.height = `${Math.round(height)}px`;
    app?.requestCameraPreviewResizeSync?.(80);
}

function readStoredCameraPreviewPosition() {
    return null;
}

function persistCameraPreviewPosition(left, bottom) {
    return { left, bottom };
}

function measureCameraPreviewPanelRect() {
    if (!dom.cameraPreviewPanel) {
        return { width: 320, height: 220 };
    }
    const panel = dom.cameraPreviewPanel;
    const wasHidden = panel.classList.contains('hidden');
    const previousVisibility = panel.style.visibility;
    const previousDisplay = panel.style.display;
    if (wasHidden) {
        panel.classList.remove('hidden');
        panel.style.visibility = 'hidden';
        panel.style.display = 'block';
    }
    const rect = panel.getBoundingClientRect();
    if (wasHidden) {
        panel.classList.add('hidden');
        panel.style.visibility = previousVisibility;
        panel.style.display = previousDisplay;
    }
    return {
        width: rect.width || panel.offsetWidth || 320,
        height: rect.height || panel.offsetHeight || 220,
    };
}

function resolveDefaultCameraPreviewPanelPosition() {
    const margin = 12;
    const gap = CAMERA_PREVIEW_PANEL_DEFAULT_GAP;
    const panelRect = measureCameraPreviewPanelRect();
    const actualWidth = panelRect.width;
    const actualHeight = panelRect.height;
    const agentRect = dom.agentWorkbench?.getBoundingClientRect();
    const timelineRect = dom.bottomTimeline?.getBoundingClientRect();
    const editorStageRect = dom.editorStage?.getBoundingClientRect();
    const fallbackPosition = resolveFloatingPanelPosition({
        shellRect: editorStageRect,
        anchorRect: dom.btnToggleCameraPreview?.getBoundingClientRect(),
        panelWidth: actualWidth,
        panelHeight: actualHeight,
        viewportWidth: window.innerWidth,
        viewportHeight: window.innerHeight,
    });

    let left = fallbackPosition.left;
    let top = fallbackPosition.top;

    if (agentRect) {
        left = Math.max(margin, agentRect.right + gap);
    }
    if (timelineRect) {
        top = timelineRect.top - actualHeight - gap;
    }

    const maxLeft = Math.max(margin, window.innerWidth - margin - actualWidth);
    const headerHeight = Math.max(
        37,
        dom.cameraPreviewPanel?.querySelector('.camera-preview-header')?.getBoundingClientRect?.().height || 0
    );
    const maxTop = Math.max(margin, window.innerHeight - margin - headerHeight);
    return {
        left: Math.max(margin, Math.min(maxLeft, left)),
        top: Math.max(margin, Math.min(maxTop, top)),
    };
}

function captureCameraPreviewWorkspacePreset() {
    if (!dom.cameraPreviewPanel) {
        return {
            open: Boolean(state.cameraPreviewOpen),
            position: null,
        };
    }
    const rect = dom.cameraPreviewPanel.getBoundingClientRect();
    const left = Number.parseFloat(dom.cameraPreviewPanel.style.left || '');
    const top = Number.parseFloat(dom.cameraPreviewPanel.style.top || '');
    if (!Number.isFinite(left) || !Number.isFinite(top)) {
        return {
            open: Boolean(state.cameraPreviewOpen),
            position: null,
        };
    }
    return {
        open: Boolean(state.cameraPreviewOpen),
        position: {
            left: Math.round(left),
            bottom: Math.max(12, Math.round(window.innerHeight - top - rect.height)),
        },
    };
}

function clearCameraPreviewWorkspacePresetLayout() {
    if (!dom.cameraPreviewPanel) return;
    dom.cameraPreviewPanel.style.left = '';
    dom.cameraPreviewPanel.style.top = '';
    delete dom.cameraPreviewPanel.dataset.pendingBottom;
}

function applyCameraPreviewWorkspacePreset(preset = null, markDirty = false) {
    clearCameraPreviewWorkspacePresetLayout();
    if (preset?.position && dom.cameraPreviewPanel) {
        const left = Number(preset.position.left);
        const bottom = Number(preset.position.bottom);
        if (Number.isFinite(left)) {
            dom.cameraPreviewPanel.style.left = `${left}px`;
        }
        if (Number.isFinite(bottom)) {
            dom.cameraPreviewPanel.dataset.pendingBottom = String(bottom);
        }
    }
    setCameraPreviewOpen(Boolean(preset?.open), { markDirty });
}

function positionCameraPreviewPanel() {
    if (!dom.cameraPreviewPanel || !dom.editorStage) return;
    let left = Number.parseFloat(dom.cameraPreviewPanel.style.left || '');
    let top = Number.parseFloat(dom.cameraPreviewPanel.style.top || '');
    let bottom = Number.parseFloat(dom.cameraPreviewPanel.dataset.pendingBottom || '');

    if (!Number.isFinite(left) || !Number.isFinite(top)) {
        const position = readStoredCameraPreviewPosition() || resolveDefaultCameraPreviewPanelPosition();
        if (!Number.isFinite(left)) {
            left = position.left;
        }
        if (!Number.isFinite(top) && Number.isFinite(position.bottom)) {
            bottom = position.bottom;
        } else if (!Number.isFinite(top) && Number.isFinite(position.top)) {
            top = position.top;
        }
    }

    const panelRect = dom.cameraPreviewPanel.getBoundingClientRect();
    const margin = 12;
    const minLeft = margin;
    const maxLeft = Math.max(minLeft, window.innerWidth - margin - panelRect.width);
    const headerHeight = Math.max(
        37,
        dom.cameraPreviewPanel.querySelector('.camera-preview-header')?.getBoundingClientRect?.().height || 0
    );
    const maxTop = Math.max(margin, window.innerHeight - margin - headerHeight);
    if (!Number.isFinite(top) && Number.isFinite(bottom)) {
        top = window.innerHeight - bottom - panelRect.height;
    }
    const resolvedLeft = Math.max(minLeft, Math.min(maxLeft, left));
    const resolvedTop = Math.max(margin, Math.min(maxTop, top));
    const resolvedBottom = Math.max(margin, window.innerHeight - resolvedTop - panelRect.height);
    dom.cameraPreviewPanel.style.left = `${resolvedLeft}px`;
    dom.cameraPreviewPanel.style.top = `${resolvedTop}px`;
    delete dom.cameraPreviewPanel.dataset.pendingBottom;
    persistCameraPreviewPosition(resolvedLeft, resolvedBottom);
}

function syncCameraPreviewPanel() {
    dom.cameraPreviewPanel?.classList.toggle('hidden', !state.cameraPreviewOpen);
    dom.btnToggleCameraPreview?.classList.toggle('active', state.cameraPreviewOpen);
    app?.setCameraPreviewVisible?.(state.cameraPreviewOpen);
    syncFloatingPanelLayerOrder();
    if (state.cameraPreviewOpen) {
        applyCameraPreviewPanelSize();
        syncTimelineDrivenCameraPreviewPose();
        requestAnimationFrame(() => {
            applyCameraPreviewPanelSize();
            positionCameraPreviewPanel();
            requestAnimationFrame(positionCameraPreviewPanel);
        });
    }
}

function setCameraPreviewOpen(open, options = {}) {
    const markDirty = options.markDirty === true;
    const silent = options.silent === true;
    const nextOpen = Boolean(open);
    const changed = state.cameraPreviewOpen !== nextOpen;
    state.cameraPreviewOpen = Boolean(open);
    if (state.cameraPreviewOpen) {
        activeFloatingPanelKey = 'cameraPreview';
    }
    syncCameraPreviewPanel();
    if (changed && markDirty) {
        markWorkspaceDirty('camera-preview-preset');
    }
    if (changed && !silent && markDirty) {
        showInfo(t('messages.cameraPreviewState', { state: state.cameraPreviewOpen ? t('common.active') : t('common.inactive') }));
    }
}

function mountCameraPreviewPanelToMainUi() {
    const mainUi = document.getElementById('main-ui');
    if (!mainUi || !dom.cameraPreviewPanel) return;
    if (dom.cameraPreviewPanel.parentElement === mainUi) return;
    mainUi.appendChild(dom.cameraPreviewPanel);
}

function syncFloatingPanelLayerOrder() {
    const { cameraSettings, cameraPreview } = resolveFloatingPanelLayerZIndices(activeFloatingPanelKey);
    if (dom.cameraSettingsPanel) {
        dom.cameraSettingsPanel.style.zIndex = String(state.cameraSettingsOpen ? cameraSettings : 60);
    }
    if (dom.cameraPreviewPanel) {
        dom.cameraPreviewPanel.style.zIndex = String(state.cameraPreviewOpen ? cameraPreview : 60);
    }
}

function focusFloatingPanel(panelKey) {
    activeFloatingPanelKey = panelKey === 'cameraSettings' ? 'cameraSettings' : 'cameraPreview';
    syncFloatingPanelLayerOrder();
}

function applyCameraPreviewAspect(aspectId, silent = false) {
    const option = getCameraPreviewAspectOption(aspectId);
    state.cameraPreviewAspectId = option.id;
    syncCameraPreviewViewportAspect();
    app?.setCameraPreviewAspectRatio?.(option.aspect);
    syncCameraSequenceVisualization();
    localStorage.setItem(CAMERA_PREVIEW_ASPECT_STORAGE_KEY, option.id);
    requestAnimationFrame(positionCameraPreviewPanel);
    if (!silent) {
        showInfo(t('messages.cameraPreviewAspectSet', { label: option.label }));
    }
}

function beginCameraPreviewPanelDrag(event) {
    if (!dom.cameraPreviewPanel) return;
    const target = event.target;
    if (!(target instanceof HTMLElement)) return;
    if (!target.closest('.camera-preview-header')) return;
    if (target.closest('button') || target.closest('select') || target.closest('input') || target.closest('label')) {
        return;
    }
    const rect = dom.cameraPreviewPanel.getBoundingClientRect();
    cameraPreviewDragState = {
        offsetX: event.clientX - rect.left,
        offsetY: event.clientY - rect.top,
    };
    event.preventDefault();
}

function moveCameraPreviewPanel(event) {
    if (!cameraPreviewDragState || !dom.cameraPreviewPanel) return;
    const rect = dom.cameraPreviewPanel.getBoundingClientRect();
    const nextLeft = event.clientX - cameraPreviewDragState.offsetX;
    const nextTop = event.clientY - cameraPreviewDragState.offsetY;
    const margin = 12;
    const headerHeight = Math.max(
        37,
        dom.cameraPreviewPanel.querySelector('.camera-preview-header')?.getBoundingClientRect?.().height || 0
    );
    const maxLeft = Math.max(margin, window.innerWidth - margin - rect.width);
    const maxTop = Math.max(margin, window.innerHeight - margin - headerHeight);
    dom.cameraPreviewPanel.style.left = `${Math.max(margin, Math.min(maxLeft, nextLeft))}px`;
    dom.cameraPreviewPanel.style.top = `${Math.max(margin, Math.min(maxTop, nextTop))}px`;
}

function endCameraPreviewPanelDrag() {
    if (dom.cameraPreviewPanel && state.workspace?.writable) {
        markWorkspaceDirty('camera-preview-preset');
    }
    cameraPreviewDragState = null;
}

function beginCameraPreviewPanelResize(event) {
    if (!dom.cameraPreviewResizeHandle) return;
    const target = event.target;
    if (!(target instanceof HTMLElement)) return;
    if (!target.closest('#cameraPreviewResizeHandle')) return;
    cameraPreviewResizeState = {
        startX: event.clientX,
        startY: event.clientY,
        startMaxSize: state.cameraPreviewMaxSize,
    };
    focusFloatingPanel('cameraPreview');
    event.preventDefault();
    event.stopPropagation();
}

function moveCameraPreviewPanelResize(event) {
    if (!cameraPreviewResizeState) return;
    const deltaWidth = (event.clientX - cameraPreviewResizeState.startX) / 3;
    const deltaHeight = (event.clientY - cameraPreviewResizeState.startY) / 4;
    state.cameraPreviewMaxSize = clampCameraPreviewMaxSize(
        cameraPreviewResizeState.startMaxSize + Math.max(deltaWidth, deltaHeight)
    );
    applyCameraPreviewPanelSize();
    positionCameraPreviewPanel();
}

function endCameraPreviewPanelResize() {
    if (dom.cameraPreviewPanel && state.workspace?.writable) {
        markWorkspaceDirty('camera-preview-preset');
    }
    cameraPreviewResizeState = null;
}

function initializeCameraPreviewControls() {
    if (dom.cameraPreviewAspectRatio && dom.cameraPreviewAspectRatio.options.length === 0) {
        dom.cameraPreviewAspectRatio.innerHTML = CAMERA_PREVIEW_ASPECT_OPTIONS
            .map((option) => `<option value="${option.id}">${option.label}</option>`)
            .join('');
    }
    syncCameraPreviewViewportAspect();
}

function syncLeftSidebarCollapsedState() {
    const collapsed = Boolean(state.leftSidebarCollapsed);
    dom.leftSidebar?.classList.toggle('sidebar-collapsed', collapsed);
    if (dom.modelCountBadge) {
        dom.modelCountBadge.textContent = collapsed ? t('common.expand') : t('common.collapse');
        dom.modelCountBadge.setAttribute('aria-expanded', String(!collapsed));
        dom.modelCountBadge.title = collapsed ? t('sidebar.expandPanel') : t('sidebar.collapsePanel');
    }
}

function setLeftSidebarCollapsed(collapsed) {
    state.leftSidebarCollapsed = Boolean(collapsed);
    syncLeftSidebarCollapsedState();
}

function updateThemeToggleLabel(theme) {
    if (!dom.btnThemeToggle) return;
    const nextTheme = theme === 'light' ? 'dark' : 'light';
    const tooltip = nextTheme === 'light' ? t('theme.switchToLight') : t('theme.switchToDark');
    dom.btnThemeToggle.title = tooltip;
    dom.btnThemeToggle.setAttribute('data-tooltip', tooltip);
    dom.btnThemeToggle.setAttribute('aria-label', t('theme.toggle'));
    dom.btnThemeToggle.innerHTML = nextTheme === 'light'
        ? `
            <svg viewBox="0 0 24 24" aria-hidden="true">
                <path d="M12 3v2" />
                <path d="M12 19v2" />
                <path d="M3 12h2" />
                <path d="M19 12h2" />
                <path d="m5.64 5.64 1.41 1.41" />
                <path d="m16.95 16.95 1.41 1.41" />
                <path d="m5.64 18.36 1.41-1.41" />
                <path d="m16.95 7.05 1.41-1.41" />
                <circle cx="12" cy="12" r="4" />
            </svg>
        `
        : `
            <svg viewBox="0 0 24 24" aria-hidden="true">
                <path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8Z" />
            </svg>
        `;
}

function applyTheme(theme, persist = false) {
    const normalized = theme === 'light' ? 'light' : 'dark';
    document.body.classList.toggle('theme-light', normalized === 'light');
    updateThemeToggleLabel(normalized);
    syncAgentWorkbenchSceneBackground();

    if (persist) {
        try {
            localStorage.setItem(THEME_STORAGE_KEY, normalized);
        } catch (error) {
            console.warn(`[Editor ${state.VERSION}] Failed to persist theme:`, error);
        }
    }
}

function initTheme() {
    let savedTheme = 'light';
    try {
        const value = localStorage.getItem(THEME_STORAGE_KEY);
        if (value === 'light' || value === 'dark') {
            savedTheme = value;
        }
    } catch (error) {
        console.warn(`[Editor ${state.VERSION}] Failed to load theme:`, error);
    }
    applyTheme(savedTheme, false);
}

function toggleTheme() {
    const isLight = document.body.classList.contains('theme-light');
    applyTheme(isLight ? 'dark' : 'light', true);
}

function openHelpTipsModal() {
    dom.helpTipsModal?.classList.remove('hidden');
}

function closeHelpTipsModal() {
    dom.helpTipsModal?.classList.add('hidden');
}

function syncExportFlyoutState() {
    dom.exportToolFlyout?.classList.toggle('is-open', Boolean(state.exportFlyoutOpen));
    dom.btnExportFlyout?.classList.toggle('active', Boolean(state.exportFlyoutOpen));
    dom.btnExportFlyout?.setAttribute('aria-expanded', state.exportFlyoutOpen ? 'true' : 'false');
}

function setExportFlyoutOpen(open) {
    state.exportFlyoutOpen = Boolean(open);
    syncExportFlyoutState();
}

function toggleExportFlyout() {
    setExportFlyoutOpen(!state.exportFlyoutOpen);
}

function syncClearScreenState() {
    document.body.classList.toggle('clear-screen-mode', Boolean(state.clearScreenMode));
    document.body.classList.toggle('clear-screen-preview', !state.clearScreenMode && Boolean(state.clearScreenPreview));
    dom.btnClearScreen?.classList.toggle('active', Boolean(state.clearScreenMode));
}

function setClearScreenPreview(active) {
    if (state.clearScreenMode) return;
    state.clearScreenPreview = Boolean(active);
    syncClearScreenState();
}

function setClearScreenMode(active, silent = false) {
    state.clearScreenMode = Boolean(active);
    if (state.clearScreenMode) {
        state.clearScreenPreview = false;
        setExportFlyoutOpen(false);
        setSceneSettingsOpen(false);
        setCameraSettingsOpen(false);
    }
    syncClearScreenState();
    if (!silent) {
        showInfo(`${t('toolbar.clearScreen')}: ${state.clearScreenMode ? t('common.active') : t('common.inactive')}`);
    }
}

function toggleClearScreenMode(silent = false) {
    setClearScreenMode(!state.clearScreenMode, silent);
}

function getInputStep(input) {
    const parsed = Number.parseFloat(input?.step || '');
    return Number.isFinite(parsed) && parsed > 0 ? parsed : 0.001;
}

function getStepPrecision(step) {
    const text = String(step);
    const dot = text.indexOf('.');
    if (dot < 0) return 0;
    return text.length - dot - 1;
}

function setNumberInputValue(input, value, emitInput = false) {
    if (!(input instanceof HTMLInputElement)) return;

    const step = getInputStep(input);
    let next = Number.isFinite(value) ? value : 0;

    const min = Number.parseFloat(input.min || '');
    const max = Number.parseFloat(input.max || '');
    if (Number.isFinite(min)) next = Math.max(min, next);
    if (Number.isFinite(max)) next = Math.min(max, next);

    next = Math.round(next / step) * step;
    const precision = Math.max(3, getStepPrecision(step));
    input.value = next.toFixed(precision);

    if (emitInput) {
        input.dispatchEvent(new Event('input', { bubbles: true }));
    }
}

function stopInputLabelDrag() {
    if (!labelDragState) return;
    if (labelDragState.label instanceof HTMLElement) {
        labelDragState.label.classList.remove('is-dragging');
    }
    labelDragState = null;
    isInputLabelDragging = false;
    document.body.classList.remove('value-dragging');
}

function handleInputLabelDragMove(event) {
    if (!labelDragState) return;
    const { input, startX, startValue, dragStep } = labelDragState;
    if (!(input instanceof HTMLInputElement)) return;

    const deltaX = event.clientX - startX;
    const modifier = event.altKey ? 10 : (event.shiftKey ? 0.1 : 1);
    const nextValue = startValue + deltaX * dragStep * modifier;
    setNumberInputValue(input, nextValue, true);
    event.preventDefault();
}

function setupInputLabelDrag() {
    const labels = document.querySelectorAll('.input-drag-label[data-drag-target]');

    labels.forEach((label) => {
        label.addEventListener('mousedown', (event) => {
            if (event.button !== 0) return;
            const targetId = label.getAttribute('data-drag-target');
            if (!targetId) return;

            const input = document.getElementById(targetId);
            if (!(input instanceof HTMLInputElement) || input.disabled) return;

            const startValue = Number.parseFloat(input.value || '0');
            if (!Number.isFinite(startValue)) return;

            const dragStepRaw = Number.parseFloat(label.getAttribute('data-drag-step') || '');
            const dragStep = Number.isFinite(dragStepRaw) && dragStepRaw > 0
                ? dragStepRaw
                : getInputStep(input);

            labelDragState = {
                label,
                input,
                startX: event.clientX,
                startValue,
                dragStep,
            };
            isInputLabelDragging = true;
            label.classList.add('is-dragging');
            document.body.classList.add('value-dragging');
            event.preventDefault();
        });
    });

    window.addEventListener('mousemove', handleInputLabelDragMove);
    window.addEventListener('mouseup', stopInputLabelDrag);
    window.addEventListener('blur', stopInputLabelDrag);
}

function registerDebugHooks() {
    const hooks = {
        agent: {
            createProgressBlock: createAgentProgressBlock,
            createImageBlock: createAgentImageBlock,
            createViewer3DBlock: createAgentViewer3DBlock,
            openAssistantMessage: openAgentAssistantMessage,
            resetConversation: resetAgentConversation,
            startMockResponse: startMockAgentResponse,
            registerSessionActionHandlers: registerAgentSessionActionHandlers,
            sessions: {
                pickStorageFolder: () => ensureAgentSessionStore().pickStorageFolder(),
                persistNow: () => persistAgentConversationsNow(),
                exportSnapshot: (options) => ensureAgentSessionStore().exportSnapshot(buildAgentConversationSnapshot(), options),
                getSnapshot: () => buildAgentConversationSnapshot(),
                getStatus: () => ensureAgentSessionStore().getStatus(),
            },
        },
        getPreviewMode: () => state.exportMode,
        setPreviewMode: (mode) => setExportMode(mode),
        getDepthScale: () => state.sceneDepthRangeScale,
        setDepthScale: (value) => applySceneDepthRangeScale(value),
        getModelTrackLoopMarkerDebugInfo,
        getModelTracksDomDebugInfo,
        getSidebarLayoutDebugInfo: () => ({
            agentWorkbenchWidth: preferredAgentWorkbenchWidth,
            agentWorkbenchCollapsed: state.agentWorkbenchCollapsed,
            agentWorkflow: state.agentWorkflow,
            leftWidth: dom.leftSidebar?.offsetWidth ?? null,
            rightWidth: dom.rightSidebar?.offsetWidth ?? null,
            leftCompact: dom.leftSidebar?.classList.contains('sidebar-compact') ?? false,
            leftCollapsed: dom.leftSidebar?.classList.contains('sidebar-collapsed') ?? false,
            rightNarrow: dom.rightSidebar?.classList.contains('sidebar-narrow') ?? false,
            rightXNarrow: dom.rightSidebar?.classList.contains('sidebar-xnarrow') ?? false,
            rightVisible: isRightSidebarVisible(),
            centerWidth: dom.centerViewport?.clientWidth ?? null,
            centerViewportRect: dom.centerViewport?.getBoundingClientRect?.() ?? null,
            canvasRect: dom.canvas?.getBoundingClientRect?.() ?? null,
            canvasContainerRect: dom.canvasContainer?.getBoundingClientRect?.() ?? null,
            preferredLeftSidebarWidth,
            preferredRightSidebarWidth,
            centerMinWidth: CENTER_VIEWPORT_MIN_WIDTH,
            recentWidthHistory: sidebarWidthDebugHistory.slice(),
        }),
        rerenderTimeline: () => {
            updateTimelineUI();
            return {
                markers: getModelTrackLoopMarkerDebugInfo(),
                dom: getModelTracksDomDebugInfo(),
            };
        },
        dumpRenderModes: () => {
            const models = app?.getModels?.() || [];
            const rows = models.map((model) => ({
                id: model.id,
                name: model.name,
                type: model.modelType,
                visible: model.visible,
                uiMode: state.exportMode,
                pointCloudMode: model?.modelEntry?.pointCloud?.getRenderMode?.(),
            }));
            console.table(rows);
            return rows;
        },
        getCameraControlDebugSamples: () => cameraControlDebugSamples.slice(),
        clearCameraControlDebugSamples: () => {
            cameraControlDebugSamples = [];
            cameraControlDebugLastDragLogAt = 0;
            return true;
        },
        logCameraControlDebugInfo: (kind = 'manual') => logCameraControlDebug(kind),
        getCameraControlDebugInfo: () => app?.getCameraControlDebugInfo?.() ?? null,
        pickScenePointAtClient: (clientX, clientY) => app?.pickScenePointAtClient?.(clientX, clientY) ?? null,
        probeModelPickAtFocus: (modelId) => app?.probeModelPickAtFocus?.(modelId) ?? null,
        getScenePointPickDebugInfo: (clientX, clientY) => app?.getScenePointPickDebugInfo?.(clientX, clientY) ?? null,
        lookAtScenePointAtClient: (clientX, clientY) => app?.lookAtScenePointFromClient?.(clientX, clientY) ?? false,
        showRawDepthPreview: (source = 'combined') => app?.showRawDepthPreview?.(source) ?? null,
        downloadRawDepth: (source = 'combined', format = 'json') => app?.downloadRawDepth?.(source, format) ?? false,
        getRawDepthFrameInfo: async (source = 'combined') => {
            const frame = await app?.getRawDepthFrame?.(source);
            if (!frame) return null;
            return {
                source: frame.source,
                width: frame.width,
                height: frame.height,
                minDepth: frame.minDepth,
                maxDepth: frame.maxDepth,
                sampleCount: frame.data?.length ?? 0,
            };
        },
    };

    window.__visionaryEditorDebug = hooks;
}

/**
 * 显示加载状态
 */
function showLoading(show, text = t('loading.default'), progress = 0, options = {}) {
    if (dom.loadingOverlay) {
        if (show) {
            dom.loadingOverlay.classList.remove('hidden');
            dom.loadingOverlay.classList.toggle('loading-overlay-passive', options?.passive === true);
            const loadingText = dom.loadingOverlay.querySelector('.loading-text');
            if (loadingText) loadingText.textContent = text;
            if (dom.progressFill) dom.progressFill.style.width = `${progress}%`;
            if (dom.progressText) dom.progressText.textContent = `${Math.round(progress)}%`;
        } else {
            dom.loadingOverlay.classList.remove('loading-overlay-passive');
            dom.loadingOverlay.classList.add('hidden');
        }
    }
}

/**
 * 显示错误信息
 */
function showError(message) {
    console.error(`[Editor ${state.VERSION}] Error:`, message);
    alert(`${t('common.errorPrefix')}: ${message}`);
}

/**
 * 显示信息提示
 */
function showInfo(message) {
    console.log(`[Editor ${state.VERSION}] ${message}`);
}

/**
 * 更新模型统计
 */
function updateModelCount() {
    if (!app || !dom.modelCountBadge) return;
    const models = app.getModels();
    const visibleCount = models.filter(m => m.visible).length;
    const totalCount = models.length;
    dom.modelCountBadge.dataset.modelCount = String(totalCount);
    dom.modelCountBadge.dataset.visibleCount = String(visibleCount);
    syncLeftSidebarCollapsedState();
}

function syncCameraSequenceVisibilityState() {
    if (typeof app?.getCameraSequenceVisible === 'function') {
        const visible = app.getCameraSequenceVisible();
        if (typeof visible === 'boolean') {
            state.cameraSequenceVisible = visible;
        }
    }
    return Boolean(state.cameraSequenceVisible);
}

function setCameraSequenceVisibility(nextVisible, silent = false) {
    const safe = Boolean(nextVisible);
    const ok = app?.setCameraSequenceVisible?.(safe);
    if (ok === false) {
        showError(t('messages.setCameraSequenceVisibilityFailed'));
        return false;
    }
    state.cameraSequenceVisible = safe;
    if (!safe) {
        suspendCameraSequenceDragForHiddenTrajectory();
    } else {
        restoreCameraSequenceDragAfterVisibleTrajectory();
    }
    updateCameraSequenceToggleButton();
    if (!silent) {
        showInfo(`${t('timeline.cameraSequence')}: ${safe ? t('common.visible') : t('common.hidden')}`);
    }
    return true;
}

function clampCameraSequenceDisplayScale(value) {
    const n = Number(value);
    if (!Number.isFinite(n)) return CAMERA_DISPLAY_SCALE_DEFAULT;
    return Math.max(CAMERA_DISPLAY_SCALE_MIN, Math.min(CAMERA_DISPLAY_SCALE_MAX, n));
}

function syncCameraSequenceDisplayScaleControl() {
    if (typeof app?.getCameraSequenceDisplayScale === 'function') {
        const next = app.getCameraSequenceDisplayScale();
        if (Number.isFinite(next)) {
            state.cameraSequenceDisplayScale = clampCameraSequenceDisplayScale(next);
        }
    }
    if (dom.cameraDisplayScale) {
        dom.cameraDisplayScale.value = state.cameraSequenceDisplayScale.toFixed(2);
    }
    if (dom.cameraDisplayScaleValue) {
        dom.cameraDisplayScaleValue.value = state.cameraSequenceDisplayScale.toFixed(2);
    }
}

function setCameraSequenceDisplayScale(value, silent = false) {
    const safe = clampCameraSequenceDisplayScale(value);
    const ok = app?.setCameraSequenceDisplayScale?.(safe);
    if (ok === false) {
        showError(t('messages.setCameraDisplaySizeFailed'));
        return false;
    }
    state.cameraSequenceDisplayScale = safe;
    syncCameraSequenceDisplayScaleControl();
    syncCameraSequenceVisualization();
    localStorage.setItem(CAMERA_DISPLAY_SCALE_STORAGE_KEY, String(safe));
    if (!silent) {
        showInfo(`${t('timeline.size')}: ${safe.toFixed(2)}x`);
    }
    return true;
}

function commitCameraSequenceDisplayScaleFromInput() {
    if (!dom.cameraDisplayScaleValue) return;
    setCameraSequenceDisplayScale(dom.cameraDisplayScaleValue.value, false);
}

function handleCameraSequenceDisplayScaleInputKeydown(e) {
    if (!dom.cameraDisplayScaleValue) return;
    if (e.key === 'Enter') {
        commitCameraSequenceDisplayScaleFromInput();
        dom.cameraDisplayScaleValue.blur();
    }
}

function updateCameraSequenceToggleButton() {
    if (!dom.btnToggleCameraSequence) return;
    const visible = syncCameraSequenceVisibilityState();
    dom.btnToggleCameraSequence.classList.toggle('active', visible);
    const textEl = dom.btnToggleCameraSequence.querySelector('.btn-text');
    if (textEl) {
        textEl.textContent = visible ? t('common.visible') : t('common.hidden');
    } else {
        dom.btnToggleCameraSequence.textContent = visible ? t('common.visible') : t('common.hidden');
    }
    syncCameraSequenceDragButton();
}

/**
 * 更新模型列表 UI
 */
function updateModelList() {
    if (!dom.modelList) return;
    const models = app?.getModels?.() || [];
    updateCameraSequenceToggleButton();

    if (models.length === 0) {
        dom.modelList.innerHTML = '<div class="empty-list">' +
            `<p>${escapeHtml(t('sidebar.emptyTitle'))}</p>` +
            `<p class="empty-hint">${escapeHtml(t('sidebar.emptyHint'))}</p>` +
            '</div>';
    } else {
        dom.modelList.innerHTML = models.map((model) => `
            <div class="model-item ${state.selectedModelId === model.id ? 'selected' : ''}" data-id="${model.id}">
                <span class="model-name">${model.name}</span>
                <span class="model-points">${t('sidebar.pointCount', { count: model.pointCount.toLocaleString() })}</span>
                <button class="model-visibility-btn ${model.visible ? 'active' : ''}" data-id="${model.id}" title="${t('sidebar.toggleVisibility')}">
                    ${model.visible ? t('common.visible') : t('common.hidden')}
                </button>
                <span class="model-remove" data-id="${model.id}" title="${t('sidebar.deleteModel')}">&times;</span>
            </div>
        `).join('');

        // 绑定删除事件
        dom.modelList.querySelectorAll('.model-remove').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const id = btn.dataset.id;
                app.removeModel(id);
                if (state.selectedModelId === id) {
                    closeEditor();
                }
            });
        });

        dom.modelList.querySelectorAll('.model-visibility-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const id = btn.dataset.id;
                const model = app.getModel(id);
                if (!model) return;
                const nextVisible = !model.visible;
                app.setModelVisibility(id, nextVisible);
                updateModelList();
                markWorkspaceDirty('model-visibility');
                showInfo(t('messages.modelVisibility', { state: nextVisible ? t('common.visible') : t('common.hidden') }));
            });
        });

        // 绑定点击选择事件
        dom.modelList.querySelectorAll('.model-item').forEach(item => {
            item.addEventListener('click', () => {
                selectModel(item.dataset.id);
            });
        });
    }

    updateModelCount();
}

/**
 * 选择模型进行编辑
 */
function selectModel(id, options = {}) {
    const syncAppSelection = options.syncApp !== false;
    const allowToggle = options.allowToggle !== false;
    const silent = options.silent === true;
    if (!id) return;
    if (allowToggle && state.selectedModelId === id) {
        closeEditor();
        if (!silent) {
            showInfo(t('messages.modelSelectionCleared'));
        }
        return;
    }
    const model = app.getModel(id);
    if (!model) return;

    const preservedFrame = clampTimelineFrame(state.selectedFrame);
    state.selectedModelId = id;
    state.selectedCameraSequenceFrame = null;
    if (syncAppSelection) {
        syncingSelectedModelSelection = true;
        try {
            app.setSelectedModel?.(id);
        } finally {
            syncingSelectedModelSelection = false;
        }
    }
    syncSelectedCameraSequenceFrameToApp();
    if (state.selectedFrame !== preservedFrame) {
        setTimelineFrame(preservedFrame, { applyPose: false, syncSlider: true });
    }

    // 更新 UI
    if (dom.selectedModelName) dom.selectedModelName.textContent = model.name;
    setModelEditorActive(true);

    // 更新模型列表的选中状态
    dom.modelList.querySelectorAll('.model-item').forEach(item => {
        item.classList.remove('selected');
        if (item.dataset.id === id) {
            item.classList.add('selected');
        }
    });

    // 填充编辑器值
    updateEditorValues(model);
    updateModelAnimationControls(id);
    app.refreshSelectedModelViewportGizmo?.();
    syncViewportGizmoControls();
    updateModelList();
    if (!silent) {
        showInfo(t('messages.selectedModel', { name: model.name }));
    }
}

/**
 * 从编辑器更新模型数据
 */
function updateEditorValues(model) {
    // 位置
    if (dom.posX) dom.posX.value = model.position.x.toFixed(3);
    if (dom.posY) dom.posY.value = model.position.y.toFixed(3);
    if (dom.posZ) dom.posZ.value = model.position.z.toFixed(3);

    // 旋转（转换为角度）
    if (dom.rotX) dom.rotX.value = (model.rotation.x * 180 / Math.PI).toFixed(3);
    if (dom.rotY) dom.rotY.value = (model.rotation.y * 180 / Math.PI).toFixed(3);
    if (dom.rotZ) dom.rotZ.value = (model.rotation.z * 180 / Math.PI).toFixed(3);

    // 缩放
    if (dom.scaleS) dom.scaleS.value = model.scale.toFixed(3);
}

/**
 * 从编辑器更新模型数据
 */
function updateModelFromEditor() {
    if (!state.selectedModelId || !app) return;

    const id = state.selectedModelId;

    // 读取编辑器中的值并更新模型
    const posX = parseFloat(dom.posX?.value || 0);
    const posY = parseFloat(dom.posY?.value || 0);
    const posZ = parseFloat(dom.posZ?.value || 0);
    app.setModelPosition(id, posX, posY, posZ);

    const rotX = parseFloat(dom.rotX?.value || 0) * Math.PI / 180;
    const rotY = parseFloat(dom.rotY?.value || 0) * Math.PI / 180;
    const rotZ = parseFloat(dom.rotZ?.value || 0) * Math.PI / 180;
    app.setModelRotation(id, rotX, rotY, rotZ);

    const scale = parseFloat(dom.scaleS?.value || 1);
    app.setModelScale(id, scale);
    app.refreshSelectedModelViewportGizmo?.();
    markWorkspaceDirty('model-transform');

    if (!isInputLabelDragging) {
        showInfo(t('messages.modelUpdated'));
    }
}

/**
 * 重置模型变换
 */
function resetTransform() {
    if (!state.selectedModelId || !app) return;
    const modelBefore = app.getModel(state.selectedModelId);
    if (modelBefore) {
        const alreadyReset =
            Math.abs(Number(modelBefore.position?.x) || 0) <= 1e-6 &&
            Math.abs(Number(modelBefore.position?.y) || 0) <= 1e-6 &&
            Math.abs(Number(modelBefore.position?.z) || 0) <= 1e-6 &&
            Math.abs(Number(modelBefore.rotation?.x) || 0) <= 1e-6 &&
            Math.abs(Number(modelBefore.rotation?.y) || 0) <= 1e-6 &&
            Math.abs(Number(modelBefore.rotation?.z) || 0) <= 1e-6 &&
            Math.abs((Number(modelBefore.scale) || 1) - 1) <= 1e-6;
        if (alreadyReset) {
            if (modelBefore) {
                updateEditorValues(modelBefore);
            }
            return;
        }
    }
    app.resetModelTransform(state.selectedModelId);
    app.setSelectedModel?.(state.selectedModelId);
    const model = app.getModel(state.selectedModelId);
    if (model) {
        updateEditorValues(model);
    }
    markWorkspaceDirty('reset-model-transform');
    showInfo(t('messages.transformReset'));
}

/**
 * 关闭模型编辑器
 */
function closeEditor() {
    if (dom.selectedModelName) dom.selectedModelName.textContent = t('messages.noModelSelected');
    state.selectedModelId = null;
    syncingSelectedModelSelection = true;
    try {
        app?.setSelectedModel?.(null);
    } finally {
        syncingSelectedModelSelection = false;
    }
    setModelEditorActive(false);
    if (dom.onnxAnimSection) dom.onnxAnimSection.classList.add('inactive');
    syncViewportGizmoControls();
    updateModelList();
}

function getSelectedModelAnimationState() {
    if (!app || !state.selectedModelId) return null;
    return app.getModelAnimationState(state.selectedModelId);
}

function getModelAnimationSpeedValue(model) {
    const raw = Number(model?.modelEntry?.animSpeed ?? model?.animSpeed ?? 1);
    return Number.isFinite(raw) ? raw : 1;
}

function getModelAnimationStartTime(model) {
    const raw = Number(model?.modelEntry?.animStartTime ?? model?.animStartTime ?? 0);
    return Number.isFinite(raw) ? raw : 0;
}

function getModelAnimationEndTime(model) {
    const rawDuration = getModelAnimationDuration(model);
    const fallbackEnd = Number.isFinite(rawDuration) && rawDuration > 0 ? rawDuration : 10;
    const raw = Number(model?.modelEntry?.animEndTime ?? model?.animEndTime ?? fallbackEnd);
    return Number.isFinite(raw) ? raw : fallbackEnd;
}

function getModelAnimationDuration(model) {
    const raw = Number(model?.animDuration ?? model?.modelEntry?.animDuration);
    if (Number.isFinite(raw) && raw > 0) {
        return raw;
    }
    return MODEL_ANIM_DURATION_FALLBACK_SEC;
}

function modelHasTimelineAnimation(model) {
    return Boolean(model?.isDynamic && getModelAnimationDuration(model) > 0);
}

function updateModelAnimationControls(id = state.selectedModelId) {
    if (!app || !id) {
        if (dom.onnxAnimSection) dom.onnxAnimSection.classList.add('inactive');
        if (dom.modelAnimSpeed) {
            dom.modelAnimSpeed.value = speedToSliderValue(1).toFixed(3);
            dom.modelAnimSpeed.disabled = true;
        }
        if (dom.modelAnimSpeedValue) {
            if (document.activeElement !== dom.modelAnimSpeedValue) {
                dom.modelAnimSpeedValue.value = '1.000';
            }
            dom.modelAnimSpeedValue.disabled = true;
        }
        return;
    }

    const anim = app.getModelAnimationState(id);
    if (!anim || !anim.supported) {
        if (dom.onnxAnimSection) dom.onnxAnimSection.classList.add('inactive');
        if (dom.modelAnimSpeed) {
            dom.modelAnimSpeed.value = speedToSliderValue(1).toFixed(3);
            dom.modelAnimSpeed.disabled = true;
        }
        if (dom.modelAnimSpeedValue) {
            if (document.activeElement !== dom.modelAnimSpeedValue) {
                dom.modelAnimSpeedValue.value = '1.000';
            }
            dom.modelAnimSpeedValue.disabled = true;
        }
        return;
    }

    if (dom.onnxAnimSection) dom.onnxAnimSection.classList.remove('inactive');

    const speed = Number(anim.speed || 1);
    if (dom.modelAnimSpeed) {
        dom.modelAnimSpeed.value = speedToSliderValue(speed).toFixed(3);
        dom.modelAnimSpeed.disabled = false;
    }
    if (dom.modelAnimSpeedValue && document.activeElement !== dom.modelAnimSpeedValue) {
        dom.modelAnimSpeedValue.value = speed.toFixed(3);
        dom.modelAnimSpeedValue.disabled = false;
    } else if (dom.modelAnimSpeedValue) {
        dom.modelAnimSpeedValue.disabled = false;
    }
}

function applySelectedModelAnimationSpeed(speed, syncInputText = true) {
    if (!app || !state.selectedModelId) return;
    if (!Number.isFinite(speed)) return;
    app.setModelAnimationSpeed(state.selectedModelId, speed);
    if (dom.modelAnimSpeed) {
        dom.modelAnimSpeed.value = speedToSliderValue(speed).toFixed(3);
    }
    if (syncInputText && dom.modelAnimSpeedValue) {
        dom.modelAnimSpeedValue.value = String(speed);
    }
}

function updateSelectedModelAnimationSpeedFromSlider() {
    if (!dom.modelAnimSpeed) return;
    applySelectedModelAnimationSpeed(sliderValueToSpeed(dom.modelAnimSpeed.value), true);
}

function updateSelectedModelAnimationSpeedFromInput() {
    if (!dom.modelAnimSpeedValue) return;
    const rawValue = dom.modelAnimSpeedValue.value;
    const parsed = extractNumericValue(rawValue);
    if (parsed === null) return;
    applySelectedModelAnimationSpeed(parsed, false);
}

function commitSelectedModelAnimationSpeedFromInput() {
    if (!dom.modelAnimSpeedValue) return;
    const parsed = extractNumericValue(dom.modelAnimSpeedValue.value);
    if (parsed === null) {
        const anim = getSelectedModelAnimationState();
        if (anim && anim.supported) {
            dom.modelAnimSpeedValue.value = Number(anim.speed || 1).toFixed(3);
        } else {
            dom.modelAnimSpeedValue.value = '1.000';
        }
        return;
    }
    applySelectedModelAnimationSpeed(parsed, false);
    dom.modelAnimSpeedValue.value = clampModelAnimationSpeed(parsed).toFixed(3);
}

function handleSelectedModelAnimationSpeedInputKeydown(e) {
    if (!dom.modelAnimSpeedValue) return;
    if (e.key === 'Enter') {
        commitSelectedModelAnimationSpeedFromInput();
        dom.modelAnimSpeedValue.blur();
        return;
    }
    if (e.key !== 'ArrowUp' && e.key !== 'ArrowDown') return;

    e.preventDefault();
    const anim = getSelectedModelAnimationState();
    const fallbackValue = anim && anim.supported ? Number(anim.speed || 1) : 1;
    const direction = e.key === 'ArrowUp' ? 1 : -1;
    const nextValue = nudgeNumericInputValue(
        dom.modelAnimSpeedValue.value,
        MODEL_ANIM_SPEED_STEP,
        fallbackValue,
        direction
    );
    dom.modelAnimSpeedValue.value = nextValue.toFixed(3);
    applySelectedModelAnimationSpeed(nextValue, false);
}

function applyPreviewModeToAllModels(mode) {
    const modeMap = { color: 0, normal: 1, depth: 2 };
    const modeValue = modeMap[mode];
    if (typeof modeValue !== 'number') {
        return false;
    }

    const bridged = app?.setRenderMode?.(mode);
    if (bridged !== undefined) {
        return bridged !== false;
    }

    const models = app?.getModels?.() || [];
    let updated = 0;
    for (const model of models) {
        const fn = model?.modelEntry?.pointCloud?.setRenderMode;
        if (typeof fn === 'function') {
            fn.call(model.modelEntry.pointCloud, modeValue);
            updated += 1;
        }
    }

    console.log(`[Editor ${state.VERSION}] Preview mode fallback applied: ${mode} (${updated} model(s))`);
    return true;
}

/**
 * 设置导出模式
 */
function setExportMode(mode, silent = false) {
    state.exportMode = mode;
    if (dom.modeColor) dom.modeColor.classList.toggle('menu-btn-active', mode === 'color');
    if (dom.modeDepth) dom.modeDepth.classList.toggle('menu-btn-active', mode === 'depth');
    if (dom.modeNormal) dom.modeNormal.classList.toggle('menu-btn-active', mode === 'normal');

    const ok = applyPreviewModeToAllModels(mode);
    if (app && ok === false) {
        showError(t('messages.switchRenderModeFailed', { mode }));
        return;
    }

    const labelMap = {
        color: t('sceneSettings.renderModes.color'),
        depth: t('sceneSettings.renderModes.depth'),
        normal: t('sceneSettings.renderModes.normal'),
    };
    if (!silent) {
        showInfo(t('messages.displayModeSet', { mode: labelMap[mode] || mode }));
    }
}

function getViewportResolution() {
    let width = 0;
    let height = 0;

    const viewportRect = dom.centerViewport?.getBoundingClientRect?.();
    if (viewportRect && viewportRect.width > 1 && viewportRect.height > 1) {
        width = viewportRect.width;
        height = viewportRect.height;
    }

    if ((width <= 1 || height <= 1) && app?.getMeshRenderer) {
        const renderer = app.getMeshRenderer();
        const rendererCanvas = renderer?.domElement;
        if (rendererCanvas) {
            const dpr = Math.max(0.1, Number(renderer.getPixelRatio?.() || window.devicePixelRatio || 1));
            const canvasW = Number(rendererCanvas.width || 0);
            const canvasH = Number(rendererCanvas.height || 0);
            if (canvasW > 1 && canvasH > 1) {
                width = canvasW / dpr;
                height = canvasH / dpr;
            }
        }
    }

    if (width <= 1 || height <= 1) {
        const rect = dom.canvas?.getBoundingClientRect?.();
        width = Number(rect?.width) || Number(dom.canvas?.clientWidth) || Number(dom.canvas?.width) || 1920;
        height = Number(rect?.height) || Number(dom.canvas?.clientHeight) || Number(dom.canvas?.height) || 1080;
    }

    width = Math.round(width);
    height = Math.round(height);
    width = Math.max(2, width - (width % 2));
    height = Math.max(2, height - (height % 2));
    return { width, height };
}

function initPanelWheelScroll() {
    // Use native browser scrolling for side panels.
    // Manual wheel forwarding was interfering with normal scroll behavior.
}

function resolutionToValue(width, height) {
    return `${Math.max(2, Math.round(width))}x${Math.max(2, Math.round(height))}`;
}

function parseResolutionValue(value) {
    const matched = String(value || '').trim().match(/^(\d+)x(\d+)$/);
    if (!matched) return null;
    let width = Number(matched[1]);
    let height = Number(matched[2]);
    if (!Number.isFinite(width) || !Number.isFinite(height)) return null;
    width = Math.max(2, Math.round(width));
    height = Math.max(2, Math.round(height));
    width -= width % 2;
    height -= height % 2;
    return { width, height };
}

function makeEvenExportDimension(value) {
    const rounded = Math.max(2, Math.round(Number(value) || 2));
    return Math.max(2, rounded - (rounded % 2));
}

function deriveResolutionForAspect(baseResolution, aspect) {
    const safeAspect = Number(aspect);
    if (!Number.isFinite(safeAspect) || safeAspect <= 0) {
        return {
            width: makeEvenExportDimension(baseResolution?.width),
            height: makeEvenExportDimension(baseResolution?.height),
        };
    }
    const baseWidth = Math.max(2, Number(baseResolution?.width) || 1920);
    const baseHeight = Math.max(2, Number(baseResolution?.height) || 1080);
    const area = Math.max(4, baseWidth * baseHeight);
    const width = makeEvenExportDimension(Math.sqrt(area * safeAspect));
    const height = makeEvenExportDimension(width / safeAspect);
    return { width, height };
}

function getExportModeLabel(mode) {
    const labels = {
        color: t('modal.exportRenderModes.rgb'),
        depth: t('modal.exportRenderModes.depth'),
        normal: t('modal.exportRenderModes.normal'),
    };
    return labels[mode] || mode;
}

function clampExportFps(value) {
    const numeric = Number(value);
    if (!Number.isFinite(numeric) || numeric <= 0) return null;
    return Math.max(1, Math.min(240, Math.round(numeric)));
}

function clampExportPlaybackSpeed(value) {
    const numeric = Number(value);
    if (!Number.isFinite(numeric) || numeric <= 0) return null;
    return Math.max(0.01, Math.min(100, numeric));
}

function getExportVideoFpsValue() {
    return clampExportFps(dom.exportVideoFps?.value) || Math.max(1, Number(state.timelineFps || EXPORT_FALLBACK_FPS));
}

function getExportVideoSpeedValue() {
    return clampExportPlaybackSpeed(dom.exportVideoSpeed?.value) || Math.max(0.01, Number(state.timelinePlaybackSpeed || 1));
}

function getExportVideoDurationSec(playbackSpeed = getExportVideoSpeedValue()) {
    return Math.max(0, frameToTime(getTimelineTotalFrames())) / Math.max(0.01, Number(playbackSpeed) || 1);
}

function getExportVideoFrameCount(fps = getExportVideoFpsValue(), playbackSpeed = getExportVideoSpeedValue()) {
    return Math.max(1, Math.round(getExportVideoDurationSec(playbackSpeed) * Math.max(1, Number(fps) || 1)) + 1);
}

function updateExportTimelineHint(type) {
    if (!dom.exportTimelineHint) return;
    if (type !== 'video') {
        dom.exportTimelineHint.textContent = t('modal.exportCurrentFrame');
        return;
    }
    const fps = getExportVideoFpsValue();
    const playbackSpeed = getExportVideoSpeedValue();
    const totalFrames = getExportVideoFrameCount(fps, playbackSpeed);
    const duration = getExportVideoDurationSec(playbackSpeed);
    const keyframes = state.keyframes.length;
    dom.exportTimelineHint.textContent = t('modal.exportTimeline', {
        duration: duration.toFixed(3),
        fps,
        frames: totalFrames,
        keyframes,
    });
}

function getSelectedExportAspectOption() {
    return getCameraPreviewAspectOption(dom.exportAspectRatio?.value || state.cameraPreviewAspectId);
}

function buildExportAspectRatioOptions() {
    if (!dom.exportAspectRatio) return;
    const selected = normalizeCameraPreviewAspectId(dom.exportAspectRatio.value || state.cameraPreviewAspectId);
    dom.exportAspectRatio.innerHTML = CAMERA_PREVIEW_ASPECT_OPTIONS
        .map((item) => `<option value="${item.id}">${item.label}</option>`)
        .join('');
    dom.exportAspectRatio.value = selected;
}

function syncExportVideoTimingControls() {
    if (dom.exportVideoSpeed) {
        dom.exportVideoSpeed.value = String(Number(state.timelinePlaybackSpeed || 1));
        if (dom.exportVideoSpeed.value !== String(Number(state.timelinePlaybackSpeed || 1))) {
            dom.exportVideoSpeed.value = '1.0';
        }
    }
    if (dom.exportVideoFps) {
        dom.exportVideoFps.value = String(Math.max(1, Number(state.timelineFps || EXPORT_FALLBACK_FPS)));
        if (dom.exportVideoFps.value !== String(Math.max(1, Number(state.timelineFps || EXPORT_FALLBACK_FPS)))) {
            dom.exportVideoFps.value = String(EXPORT_FALLBACK_FPS);
        }
    }
}

function buildExportResolutionOptions(aspectOption = null) {
    if (!dom.exportResolution) return;

    const options = [];
    const seen = new Set();
    const selectedValue = dom.exportResolution.value;
    const current = aspectOption
        ? deriveResolutionForAspect(getViewportResolution(), aspectOption.aspect)
        : getViewportResolution();
    const currentValue = resolutionToValue(current.width, current.height);
    options.push({ value: currentValue, label: `${current.width} x ${current.height} (${t('common.currentWindow')})` });
    seen.add(currentValue);

    for (const preset of EXPORT_PRESET_RESOLUTIONS) {
        const resolution = aspectOption
            ? deriveResolutionForAspect(preset, aspectOption.aspect)
            : preset;
        const value = resolutionToValue(resolution.width, resolution.height);
        if (seen.has(value)) continue;
        seen.add(value);
        const presetSuffix = /\(([^)]+)\)/.exec(preset.label)?.[1];
        const label = aspectOption
            ? `${resolution.width} x ${resolution.height} (${presetSuffix || aspectOption.label})`
            : preset.label;
        options.push({ value, label });
    }

    dom.exportResolution.innerHTML = options
        .map((opt) => `<option value="${opt.value}">${opt.label}</option>`)
        .join('');
    dom.exportResolution.value = seen.has(selectedValue) ? selectedValue : currentValue;
}

function setExportProgress(percent, visible = pendingExportType === 'video') {
    const safePercent = Math.max(0, Math.min(100, Number(percent) || 0));
    dom.exportProgress?.classList.toggle('hidden', !visible);
    dom.exportProgress?.setAttribute('aria-hidden', visible ? 'false' : 'true');
    if (dom.exportProgressFill) {
        dom.exportProgressFill.style.width = `${safePercent}%`;
    }
    if (dom.exportProgressText) {
        dom.exportProgressText.textContent = safePercent > 0
            ? t('modal.exportProgressValue', { percent: Math.round(safePercent) })
            : t('modal.exportProgressIdle');
    }
}

function setExportModalBusy(busy) {
    if (dom.exportResolution) dom.exportResolution.disabled = busy;
    if (dom.exportAspectRatio) dom.exportAspectRatio.disabled = busy;
    if (dom.exportVideoSpeed) dom.exportVideoSpeed.disabled = busy;
    if (dom.exportVideoFps) dom.exportVideoFps.disabled = busy;
    if (dom.exportMode) dom.exportMode.disabled = busy;
    if (dom.exportFov) dom.exportFov.disabled = busy;
    if (dom.exportCancel) dom.exportCancel.disabled = busy;
    if (dom.exportConfirm) dom.exportConfirm.disabled = busy;
    if (dom.exportConfirm) dom.exportConfirm.textContent = busy ? t('common.rendering') : t('common.render');
}

function closeExportModal() {
    if (!dom.exportModal) return;
    if (isExporting) return;
    dom.exportModal.classList.add('hidden');
    pendingExportType = null;
}

function openExportModal(type) {
    if (!dom.exportModal || !dom.exportModalTitle) {
        showError(t('messages.exportDialogNotInitialized'));
        return;
    }
    if (!app) {
        showError(t('messages.editorNotInitializedExport'));
        return;
    }

    pendingExportType = type === 'video' ? 'video' : 'image';
    const isVideo = pendingExportType === 'video';
    dom.exportAspectRatioRow?.classList.toggle('hidden', !isVideo);
    if (dom.exportAspectRatioRow) dom.exportAspectRatioRow.hidden = !isVideo;
    dom.exportVideoSpeedRow?.classList.toggle('hidden', !isVideo);
    if (dom.exportVideoSpeedRow) dom.exportVideoSpeedRow.hidden = !isVideo;
    dom.exportVideoFpsRow?.classList.toggle('hidden', !isVideo);
    if (dom.exportVideoFpsRow) dom.exportVideoFpsRow.hidden = !isVideo;
    dom.exportFovRow?.classList.toggle('hidden', isVideo);
    if (dom.exportFovRow) dom.exportFovRow.hidden = isVideo;
    if (isVideo) {
        buildExportAspectRatioOptions();
        syncExportVideoTimingControls();
        buildExportResolutionOptions(getSelectedExportAspectOption());
    } else {
        buildExportResolutionOptions();
    }

    if (dom.exportMode) {
        dom.exportMode.value = state.exportMode;
    }
    if (!isVideo && dom.exportFov) {
        dom.exportFov.value = Number(state.sceneCameraFov || 45).toFixed(3);
    }

    dom.exportModalTitle.textContent = pendingExportType === 'video' ? t('modal.exportVideoTitle') : t('modal.exportImageTitle');
    updateExportTimelineHint(pendingExportType);
    setExportProgress(0, isVideo);
    setExportModalBusy(false);
    dom.exportModal.classList.remove('hidden');
}

function readExportOptionsFromModal() {
    const resolution = parseResolutionValue(dom.exportResolution?.value || '');
    if (!resolution) {
        throw new Error(t('messages.invalidResolution'));
    }

    const mode = String(dom.exportMode?.value || state.exportMode);
    if (!['color', 'depth', 'normal'].includes(mode)) {
        throw new Error(t('messages.invalidRenderMode', { mode }));
    }

    const isVideo = pendingExportType === 'video';
    const fov = isVideo ? null : clampSceneFov(dom.exportFov?.value);
    if (!isVideo && fov === null) {
        throw new Error(t('messages.invalidFov'));
    }
    const fps = isVideo ? clampExportFps(dom.exportVideoFps?.value) : null;
    if (isVideo && fps === null) {
        throw new Error(t('messages.invalidFps'));
    }
    const playbackSpeed = isVideo ? clampExportPlaybackSpeed(dom.exportVideoSpeed?.value) : null;
    if (isVideo && playbackSpeed === null) {
        throw new Error(t('messages.invalidPlaybackSpeed'));
    }

    const aspectOption = isVideo ? getSelectedExportAspectOption() : null;
    return {
        resolution,
        mode,
        fov,
        fps,
        playbackSpeed,
        aspectId: aspectOption?.id || null,
        aspect: aspectOption?.aspect || (resolution.width / resolution.height),
    };
}

async function ensureImageExportApiLoaded() {
    if (imageExportApi) return imageExportApi;
    imageExportApi = await import('../src/exportMedia/RecordingCamera.js');
    return imageExportApi;
}

async function ensureVideoExportApiLoaded() {
    if (videoExportApi) return videoExportApi;
    const [cameraApi, videoApi] = await Promise.all([
        import('../src/exportMedia/RecordingCamera.js'),
        import('../src/exportMedia/exportVideo.js'),
    ]);
    videoExportApi = {
        RecordingCamera: cameraApi.RecordingCamera,
        exportVideoWithRecordingCamera: videoApi.exportVideoWithRecordingCamera,
    };
    return videoExportApi;
}

function applySnapshotToRecordingCamera(recordingCamera, snapshot, fovOverride, aspectOverride = null) {
    if (!recordingCamera?.camera || !snapshot) return false;
    recordingCamera.camera.position.set(snapshot.position.x, snapshot.position.y, snapshot.position.z);
    recordingCamera.camera.quaternion.set(
        snapshot.quaternion.x,
        snapshot.quaternion.y,
        snapshot.quaternion.z,
        snapshot.quaternion.w
    );
    const safeFov = clampSceneFov(fovOverride);
    recordingCamera.camera.fov = safeFov ?? Number(snapshot.fovDegrees || 45);
    recordingCamera.camera.near = Math.max(1e-4, Number(snapshot.near || 0.01));
    recordingCamera.camera.far = Math.max(recordingCamera.camera.near + 1e-3, Number(snapshot.far || 2000));
    recordingCamera.camera.aspect = Math.max(1e-6, Number(aspectOverride || snapshot.aspect || 1));
    recordingCamera.camera.updateProjectionMatrix();
    recordingCamera.camera.updateMatrixWorld(true);
    return true;
}

function invertUnitQuaternion(q) {
    return {
        x: -(Number(q?.x) || 0),
        y: -(Number(q?.y) || 0),
        z: -(Number(q?.z) || 0),
        w: Number(q?.w) || 1,
    };
}

function rotateVectorByQuaternion(vector, quaternion) {
    const x = Number(vector?.x) || 0;
    const y = Number(vector?.y) || 0;
    const z = Number(vector?.z) || 0;
    const qx = Number(quaternion?.x) || 0;
    const qy = Number(quaternion?.y) || 0;
    const qz = Number(quaternion?.z) || 0;
    const qw = Number(quaternion?.w) || 1;

    const ix = (qw * x) + (qy * z) - (qz * y);
    const iy = (qw * y) + (qz * x) - (qx * z);
    const iz = (qw * z) + (qx * y) - (qy * x);
    const iw = -(qx * x) - (qy * y) - (qz * z);

    return {
        x: (ix * qw) + (iw * -qx) + (iy * -qz) - (iz * -qy),
        y: (iy * qw) + (iw * -qy) + (iz * -qx) - (ix * -qz),
        z: (iz * qw) + (iw * -qz) + (ix * -qy) - (iy * -qx),
    };
}

function applyTimelinePoseToRecordingCamera(recordingCamera, pose, options = {}) {
    if (!recordingCamera?.camera || !pose?.position || !pose?.rotation) return false;
    const px = Number(pose.position.x) || 0;
    const py = Number(pose.position.y) || 0;
    const pz = Number(pose.position.z) || 0;
    recordingCamera.camera.position.set(
        px,
        py,
        pz
    );
    const c2w = invertUnitQuaternion(pose.rotation);
    const forward = rotateVectorByQuaternion({ x: 0, y: 0, z: 1 }, c2w);
    const up = rotateVectorByQuaternion({ x: 0, y: 1, z: 0 }, c2w);
    recordingCamera.camera.up.set(up.x, up.y, up.z);
    recordingCamera.camera.lookAt(
        px + forward.x,
        py + forward.y,
        pz + forward.z
    );
    const fallbackSnapshot = options.fallbackSnapshot || {};
    recordingCamera.camera.fov = clampSceneFov(pose.fovDegrees)
        ?? clampSceneFov(fallbackSnapshot.fovDegrees)
        ?? 45;
    recordingCamera.camera.near = Math.max(1e-4, Number(fallbackSnapshot.near || 0.01));
    recordingCamera.camera.far = Math.max(recordingCamera.camera.near + 1e-3, Number(fallbackSnapshot.far || 2000));
    recordingCamera.camera.aspect = Math.max(1e-6, Number(options.aspect || fallbackSnapshot.aspect || 1));
    recordingCamera.camera.updateProjectionMatrix();
    recordingCamera.camera.updateMatrixWorld(true);
    return true;
}

async function withTemporaryPreviewMode(mode, fn) {
    const previousMode = state.exportMode;
    const changed = mode !== previousMode;
    if (changed) {
        const ok = applyPreviewModeToAllModels(mode);
        if (app && ok === false) {
            throw new Error(t('messages.switchRenderModeFailed', { mode }));
        }
    }
    try {
        return await fn();
    } finally {
        if (changed) {
            applyPreviewModeToAllModels(previousMode);
        }
    }
}

function buildExportTimelineController(recordingCamera, options = {}) {
    const callbacks = new Set();
    const sourceMaxFrame = Math.max(0, getTimelineTotalFrames());
    const sourceDurationSec = Math.max(0, frameToTime(sourceMaxFrame));
    const exportFps = Math.max(1, Number(options.fps || state.timelineFps || EXPORT_FALLBACK_FPS));
    const playbackSpeed = Math.max(0.01, Number(options.playbackSpeed || 1));
    const exportDurationSec = sourceDurationSec / playbackSpeed;
    const totalFrames = Math.max(1, Math.round(exportDurationSec * exportFps) + 1);
    let currentIndex = 0;

    return {
        getTotalFrames() {
            return totalFrames;
        },
        getFrameRate() {
            return exportFps;
        },
        getCurrentIndex() {
            return currentIndex;
        },
        getLastKeyframeIndex() {
            if (!Array.isArray(state.keyframes) || state.keyframes.length === 0) return -1;
            let max = -1;
            for (const keyframe of state.keyframes) {
                const frame = Number(keyframe?.frame);
                if (Number.isFinite(frame)) {
                    max = Math.max(max, Math.round(frame));
                }
            }
            return Math.min(totalFrames - 1, Math.max(-1, Math.round((frameToTime(max) / playbackSpeed) * exportFps)));
        },
        async setFrameIndex(frameIndex) {
            const safeFrame = Math.max(0, Math.min(totalFrames - 1, Math.round(Number(frameIndex) || 0)));
            currentIndex = safeFrame;
            const sourceTimeSec = Math.min(sourceDurationSec, (safeFrame / exportFps) * playbackSpeed);
            const pose = interpolateCameraPoseAt(sourceTimeSec);
            if (pose) {
                applyTimelinePoseToRecordingCamera(recordingCamera, pose, {
                    aspect: options.aspect,
                    fallbackSnapshot: options.fallbackSnapshot,
                });
            }
            app?.setGlobalTimelineTime?.(sourceTimeSec);
            app?.setGlobalTimelineFrame?.(Math.max(0, Math.min(sourceMaxFrame, timeToFrame(sourceTimeSec))));
            for (const callback of Array.from(callbacks)) {
                await callback();
            }
            options.onProgress?.(((safeFrame + 1) / totalFrames) * 100);
        },
        registerFrameUpdateCallback(callback) {
            callbacks.add(callback);
            return () => callbacks.delete(callback);
        },
    };
}

async function downloadCanvasAsPng(canvas, filePrefix = 'Image') {
    const blob = await new Promise((resolve, reject) => {
        canvas.toBlob((value) => {
            if (value) {
                resolve(value);
                return;
            }
            reject(new Error(t('messages.imageExportDataUnavailable')));
        }, 'image/png');
    });

    const timestamp = new Date().toISOString().slice(0, 19).replace(/:/g, '-');
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `${filePrefix}-${timestamp}.png`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(link.href);
}

async function exportImageWithOfficialPipeline(options) {
    const { RecordingCamera } = await ensureImageExportApiLoaded();
    const renderer = app?.getMeshRenderer?.();
    const scene = app?.getMeshScene?.();
    const fusedRenderer = app?.getFusedRenderer?.();
    const cameraSnapshot = app?.getRenderCameraSnapshot?.();

    if (!renderer || !scene || !cameraSnapshot) {
        throw new Error(t('messages.renderContextUnavailableImage'));
    }

    const recordingCamera = new RecordingCamera(
        `editor_export_image_${Date.now().toString(36)}`,
        options.resolution.width,
        options.resolution.height,
        options.fov,
        false,
        'EditorExportImage'
    );

    try {
        recordingCamera.setScenePreviewMode?.(options.mode);
        recordingCamera.setSceneDepthRangeScale?.(state.sceneDepthRangeScale);
        applySnapshotToRecordingCamera(recordingCamera, cameraSnapshot, options.fov);

        const gaussianModels = fusedRenderer?.getGaussianModels?.() || [];
        const initialized = await recordingCamera.initializeRenderer(renderer, scene, gaussianModels);
        if (!initialized) {
            throw new Error(t('messages.recordingCameraInitFailed'));
        }

        recordingCamera.setScenePreviewMode?.(options.mode);
        recordingCamera.setSceneDepthRangeScale?.(state.sceneDepthRangeScale);
        const renderedCanvas = await recordingCamera.renderToCanvas(scene);
        await downloadCanvasAsPng(renderedCanvas, `Image-${getExportModeLabel(options.mode)}`);
    } finally {
        recordingCamera.dispose?.();
    }
}

async function exportVideoWithOfficialPipeline(options) {
    if (!Array.isArray(state.keyframes) || state.keyframes.length === 0) {
        throw new Error(t('messages.addKeyframeBeforeVideoExport'));
    }

    const { RecordingCamera, exportVideoWithRecordingCamera } = await ensureVideoExportApiLoaded();
    const renderer = app?.getMeshRenderer?.();
    const scene = app?.getMeshScene?.();
    const fusedRenderer = app?.getFusedRenderer?.();
    const cameraSnapshot = app?.getRenderCameraSnapshot?.();

    if (!renderer || !scene || !cameraSnapshot) {
        throw new Error(t('messages.renderContextUnavailableVideo'));
    }

    const recordingCamera = new RecordingCamera(
        `editor_export_video_${Date.now().toString(36)}`,
        options.resolution.width,
        options.resolution.height,
        clampSceneFov(cameraSnapshot.fovDegrees) || 45,
        false,
        'EditorExportVideo'
    );

    const restoreFrame = Number(state.selectedFrame || 0);
    const restoreTime = Number(state.currentTime || frameToTime(restoreFrame));
    const wasPlaying = Boolean(state.isPlaying);
    if (state.isPlaying) {
        stopTimelinePlayback(false);
    }

    try {
        recordingCamera.setScenePreviewMode?.(options.mode);
        recordingCamera.setSceneDepthRangeScale?.(state.sceneDepthRangeScale);
        const startPose = interpolateCameraPoseAt(frameToTime(0));
        if (startPose) {
            applyTimelinePoseToRecordingCamera(recordingCamera, startPose, {
                aspect: options.aspect,
                fallbackSnapshot: cameraSnapshot,
            });
        } else {
            applySnapshotToRecordingCamera(recordingCamera, cameraSnapshot, null, options.aspect);
        }

        const timelineController = buildExportTimelineController(recordingCamera, {
            aspect: options.aspect,
            fps: options.fps,
            playbackSpeed: options.playbackSpeed,
            fallbackSnapshot: cameraSnapshot,
            onProgress: (percent) => {
                setExportProgress(percent, true);
                showLoading(true, t('loading.renderingVideo'), percent, { passive: true });
            },
        });
        (window).startTime = Date.now();
        await exportVideoWithRecordingCamera(
            renderer,
            scene,
            recordingCamera,
            Math.max(0.1, getExportVideoDurationSec(options.playbackSpeed)),
            Math.max(1, Number(options.fps || state.timelineFps || EXPORT_FALLBACK_FPS)),
            options.resolution,
            fusedRenderer || undefined,
            false,
            {},
            timelineController,
            getExportModeLabel(options.mode)
        );
    } finally {
        app?.setGlobalTimelineTime?.(restoreTime);
        app?.setGlobalTimelineFrame?.(restoreFrame);
        setTimelineFrame(restoreFrame, { applyPose: true, syncSlider: true, syncGizmo: false });
        if (wasPlaying) {
            playCameraAnimation();
        }
        recordingCamera.dispose?.();
    }
}

async function onConfirmExportModal() {
    if (!pendingExportType || isExporting) return;
    if (!app) {
        showError(t('messages.editorNotInitializedExport'));
        return;
    }

    let options;
    try {
        options = readExportOptionsFromModal();
    } catch (error) {
        showError(error?.message || String(error));
        return;
    }

    isExporting = true;
    setExportModalBusy(true);
    if (pendingExportType === 'video') {
        setExportProgress(0, true);
        showLoading(true, t('loading.renderingVideo'), 0, { passive: true });
    } else {
        showLoading(true, t('loading.renderingImage'), 10);
    }

    try {
        await withTemporaryPreviewMode(options.mode, async () => {
            if (pendingExportType === 'image') {
                await exportImageWithOfficialPipeline(options);
                showInfo(t('messages.imageExported', {
                    width: options.resolution.width,
                    height: options.resolution.height,
                    mode: getExportModeLabel(options.mode),
                }));
                return;
            }
            await exportVideoWithOfficialPipeline(options);
            showInfo(t('messages.videoExported', {
                width: options.resolution.width,
                height: options.resolution.height,
                mode: getExportModeLabel(options.mode),
            }));
        });
        isExporting = false;
        setExportModalBusy(false);
        showLoading(false);
        closeExportModal();
    } catch (error) {
        console.error(`[Editor ${state.VERSION}] 导出失败:`, error);
        isExporting = false;
        setExportModalBusy(false);
        showLoading(false);
        showError(t('messages.exportFailed', { message: error?.message || String(error) }));
    }
}

function isHttpUrl(value) {
    return typeof value === 'string' && (/^https?:\/\//i.test(value) || value.startsWith('/'));
}

function sanitizeFileName(name) {
    return String(name || 'model').replace(/[\\/:*?"<>|]/g, '_').trim() || 'model';
}

function toHexFromBgColor(bgColor) {
    if (!Array.isArray(bgColor) || bgColor.length < 3) return null;
    const toHex = (v) => {
        const n = Math.max(0, Math.min(255, Math.round(Number(v) * 255)));
        return n.toString(16).padStart(2, '0').toUpperCase();
    };
    return `#${toHex(bgColor[0])}${toHex(bgColor[1])}${toHex(bgColor[2])}`;
}

function inferAssetType(pathOrName = '') {
    const text = String(pathOrName).toLowerCase();
    if (text.endsWith('.onnx')) return 'onnx';
    if (text.endsWith('.glb')) return 'glb';
    if (text.endsWith('.gltf')) return 'gltf';
    if (text.endsWith('.obj')) return 'obj';
    if (text.endsWith('.fbx')) return 'fbx';
    if (text.endsWith('.stl')) return 'stl';
    if (text.endsWith('.spz')) return 'spz';
    if (text.endsWith('.ksplat')) return 'ksplat';
    if (text.endsWith('.splat')) return 'splat';
    if (text.endsWith('.sog')) return 'sog';
    if (text.endsWith('.compressed.ply')) return 'compressed.ply';
    if (text.endsWith('.ply')) return 'ply';
    return 'ply';
}

function extractFileName(pathOrUrl) {
    if (!pathOrUrl) return 'model';
    try {
        const parsed = new URL(pathOrUrl);
        const seg = parsed.pathname.split('/').filter(Boolean).pop();
        return seg || 'model';
    } catch (_) {
        const normalized = String(pathOrUrl).replace(/\\/g, '/');
        const seg = normalized.split('/').filter(Boolean).pop();
        return seg || 'model';
    }
}

async function readFileByRelativePath(rootHandle, relativePath) {
    const normalized = String(relativePath || '').replace(/\\/g, '/');
    const parts = normalized.split('/').filter(Boolean);
    if (parts.length === 0) {
        throw new Error(t('messages.invalidAssetPath', { path: relativePath }));
    }

    const fileName = parts.pop();
    let current = rootHandle;
    for (const dirName of parts) {
        current = await current.getDirectoryHandle(dirName);
    }

    const fileHandle = await current.getFileHandle(fileName);
    return fileHandle.getFile();
}

function parseSceneAssets(raw) {
    if (Array.isArray(raw?.assets)) {
        return raw.assets;
    }

    if (Array.isArray(raw?.scenes)) {
        const out = [];
        raw.scenes.forEach((scene) => {
            const models = Array.isArray(scene?.models) ? scene.models : [];
            models.forEach((m) => {
                if (!m || (m.typeTag && m.typeTag !== 'fileModel')) return;
                const source = m.path || m.assetName || m.url || m.source || m?.extras?.urlFallback || m.name;
                if (!source) return;

                let transform = m.transform;
                if (!transform && Array.isArray(m.trs)) {
                    transform = {
                        position: Array.isArray(m.trs[0]) ? m.trs[0] : undefined,
                        rotationEulerRad: Array.isArray(m.trs[1]) ? m.trs[1] : undefined,
                        scale: Array.isArray(m.trs[2]) ? m.trs[2] : undefined,
                    };
                }

                out.push({
                    name: m.name || extractFileName(source),
                    type: m.type || inferAssetType(source),
                    path: source,
                    dynamic: Boolean(m.dynamic),
                    transform,
                    extras: m.extras,
                });
            });
        });
        return out;
    }

    return [];
}

function parseSceneTimeline(raw) {
    const timeline = raw?.timeline;
    if (!timeline || typeof timeline !== 'object') return null;
    return timeline;
}

function clearWorkspaceAutosaveTimer() {
    if (!workspaceAutosaveTimer) return;
    window.clearTimeout(workspaceAutosaveTimer);
    workspaceAutosaveTimer = 0;
}

function isWorkspaceMaterializedAssetPath(sourcePath) {
    return typeof sourcePath === 'string' && /^assets\//i.test(sourcePath);
}

function isServerMaterializedAssetPath(sourcePath) {
    return typeof sourcePath === 'string' && /^assets\/[0-9a-f]{32,}\.[^/]+$/i.test(sourcePath);
}

function isServerAgentAssetPath(sourcePath) {
    return typeof sourcePath === 'string' && /^agent_history\//i.test(sourcePath);
}

function collectServerSceneAssetPaths(rawScene) {
    const assetPaths = new Set();
    const assets = Array.isArray(rawScene?.assets) ? rawScene.assets : [];
    assets.forEach((asset) => {
        const relativePath = String(asset?.path || asset?.extras?.visionaryRelativePath || '').trim();
        if (isServerMaterializedAssetPath(relativePath)) {
            assetPaths.add(relativePath);
        }
    });
    return assetPaths;
}

function collectServerAgentAssetPaths(agentHistory) {
    const assetPaths = new Set();
    const assetIndex = Array.isArray(agentHistory?.asset_index) ? agentHistory.asset_index : [];
    assetIndex.forEach((entry) => {
        const relativePath = String(entry?.path || '').trim();
        if (isServerAgentAssetPath(relativePath)) {
            assetPaths.add(relativePath);
        }
    });
    return assetPaths;
}

function updateActiveServerProjectAssetCaches({ scene, agentHistory } = {}) {
    if (scene !== undefined) {
        state.projectSession.activeProjectSceneAssetPaths = collectServerSceneAssetPaths(scene);
    }
    if (agentHistory !== undefined) {
        state.projectSession.activeProjectAgentAssetPaths = collectServerAgentAssetPaths(agentHistory);
    }
}

function clearActiveServerProjectAssetCaches() {
    state.projectSession.activeProjectSceneAssetPaths = new Set();
    state.projectSession.activeProjectAgentAssetPaths = new Set();
}

async function resolveModelAssetBytes(model, sourcePath) {
    const sourceFile = model?.sourceFile;
    if (sourceFile instanceof Blob) {
        return sourceFile.arrayBuffer();
    }
    if (sceneFs.isWorkspaceWritable?.() && isWorkspaceMaterializedAssetPath(sourcePath)) {
        const workspaceHandle = sceneFs.getWorkspaceHandle?.();
        if (workspaceHandle) {
            const file = await readFileByRelativePath(workspaceHandle, sourcePath);
            return file.arrayBuffer();
        }
    }
    return null;
}

function syncWorkspaceStateFromSceneFS(overrides = {}) {
    const workspaceInfo = sceneFs.getWorkspaceInfo();
    state.workspace = {
        ...state.workspace,
        name: workspaceInfo.name,
        writable: workspaceInfo.writable,
        ...overrides,
    };
    syncAgentSessionStoreWorkspaceBinding();
    updateWorkspaceStatusIndicator();
    return workspaceInfo;
}

function isWorkspaceSelectionCancelledError(error) {
    const message = String(error?.message || error || '');
    return error?.name === 'AbortError' || /cancelled by user/i.test(message);
}

function scheduleWorkspaceAutosave() {
    clearWorkspaceAutosaveTimer();
    if (isServerProjectSessionActive()) {
        workspaceAutosaveTimer = window.setTimeout(() => {
            workspaceAutosaveTimer = 0;
            void saveServerProjectToCurrentProject({ silent: true });
        }, 1500);
        return;
    }
    if (!isLocalWorkspaceSyncMode()) return;
    if (!state.workspace?.writable) return;
    workspaceAutosaveTimer = window.setTimeout(() => {
        workspaceAutosaveTimer = 0;
        const includeAssetPayloads = hasPendingWorkspaceAssetMaterialization();
        void saveWorkspaceToCurrentWorkspace({
            requestWorkspaceIfNeeded: false,
            silent: true,
            includeAssetPayloads,
        });
    }, 1500);
}

function markWorkspaceDirty(reason = 'scene-change') {
    if (isServerProjectSessionActive()) {
        state.workspace = {
            ...state.workspace,
            dirty: true,
            saving: false,
            error: null,
            lastDirtyReason: reason,
            syncStatus: 'dirty',
        };
        updateWorkspaceStatusIndicator();
        scheduleWorkspaceAutosave();
        return;
    }

    syncWorkspaceStateFromSceneFS({
        dirty: true,
        error: null,
        lastDirtyReason: reason,
        syncStatus: state.workspace?.writable ? 'dirty' : 'no-workspace',
    });
    scheduleWorkspaceAutosave();
}

async function ensureWritableWorkspaceSelected() {
    if (sceneFs.isWorkspaceWritable()) {
        return syncWorkspaceStateFromSceneFS();
    }
    await sceneFs.openWorkspaceReadWrite();
    return syncWorkspaceStateFromSceneFS({
        mode: 'local',
        dirty: false,
        saving: false,
        error: null,
        syncStatus: 'clean',
    });
}

function hasPendingWorkspaceAssetMaterialization() {
    if (state.forceFullWorkspaceAssetMigration) {
        return true;
    }
    if (!app?.getModels) return false;
    const models = app.getModels();
    return models.some((model) => {
        const sourceFile = model?.sourceFile;
        const sourcePath = String(model?.sourcePath || sourceFile?.name || model?.name || '');
        return sourceFile instanceof Blob || (sceneFs.isWorkspaceWritable?.() && isWorkspaceMaterializedAssetPath(sourcePath));
    });
}

async function buildSceneWorkspaceSnapshot(options = {}) {
    const {
        includeAssetPayloads = true,
        showProgress = includeAssetPayloads,
        allowWorkspaceMaterializedAssetReuse = true,
        allowServerMaterializedAssetReuse = false,
    } = options;
    const models = app.getModels();
    const assets = [];
    const assetInputs = [];
    let skipped = 0;

    const bgHex = normalizeHexColor(state.sceneBackgroundHex) || '#707070';
    const r = Number.parseInt(bgHex.slice(1, 3), 16) / 255;
    const g = Number.parseInt(bgHex.slice(3, 5), 16) / 255;
    const b = Number.parseInt(bgHex.slice(5, 7), 16) / 255;

    for (let i = 0; i < models.length; i++) {
        const model = models[i];
        const sourceFile = model.sourceFile;
        const sourcePath = String(model.sourcePath || sourceFile?.name || model.name || `model-${i + 1}`);
        const candidateName = sanitizeFileName(extractFileName(sourcePath));
        const shouldReuseWorkspaceMaterializedPath = allowWorkspaceMaterializedAssetReuse && isWorkspaceMaterializedAssetPath(sourcePath);
        const shouldReuseServerMaterializedPath = allowServerMaterializedAssetReuse && isServerMaterializedAssetPath(sourcePath);
        const canProvideAssetPayload = sourceFile instanceof Blob || (sceneFs.isWorkspaceWritable?.() && isWorkspaceMaterializedAssetPath(sourcePath));
        const shouldMaterializeAsset = includeAssetPayloads
            && canProvideAssetPayload
            && !shouldReuseWorkspaceMaterializedPath
            && !shouldReuseServerMaterializedPath;
        if (showProgress && shouldMaterializeAsset) {
            showLoading(
                true,
                t('loading.savingAssets', { current: i + 1, total: models.length }),
                (i / Math.max(1, models.length)) * 90,
                { passive: true },
            );
        }
        const asset = {
            name: candidateName || `asset-${i + 1}`,
            type: model.modelType || inferAssetType(candidateName || sourcePath),
            path: sourcePath,
            visible: model.visible !== false,
        };

        if ((asset.type === 'onnx' || asset.type === 'glb' || asset.type === 'gltf') && modelHasTimelineAnimation(model)) {
            asset.dynamic = true;
            asset.animation = {
                speed: Number(getModelAnimationSpeedValue(model)),
                startTime: Number(getModelAnimationStartTime(model)),
                endTime: Number(getModelAnimationEndTime(model)),
            };
        }

        const position = [model.position.x || 0, model.position.y || 0, model.position.z || 0];
        const rotationEulerRad = [model.rotation.x || 0, model.rotation.y || 0, model.rotation.z || 0];
        const scale = Number(model.scale || 1);
        const scaleVec = [scale, scale, scale];
        const hasTransform = (
            position[0] !== 0 || position[1] !== 0 || position[2] !== 0 ||
            rotationEulerRad[0] !== 0 || rotationEulerRad[1] !== 0 || rotationEulerRad[2] !== 0 ||
            scale !== 1
        );
        if (hasTransform) {
            asset.transform = { position, rotationEulerRad, scale: scaleVec };
        }

        if (shouldMaterializeAsset) {
            const assetBytes = await resolveModelAssetBytes(model, sourcePath);
            if (assetBytes) {
                assetInputs.push({
                    sourcePath,
                    fileName: candidateName || sourceFile?.name || candidateName,
                    content: assetBytes,
                });
            } else {
                skipped++;
            }
        } else if (!sourcePath) {
            skipped++;
        }

        assets.push(asset);
    }

    return {
        skipped,
        assetInputs,
        manifest: {
            version: 2,
            meta: {
                app: 'WebGaussianJS',
                createdAt: new Date().toISOString(),
                unit: 'meter',
            },
            env: {
                bgColor: [r, g, b, 1],
                skyPresetId: state.sceneSkyPresetId || 'custom',
                gaussianScale: 1,
                depthRangeScale: Number(state.sceneDepthRangeScale || 1.0),
                cameraFov: Number(state.sceneCameraFov || 45.0),
                cameraPose: captureCurrentCameraPose(),
                cameraMode: String(dom.cameraMode?.value || state.cameraMode || 'orbit'),
                renderMode: state.exportMode || 'color',
                cameraSequenceVisible: Boolean(state.cameraSequenceVisible),
                cameraDisplayScale: Number(state.cameraSequenceDisplayScale || CAMERA_DISPLAY_SCALE_DEFAULT),
                cameraPreviewAspectId: state.cameraPreviewAspectId || '16:9',
                cameraPreviewPreset: captureCameraPreviewWorkspacePreset(),
            },
            timeline: {
                fps: Number(state.timelineFps || 24),
                durationSec: Number(state.timelineDurationSec || TIMELINE_MIN_DURATION_SEC),
                playbackSpeed: Number(state.timelinePlaybackSpeed || 1),
                interpolationMode: legacyInterpolation.mode,
                interpolationParam: Number(legacyInterpolation.param ?? 0.5),
                positionInterpolationMode: resolveCameraPositionInterpolationModeFromTension(state.cameraCatmullTension),
                rotationInterpolationMode: resolveCameraRotationInterpolationModeFromStrength(state.cameraRotationStrength),
                timingInterpolationMode: resolveCameraTimingInterpolationModeFromStrength(state.cameraEaseStrength),
                positionInterpolationStrength: Number(state.cameraCatmullTension ?? 1),
                rotationInterpolationStrength: Number(state.cameraRotationStrength ?? 0),
                timingInterpolationStrength: Number(state.cameraEaseStrength ?? 0),
                catmullTension: Number(state.cameraCatmullTension ?? 1),
                easeStrength: Number(state.cameraEaseStrength ?? 0),
                selectedFrame: Number(state.selectedFrame || 0),
                currentTime: Number(state.currentTime || 0),
                isLooping: Boolean(state.isLooping),
                keyframes: (Array.isArray(state.keyframes) ? state.keyframes : []).map((keyframe) => ({
                    frame: Number(keyframe.frame || 0),
                    time: Number(keyframe.time || 0),
                    camera: {
                        position: {
                            x: Number(keyframe.camera?.position?.x || 0),
                            y: Number(keyframe.camera?.position?.y || 0),
                            z: Number(keyframe.camera?.position?.z || 0),
                        },
                        rotation: {
                            x: Number(keyframe.camera?.rotation?.x || 0),
                            y: Number(keyframe.camera?.rotation?.y || 0),
                            z: Number(keyframe.camera?.rotation?.z || 0),
                            w: Number(keyframe.camera?.rotation?.w || 1),
                        },
                    },
                })),
                fovKeyframes: (Array.isArray(state.cameraFovKeyframes) ? state.cameraFovKeyframes : []).map((keyframe) => ({
                    frame: Number(keyframe.frame || 0),
                    time: Number(keyframe.time || 0),
                    fovDegrees: Number(keyframe.fovDegrees || getFallbackTimelineCameraFov()),
                })),
            },
            assets,
        },
    };
}

function applyWorkspaceAssetWritesToLoadedModels(assetWrites = []) {
    if (!app || !Array.isArray(assetWrites) || assetWrites.length === 0) return;
    const models = app.getModels?.() || [];
    assetWrites.forEach((assetWrite) => {
        if (!assetWrite?.sourcePath || !assetWrite?.targetPath) return;
        models.forEach((model) => {
            if (String(model?.sourcePath || '') !== String(assetWrite.sourcePath)) return;
            model.sourcePath = assetWrite.targetPath;
        });
    });
}

async function computeAssetContentHashHex(content) {
    const bytes = content instanceof ArrayBuffer
        ? new Uint8Array(content)
        : (content instanceof Uint8Array ? content : new Uint8Array(content || []));
    const digest = await crypto.subtle.digest('SHA-256', bytes);
    return Array.from(new Uint8Array(digest)).map((value) => value.toString(16).padStart(2, '0')).join('');
}

function buildServerAssetRelativePath(hashHex, fileName) {
    const extension = String(extractFileName(fileName || '') || '')
        .split('.')
        .pop()
        ?.trim()
        ?.toLowerCase();
    return extension && extension !== String(fileName || '').trim().toLowerCase()
        ? `assets/${hashHex}.${extension}`
        : `assets/${hashHex}.bin`;
}

async function uploadServerProjectAssets({ user, projectId, assetInputs = [], existingAssetPaths = new Set() } = {}) {
    if (!user || !projectId || !Array.isArray(assetInputs) || assetInputs.length === 0) {
        return [];
    }
    const uploaded = [];
    for (const asset of assetInputs) {
        const fileName = String(asset?.fileName || asset?.sourcePath || 'asset.bin');
        const content = asset?.content instanceof ArrayBuffer
            ? asset.content
            : (asset?.content instanceof Uint8Array ? asset.content : new Uint8Array(asset?.content || []));
        const hashHex = await computeAssetContentHashHex(content);
        const relativePath = buildServerAssetRelativePath(hashHex, fileName);
        if (existingAssetPaths instanceof Set && existingAssetPaths.has(relativePath)) {
            console.debug('[ProjectSync] uploadServerProjectAssets:file:skip-known', {
                user,
                projectId,
                sourcePath: asset?.sourcePath || '',
                targetPath: relativePath,
                bytes: content.byteLength,
            });
            uploaded.push({
                sourcePath: asset.sourcePath,
                targetPath: relativePath,
                hash: hashHex,
                skipped: true,
            });
            continue;
        }
        console.debug('[ProjectSync] uploadServerProjectAssets:file:start', {
            user,
            projectId,
            sourcePath: asset?.sourcePath || '',
            targetPath: relativePath,
            bytes: content.byteLength,
        });
        await projectApi.writeAsset({
            user,
            projectId,
            relativePath,
            content,
        });
        console.debug('[ProjectSync] uploadServerProjectAssets:file:complete', {
            user,
            projectId,
            sourcePath: asset?.sourcePath || '',
            targetPath: relativePath,
            bytes: content.byteLength,
        });
        uploaded.push({
            sourcePath: asset.sourcePath,
            targetPath: relativePath,
            hash: hashHex,
            skipped: false,
        });
    }
    return uploaded;
}

async function uploadServerAgentHistoryAssets({ user, projectId, assetPayloads = [], existingAssetPaths = new Set() } = {}) {
    if (!user || !projectId || !Array.isArray(assetPayloads) || assetPayloads.length === 0) {
        return [];
    }
    const uploaded = [];
    for (const asset of assetPayloads) {
        const relativePath = String(asset?.path || '').trim();
        const content = asset?.content instanceof Uint8Array
            ? asset.content
            : (asset?.content instanceof ArrayBuffer ? new Uint8Array(asset.content) : null);
        if (!relativePath || !content || content.byteLength <= 0) {
            continue;
        }
        if (existingAssetPaths instanceof Set && existingAssetPaths.has(relativePath)) {
            console.debug('[ProjectSync] uploadServerAgentHistoryAssets:file:skip-known', {
                user,
                projectId,
                targetPath: relativePath,
                bytes: content.byteLength,
            });
            uploaded.push({
                path: relativePath,
                bytes: content.byteLength,
                skipped: true,
            });
            continue;
        }
        console.debug('[ProjectSync] uploadServerAgentHistoryAssets:file:start', {
            user,
            projectId,
            targetPath: relativePath,
            bytes: content.byteLength,
        });
        const result = await projectApi.writeAsset({
            user,
            projectId,
            relativePath,
            content,
        });
        console.debug('[ProjectSync] uploadServerAgentHistoryAssets:file:complete', {
            user,
            projectId,
            targetPath: result?.path || relativePath,
            bytes: Number(result?.bytes || content.byteLength),
            skipped: Boolean(result?.skipped),
        });
        uploaded.push({
            path: result?.path || relativePath,
            bytes: Number(result?.bytes || content.byteLength),
            skipped: Boolean(result?.skipped),
        });
    }
    return uploaded;
}

function buildServerProjectSceneSnapshot(manifest, assetWrites = []) {
    if (!manifest || !Array.isArray(manifest.assets) || !Array.isArray(assetWrites) || assetWrites.length === 0) {
        return manifest;
    }
    const nextManifest = JSON.parse(JSON.stringify(manifest));
    nextManifest.assets = nextManifest.assets.map((asset) => {
        const matched = assetWrites.find((item) => String(item.sourcePath || '') === String(asset.path || ''));
        if (!matched?.targetPath) {
            return asset;
        }
        return {
            ...asset,
            path: matched.targetPath,
        };
    });
    return nextManifest;
}

function restoreServerProjectModelSourcePaths(sceneAssets = []) {
    const models = app.getModels?.() || [];
    if (!Array.isArray(sceneAssets) || sceneAssets.length === 0 || models.length === 0) {
        return;
    }

    const unusedAssets = [...sceneAssets];
    models.forEach((model) => {
        const currentSourcePath = String(model?.sourcePath || '');
        let assetIndex = unusedAssets.findIndex((asset) => String(asset?.path || '') === currentSourcePath);
        if (assetIndex < 0) {
            assetIndex = unusedAssets.findIndex((asset) => String(asset?.name || '') === String(model?.name || ''));
        }
        if (assetIndex < 0) {
            return;
        }
        const matchedAsset = unusedAssets.splice(assetIndex, 1)[0];
        if (typeof matchedAsset?.path === 'string' && /^assets\//i.test(matchedAsset.path)) {
            model.sourcePath = matchedAsset.path;
        }
    });
}

function buildServerSceneAssetUrls(rawScene, user, projectId) {
    if (!rawScene || !Array.isArray(rawScene.assets)) {
        return rawScene;
    }
    const scene = JSON.parse(JSON.stringify(rawScene));
    scene.assets = scene.assets.map((asset) => {
        const relativePath = String(asset?.path || '');
        if (!/^assets\//i.test(relativePath)) {
            return asset;
        }
        return {
            ...asset,
            path: projectApi.getAssetUrl(user, projectId, relativePath),
            extras: {
                ...(asset?.extras || {}),
                visionaryRelativePath: relativePath,
            },
        };
    });
    return scene;
}

async function saveWorkspaceToCurrentWorkspace(options = {}) {
    const { requestWorkspaceIfNeeded = false, silent = false, includeAssetPayloads = true } = options;
    if (!app) return false;

    if (workspaceSaveInFlight) {
        workspaceSaveQueued = true;
        return workspaceSaveInFlight;
    }

    if (!sceneFs.isWorkspaceWritable()) {
        if (!requestWorkspaceIfNeeded) {
            return false;
        }
        await ensureWritableWorkspaceSelected();
    }

    clearWorkspaceAutosaveTimer();
    syncWorkspaceStateFromSceneFS({
        saving: true,
        error: null,
    });

    workspaceSaveInFlight = (async () => {
        try {
            const forceFullAssetMigration = Boolean(state.forceFullWorkspaceAssetMigration);
            console.debug('[WorkspaceSave] saveWorkspaceToCurrentWorkspace:start', {
                includeAssetPayloads,
                forceFullAssetMigration,
                silent,
            });
            const { manifest, assetInputs, skipped } = await buildSceneWorkspaceSnapshot({
                includeAssetPayloads,
                allowWorkspaceMaterializedAssetReuse: !forceFullAssetMigration,
            });
            const saveResult = await sceneFs.saveWorkspaceSnapshot(manifest, { assets: assetInputs });
            await persistAgentConversationsNow();
            applyWorkspaceAssetWritesToLoadedModels(saveResult?.assetWrites || []);
            state.forceFullWorkspaceAssetMigration = false;
            showLoading(false);
            const latestWorkspaceInfo = syncWorkspaceStateFromSceneFS({
                name: sceneFs.getWorkspaceInfo().name,
                writable: sceneFs.getWorkspaceInfo().writable,
                mode: 'local',
                dirty: false,
                saving: false,
                lastSavedAt: Date.now(),
                error: null,
                syncStatus: 'clean',
            });
            if (!silent) {
                showInfo(t('messages.sceneSavedToWorkspace', {
                    name: latestWorkspaceInfo.name || 'workspace',
                    count: manifest.assets.length,
                    skipped: skipped ? t('messages.sceneSavedSkippedAssets', { count: skipped }) : '',
                }));
            }
            console.debug('[WorkspaceSave] saveWorkspaceToCurrentWorkspace:complete', {
                assetCount: manifest.assets.length,
                stagedAssetCount: assetInputs.length,
                skippedModels: skipped || 0,
            });
            return true;
        } catch (error) {
            showLoading(false);
            console.debug('[WorkspaceSave] saveWorkspaceToCurrentWorkspace:error', {
                error: error?.message || String(error),
            });
            syncWorkspaceStateFromSceneFS({
                mode: 'local',
                dirty: true,
                saving: false,
                error: error?.message || String(error),
                syncStatus: state.workspace?.writable ? 'dirty' : 'error',
            });
            if (!silent || !isWorkspaceSelectionCancelledError(error)) {
                throw error;
            }
            return false;
        } finally {
            workspaceSaveInFlight = null;
            if (workspaceSaveQueued) {
                workspaceSaveQueued = false;
                scheduleWorkspaceAutosave();
            }
        }
    })();

    return workspaceSaveInFlight;
}

async function saveServerProjectToCurrentProject(options = {}) {
    const { silent = false } = options;
    if (!isServerProjectSessionActive()) {
        return false;
    }

    if (serverProjectAutosaveInFlight) {
        serverProjectAutosaveQueued = true;
        return serverProjectAutosaveInFlight;
    }

    clearWorkspaceAutosaveTimer();
    state.workspace = {
        ...state.workspace,
        saving: true,
        agentSaving: true,
        error: null,
        agentError: null,
        syncStatus: 'saving',
    };
    updateWorkspaceStatusIndicator();

    serverProjectAutosaveInFlight = (async () => {
        try {
            const forceFullAssetMigration = Boolean(state.forceFullServerAssetMigration);
            console.debug('[ProjectSync] saveServerProjectToCurrentProject:start', {
                forceFullAssetMigration,
                user: state.projectSession.user,
                projectId: state.projectSession.activeProjectId,
                silent,
            });
            const { manifest, assetInputs } = await buildSceneWorkspaceSnapshot({
                includeAssetPayloads: true,
                showProgress: false,
                allowWorkspaceMaterializedAssetReuse: false,
                allowServerMaterializedAssetReuse: !forceFullAssetMigration,
            });
            const agentExport = await buildPersistableAgentConversationExport({
                includeAssets: true,
                includeAssetPayloads: true,
            });
            const assetWrites = await uploadServerProjectAssets({
                user: state.projectSession.user,
                projectId: state.projectSession.activeProjectId,
                assetInputs,
                existingAssetPaths: state.projectSession.activeProjectSceneAssetPaths,
            });
            await uploadServerAgentHistoryAssets({
                user: state.projectSession.user,
                projectId: state.projectSession.activeProjectId,
                assetPayloads: agentExport.assetPayloads,
                existingAssetPaths: state.projectSession.activeProjectAgentAssetPaths,
            });
            const nextScene = buildServerProjectSceneSnapshot(manifest, assetWrites);
            await projectApi.saveScene({
                user: state.projectSession.user,
                projectId: state.projectSession.activeProjectId,
                scene: nextScene,
            });
            console.debug('[ProjectSync] saveServerProjectToCurrentProject:file:complete', {
                file: 'scene.json',
                user: state.projectSession.user,
                projectId: state.projectSession.activeProjectId,
                assetCount: manifest.assets.length,
            });
            await projectApi.saveAgentHistory({
                user: state.projectSession.user,
                projectId: state.projectSession.activeProjectId,
                agentHistory: agentExport.snapshot,
            });
            updateActiveServerProjectAssetCaches({
                scene: nextScene,
                agentHistory: agentExport.snapshot,
            });
            console.debug('[ProjectSync] saveServerProjectToCurrentProject:file:complete', {
                file: 'agent_history.json',
                user: state.projectSession.user,
                projectId: state.projectSession.activeProjectId,
            });
            applyWorkspaceAssetWritesToLoadedModels(assetWrites);
            state.forceFullServerAssetMigration = false;
            state.workspace = {
                ...state.workspace,
                dirty: false,
                saving: false,
                agentDirty: false,
                agentSaving: false,
                error: null,
                agentError: null,
                lastSavedAt: Date.now(),
                agentLastSavedAt: Date.now(),
                syncStatus: 'clean',
            };
            updateWorkspaceStatusIndicator();
            if (!silent) {
                showInfo(t('projectSession.projectSynced', {
                    name: state.projectSession.activeProjectName || state.projectSession.activeProjectId,
                }));
            }
            console.debug('[ProjectSync] saveServerProjectToCurrentProject:complete', {
                user: state.projectSession.user,
                projectId: state.projectSession.activeProjectId,
                uploadedAssetCount: assetWrites.length,
                uploadedAgentAssetCount: Array.isArray(agentExport.assetPayloads) ? agentExport.assetPayloads.length : 0,
            });
            return true;
        } catch (error) {
            console.debug('[ProjectSync] saveServerProjectToCurrentProject:error', {
                user: state.projectSession.user,
                projectId: state.projectSession.activeProjectId,
                error: error?.message || String(error),
            });
            state.workspace = {
                ...state.workspace,
                dirty: true,
                saving: false,
                agentDirty: true,
                agentSaving: false,
                error: error?.message || String(error),
                agentError: error?.message || String(error),
                syncStatus: 'error',
            };
            updateWorkspaceStatusIndicator();
            if (!silent) {
                showError(error?.message || String(error));
            }
            return false;
        } finally {
            serverProjectAutosaveInFlight = null;
            if (serverProjectAutosaveQueued) {
                serverProjectAutosaveQueued = false;
                scheduleWorkspaceAutosave();
            }
        }
    })();

    return serverProjectAutosaveInFlight;
}

/**
 * 导出项目（一次性写入本地文件夹，不绑定当前同步目录）
 */
async function saveScene() {
    if (!app) {
        showError(t('messages.editorNotInitializedExportProject'));
        return;
    }

    try {
        const exportRoot = await window.showDirectoryPicker({
            mode: 'readwrite',
        });
        const exportSceneFs = new SceneFS();
        exportSceneFs.attachWorkspace(exportRoot, 'readwrite');
        showLoading(true, t('projectSession.exportingProject'), 30);
        console.debug('[ProjectExport] saveScene:start', {
            exportRoot: exportRoot.name || '',
        });
        const { manifest, assetInputs } = await buildSceneWorkspaceSnapshot({
            includeAssetPayloads: true,
            showProgress: true,
            allowWorkspaceMaterializedAssetReuse: false,
        });
        const agentExport = await buildPersistableAgentConversationExport({
            includeAssets: true,
            includeAssetPayloads: true,
        });
        await exportSceneFs.saveWorkspaceSnapshot(manifest, { assets: assetInputs });
        for (const asset of agentExport.assetPayloads || []) {
            console.debug('[ProjectExport] saveScene:file:start', {
                file: asset.path,
                bytes: asset.content?.byteLength ?? 0,
            });
            await exportSceneFs.writeBinaryToRoot(asset.path, asset.content);
            console.debug('[ProjectExport] saveScene:file:complete', {
                file: asset.path,
                bytes: asset.content?.byteLength ?? 0,
            });
        }
        console.debug('[ProjectExport] saveScene:file:start', {
            file: 'agent_history.json',
        });
        await exportSceneFs.writeJsonToRoot('agent_history.json', agentExport.snapshot);
        console.debug('[ProjectExport] saveScene:file:complete', {
            file: 'agent_history.json',
        });
        showLoading(false);
        showInfo(t('projectSession.projectExported', {
            name: exportRoot.name || t('projectSession.folderFallback'),
        }));
        console.debug('[ProjectExport] saveScene:complete', {
            exportRoot: exportRoot.name || '',
            assetCount: manifest.assets.length,
            agentAssetCount: Array.isArray(agentExport.assetPayloads) ? agentExport.assetPayloads.length : 0,
        });
    } catch (error) {
        showLoading(false);
        console.debug('[ProjectExport] saveScene:error', {
            error: error?.message || String(error),
        });
        if (isWorkspaceSelectionCancelledError(error)) {
            showInfo(t('projectSession.exportCancelled'));
            return;
        }
        console.error(`[Editor ${state.VERSION}] saveScene failed:`, error);
        showError(`${t('projectSession.exportFailed')}: ${error?.message || String(error)}`);
    }
}

async function openSceneWorkspace() {
    if (!app) {
        showError(t('messages.editorNotInitializedLoadScene'));
        return null;
    }
    return pickLocalSceneFolder({ silentCancel: true });
}

/**
 * 加载场景（Visionary 原生流程：从文件夹读取 scene.json + 资源文件）
 */
async function loadScene() {
    if (!app) {
        showError(t('messages.editorNotInitializedLoadScene'));
        return;
    }

    try {
        const folderHandle = await openSceneWorkspace();
        if (!folderHandle) {
            return;
        }
        const sceneHandle = await folderHandle.getFileHandle('scene.json');
        const sceneFile = await sceneHandle.getFile();
        const raw = JSON.parse(await sceneFile.text());
        const assets = parseSceneAssets(raw);
        const timeline = parseSceneTimeline(raw);
        // Browsers do not expose the absolute local path from showDirectoryPicker(),
        // so the demo trigger is keyed by the chosen folder name.
        const demoSceneActive = isDemoSceneFolder(folderHandle?.name);

        if (!Array.isArray(assets) || assets.length === 0) {
            throw new Error(t('messages.emptySceneAssets'));
        }

        if (app.getModels().length > 0) {
            const ok = confirm(t('messages.loadSceneClearConfirm'));
            if (!ok) return;
        }

        app.clearAllModels();
        resetDemoSceneState();
        stopTimelinePlayback(false);
        state.keyframes = [];
        state.cameraFovKeyframes = [];
        state.currentKeyframeIndex = -1;
        state.selectedFrame = 0;
        state.selectedCameraSequenceFrame = null;
        state.currentTime = 0;
        updateTimelineUI();
        syncCameraSequenceVisualization();
        closeEditor();
        applyCameraPreviewWorkspacePreset(null, false);

        const envBgHex = toHexFromBgColor(raw?.env?.bgColor);
        if (raw?.env?.skyPresetId && raw.env.skyPresetId !== 'custom') {
            applySkyPreset(raw.env.skyPresetId);
        } else if (envBgHex) {
            applySceneBackgroundHex(envBgHex, 'custom', false);
        }
        if (Number.isFinite(raw?.env?.depthRangeScale)) {
            applySceneDepthRangeScale(raw.env.depthRangeScale, true);
        }
        if (Number.isFinite(raw?.env?.cameraFov)) {
            applySceneCameraFov(raw.env.cameraFov, true, false);
        }
        if (raw?.env?.cameraPose) {
            app.setCameraPose?.(raw.env.cameraPose);
        }
        if (typeof raw?.env?.cameraMode === 'string') {
            state.cameraMode = raw.env.cameraMode;
            dom.cameraMode && (dom.cameraMode.value = raw.env.cameraMode);
            app.setCameraMode?.(raw.env.cameraMode);
        }
        if (typeof raw?.env?.renderMode === 'string') {
            setExportMode(raw.env.renderMode, true);
        }
        if (typeof raw?.env?.cameraSequenceVisible === 'boolean') {
            setCameraSequenceVisibility(raw.env.cameraSequenceVisible, true);
        }
        if (Number.isFinite(Number(raw?.env?.cameraDisplayScale))) {
            setCameraSequenceDisplayScale(Number(raw.env.cameraDisplayScale), true);
        }
        if (typeof raw?.env?.cameraPreviewAspectId === 'string') {
            applyCameraPreviewAspect(raw.env.cameraPreviewAspectId, true);
        }
        if (raw?.env?.cameraPreviewPreset && typeof raw.env.cameraPreviewPreset === 'object') {
            applyCameraPreviewWorkspacePreset(raw.env.cameraPreviewPreset, false);
        }

        let loaded = 0;
        let failed = 0;
        const demoLoadedModels = [];

        for (let i = 0; i < assets.length; i++) {
            const asset = assets[i];
            showLoading(true, t('loading.loadingSceneAssets', { current: i + 1, total: assets.length }), ((i + 1) / assets.length) * 100);
            try {
                let file = null;
                const sourcePath = asset.path || '';

                if (sourcePath && !isHttpUrl(sourcePath)) {
                    file = await readFileByRelativePath(folderHandle, sourcePath);
                } else if (isHttpUrl(sourcePath)) {
                    const response = await fetch(sourcePath);
                    if (!response.ok) throw new Error(t('messages.urlAssetLoadFailed', { status: response.status }));
                    const blob = await response.blob();
                    const fileName = sanitizeFileName(asset.name || extractFileName(sourcePath));
                    file = new File([blob], fileName, { type: blob.type || '' });
                } else if (isHttpUrl(asset?.extras?.urlFallback)) {
                    const response = await fetch(asset.extras.urlFallback);
                    if (!response.ok) throw new Error(t('messages.fallbackUrlAssetLoadFailed', { status: response.status }));
                    const blob = await response.blob();
                    const fileName = sanitizeFileName(asset.name || extractFileName(asset.extras.urlFallback));
                    file = new File([blob], fileName, { type: blob.type || '' });
                } else {
                    throw new Error(t('messages.missingAssetPath', { name: asset?.name || `#${i + 1}` }));
                }

                const targetName = sanitizeFileName(asset.name || file.name || extractFileName(sourcePath));
                const fileForLoad = (file.name === targetName)
                    ? file
                    : new File([file], targetName, { type: file.type || '', lastModified: file.lastModified || Date.now() });

                const loadedModel = await app.loadModel(fileForLoad, { sourcePath: sourcePath || targetName });
                if (!loadedModel) {
                    throw new Error(t('messages.loadModelFailed', { name: targetName }));
                }
                applyPreviewModeToAllModels(state.exportMode);

                const t = asset.transform;
                if (t?.position && Array.isArray(t.position)) {
                    app.setModelPosition(loadedModel.id, Number(t.position[0] || 0), Number(t.position[1] || 0), Number(t.position[2] || 0));
                }
                if (t?.rotationEulerRad && Array.isArray(t.rotationEulerRad)) {
                    app.setModelRotation(loadedModel.id, Number(t.rotationEulerRad[0] || 0), Number(t.rotationEulerRad[1] || 0), Number(t.rotationEulerRad[2] || 0));
                }
                if (t?.scale && Array.isArray(t.scale)) {
                    const sx = Number(t.scale[0] || 1);
                    const sy = Number(t.scale[1] || sx);
                    const sz = Number(t.scale[2] || sx);
                    const uniformScale = (Math.abs(sx - sy) < 1e-6 && Math.abs(sy - sz) < 1e-6)
                        ? sx
                        : (sx + sy + sz) / 3;
                    app.setModelScale(loadedModel.id, uniformScale);
                }
                if (typeof asset.visible === 'boolean') {
                    app.setModelVisibility?.(loadedModel.id, asset.visible);
                }
                if ((asset.type === 'onnx' || asset.type === 'glb' || asset.type === 'gltf') && asset.dynamic && asset.animation) {
                    if (Number.isFinite(asset.animation.speed)) {
                        app.setModelAnimationSpeed?.(loadedModel.id, Number(asset.animation.speed));
                    }
                    const startTime = Number(asset.animation.startTime);
                    const endTime = Number(asset.animation.endTime);
                    if (Number.isFinite(startTime) && Number.isFinite(endTime)) {
                        app.setModelAnimTimeBounds?.(loadedModel.id, startTime, endTime);
                    }
                }
                if (demoSceneActive) {
                    demoLoadedModels.push({
                        id: loadedModel.id,
                        name: loadedModel.name || asset.name || targetName,
                    });
                    app.setModelVisibility?.(loadedModel.id, false);
                }

                loaded++;
            } catch (assetError) {
                failed++;
                console.warn(`[Editor ${state.VERSION}] 资产加载失败:`, asset, assetError);
            }
        }

        let loadedTimelineKeyframes = [];
        if (timeline) {
            if (Number.isFinite(timeline.durationSec)) {
                state.timelineDurationSec = Math.max(TIMELINE_MIN_DURATION_SEC, Number(timeline.durationSec));
            }
            if (
                timeline.positionInterpolationStrength !== undefined
                || timeline.rotationInterpolationStrength !== undefined
                || timeline.timingInterpolationStrength !== undefined
                ||
                timeline.positionInterpolationMode
                || timeline.rotationInterpolationMode
                || timeline.timingInterpolationMode
                || timeline.catmullTension !== undefined
                || timeline.easeStrength !== undefined
            ) {
                applyCameraInterpolationSettings({
                    positionStrength: timeline.positionInterpolationStrength,
                    rotationStrength: timeline.rotationInterpolationStrength,
                    timingStrength: timeline.timingInterpolationStrength,
                    positionMode: timeline.positionInterpolationMode,
                    rotationMode: timeline.rotationInterpolationMode,
                    timingMode: timeline.timingInterpolationMode,
                    catmullTension: timeline.catmullTension,
                    easeStrength: timeline.easeStrength,
                }, { syncVisualization: false });
            } else if (typeof timeline.interpolationMode === 'string') {
                applyCameraInterpolationSettings(
                    resolveCameraInterpolationStateFromLegacy(timeline.interpolationMode, timeline.interpolationParam),
                    { syncVisualization: false }
                );
            } else {
                applyCameraInterpolationSettings({
                    positionMode: CAMERA_POSITION_INTERPOLATION_LINEAR,
                    rotationMode: CAMERA_ROTATION_INTERPOLATION_SLERP,
                    timingMode: CAMERA_TIMING_INTERPOLATION_LINEAR,
                }, { syncVisualization: false });
            }
            if (Number.isFinite(timeline.playbackSpeed)) {
                state.timelinePlaybackSpeed = Number(timeline.playbackSpeed);
                if (dom.timelineSpeed) {
                    dom.timelineSpeed.value = String(state.timelinePlaybackSpeed);
                }
            }
            if (typeof timeline.isLooping === 'boolean') {
                state.isLooping = timeline.isLooping;
                dom.btnLoopCamera?.classList.toggle('active', state.isLooping);
            }
            if (Number.isFinite(timeline.fps)) {
                state.timelineFps = Number(timeline.fps);
                if (dom.timelineFps) {
                    dom.timelineFps.value = String(state.timelineFps);
                }
            }
            loadedTimelineKeyframes = Array.isArray(timeline.keyframes)
                ? timeline.keyframes
                    .map((item) => {
                        const time = Number(item?.time);
                        const frameRaw = Number(item?.frame);
                        const frame = Number.isFinite(frameRaw)
                            ? Math.round(frameRaw)
                            : timeToFrame(Number.isFinite(time) ? time : 0);
                        const camera = item?.camera;
                        if (!camera?.position || !camera?.rotation) return null;
                        return {
                            frame,
                            time: frameToTime(frame),
                            camera: {
                                position: {
                                    x: Number(camera.position.x) || 0,
                                    y: Number(camera.position.y) || 0,
                                    z: Number(camera.position.z) || 0,
                                },
                                rotation: {
                                    x: Number(camera.rotation.x) || 0,
                                    y: Number(camera.rotation.y) || 0,
                                    z: Number(camera.rotation.z) || 0,
                                    w: Number(camera.rotation.w) || 1,
                                },
                            },
                        };
                    })
                    .filter(Boolean)
                    .sort((a, b) => a.frame - b.frame)
                : [];
            const loadedTimelineFovKeyframes = Array.isArray(timeline.fovKeyframes)
                ? timeline.fovKeyframes
                    .map((item) => {
                        const time = Number(item?.time);
                        const frameRaw = Number(item?.frame);
                        const frame = Number.isFinite(frameRaw)
                            ? Math.round(frameRaw)
                            : timeToFrame(Number.isFinite(time) ? time : 0);
                        const fovDegrees = clampSceneFov(item?.fovDegrees);
                        if (fovDegrees === null) return null;
                        return {
                            frame,
                            time: frameToTime(frame),
                            fovDegrees,
                        };
                    })
                    .filter(Boolean)
                    .sort((a, b) => a.frame - b.frame)
                : loadedTimelineKeyframes
                    .map((item) => {
                        const fovDegrees = clampSceneFov(item?.camera?.fovDegrees);
                        if (fovDegrees === null) return null;
                        return {
                            frame: Number(item.frame) || 0,
                            time: Number(item.time) || 0,
                            fovDegrees,
                        };
                    })
                    .filter(Boolean)
                    .sort((a, b) => a.frame - b.frame);

            state.selectedCameraSequenceFrame = null;
            const selectedFrame = Number.isFinite(Number(timeline.selectedFrame))
                ? Number(timeline.selectedFrame)
                : timeToFrame(Number(timeline.currentTime) || 0);
            state.keyframes = demoSceneActive ? [] : loadedTimelineKeyframes;
            state.cameraFovKeyframes = demoSceneActive ? [] : loadedTimelineFovKeyframes;
            setTimelineFrame(demoSceneActive ? 0 : selectedFrame, { applyPose: true, syncSlider: true });
            updateTimelineUI();
            syncCameraSequenceVisualization();
        } else {
            applyCameraInterpolationSettings({
                positionMode: CAMERA_POSITION_INTERPOLATION_LINEAR,
                rotationMode: CAMERA_ROTATION_INTERPOLATION_SLERP,
                timingMode: CAMERA_TIMING_INTERPOLATION_LINEAR,
            }, { syncVisualization: false });
        }

        if (demoSceneActive) {
            setDemoSceneState(createDemoSceneState({
                folderName: folderHandle?.name || '',
                models: demoLoadedModels,
                keyframes: buildDemoKeyframeRevealQueue(loadedTimelineKeyframes),
            }));
        }

        const agentHistory = await readFileByRelativePath(folderHandle, 'agent_history.json')
            .then((file) => file.text())
            .then((text) => JSON.parse(text))
            .catch(() => null);
        if (agentHistory) {
            const hydratedAgentHistory = await hydrateAgentConversationLocalWorkspaceAssets(agentHistory, folderHandle);
            hydrateAgentConversationSnapshot(hydratedAgentHistory);
        } else {
            resetAgentConversation();
        }

        showLoading(false);
        syncWorkspaceStateFromSceneFS({
            mode: 'local',
            dirty: false,
            saving: false,
            error: null,
            syncStatus: 'clean',
        });
        if (!hasConfiguredWorkspaceTarget()) {
            openWorkspaceTargetModal('load-scene-after-load');
        }
        showInfo(
            demoSceneActive
                ? t('messages.demoSceneLoaded', { name: folderHandle.name, loaded, failed })
                : t('messages.sceneLoaded', { name: folderHandle.name, loaded, failed })
        );
    } catch (error) {
        showLoading(false);
        syncWorkspaceStateFromSceneFS({
            mode: 'local',
            saving: false,
            error: error?.message || String(error),
            syncStatus: 'error',
        });
        console.error(`[Editor ${state.VERSION}] loadScene failed:`, error);
        showError(t('messages.loadSceneFailed', { message: error?.message || String(error) }));
    }
}

async function loadSceneFromSnapshot(raw, options = {}) {
    if (!app) {
        throw new Error(t('messages.editorNotInitialized'));
    }

    if (app.getModels().length > 0 && !options.skipConfirm) {
        const ok = confirm(t('messages.openProjectReplaceConfirm'));
        if (!ok) {
            return false;
        }
    }

    app.clearAllModels();
    resetDemoSceneState();
    stopTimelinePlayback(false);
    state.keyframes = [];
    state.cameraFovKeyframes = [];
    state.currentKeyframeIndex = -1;
    state.selectedFrame = 0;
    state.selectedCameraSequenceFrame = null;
    state.currentTime = 0;
    updateTimelineUI();
    syncCameraSequenceVisualization();
    closeEditor();
    applyCameraPreviewWorkspacePreset(null, false);
    const loadResult = await sceneFs.loadScene(app, { sceneData: raw });
    updateModelList();
    updateTimelineUI();
    syncCameraSequenceVisualization();
    return {
        loaded: true,
        loadResult,
    };
}

async function openServerProject(projectId) {
    if (!state.projectSession?.authenticated || !state.projectSession.user) {
        throw new Error(t('projectSession.loginRequired'));
    }
    showLoading(true, t('projectSession.loadingProject'), 30);
    try {
        const [project, rawScene, agentHistory] = await Promise.all([
            projectApi.getProject(state.projectSession.user, projectId),
            projectApi.loadScene(state.projectSession.user, projectId),
            projectApi.loadAgentHistory(state.projectSession.user, projectId).catch(() => null),
        ]);
        const scene = buildServerSceneAssetUrls(rawScene, state.projectSession.user, projectId);
        const loaded = await loadSceneFromSnapshot(scene);
        if (!loaded) {
            showLoading(false);
            return;
        }
        const hasPersistedAssets = Array.isArray(rawScene?.assets) && rawScene.assets.length > 0;
        const totalAssetCount = Number(loaded?.loadResult?.totalAssetCount || 0);
        const loadedAssetCount = Number(loaded?.loadResult?.loadedAssetCount || 0);
        if (hasPersistedAssets && totalAssetCount > 0 && loadedAssetCount <= 0) {
            throw new Error(t('projectSession.openProjectFailedEmpty'));
        }
        restoreServerProjectModelSourcePaths(Array.isArray(rawScene?.assets) ? rawScene.assets : []);
        if (agentHistory) {
            hydrateAgentConversationSnapshot(hydrateAgentConversationAssetUrls(
                agentHistory,
                (relativePath) => projectApi.getAssetUrl(state.projectSession.user, projectId, relativePath),
            ));
        }
        updateActiveServerProjectAssetCaches({
            scene: rawScene,
            agentHistory,
        });
        state.projectSession.activeProjectId = project?.id || projectId;
        state.projectSession.activeProjectName = project?.name || projectId;
        markWorkspaceTargetMigrationRequired('server');
        state.workspace = {
            ...state.workspace,
            name: state.projectSession.activeProjectName,
            writable: true,
            mode: 'server',
            dirty: false,
            saving: false,
            error: null,
            lastSavedAt: Date.now(),
            syncStatus: 'clean',
        };
        closePostLoginProjectModal();
        closeProjectBrowserModal();
        syncProjectSessionButton();
        updateWorkspaceStatusIndicator();
        showLoading(false);
        showInfo(t('projectSession.openedProject', {
            name: state.projectSession.activeProjectName,
        }));
    } catch (error) {
        showLoading(false);
        showError(error?.message || String(error));
    }
}

async function createServerProjectFromCurrentScene(options = {}) {
    if (!state.projectSession?.authenticated || !state.projectSession.user) {
        showError(t('projectSession.loginRequired'));
        return false;
    }
    const {
        nameInput = dom.projectSessionNewProjectName,
        closeModal = true,
        reopenModalOnError = closeModal ? 'post-login' : 'project-browser-saveas',
    } = options;
    const errorElement = nameInput === dom.projectBrowserSaveAsName
        ? dom.projectBrowserSaveAsNameError
        : dom.projectSessionNewProjectNameError;
    clearProjectNameConflictState(nameInput, errorElement);
    const projectName = String(nameInput?.value || '').trim() || getProjectSessionDefaultProjectName();
    if (reopenModalOnError === 'post-login') {
        closePostLoginProjectModal();
    }
    showLoading(true, t('projectSession.savingProject'), 40, { passive: true });
    try {
        console.debug('[ProjectSession] createServerProjectFromCurrentScene:start', {
            user: state.projectSession.user,
            projectName,
        });
        const { manifest, assetInputs } = await buildSceneWorkspaceSnapshot({
            includeAssetPayloads: true,
            showProgress: false,
            allowWorkspaceMaterializedAssetReuse: false,
            allowServerMaterializedAssetReuse: true,
        });
        const agentExport = await buildPersistableAgentConversationExport({
            includeAssets: true,
            includeAssetPayloads: true,
        });
        const draftProject = await projectApi.createProject({
            user: state.projectSession.user,
            name: projectName,
            scene: manifest,
            agentHistory: agentExport.snapshot,
        });
        const assetWrites = await uploadServerProjectAssets({
            user: state.projectSession.user,
            projectId: draftProject?.id,
            assetInputs,
            existingAssetPaths: state.projectSession.activeProjectSceneAssetPaths,
        });
        await uploadServerAgentHistoryAssets({
            user: state.projectSession.user,
            projectId: draftProject?.id,
            assetPayloads: agentExport.assetPayloads,
            existingAssetPaths: state.projectSession.activeProjectAgentAssetPaths,
        });
        const scene = buildServerProjectSceneSnapshot(manifest, assetWrites);
        const project = await projectApi.saveScene({
            user: state.projectSession.user,
            projectId: draftProject?.id,
            scene,
        });
        console.debug('[ProjectSession] createServerProjectFromCurrentScene:file:complete', {
            file: 'scene.json',
            user: state.projectSession.user,
            projectId: draftProject?.id,
            assetCount: manifest.assets.length,
        });
        await projectApi.saveAgentHistory({
            user: state.projectSession.user,
            projectId: draftProject?.id,
            agentHistory: agentExport.snapshot,
        });
        updateActiveServerProjectAssetCaches({
            scene,
            agentHistory: agentExport.snapshot,
        });
        console.debug('[ProjectSession] createServerProjectFromCurrentScene:file:complete', {
            file: 'agent_history.json',
            user: state.projectSession.user,
            projectId: draftProject?.id,
        });
        state.projectSession.activeProjectId = project?.id || '';
        state.projectSession.activeProjectName = project?.name || projectName;
        applyWorkspaceAssetWritesToLoadedModels(assetWrites);
        state.forceFullServerAssetMigration = false;
        state.workspace = {
            ...state.workspace,
            name: state.projectSession.activeProjectName,
            writable: true,
            mode: 'server',
            dirty: false,
            saving: false,
            error: null,
            lastSavedAt: Date.now(),
            syncStatus: 'clean',
        };
        setPendingWorkspaceTargetAction(null);
        await refreshProjectSessionProjects();
        if (closeModal) {
            closePostLoginProjectModal();
            closeProjectBrowserModal();
        }
        updateWorkspaceStatusIndicator();
        showLoading(false);
        showInfo(t('messages.projectSavedAsCurrent', { name: state.projectSession.activeProjectName }));
        console.debug('[ProjectSession] createServerProjectFromCurrentScene:complete', {
            user: state.projectSession.user,
            projectId: state.projectSession.activeProjectId,
            projectName: state.projectSession.activeProjectName,
        });
        return true;
    } catch (error) {
        showLoading(false);
        console.debug('[ProjectSession] createServerProjectFromCurrentScene:error', {
            user: state.projectSession.user,
            projectName,
            error: error?.message || String(error),
        });
        if (reopenModalOnError === 'post-login') {
            openPostLoginProjectModal();
            if (dom.projectSessionNewProjectName) {
                dom.projectSessionNewProjectName.value = projectName;
            }
        } else if (reopenModalOnError === 'project-browser-saveas' && dom.projectBrowserSaveAsName) {
            dom.projectBrowserSaveAsName.value = projectName;
        }
        const reopenedInput = reopenModalOnError === 'project-browser-saveas'
            ? dom.projectBrowserSaveAsName
            : dom.projectSessionNewProjectName;
        const reopenedErrorElement = reopenModalOnError === 'project-browser-saveas'
            ? dom.projectBrowserSaveAsNameError
            : dom.projectSessionNewProjectNameError;
        if (reopenedInput) {
            reopenedInput.value = projectName;
        }
        if (isDuplicateProjectNameError(error)) {
            setProjectNameConflictState(reopenedInput, reopenedErrorElement);
            return false;
        }
        showError(error?.message || String(error));
        return false;
    }
}

async function deleteAdminProject(user, projectId) {
    if (!user || !projectId) return;
    const ok = confirm(t('messages.confirmDeleteProject', { user, projectId }));
    if (!ok) return;

    showLoading(true, t('messages.deletingProject'), 60);
    try {
        await projectApi.adminDeleteProject(user, projectId);
        if (state.projectSession.activeProjectId === projectId && state.projectSession.activeProjectName) {
            state.projectSession.activeProjectId = '';
            state.projectSession.activeProjectName = '';
            clearActiveServerProjectAssetCaches();
        }
        await refreshAdminSelectedUserProjects();
        showLoading(false);
        showInfo(t('messages.projectDeleted'));
    } catch (error) {
        showLoading(false);
        showError(error?.message || String(error));
    }
}

async function deleteAdminUser(user) {
    if (!user) return;
    const ok = confirm(t('messages.confirmDeleteUser', { user }));
    if (!ok) return;

    showLoading(true, t('messages.deletingUser'), 60);
    try {
        await projectApi.deleteUser(user);
        if (state.projectSession.adminSelectedUser === user) {
            state.projectSession.adminSelectedUser = '';
            state.projectSession.projects = [];
        }
        await refreshAdminUsers();
        showLoading(false);
        showInfo(t('messages.userDeleted'));
    } catch (error) {
        showLoading(false);
        showError(error?.message || String(error));
    }
}

function logoutProjectSession() {
    clearActiveServerProjectAssetCaches();
    setPendingWorkspaceTargetAction(null);
    state.forceFullWorkspaceAssetMigration = false;
    state.forceFullServerAssetMigration = false;
    state.projectSession = {
        ...createProjectSessionState(),
    };
    localStorage.removeItem(PROJECT_SESSION_USER_STORAGE_KEY);
    state.workspace = {
        ...state.workspace,
        mode: 'local',
        name: state.workspace?.name || null,
        writable: Boolean(sceneFs.isWorkspaceWritable?.()),
        syncStatus: 'no-workspace',
    };
    closeLoginModal();
    closePostLoginProjectModal();
    closeProjectBrowserModal();
    closeWorkspaceTargetModal();
    closeAdminProjectModal();
    syncProjectSessionButton();
    updateWorkspaceStatusIndicator();
}

/**
 * 清空场景
 */
function clearScene() {
    if (confirm(t('messages.clearSceneConfirm'))) {
        stopTimelinePlayback(false);
        resetDemoSceneState();
        state.keyframes = [];
        state.cameraFovKeyframes = [];
        state.currentKeyframeIndex = -1;
        state.selectedFrame = 0;
        state.selectedCameraSequenceFrame = null;
        state.currentTime = 0;
        updateTimelineUI();
        syncCameraSequenceVisualization();
        app.clearAllModels();
        closeEditor();
        markWorkspaceDirty('clear-scene');
        showInfo(t('messages.sceneCleared'));
    }
}

/**
 * 打开模型文件选择
 */
function openModelFileSelector() {
    console.log(`[Editor ${state.VERSION}] Opening file selector...`);
    dom.fileInput?.click();
}

function syncCameraSequenceVisualization() {
    if (!app?.setCameraSequenceVisualization) return;
    const keyframes = (Array.isArray(state.keyframes) ? state.keyframes : []).map((item) => ({
        frame: Math.round(Number(item.frame) || 0),
        time: Number(item.time) || 0,
        camera: applyTimelineFovToPose(item.camera, Number(item.time) || 0),
    }));
    const trajectory = buildSampledCameraTrajectory();
    const highlightedFrame = Number.isFinite(Number(state.selectedCameraSequenceFrame))
        ? clampTimelineFrame(state.selectedCameraSequenceFrame)
        : state.selectedFrame;
    app.setCameraSequenceVisualization(keyframes, highlightedFrame, trajectory);
}

function updateKeyframeCameraPose(frame, pose) {
    const safeFrame = Math.round(Number(frame));
    if (!Number.isFinite(safeFrame) || !pose) return false;
    const index = state.keyframes.findIndex((keyframe) => Number(keyframe.frame) === safeFrame);
    const normalizedPose = {
        position: { ...pose.position },
        rotation: { ...pose.rotation },
    };
    const keyframe = {
        frame: safeFrame,
        time: frameToTime(safeFrame),
        camera: normalizedPose,
    };
    if (index < 0) {
        state.keyframes.push(keyframe);
        state.keyframes.sort((a, b) => a.frame - b.frame);
    } else {
        state.keyframes[index] = {
            ...state.keyframes[index],
            camera: normalizedPose,
        };
    }
    state.currentKeyframeIndex = findKeyframeIndexByFrame(state.selectedFrame);
    if (safeFrame === state.selectedFrame) {
        syncTimelineDrivenCameraPreviewPose();
    }
    return true;
}

function normalizeLegacyCameraInterpolationMode(mode) {
    if (mode === LEGACY_CAMERA_INTERPOLATION_MODE_SQUAD) return LEGACY_CAMERA_INTERPOLATION_MODE_SQUAD;
    if (mode === LEGACY_CAMERA_INTERPOLATION_MODE_CATMULL) return LEGACY_CAMERA_INTERPOLATION_MODE_CATMULL;
    if (mode === LEGACY_CAMERA_INTERPOLATION_MODE_EASE) return LEGACY_CAMERA_INTERPOLATION_MODE_EASE;
    return LEGACY_CAMERA_INTERPOLATION_MODE_LINEAR;
}

function normalizeCameraPositionInterpolationMode(mode) {
    return mode === CAMERA_POSITION_INTERPOLATION_CATMULL
        ? CAMERA_POSITION_INTERPOLATION_CATMULL
        : CAMERA_POSITION_INTERPOLATION_LINEAR;
}

function normalizeCameraRotationInterpolationMode(mode) {
    return mode === CAMERA_ROTATION_INTERPOLATION_SQUAD
        ? CAMERA_ROTATION_INTERPOLATION_SQUAD
        : CAMERA_ROTATION_INTERPOLATION_SLERP;
}

function normalizeCameraTimingInterpolationMode(mode) {
    return mode === CAMERA_TIMING_INTERPOLATION_EASE
        ? CAMERA_TIMING_INTERPOLATION_EASE
        : CAMERA_TIMING_INTERPOLATION_LINEAR;
}

function clampCameraCatmullTension(value) {
    const config = CAMERA_POSITION_INTERPOLATION_CONFIGS[CAMERA_POSITION_INTERPOLATION_CATMULL];
    const fallback = Number(config.defaultParam ?? 1);
    const n = Number(value);
    const raw = Number.isFinite(n) ? n : fallback;
    return Math.max(config.min ?? 0, Math.min(config.max ?? 1, raw));
}

function clampCameraRotationStrength(value) {
    const config = CAMERA_ROTATION_INTERPOLATION_STRENGTH_CONFIG;
    const fallback = Number(config.defaultParam ?? 0);
    const n = Number(value);
    const raw = Number.isFinite(n) ? n : fallback;
    return Math.max(config.min ?? 0, Math.min(config.max ?? 1, raw));
}

function clampCameraEaseStrength(value) {
    const config = CAMERA_TIMING_INTERPOLATION_CONFIGS[CAMERA_TIMING_INTERPOLATION_EASE];
    const fallback = Number(config.defaultParam ?? 0);
    const n = Number(value);
    const raw = Number.isFinite(n) ? n : fallback;
    return Math.max(config.min ?? 0, Math.min(config.max ?? 1, raw));
}

function resolveCameraPositionInterpolationModeFromTension(value = state.cameraCatmullTension) {
    return clampCameraCatmullTension(value) >= 1
        ? CAMERA_POSITION_INTERPOLATION_LINEAR
        : CAMERA_POSITION_INTERPOLATION_CATMULL;
}

function resolveCameraRotationInterpolationModeFromStrength(value = state.cameraRotationStrength) {
    return clampCameraRotationStrength(value) > 0
        ? CAMERA_ROTATION_INTERPOLATION_SQUAD
        : CAMERA_ROTATION_INTERPOLATION_SLERP;
}

function resolveCameraTimingInterpolationModeFromStrength(value = state.cameraEaseStrength) {
    return Math.abs(clampCameraEaseStrength(value)) > 1e-6
        ? CAMERA_TIMING_INTERPOLATION_EASE
        : CAMERA_TIMING_INTERPOLATION_LINEAR;
}

function resolveCameraInterpolationStateFromLegacy(mode, param = 0.5) {
    const normalized = normalizeLegacyCameraInterpolationMode(mode);
    const settings = {
        positionStrength: 1,
        rotationStrength: 0,
        timingStrength: 0,
    };
    if (normalized === LEGACY_CAMERA_INTERPOLATION_MODE_CATMULL) {
        settings.positionStrength = clampCameraCatmullTension(param);
    } else if (normalized === LEGACY_CAMERA_INTERPOLATION_MODE_SQUAD) {
        settings.rotationStrength = 1;
    } else if (normalized === LEGACY_CAMERA_INTERPOLATION_MODE_EASE) {
        settings.timingStrength = clampCameraEaseStrength(param);
    }
    return settings;
}

function buildLegacyCameraInterpolationSnapshot() {
    const positionMode = resolveCameraPositionInterpolationModeFromTension(state.cameraCatmullTension);
    const rotationMode = resolveCameraRotationInterpolationModeFromStrength(state.cameraRotationStrength);
    const timingMode = resolveCameraTimingInterpolationModeFromStrength(state.cameraEaseStrength);
    if (
        positionMode === CAMERA_POSITION_INTERPOLATION_CATMULL
        && rotationMode === CAMERA_ROTATION_INTERPOLATION_SLERP
        && timingMode === CAMERA_TIMING_INTERPOLATION_LINEAR
    ) {
        return {
            mode: LEGACY_CAMERA_INTERPOLATION_MODE_CATMULL,
            param: Number(state.cameraCatmullTension),
        };
    }
    if (
        positionMode === CAMERA_POSITION_INTERPOLATION_LINEAR
        && rotationMode === CAMERA_ROTATION_INTERPOLATION_SQUAD
        && timingMode === CAMERA_TIMING_INTERPOLATION_LINEAR
    ) {
        return {
            mode: LEGACY_CAMERA_INTERPOLATION_MODE_SQUAD,
            param: 0.5,
        };
    }
    if (
        positionMode === CAMERA_POSITION_INTERPOLATION_LINEAR
        && rotationMode === CAMERA_ROTATION_INTERPOLATION_SLERP
        && timingMode === CAMERA_TIMING_INTERPOLATION_EASE
    ) {
        return {
            mode: LEGACY_CAMERA_INTERPOLATION_MODE_EASE,
            param: Number(state.cameraEaseStrength),
        };
    }
    return {
        mode: LEGACY_CAMERA_INTERPOLATION_MODE_LINEAR,
        param: 0.5,
    };
}

function persistCameraInterpolationSettings() {
    localStorage.setItem(CAMERA_POSITION_INTERPOLATION_STORAGE_KEY, resolveCameraPositionInterpolationModeFromTension(state.cameraCatmullTension));
    localStorage.setItem(CAMERA_ROTATION_INTERPOLATION_STORAGE_KEY, resolveCameraRotationInterpolationModeFromStrength(state.cameraRotationStrength));
    localStorage.setItem(CAMERA_TIMING_INTERPOLATION_STORAGE_KEY, resolveCameraTimingInterpolationModeFromStrength(state.cameraEaseStrength));
    localStorage.setItem(CAMERA_POSITION_INTERPOLATION_STRENGTH_STORAGE_KEY, String(state.cameraCatmullTension));
    localStorage.setItem(CAMERA_CATMULL_TENSION_STORAGE_KEY, String(state.cameraCatmullTension));
    localStorage.setItem(CAMERA_ROTATION_STRENGTH_STORAGE_KEY, String(state.cameraRotationStrength));
    localStorage.setItem(CAMERA_EASE_STRENGTH_STORAGE_KEY, String(state.cameraEaseStrength));
    const legacy = buildLegacyCameraInterpolationSnapshot();
    localStorage.setItem(LEGACY_CAMERA_INTERPOLATION_MODE_STORAGE_KEY, legacy.mode);
    localStorage.setItem(LEGACY_CAMERA_INTERPOLATION_PARAM_STORAGE_KEY, String(legacy.param));
}

function syncCameraInterpolationControls() {
    state.cameraCatmullTension = clampCameraCatmullTension(state.cameraCatmullTension);
    state.cameraRotationStrength = clampCameraRotationStrength(state.cameraRotationStrength);
    state.cameraEaseStrength = clampCameraEaseStrength(state.cameraEaseStrength);
    state.cameraPositionInterpolation = resolveCameraPositionInterpolationModeFromTension(state.cameraCatmullTension);
    state.cameraRotationInterpolation = resolveCameraRotationInterpolationModeFromStrength(state.cameraRotationStrength);
    state.cameraTimingInterpolation = resolveCameraTimingInterpolationModeFromStrength(state.cameraEaseStrength);

    const catmullConfig = CAMERA_POSITION_INTERPOLATION_CONFIGS[CAMERA_POSITION_INTERPOLATION_CATMULL];
    const rotationConfig = CAMERA_ROTATION_INTERPOLATION_STRENGTH_CONFIG;
    const easeConfig = CAMERA_TIMING_INTERPOLATION_CONFIGS[CAMERA_TIMING_INTERPOLATION_EASE];
    if (dom.timelineCatmullParam) {
        dom.timelineCatmullParam.min = String(catmullConfig.min ?? 0);
        dom.timelineCatmullParam.max = String(catmullConfig.max ?? 1);
        dom.timelineCatmullParam.step = String(catmullConfig.step ?? 0.01);
        dom.timelineCatmullParam.value = String(state.cameraCatmullTension);
    }
    if (dom.timelineRotationParam) {
        dom.timelineRotationParam.min = String(rotationConfig.min ?? 0);
        dom.timelineRotationParam.max = String(rotationConfig.max ?? 1);
        dom.timelineRotationParam.step = String(rotationConfig.step ?? 0.01);
        dom.timelineRotationParam.value = String(state.cameraRotationStrength);
    }
    if (dom.timelineEaseParam) {
        dom.timelineEaseParam.min = String(easeConfig.min ?? 0);
        dom.timelineEaseParam.max = String(easeConfig.max ?? 1);
        dom.timelineEaseParam.step = String(easeConfig.step ?? 0.01);
        dom.timelineEaseParam.value = String(state.cameraEaseStrength);
    }
}

function applyCameraInterpolationSettings(settings = {}, {
    persist = false,
    syncVisualization = true,
} = {}) {
    if (settings.positionStrength !== undefined) {
        state.cameraCatmullTension = clampCameraCatmullTension(settings.positionStrength);
    } else if (settings.positionMode !== undefined) {
        state.cameraCatmullTension = normalizeCameraPositionInterpolationMode(settings.positionMode) === CAMERA_POSITION_INTERPOLATION_LINEAR
            ? 1
            : clampCameraCatmullTension(settings.catmullTension ?? 0);
    } else if (settings.catmullTension !== undefined) {
        state.cameraCatmullTension = clampCameraCatmullTension(settings.catmullTension);
    }
    if (settings.rotationStrength !== undefined) {
        state.cameraRotationStrength = clampCameraRotationStrength(settings.rotationStrength);
    } else if (settings.rotationMode !== undefined) {
        state.cameraRotationStrength = normalizeCameraRotationInterpolationMode(settings.rotationMode) === CAMERA_ROTATION_INTERPOLATION_SQUAD
            ? 1
            : 0;
    }
    if (settings.timingStrength !== undefined) {
        state.cameraEaseStrength = clampCameraEaseStrength(settings.timingStrength);
    } else if (settings.timingMode !== undefined) {
        state.cameraEaseStrength = normalizeCameraTimingInterpolationMode(settings.timingMode) === CAMERA_TIMING_INTERPOLATION_EASE
            ? clampCameraEaseStrength(settings.easeStrength ?? 1)
            : 0;
    } else if (settings.easeStrength !== undefined) {
        state.cameraEaseStrength = clampCameraEaseStrength(settings.easeStrength);
    }
    syncCameraInterpolationControls();
    if (persist) {
        persistCameraInterpolationSettings();
    }
    if (syncVisualization) {
        syncCameraSequenceVisualization();
    }
}

function setCameraPositionInterpolationStrength(value, silent = false) {
    state.cameraCatmullTension = clampCameraCatmullTension(value);
    syncCameraInterpolationControls();
    persistCameraInterpolationSettings();
    syncCameraSequenceVisualization();
    if (!silent) {
        showInfo(t('messages.parameterSet', {
            label: t('timeline.positionInterpolation'),
            value: state.cameraCatmullTension.toFixed(2),
        }));
    }
}

function setCameraRotationStrength(value, silent = false) {
    state.cameraRotationStrength = clampCameraRotationStrength(value);
    syncCameraInterpolationControls();
    persistCameraInterpolationSettings();
    syncCameraSequenceVisualization();
    if (!silent) {
        showInfo(t('messages.parameterSet', {
            label: t('timeline.rotationInterpolation'),
            value: state.cameraRotationStrength.toFixed(2),
        }));
    }
}

function setCameraTimingInterpolationStrength(value, silent = false) {
    state.cameraEaseStrength = clampCameraEaseStrength(value);
    syncCameraInterpolationControls();
    persistCameraInterpolationSettings();
    syncCameraSequenceVisualization();
    if (!silent) {
        showInfo(t('messages.parameterSet', {
            label: t('timeline.timingInterpolation'),
            value: state.cameraEaseStrength.toFixed(2),
        }));
    }
}

function buildSampledCameraTrajectory() {
    if (!Array.isArray(state.keyframes) || state.keyframes.length === 0) return [];
    if (state.keyframes.length === 1) {
        const camera = state.keyframes[0]?.camera;
        if (!camera?.position) return [];
        return [{
            x: Number(camera.position.x) || 0,
            y: Number(camera.position.y) || 0,
            z: Number(camera.position.z) || 0,
        }];
    }

    const totalFrames = getTimelineTotalFrames();
    const maxSamples = 3000;
    const step = Math.max(1, Math.ceil((totalFrames + 1) / maxSamples));
    const points = [];

    for (let frame = 0; frame <= totalFrames; frame += step) {
        const time = frameToTime(frame);
        const pose = interpolateCameraPoseAt(time);
        if (!pose?.position) continue;
        points.push({
            x: Number(pose.position.x) || 0,
            y: Number(pose.position.y) || 0,
            z: Number(pose.position.z) || 0,
        });
    }

    // Ensure terminal point is included even when sampling step > 1.
    const endPose = interpolateCameraPoseAt(frameToTime(totalFrames));
    if (endPose?.position) {
        const endPoint = {
            x: Number(endPose.position.x) || 0,
            y: Number(endPose.position.y) || 0,
            z: Number(endPose.position.z) || 0,
        };
        const last = points[points.length - 1];
        const isDifferent = !last ||
            Math.abs(last.x - endPoint.x) > 1e-6 ||
            Math.abs(last.y - endPoint.y) > 1e-6 ||
            Math.abs(last.z - endPoint.z) > 1e-6;
        if (isDifferent) {
            points.push(endPoint);
        }
    }

    return points;
}

function getTimelineTotalFrames() {
    const fps = Math.max(1, Number(state.timelineFps || 24));
    const durationSec = Math.max(1, Number(state.timelineDurationSec || TIMELINE_MIN_DURATION_SEC));
    return Math.max(1, Math.round(durationSec * fps));
}

function normalizeQuaternionValue(q) {
    const x = Number(q?.x) || 0;
    const y = Number(q?.y) || 0;
    const z = Number(q?.z) || 0;
    const w = Number(q?.w);
    const safeW = Number.isFinite(w) ? w : 1;
    const len = Math.hypot(x, y, z, safeW) || 1;
    return {
        x: x / len,
        y: y / len,
        z: z / len,
        w: safeW / len,
    };
}

function quaternionDot(a, b) {
    return (a.x * b.x) + (a.y * b.y) + (a.z * b.z) + (a.w * b.w);
}

function alignQuaternionHemisphere(reference, candidate) {
    const ref = normalizeQuaternionValue(reference);
    const q = normalizeQuaternionValue(candidate);
    if (quaternionDot(ref, q) >= 0) return q;
    return { x: -q.x, y: -q.y, z: -q.z, w: -q.w };
}

function multiplyQuaternions(a, b) {
    return normalizeQuaternionValue({
        x: a.w * b.x + a.x * b.w + a.y * b.z - a.z * b.y,
        y: a.w * b.y - a.x * b.z + a.y * b.w + a.z * b.x,
        z: a.w * b.z + a.x * b.y - a.y * b.x + a.z * b.w,
        w: a.w * b.w - a.x * b.x - a.y * b.y - a.z * b.z,
    });
}

function invertQuaternion(q) {
    const normalized = normalizeQuaternionValue(q);
    return {
        x: -normalized.x,
        y: -normalized.y,
        z: -normalized.z,
        w: normalized.w,
    };
}

function quaternionLogUnit(q) {
    const normalized = normalizeQuaternionValue(q);
    const w = Math.max(-1, Math.min(1, normalized.w));
    const angle = Math.acos(w);
    const sinAngle = Math.sin(angle);
    if (sinAngle <= 1e-6) {
        return { x: 0, y: 0, z: 0 };
    }
    const scale = angle / sinAngle;
    return {
        x: normalized.x * scale,
        y: normalized.y * scale,
        z: normalized.z * scale,
    };
}

function quaternionExpPure(v) {
    const angle = Math.hypot(v.x, v.y, v.z);
    if (angle <= 1e-6) {
        return normalizeQuaternionValue({ x: v.x, y: v.y, z: v.z, w: 1 });
    }
    const scale = Math.sin(angle) / angle;
    return normalizeQuaternionValue({
        x: v.x * scale,
        y: v.y * scale,
        z: v.z * scale,
        w: Math.cos(angle),
    });
}

function computeSquadTangent(prev, current, next) {
    const currentNorm = normalizeQuaternionValue(current);
    const prevAligned = alignQuaternionHemisphere(currentNorm, prev);
    const nextAligned = alignQuaternionHemisphere(currentNorm, next);
    const currentInverse = invertQuaternion(currentNorm);
    const prevDelta = multiplyQuaternions(currentInverse, prevAligned);
    const nextDelta = multiplyQuaternions(currentInverse, nextAligned);
    const prevLog = quaternionLogUnit(prevDelta);
    const nextLog = quaternionLogUnit(nextDelta);
    const omega = {
        x: -0.25 * (prevLog.x + nextLog.x),
        y: -0.25 * (prevLog.y + nextLog.y),
        z: -0.25 * (prevLog.z + nextLog.z),
    };
    return multiplyQuaternions(currentNorm, quaternionExpPure(omega));
}

function interpolateQuaternionSquad(prev, a, b, next, t) {
    const start = normalizeQuaternionValue(a);
    const end = alignQuaternionHemisphere(start, b);
    const prevRef = prev ? alignQuaternionHemisphere(start, prev) : start;
    const nextRef = next ? alignQuaternionHemisphere(end, next) : end;
    const tangentA = computeSquadTangent(prevRef, start, end);
    const tangentB = computeSquadTangent(start, end, nextRef);
    const slerpMain = slerpQuaternion(start, end, t);
    const slerpTangents = slerpQuaternion(tangentA, tangentB, t);
    return slerpQuaternion(slerpMain, slerpTangents, 2 * t * (1 - t));
}

function frameToTime(frame) {
    const fps = Math.max(1, Number(state.timelineFps || 24));
    return Math.max(0, frame) / fps;
}

function timeToFrame(timeSec) {
    const fps = Math.max(1, Number(state.timelineFps || 24));
    return Math.round(Math.max(0, Number(timeSec) || 0) * fps);
}

function clampTimelineFrame(frame) {
    const total = getTimelineTotalFrames();
    const n = Math.round(Number(frame) || 0);
    return Math.max(0, Math.min(total, n));
}

function findKeyframeIndexByFrame(frame) {
    const safeFrame = clampTimelineFrame(frame);
    return state.keyframes.findIndex((kf) => Number(kf.frame) === safeFrame);
}

function captureCurrentCameraPose() {
    if (!app) return null;
    const pose = app.getCameraPose?.();
    if (pose) return pose;

    const camera = app.getCamera?.();
    if (!camera) return null;
    return {
        position: { ...camera.position },
        rotation: { ...camera.rotation },
        fovDegrees: Number(app.getSceneCameraFovDegrees?.() || state.sceneCameraFov || 45),
    };
}

function syncTimelineDrivenCameraPreviewPose() {
    if (!app?.setCameraPreviewPose) return;
    let pose = null;
    if (state.keyframes.length > 0) {
        pose = interpolateCameraPoseAt(state.currentTime);
    } else if (state.cameraFovKeyframes.length > 0) {
        pose = applyTimelineFovToPose(captureCurrentCameraPose(), state.currentTime);
    } else {
        pose = captureCurrentCameraPose();
    }
    app.setCameraPreviewPose?.(pose || null);
}

function setTimelineFrame(frame, options = {}) {
    const safeFrame = clampTimelineFrame(frame);
    state.selectedFrame = safeFrame;
    state.currentTime = frameToTime(safeFrame);
    state.currentKeyframeIndex = findKeyframeIndexByFrame(safeFrame);

    syncTimelineDrivenCameraPreviewPose();
    if (options.syncGizmo !== false) {
        syncTimelineFrameToCameraGizmo(safeFrame);
    }

    if (app && typeof app.setGlobalTimelineTime === 'function') {
        app.setGlobalTimelineTime(state.currentTime);
    }
    if (app && typeof app.setGlobalTimelineFrame === 'function') {
        app.setGlobalTimelineFrame(safeFrame);
    }

    if (dom.timelineSlider && options.syncSlider !== false) {
        dom.timelineSlider.value = String(safeFrame);
    }
    if (options.lightweightUi) {
        updateTimeDisplay();
        updateTimelineCursorOnly();
        syncTimelineCameraFovInputs();
    } else {
        updateTimelineUI();
    }
}

function setTimelineFps(nextFpsRaw) {
    const nextFps = Number(nextFpsRaw);
    if (!Number.isFinite(nextFps) || nextFps <= 0) {
        showError(t('messages.invalidFps'));
        return;
    }

    if (state.isPlaying) {
        stopTimelinePlayback(false);
    }

    const previousTime = Number(state.currentTime || 0);
    state.timelineFps = nextFps;

    const dedup = new Map();
    for (const keyframe of state.keyframes) {
        const frame = clampTimelineFrame(Math.round((Number(keyframe.time) || 0) * nextFps));
        const normalized = {
            ...keyframe,
            frame,
            time: frameToTime(frame),
        };
        dedup.set(frame, normalized);
    }

    state.keyframes = Array.from(dedup.values()).sort((a, b) => a.frame - b.frame);
    const fovDedup = new Map();
    for (const keyframe of state.cameraFovKeyframes) {
        const frame = clampTimelineFrame(Math.round((Number(keyframe.time) || 0) * nextFps));
        fovDedup.set(frame, {
            ...keyframe,
            frame,
            time: frameToTime(frame),
        });
    }
    state.cameraFovKeyframes = Array.from(fovDedup.values()).sort((a, b) => a.frame - b.frame);
    if (dom.timelineFps) {
        dom.timelineFps.value = String(nextFps);
    }

    setTimelineFrame(timeToFrame(previousTime), { applyPose: false, syncSlider: true });
    syncCameraSequenceVisualization();
    if (pendingExportType === 'video' && dom.exportModal && !dom.exportModal.classList.contains('hidden')) {
        updateExportTimelineHint('video');
    }
}

function renderTimelineRuler() {
    if (!dom.timelineRuler) return;

    const totalFrames = getTimelineTotalFrames();
    const fps = Math.max(1, Number(state.timelineFps || 24));
    const html = [];

    for (let frame = 0; frame <= totalFrames; frame++) {
        const ratio = frame / totalFrames;
        const leftStyle = timelineMappedLeftStyle(ratio);
        const isMajor = frame % fps === 0;
        html.push(
            `<span class="timeline-tick ${isMajor ? 'major' : 'minor'}" style="left:${leftStyle}"></span>`
        );
        if (isMajor) {
            const sec = Math.round(frame / fps);
            html.push(
                `<span class="timeline-tick-label" style="left:${leftStyle}">${sec}s</span>`
            );
        }
    }

    const cursorRatio = state.selectedFrame / totalFrames;
    html.push(`<span class="timeline-ruler-cursor" style="left:${timelineMappedLeftStyle(cursorRatio)}"></span>`);
    dom.timelineRuler.innerHTML = html.join('');
}

function timelineClientXToFrame(clientX, targetEl) {
    const target = targetEl instanceof HTMLElement ? targetEl : dom.timelineTrack;
    if (!(target instanceof HTMLElement)) {
        return clampTimelineFrame(state.selectedFrame);
    }
    const rect = target.getBoundingClientRect();
    if (rect.width <= 0) {
        return clampTimelineFrame(state.selectedFrame);
    }
    const effectiveWidth = Math.max(1, rect.width - TIMELINE_SLIDER_THUMB_PX);
    const local = (clientX - rect.left) - (TIMELINE_SLIDER_THUMB_PX / 2);
    const ratio = Math.max(0, Math.min(1, local / effectiveWidth));
    return clampTimelineFrame(Math.round(ratio * getTimelineTotalFrames()));
}

function getKeyframeDragBoundsByIndex(index) {
    const total = getTimelineTotalFrames();
    if (!Number.isFinite(index) || index < 0 || index >= state.keyframes.length) {
        return { minFrame: 0, maxFrame: total };
    }

    const prevFrame = index > 0 ? clampTimelineFrame(state.keyframes[index - 1].frame) + 1 : 0;
    const nextFrame = index < state.keyframes.length - 1 ? clampTimelineFrame(state.keyframes[index + 1].frame) - 1 : total;
    const minFrame = Math.max(0, prevFrame);
    const maxFrame = Math.min(total, nextFrame);

    if (minFrame > maxFrame) {
        const current = clampTimelineFrame(state.keyframes[index].frame);
        return { minFrame: current, maxFrame: current };
    }
    return { minFrame, maxFrame };
}

function endKeyframeMarkerDrag() {
    if (!keyframeMarkerDrag) return;
    const drag = keyframeMarkerDrag;
    keyframeMarkerDrag = null;

    window.removeEventListener('mousemove', onKeyframeMarkerDragMove);
    window.removeEventListener('mouseup', endKeyframeMarkerDrag);
    window.removeEventListener('blur', endKeyframeMarkerDrag);
    document.body.classList.remove('value-dragging');

    if (drag.moved) {
        const frame = clampTimelineFrame(drag.keyframe.frame);
        state.keyframes.sort((a, b) => a.frame - b.frame);
        setTimelineFrame(frame, { applyPose: false, syncSlider: true });
        activateTimelineCameraKeyframeSelection(frame, { silent: true });
        showInfo(t('messages.keyframeAdjusted', { time: frameToTime(frame).toFixed(3) }));
        setTimeout(() => {
            suppressMarkerClickOnce = false;
        }, 0);
    }
}

function onKeyframeMarkerDragMove(event) {
    if (!keyframeMarkerDrag) return;
    const nextFrameRaw = timelineClientXToFrame(event.clientX, dom.timelineTrack);
    const nextFrame = Math.max(
        keyframeMarkerDrag.minFrame,
        Math.min(keyframeMarkerDrag.maxFrame, nextFrameRaw)
    );

    if (nextFrame === keyframeMarkerDrag.keyframe.frame) return;

    keyframeMarkerDrag.keyframe.frame = nextFrame;
    keyframeMarkerDrag.keyframe.time = frameToTime(nextFrame);
    state.keyframes.sort((a, b) => a.frame - b.frame);
    keyframeMarkerDrag.moved = true;
    suppressMarkerClickOnce = true;
    setTimelineFrame(nextFrame, { applyPose: false, syncSlider: true });
    activateTimelineCameraKeyframeSelection(nextFrame, { silent: true });
    syncCameraSequenceVisualization();

    if (pendingExportType === 'video' && dom.exportModal && !dom.exportModal.classList.contains('hidden')) {
        updateExportTimelineHint('video');
    }

    event.preventDefault();
}

function beginKeyframeMarkerDrag(event, marker) {
    if (!(event instanceof MouseEvent)) return;
    if (event.button !== 0) return;

    const markerIndex = Number(marker.dataset.keyframeIndex);
    if (!Number.isFinite(markerIndex) || markerIndex < 0 || markerIndex >= state.keyframes.length) return;

    const keyframe = state.keyframes[markerIndex];
    const bounds = getKeyframeDragBoundsByIndex(markerIndex);
    keyframeMarkerDrag = {
        keyframe,
        minFrame: bounds.minFrame,
        maxFrame: bounds.maxFrame,
        moved: false,
    };
    suppressMarkerClickOnce = false;

    if (state.isPlaying) {
        stopTimelinePlayback(false);
    }

    const safeFrame = clampTimelineFrame(keyframe.frame);
    setTimelineFrame(safeFrame, { applyPose: false, syncSlider: true });
    activateTimelineCameraKeyframeSelection(safeFrame, { silent: true });
    document.body.classList.add('value-dragging');
    window.addEventListener('mousemove', onKeyframeMarkerDragMove);
    window.addEventListener('mouseup', endKeyframeMarkerDrag);
    window.addEventListener('blur', endKeyframeMarkerDrag);

    event.preventDefault();
    event.stopPropagation();
}

// --- Model Tracks Logic ---
let activeModelTrackDrag = null;
let suppressModelClickOnce = false;

function buildModelTrackLoopMarkers(model, startSec, endSec) {
    const duration = getModelAnimationDuration(model);
    const speed = Math.abs(getModelAnimationSpeedValue(model));
    const clipDuration = Math.max(0, endSec - startSec);

    if (!Number.isFinite(duration) || duration <= 0 || !Number.isFinite(speed) || speed <= 0 || clipDuration <= 0) {
        return '';
    }

    const cycleDuration = duration / speed;
    if (!Number.isFinite(cycleDuration) || cycleDuration <= 0) {
        return '';
    }

    const markers = [];
    const epsilon = 1e-6;
    for (let markerSec = cycleDuration; markerSec <= clipDuration + epsilon; markerSec += cycleDuration) {
        if (Math.abs(markerSec - clipDuration) <= epsilon) continue;
        const ratio = Math.min(1, Math.max(0, markerSec / clipDuration));
        markers.push(
            `<span class="model-track-loop-marker" style="left:${(ratio * 100).toFixed(4)}%;" title="${escapeHtml(t('messages.modelTrackLoopEnds', { time: markerSec.toFixed(3) }))}"></span>`
        );
    }

    return markers.join('');
}

function buildModelTrackOverflowIndicator(model, startSec, endSec) {
    const duration = getModelAnimationDuration(model);
    const speed = Math.abs(getModelAnimationSpeedValue(model));
    const clipDuration = Math.max(0, endSec - startSec);

    if (!Number.isFinite(duration) || duration <= 0 || !Number.isFinite(speed) || speed <= 0 || clipDuration <= 0) {
        return '';
    }

    const cycleDuration = duration / speed;
    if (!(cycleDuration > clipDuration)) {
        return '';
    }

    return `<span class="model-track-overflow-indicator" title="${escapeHtml(t('messages.modelAnimationOverflow'))}">&gt;</span>`;
}

function getModelTrackLoopMarkerDebugInfo() {
    const models = Array.from(app?.editorModels?.values?.() || []);
    return models
        .filter((model) => modelHasTimelineAnimation(model))
        .map((model) => {
            const startSec = getModelAnimationStartTime(model);
            const endSec = getModelAnimationEndTime(model);
            const rawDuration = Number(model.animDuration ?? model.modelEntry?.animDuration);
            const hasMetadataDuration = Number.isFinite(rawDuration) && rawDuration > 0;
            const duration = getModelAnimationDuration(model);
            const speed = Math.abs(getModelAnimationSpeedValue(model));
            const clipDuration = Math.max(0, endSec - startSec);
            const cycleDuration = Number.isFinite(duration) && duration > 0 && Number.isFinite(speed) && speed > 0
                ? duration / speed
                : null;
            const markerTimes = [];

            if (cycleDuration && clipDuration > 0) {
                const epsilon = 1e-6;
                for (let markerSec = cycleDuration; markerSec <= clipDuration + epsilon; markerSec += cycleDuration) {
                    if (Math.abs(markerSec - clipDuration) <= epsilon) continue;
                    markerTimes.push(Number(markerSec.toFixed(6)));
                }
            }

            return {
                id: model.id,
                name: model.name,
                animDuration: hasMetadataDuration ? duration : null,
                effectiveAnimDuration: duration,
                durationSource: hasMetadataDuration ? 'metadata' : 'runtime-fallback',
                animSpeed: Number.isFinite(speed) ? speed : null,
                clipStart: startSec,
                clipEnd: endSec,
                clipDuration,
                cycleDuration,
                markerTimes,
                markerCount: markerTimes.length,
                markerHtml: buildModelTrackLoopMarkers(model, startSec, endSec),
            };
        });
}

function getModelTracksDomDebugInfo() {
    const container = document.getElementById('modelTracksContainer');
    return {
        exists: !!container,
        display: container?.style?.display ?? null,
        html: container?.innerHTML ?? '',
        clipCount: container?.querySelectorAll('.model-track-clip').length ?? 0,
        markerCount: container?.querySelectorAll('.model-track-loop-marker').length ?? 0,
    };
}

function renderModelTracks() {
    const container = document.getElementById('modelTracksContainer');
    if (!container) return;
    
    container.innerHTML = '';
    if (!app || typeof app.setGlobalTimelineTime !== 'function') return;
    
    const totalFrames = getTimelineTotalFrames();
    const durationSec = frameToTime(totalFrames);
    const models = Array.from(app.editorModels?.values() || []);
    let hasTracks = false;
    
    for (const model of models) {
        if (!modelHasTimelineAnimation(model)) continue;
        
        hasTracks = true;
        const startSec = getModelAnimationStartTime(model);
        const endSec = getModelAnimationEndTime(model);
        
        const startRatio = Math.max(0, Math.min(1, startSec / durationSec));
        const endRatio = Math.max(0, Math.min(1, endSec / durationSec));
        const widthRatio = Math.max(0, endRatio - startRatio);
        
        const leftStyle = timelineMappedLeftStyle(startRatio);
        const widthStyle = `calc((100% - ${TIMELINE_SLIDER_THUMB_PX}px) * ${widthRatio})`;
        const loopMarkersHtml = buildModelTrackLoopMarkers(model, startSec, endSec);
        const overflowIndicatorHtml = buildModelTrackOverflowIndicator(model, startSec, endSec);
        
        const trackHtml = `
            <div class="model-track" data-model-id="${model.id}">
                <div class="model-track-clip" style="left: ${leftStyle}; width: ${widthStyle};" title="${model.name}">
                    ${loopMarkersHtml}
                    ${overflowIndicatorHtml}
                    <div class="model-track-handle left" data-action="resize-left"></div>
                    <span class="model-track-clip-label">${model.name}</span>
                    <div class="model-track-handle right" data-action="resize-right"></div>
                </div>
            </div>
        `;
        container.insertAdjacentHTML('beforeend', trackHtml);
    }
    
    if (hasTracks) {
        container.style.display = 'flex';
        container.querySelectorAll('.model-track-clip').forEach(clip => {
            clip.addEventListener('mousedown', beginModelTrackDrag);
            clip.addEventListener('click', (e) => {
                if (suppressModelClickOnce) {
                    suppressModelClickOnce = false;
                    e.preventDefault();
                    e.stopPropagation();
                }
            });
        });
    } else {
        container.style.display = 'none';
    }
}

function beginModelTrackDrag(e) {
    if (e.button !== 0) return;
    
    const clip = e.currentTarget;
    const track = clip.parentElement;
    const modelId = track.dataset.modelId;
    
    const model = app.editorModels.get(modelId);
    if (!model || !modelHasTimelineAnimation(model)) return;

    const action = e.target.dataset.action || 'move';
    const startSec = getModelAnimationStartTime(model);
    const endSec = getModelAnimationEndTime(model);

    activeModelTrackDrag = {
        modelId,
        action,
        initialClientX: e.clientX,
        initialStartSec: startSec,
        initialEndSec: endSec,
        moved: false
    };

    suppressModelClickOnce = false;
    document.body.classList.add('value-dragging');
    window.addEventListener('mousemove', onModelTrackDragMove);
    window.addEventListener('mouseup', endModelTrackDrag);
    window.addEventListener('blur', endModelTrackDrag);
    
    e.preventDefault();
    e.stopPropagation();
}

function onModelTrackDragMove(e) {
    if (!activeModelTrackDrag) return;
    e.preventDefault();

    const container = document.getElementById('timelineTrack');
    if (!container) return;
    
    activeModelTrackDrag.moved = true;
    suppressModelClickOnce = true;

    const rect = container.getBoundingClientRect();
    const effectiveWidth = Math.max(1, rect.width - TIMELINE_SLIDER_THUMB_PX);
    const durationSec = frameToTime(getTimelineTotalFrames());
    
    const dx = e.clientX - activeModelTrackDrag.initialClientX;
    const timeDiff = (dx / effectiveWidth) * durationSec;

    let newStart = activeModelTrackDrag.initialStartSec;
    let newEnd = activeModelTrackDrag.initialEndSec;

    if (activeModelTrackDrag.action === 'move') {
        const span = newEnd - newStart;
        newStart += timeDiff;
        newEnd += timeDiff;
        if (newStart < 0) { newStart = 0; newEnd = span; }
        if (newEnd > durationSec) { newEnd = durationSec; newStart = durationSec - span; }
    } else if (activeModelTrackDrag.action === 'resize-left') {
        newStart += timeDiff;
        if (newStart < 0) newStart = 0;
        if (newStart > newEnd - 0.1) newStart = newEnd - 0.1;
    } else if (activeModelTrackDrag.action === 'resize-right') {
        newEnd += timeDiff;
        if (newEnd > durationSec) newEnd = durationSec;
        if (newEnd < newStart + 0.1) newEnd = newStart + 0.1;
    }

    if (app && typeof app.setModelAnimTimeBounds === 'function') {
        app.setModelAnimTimeBounds(activeModelTrackDrag.modelId, newStart, newEnd);
        renderModelTracks();
        
        if (activeModelTrackDrag.action === 'resize-left' || activeModelTrackDrag.action === 'move') {
            setTimelineFrame(timeToFrame(newStart), { applyPose: true, syncSlider: true });
        } else {
            setTimelineFrame(timeToFrame(newEnd), { applyPose: true, syncSlider: true });
        }
    }
}

function endModelTrackDrag(e) {
    if (!activeModelTrackDrag) return;
    
    window.removeEventListener('mousemove', onModelTrackDragMove);
    window.removeEventListener('mouseup', endModelTrackDrag);
    window.removeEventListener('blur', endModelTrackDrag);
    document.body.classList.remove('value-dragging');
    
    if (activeModelTrackDrag.moved) {
        showInfo(t('messages.modelAnimationClipUpdated'));
    }
    
    activeModelTrackDrag = null;
    updateTimelineUI();
    
    setTimeout(() => {
        suppressModelClickOnce = false;
    }, 0);
}
// --- End Model Tracks Logic ---

function renderTimelineTrack() {
    if (!dom.timelineTrack) return;
    const totalFrames = getTimelineTotalFrames();
    const hasKeyframes = state.keyframes.length > 0 || state.cameraFovKeyframes.length > 0;
    const html = [];

    if (!hasKeyframes) {
        html.push(`<div class="timeline-placeholder"><span class="placeholder-text">${escapeHtml(t('timeline.placeholder'))}</span></div>`);
    }

    const cursorRatio = state.selectedFrame / totalFrames;
    html.push(`<span class="timeline-track-cursor" style="left:${timelineMappedLeftStyle(cursorRatio)}"></span>`);

    for (let i = 0; i < state.keyframes.length; i++) {
        const keyframe = state.keyframes[i];
        const frame = clampTimelineFrame(keyframe.frame);
        const ratio = frame / totalFrames;
        const selectedClass = frame === state.selectedFrame ? 'selected' : '';
        html.push(
            `<button type="button" class="timeline-keyframe-marker ${selectedClass}" data-frame="${frame}" data-keyframe-index="${i}" style="left:${timelineMappedLeftStyle(ratio)}" title="${keyframe.time.toFixed(3)}s"></button>`
        );
    }

    for (let i = 0; i < state.cameraFovKeyframes.length; i++) {
        const keyframe = state.cameraFovKeyframes[i];
        const frame = clampTimelineFrame(keyframe.frame);
        const ratio = frame / totalFrames;
        const selectedClass = frame === state.selectedFrame ? 'selected' : '';
        html.push(
            `<span class="timeline-fov-marker ${selectedClass}" data-frame="${frame}" style="left:${timelineMappedLeftStyle(ratio)}" title="FOV ${Number(keyframe.fovDegrees || getFallbackTimelineCameraFov()).toFixed(3)}°">×</span>`
        );
    }

    dom.timelineTrack.innerHTML = html.join('');
    dom.timelineTrack.querySelectorAll('.timeline-keyframe-marker').forEach((marker) => {
        marker.addEventListener('mousedown', (e) => {
            beginKeyframeMarkerDrag(e, marker);
        });
        marker.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            if (suppressMarkerClickOnce) {
                suppressMarkerClickOnce = false;
                return;
            }
            const frame = Number(marker.dataset.frame);
            setTimelineFrame(frame, { applyPose: true, syncSlider: true });
            activateTimelineCameraKeyframeSelection(frame);
            syncCameraSequenceVisualization();
        });
    });
}

function timelineMappedLeftStyle(ratio) {
    const clamped = Math.max(0, Math.min(1, Number(ratio) || 0));
    const r = clamped.toFixed(6);
    return `calc((100% - ${TIMELINE_SLIDER_THUMB_PX}px) * ${r} + ${TIMELINE_SLIDER_THUMB_PX / 2}px)`;
}

function updateTimelineCursorOnly() {
    const totalFrames = getTimelineTotalFrames();
    const ratio = totalFrames > 0 ? (state.selectedFrame / totalFrames) : 0;
    const leftStyle = timelineMappedLeftStyle(ratio);

    const rulerCursor = dom.timelineRuler?.querySelector('.timeline-ruler-cursor');
    if (rulerCursor instanceof HTMLElement) {
        rulerCursor.style.left = leftStyle;
    }

    const trackCursor = dom.timelineTrack?.querySelector('.timeline-track-cursor');
    if (trackCursor instanceof HTMLElement) {
        trackCursor.style.left = leftStyle;
    }

    dom.timelineTrack?.querySelectorAll('.timeline-keyframe-marker').forEach((marker) => {
        const frame = Number(marker.dataset.frame);
        marker.classList.toggle('selected', frame === state.selectedFrame);
    });
    dom.timelineTrack?.querySelectorAll('.timeline-fov-marker').forEach((marker) => {
        const frame = Number(marker.dataset.frame);
        marker.classList.toggle('selected', frame === state.selectedFrame);
    });

    if (dom.btnRemoveKeyframe) {
        dom.btnRemoveKeyframe.disabled = findKeyframeIndexByFrame(state.selectedFrame) < 0
            && findCameraFovKeyframeIndexByFrame(state.selectedFrame) < 0;
    }
}

function updateTimelineUI() {
    const totalFrames = getTimelineTotalFrames();

    if (dom.timelineSlider) {
        dom.timelineSlider.min = '0';
        dom.timelineSlider.max = String(totalFrames);
        dom.timelineSlider.step = '1';
        dom.timelineSlider.value = String(state.selectedFrame);
    }

    if (dom.btnRemoveKeyframe) {
        dom.btnRemoveKeyframe.disabled = findKeyframeIndexByFrame(state.selectedFrame) < 0
            && findCameraFovKeyframeIndexByFrame(state.selectedFrame) < 0;
    }

    renderTimelineRuler();
    renderTimelineTrack();
    renderModelTracks();
    updateTimeDisplay();
    syncTimelineCameraFovInputs();
}

/**
 * 添加/覆盖关键帧（当前时间戳）
 */
function addKeyframe() {
    const pose = captureCurrentCameraPose();
    if (!pose) {
        showError(t('messages.cameraPoseReadFailed'));
        return;
    }

    const frame = clampTimelineFrame(state.selectedFrame);
    const keyframe = {
        frame,
        time: frameToTime(frame),
        camera: {
            position: { ...pose.position },
            rotation: { ...pose.rotation },
        },
    };

    const existingIndex = findKeyframeIndexByFrame(frame);
    if (existingIndex >= 0) {
        state.keyframes[existingIndex] = keyframe;
        showInfo(t('messages.keyframeOverwritten', { time: keyframe.time.toFixed(3) }));
    } else {
        state.keyframes.push(keyframe);
        state.keyframes.sort((a, b) => a.frame - b.frame);
        showInfo(t('messages.keyframeAdded', { time: keyframe.time.toFixed(3) }));
    }

    state.currentKeyframeIndex = findKeyframeIndexByFrame(frame);
    updateTimelineUI();
    syncCameraSequenceVisualization();
    if (pendingExportType === 'video' && dom.exportModal && !dom.exportModal.classList.contains('hidden')) {
        updateExportTimelineHint('video');
    }
}

function addKeyframeFromShortcut() {
    const frame = clampTimelineFrame(state.selectedFrame);
    const hasLaterKeyframe = state.keyframes.some((keyframe) => keyframe.frame > frame);
    addKeyframe();
    if (hasLaterKeyframe) return;

    const nextTime = frameToTime(frame) + 1;
    const nextFrame = clampTimelineFrame(timeToFrame(nextTime));
    if (nextFrame === frame) return;
    setTimelineFrame(nextFrame, { applyPose: false, syncSlider: true });
}

/**
 * 删除当前时间戳上的关键帧
 */
function removeKeyframe() {
    const frame = clampTimelineFrame(state.selectedFrame);
    const fovIndex = findCameraFovKeyframeIndexByFrame(frame);
    if (fovIndex >= 0) {
        const removedFov = state.cameraFovKeyframes.splice(fovIndex, 1)[0];
        updateTimelineUI();
        syncTimelineDrivenCameraPreviewPose();
        syncCameraSequenceVisualization();
        if (pendingExportType === 'video' && dom.exportModal && !dom.exportModal.classList.contains('hidden')) {
            updateExportTimelineHint('video');
        }
        showInfo(t('messages.fovKeyframeDeleted', {
            time: (Number(removedFov?.time) || frameToTime(frame)).toFixed(3),
        }));
        return;
    }
    const index = findKeyframeIndexByFrame(frame);
    if (index < 0) {
        showInfo(t('messages.noKeyframeAtCurrentTime', { time: frameToTime(frame).toFixed(3) }));
        return;
    }

    const removed = state.keyframes.splice(index, 1)[0];
    state.currentKeyframeIndex = findKeyframeIndexByFrame(frame);
    updateTimelineUI();
    syncCameraSequenceVisualization();
    if (pendingExportType === 'video' && dom.exportModal && !dom.exportModal.classList.contains('hidden')) {
        updateExportTimelineHint('video');
    }
    showInfo(t('messages.keyframeDeleted', { time: removed.time.toFixed(3) }));
}

function buildCameraSequenceExportPayload() {
    const legacyInterpolation = buildLegacyCameraInterpolationSnapshot();
    return {
        version: 2,
        timelineFps: Number(state.timelineFps || 24),
        timelineDurationSec: Number(state.timelineDurationSec || 10),
        timelinePlaybackSpeed: Number(state.timelinePlaybackSpeed || 1),
        interpolationMode: legacyInterpolation.mode,
        interpolationParam: Number(legacyInterpolation.param || 0.5),
        positionInterpolationMode: resolveCameraPositionInterpolationModeFromTension(state.cameraCatmullTension),
        rotationInterpolationMode: resolveCameraRotationInterpolationModeFromStrength(state.cameraRotationStrength),
        timingInterpolationMode: resolveCameraTimingInterpolationModeFromStrength(state.cameraEaseStrength),
        positionInterpolationStrength: Number(state.cameraCatmullTension ?? 1),
        rotationInterpolationStrength: Number(state.cameraRotationStrength ?? 0),
        timingInterpolationStrength: Number(state.cameraEaseStrength ?? 0),
        catmullTension: Number(state.cameraCatmullTension ?? 1),
        easeStrength: Number(state.cameraEaseStrength ?? 0),
        keyframes: (Array.isArray(state.keyframes) ? state.keyframes : []).map((keyframe) => ({
            frame: Math.round(Number(keyframe.frame) || 0),
            time: Number(keyframe.time) || 0,
            camera: {
                position: { ...keyframe.camera?.position },
                rotation: { ...keyframe.camera?.rotation },
            },
        })),
        fovKeyframes: (Array.isArray(state.cameraFovKeyframes) ? state.cameraFovKeyframes : []).map((keyframe) => ({
            frame: Math.round(Number(keyframe.frame) || 0),
            time: Number(keyframe.time) || 0,
            fovDegrees: Number(keyframe.fovDegrees || getFallbackTimelineCameraFov()),
        })),
    };
}

function exportCameraSequence() {
    const payload = buildCameraSequenceExportPayload();
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'visionary-camera-sequence.json';
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
    showInfo(t('messages.cameraSequenceExported', {
        poseCount: payload.keyframes.length,
        fovCount: payload.fovKeyframes.length,
    }));
}

function clearCameraSequence() {
    if (!confirm(t('messages.clearCameraSequenceConfirm'))) return;
    stopTimelinePlayback(false);
    if (state.demoScene?.active) {
        state.demoScene.keyframeRevealQueue = [];
        state.demoScene.nextKeyframeIndex = 0;
    }
    state.keyframes = [];
    state.cameraFovKeyframes = [];
    state.currentKeyframeIndex = -1;
    setTimelineFrame(0, { applyPose: false, syncSlider: true });
    updateTimelineUI();
    syncCameraSequenceVisualization();
    showInfo(t('messages.cameraSequenceCleared'));
}

async function importCameraSequenceFromFile(file) {
    if (!file) return;
    try {
        const raw = JSON.parse(await file.text());
        if (!Array.isArray(raw?.keyframes)) {
            throw new Error(t('messages.missingKeyframesArray'));
        }

        if (Number.isFinite(raw.timelineFps)) {
            setTimelineFps(raw.timelineFps);
        }
        if (Number.isFinite(raw.timelinePlaybackSpeed)) {
            state.timelinePlaybackSpeed = Number(raw.timelinePlaybackSpeed) || 1;
            if (dom.timelineSpeed) dom.timelineSpeed.value = String(state.timelinePlaybackSpeed);
        }
        if (
            raw.positionInterpolationStrength !== undefined
            || raw.rotationInterpolationStrength !== undefined
            || raw.timingInterpolationStrength !== undefined
            ||
            raw.positionInterpolationMode
            || raw.rotationInterpolationMode
            || raw.timingInterpolationMode
            || raw.catmullTension !== undefined
            || raw.easeStrength !== undefined
        ) {
            applyCameraInterpolationSettings({
                positionStrength: raw.positionInterpolationStrength,
                rotationStrength: raw.rotationInterpolationStrength,
                timingStrength: raw.timingInterpolationStrength,
                positionMode: raw.positionInterpolationMode,
                rotationMode: raw.rotationInterpolationMode,
                timingMode: raw.timingInterpolationMode,
                catmullTension: raw.catmullTension,
                easeStrength: raw.easeStrength,
            });
        } else if (raw.interpolationMode) {
            applyCameraInterpolationSettings(resolveCameraInterpolationStateFromLegacy(raw.interpolationMode, raw.interpolationParam));
        }
        if (Number.isFinite(raw.timelineDurationSec)) {
            state.timelineDurationSec = Math.max(TIMELINE_MIN_DURATION_SEC, Number(raw.timelineDurationSec));
        }

        state.keyframes = raw.keyframes
            .map((item) => {
                const time = Number(item?.time);
                const frameRaw = Number(item?.frame);
                const frame = Number.isFinite(frameRaw)
                    ? Math.round(frameRaw)
                    : timeToFrame(Number.isFinite(time) ? time : 0);
                if (!item?.camera?.position) return null;
                return {
                    frame: clampTimelineFrame(frame),
                    time: Number.isFinite(time) ? time : frameToTime(frame),
                    camera: item.camera,
                };
            })
            .filter(Boolean)
            .sort((a, b) => a.frame - b.frame);
        state.cameraFovKeyframes = Array.isArray(raw?.fovKeyframes)
            ? raw.fovKeyframes
                .map((item) => {
                    const time = Number(item?.time);
                    const frameRaw = Number(item?.frame);
                    const frame = Number.isFinite(frameRaw)
                        ? Math.round(frameRaw)
                        : timeToFrame(Number.isFinite(time) ? time : 0);
                    const fovDegrees = clampSceneFov(item?.fovDegrees);
                    if (fovDegrees === null) return null;
                    return {
                        frame: clampTimelineFrame(frame),
                        time: Number.isFinite(time) ? time : frameToTime(frame),
                        fovDegrees,
                    };
                })
                .filter(Boolean)
                .sort((a, b) => a.frame - b.frame)
            : state.keyframes
                .map((item) => {
                    const fovDegrees = clampSceneFov(item?.camera?.fovDegrees);
                    if (fovDegrees === null) return null;
                    return {
                        frame: Number(item.frame) || 0,
                        time: Number(item.time) || 0,
                        fovDegrees,
                    };
                })
                .filter(Boolean)
                .sort((a, b) => a.frame - b.frame);

        state.currentKeyframeIndex = -1;
        setTimelineFrame(0, { applyPose: false, syncSlider: true });
        updateTimelineUI();
        syncCameraSequenceVisualization();
        showInfo(t('messages.cameraSequenceImported', {
            poseCount: state.keyframes.length,
            fovCount: state.cameraFovKeyframes.length,
        }));
    } catch (error) {
        console.error(`[Editor ${state.VERSION}] importCameraSequence failed:`, error);
        showError(t('messages.cameraSequenceImportFailed', { message: error?.message || String(error) }));
    }
}

/**
 * 更新播放按钮 UI
 */
function updatePlayButtonUI() {
    if (!dom.btnPlayCamera) return;
    if (state.isPlaying) {
        dom.btnPlayCamera.classList.add('active');
        dom.btnPlayCamera.classList.add('is-playing');
        const pauseLabel = t('timeline.pauseCamera');
        dom.btnPlayCamera.setAttribute('title', pauseLabel);
        dom.btnPlayCamera.setAttribute('aria-label', pauseLabel);
    } else {
        dom.btnPlayCamera.classList.remove('active');
        dom.btnPlayCamera.classList.remove('is-playing');
        dom.btnPlayCamera.setAttribute('title', t('timeline.playCamera'));
        dom.btnPlayCamera.setAttribute('aria-label', t('timeline.playCamera'));
    }
}

function startAnimationControlsSyncLoop() {
    if (animationUiSyncTimer) return;
    animationUiSyncTimer = window.setInterval(() => {
        if (!app || !state.selectedModelId) return;
        const anim = app.getModelAnimationState(state.selectedModelId);
        if (!anim || !anim.supported) return;
        updateModelAnimationControls(state.selectedModelId);
    }, 180);
}

/**
 * 球面线性插值 quaternion
 */
function slerpQuaternion(a, b, t) {
    const qa = normalizeQuaternionValue(a);
    const qb = normalizeQuaternionValue(b);
    const q1 = [qa.x, qa.y, qa.z, qa.w];
    let q2 = [qb.x, qb.y, qb.z, qb.w];
    let dot = q1[0] * q2[0] + q1[1] * q2[1] + q1[2] * q2[2] + q1[3] * q2[3];

    if (dot < 0) {
        dot = -dot;
        q2 = [-q2[0], -q2[1], -q2[2], -q2[3]];
    }

    if (dot > 0.9995) {
        const out = {
            x: q1[0] + t * (q2[0] - q1[0]),
            y: q1[1] + t * (q2[1] - q1[1]),
            z: q1[2] + t * (q2[2] - q1[2]),
            w: q1[3] + t * (q2[3] - q1[3]),
        };
        const len = Math.hypot(out.x, out.y, out.z, out.w) || 1;
        out.x /= len;
        out.y /= len;
        out.z /= len;
        out.w /= len;
        return out;
    }

    const theta0 = Math.acos(Math.min(1, Math.max(-1, dot)));
    const sinTheta0 = Math.sin(theta0);
    const theta = theta0 * t;
    const sinTheta = Math.sin(theta);
    const s0 = Math.cos(theta) - dot * sinTheta / Math.max(sinTheta0, 1e-6);
    const s1 = sinTheta / Math.max(sinTheta0, 1e-6);

    return {
        x: s0 * q1[0] + s1 * q2[0],
        y: s0 * q1[1] + s1 * q2[1],
        z: s0 * q1[2] + s1 * q2[2],
        w: s0 * q1[3] + s1 * q2[3],
    };
}

function interpolateCameraPoseLinear(a, b, t) {
    const rot = slerpQuaternion(a.camera.rotation, b.camera.rotation, t);
    return {
        position: {
            x: a.camera.position.x + (b.camera.position.x - a.camera.position.x) * t,
            y: a.camera.position.y + (b.camera.position.y - a.camera.position.y) * t,
            z: a.camera.position.z + (b.camera.position.z - a.camera.position.z) * t,
        },
        rotation: rot,
    };
}

function getKeyframePositionVector(keyframe) {
    return {
        x: Number(keyframe?.camera?.position?.x) || 0,
        y: Number(keyframe?.camera?.position?.y) || 0,
        z: Number(keyframe?.camera?.position?.z) || 0,
    };
}

function addVec3(a, b) {
    return {
        x: a.x + b.x,
        y: a.y + b.y,
        z: a.z + b.z,
    };
}

function subVec3(a, b) {
    return {
        x: a.x - b.x,
        y: a.y - b.y,
        z: a.z - b.z,
    };
}

function scaleVec3(v, s) {
    return {
        x: v.x * s,
        y: v.y * s,
        z: v.z * s,
    };
}

function evaluateHermiteVec3(p1, p2, m1, m2, t) {
    const t2 = t * t;
    const t3 = t2 * t;
    const h00 = (2 * t3) - (3 * t2) + 1;
    const h10 = t3 - (2 * t2) + t;
    const h01 = (-2 * t3) + (3 * t2);
    const h11 = t3 - t2;
    return {
        x: (h00 * p1.x) + (h10 * m1.x) + (h01 * p2.x) + (h11 * m2.x),
        y: (h00 * p1.y) + (h10 * m1.y) + (h01 * p2.y) + (h11 * m2.y),
        z: (h00 * p1.z) + (h10 * m1.z) + (h01 * p2.z) + (h11 * m2.z),
    };
}

function lerpNumber(a, b, t) {
    return a + (b - a) * t;
}

function lerpVec3(a, b, t) {
    return {
        x: lerpNumber(a.x, b.x, t),
        y: lerpNumber(a.y, b.y, t),
        z: lerpNumber(a.z, b.z, t),
    };
}

function easeInOutCubic(t) {
    if (t <= 0) return 0;
    if (t >= 1) return 1;
    return t < 0.5
        ? 4 * t * t * t
        : 1 - Math.pow(-2 * t + 2, 3) / 2;
}

function remapInterpolationTime(t, strength = state.cameraEaseStrength) {
    const clampedT = Math.max(0, Math.min(1, Number(t) || 0));
    const clampedStrength = Math.max(-1, Math.min(1, Number(strength) || 0));
    const strengthMagnitude = Math.abs(clampedStrength);
    const eased = easeInOutCubic(clampedT);
    if (clampedStrength >= 0) {
        return lerpNumber(clampedT, eased, strengthMagnitude);
    }
    const fastNearKeyframes = clampedT < 0.5
        ? 0.5 * (1 - Math.pow(1 - (clampedT * 2), 3))
        : 0.5 + (0.5 * Math.pow((clampedT * 2) - 1, 3));
    return lerpNumber(clampedT, fastNearKeyframes, strengthMagnitude);
}

function buildVirtualBoundaryKeyframe(anchor, neighbor) {
    const anchorPos = getKeyframePositionVector(anchor);
    const neighborPos = getKeyframePositionVector(neighbor);
    const mirroredPos = subVec3(scaleVec3(anchorPos, 2), neighborPos);
    const anchorTime = Number(anchor?.time) || 0;
    const neighborTime = Number(neighbor?.time) || anchorTime;
    return {
        time: anchorTime - (neighborTime - anchorTime),
        camera: {
            position: mirroredPos,
        },
    };
}

function interpolateCameraPositionCatmull(keyframes, index, t, tension = state.cameraCatmullTension) {
    const current = keyframes[index];
    const next = keyframes[index + 1];
    if (!current || !next) return null;

    const prev = keyframes[index - 1] || buildVirtualBoundaryKeyframe(current, next);
    const nextNext = keyframes[index + 2] || buildVirtualBoundaryKeyframe(next, current);

    const p0 = getKeyframePositionVector(prev);
    const p1 = getKeyframePositionVector(current);
    const p2 = getKeyframePositionVector(next);
    const p3 = getKeyframePositionVector(nextNext);

    const t0 = Number(prev?.time);
    const t1 = Number(current?.time);
    const t2 = Number(next?.time);
    const t3 = Number(nextNext?.time);

    if (![t0, t1, t2, t3].every(Number.isFinite)) {
        return {
            x: p1.x + (p2.x - p1.x) * t,
            y: p1.y + (p2.y - p1.y) * t,
            z: p1.z + (p2.z - p1.z) * t,
        };
    }

    const dt10 = Math.max(1e-6, t1 - t0);
    const dt21 = Math.max(1e-6, t2 - t1);
    const dt20 = Math.max(1e-6, t2 - t0);
    const dt31 = Math.max(1e-6, t3 - t1);
    const tensionScale = Math.max(0, Math.min(1, 1 - (Number(tension) || 0)));

    const velocity1 = scaleVec3(subVec3(p2, p0), 1 / dt20);
    const velocity2 = scaleVec3(subVec3(p3, p1), 1 / dt31);
    const tangent1 = scaleVec3(velocity1, dt21 * tensionScale);
    const tangent2 = scaleVec3(velocity2, dt21 * tensionScale);

    const position = evaluateHermiteVec3(p1, p2, tangent1, tangent2, t);
    if (![position.x, position.y, position.z].every(Number.isFinite)) {
        return {
            x: p1.x + (p2.x - p1.x) * t,
            y: p1.y + (p2.y - p1.y) * t,
            z: p1.z + (p2.z - p1.z) * t,
        };
    }

    return position;
}

function interpolateCameraPositionByMode(keyframes, index, t, mode = state.cameraPositionInterpolation) {
    const a = keyframes[index];
    const b = keyframes[index + 1];
    if (!a || !b) return null;
    const linearity = clampCameraCatmullTension(state.cameraCatmullTension);
    const linear = {
        x: lerpNumber(a.camera.position.x, b.camera.position.x, t),
        y: lerpNumber(a.camera.position.y, b.camera.position.y, t),
        z: lerpNumber(a.camera.position.z, b.camera.position.z, t),
    };
    if (normalizeCameraPositionInterpolationMode(mode) === CAMERA_POSITION_INTERPOLATION_LINEAR || linearity >= 1) {
        return linear;
    }
    const smooth = interpolateCameraPositionCatmull(keyframes, index, t, 0);
    if (!smooth) {
        return linear;
    }
    return lerpVec3(smooth, linear, linearity);
}

function interpolateCameraRotationByMode(keyframes, index, t, mode = state.cameraRotationInterpolation) {
    const a = keyframes[index];
    const b = keyframes[index + 1];
    if (!a || !b) return null;
    const squadStrength = clampCameraRotationStrength(state.cameraRotationStrength);
    const slerp = slerpQuaternion(a.camera.rotation, b.camera.rotation, t);
    if (normalizeCameraRotationInterpolationMode(mode) === CAMERA_ROTATION_INTERPOLATION_SLERP || squadStrength <= 0) {
        return slerp;
    }
    if (!Array.isArray(keyframes) || keyframes.length < 3) {
        return slerp;
    }
    const prev = keyframes[index - 1]?.camera?.rotation || a.camera.rotation;
    const next = keyframes[index + 2]?.camera?.rotation || b.camera.rotation;
    const squad = interpolateQuaternionSquad(prev, a.camera.rotation, b.camera.rotation, next, t);
    return slerpQuaternion(slerp, squad, squadStrength);
}

function interpolateCameraPoseAt(timeSec) {
    if (state.keyframes.length === 0) return null;
    const keyframes = state.keyframes;
    const positionMode = resolveCameraPositionInterpolationModeFromTension(state.cameraCatmullTension);
    const rotationMode = resolveCameraRotationInterpolationModeFromStrength(state.cameraRotationStrength);
    const timingMode = resolveCameraTimingInterpolationModeFromStrength(state.cameraEaseStrength);

    if (timeSec <= keyframes[0].time) {
        return applyTimelineFovToPose(keyframes[0].camera, timeSec);
    }
    const last = keyframes[keyframes.length - 1];
    if (timeSec >= last.time) {
        return applyTimelineFovToPose(last.camera, timeSec);
    }

    for (let i = 0; i < keyframes.length - 1; i++) {
        const a = keyframes[i];
        const b = keyframes[i + 1];
        if (timeSec < a.time || timeSec > b.time) continue;

        const span = Math.max(1e-6, b.time - a.time);
        const t = (timeSec - a.time) / span;
        const timedT = timingMode === CAMERA_TIMING_INTERPOLATION_EASE
            ? remapInterpolationTime(t, state.cameraEaseStrength)
            : t;
        const position = interpolateCameraPositionByMode(keyframes, i, timedT, positionMode);
        const rotation = interpolateCameraRotationByMode(keyframes, i, timedT, rotationMode);
        if (
            !position
            || !rotation
            || ![position.x, position.y, position.z, rotation.x, rotation.y, rotation.z, rotation.w].every(Number.isFinite)
        ) {
            return applyTimelineFovToPose(interpolateCameraPoseLinear(a, b, timedT), timeSec);
        }
        return applyTimelineFovToPose({
            position,
            rotation,
        }, timeSec);
    }

    return applyTimelineFovToPose(last.camera, timeSec);
}

function stopTimelinePlayback(resetToStart = false) {
    state.isPlaying = false;
    syncCameraSequenceInteractionEnabled();
    if (timelinePlaybackRaf) {
        cancelAnimationFrame(timelinePlaybackRaf);
        timelinePlaybackRaf = 0;
    }

    if (resetToStart) {
        setTimelineFrame(0, { applyPose: true, syncSlider: true });
    } else {
        updateTimelineUI();
    }
    updatePlayButtonUI();
}

function tickTimelinePlayback(timestamp) {
    if (!state.isPlaying) return;

    const now = Number(timestamp) || performance.now();
    let dt = Math.max(0, Math.min(0.1, (now - timelinePlaybackLastTime) / 1000));
    dt *= state.timelinePlaybackSpeed;
    timelinePlaybackLastTime = now;

    const duration = frameToTime(getTimelineTotalFrames());
    const nextTime = state.currentTime + dt;
    if (nextTime >= duration) {
        const finalFrame = getTimelineTotalFrames();
        if (state.isLooping) {
            if (state.selectedFrame !== 0) {
                setTimelineFrame(0, { applyPose: true, syncSlider: true, lightweightUi: true });
            } else {
                state.currentTime = 0;
                updateTimeDisplay();
            }
        } else {
            setTimelineFrame(finalFrame, { applyPose: true, syncSlider: true, lightweightUi: true });
            stopTimelinePlayback(false);
            return;
        }
    } else {
        const nextFrame = timeToFrame(nextTime);
        if (nextFrame !== state.selectedFrame) {
            setTimelineFrame(nextFrame, { applyPose: true, syncSlider: true, lightweightUi: true });
        } else {
            state.currentTime = nextTime;
            updateTimeDisplay();
        }
    }

    timelinePlaybackRaf = requestAnimationFrame(tickTimelinePlayback);
}

/**
 * 播放/暂停相机动画
 */
function playCameraAnimation() {
    if (state.isPlaying) {
        stopTimelinePlayback(false);
        showInfo(t('messages.cameraAnimationPaused'));
        return;
    }

    setCameraPreviewOpen(true);
    if (state.selectedFrame >= getTimelineTotalFrames()) {
        setTimelineFrame(0, { applyPose: true, syncSlider: true });
    }
    state.isPlaying = true;
    syncCameraSequenceInteractionEnabled();
    timelinePlaybackLastTime = performance.now();
    updatePlayButtonUI();
    timelinePlaybackRaf = requestAnimationFrame(tickTimelinePlayback);
    showInfo(t('messages.cameraAnimationPlaying'));
}

/**
 * 切换循环播放
 */
function toggleCameraLoop() {
    state.isLooping = !state.isLooping;

    const btn = dom.btnLoopCamera;
    if (dom.btnLoopCamera) {
        if (state.isLooping) {
            btn.classList.add('active');
        } else {
            btn.classList.remove('active');
        }
    }
    showInfo(t('messages.cameraAnimationLoopState', { state: state.isLooping ? t('common.active') : t('common.inactive') }));
}

/**
 * 更新时间显示
 */
function updateTimeDisplay() {
    if (dom.timeValue) dom.timeValue.textContent = `${state.currentTime.toFixed(3)}s`;
}

function handleTimelinePointerSelection(event) {
    if (keyframeMarkerDrag) return;
    if (suppressMarkerClickOnce) {
        suppressMarkerClickOnce = false;
        return;
    }
    const target = event.currentTarget;
    const frame = timelineClientXToFrame(event.clientX, target);
    setTimelineFrame(frame, { applyPose: true, syncSlider: true });
    syncManualTimelineCameraSelection(frame);
}

function initTimelineUI() {
    const initialFps = Number(dom.timelineFps?.value || state.timelineFps);
    if (Number.isFinite(initialFps) && initialFps > 0) {
        state.timelineFps = initialFps;
    }
    if (dom.timelineFps) {
        const hasOptions = Array.from(dom.timelineFps.options || []).length > 0;
        if (!hasOptions) {
            dom.timelineFps.innerHTML = TIMELINE_FPS_OPTIONS
                .map((fps) => `<option value="${fps}">${fps}</option>`)
                .join('');
        }
        dom.timelineFps.value = String(state.timelineFps);
    }
    const savedPositionInterpolationMode = localStorage.getItem(CAMERA_POSITION_INTERPOLATION_STORAGE_KEY);
    const savedRotationInterpolationMode = localStorage.getItem(CAMERA_ROTATION_INTERPOLATION_STORAGE_KEY);
    const savedTimingInterpolationMode = localStorage.getItem(CAMERA_TIMING_INTERPOLATION_STORAGE_KEY);
    const savedPositionStrength = localStorage.getItem(CAMERA_POSITION_INTERPOLATION_STRENGTH_STORAGE_KEY);
    const savedCatmullTension = localStorage.getItem(CAMERA_CATMULL_TENSION_STORAGE_KEY);
    const savedRotationStrength = localStorage.getItem(CAMERA_ROTATION_STRENGTH_STORAGE_KEY);
    const savedEaseStrength = localStorage.getItem(CAMERA_EASE_STRENGTH_STORAGE_KEY);
    const savedLegacyInterpolationMode = localStorage.getItem(LEGACY_CAMERA_INTERPOLATION_MODE_STORAGE_KEY);
    const savedLegacyInterpolationParam = localStorage.getItem(LEGACY_CAMERA_INTERPOLATION_PARAM_STORAGE_KEY);
    const savedCameraDisplayScale = localStorage.getItem(CAMERA_DISPLAY_SCALE_STORAGE_KEY);
    const savedCameraPreviewAspectId = localStorage.getItem(CAMERA_PREVIEW_ASPECT_STORAGE_KEY);
    if (savedPositionInterpolationMode || savedRotationInterpolationMode || savedTimingInterpolationMode || savedPositionStrength !== null || savedCatmullTension !== null || savedRotationStrength !== null || savedEaseStrength !== null) {
        applyCameraInterpolationSettings({
            positionStrength: savedPositionStrength,
            rotationStrength: savedRotationStrength,
            timingStrength: savedEaseStrength,
            positionMode: savedPositionInterpolationMode,
            rotationMode: savedRotationInterpolationMode,
            timingMode: savedTimingInterpolationMode,
            catmullTension: savedCatmullTension,
        }, { syncVisualization: false });
    } else if (savedLegacyInterpolationMode || savedLegacyInterpolationParam !== null) {
        applyCameraInterpolationSettings(
            resolveCameraInterpolationStateFromLegacy(savedLegacyInterpolationMode, savedLegacyInterpolationParam),
            { syncVisualization: false }
        );
    }
    if (savedCameraDisplayScale !== null) {
        state.cameraSequenceDisplayScale = clampCameraSequenceDisplayScale(savedCameraDisplayScale);
    }
    if (savedCameraPreviewAspectId !== null) {
        state.cameraPreviewAspectId = normalizeCameraPreviewAspectId(savedCameraPreviewAspectId);
    }
    syncCameraInterpolationControls();
    applyCameraPreviewAspect(state.cameraPreviewAspectId, true);
    setCameraSequenceDisplayScale(state.cameraSequenceDisplayScale, true);
    setTimelineFrame(0, { applyPose: false, syncSlider: true });
    syncCameraSequenceVisualization();
}

/**
 * 设置相机预设
 */
function setCameraPreset(preset) {
    dom.presetBtns.forEach(btn => {
        btn.classList.remove('active');
        if (btn.dataset.preset === preset) {
            btn.classList.add('active');
        }
    });
    showInfo(t('messages.cameraPresetSet', { preset }));
}

function isEditingText() {
    const active = document.activeElement;
    if (!active) return false;
    if (active.isContentEditable) return true;
    if (active instanceof HTMLTextAreaElement) return true;
    if (active instanceof HTMLInputElement) {
        const type = String(active.type || '').toLowerCase();
        return (
            type === 'text' ||
            type === 'search' ||
            type === 'url' ||
            type === 'tel' ||
            type === 'password' ||
            type === 'email' ||
            type === 'number'
        );
    }
    return false;
}

function handleGlobalShortcuts(e) {
    if (e.repeat) return;
    if (isEditingText()) return;

    if (e.key === '`' || e.key === '~') {
        e.preventDefault();
        toggleClearScreenMode();
        return;
    }

    if (e.key === '?') {
        e.preventDefault();
        openHelpTipsModal();
        return;
    }

    if (e.code === 'Space') {
        e.preventDefault();
        playCameraAnimation();
        return;
    }

    if (e.ctrlKey && e.key.toLowerCase() === 'f') {
        e.preventDefault();
        addKeyframeFromShortcut();
        return;
    }

    if (!e.ctrlKey && !e.metaKey && !e.altKey) {
        if (e.key === '1') {
            e.preventDefault();
            setViewportGizmoMode('translate');
            return;
        }
        if (e.key === '2') {
            e.preventDefault();
            setViewportGizmoMode('rotate');
            return;
        }
        if (e.key === '3') {
            e.preventDefault();
            setViewportGizmoMode('scale');
            return;
        }
    }

    if (e.key.toLowerCase() === 'f') {
        if (!app || !state.selectedModelId) return;
        e.preventDefault();
        const ok = app.focusModel(state.selectedModelId);
        if (ok) {
            const model = app.getModel(state.selectedModelId);
            if (model) showInfo(t('messages.focusModel', { name: model.name }));
        }
        return;
    }

    if (e.key.toLowerCase() === 'x') {
        if (!app) return;
        e.preventDefault();
        const ok = app.uprightCamera();
        if (ok) {
            showInfo(t('messages.cameraUpright'));
        }
    }
}

/**
 * 初始化事件监听
 */
function initEventListeners() {
    console.log(`[Editor ${state.VERSION}] Initializing event listeners...`);
    setupInputLabelDrag();
    initPanelWheelScroll();
    dom.btnToggleAgentWorkbench?.addEventListener('click', () => setAgentWorkbenchCollapsed(!state.agentWorkbenchCollapsed));
    dom.agentWorkbenchResizer?.addEventListener('mousedown', beginAgentWorkbenchResize);
    dom.agentWorkflowTabs?.addEventListener('click', handleAgentWorkflowClick);
    dom.btnUserSession?.addEventListener('click', async (e) => {
        e.preventDefault();
        e.stopPropagation();
        await openProjectSessionPopover();
    });
    dom.btnLoginModalClose?.addEventListener('click', closeLoginModal);
    dom.btnProjectSessionClose?.addEventListener('click', closePostLoginProjectModal);
    dom.btnProjectSessionLoginCancel?.addEventListener('click', closeLoginModal);
    dom.btnWorkspaceTargetClose?.addEventListener('click', closeWorkspaceTargetModal);
    dom.btnWorkspaceTargetCancel?.addEventListener('click', closeWorkspaceTargetModal);
    dom.btnWorkspaceTargetServer?.addEventListener('click', async () => {
        const reason = dom.workspaceTargetModal?.dataset.reason || 'status';
        await handleWorkspaceTargetServerSelection({ reason });
    });
    dom.btnWorkspaceTargetLocal?.addEventListener('click', async () => {
        const reason = dom.workspaceTargetModal?.dataset.reason || 'status';
        await handleWorkspaceTargetLocalSelection({ reason });
    });
    dom.btnProjectSessionLogin?.addEventListener('click', async () => {
        const user = String(dom.projectSessionUsernameInput?.value || '').trim();
        if (!user) {
            showError(t('projectSession.enterUsername'));
            return;
        }
        setProjectSessionUser(user);
        closeLoginModal();
        if (state.projectSession.isAdmin) {
            openAdminProjectModal();
            return;
        }
        if (state.pendingWorkspaceTargetAction?.type === 'create-server-project-from-loaded-scene') {
            openPostLoginProjectModal();
            return;
        }
        if (hasCurrentSceneDraftToSave()) {
            openPostLoginProjectModal();
            return;
        }
        syncProjectSessionButton();
        updateWorkspaceStatusIndicator();
        showInfo(t('projectSession.loggedInAs', { user }));
    });
    dom.btnProjectSessionCreateProject?.addEventListener('click', () => {
        void createServerProjectFromCurrentScene();
    });
    dom.projectSessionNewProjectName?.addEventListener('input', () => {
        clearProjectNameConflictState(dom.projectSessionNewProjectName, dom.projectSessionNewProjectNameError);
    });
    dom.btnProjectSessionDiscard?.addEventListener('click', () => {
        setPendingWorkspaceTargetAction(null);
        closePostLoginProjectModal();
        showInfo(t('projectSession.keptWithoutCreating'));
    });
    dom.projectBrowserProjectGrid?.addEventListener('click', (event) => {
        const button = event.target.closest?.('[data-project-open]');
        if (!(button instanceof HTMLElement)) return;
        const projectId = String(button.dataset.projectOpen || '').trim();
        if (!projectId) return;
        void openServerProject(projectId);
    });
    dom.btnProjectBrowserClose?.addEventListener('click', closeProjectBrowserModal);
    dom.btnProjectBrowserSaveAs?.addEventListener('click', openProjectBrowserSaveAsPanel);
    dom.projectBrowserSaveAsName?.addEventListener('input', () => {
        clearProjectNameConflictState(dom.projectBrowserSaveAsName, dom.projectBrowserSaveAsNameError);
    });
    dom.btnProjectBrowserSaveAsCancel?.addEventListener('click', closeProjectBrowserSaveAsPanel);
    dom.btnProjectBrowserSaveAsConfirm?.addEventListener('click', async () => {
        const saved = await createServerProjectFromCurrentScene({
            nameInput: dom.projectBrowserSaveAsName,
            closeModal: false,
        });
        if (saved) {
            closeProjectBrowserSaveAsPanel();
        }
    });
    dom.btnProjectBrowserLogout?.addEventListener('click', () => {
        logoutProjectSession();
    });
    dom.btnAdminProjectClose?.addEventListener('click', closeAdminProjectModal);
    dom.btnAdminProjectLogout?.addEventListener('click', () => {
        logoutProjectSession();
    });
    dom.adminUserList?.addEventListener('click', (event) => {
        const deleteButton = event.target.closest?.('[data-admin-user-delete]');
        if (deleteButton instanceof HTMLElement) {
            event.stopPropagation();
            void deleteAdminUser(String(deleteButton.dataset.adminUserDelete || '').trim());
            return;
        }
        const card = event.target.closest?.('[data-admin-user-select]');
        if (!(card instanceof HTMLElement)) return;
        const user = String(card.dataset.adminUserSelect || '').trim();
        if (!user) return;
        state.projectSession.adminSelectedUser = user;
        renderAdminUserList();
        void refreshAdminSelectedUserProjects();
    });
    dom.adminProjectGrid?.addEventListener('click', (event) => {
        const deleteButton = event.target.closest?.('[data-admin-project-delete]');
        if (!(deleteButton instanceof HTMLElement)) return;
        const projectId = String(deleteButton.dataset.adminProjectDelete || '').trim();
        if (!projectId || !state.projectSession.adminSelectedUser) return;
        void deleteAdminProject(state.projectSession.adminSelectedUser, projectId);
    });
    dom.agentMessageScroll?.addEventListener('scroll', syncAgentMessageScrollbar);
    dom.agentMessageScrollbar?.addEventListener('mousedown', beginAgentMessageScrollbarDrag);
    dom.agentComposerInput?.addEventListener('keydown', handleAgentComposerKeydown);
    dom.agentComposerAttachments?.addEventListener('click', handleAgentComposerAttachmentClick);
    dom.agentMessageList?.addEventListener('click', handleAgentMessageListClick);
    dom.btnAgentAddImage?.addEventListener('click', openAgentImagePicker);
    dom.agentImageInput?.addEventListener('change', handleAgentImageInputChange);
    dom.agentComposerDock?.addEventListener('dragenter', handleAgentComposerDragOver);
    dom.agentComposerDock?.addEventListener('dragover', handleAgentComposerDragOver);
    dom.agentComposerDock?.addEventListener('dragleave', (e) => {
        if (e.relatedTarget instanceof Node && dom.agentComposerDock?.contains(e.relatedTarget)) return;
        clearAgentComposerDropTarget();
    });
    dom.agentComposerDock?.addEventListener('drop', handleAgentComposerDrop);
    dom.agentSuggestionChips?.addEventListener('click', handleAgentSuggestionClick);
    dom.agentComposer?.addEventListener('submit', handleAgentComposerSubmit);
    dom.btnAgentClearConversation?.addEventListener('click', resetAgentConversation);

    // 场景菜单
    dom.btnSaveScene?.addEventListener('click', saveScene);
    dom.btnLoadScene?.addEventListener('click', loadScene);
    dom.btnClearScene?.addEventListener('click', clearScene);
    dom.btnHelpTips?.addEventListener('click', openHelpTipsModal);

    // 模式按钮
    dom.modeColor?.addEventListener('click', () => setExportMode('color'));
    dom.modeDepth?.addEventListener('click', () => setExportMode('depth'));
    dom.modeNormal?.addEventListener('click', () => setExportMode('normal'));

    // 渲染导出
    dom.btnRenderVideo?.addEventListener('click', () => openExportModal('video'));
    dom.btnRenderImage?.addEventListener('click', () => openExportModal('image'));
    dom.btnThemeToggle?.addEventListener('click', toggleTheme);
    dom.btnLanguageToggle?.addEventListener('click', toggleLanguage);
    dom.btnClearScreen?.addEventListener('click', (e) => {
        e.preventDefault();
        toggleClearScreenMode();
    });
    dom.btnClearScreen?.addEventListener('mouseenter', () => setClearScreenPreview(true));
    dom.btnClearScreen?.addEventListener('mouseleave', () => setClearScreenPreview(false));
    dom.btnClearScreen?.addEventListener('focus', () => setClearScreenPreview(true));
    dom.btnClearScreen?.addEventListener('blur', () => setClearScreenPreview(false));
    dom.workspaceStatusIndicator?.addEventListener('click', async (e) => {
        e.preventDefault();
        openWorkspaceTargetModal('status');
    });
    dom.btnExportFlyout?.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        toggleExportFlyout();
    });
    dom.btnRenderVideo?.addEventListener('click', () => setExportFlyoutOpen(false));
    dom.btnRenderImage?.addEventListener('click', () => setExportFlyoutOpen(false));

    // 模型操作 - 添加模型按钮（打开文件选择器）
    dom.btnAddModel?.addEventListener('click', openModelFileSelector);

    // 文件选择（隐藏的 input）
    dom.fileInput?.addEventListener('change', async (e) => {
        const files = e.target.files;
        if (files && files.length > 0) {
            console.log(`[Editor ${state.VERSION}] Files selected:`, files.length);
            for (let i = 0; i < files.length; i++) {
                const file = files[i];
                console.log(`[Editor ${state.VERSION}] Loading file ${i + 1}/${files.length}:`, file.name);
                const result = await app.loadModel(file);
                if (result) {
                    console.log(`[Editor ${state.VERSION}] Model loaded successfully:`, result.name);
                    applyPreviewModeToAllModels(state.exportMode);
                    if (state.selectedModelId) updateModelAnimationControls(state.selectedModelId);
                } else {
                    console.warn(`[Editor ${state.VERSION}] Failed to load model:`, file.name);
                }
                showLoading(true, t('loading.loadingModel', { current: i + 1, total: files.length }), ((i + 1) / files.length) * 100);
            }
            showLoading(false);
            // 清空 input 以便重复选择同一文件
            e.target.value = '';
        }
    });
    dom.cameraSequenceFileInput?.addEventListener('change', async (e) => {
        const file = e.target.files?.[0];
        if (file) {
            await importCameraSequenceFromFile(file);
        }
        e.target.value = '';
    });

    // 模态框按钮
    dom.modalCancel?.addEventListener('click', () => {
        if (dom.modelModal) dom.modelModal.classList.add('hidden');
    });
    dom.modalConfirm?.addEventListener('click', () => {
        openModelFileSelector();
    });
    dom.exportCancel?.addEventListener('click', () => {
        closeExportModal();
    });
    dom.exportConfirm?.addEventListener('click', () => {
        onConfirmExportModal();
    });
    dom.exportModal?.addEventListener('click', (e) => {
        if (e.target === dom.exportModal) {
            closeExportModal();
        }
    });
    dom.loginModal?.addEventListener('click', (e) => {
        if (e.target === dom.loginModal) {
            closeLoginModal();
        }
    });
    dom.postLoginProjectModal?.addEventListener('click', (e) => {
        if (e.target === dom.postLoginProjectModal) {
            closePostLoginProjectModal();
        }
    });
    dom.projectBrowserModal?.addEventListener('click', (e) => {
        if (e.target === dom.projectBrowserModal) {
            closeProjectBrowserModal();
        }
    });
    dom.adminProjectModal?.addEventListener('click', (e) => {
        if (e.target === dom.adminProjectModal) {
            closeAdminProjectModal();
        }
    });
    dom.helpTipsClose?.addEventListener('click', closeHelpTipsModal);
    dom.helpTipsConfirm?.addEventListener('click', closeHelpTipsModal);
    dom.helpTipsModal?.addEventListener('click', (e) => {
        if (e.target === dom.helpTipsModal) {
            closeHelpTipsModal();
        }
    });
    dom.exportAspectRatio?.addEventListener('change', () => {
        if (pendingExportType === 'video') {
            buildExportResolutionOptions(getSelectedExportAspectOption());
        }
    });
    dom.exportVideoSpeed?.addEventListener('change', () => {
        if (pendingExportType === 'video') {
            updateExportTimelineHint('video');
        }
    });
    dom.exportVideoFps?.addEventListener('change', () => {
        if (pendingExportType === 'video') {
            updateExportTimelineHint('video');
        }
    });

    // 模型编辑器 - 编辑器控件
    dom.btnResetTransform?.addEventListener('click', resetTransform);
    dom.modelCountBadge?.addEventListener('click', () => setLeftSidebarCollapsed(!state.leftSidebarCollapsed));
    dom.btnGizmoTranslate?.addEventListener('click', () => setViewportGizmoMode('translate'));
    dom.btnGizmoRotate?.addEventListener('click', () => setViewportGizmoMode('rotate'));
    dom.btnGizmoScale?.addEventListener('click', () => setViewportGizmoMode('scale'));
    dom.btnToggleSceneSettings?.addEventListener('click', () => setSceneSettingsOpen(!state.sceneSettingsOpen));
    dom.btnSceneSettingsClose?.addEventListener('click', () => setSceneSettingsOpen(false));
    dom.btnToggleCameraPreview?.addEventListener('click', () => setCameraPreviewOpen(!state.cameraPreviewOpen, { markDirty: true }));
    dom.btnCameraPreviewClose?.addEventListener('click', () => setCameraPreviewOpen(false, { markDirty: true }));
    dom.btnToggleCameraSettings?.addEventListener('click', () => setCameraSettingsOpen(!state.cameraSettingsOpen));
    dom.btnCameraSettingsClose?.addEventListener('click', () => setCameraSettingsOpen(false));
    dom.cameraPreviewPanel?.addEventListener('pointerdown', () => focusFloatingPanel('cameraPreview'));
    dom.cameraSettingsPanel?.addEventListener('pointerdown', () => focusFloatingPanel('cameraSettings'));
    dom.cameraPreviewPanel?.addEventListener('mousedown', beginCameraPreviewPanelDrag);
    dom.cameraPreviewResizeHandle?.addEventListener('mousedown', beginCameraPreviewPanelResize);
    dom.cameraPreviewAspectRatio?.addEventListener('change', (e) => {
        applyCameraPreviewAspect(e.target.value);
    });
    dom.sceneBgColorPicker?.addEventListener('input', (e) => {
        applySceneBackgroundHex(e.target.value, 'custom');
    });
    dom.sceneBgColorHex?.addEventListener('change', (e) => {
        applySceneBackgroundHex(e.target.value, 'custom');
    });
    dom.sceneDepthScale?.addEventListener('input', updateSceneDepthRangeScaleFromSlider);
    dom.sceneDepthScaleNumber?.addEventListener('input', updateSceneDepthRangeScaleFromInput);
    dom.sceneDepthScaleNumber?.addEventListener('change', commitSceneDepthRangeScaleFromInput);
    dom.sceneDepthScaleNumber?.addEventListener('blur', commitSceneDepthRangeScaleFromInput);
    dom.sceneDepthScaleNumber?.addEventListener('keydown', handleSceneDepthRangeScaleInputKeydown);
    dom.sceneFovRange?.addEventListener('input', (e) => {
        applySceneCameraFov(e.target.value, true);
    });
    dom.sceneFovNumber?.addEventListener('change', (e) => {
        applySceneCameraFov(e.target.value);
    });
    dom.skyPresetGrid?.addEventListener('click', (e) => {
        if (!(e.target instanceof Element)) return;
        const btn = e.target.closest('[data-sky-id]');
        if (!btn) return;
        applySkyPreset(btn.dataset.skyId);
    });

    // 位置
    ['posX', 'posY', 'posZ'].forEach(id => {
        dom[id]?.addEventListener('input', updateModelFromEditor);
    });

    // 旋转
    ['rotX', 'rotY', 'rotZ'].forEach(id => {
        dom[id]?.addEventListener('input', updateModelFromEditor);
    });

    // 缩放
    dom.scaleS?.addEventListener('input', updateModelFromEditor);
    dom.leftSidebarResizer?.addEventListener('mousedown', (e) => beginSidebarResize('left', e));
    dom.rightSidebarResizer?.addEventListener('mousedown', (e) => beginSidebarResize('right', e));

    dom.modelAnimSpeed?.addEventListener('input', updateSelectedModelAnimationSpeedFromSlider);
    dom.modelAnimSpeedValue?.addEventListener('input', updateSelectedModelAnimationSpeedFromInput);
    dom.modelAnimSpeedValue?.addEventListener('change', commitSelectedModelAnimationSpeedFromInput);
    dom.modelAnimSpeedValue?.addEventListener('blur', commitSelectedModelAnimationSpeedFromInput);
    dom.modelAnimSpeedValue?.addEventListener('keydown', handleSelectedModelAnimationSpeedInputKeydown);

    // 相机模式
    dom.cameraMode?.addEventListener('change', (e) => {
        const mode = e.target.value;
        state.cameraMode = mode;
        if (app) app.setCameraMode(mode);
        if (mode !== 'fps' && state.cameraSequenceDragEnabled) {
            setCameraSequenceDragEnabled(false, true);
        }
        showInfo(t('messages.cameraModeSet', { mode }));
    });

    // 时间轴
    dom.btnAddKeyframe?.addEventListener('click', addKeyframe);
    dom.btnRemoveKeyframe?.addEventListener('click', removeKeyframe);
    dom.btnImportCameraSequence?.addEventListener('click', () => dom.cameraSequenceFileInput?.click());
    dom.btnExportCameraSequence?.addEventListener('click', exportCameraSequence);
    dom.btnClearCameraSequence?.addEventListener('click', clearCameraSequence);
    dom.btnPlayCamera?.addEventListener('click', playCameraAnimation);
    dom.btnLoopCamera?.addEventListener('click', toggleCameraLoop);
    dom.btnToggleCameraSequence?.addEventListener('click', () => {
        setCameraSequenceVisibility(!state.cameraSequenceVisible);
    });
    dom.btnToggleCameraSequenceDrag?.addEventListener('click', () => {
        setCameraSequenceDragEnabled(!state.cameraSequenceDragEnabled);
    });
    dom.timelineRotationParam?.addEventListener('input', (e) => {
        setCameraRotationStrength(e.target.value, true);
    });
    dom.timelineRotationParam?.addEventListener('change', (e) => {
        setCameraRotationStrength(e.target.value);
    });
    dom.timelineCatmullParam?.addEventListener('input', (e) => {
        setCameraPositionInterpolationStrength(e.target.value, true);
    });
    dom.timelineCatmullParam?.addEventListener('change', (e) => {
        setCameraPositionInterpolationStrength(e.target.value);
    });
    dom.timelineEaseParam?.addEventListener('input', (e) => {
        setCameraTimingInterpolationStrength(e.target.value, true);
    });
    dom.timelineEaseParam?.addEventListener('change', (e) => {
        setCameraTimingInterpolationStrength(e.target.value);
    });
    dom.cameraDisplayScale?.addEventListener('input', (e) => {
        setCameraSequenceDisplayScale(e.target.value, true);
    });
    dom.cameraDisplayScale?.addEventListener('change', (e) => {
        setCameraSequenceDisplayScale(e.target.value);
    });
    dom.cameraDisplayScaleValue?.addEventListener('input', (e) => {
        setCameraSequenceDisplayScale(e.target.value, true);
    });
    dom.cameraDisplayScaleValue?.addEventListener('change', (e) => {
        setCameraSequenceDisplayScale(e.target.value);
    });
    dom.cameraDisplayScaleValue?.addEventListener('blur', commitCameraSequenceDisplayScaleFromInput);
    dom.cameraDisplayScaleValue?.addEventListener('keydown', handleCameraSequenceDisplayScaleInputKeydown);
    dom.timelineCameraFovRange?.addEventListener('input', (e) => {
        applyTimelineCameraFov(e.target.value, true);
    });
    dom.timelineCameraFovRange?.addEventListener('change', (e) => {
        applyTimelineCameraFov(e.target.value);
    });
    dom.timelineCameraFovNumber?.addEventListener('input', (e) => {
        applyTimelineCameraFov(e.target.value, true);
    });
    dom.timelineCameraFovNumber?.addEventListener('change', (e) => {
        applyTimelineCameraFov(e.target.value);
    });
    dom.timelineCameraFovNumber?.addEventListener('blur', commitTimelineCameraFovFromInput);
    dom.timelineCameraFovNumber?.addEventListener('keydown', handleTimelineCameraFovInputKeydown);
    dom.timelineFps?.addEventListener('change', (e) => {
        setTimelineFps(e.target.value);
    });
    dom.timelineSpeed?.addEventListener('change', (e) => {
        state.timelinePlaybackSpeed = Number(e.target.value) || 1.0;
        showInfo(t('messages.playbackSpeedSet', { speed: state.timelinePlaybackSpeed }));
    });
    dom.timelineRuler?.addEventListener('click', handleTimelinePointerSelection);
    dom.timelineTrack?.addEventListener('click', handleTimelinePointerSelection);
    dom.timelineSlider?.addEventListener('input', (e) => {
        const nextFrame = Math.round(Number(e.target.value || 0));
        setTimelineFrame(nextFrame, { applyPose: true, syncSlider: true });
        syncManualTimelineCameraSelection(nextFrame);
    });

    // 文件拖拽
    console.log(`[Editor ${state.VERSION}] Setting up drag and drop...`);
    document.addEventListener('dragover', (e) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'copy';
    });

    document.addEventListener('drop', async (e) => {
        if (dom.agentComposerDock?.contains(e.target) && queueAgentComposerImages(e.dataTransfer?.files) > 0) {
            e.preventDefault();
            clearAgentComposerDropTarget();
            showInfo(t('messages.imageAddedToComposer'));
            return;
        }
        e.preventDefault();
        console.log(`[Editor ${state.VERSION}] Drop event detected`);
        const files = e.dataTransfer?.files;
        if (files && files.length > 0) {
            console.log(`[Editor ${state.VERSION}] Files dropped:`, files.length);
            for (let i = 0; i < files.length; i++) {
                const file = files[i];
                console.log(`[Editor ${state.VERSION}] Loading dropped file ${i + 1}/${files.length}:`, file.name, file.size, 'bytes');
                const result = await app.loadModel(file);
                if (result) {
                    console.log(`[Editor ${state.VERSION}] Dropped model loaded successfully:`, result.name);
                    applyPreviewModeToAllModels(state.exportMode);
                    if (state.selectedModelId) updateModelAnimationControls(state.selectedModelId);
                } else {
                    console.warn(`[Editor ${state.VERSION}] Failed to load dropped model:`, file.name);
                }
            }
            showLoading(false);
        } else {
            console.warn(`[Editor ${state.VERSION}] Drop event: no files found`);
        }
    });

    // 全局快捷键
    document.addEventListener('keydown', handleGlobalShortcuts);
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && state.cameraPreviewOpen) {
            setCameraPreviewOpen(false, { markDirty: false, silent: true });
            return;
        }
        if (e.key === 'Escape' && state.cameraSettingsOpen) {
            setCameraSettingsOpen(false);
            return;
        }
        if (e.key === 'Escape' && state.exportFlyoutOpen) {
            setExportFlyoutOpen(false);
            return;
        }
        if (e.key === 'Escape' && dom.helpTipsModal && !dom.helpTipsModal.classList.contains('hidden')) {
            closeHelpTipsModal();
            return;
        }
        if (e.key === 'Escape' && dom.exportModal && !dom.exportModal.classList.contains('hidden')) {
            closeExportModal();
            return;
        }
        if (e.key === 'Escape' && dom.loginModal && !dom.loginModal.classList.contains('hidden')) {
            closeLoginModal();
            return;
        }
        if (e.key === 'Escape' && dom.postLoginProjectModal && !dom.postLoginProjectModal.classList.contains('hidden')) {
            closePostLoginProjectModal();
            return;
        }
        if (e.key === 'Escape' && dom.projectBrowserModal && !dom.projectBrowserModal.classList.contains('hidden')) {
            if (dom.projectBrowserSaveAsPanel && !dom.projectBrowserSaveAsPanel.classList.contains('hidden')) {
                closeProjectBrowserSaveAsPanel();
                return;
            }
            closeProjectBrowserModal();
            return;
        }
        if (e.key === 'Escape' && dom.adminProjectModal && !dom.adminProjectModal.classList.contains('hidden')) {
            closeAdminProjectModal();
            return;
        }
    });
    document.addEventListener('pointerdown', (e) => {
        if (!state.exportFlyoutOpen) return;
        if (dom.exportToolFlyout?.contains(e.target)) return;
        setExportFlyoutOpen(false);
    });
    document.addEventListener('mousemove', moveCameraPreviewPanel);
    document.addEventListener('mouseup', endCameraPreviewPanelDrag);
    document.addEventListener('mousemove', moveCameraPreviewPanelResize);
    document.addEventListener('mouseup', endCameraPreviewPanelResize);
    window.addEventListener('resize', () => {
        if (state.cameraPreviewOpen) {
            applyCameraPreviewPanelSize();
            positionCameraPreviewPanel();
        }
        if (state.cameraSettingsOpen) {
            positionCameraSettingsPanel();
        }
    });

    console.log(`[Editor ${state.VERSION}] Event listeners initialized`);
}

/**
 * 应用初始化
 */
async function init() {
    console.log(`[Editor ${state.VERSION}] Initializing...`);
    console.log(`[Editor ${state.VERSION}] Version: ${state.VERSION}`);
    console.log(`[Editor ${state.VERSION}] Checking DOM elements...`);

    // 更新版本标签
    if (dom.versionLabel) {
        dom.versionLabel.textContent = state.VERSION;
    }
    initLanguage();
    initTheme();
    const savedUser = localStorage.getItem(PROJECT_SESSION_USER_STORAGE_KEY) || '';
    if (savedUser) {
        setProjectSessionUser(savedUser);
    } else {
        syncProjectSessionButton();
    }
    updateWorkspaceStatusIndicator();
    window.addEventListener('online', updateWorkspaceStatusIndicator);
    window.addEventListener('offline', updateWorkspaceStatusIndicator);
    initializeAgentWorkbench();
    syncClearScreenState();
    initializeCameraPreviewControls();
    mountCameraPreviewPanelToMainUi();
    mountCameraSettingsPanelToMainUi();

    // 检查关键 DOM 元素是否存在
    if (!dom.canvas) {
        showError(t('messages.canvasNotFound'));
        return;
    }
    console.log(`[Editor ${state.VERSION}] Canvas found`);

    if (!dom.fileInput) {
        console.error(`[Editor ${state.VERSION}] fileInput not found!`);
    }
    if (!dom.btnAddModel) {
        console.error(`[Editor ${state.VERSION}] btnAddModel not found!`);
    }

    // 动态导入 EditorApp
    console.log(`[Editor ${state.VERSION}] Loading EditorApp module...`);
    try {
        const { editorApp } = await import('../src/editor/editor-app.js');
        app = editorApp;
        console.log(`[Editor ${state.VERSION}] EditorApp loaded`);
    } catch (error) {
        console.error(`[Editor ${state.VERSION}] Failed to load EditorApp:`, error);
        showError(t('messages.editorAppModuleLoadFailed', { message: error.message }));
        return;
    }

    // 初始化编辑器应用
    const success = await app.init();
    if (!success) {
        showError(t('messages.editorInitFailed'));
        return;
    }
    await app.attachCameraPreviewCanvas?.(dom.cameraPreviewCanvas || null);
    app.setCameraPreviewVisible?.(state.cameraPreviewOpen);
    app.setCameraPreviewAspectRatio?.(getCameraPreviewAspectOption(state.cameraPreviewAspectId).aspect);
    state.viewportGizmoMode = app.getViewportGizmoMode?.() ?? state.viewportGizmoMode;
    state.cameraSequenceVisible = Boolean(app.getCameraSequenceVisible?.() ?? state.cameraSequenceVisible);
    state.cameraSequenceDisplayScale = clampCameraSequenceDisplayScale(
        app.getCameraSequenceDisplayScale?.() ?? state.cameraSequenceDisplayScale
    );
    state.cameraSequenceDragEnabled = Boolean(
        app.getCameraSequenceEditEnabled?.() ?? state.cameraSequenceDragEnabled
    );

    // 注册模型变化回调
    app.onModelsChanged((models) => {
        updateModelList();
        if (state.selectedModelId) {
            const selected = app.getModel(state.selectedModelId);
            if (selected) {
                updateEditorValues(selected);
            } else {
                closeEditor();
            }
        }
        updateModelAnimationControls(state.selectedModelId);
        
        let maxEnd = state.timelineDurationSec;
        for (const model of models) {
             if (modelHasTimelineAnimation(model) && Number.isFinite(getModelAnimationEndTime(model))) {
                  maxEnd = Math.max(maxEnd, getModelAnimationEndTime(model));
             }
        }
        if (maxEnd > state.timelineDurationSec && Number.isFinite(maxEnd)) {
            state.timelineDurationSec = maxEnd;
            if (typeof updateTimelineUI === 'function') updateTimelineUI();
            showInfo(t('messages.timelineAutoFit', { duration: maxEnd.toFixed(1) }));
        }
        
        if (typeof renderModelTracks === 'function') renderModelTracks();
    });
    app.onViewportGizmoTransform?.((id, model) => {
        if (id !== state.selectedModelId) return;
        updateEditorValues(model);
        markWorkspaceDirty('viewport-gizmo-transform');
    });
    app.onSelectedModel?.((id) => {
        if (syncingSelectedModelSelection) return;
        if (!id) return;
        selectModel(id, { syncApp: false, allowToggle: false, silent: true });
    });
    app.onCameraInteraction?.((kind) => {
        logCameraControlDebug(kind);
        if (state.keyframes.length === 0) {
            syncTimelineDrivenCameraPreviewPose();
        }
    });
    app.onCameraSequenceSelection?.((frame) => {
        if (syncingCameraSequenceSelection) return;
        if (!Number.isFinite(Number(frame))) {
            state.selectedCameraSequenceFrame = null;
            syncCameraSequenceVisualization();
            syncViewportGizmoControls();
            return;
        }
        state.selectedCameraSequenceFrame = Math.round(Number(frame));
        if (state.selectedModelId) {
            closeEditor();
        }
        const normalizedMode = normalizeViewportGizmoModeForSelection(
            state.viewportGizmoMode,
            resolveViewportSelectionKind({
                cameraSequenceDragEnabled: state.cameraSequenceDragEnabled,
                hasTimelineCamera: hasTimelineCameraPose(),
                cameraGizmoTargetFrame: state.selectedCameraSequenceFrame,
                selectedModelId: state.selectedModelId,
                playbackActive: state.isPlaying,
            })
        );
        if (normalizedMode !== state.viewportGizmoMode) {
            setViewportGizmoMode('translate', true);
        }
        setTimelineFrame(state.selectedCameraSequenceFrame, { applyPose: false, syncSlider: true });
        syncCameraSequenceVisualization();
        syncViewportGizmoControls();
    });
    app.onCameraSequenceTransform?.((frame, pose) => {
        updateKeyframeCameraPose(frame, pose);
    });
    app.onCameraSequenceTransformCommit?.((frame, pose) => {
        if (!updateKeyframeCameraPose(frame, pose)) return;
        updateTimelineUI();
        syncCameraSequenceVisualization();
        markWorkspaceDirty('camera-sequence-transform');
    });

    registerAgentSessionActionHandlers({
        onCancel: handleDemoSceneAgentCancel,
        onRetry: handleDemoSceneAgentRetry,
        onApply: handleDemoSceneAgentApply,
    });
    registerDebugHooks();

    // 同步渲染模式（颜色/深度/法向）到核心渲染器
    setExportMode(state.exportMode);

    // 初始化事件监听
    initEventListeners();
    initializeSidebarLayout();
    syncLeftSidebarCollapsedState();
    syncCanvasContainerToViewport();
    window.addEventListener('resize', () => {
        applyAgentWorkbenchWidth(preferredAgentWorkbenchWidth ?? AGENT_WORKBENCH_DEFAULT_WIDTH, false);
        applySidebarWidths(
            preferredLeftSidebarWidth ?? LEFT_SIDEBAR_DEFAULT_WIDTH,
            preferredRightSidebarWidth ?? RIGHT_SIDEBAR_DEFAULT_WIDTH,
            false
        );
        syncCanvasContainerToViewport();
        syncAgentMessageScrollbar();
    });
    initSceneSettingsUI();
    initTimelineUI();
    closeEditor();
    syncSceneSettingsPanel();
    syncCameraPreviewPanel();
    syncViewportGizmoControls();
    syncAgentMessageScrollbar();
    syncCameraSequenceDragButton();
    startAnimationControlsSyncLoop();

    // 初始化时间轴按钮状态
    updatePlayButtonUI();
    if (dom.btnLoopCamera) {
        dom.btnLoopCamera.classList.toggle('active', state.isLooping);
    }
    updateCameraSequenceToggleButton();

    // 初始更新
    updateModelList();

    console.log(`[Editor ${state.VERSION}] Initialized successfully!`);
    console.log(`[Editor ${state.VERSION}] 功能状态：`);
    console.log('');
    console.log('第一阶段功能状态：');
    console.log('3D 场景渲染：已实现（WebGPU + GaussianRenderer）');
    console.log('模型加载：已实现（支持 .ply, .onnx, .glb, .gltf, .obj, .fbx, .stl 等）');
    console.log('相机控制：已实现（轨道/自由模式，预设视角）');
    console.log('');
    console.log('请测试以下功能：');
    console.log('1. 点击"添加模型"按钮，选择文件');
    console.log('2. 拖拽 .ply/.onnx/.glb/.gltf/.obj/.fbx/.stl 文件到页面');
    console.log('3. 使用鼠标控制相机（左键旋转，右键平移，滚轮缩放）');
    console.log('');
    console.log('调试信息：');
    console.log('- 打开浏览器开发者工具查看控制台输出');
    console.log('- 如果有问题，请提供控制台错误信息');
    console.log('- 版本号：', state.VERSION);
}

// 启动应用
document.addEventListener('DOMContentLoaded', init);
