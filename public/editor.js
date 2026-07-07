/**
 * Visionary Editor UI Controller 0.1.9
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
    getAgentAttemptStepBlocks,
    getAgentSessionActiveAttempt,
    patchAgentSessionAttemptBlock,
    normalizeAgentAttemptStatus,
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
    bootLoadingOverlay: document.getElementById('bootLoadingOverlay'),
    app: document.getElementById('app'),
    editorShell: document.getElementById('editor-shell'),
    editorStage: document.getElementById('editor-stage'),
    agentWorkbenchShell: document.getElementById('agent-workbench-shell'),
    agentWorkbench: document.getElementById('agent-workbench'),
    agentWorkbenchCollapsedControls: document.getElementById('agentWorkbenchCollapsedControls'),
    agentWorkbenchResizer: document.getElementById('agent-workbench-resizer'),
    btnToggleAgentWorkbench: document.getElementById('btnToggleAgentWorkbench'),
    agentWorkflowStatus: document.getElementById('agentWorkflowStatus'),
    agentWorkbenchModeTabs: document.getElementById('agentWorkbenchModeTabs'),
    agentWorkbenchCollapsedModeTabs: document.getElementById('agentWorkbenchCollapsedModeTabs'),
    agentWorkflowTabs: document.getElementById('agentWorkflowTabs'),
    assetLibraryTabs: document.getElementById('assetLibraryTabs'),
    agentWorkbenchPanels: Array.from(document.querySelectorAll('[data-mode-panel]')),
    assetLibraryPanels: Array.from(document.querySelectorAll('[data-asset-panel]')),
    btnUserSession: document.getElementById('btnUserSession'),
    btnCollapsedUserSession: document.getElementById('btnCollapsedUserSession'),
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
    agentComposerSkillToolbar: document.getElementById('agentComposerSkillToolbar'),
    agentComposerSkillTokens: document.getElementById('agentComposerSkillTokens'),
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
    timelineCatmullParamValue: document.getElementById('timelineCatmullParamValue'),
    timelineRotationParam: document.getElementById('timelineRotationParam'),
    timelineRotationParamValue: document.getElementById('timelineRotationParamValue'),
    timelineEaseParam: document.getElementById('timelineEaseParam'),
    timelineEaseParamValue: document.getElementById('timelineEaseParamValue'),
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
    projectBrowserCodexAuthInline: document.getElementById('projectBrowserCodexAuthInline'),
    projectBrowserCodexAuthStatus: document.getElementById('projectBrowserCodexAuthStatus'),
    projectBrowserAgentRuntimeStatus: document.getElementById('projectBrowserAgentRuntimeStatus'),
    projectBrowserCodexAuthKey: document.getElementById('projectBrowserCodexAuthKey'),
    projectBrowserSaveAsPanel: document.getElementById('projectBrowserSaveAsPanel'),
    projectBrowserSaveAsName: document.getElementById('projectBrowserSaveAsName'),
    projectBrowserSaveAsNameError: document.getElementById('projectBrowserSaveAsNameError'),
    btnProjectBrowserClose: document.getElementById('btnProjectBrowserClose'),
    btnProjectBrowserCreateNew: document.getElementById('btnProjectBrowserCreateNew'),
    btnProjectBrowserSaveAs: document.getElementById('btnProjectBrowserSaveAs'),
    btnProjectBrowserSaveAsCancel: document.getElementById('btnProjectBrowserSaveAsCancel'),
    btnProjectBrowserSaveAsConfirm: document.getElementById('btnProjectBrowserSaveAsConfirm'),
    btnProjectBrowserEditCodexAuth: document.getElementById('btnProjectBrowserEditCodexAuth'),
    btnProjectBrowserSaveCodexAuth: document.getElementById('btnProjectBrowserSaveCodexAuth'),
    btnProjectBrowserLogout: document.getElementById('btnProjectBrowserLogout'),
    projectCreateModal: document.getElementById('projectCreateModal'),
    projectCreateName: document.getElementById('projectCreateName'),
    projectCreateNameError: document.getElementById('projectCreateNameError'),
    btnProjectCreateClose: document.getElementById('btnProjectCreateClose'),
    btnProjectCreateCancel: document.getElementById('btnProjectCreateCancel'),
    btnProjectCreateConfirm: document.getElementById('btnProjectCreateConfirm'),
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
        canonicalAssetReferences: createEmptyCanonicalAssetReferenceSnapshot(),
        canonicalAssetGcPlan: createEmptyCanonicalAssetGcPlan(),
        projects: [],
        loadingProjects: false,
        lastError: null,
        codexAuthLoading: false,
        codexAuthSaving: false,
        codexAuthEditing: false,
        codexAuthHasAuth: false,
        codexAuthProjectCount: 0,
        renamingProjectId: '',
        renamingProjectName: '',
        renamingProjectError: '',
        adminUsers: [],
        loadingAdminUsers: false,
        adminSelectedUser: '',
    };
}

const DEFAULT_CAMERA_POSITION_TENSION = 0;
const DEFAULT_CAMERA_ROTATION_STRENGTH = 1;
const DEFAULT_CAMERA_TIMING_STRENGTH = 0;
const CAMERA_POSE_CONVENTION_TIMELINE_MINUS_Z = 'timeline_w2c_camera_local_negative_z';

// 应用状态
const state = {
    VERSION: '0.1.9',
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
    cameraCatmullTension: DEFAULT_CAMERA_POSITION_TENSION,
    cameraRotationStrength: DEFAULT_CAMERA_ROTATION_STRENGTH,
    cameraEaseStrength: DEFAULT_CAMERA_TIMING_STRENGTH,
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
    agentWorkbenchMode: 'conversation',
    agentAssetLibraryTab: 'scene',
    agentWorkflow: 'scene-build',
    agentCodexConversationId: '',
    agentCodexThreadId: '',
    agentWorkflowThreads: {},
    agentMessages: [],
    agentPendingImages: [],
    agentComposerSkillId: '',
    demoScene: createInactiveDemoSceneState(),
    workspace: createWorkspaceState(),
    projectSession: createProjectSessionState(),
    pendingWorkspaceTargetAction: null,
    forceFullWorkspaceAssetMigration: false,
    forceFullServerAssetMigration: false,
};

const AGENT_COMPOSER_SKILL_DEFS = [
    {
        id: 'scene',
        value: '$scene-skill',
        labelKey: 'agent.skills.scene',
        workflow: 'scene-build',
        aliases: ['$scene-skill'],
    },
    {
        id: 'object',
        value: '$object-skill',
        labelKey: 'agent.skills.object',
        workflow: 'object-insert',
        aliases: ['$object-skill'],
    },
    {
        id: 'character',
        value: '$character-skill',
        labelKey: 'agent.skills.character',
        workflow: 'character-create',
        aliases: ['$character-skill'],
    },
    {
        id: 'camera',
        value: '$camera-skill',
        labelKey: 'agent.skills.camera',
        workflow: 'camera-direct',
        aliases: ['$camera-skill', 'camera-skill'],
    },
];

const SCENE_PIPELINE_STEP_DEFS = [
    { key: 'main-image', titleKey: 'agent.pipelineSteps.mainImage' },
    { key: 'top-view', titleKey: 'agent.pipelineSteps.topView' },
    { key: 'layout', titleKey: 'agent.pipelineSteps.layout' },
    { key: 'components-3d', titleKey: 'agent.pipelineSteps.components3d' },
    { key: 'insert-scene', titleKey: 'agent.pipelineSteps.insertScene' },
];

const CAMERA_PIPELINE_STEP_DEFS = [
    { key: 'camera-scene-info', titleKey: 'agent.pipelineSteps.cameraSceneInfo' },
    { key: 'camera-initial-views', titleKey: 'agent.pipelineSteps.cameraInitialViews' },
    { key: 'camera-director', titleKey: 'agent.pipelineSteps.cameraDirector' },
    { key: 'camera-trajectory', titleKey: 'agent.pipelineSteps.cameraTrajectory' },
    { key: 'camera-eval', titleKey: 'agent.pipelineSteps.cameraEval' },
];

const CAMERA_PIPELINE_STAGE_PLAN = [
    'camera_scene_info_export',
    'camera_initial_view_prepare',
    'camera_director_analysis',
    'camera_trajectory_generation',
    'camera_trajectory_eval_render',
];

const AGENT_PIPELINE_STATUS_DEFS = {
    running: {
        labelKey: 'agent.pipelineSteps.pipelineStatuses.running',
        className: 'is-running',
    },
    rendering: {
        labelKey: 'agent.pipelineSteps.pipelineStatuses.rendering',
        className: 'is-rendering',
    },
    done: {
        labelKey: 'agent.pipelineSteps.pipelineStatuses.done',
        className: 'is-done',
    },
    skipped: {
        labelKey: 'agent.pipelineSteps.pipelineStatuses.skipped',
        className: 'is-skipped',
    },
    canceled: {
        labelKey: 'agent.pipelineSteps.pipelineStatuses.canceled',
        className: 'is-canceled',
    },
    failed: {
        labelKey: 'agent.pipelineSteps.pipelineStatuses.failed',
        className: 'is-failed',
    },
    pending: {
        labelKey: 'agent.pipelineSteps.pipelineStatuses.pending',
        className: 'is-pending',
    },
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
let projectRenameCommitInFlight = false;
let agentMessageBottomPinRaf = 0;
let agentMessageBottomPinFramesRemaining = 0;
let agentMessageScrollbarSyncRaf = 0;
let agentMessageScrollbarScheduledMeasure = false;
let agentMessageScrollbarMeasureDirty = true;
let agentMessageScrollbarMetricsCache = null;
let agentMessageScrollbarResizeObserver = null;
let agentMessageLayoutAnimationRaf = 0;
const agentThumbnailImageCache = new Map();
const agentCanonicalAssetBlobCache = new Map();
let agentWorkbenchResizeRaf = 0;
let agentWorkbenchCollapseSyncRaf = 0;
let agentWorkbenchTogglingTimer = 0;
let agentSessionStore = null;
let agentSessionPersistTimer = 0;
let preferredLeftSidebarWidth = null;
let preferredRightSidebarWidth = null;
let preferredAgentWorkbenchWidth = null;
let sidebarWidthDebugHistory = [];
let cameraControlDebugSamples = [];
const CAMERA_CONTROL_DEBUG_MUTED_LOG_KINDS = new Set(['drag', 'wheel']);
let demoSceneModelRevealTimer = 0;
let workspaceAutosaveTimer = 0;
let workspaceSaveInFlight = null;
let workspaceSaveQueued = false;
let serverProjectAutosaveInFlight = null;
let serverProjectAutosaveQueued = false;
let modelRenameState = null;
let lastCanvasViewportSync = null;
let agentCameraTrajectoryPreview = null;
let agentCameraRenderJob = null;
let agentSceneInsertPreview = null;
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
const AGENT_STEP_ANIMATION_MS = 220;
const LEFT_SIDEBAR_WIDTH_STORAGE_KEY = 'visionary_editor_left_sidebar_width_v4';
const RIGHT_SIDEBAR_WIDTH_STORAGE_KEY = 'visionary_editor_right_sidebar_width';
const TIMELINE_FPS_OPTIONS = [12, 24, 30, 60];
const TIMELINE_PLAYBACK_SPEED_DEFAULT = 1.0;
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
        defaultParam: DEFAULT_CAMERA_POSITION_TENSION,
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
    defaultParam: DEFAULT_CAMERA_ROTATION_STRENGTH,
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
            title: 'Visionary Editor 0.1.9',
        },
        loading: {
            default: '加载中...',
            bootPreparing: '正在准备编辑器外壳...',
            bootRestoringPreferences: '正在恢复语言、主题和项目会话...',
            bootInitializingWorkbench: '正在初始化 Agent 工作台与相机面板...',
            bootLoadingEditorApp: '正在加载 EditorApp 模块...',
            bootInitializingWebGpu: '正在初始化 WebGPU 渲染器...',
            bootConnectingEditor: '正在连接模型、相机和时间轴事件...',
            bootFinalizingUi: '正在同步侧栏、工具栏和时间轴状态...',
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
            progressCount: '进度: {current}/{total}',
            errorPrefix: '错误',
            currentWindow: '当前窗口',
            active: '已开启',
            inactive: '已关闭',
            visible: '可见',
            hidden: '隐藏',
            applied: '已应用',
            canceled: '已取消',
            completed: '已完成',
            interrupted: '已中断',
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
            createNewProjectAction: '创建新项目',
            createProjectNameLabel: '新项目名称',
            createAction: '创建',
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
            deleteAction: '删除',
            renameProjectAria: '重命名项目 {name}',
            invalidProjectName: '项目名称包含不支持的字符，无法作为服务器端项目名称',
            projectRenamed: '项目已重命名为“{name}”',
            confirmDeleteProject: '确认删除项目“{name}”？',
            projectDeleted: '项目已删除：{name}',
            codexAuthTitle: 'Codex Auth',
            codexAuthPlaceholder: '输入 CODEX_API_KEY',
            codexAuthSaveAction: '保存 Auth',
            codexAuthEditAction: '编辑 Codex Auth',
            codexAuthSubmitAction: '提交 Codex Auth',
            codexAuthReady: '已配置',
            codexAuthMissing: '未配置',
            codexAuthSaving: '保存中...',
            codexAuthSaved: 'Codex Auth 已保存，并同步到 {count} 个项目',
            codexAuthRequired: '请输入 Codex Auth Key',
            codexAuthSaveFailed: '保存 Codex Auth 失败',
            agentRuntimeLabel: 'Agent',
            agentRuntimeCodex: 'Codex',
            agentRuntimeDemo: 'Demo',
            agentRuntimeChecking: '正在检查 Codex Auth',
            agentRuntimeNoLogin: '未登录，当前使用 Demo Agent',
            agentRuntimeNoProject: '未打开服务器项目，当前使用 Demo Agent',
            agentRuntimeNoServerWorkspace: '当前项目未绑定服务器工作区，当前使用 Demo Agent',
            agentRuntimeNoAuth: 'Codex Auth 未配置，当前使用 Demo Agent',
            agentRuntimeReady: '已启用实际 Codex Agent',
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
            logoutDirtyConfirm: '当前服务器项目有未同步更改。点击“确定”会先同步再退出；点击“取消”会直接放弃更改并退出登录。',
            logoutDirtySyncFailed: '同步未完成，已取消退出登录',
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
            skillToolbar: 'Agent 技能',
            removeSkill: '移除技能 {name}',
            inputPlaceholder: '输入一句自然语言，或使用技能标签发起 Agent 任务',
            collapsedTooltip: '收起 Agent 工作台',
            expandedTooltip: '展开 Agent 工作台',
            resizeAria: '调整 Agent 工作台宽度',
            promptProcessing: '处理中',
            imageLoading: '图像生成中',
            resetView: '重置视角',
            archivePreview: '展开查看',
            collapseSession: '收起',
            collapseAllSteps: '收纳全部步骤',
            expandAllSteps: '展开全部步骤',
            skills: {
                scene: '场景',
                object: '物体',
                character: '人物',
                camera: '相机',
            },
            actions: {
                cancel: '取消',
                retry: '重试',
                apply: '应用',
            },
            workflows: {
                'scene-build': {
                    title: '场景构建',
                    short: '场景',
                    starter: '使用对应的Skill触发对应的生产流程',
                    suggestions: [
                        '$scene-skill 生成一个月球表面基地',
                        '$object-skill 在基地旁边生成一个火箭发射站',
                        '$character-skill 生成一个宇航员，从飞船走向基地',
                        '$camera-skill 生成环绕基地的航拍环拍镜头',
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
                    starter: '使用对应的Skill触发对应的生产流程',
                    suggestions: [
                        '$scene-skill 生成一个月球表面基地',
                        '$object-skill 在基地旁边生成一个火箭发射站',
                        '$character-skill 生成一个宇航员，从飞船走向基地',
                        '$camera-skill 生成环绕基地的航拍环拍镜头',
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
            pipelineSteps: {
                mainImage: '主图生成',
                frontView: '正视图生成',
                topView: '俯视图生成',
                layout: '获取 layout',
                components3d: '生成组件 3D 资产',
                insertScene: '最终插入到场景',
                cameraSceneInfo: '场景信息导出',
                cameraInitialViews: '渲染初始视图',
                cameraDirector: '解析导演意图',
                cameraTrajectory: '相机序列生成',
                cameraEval: '相机序列优化',
                pipelineStatuses: {
                    running: '运行中',
                    rendering: '渲染中',
                    done: '已完成',
                    skipped: '已跳过',
                    canceled: '已取消',
                    failed: '失败',
                    pending: '等待中',
                },
                pending: '等待上一步完成',
                current: '当前步骤',
                applied: '已应用',
                more: '后续步骤',
                continueAction: '继续',
                layoutDetections: '检测到 {count} 个对象',
                components3dAssets: '3D 资产 {count} 个',
                insertSceneAsset: '场景对象 {count} 个',
                insertScenePreviewReady: '已在画布生成 {count} 个场景对象预览，请检查后应用、重试或取消',
                insertSceneInserted: '已插入 {count} 个场景对象',
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
            renameModel: '重命名模型',
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
                color: '彩色图',
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
            title: '关键帧',
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
            positionInterpolation: '位置平滑',
            rotationInterpolation: '旋转平滑',
            timingInterpolation: '帧间节奏',
            positionInterpolationShort: '位置平滑',
            rotationInterpolationShort: '旋转平滑',
            timingInterpolationShort: '帧间节奏',
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
                codex: '后台 Codex',
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
                codexResume: '进项目目录，用 CODEX_HOME=$PWD/codex_home codex exec --json resume <threadId> "继续"',
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
            codexAgentFailed: 'Codex 执行失败: {message}',
            agentInterrupted: '任务已中断，请重试或取消。',
            agentPreviewPlaceholder: 'Agent 生成预览占位',
            invalidDepthScale: '深度倍率格式错误',
            setDepthScaleFailed: '设置深度倍率失败',
            depthScaleSet: '深度倍率: {value}x',
            invalidFov: 'FOV 格式错误',
            timelineFovSet: '时间轴 FOV: {value}°',
            fovSet: 'FOV: {value}°',
            invalidParameter: '{label} 参数格式错误',
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
            invalidRenameEmpty: '文件名不能为空',
            invalidRenameReserved: '文件名不合法，请更换名称',
            modelRenamed: '模型已重命名: {name}',
            modelRenameConflict: '模型重命名冲突: {name} 已存在',
            modelRenameRejected: '模型重命名未生效',
            modelRenameFailed: '模型重命名失败: {message}',
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
            title: 'Visionary Editor 0.1.9',
        },
        loading: {
            default: 'Loading...',
            bootPreparing: 'Preparing editor shell...',
            bootRestoringPreferences: 'Restoring language, theme, and project session...',
            bootInitializingWorkbench: 'Initializing Agent workbench and camera panels...',
            bootLoadingEditorApp: 'Loading EditorApp module...',
            bootInitializingWebGpu: 'Initializing WebGPU renderer...',
            bootConnectingEditor: 'Connecting model, camera, and timeline events...',
            bootFinalizingUi: 'Syncing sidebars, toolbar, and timeline state...',
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
            progressCount: 'Progress: {current}/{total}',
            errorPrefix: 'Error',
            currentWindow: 'Current viewport',
            active: 'On',
            inactive: 'Off',
            visible: 'Visible',
            hidden: 'Hidden',
            applied: 'Applied',
            canceled: 'Canceled',
            completed: 'Completed',
            interrupted: 'Interrupted',
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
            createNewProjectAction: 'Create New Project',
            createProjectNameLabel: 'New project name',
            createAction: 'Create',
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
            deleteAction: 'Delete',
            renameProjectAria: 'Rename project {name}',
            invalidProjectName: 'Project name contains unsupported characters for a server project name',
            projectRenamed: 'Project renamed to "{name}"',
            confirmDeleteProject: 'Delete project "{name}"?',
            projectDeleted: 'Project deleted: {name}',
            codexAuthTitle: 'Codex Auth',
            codexAuthPlaceholder: 'Enter CODEX_API_KEY',
            codexAuthSaveAction: 'Save Auth',
            codexAuthEditAction: 'Edit Codex Auth',
            codexAuthSubmitAction: 'Submit Codex Auth',
            codexAuthReady: 'Configured',
            codexAuthMissing: 'Not configured',
            codexAuthSaving: 'Saving...',
            codexAuthSaved: 'Codex Auth saved and synced to {count} projects',
            codexAuthRequired: 'Enter a Codex auth key',
            codexAuthSaveFailed: 'Failed to save Codex Auth',
            agentRuntimeLabel: 'Agent',
            agentRuntimeCodex: 'Codex',
            agentRuntimeDemo: 'Demo',
            agentRuntimeChecking: 'Checking Codex Auth',
            agentRuntimeNoLogin: 'Not logged in, using Demo Agent',
            agentRuntimeNoProject: 'No server project is open, using Demo Agent',
            agentRuntimeNoServerWorkspace: 'Current project is not bound to the server workspace, using Demo Agent',
            agentRuntimeNoAuth: 'Codex Auth is not configured, using Demo Agent',
            agentRuntimeReady: 'Real Codex Agent is enabled',
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
            logoutDirtyConfirm: 'The current server project has unsynced changes. Choose OK to sync before logout, or Cancel to discard changes and log out.',
            logoutDirtySyncFailed: 'Sync did not complete. Logout was cancelled.',
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
            skillToolbar: 'Agent skills',
            removeSkill: 'Remove skill {name}',
            inputPlaceholder: 'Type a natural-language request or use a skill tag to start an agent task',
            collapsedTooltip: 'Collapse agent workbench',
            expandedTooltip: 'Expand agent workbench',
            resizeAria: 'Resize agent workbench',
            promptProcessing: 'Processing',
            imageLoading: 'Generating image',
            resetView: 'Reset view',
            archivePreview: 'Expand details',
            collapseSession: 'Collapse',
            collapseAllSteps: 'Collapse all steps',
            expandAllSteps: 'Expand all steps',
            skills: {
                scene: 'Scene',
                object: 'Object',
                character: 'Character',
                camera: 'Camera',
            },
            actions: {
                cancel: 'Cancel',
                retry: 'Retry',
                apply: 'Apply',
            },
            workflows: {
                'scene-build': {
                    title: 'Scene Build',
                    short: 'Scene',
                    starter: 'Use the corresponding Skill to trigger the matching production workflow',
                    suggestions: [
                        '$scene-skill Generate a lunar surface base',
                        '$object-skill Generate a rocket launch site next to the base',
                        '$character-skill Generate an astronaut walking from the spacecraft to the base',
                        '$camera-skill Generate an aerial orbit shot around the base',
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
                    starter: 'Use the corresponding Skill to trigger the matching production workflow',
                    suggestions: [
                        '$scene-skill Generate a lunar surface base',
                        '$object-skill Generate a rocket launch site next to the base',
                        '$character-skill Generate an astronaut walking from the spacecraft to the base',
                        '$camera-skill Generate an aerial orbit shot around the base',
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
            pipelineSteps: {
                mainImage: 'Main image generation',
                frontView: 'Front view generation',
                topView: 'Top view generation',
                layout: 'Layout extraction',
                components3d: 'Generate component 3D assets',
                insertScene: 'Insert into scene',
                cameraSceneInfo: 'Scene info export',
                cameraInitialViews: 'Render initial views',
                cameraDirector: 'Parse director intent',
                cameraTrajectory: 'Generate camera sequence',
                cameraEval: 'Optimize camera sequence',
                pipelineStatuses: {
                    running: 'Running',
                    rendering: 'Rendering',
                    done: 'Completed',
                    skipped: 'Skipped',
                    canceled: 'Canceled',
                    failed: 'Failed',
                    pending: 'Pending',
                },
                pending: 'Waiting for previous step',
                current: 'Current step',
                applied: 'Applied',
                more: 'Later steps',
                continueAction: 'Continue',
                layoutDetections: '{count} detected objects',
                components3dAssets: '{count} 3D assets',
                insertSceneAsset: '{count} scene objects',
                insertScenePreviewReady: 'Previewed {count} scene objects on the canvas. Review, then apply, retry, or cancel.',
                insertSceneInserted: 'Inserted {count} scene objects',
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
            renameModel: 'Rename model',
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
                color: 'RGB',
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
            title: 'Keyframes',
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
            positionInterpolation: 'Position smoothness',
            rotationInterpolation: 'Rotation smoothness',
            timingInterpolation: 'Frame tempo',
            positionInterpolationShort: 'Pos Smooth',
            rotationInterpolationShort: 'Rot Smooth',
            timingInterpolationShort: 'Frame Tempo',
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
                codex: 'Backend Codex',
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
                codexResume: 'Enter the project folder, then run CODEX_HOME=$PWD/codex_home codex exec --json resume <threadId> "continue"',
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
            codexAgentFailed: 'Codex failed: {message}',
            agentInterrupted: 'Task was interrupted. Retry or cancel it.',
            agentPreviewPlaceholder: 'Agent preview placeholder',
            invalidDepthScale: 'Invalid depth scale',
            setDepthScaleFailed: 'Failed to set depth scale',
            depthScaleSet: 'Depth scale: {value}x',
            invalidFov: 'Invalid FOV',
            timelineFovSet: 'Timeline FOV: {value}°',
            fovSet: 'FOV: {value}°',
            invalidParameter: 'Invalid value for {label}',
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
            invalidRenameEmpty: 'File name cannot be empty',
            invalidRenameReserved: 'Invalid file name. Choose another name',
            modelRenamed: 'Model renamed: {name}',
            modelRenameConflict: 'Model rename conflict: {name} already exists',
            modelRenameRejected: 'Model rename was rejected',
            modelRenameFailed: 'Model rename failed: {message}',
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

function setProjectNameErrorState(input, errorElement, message) {
    if (input) {
        input.classList.add('has-error');
        input.focus();
        input.select?.();
    }
    if (errorElement) {
        errorElement.textContent = message;
        errorElement.classList.remove('hidden');
    }
}

function setProjectNameConflictState(input, errorElement) {
    setProjectNameErrorState(input, errorElement, t('projectSession.duplicateProjectName'));
}

function isDuplicateProjectNameError(error) {
    const code = String(error?.code || '').trim().toUpperCase();
    const message = String(error?.message || '').trim().toLowerCase();
    return code === 'CONFLICT' || message.includes('project name already exists');
}

function isInvalidProjectNameError(error) {
    const code = String(error?.code || '').trim().toUpperCase();
    const message = String(error?.message || '').trim().toLowerCase();
    return code === 'BAD_REQUEST' && (
        message.includes('project name')
        || message.includes('unsupported characters')
        || message.includes('is required')
    );
}

function logCameraControlDebug(kind = 'unknown') {
    if (CAMERA_CONTROL_DEBUG_MUTED_LOG_KINDS.has(kind)) {
        return null;
    }
    const info = app?.getCameraControlDebugInfo?.();
    if (!info) return null;
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

function formatProjectUpdatedAt(updatedAt) {
    const timestamp = Date.parse(String(updatedAt || ''));
    if (!Number.isFinite(timestamp)) {
        return String(updatedAt || '');
    }
    try {
        return new Intl.DateTimeFormat(state.uiLanguage === 'en' ? 'en-US' : 'zh-CN', {
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit',
            hour12: false,
        }).format(new Date(timestamp));
    } catch (error) {
        return new Date(timestamp).toLocaleString();
    }
}

function formatProjectSize(sizeBytes) {
    const bytes = Number(sizeBytes);
    if (!Number.isFinite(bytes) || bytes <= 0) {
        return '0 MB';
    }
    const mb = bytes / (1024 * 1024);
    if (mb >= 1024) {
        return `${formatProjectSizeNumber(mb / 1024)} GB`;
    }
    return `${formatProjectSizeNumber(Math.max(mb, 0.01))} MB`;
}

function formatProjectSizeNumber(value) {
    if (value >= 100) return value.toFixed(0);
    if (value >= 10) return value.toFixed(1);
    return value.toFixed(2);
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
    const buttons = [dom.btnUserSession, dom.btnCollapsedUserSession].filter(Boolean);
    if (buttons.length === 0) return;
    const authenticated = Boolean(state.projectSession?.authenticated);
    const user = state.projectSession?.user || '';
    const avatarToken = authenticated ? getProjectSessionAvatarToken(user) : '';
    const avatarLabel = avatarToken ? avatarToken.toLocaleUpperCase() : '';
    const gradient = getProjectSessionAvatarGradient(avatarToken);
    buttons.forEach((button) => {
        button.dataset.authenticated = String(authenticated);
        button.style.setProperty('--agent-user-avatar-start', gradient.start);
        button.style.setProperty('--agent-user-avatar-end', gradient.end);
        setElementText(button.querySelector('.agent-user-avatar-text'), avatarLabel);
        setButtonTooltip(
            button,
            authenticated
                ? t('projectSession.userButtonTooltipLoggedIn')
                : t('projectSession.userButtonLogin'),
            authenticated
                ? t('projectSession.currentUser', { user })
                : t('projectSession.userButtonLogin'),
        );
    });
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
    renderProjectBrowserCodexAuthStatus();
    void refreshProjectBrowserCodexAuthStatus();
    void refreshProjectSessionProjects();
}

function closeProjectBrowserModal() {
    clearProjectNameConflictState(dom.projectBrowserSaveAsName, dom.projectBrowserSaveAsNameError);
    closeProjectBrowserCodexAuthEditor();
    closeProjectBrowserSaveAsPanel();
    closeProjectCreateDialog();
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
    resetAgentCodexSessionBinding();
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

function openProjectBrowserSaveAsPanel({ preferDefaultName = false } = {}) {
    clearProjectNameConflictState(dom.projectBrowserSaveAsName, dom.projectBrowserSaveAsNameError);
    dom.projectBrowserSaveAsPanel?.classList.remove('hidden');
    if (dom.projectBrowserSaveAsName) {
        dom.projectBrowserSaveAsName.value = preferDefaultName
            ? getProjectSessionDefaultProjectName()
            : state.projectSession.activeProjectName || getProjectSessionDefaultProjectName();
        dom.projectBrowserSaveAsName.focus();
        dom.projectBrowserSaveAsName.select?.();
    }
}

function closeProjectBrowserSaveAsPanel() {
    clearProjectNameConflictState(dom.projectBrowserSaveAsName, dom.projectBrowserSaveAsNameError);
    dom.projectBrowserSaveAsPanel?.classList.add('hidden');
}

function openProjectCreateDialog() {
    clearProjectNameConflictState(dom.projectCreateName, dom.projectCreateNameError);
    dom.projectCreateModal?.classList.remove('hidden');
    if (dom.projectCreateName) {
        dom.projectCreateName.value = getProjectSessionDefaultProjectName();
        dom.projectCreateName.focus();
        dom.projectCreateName.select?.();
    }
}

function closeProjectCreateDialog() {
    clearProjectNameConflictState(dom.projectCreateName, dom.projectCreateNameError);
    dom.projectCreateModal?.classList.add('hidden');
}

function getAgentRuntimeStatus() {
    if (!state.projectSession?.authenticated || !state.projectSession?.user) {
        return {
            mode: 'demo',
            ready: false,
            reason: t('projectSession.agentRuntimeNoLogin'),
        };
    }
    if (!state.projectSession?.activeProjectId) {
        return {
            mode: 'demo',
            ready: false,
            reason: t('projectSession.agentRuntimeNoProject'),
        };
    }
    if (state.workspace?.mode !== 'server') {
        return {
            mode: 'demo',
            ready: false,
            reason: t('projectSession.agentRuntimeNoServerWorkspace'),
        };
    }
    if (state.projectSession.codexAuthLoading) {
        return {
            mode: 'demo',
            ready: false,
            reason: t('projectSession.agentRuntimeChecking'),
        };
    }
    if (!state.projectSession.codexAuthHasAuth) {
        return {
            mode: 'demo',
            ready: false,
            reason: t('projectSession.agentRuntimeNoAuth'),
        };
    }
    return {
        mode: 'codex',
        ready: true,
        reason: t('projectSession.agentRuntimeReady'),
    };
}

function renderProjectBrowserCodexAuthStatus() {
    const editing = Boolean(state.projectSession.codexAuthEditing);
    if (dom.projectBrowserCodexAuthStatus) {
        dom.projectBrowserCodexAuthStatus.textContent = state.projectSession.codexAuthHasAuth
            ? t('projectSession.codexAuthReady')
            : t('projectSession.codexAuthMissing');
        dom.projectBrowserCodexAuthStatus.classList.toggle('is-ready', Boolean(state.projectSession.codexAuthHasAuth));
        dom.projectBrowserCodexAuthStatus.hidden = editing;
    }
    if (dom.projectBrowserAgentRuntimeStatus) {
        const runtime = getAgentRuntimeStatus();
        const modeLabel = runtime.ready
            ? t('projectSession.agentRuntimeCodex')
            : t('projectSession.agentRuntimeDemo');
        dom.projectBrowserAgentRuntimeStatus.textContent = `${t('projectSession.agentRuntimeLabel')}: ${modeLabel}`;
        dom.projectBrowserAgentRuntimeStatus.title = runtime.reason;
        dom.projectBrowserAgentRuntimeStatus.classList.toggle('is-ready', runtime.ready);
        dom.projectBrowserAgentRuntimeStatus.hidden = editing;
    }
    if (dom.btnProjectBrowserEditCodexAuth) {
        dom.btnProjectBrowserEditCodexAuth.hidden = editing;
        dom.btnProjectBrowserEditCodexAuth.disabled = Boolean(state.projectSession.codexAuthSaving);
    }
    if (dom.projectBrowserCodexAuthKey) {
        dom.projectBrowserCodexAuthKey.hidden = !editing;
        dom.projectBrowserCodexAuthKey.disabled = Boolean(state.projectSession.codexAuthSaving);
    }
    if (dom.btnProjectBrowserSaveCodexAuth) {
        dom.btnProjectBrowserSaveCodexAuth.hidden = !editing;
        dom.btnProjectBrowserSaveCodexAuth.disabled = Boolean(state.projectSession.codexAuthSaving);
    }
}

function openProjectBrowserCodexAuthEditor() {
    if (state.projectSession.codexAuthSaving) return;
    state.projectSession.codexAuthEditing = true;
    if (dom.projectBrowserCodexAuthKey) {
        dom.projectBrowserCodexAuthKey.value = '';
    }
    renderProjectBrowserCodexAuthStatus();
    requestAnimationFrame(() => {
        dom.projectBrowserCodexAuthKey?.focus();
    });
}

function closeProjectBrowserCodexAuthEditor() {
    state.projectSession.codexAuthEditing = false;
    if (dom.projectBrowserCodexAuthKey) {
        dom.projectBrowserCodexAuthKey.value = '';
    }
    renderProjectBrowserCodexAuthStatus();
}

async function refreshProjectBrowserCodexAuthStatus() {
    if (!state.projectSession?.authenticated || !state.projectSession.user || state.projectSession.isAdmin) {
        state.projectSession.codexAuthEditing = false;
        state.projectSession.codexAuthHasAuth = false;
        state.projectSession.codexAuthProjectCount = 0;
        state.projectSession.codexAuthLoading = false;
        renderProjectBrowserCodexAuthStatus();
        return;
    }
    state.projectSession.codexAuthLoading = true;
    renderProjectBrowserCodexAuthStatus();
    try {
        const status = await projectApi.getCodexAuthStatus(state.projectSession.user);
        state.projectSession.codexAuthHasAuth = Boolean(status?.hasAuth);
        state.projectSession.codexAuthProjectCount = Number(status?.projectCount || 0);
    } catch (error) {
        state.projectSession.lastError = error?.message || String(error);
    } finally {
        state.projectSession.codexAuthLoading = false;
        renderProjectBrowserCodexAuthStatus();
    }
}

async function saveProjectBrowserCodexAuth() {
    if (state.projectSession.codexAuthSaving) return;
    if (!state.projectSession?.authenticated || !state.projectSession.user) {
        showError(t('projectSession.loginRequired'));
        return;
    }
    const apiKey = String(dom.projectBrowserCodexAuthKey?.value || '').trim();
    if (!apiKey) {
        closeProjectBrowserCodexAuthEditor();
        return;
    }

    state.projectSession.codexAuthSaving = true;
    renderProjectBrowserCodexAuthStatus();
    try {
        const status = await projectApi.saveCodexAuth({
            user: state.projectSession.user,
            apiKey,
        });
        state.projectSession.codexAuthHasAuth = Boolean(status?.hasAuth);
        state.projectSession.codexAuthProjectCount = Number(status?.projectCount || 0);
        closeProjectBrowserCodexAuthEditor();
        showInfo(t('projectSession.codexAuthSaved', { count: state.projectSession.codexAuthProjectCount }));
    } catch (error) {
        showError(`${t('projectSession.codexAuthSaveFailed')}: ${error?.message || String(error)}`);
    } finally {
        state.projectSession.codexAuthSaving = false;
        renderProjectBrowserCodexAuthStatus();
    }
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
        const projectId = project.id || '';
        const projectName = project.name || project.id || '';
        const isRenaming = state.projectSession.renamingProjectId === projectId;
        const renameValue = isRenaming ? state.projectSession.renamingProjectName : projectName;
        const renameError = isRenaming ? state.projectSession.renamingProjectError : '';
        return `
        <div class="project-browser-project-card${isActive ? ' is-active' : ''}">
            <div class="project-browser-project-card-header">
                ${isRenaming ? `
                    <div class="project-browser-project-card-title-row">
                        <input
                            class="project-session-input project-browser-project-name-edit ${renameError ? 'has-error' : ''}"
                            type="text"
                            maxlength="96"
                            value="${escapeHtml(renameValue)}"
                            data-project-rename-input="${escapeHtml(projectId)}"
                            aria-label="${escapeHtml(t('projectSession.createProjectNameLabel'))}"
                        >
                        ${isActive ? `<span class="project-browser-project-card-badge">${escapeHtml(t('projectSession.currentBadge'))}</span>` : ''}
                    </div>
                    ${renameError ? `<div class="project-session-inline-error" role="alert">${escapeHtml(renameError)}</div>` : ''}
                ` : `
                    <div class="project-browser-project-card-title-row">
                        <span class="project-browser-project-card-title">${escapeHtml(projectName)}</span>
                        <button
                            type="button"
                            class="project-browser-project-rename-btn"
                            data-project-rename-start="${escapeHtml(projectId)}"
                            title="${escapeHtml(t('projectSession.renameProjectAria', { name: projectName }))}"
                            aria-label="${escapeHtml(t('projectSession.renameProjectAria', { name: projectName }))}"
                        >
                            <svg viewBox="0 0 24 24" aria-hidden="true">
                                <path d="M12 20h9" />
                                <path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z" />
                            </svg>
                        </button>
                        ${isActive ? `<span class="project-browser-project-card-badge">${escapeHtml(t('projectSession.currentBadge'))}</span>` : ''}
                    </div>
                `}
                <div class="project-browser-project-card-meta">
                    <span class="project-browser-project-card-subtitle">${escapeHtml(formatProjectUpdatedAt(project.updatedAt))}</span>
                    <span class="project-browser-project-card-size">${escapeHtml(formatProjectSize(project.sizeBytes))}</span>
                </div>
            </div>
            <div class="project-browser-project-card-actions">
                <button type="button" class="button button-secondary project-browser-project-action-btn" data-project-open="${escapeHtml(projectId)}">
                    ${escapeHtml(t('projectSession.openAction'))}
                </button>
                <button type="button" class="button button-secondary project-browser-project-action-btn project-browser-project-delete-btn" data-project-delete="${escapeHtml(projectId)}">
                    ${escapeHtml(t('projectSession.deleteAction'))}
                </button>
            </div>
        </div>
    `;
    }).join('');
}

function getProjectBrowserProject(projectId) {
    const id = String(projectId || '').trim();
    return (Array.isArray(state.projectSession?.projects) ? state.projectSession.projects : [])
        .find((project) => project.id === id) || null;
}

function focusProjectRenameInput(projectId) {
    requestAnimationFrame(() => {
        const input = dom.projectBrowserProjectGrid?.querySelector(`[data-project-rename-input="${CSS.escape(projectId)}"]`);
        if (input instanceof HTMLInputElement) {
            input.focus();
            input.select();
        }
    });
}

function startProjectRename(projectId) {
    const project = getProjectBrowserProject(projectId);
    if (!project?.id) return;
    state.projectSession.renamingProjectId = project.id;
    state.projectSession.renamingProjectName = project.name || project.id;
    state.projectSession.renamingProjectError = '';
    renderProjectBrowserProjectGrid();
    focusProjectRenameInput(project.id);
}

function cancelProjectRename() {
    state.projectSession.renamingProjectId = '';
    state.projectSession.renamingProjectName = '';
    state.projectSession.renamingProjectError = '';
    renderProjectBrowserProjectGrid();
}

function setProjectRenameError(projectId, message) {
    state.projectSession.renamingProjectId = projectId;
    state.projectSession.renamingProjectError = message;
    renderProjectBrowserProjectGrid();
    focusProjectRenameInput(projectId);
}

async function commitProjectRename(projectId) {
    if (projectRenameCommitInFlight) return;
    const project = getProjectBrowserProject(projectId);
    if (!project?.id || state.projectSession.renamingProjectId !== project.id) return;
    const nextName = String(state.projectSession.renamingProjectName || '').trim();
    if (!nextName || nextName === project.name) {
        cancelProjectRename();
        return;
    }

    projectRenameCommitInFlight = true;
    try {
        const renamed = await projectApi.renameProject({
            user: state.projectSession.user,
            projectId: project.id,
            name: nextName,
        });
        state.projectSession.projects = state.projectSession.projects.map((item) => (
            item.id === project.id ? { ...item, ...renamed } : item
        ));
        if (state.projectSession.activeProjectId === project.id) {
            state.projectSession.activeProjectId = renamed?.id || project.id;
            state.projectSession.activeProjectName = renamed?.name || nextName;
            state.workspace = {
                ...state.workspace,
                name: state.projectSession.activeProjectName,
            };
            resetAgentCodexSessionBinding();
        }
        state.projectSession.renamingProjectId = '';
        state.projectSession.renamingProjectName = '';
        state.projectSession.renamingProjectError = '';
        await refreshProjectSessionProjects();
        updateWorkspaceStatusIndicator();
        showInfo(t('projectSession.projectRenamed', { name: renamed?.name || nextName }));
    } catch (error) {
        if (isDuplicateProjectNameError(error)) {
            setProjectRenameError(project.id, t('projectSession.duplicateProjectName'));
            return;
        }
        if (isInvalidProjectNameError(error)) {
            setProjectRenameError(project.id, t('projectSession.invalidProjectName'));
            return;
        }
        showError(error?.message || String(error));
    } finally {
        projectRenameCommitInFlight = false;
    }
}

async function deleteProjectFromBrowser(projectId) {
    const project = getProjectBrowserProject(projectId);
    if (!project?.id) return;
    const projectName = project.name || project.id;
    if (!confirm(t('projectSession.confirmDeleteProject', { name: projectName }))) return;

    showLoading(true, t('messages.deletingProject'), 60);
    try {
        await projectApi.deleteProject(state.projectSession.user, project.id);
        if (state.projectSession.activeProjectId === project.id) {
            clearActiveServerProjectSelection();
            resetAllAgentConversations();
            resetAgentCodexSessionBinding();
            updateWorkspaceStatusIndicator();
        }
        cancelProjectRename();
        await refreshProjectSessionProjects();
        showLoading(false);
        showInfo(t('projectSession.projectDeleted', { name: projectName }));
    } catch (error) {
        showLoading(false);
        showError(error?.message || String(error));
    }
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
                <div class="project-browser-project-card-meta">
                    <span class="project-browser-project-card-subtitle">${escapeHtml(formatProjectUpdatedAt(project.updatedAt))}</span>
                    <span class="project-browser-project-card-size">${escapeHtml(formatProjectSize(project.sizeBytes))}</span>
                </div>
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
    void refreshProjectBrowserCodexAuthStatus();
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

    if (dom.bootLoadingOverlay) {
        setElementText(dom.bootLoadingOverlay.querySelector('.loading-text'), t('canvas.loading'));
        setElementText(dom.bootLoadingOverlay.querySelector('.loading-detail'), t('loading.bootPreparing'));
    }
    if (dom.loadingOverlay && dom.loadingOverlay.classList.contains('hidden')) {
        setElementText(dom.loadingOverlay.querySelector('.loading-text'), t('canvas.loading'));
    }
    if (dom.agentComposerInput) {
        dom.agentComposerInput.setAttribute('data-placeholder', t('agent.inputPlaceholder'));
    }
    renderAgentComposerSkillControls();
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
    setElementText(dom.modeColor?.querySelector('.menu-btn-text'), t('modal.exportRenderModes.rgb'));
    setElementText(dom.modeDepth?.querySelector('.menu-btn-text'), t('modal.exportRenderModes.depth'));
    setElementText(dom.modeNormal?.querySelector('.menu-btn-text'), t('modal.exportRenderModes.normal'));
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
    setElementText(dom.timelinePositionInterpolationLabel, t('timeline.positionInterpolationShort'));
    setElementText(dom.timelineRotationInterpolationLabel, t('timeline.rotationInterpolationShort'));
    setElementText(dom.timelineTimingInterpolationLabel, t('timeline.timingInterpolationShort'));
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
    setElementText(helpSectionTitles[3], t('modal.helpSections.codex'));
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
        t('modal.helpItems.codexResume'),
    ];
    helpSpans.forEach((span, index) => setElementText(span, helpTexts[index] || span.textContent));
}

function syncProjectSessionModalLabels() {
    setButtonTooltip(dom.btnLoginModalClose, t('common.close'), t('common.close'));
    setButtonTooltip(dom.btnProjectSessionClose, t('common.close'), t('common.close'));
    setButtonTooltip(dom.btnProjectBrowserClose, t('common.close'), t('common.close'));
    setButtonTooltip(dom.btnProjectCreateClose, t('common.close'), t('common.close'));
    syncWorkspaceTargetModalLabels(dom.workspaceTargetModal?.dataset.reason || 'status');
    if (dom.projectSessionNewProjectName) {
        dom.projectSessionNewProjectName.placeholder = getProjectSessionDefaultProjectName();
    }
    if (dom.projectBrowserSaveAsName) {
        dom.projectBrowserSaveAsName.placeholder = getProjectSessionDefaultProjectName();
    }
    if (dom.projectCreateName) {
        dom.projectCreateName.placeholder = getProjectSessionDefaultProjectName();
    }
    if (dom.projectBrowserCodexAuthKey) {
        dom.projectBrowserCodexAuthKey.placeholder = t('projectSession.codexAuthPlaceholder');
    }
    setElementText(dom.btnProjectBrowserCreateNew, t('projectSession.createNewProjectAction'));
    setElementText(dom.btnProjectBrowserSaveAs, t('projectSession.saveCurrentAsAction'));
    setElementText(dom.btnProjectBrowserSaveAsCancel, t('common.cancel'));
    setElementText(dom.btnProjectBrowserSaveAsConfirm, t('projectSession.saveAction'));
    setButtonTooltip(dom.btnProjectBrowserEditCodexAuth, t('projectSession.codexAuthEditAction'), t('projectSession.codexAuthEditAction'));
    setButtonTooltip(dom.btnProjectBrowserSaveCodexAuth, t('projectSession.codexAuthSubmitAction'), t('projectSession.codexAuthSubmitAction'));
    setElementText(dom.btnProjectBrowserLogout, t('projectSession.logoutAction'));
    setElementText(dom.btnProjectCreateCancel, t('common.cancel'));
    setElementText(dom.btnProjectCreateConfirm, t('projectSession.createAction'));

    setButtonTooltip(dom.btnAdminProjectClose, t('common.close'), t('common.close'));
    setElementText(dom.btnAdminProjectLogout, t('projectSession.logoutAction'));
    renderProjectBrowserCodexAuthStatus();
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
    renderAgentComposerSkillControls();
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

// DOM fallback backgrounds cannot directly reuse the raw scene #RRGGBB.
// The renderer treats scene background as linear clear color and outputs sRGB,
// so first convert to the visible canvas color before syncing CSS fallbacks.
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
    document.documentElement.style.setProperty('--canvas-bg', visibleHex);
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
        stepStates: buildAgentStepStatesSnapshot(),
        pipelineStates: buildAgentPipelineStatesSnapshot(),
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

function buildAgentStepStatesSnapshot() {
    const stepStates = {};
    Object.keys(AGENT_WORKFLOW_DEFS).forEach((workflowId) => {
        const thread = ensureAgentWorkflowThread(workflowId);
        (thread.items || []).forEach((item) => {
            if (item?.kind !== 'session') return;
            (item.attempts || []).forEach((attempt) => {
                getAgentAttemptStepBlocks(attempt).forEach((block) => {
                    if (block?.type !== 'progress' || !block.stepKey) return;
                    stepStates[`${item.id}:${attempt.id}:${block.stepKey}`] = {
                        sessionId: item.id,
                        attemptId: attempt.id,
                        blockId: block.id,
                        stepKey: block.stepKey,
                        images: Array.isArray(block.images) ? block.images.map((image) => ({
                            id: image.id || image.title || '',
                            title: image.title || image.id || '',
                            assetPath: image.assetPath || '',
                            relativePath: image.relativePath || image.assetPath || '',
                            mimeType: image.mimeType || '',
                            bytes: image.bytes || 0,
                            metadata: image.metadata && typeof image.metadata === 'object' ? image.metadata : undefined,
                        })) : [],
                        selectedIndex: Number(block.selectedIndex) || 0,
                        applied: Boolean(block.applied),
                        actions: Array.isArray(block.actions) ? [...block.actions] : [],
                        isCurrent: Boolean(block.isCurrent),
                        expanded: Boolean(block.expanded),
                    };
                });
            });
        });
    });
    return stepStates;
}

function createScenePipelineState({
    sessionId = '',
    attemptId = '',
    currentStepKey = 'main-image',
    lastAppliedStepKey = '',
    status = 'waiting_for_apply',
    autoContinue = true,
    steps = {},
} = {}) {
    const normalizedSteps = {};
    SCENE_PIPELINE_STEP_DEFS.forEach((definition) => {
        normalizedSteps[definition.key] = {
            status: steps?.[definition.key]?.status || 'pending',
        };
    });
    return {
        kind: 'scene-skill',
        sessionId,
        attemptId,
        status,
        currentStepKey,
        lastAppliedStepKey,
        autoContinue: autoContinue !== false,
        steps: normalizedSteps,
        updatedAt: new Date().toISOString(),
    };
}

function deriveScenePipelineState(session, attempt, overrides = {}) {
    const blocks = getAgentAttemptStepBlocks(attempt);
    let currentStepKey = '';
    let lastAppliedStepKey = '';
    const steps = {};
    SCENE_PIPELINE_STEP_DEFS.forEach((definition) => {
        const block = blocks.find((item) => item?.stepKey === definition.key);
        let status = 'pending';
        if (block?.applied) {
            status = 'applied';
            lastAppliedStepKey = definition.key;
        } else if (block?.indeterminate) {
            status = 'running';
            currentStepKey = definition.key;
        } else if (block?.isCurrent) {
            status = Array.isArray(block.images) && block.images.length > 0 ? 'waiting_for_apply' : 'ready';
            currentStepKey = definition.key;
        } else if (Array.isArray(block?.images) && block.images.length > 0) {
            status = 'waiting_for_apply';
        }
        steps[definition.key] = { status };
    });
    const finalStep = SCENE_PIPELINE_STEP_DEFS[SCENE_PIPELINE_STEP_DEFS.length - 1]?.key || '';
    const status = overrides.status
        || (finalStep && steps[finalStep]?.status === 'applied'
            ? 'completed'
            : currentStepKey
                ? steps[currentStepKey]?.status || 'ready'
                : 'paused');
    return createScenePipelineState({
        sessionId: session?.id || '',
        attemptId: attempt?.id || '',
        currentStepKey: overrides.currentStepKey || currentStepKey || getNextScenePipelineStepKey(lastAppliedStepKey) || finalStep,
        lastAppliedStepKey: overrides.lastAppliedStepKey || lastAppliedStepKey,
        status,
        autoContinue: overrides.autoContinue !== undefined ? overrides.autoContinue : attempt?.pipelineState?.autoContinue,
        steps,
    });
}

function buildAgentPipelineStatesSnapshot() {
    const pipelineStates = {};
    Object.keys(AGENT_WORKFLOW_DEFS).forEach((workflowId) => {
        const thread = ensureAgentWorkflowThread(workflowId);
        (thread.items || []).forEach((item) => {
            if (item?.kind !== 'session') return;
            (item.attempts || []).forEach((attempt) => {
                const hasScenePipeline = getAgentAttemptStepBlocks(attempt)
                    .some((block) => SCENE_PIPELINE_STEP_DEFS.some((step) => step.key === block?.stepKey));
                if (!hasScenePipeline) return;
                pipelineStates[`${item.id}:${attempt.id}`] = deriveScenePipelineState(item, attempt);
            });
        });
    });
    return pipelineStates;
}

function normalizeRestoredAgentAttemptStatus(status = 'running') {
    const normalized = normalizeAgentAttemptStatus(status);
    return normalized === 'running' ? 'interrupted' : normalized;
}

function isAgentAttemptInternallyRunning(attempt) {
    if (!attempt || typeof attempt !== 'object') return false;
    const blocks = getAgentAttemptStepBlocks(attempt);
    if (blocks.some((block) => block?.type === 'progress' && block.indeterminate)) return true;
    const pipelineState = attempt.pipelineState;
    if (pipelineState?.status === 'running') return true;
    const steps = pipelineState?.steps && typeof pipelineState.steps === 'object'
        ? Object.values(pipelineState.steps)
        : [];
    return steps.some((step) => step?.status === 'running');
}

function shouldMarkInterruptedAgentStepBlock(block) {
    if (!block || block.type !== 'progress' || !block.stepKey) return false;
    if (block.applied) return false;
    if (block.indeterminate || block.isCurrent) return true;
    const statusText = String(block.statusText || '').trim();
    return /^(生成中|Generating|处理中|Processing)/i.test(statusText);
}

function normalizeInterruptedAttemptBlocks(blocks = []) {
    return (Array.isArray(blocks) ? blocks : []).map((block) => {
        if (block?.type !== 'progress') return block;
        const shouldMarkInterrupted = shouldMarkInterruptedAgentStepBlock(block);
        return {
            ...block,
            indeterminate: false,
            actions: [],
            isCurrent: Boolean(block.isCurrent || block.indeterminate),
            statusText: shouldMarkInterrupted ? t('common.interrupted') : block.statusText,
        };
    });
}

function normalizeInterruptedPipelineState(pipelineState) {
    if (!pipelineState || typeof pipelineState !== 'object') return pipelineState;
    const steps = pipelineState.steps && typeof pipelineState.steps === 'object'
        ? Object.fromEntries(Object.entries(pipelineState.steps).map(([stepKey, step]) => [
            stepKey,
            {
                ...step,
                status: step?.status === 'running' ? 'interrupted' : step?.status,
            },
        ]))
        : {};
    return {
        ...pipelineState,
        status: pipelineState.status === 'running' ? 'interrupted' : pipelineState.status,
        steps,
        updatedAt: new Date().toISOString(),
    };
}

function normalizeHydratedAgentAttempt(attempt) {
    if (!attempt || typeof attempt !== 'object') return attempt;
    const status = isAgentAttemptInternallyRunning(attempt)
        ? 'interrupted'
        : normalizeRestoredAgentAttemptStatus(attempt.status || 'running');
    const isInterrupted = status === 'interrupted';
    const blocks = isInterrupted
        ? normalizeInterruptedAttemptBlocks(attempt.blocks || [])
        : (Array.isArray(attempt.blocks) ? attempt.blocks : []);
    const steps = Array.isArray(attempt.steps)
        ? (isInterrupted ? normalizeInterruptedAttemptBlocks(attempt.steps) : attempt.steps)
        : null;
    return {
        ...attempt,
        status,
        blocks,
        ...(steps ? { steps } : {}),
        ...(isInterrupted ? { pipelineState: normalizeInterruptedPipelineState(attempt.pipelineState) } : {}),
    };
}

function createInterruptedAgentSessionFromLoadingMessage(message, prompt = '') {
    const workflow = message?.workflow || state.agentWorkflow;
    const attempt = createAgentGenerationAttempt({
        workflow,
        text: t('messages.agentInterrupted'),
        status: 'interrupted',
        blocks: normalizeInterruptedAttemptBlocks(message?.blocks || []),
        createdAt: message?.createdAt || new Date().toISOString(),
    });
    return createAgentSession({
        id: `agent-session-interrupted-${message?.id || Date.now()}`,
        workflow,
        prompt,
        attachments: message?.attachments || [],
        attempt,
        createdAt: message?.createdAt || new Date().toISOString(),
    });
}

function normalizeHydratedAgentItems(items = []) {
    let lastUserPrompt = '';
    return (Array.isArray(items) ? items : []).map((item) => {
        if (item?.kind === 'message' && item.role === 'user') {
            lastUserPrompt = String(item.text || '').trim();
            return item;
        }
        if (item?.kind === 'message' && item.isLoading) {
            return createInterruptedAgentSessionFromLoadingMessage(item, lastUserPrompt || String(item.text || '').trim());
        }
        if (item?.kind !== 'session' || !Array.isArray(item.attempts)) return item;
        return {
            ...item,
            attempts: item.attempts.map((attempt) => normalizeHydratedAgentAttempt(attempt)),
        };
    });
}

function normalizeHydratedAgentStarterItems(items = [], workflowId = state.agentWorkflow) {
    const normalizedItems = normalizeHydratedAgentItems(items);
    if (
        normalizedItems.length === 1
        && normalizedItems[0]?.kind === 'message'
        && normalizedItems[0]?.role === 'assistant'
        && !normalizedItems[0]?.isLoading
        && (!Array.isArray(normalizedItems[0]?.attachments) || normalizedItems[0].attachments.length === 0)
        && (!Array.isArray(normalizedItems[0]?.blocks) || normalizedItems[0].blocks.length === 0)
    ) {
        return createDefaultAgentMessages(workflowId);
    }
    return normalizedItems;
}

function interruptRunningAgentConversations() {
    let changed = false;
    state.agentWorkflowThreads = Object.fromEntries(
        Object.entries(state.agentWorkflowThreads || {}).map(([workflowId, thread]) => {
            const items = normalizeHydratedAgentItems(thread?.items || []);
            changed = changed || JSON.stringify(items) !== JSON.stringify(thread?.items || []);
            return [workflowId, {
                ...thread,
                items,
            }];
        })
    );
    state.agentMessages = state.agentWorkflowThreads[state.agentWorkflow]?.items || state.agentMessages;
    return changed;
}

function interruptAgentTasksForPageExit() {
    const changed = interruptRunningAgentConversations();
    if (!changed) return;
    renderAgentMessages({ autoScroll: 'preserve-or-pin-bottom' });
    if (isServerProjectSessionActive()) {
        void saveServerProjectToCurrentProject({ silent: true });
        return;
    }
    void persistAgentConversationsNow();
}

async function buildPersistableAgentConversationExport(options = {}) {
    const store = ensureAgentSessionStore();
    return store.exportSnapshot(buildAgentConversationSnapshot(), {
        includeAssets: options.includeAssets !== false,
        includeAssetPayloads: options.includeAssetPayloads === true,
    });
}

function normalizeAgentStepStateImage(image, index = 0, existingImage = null) {
    const assetPath = String(image?.assetPath || image?.relativePath || '').trim();
    const nextImage = {
        id: image?.id || image?.title || `Image ${index + 1}`,
        title: image?.title || image?.id || `Image ${index + 1}`,
        assetPath,
        relativePath: assetPath,
        mimeType: image?.mimeType || '',
        bytes: Number(image?.bytes) || 0,
        metadata: image?.metadata && typeof image.metadata === 'object' ? image.metadata : undefined,
    };
    if (existingImage?.src && !image?.src) {
        nextImage.src = existingImage.src;
    } else if (image?.src) {
        nextImage.src = image.src;
    }
    return nextImage;
}

function applyAgentStepStatesToSnapshot(snapshot) {
    if (!snapshot) {
        return snapshot;
    }
    const nextSnapshot = JSON.parse(JSON.stringify(snapshot));
    if (!nextSnapshot?.stepStates || typeof nextSnapshot.stepStates !== 'object') {
        return nextSnapshot;
    }
    const stepStates = nextSnapshot.stepStates && typeof nextSnapshot.stepStates === 'object'
        ? nextSnapshot.stepStates
        : {};
    const workflows = Array.isArray(nextSnapshot.workflows) ? nextSnapshot.workflows : [];
    Object.values(stepStates).forEach((stepState) => {
        const sessionId = String(stepState?.sessionId || '').trim();
        const attemptId = String(stepState?.attemptId || '').trim();
        const blockId = String(stepState?.blockId || '').trim();
        const stepKey = String(stepState?.stepKey || '').trim();
        if (!sessionId || !stepKey) return;
        for (const workflow of workflows) {
            const items = Array.isArray(workflow?.items) ? workflow.items : [];
            const session = items.find((item) => item?.kind === 'session' && item.id === sessionId);
            if (!session || !Array.isArray(session.attempts)) continue;
            for (const attempt of session.attempts) {
                if (attemptId && attempt.id !== attemptId) continue;
                const blocks = getAgentAttemptStepBlocks(attempt);
                const block = blocks.find((candidate) => {
                    if (candidate?.type !== 'progress') return false;
                    if (blockId && candidate.id !== blockId) return false;
                    return candidate.stepKey === stepKey;
                });
                if (!block) continue;
                const existingImages = Array.isArray(block.images) ? block.images : [];
                const images = Array.isArray(stepState.images)
                    ? stepState.images.map((image, index) => {
                        const assetPath = String(image?.assetPath || image?.relativePath || '').trim();
                        const existingImage = existingImages.find((candidate) => {
                            const candidatePath = String(candidate?.assetPath || candidate?.relativePath || '').trim();
                            return assetPath && candidatePath === assetPath;
                        });
                        return normalizeAgentStepStateImage(image, index, existingImage);
                    })
                    : [];
                block.images = images;
                block.selectedIndex = Math.max(0, Math.min(images.length - 1, Number(stepState.selectedIndex) || 0));
                block.applied = Boolean(stepState.applied);
                block.actions = Array.isArray(stepState.actions)
                    ? stepState.actions.filter(Boolean).map((action) => String(action))
                    : [];
                block.isCurrent = Boolean(stepState.isCurrent);
                block.expanded = Boolean(stepState.expanded);
                return;
            }
        }
    });
    return nextSnapshot;
}

function applyAgentPipelineStatesToSnapshot(snapshot) {
    if (!snapshot) {
        return snapshot;
    }
    const nextSnapshot = JSON.parse(JSON.stringify(snapshot));
    const pipelineStates = nextSnapshot?.pipelineStates && typeof nextSnapshot.pipelineStates === 'object'
        ? nextSnapshot.pipelineStates
        : {};
    const workflows = Array.isArray(nextSnapshot.workflows) ? nextSnapshot.workflows : [];
    Object.values(pipelineStates).forEach((pipelineState) => {
        const sessionId = String(pipelineState?.sessionId || '').trim();
        const attemptId = String(pipelineState?.attemptId || '').trim();
        if (!sessionId || !attemptId) return;
        for (const workflow of workflows) {
            const items = Array.isArray(workflow?.items) ? workflow.items : [];
            const session = items.find((item) => item?.kind === 'session' && item.id === sessionId);
            const attempt = session?.attempts?.find((item) => item?.id === attemptId);
            if (!attempt) continue;
            attempt.pipelineState = {
                ...pipelineState,
                steps: pipelineState.steps && typeof pipelineState.steps === 'object' ? pipelineState.steps : {},
            };
            return;
        }
    });
    return nextSnapshot;
}

function hydrateAgentBlockAssetUrls(block, resolveAssetUrl) {
    const assetPath = String(block?.assetPath || '');
    if (!assetPath) {
        if (block?.type === 'progress' && Array.isArray(block.images)) {
            return {
                ...block,
                images: block.images.map((image) => {
                    const imageAssetPath = String(image?.assetPath || image?.relativePath || '');
                    return imageAssetPath
                        ? { ...image, src: resolveAssetUrl(imageAssetPath), assetPath: imageAssetPath }
                        : image;
                }),
            };
        }
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
}

function hydrateAgentConversationAssetUrls(snapshot, resolveAssetUrl) {
    if (!snapshot || typeof resolveAssetUrl !== 'function') {
        return snapshot;
    }
    const nextSnapshot = applyAgentPipelineStatesToSnapshot(applyAgentStepStatesToSnapshot(snapshot));
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
                        ? attempt.blocks.map((block) => hydrateAgentBlockAssetUrls(block, resolveAssetUrl))
                        : [],
                    ...(Array.isArray(attempt?.steps)
                        ? { steps: attempt.steps.map((block) => hydrateAgentBlockAssetUrls(block, resolveAssetUrl)) }
                        : {}),
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
    const nextSnapshot = applyAgentPipelineStatesToSnapshot(applyAgentStepStatesToSnapshot(snapshot));
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
                    const blocks = [
                        ...(Array.isArray(attempt?.blocks) ? attempt.blocks : []),
                        ...(Array.isArray(attempt?.steps) ? attempt.steps : []),
                    ];
                    for (const block of blocks) {
                        const assetPath = String(block?.assetPath || '');
                        if (block?.type === 'progress' && Array.isArray(block.images)) {
                            for (const image of block.images) {
                                const imageAssetPath = String(image?.assetPath || image?.relativePath || '');
                                if (!imageAssetPath) continue;
                                try {
                                    image.src = await resolveLocalAssetUrl(imageAssetPath);
                                    image.assetPath = imageAssetPath;
                                } catch (error) {
                                    console.warn('[Agent Sessions] failed to hydrate local step image asset', imageAssetPath, error);
                                }
                            }
                            continue;
                        }
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
    const hydratedSnapshot = applyAgentPipelineStatesToSnapshot(applyAgentStepStatesToSnapshot(snapshot));
    const workflows = Array.isArray(hydratedSnapshot?.workflows) ? hydratedSnapshot.workflows : [];
    state.agentWorkflowThreads = {};
    Object.keys(AGENT_WORKFLOW_DEFS).forEach((workflowId) => {
        const matched = workflows.find((workflow) => workflow?.workflow === workflowId);
        state.agentWorkflowThreads[workflowId] = {
            workflow: workflowId,
            label: matched?.label || AGENT_WORKFLOW_DEFS[workflowId]?.label || workflowId,
            items: Array.isArray(matched?.items) && matched.items.length > 0
                ? normalizeHydratedAgentStarterItems(matched.items, workflowId)
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
        for (const block of getAgentAttemptStepBlocks(attempt)) {
            if (block.type === 'image' && block.status === 'ready' && block.src) {
                return block.src;
            }
            if (block.type === 'progress' && Array.isArray(block.images)) {
                const selectedIndex = Math.max(0, Math.min(block.images.length - 1, Number(block.selectedIndex) || 0));
                const image = block.images[selectedIndex];
                const thumbnail = getAgentStepImageThumbnailSrc(image);
                if (thumbnail) return thumbnail;
            }
        }
    }
    return '';
}

function getAgentStepBlockThumbnail(block) {
    const images = Array.isArray(block?.images) ? block.images : [];
    if (images.length <= 0) return '';
    const selectedIndex = Math.max(0, Math.min(images.length - 1, Number(block.selectedIndex) || 0));
    const image = images[selectedIndex];
    return getAgentStepImageThumbnailSrc(image);
}

function getAgentImageAspectRatio(image) {
    const metadata = image?.metadata && typeof image.metadata === 'object' ? image.metadata : {};
    const width = Number(metadata.width || metadata.imageWidth || metadata.sourceWidth || metadata.previewWidth);
    const height = Number(metadata.height || metadata.imageHeight || metadata.sourceHeight || metadata.previewHeight);
    if (Number.isFinite(width) && Number.isFinite(height) && width > 0 && height > 0) {
        return Math.max(0.35, Math.min(3.5, width / height));
    }
    if (metadata.kind === 'layout_bbox') return 1;
    return null;
}

function renderAgentImageAspectStyle(image) {
    const ratio = getAgentImageAspectRatio(image);
    return Number.isFinite(ratio) ? ` style="--agent-image-aspect-ratio:${ratio.toFixed(4)}"` : '';
}

function getAgentPipelineProgressLabel(attempt) {
    const blocks = getAgentAttemptStepBlocks(attempt)
        .filter((block) => block?.type === 'progress' && block.stepKey);
    if (blocks.length <= 0) return '';
    const pipelineStepKeys = new Set(SCENE_PIPELINE_STEP_DEFS.map((step) => step.key));
    const pipelineBlocks = blocks.filter((block) => pipelineStepKeys.has(block.stepKey));
    const scopedBlocks = pipelineBlocks.length > 0 ? pipelineBlocks : blocks;
    const completed = scopedBlocks.filter((block) => Boolean(block.applied)).length;
    return t('common.progressCount', {
        current: completed,
        total: scopedBlocks.length,
    });
}

function getAgentPipelineStepBlocks(attempt) {
    const blocks = getAgentAttemptStepBlocks(attempt)
        .filter((block) => block?.type === 'progress' && block.stepKey);
    const pipelineStepKeys = new Set(SCENE_PIPELINE_STEP_DEFS.map((step) => step.key));
    const pipelineBlocks = blocks.filter((block) => pipelineStepKeys.has(block.stepKey));
    return pipelineBlocks.length > 0 ? pipelineBlocks : blocks;
}

function createAgentStepExpandToggleIcon() {
    return `
        <svg class="agent-session-step-toggle-icon" viewBox="0 0 100 100" aria-hidden="true" focusable="false">
            <g class="agent-session-step-toggle-shape is-menu">
                <line class="agent-session-step-toggle-line" x1="20" y1="35" x2="80" y2="35"></line>
                <line class="agent-session-step-toggle-line" x1="20" y1="50" x2="80" y2="50"></line>
                <line class="agent-session-step-toggle-line" x1="20" y1="65" x2="80" y2="65"></line>
            </g>
            <g class="agent-session-step-toggle-shape is-arrow">
                <line class="agent-session-step-toggle-line" x1="25" y1="40" x2="50" y2="65"></line>
                <line class="agent-session-step-toggle-line" x1="75" y1="40" x2="50" y2="65"></line>
            </g>
        </svg>
    `;
}

function findAgentWorkflowThreadItemLocation(itemId) {
    if (!itemId) return null;
    const currentIndex = state.agentMessages.findIndex((item) => item.id === itemId);
    if (currentIndex >= 0) {
        return {
            workflowId: state.agentWorkflow,
            thread: ensureAgentWorkflowThread(state.agentWorkflow),
            items: state.agentMessages,
            index: currentIndex,
            isCurrent: true,
        };
    }
    for (const workflowId of Object.keys(AGENT_WORKFLOW_DEFS)) {
        const thread = ensureAgentWorkflowThread(workflowId);
        const items = Array.isArray(thread.items) ? thread.items : [];
        if (items === state.agentMessages) continue;
        const index = items.findIndex((item) => item.id === itemId);
        if (index >= 0) {
            return {
                workflowId,
                thread,
                items,
                index,
                isCurrent: false,
            };
        }
    }
    return null;
}

function getAgentItemIndexById(itemId) {
    return state.agentMessages.findIndex((item) => item.id === itemId);
}

function updateAgentSessionById(sessionId, updater, {
    autoScroll = 'preserve-or-pin-bottom',
    animateLayout = null,
    skipRender = false,
} = {}) {
    const location = findAgentWorkflowThreadItemLocation(sessionId);
    if (!location) return null;
    const session = location.items[location.index];
    if (!session || session.kind !== 'session') return null;
    const nextSession = updater(session);
    if (!nextSession) return null;
    location.items[location.index] = nextSession;
    location.thread.items = location.items;
    if (location.isCurrent) {
        state.agentMessages = location.items;
    }
    if (!skipRender && location.isCurrent) {
        renderAgentMessages({ autoScroll, animateLayout });
    }
    schedulePersistAgentConversations();
    return nextSession;
}

function getAgentStepBlockDomElement(blockId) {
    if (!dom.agentMessageList || !blockId) return null;
    const selector = `[data-agent-block-id="${escapeCssIdentifier(blockId)}"]`;
    const element = dom.agentMessageList.querySelector(selector);
    return element instanceof HTMLElement ? element : null;
}

function getAgentStepBlockContextFromElement(element) {
    const blockElement = element?.closest?.('.agent-block-progress');
    if (!(blockElement instanceof HTMLElement)) return null;
    const sessionId = String(blockElement.dataset.agentSessionId || '').trim();
    const attemptId = String(blockElement.dataset.agentAttemptId || '').trim();
    const blockId = String(blockElement.dataset.agentBlockId || '').trim();
    const stepKey = String(blockElement.dataset.agentStepKey || '').trim();
    if (!sessionId || !attemptId || !blockId || !stepKey) return null;
    const session = state.agentMessages.find((item) => item?.kind === 'session' && item.id === sessionId);
    const attempt = session?.attempts?.find((item) => item?.id === attemptId);
    const block = getAgentAttemptStepBlocks(attempt).find((item) => item?.id === blockId);
    if (!session || !attempt || !block) return null;
    return {
        session,
        attempt,
        block,
        sessionId,
        attemptId,
        blockId,
        stepKey,
    };
}

function patchAgentStepBlock(context, patch) {
    if (!context) return null;
    const session = updateAgentSessionById(context.sessionId, (session) => {
        const patchBlockList = (blocks = []) => (
            (blocks || []).map((block) => (
                block.id === context.blockId ? { ...block, ...patch } : block
            ))
        );
        return {
            ...session,
            attempts: (session.attempts || []).map((attempt) => {
                if (attempt.id !== context.attemptId) return attempt;
                const nextAttempt = {
                    ...attempt,
                    blocks: patchBlockList(attempt.blocks || []),
                    ...(Array.isArray(attempt.steps) ? { steps: patchBlockList(attempt.steps) } : {}),
                    updatedAt: new Date().toISOString(),
                };
                const hasScenePipeline = getAgentAttemptStepBlocks(nextAttempt)
                    .some((block) => SCENE_PIPELINE_STEP_DEFS.some((step) => step.key === block?.stepKey));
                return hasScenePipeline
                    ? { ...nextAttempt, pipelineState: deriveScenePipelineState(session, nextAttempt) }
                    : nextAttempt;
            }),
            updatedAt: new Date().toISOString(),
        };
    }, {
        autoScroll: 'preserve-or-pin-bottom',
        skipRender: true,
    });
    if (!session) return null;
    const nextContext = getAgentStepBlockContextById(context.sessionId, context.attemptId, context.blockId);
    if (nextContext) {
        renderAgentStepBlockElement(nextContext, {
            autoScroll: 'preserve-or-pin-bottom',
        });
    } else {
        renderAgentSessionElement(context.sessionId, {
            autoScroll: 'preserve-or-pin-bottom',
        });
    }
    return session;
}

function patchAgentStepBlockByStepKey(sessionId, attemptId, stepKey, patch) {
    const context = getAgentStepBlockContextByStepKey(sessionId, attemptId, stepKey);
    return context ? patchAgentStepBlock(context, patch) : null;
}

function resetDownstreamScenePipelineStepsForRetry(context) {
    if (!context?.sessionId || !context.attemptId || !context.stepKey) return null;
    const retryIndex = SCENE_PIPELINE_STEP_DEFS.findIndex((step) => step.key === context.stepKey);
    if (retryIndex < 0) return null;
    clearAgentSceneInsertPreviewForContext(context);
    const session = updateAgentSessionById(context.sessionId, (session) => ({
        ...session,
        attempts: (session.attempts || []).map((attempt) => {
            if (attempt.id !== context.attemptId) return attempt;
            const resetBlock = (block) => {
                if (!block?.stepKey) return block;
                const stepIndex = SCENE_PIPELINE_STEP_DEFS.findIndex((step) => step.key === block.stepKey);
                if (stepIndex < 0) return block;
                if (block.applied || stepIndex <= retryIndex) return block;
                return {
                    ...block,
                    statusText: t('agent.pipelineSteps.pending'),
                    statusId: 'pending',
                    value: 0,
                    indeterminate: false,
                    images: [],
                    selectedIndex: 0,
                    applied: false,
                    actions: [],
                    isCurrent: false,
                    expanded: false,
                    artifacts: [],
                    sceneInsertPlan: undefined,
                };
            };
            const nextAttempt = {
                ...attempt,
                blocks: (attempt.blocks || []).map(resetBlock),
                ...(Array.isArray(attempt.steps) ? { steps: attempt.steps.map(resetBlock) } : {}),
                updatedAt: new Date().toISOString(),
            };
            return {
                ...nextAttempt,
                pipelineState: deriveScenePipelineState(session, nextAttempt, {
                    currentStepKey: context.stepKey,
                    status: 'running',
                }),
            };
        }),
        updatedAt: new Date().toISOString(),
    }), {
        autoScroll: 'preserve-or-pin-bottom',
        skipRender: true,
    });
    if (session) {
        renderAgentSessionElement(context.sessionId, {
            autoScroll: 'preserve-or-pin-bottom',
        });
    }
    return session;
}

function markSceneAttemptCanceled(context) {
    if (!context?.sessionId || !context.attemptId) return null;
    const cancelIndex = SCENE_PIPELINE_STEP_DEFS.findIndex((step) => step.key === context.stepKey);
    return updateAgentSessionById(context.sessionId, (session) => ({
        ...session,
        attempts: (session.attempts || []).map((attempt) => {
            if (attempt.id !== context.attemptId) return attempt;
            const patchBlock = (block) => {
                if (!block?.stepKey) return block;
                const stepIndex = SCENE_PIPELINE_STEP_DEFS.findIndex((step) => step.key === block.stepKey);
                if (stepIndex < 0) return block;
                if (block.applied || stepIndex < cancelIndex) {
                    return {
                        ...block,
                        statusId: 'done',
                        value: 1,
                        indeterminate: false,
                        isCurrent: false,
                        actions: [],
                    };
                }
                return {
                    ...block,
                    statusId: 'canceled',
                    statusText: t('agent.pipelineSteps.canceled'),
                    value: 0,
                    indeterminate: false,
                    isCurrent: false,
                    actions: [],
                };
            };
            const nextAttempt = {
                ...attempt,
                status: 'interrupted',
                blocks: (attempt.blocks || []).map(patchBlock),
                ...(Array.isArray(attempt.steps) ? { steps: attempt.steps.map(patchBlock) } : {}),
                updatedAt: new Date().toISOString(),
            };
            return {
                ...nextAttempt,
                pipelineState: deriveScenePipelineState(session, nextAttempt, {
                    status: 'canceled',
                    currentStepKey: context.stepKey,
                }),
            };
        }),
        updatedAt: new Date().toISOString(),
    }), {
        autoScroll: 'preserve-or-pin-bottom',
    });
}

function getInterruptedAgentStepContext(sessionId, attemptId = '') {
    const session = state.agentMessages.find((item) => item?.kind === 'session' && item.id === sessionId);
    if (!session) return null;
    const attempt = attemptId
        ? session.attempts?.find((item) => item?.id === attemptId)
        : getAgentSessionActiveAttempt(session);
    if (!attempt || attempt.status !== 'interrupted') return null;
    const blocks = getAgentAttemptStepBlocks(attempt);
    const pipelineCurrentStepKey = String(attempt.pipelineState?.currentStepKey || '').trim();
    const block = blocks.find((item) => (
        item?.type === 'progress'
        && item.stepKey
        && !item.applied
        && (item.isCurrent || (pipelineCurrentStepKey && item.stepKey === pipelineCurrentStepKey))
    ));
    if (!block?.id) return null;
    return {
        session,
        attempt,
        block,
        sessionId: session.id,
        attemptId: attempt.id,
        blockId: block.id,
        stepKey: block.stepKey,
    };
}

function resumeInterruptedAgentStepAttempt(context) {
    if (!context?.sessionId || !context.attemptId) return null;
    return updateAgentSessionById(context.sessionId, (session) => ({
        ...session,
        attempts: (session.attempts || []).map((attempt) => {
            if (attempt.id !== context.attemptId || attempt.status !== 'interrupted') return attempt;
            const nextAttempt = {
                ...attempt,
                status: 'complete',
                pipelineState: normalizeInterruptedPipelineState(attempt.pipelineState),
                updatedAt: new Date().toISOString(),
            };
            return {
                ...nextAttempt,
                pipelineState: deriveScenePipelineState(session, nextAttempt),
            };
        }),
        updatedAt: new Date().toISOString(),
    }), {
        autoScroll: 'preserve-or-pin-bottom',
        skipRender: true,
    });
}

async function handleInterruptedAgentStepAction(context, action) {
    const liveContext = getAgentStepBlockContextById(context?.sessionId, context?.attemptId, context?.blockId) || context;
    if (!liveContext || liveContext.attempt?.status !== 'interrupted') return;
    if (action === 'cancel') {
        await handleAgentSessionAction(liveContext.sessionId, 'cancel');
        return;
    }
    if (action !== 'retry') return;
    if (liveContext.session?.workflow === 'camera-direct') {
        await handleAgentSessionAction(liveContext.sessionId, 'retry');
        return;
    }
    resumeInterruptedAgentStepAttempt(liveContext);
    const retryContext = getAgentStepBlockContextById(liveContext.sessionId, liveContext.attemptId, liveContext.blockId) || liveContext;
    await handleAgentStepAction(retryContext, 'retry');
}

function renderAgentSessionStepBlocksExpanded(sessionId, attemptId, expanded) {
    if (!sessionId || !attemptId) return null;
    const nextExpanded = Boolean(expanded);
    const patchBlocks = (blocks = []) => blocks.map((block) => (
        block?.type === 'progress' && block.stepKey
            ? { ...block, expanded: nextExpanded }
            : block
    ));
    const nextSession = updateAgentSessionById(sessionId, (session) => ({
        ...session,
        attempts: (session.attempts || []).map((attempt) => {
            if (attempt.id !== attemptId) return attempt;
            const nextBlocks = patchBlocks(attempt.blocks || []);
            return {
                ...attempt,
                blocks: nextBlocks,
                ...(Array.isArray(attempt.steps) ? { steps: patchBlocks(attempt.steps) } : {}),
                stepBlocksCollapsed: !nextExpanded,
                updatedAt: new Date().toISOString(),
            };
        }),
        updatedAt: new Date().toISOString(),
    }), {
        skipRender: true,
    });
    if (nextSession) {
        const synced = syncAgentSessionStepBlocksDom(sessionId, attemptId, nextExpanded);
        if (!synced) {
            renderAgentSessionElement(sessionId, {
                autoScroll: 'preserve-or-pin-bottom',
                animateLayout: {
                    sessionId,
                    attemptId,
                    expand: nextExpanded,
                },
            });
        }
    }
    return nextSession;
}

function updateAgentStepSelectedIndex(context, selectedIndex) {
    if (!context) return null;
    const session = updateAgentSessionById(context.sessionId, (session) => patchAgentSessionAttemptBlock(session, {
        attemptId: context.attemptId,
        blockId: context.blockId,
        patch: { selectedIndex },
    }), {
        skipRender: true,
    });
    if (!session) return null;
    const nextContext = getAgentStepBlockContextById(context.sessionId, context.attemptId, context.blockId);
    if (nextContext) {
        updateAgentStepGalleryDom(nextContext);
        void syncAgent3DBlocks();
    }
    return session;
}

function getAgentStepBlockContextById(sessionId, attemptId, blockId) {
    const session = state.agentMessages.find((item) => item?.kind === 'session' && item.id === sessionId);
    const attempt = session?.attempts?.find((item) => item?.id === attemptId);
    const block = getAgentAttemptStepBlocks(attempt).find((item) => item?.id === blockId);
    if (!session || !attempt || !block?.stepKey) return null;
    return {
        session,
        attempt,
        block,
        sessionId,
        attemptId,
        blockId,
        stepKey: block.stepKey,
    };
}

function getAgentStepBlockContextByStepKey(sessionId, attemptId, stepKey) {
    const session = state.agentMessages.find((item) => item?.kind === 'session' && item.id === sessionId);
    const attempt = session?.attempts?.find((item) => item?.id === attemptId);
    const block = getAgentAttemptStepBlocks(attempt).find((item) => item?.stepKey === stepKey);
    if (!session || !attempt || !block?.id || !block.stepKey) return null;
    return {
        session,
        attempt,
        block,
        sessionId,
        attemptId,
        blockId: block.id,
        stepKey: block.stepKey,
    };
}

function updateAgentStepGalleryDom(context) {
    const blockElement = Array.from(dom.agentMessageList?.querySelectorAll('[data-agent-block-id]') || [])
        .find((element) => element instanceof HTMLElement && element.dataset.agentBlockId === context.blockId);
    if (!(blockElement instanceof HTMLElement)) return;
    const images = Array.isArray(context.block.images) ? context.block.images : [];
    const selectedIndex = Math.max(0, Math.min(images.length - 1, Number(context.block.selectedIndex) || 0));
    const selectedImage = images[selectedIndex] || null;
    const galleryMain = blockElement.querySelector('.agent-step-gallery-main');
    if (galleryMain instanceof HTMLElement && selectedImage) {
        galleryMain.innerHTML = renderAgentStepGalleryMain({
            block: context.block,
            images,
            selectedImage,
            selectedIndex,
            isApplied: Boolean(context.block.applied),
            isInterruptedAttempt: context.attempt?.status === 'interrupted',
        });
        syncAgentImageFrameAspectRatios(galleryMain);
    }
    const count = blockElement.querySelector('.agent-step-gallery-count');
    if (count) {
        count.textContent = `${selectedIndex + 1} / ${images.length}`;
    }
    const gallery = blockElement.querySelector('.agent-step-gallery');
    if (gallery instanceof HTMLElement) {
        const previousMetadata = gallery.querySelector('.agent-step-metadata');
        previousMetadata?.remove();
        if (selectedImage) {
            gallery.insertAdjacentHTML('beforeend', renderAgentStepImageMetadata(selectedImage));
        }
    }
    blockElement.querySelectorAll('[data-agent-step-gallery-nav]').forEach((button) => {
        if (!(button instanceof HTMLButtonElement)) return;
        const direction = button.dataset.agentStepGalleryNav;
        button.disabled = isAgentStepGalleryNavigationLocked(context.block, context.attempt)
            || images.length <= 1
            || (direction === 'prev' && selectedIndex <= 0)
            || (direction === 'next' && selectedIndex >= images.length - 1);
    });
}

function renderAgentStepBlockElement(context, { autoScroll = 'preserve-or-pin-bottom' } = {}) {
    if (!context?.sessionId || !context.attemptId || !context.block?.id) return false;
    const currentElement = getAgentStepBlockDomElement(context.block.id);
    if (!currentElement) return false;
    const prevScrollTop = dom.agentMessageScroll?.scrollTop ?? 0;
    const prevClientHeight = dom.agentMessageScroll?.clientHeight ?? 0;
    const prevScrollHeight = dom.agentMessageScroll?.scrollHeight ?? 0;
    const shouldForceBottomAfterRender = shouldForceAgentMessageBottomAfterRender({
        mode: autoScroll,
        prevScrollTop,
        prevClientHeight,
        prevScrollHeight,
    });
    const sessionElement = getAgentSessionDomElement(context.sessionId);
    const stepBlocksCollapsed = Boolean(context.attempt?.stepBlocksCollapsed);
    const blocks = getAgentAttemptStepBlocks(context.attempt);
    const hiddenStepBlockIds = stepBlocksCollapsed
        ? new Set()
        : getDeferredAgentStepBlockIds(blocks);
    const template = document.createElement('template');
    template.innerHTML = renderAgentProgressBlock(context.block, {
        sessionId: context.sessionId,
        attemptId: context.attemptId,
        attempt: context.attempt,
        stepBlocksCollapsed,
        hiddenStepBlockIds,
    }).trim();
    const nextElement = template.content.firstElementChild;
    if (!(nextElement instanceof HTMLElement)) return false;
    currentElement.replaceWith(nextElement);
    syncAgentSessionHeaderDom(context.sessionId);
    syncAgentImageFrameAspectRatios(nextElement);
    retainAgentThumbnailImageCache(sessionElement || dom.agentMessageList);
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
            scheduleAgentMessageBottomPin(4);
            bindAgentMessageAsyncBottomPin();
            return;
        }
        syncAgentMessageScrollbar();
    });
    void syncAgent3DBlocks();
    return true;
}

function serializeAgentStepImage(image) {
    return {
        id: image?.id || image?.title || '',
        title: image?.title || image?.id || '',
        relativePath: image?.relativePath || image?.assetPath || '',
        assetPath: image?.assetPath || image?.relativePath || '',
        mimeType: image?.mimeType || '',
        bytes: image?.bytes || 0,
        metadata: image?.metadata && typeof image.metadata === 'object' ? image.metadata : undefined,
    };
}

function getSelectedAgentStepImage(attempt, stepKey) {
    const block = getAgentAttemptStepBlocks(attempt).find((item) => item?.stepKey === stepKey);
    const images = Array.isArray(block?.images) ? block.images : [];
    if (images.length <= 0) return null;
    const selectedIndex = Math.max(0, Math.min(images.length - 1, Number(block.selectedIndex) || 0));
    return images[selectedIndex] || null;
}

function getSelectedAgentStepSourceImageFromSession(session, currentAttempt, stepKey) {
    const attempts = [
        currentAttempt,
        ...(Array.isArray(session?.attempts) ? session.attempts : []),
    ].filter(Boolean);
    const seenAttempts = new Set();
    let fallbackImage = null;
    for (const attempt of attempts) {
        if (seenAttempts.has(attempt)) continue;
        seenAttempts.add(attempt);
        const block = getAgentAttemptStepBlocks(attempt).find((item) => item?.stepKey === stepKey);
        const image = getSelectedAgentStepImage(attempt, stepKey);
        if (!image) continue;
        if (block?.applied) {
            return image;
        }
        if (!fallbackImage) {
            fallbackImage = image;
        }
    }
    return fallbackImage;
}

function serializeAgentStepSourceImage(attempt, stepKey) {
    const image = getSelectedAgentStepImage(attempt, stepKey);
    if (!image) return null;
    return {
        ...serializeAgentStepImage(image),
        sourceStepKey: stepKey,
    };
}

function serializeAgentSessionStepSourceImage(session, currentAttempt, stepKey) {
    const image = getSelectedAgentStepSourceImageFromSession(session, currentAttempt, stepKey);
    if (!image) return null;
    return {
        ...serializeAgentStepImage(image),
        sourceStepKey: stepKey,
    };
}

function shouldShowAgentPipelineContinue(context) {
    return false;
}

function createAgentBlockId(prefix = 'block') {
    return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function createAgentProgressBlock({
    id = createAgentBlockId('progress'),
    stepKey = '',
    title = '',
    statusText = '',
    statusId = '',
    value = 0,
    indeterminate = false,
    images = [],
    selectedIndex = 0,
    applied = false,
    actions = [],
    isCurrent = false,
    expanded = false,
    artifacts = [],
    sceneInsertPlan = null,
    galleryLocked = null,
} = {}) {
    const gallery = Array.isArray(images) ? images : [];
    return {
        id,
        type: 'progress',
        stepKey,
        title,
        statusText,
        statusId,
        value,
        indeterminate,
        images: gallery,
        selectedIndex: Math.max(0, Math.min(gallery.length - 1, Number(selectedIndex) || 0)),
        applied: Boolean(applied),
        actions: Array.isArray(actions) ? actions.filter(Boolean).map((action) => String(action)) : [],
        isCurrent: Boolean(isCurrent),
        expanded: Boolean(expanded),
        artifacts: Array.isArray(artifacts) ? artifacts.filter(Boolean).map((artifact) => ({ ...artifact })) : [],
        ...(sceneInsertPlan && typeof sceneInsertPlan === 'object' ? { sceneInsertPlan } : {}),
        ...(typeof galleryLocked === 'boolean' ? { galleryLocked } : {}),
    };
}

function createScenePipelineStepBlock({
    key,
    titleKey,
    images = [],
    statusText = t('agent.pipelineSteps.pending'),
    statusId = 'pending',
    value = 0,
    indeterminate = false,
    applied = false,
    actions = [],
    isCurrent = false,
    expanded = false,
    artifacts = [],
    galleryLocked = null,
} = {}) {
    return createAgentProgressBlock({
        id: createAgentBlockId(`step-${key || 'pipeline'}`),
        stepKey: key,
        title: t(titleKey || 'agent.blocks.progress'),
        statusText,
        statusId,
        value,
        indeterminate,
        images,
        selectedIndex: 0,
        applied,
        actions,
        isCurrent,
        expanded,
        artifacts,
        galleryLocked,
    });
}

function isCameraPipelineStepKey(stepKey) {
    return CAMERA_PIPELINE_STAGE_PLAN.includes(String(stepKey || ''));
}

function isAgentStepGalleryNavigationLocked(block, attempt = null) {
    if (attempt?.status === 'interrupted') return true;
    if (typeof block?.galleryLocked === 'boolean') return block.galleryLocked;
    if (isCameraPipelineStepKey(block?.stepKey)) return false;
    return Boolean(block?.applied);
}

function normalizeAgentPipelineStatusId(statusId) {
    const normalized = String(statusId || '').trim();
    if (normalized === 'complete') return 'done';
    if (normalized === 'cancelled' || normalized === 'cancel') return 'canceled';
    if (normalized === 'fail' || normalized === 'error') return 'failed';
    if (normalized === 'done' || normalized === 'rendering' || normalized === 'running' || normalized === 'skipped' || normalized === 'canceled' || normalized === 'failed' || normalized === 'pending') {
        return normalized;
    }
    return '';
}

function getAgentPipelineStatusLabel(statusId) {
    const normalized = normalizeAgentPipelineStatusId(statusId);
    const def = AGENT_PIPELINE_STATUS_DEFS[normalized];
    return def ? t(def.labelKey) : '';
}

function getAgentPipelineStatusClass(statusId) {
    const normalized = normalizeAgentPipelineStatusId(statusId);
    return AGENT_PIPELINE_STATUS_DEFS[normalized]?.className || '';
}

function shouldShowAgentStepProgressTrack(statusId, block = {}) {
    const normalized = normalizeAgentPipelineStatusId(statusId);
    if (normalized === 'running' || normalized === 'rendering') return true;
    if (normalized === 'pending' || normalized === 'done' || normalized === 'skipped' || normalized === 'canceled' || normalized === 'failed') return false;
    const value = Number(block?.value);
    return Boolean(block?.indeterminate) || (Number.isFinite(value) && value > 0 && value < 1);
}

function createScenePipelineSteps({
    mainImageBlock,
} = {}) {
    return SCENE_PIPELINE_STEP_DEFS.map((definition, index) => {
        if (definition.key === 'main-image' && mainImageBlock) {
            return {
                ...mainImageBlock,
                title: mainImageBlock.title || t(definition.titleKey),
                statusId: mainImageBlock.statusId || (mainImageBlock.indeterminate ? 'running' : 'done'),
                isCurrent: !mainImageBlock.applied,
                expanded: true,
            };
        }
        const unlocked = index === 1 && Boolean(mainImageBlock?.applied);
        return createScenePipelineStepBlock({
            key: definition.key,
            titleKey: definition.titleKey,
            statusText: unlocked ? t('agent.pipelineSteps.current') : t('agent.pipelineSteps.pending'),
            statusId: unlocked ? 'pending' : 'pending',
            value: 0,
            isCurrent: unlocked,
            expanded: false,
            actions: [],
        });
    });
}

function createCameraPipelineSteps({
    task = {},
    pending = false,
} = {}) {
    if (pending) return [];
    const taskEvents = Array.isArray(task?.events) ? task.events : [];
    const eventPayloads = taskEvents
        .map((event) => getAgentTaskEventPayload(event))
        .filter((payload) => Object.keys(payload).length > 0);
    const fallbackPayload = {
        title: task?.title,
        statusText: task?.statusText,
        message: task?.statusText,
        progress: task?.progress,
        stage: task?.stage,
        pipelineStages: task?.pipelineStages,
        pipelineStageStatuses: task?.pipelineStageStatuses,
        images: task?.images,
        initialViewImages: task?.initialViewImages,
        directorIntentText: task?.directorIntentText,
        artifacts: task?.artifacts,
    };
    const payloadInputs = eventPayloads.length > 0
        ? eventPayloads
        : (hasCameraTaskPayloadSignal(fallbackPayload) ? [fallbackPayload] : []);
    if (payloadInputs.length <= 0) return [];
    const payloads = coalesceAgentTaskStepPayloads(payloadInputs);
    const plannedStages = getCameraTaskPipelineStages(payloads);
    const stageStatuses = getCameraTaskStageStatuses(task, plannedStages, payloads);
    return payloads.map((payload, index) => {
        const stage = getCameraTaskPayloadStage(payload) || `camera-task-${index + 1}`;
        const stageIndex = getCameraPipelineStageIndex(stage, plannedStages);
        const progress = getCameraTaskPayloadProgress(payload);
        const statusText = getAgentTaskEventStatusText(payload) || String(payload?.detailText || '').trim();
        const statusId = stageStatuses[stage] || getCameraTaskPayloadStatusId(payload) || 'pending';
        const isComplete = statusId === 'done';
        const isActive = !isComplete && (statusId === 'running' || statusId === 'rendering');
        const definition = getCameraPipelineStepDefinitionForStage(stage);
        const images = normalizeAgentTaskPayloadImages(payload.images);
        const artifacts = getPayloadArtifactsForStage(payload, stage);
        const block = createScenePipelineStepBlock({
            key: stage || definition.key,
            titleKey: definition.titleKey,
            statusText,
            statusId,
            value: isComplete ? 1 : isActive ? Math.max(0.01, Math.min(0.99, progress || 0.01)) : 0,
            indeterminate: isActive,
            applied: isComplete,
            actions: [],
            isCurrent: isActive,
            expanded: isActive || isComplete || images.length > 0 || artifacts.length > 0,
            images,
            artifacts,
            galleryLocked: false,
        });
        const title = String(payload?.title || '').trim();
        const shouldUsePayloadTitle = definition.titleKey === 'agent.workflows.camera-direct.progressTitle';
        return title && shouldUsePayloadTitle ? { ...block, title } : block;
    });
}

function coalesceAgentTaskStepPayloads(payloads = []) {
    const byKey = new Map();
    const plannedStages = getCameraTaskPipelineStages(payloads);
    plannedStages.forEach((stage) => {
        const normalizedStage = normalizeCameraPipelineStage(stage);
        byKey.set(normalizedStage, {
            stage: normalizedStage,
            progress: 0,
            planned: true,
        });
    });
    payloads.forEach((payload, index) => {
        const stage = getCameraTaskPayloadStage(payload);
        const title = String(payload?.title || '').trim();
        const key = stage || title || `camera-task-${index + 1}`;
        const previous = byKey.get(key);
        byKey.set(key, {
            ...(previous || {}),
            ...payload,
            stage,
            title: title || previous?.title || '',
            started: true,
            statusId: getCameraTaskPayloadStatusId(payload) || previous?.statusId || '',
            artifacts: getPayloadArtifactsForStage(payload, stage),
        });
        distributeCameraTaskPayloadArtifacts(byKey, payload);
    });
    return orderCameraTaskPayloads(byKey, plannedStages);
}

function getCameraTaskPipelineStages(payloads = []) {
    const stages = [];
    CAMERA_PIPELINE_STAGE_PLAN.forEach((stage) => {
        const normalizedStage = normalizeCameraPipelineStage(stage);
        if (normalizedStage && !stages.includes(normalizedStage)) {
            stages.push(normalizedStage);
        }
    });
    for (const payload of payloads) {
        const payloadStages = Array.isArray(payload?.pipelineStages) ? payload.pipelineStages : [];
        const normalized = payloadStages
            .map((item) => String(typeof item === 'string' ? item : item?.stage || '').trim())
            .map((stage) => normalizeCameraPipelineStage(stage))
            .filter(Boolean);
        normalized.forEach((stage) => {
            if (!stages.includes(stage)) stages.push(stage);
        });
    }
    return stages;
}

function getCanceledCameraPipelineStageStatuses(plannedStages = CAMERA_PIPELINE_STAGE_PLAN, payloads = []) {
    const statuses = getCameraTaskStageStatuses({}, plannedStages, payloads);
    plannedStages.forEach((stage) => {
        const normalizedStage = normalizeCameraPipelineStage(stage);
        if (!normalizedStage) return;
        if (statuses[normalizedStage] !== 'done') {
            statuses[normalizedStage] = 'canceled';
        }
    });
    return statuses;
}

function getCameraTaskStageStatuses(task = {}, plannedStages = [], payloads = []) {
    const statuses = {};
    const explicitStatuses = Array.isArray(task?.pipelineStageStatuses) ? task.pipelineStageStatuses : [];
    if (explicitStatuses.length > 0) {
        explicitStatuses.forEach((item) => {
            const stage = normalizeCameraPipelineStage(item?.stage || '');
            const statusId = normalizeAgentPipelineStatusId(item?.statusId || item?.statusKey || '');
            if (stage && statusId) {
                statuses[stage] = statusId;
            }
        });
        return applyCameraPipelineImplicitHandoffStatuses(task, statuses);
    }

    const currentStage = normalizeCameraPipelineStage(task?.stage || '');
    const currentStatusId = normalizeAgentPipelineStatusId(task?.statusId || '');
    const currentIndex = currentStage ? plannedStages.map((stage) => normalizeCameraPipelineStage(stage)).indexOf(currentStage) : -1;
    const firstPayloadIndex = payloads.findIndex((item) => {
        const stage = normalizeCameraPipelineStage(getCameraTaskPayloadStage(item));
        return Boolean(stage);
    });
    plannedStages.forEach((stage, index) => {
        const normalizedStage = normalizeCameraPipelineStage(stage);
        if (!normalizedStage) return;
        if (currentIndex >= 0) {
            if (index < currentIndex) {
                statuses[normalizedStage] = 'done';
                return;
            }
            if (index === currentIndex) {
                statuses[normalizedStage] = currentStatusId || (normalizedStage === 'camera_initial_view_prepare' || normalizedStage === 'camera_trajectory_eval_render' ? 'rendering' : 'running');
                return;
            }
            statuses[normalizedStage] = 'pending';
            return;
        }
        const payload = payloads.find((item) => normalizeCameraPipelineStage(getCameraTaskPayloadStage(item)) === normalizedStage);
        const payloadStatusId = normalizeAgentPipelineStatusId(payload?.statusId || '');
        if (payloadStatusId) {
            statuses[normalizedStage] = payloadStatusId;
            return;
        }
        if (firstPayloadIndex >= 0 && index === firstPayloadIndex) {
            statuses[normalizedStage] = currentStatusId || 'pending';
            return;
        }
        statuses[normalizedStage] = 'pending';
    });
    return applyCameraPipelineImplicitHandoffStatuses(task, statuses);
}

function orderCameraTaskPayloads(byKey, plannedStages = []) {
    const ordered = [];
    const used = new Set();
    plannedStages
        .map((stage) => normalizeCameraPipelineStage(stage))
        .filter(Boolean)
        .forEach((stage) => {
            const payload = byKey.get(stage);
            if (!payload) return;
            ordered.push(payload);
            used.add(stage);
        });
    byKey.forEach((payload, key) => {
        if (used.has(key)) return;
        ordered.push(payload);
    });
    return ordered;
}

function distributeCameraTaskPayloadArtifacts(byKey, payload = {}) {
    const initialViewImages = normalizeAgentTaskPayloadImages(payload.initialViewImages);
    if (initialViewImages.length > 0) {
        mergeCameraTaskPayload(byKey, 'camera_initial_view_prepare', {
            stage: 'camera_initial_view_prepare',
            images: initialViewImages,
        });
    }
    const directorText = String(payload.directorIntentText || '').trim();
    if (directorText) {
        mergeCameraTaskPayload(byKey, 'camera_director_analysis', {
            stage: 'camera_director_analysis',
            progress: 1,
            artifacts: [{
                kind: 'text',
                title: t('agent.pipelineSteps.cameraDirector'),
                targetStage: 'camera_director_analysis',
                text: directorText,
            }],
        });
    }
    const artifacts = Array.isArray(payload.artifacts) ? payload.artifacts : [];
    artifacts.forEach((artifact) => {
        if (!artifact || typeof artifact !== 'object') return;
        const targetStage = normalizeCameraPipelineStage(artifact.targetStage || artifact.stage);
        if (!targetStage) return;
        mergeCameraTaskPayload(byKey, targetStage, {
            stage: targetStage,
            progress: 1,
            artifacts: [{ ...artifact }],
        });
    });
}

function mergeCameraTaskPayload(byKey, key, patch = {}) {
    const previous = byKey.get(key) || {};
    const nextArtifacts = [
        ...(Array.isArray(previous.artifacts) ? previous.artifacts : []),
        ...(Array.isArray(patch.artifacts) ? patch.artifacts : []),
    ];
    const nextImages = [
        ...(Array.isArray(previous.images) ? previous.images : []),
        ...(Array.isArray(patch.images) ? patch.images : []),
    ];
    byKey.set(key, {
        ...previous,
        ...patch,
        artifacts: dedupeAgentTaskArtifacts(nextArtifacts),
        images: dedupeAgentTaskImages(nextImages),
    });
}

function getCameraTaskPayloadStage(payload = {}) {
    const explicitStage = String(payload?.stage || '').trim();
    if (explicitStage) return normalizeCameraPipelineStage(explicitStage);
    return normalizeCameraPipelineStage(getCameraPipelineStageForStatusText(getAgentTaskEventStatusText(payload))
        || getCameraPipelineStageForTitle(payload?.title));
}

function normalizeCameraPipelineStage(stage) {
    const normalizedStage = String(stage || '').trim();
    if (normalizedStage === 'camera_initial_view_render') return 'camera_initial_view_prepare';
    if (normalizedStage === 'camera_trajectory_eval_optimization') return 'camera_trajectory_eval_render';
    return normalizedStage;
}

function getCameraTaskPayloadStatusId(payload = {}) {
    const explicitStatusId = normalizeAgentPipelineStatusId(payload?.statusId || payload?.statusKey || '');
    if (explicitStatusId) return explicitStatusId;
    const statusText = getAgentTaskEventStatusText(payload);
    if (/^(运行中|Running|生成中|Processing|当前步骤|Current step)/i.test(statusText)) return 'running';
    if (/^(渲染中|Rendering)/i.test(statusText)) return 'rendering';
    if (/^(已完成|Completed)/i.test(statusText)) return 'done';
    if (/^(已跳过|Skipped)/i.test(statusText)) return 'skipped';
    if (/^(已取消|Canceled|Cancelled)/i.test(statusText)) return 'canceled';
    if (/^(等待|Waiting|Pending)/i.test(statusText)) return 'pending';
    return '';
}

function getCameraPipelineStageIndex(stage, plannedStages = CAMERA_PIPELINE_STAGE_PLAN) {
    const normalizedStage = normalizeCameraPipelineStage(stage);
    return plannedStages.map((item) => normalizeCameraPipelineStage(item)).indexOf(normalizedStage);
}

function getCameraTaskPayloadProgress(payload = {}) {
    return Math.max(0, Math.min(1, Number(payload?.progress ?? payload?.value ?? payload?.percent) || 0));
}

function isCameraTaskPayloadStarted(payload = {}) {
    return payload?.started === true
        || getCameraTaskPayloadProgress(payload) > 0
        || Boolean(getAgentTaskEventStatusText(payload));
}

function hasCameraTaskPayloadSignal(payload = {}) {
    return Boolean(
        String(payload?.stage || '').trim()
        || String(payload?.statusText || payload?.message || '').trim()
        || Array.isArray(payload?.pipelineStages)
        || Array.isArray(payload?.images)
        || Array.isArray(payload?.initialViewImages)
        || Array.isArray(payload?.artifacts)
        || String(payload?.directorIntentText || '').trim()
    );
}

function getPayloadArtifactsForStage(payload = {}, stage = '') {
    const normalizedStage = normalizeCameraPipelineStage(stage);
    const payloadStage = getCameraTaskPayloadStage(payload);
    const artifacts = Array.isArray(payload?.artifacts) ? payload.artifacts : [];
    return dedupeAgentTaskArtifacts(artifacts
        .filter((artifact) => {
            if (!artifact || typeof artifact !== 'object') return false;
            const targetStage = normalizeCameraPipelineStage(artifact.targetStage || artifact.stage);
            if (targetStage) return targetStage === normalizedStage;
            return payloadStage === normalizedStage;
        })
        .map((artifact) => ({ ...artifact })));
}

function getAgentTaskEventPayload(event) {
    const item = event?.item && typeof event.item === 'object' ? event.item : {};
    const candidates = [
        event?.payload,
        event?.data,
        event?.arguments,
        event?.args,
        event?.result,
        event?.visionaryTask,
        item.arguments,
        item.result,
        item.payload,
        item.visionaryTask,
        getAgentTaskEventTextResult(item.result || item),
        event,
        item,
    ];
    for (const candidate of candidates) {
        const payload = typeof candidate === 'string'
            ? parseAgentTaskEventJsonObject(candidate)
            : candidate;
        if (!payload || typeof payload !== 'object') continue;
        if (payload.visionaryTask && typeof payload.visionaryTask === 'object') {
            return payload.visionaryTask;
        }
        if (payload.payload && typeof payload.payload === 'object') {
            return payload.payload;
        }
        if (
            'stage' in payload
            || 'progress' in payload
            || 'value' in payload
            || 'percent' in payload
            || 'statusText' in payload
            || 'message' in payload
            || 'title' in payload
        ) {
            return payload;
        }
    }
    return {};
}

function parseAgentTaskEventJsonObject(value) {
    const text = String(value || '').trim();
    if (!text || (!text.startsWith('{') && !text.startsWith('['))) return {};
    try {
        const parsed = JSON.parse(text);
        return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {};
    } catch {
        return {};
    }
}

function getAgentTaskEventTextResult(value) {
    if (typeof value === 'string') return value;
    if (!value || typeof value !== 'object') return '';
    if (typeof value.text === 'string') return value.text;
    const content = Array.isArray(value.content) ? value.content : [];
    const textItem = content.find((item) => item && typeof item === 'object' && typeof item.text === 'string');
    return textItem?.text || '';
}

function getAgentTaskEventStatusText(payload = {}) {
    return String(payload.statusText || payload.message || payload.status || '').trim();
}

function getCameraPipelineStageForStatusText(statusText) {
    const text = String(statusText || '').trim();
    if (/导演意图|场景分析/.test(text)) return 'camera_director_analysis';
    if (/初始.*视图|初始相机/.test(text)) return 'camera_initial_view_prepare';
    if (/评估.*渲染/.test(text)) return 'camera_trajectory_eval_render';
    if (/评估|优化/.test(text)) return 'camera_trajectory_eval_render';
    if (/分镜相机轨迹|Visionary 相机轨迹格式|相机轨迹生成/.test(text)) return 'camera_trajectory_generation';
    if (/场景信息|scene\.json|Trajectory_gen 场景信息/.test(text)) return 'camera_scene_info_export';
    return '';
}

function getCameraPipelineStageForTitle(title) {
    const normalizedTitle = String(title || '').trim();
    const titleMap = new Map([
        ['相机场景信息导出', 'camera_scene_info_export'],
        ['相机初始视图准备', 'camera_initial_view_prepare'],
        ['相机轨迹生成', 'camera_trajectory_generation'],
    ]);
    return titleMap.get(normalizedTitle) || '';
}

function normalizeAgentTaskPayloadImages(images = []) {
    return (Array.isArray(images) ? images : [])
        .map((image, index) => {
            const assetPath = String(image?.relativePath || image?.assetPath || '').trim();
            if (!assetPath && !image?.src) return null;
            return {
                id: image?.id || image?.title || `Image ${index + 1}`,
                title: image?.title || image?.id || `Image ${index + 1}`,
                relativePath: assetPath,
                assetPath,
                mimeType: image?.mimeType || '',
                bytes: image?.bytes || 0,
                metadata: image?.metadata && typeof image.metadata === 'object' ? image.metadata : undefined,
                src: assetPath
                    ? projectApi.getAssetUrl(state.projectSession.user, state.projectSession.activeProjectId, assetPath)
                    : image.src,
                alt: image?.alt || image?.title || '',
            };
        })
        .filter(Boolean);
}

function dedupeAgentTaskImages(images = []) {
    const seen = new Set();
    return images.filter((image) => {
        const key = String(image?.relativePath || image?.assetPath || image?.src || image?.id || '').trim();
        if (!key || seen.has(key)) return false;
        seen.add(key);
        return true;
    });
}

function dedupeAgentTaskArtifacts(artifacts = []) {
    const seen = new Set();
    return artifacts.filter((artifact) => {
        const artifactStage = normalizeCameraPipelineStage(artifact?.targetStage || artifact?.stage);
        const key = `${artifact?.kind || ''}:${artifactStage}:${artifact?.text || artifact?.content || ''}:${artifact?.relativePath || artifact?.assetPath || ''}`;
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
    });
}

function getCameraPipelineStepDefinitionForStage(stage) {
    const normalizedStage = String(stage || '').trim();
    if (normalizedStage === 'camera_scene_info_export') {
        return CAMERA_PIPELINE_STEP_DEFS.find((step) => step.key === 'camera-scene-info') || CAMERA_PIPELINE_STEP_DEFS[0];
    }
    if (normalizedStage === 'camera_initial_view_prepare' || normalizedStage === 'camera_initial_view_render') {
        return CAMERA_PIPELINE_STEP_DEFS.find((step) => step.key === 'camera-initial-views') || CAMERA_PIPELINE_STEP_DEFS[1];
    }
    if (normalizedStage === 'camera_director_analysis') {
        return CAMERA_PIPELINE_STEP_DEFS.find((step) => step.key === 'camera-director') || CAMERA_PIPELINE_STEP_DEFS[2];
    }
    if (normalizedStage === 'camera_trajectory_generation') {
        return CAMERA_PIPELINE_STEP_DEFS.find((step) => step.key === 'camera-trajectory') || CAMERA_PIPELINE_STEP_DEFS[3];
    }
    if (normalizedStage === 'camera_trajectory_eval_render' || normalizedStage === 'camera_trajectory_eval_optimization') {
        return CAMERA_PIPELINE_STEP_DEFS.find((step) => step.key === 'camera-eval') || CAMERA_PIPELINE_STEP_DEFS[4];
    }
    return {
        key: normalizedStage || 'camera-task',
        titleKey: 'agent.workflows.camera-direct.progressTitle',
    };
}

function createPendingCodexTaskSession({
    workflowId,
    prompt,
    attachments = [],
} = {}) {
    if (workflowId === 'camera-direct') {
        const attempt = createAgentGenerationAttempt({
            workflow: workflowId,
            text: t('common.generating'),
            blocks: [],
            steps: [],
            status: 'running',
        });
        return createAgentSession({
            workflow: workflowId,
            prompt,
            attachments,
            attempt,
        });
    }
    const mainImageBlock = createAgentProgressBlock({
        title: t('agent.pipelineSteps.mainImage'),
        stepKey: 'main-image',
        statusText: t('common.generating'),
        value: 0.01,
        indeterminate: true,
        images: [],
        selectedIndex: 0,
        applied: false,
        actions: [],
        isCurrent: true,
        expanded: true,
    });
    const steps = createScenePipelineSteps({ mainImageBlock });
    const attempt = createAgentGenerationAttempt({
        workflow: workflowId,
        text: t('common.generating'),
        blocks: steps,
        steps,
        status: 'running',
    });
    const session = createAgentSession({
        workflow: workflowId,
        prompt,
        attachments,
        attempt,
    });
    const activeAttempt = getAgentSessionActiveAttempt(session);
    if (activeAttempt) {
        activeAttempt.pipelineState = deriveScenePipelineState(session, activeAttempt);
    }
    return session;
}

function getNextScenePipelineStepKey(stepKey) {
    const index = SCENE_PIPELINE_STEP_DEFS.findIndex((step) => step.key === stepKey);
    return index >= 0 && index < SCENE_PIPELINE_STEP_DEFS.length - 1
        ? SCENE_PIPELINE_STEP_DEFS[index + 1].key
        : '';
}

function createAgentImageBlock({
    id = createAgentBlockId('image'),
    title = '',
    status = 'placeholder',
    src = '',
    alt = '',
    assetPath = '',
} = {}) {
    return {
        id,
        type: 'image',
        title,
        status,
        src,
        alt,
        assetPath,
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

function getAgentStepImageProjectAssetUrl(relativePath) {
    const assetPath = String(relativePath || '').trim();
    if (!assetPath) return '';
    const activeProjectId = String(state.projectSession.activeProjectId || '').trim();
    const inferredProjectId = assetPath.match(/^agent_history\/assets\/new_pipeline\/([^/]+)\//)?.[1] || '';
    const projectId = activeProjectId || inferredProjectId;
    if (!projectId) return '';
    return projectApi.getAssetUrl(state.projectSession.user, projectId, assetPath);
}

function getAgentStepImageThumbnailSrc(image) {
    const metadata = image?.metadata && typeof image.metadata === 'object' ? image.metadata : null;
    const thumbnailPath = String(
        metadata?.thumbnailPath
        || metadata?.frontRenderPath
        || metadata?.previewPath
        || ''
    ).trim();
    if (thumbnailPath) {
        return getAgentStepImageProjectAssetUrl(thumbnailPath);
    }
    return image?.src || '';
}

function getAgentStepImageGlbPath(image) {
    const metadata = image?.metadata && typeof image.metadata === 'object' ? image.metadata : null;
    const glbPaths = Array.isArray(metadata?.glbPaths)
        ? metadata.glbPaths.map((item) => String(item || '').trim()).filter(Boolean)
        : [];
    return glbPaths[0] || '';
}

function createAgentStepImageViewer3DBlock(block, image, selectedIndex = 0) {
    const glbPath = getAgentStepImageGlbPath(image);
    if (!glbPath) return null;
    return createAgentViewer3DBlock({
        id: `${block.id}-viewer-${String(selectedIndex).padStart(3, '0')}`,
        title: image?.title || image?.id || block.title || t('agent.blocks.viewer3d'),
        status: 'ready',
        assetUrl: getAgentStepImageProjectAssetUrl(glbPath),
        format: 'glb',
        interaction: { rotate: true, zoom: true, pan: false, reset: true },
    });
}

function isImageFile(file) {
    if (!(file instanceof File)) return false;
    if (typeof file.type === 'string' && file.type.startsWith('image/')) return true;
    return /\.(png|jpe?g|webp|gif|bmp|svg)$/i.test(file.name || '');
}

function escapeRegExpLiteral(value) {
    return String(value || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function getAgentComposerSkillDef(skillId = state.agentComposerSkillId) {
    return AGENT_COMPOSER_SKILL_DEFS.find((skill) => skill.id === skillId) || null;
}

function ensureAgentComposerSkillTokenHost() {
    if (!dom.agentComposerInput) return null;
    let host = dom.agentComposerSkillTokens;
    if (!(host instanceof HTMLElement) || !dom.agentComposerInput.contains(host)) {
        host = document.createElement('span');
        host.id = 'agentComposerSkillTokens';
        host.className = 'agent-composer-skill-tokens';
        host.setAttribute('contenteditable', 'false');
        host.hidden = true;
        dom.agentComposerInput.prepend(host);
        dom.agentComposerSkillTokens = host;
    }
    return host;
}

function getAgentComposerInputText() {
    if (!dom.agentComposerInput) return '';
    const clone = dom.agentComposerInput.cloneNode(true);
    clone.querySelector?.('#agentComposerSkillTokens')?.remove();
    return String(clone.textContent || '').replace(/\u00a0/g, ' ');
}

function setAgentComposerInputText(text, { focus = true } = {}) {
    if (!dom.agentComposerInput) return;
    const host = ensureAgentComposerSkillTokenHost();
    Array.from(dom.agentComposerInput.childNodes).forEach((node) => {
        if (node !== host) {
            node.remove();
        }
    });
    if (host && host.parentNode !== dom.agentComposerInput) {
        dom.agentComposerInput.prepend(host);
    }
    const nextText = String(text || '');
    if (nextText) {
        dom.agentComposerInput.append(document.createTextNode(nextText));
    }
    syncAgentComposerInputEmptyState();
    if (focus) {
        placeAgentComposerCaretAtEnd();
    }
}

function syncAgentComposerInputEmptyState() {
    if (!dom.agentComposerInput) return;
    dom.agentComposerInput.classList.toggle('is-empty', !state.agentComposerSkillId && getAgentComposerInputText().trim().length === 0);
}

function placeAgentComposerCaretAtEnd() {
    if (!dom.agentComposerInput || !document.createRange || !window.getSelection) return;
    dom.agentComposerInput.focus();
    const range = document.createRange();
    range.selectNodeContents(dom.agentComposerInput);
    range.collapse(false);
    const selection = window.getSelection();
    selection?.removeAllRanges();
    selection?.addRange(range);
}

function getAgentComposerSkillAliasPattern() {
    const aliases = AGENT_COMPOSER_SKILL_DEFS
        .flatMap((skill) => skill.aliases || [skill.value])
        .sort((a, b) => b.length - a.length)
        .map(escapeRegExpLiteral);
    return aliases.length > 0 ? aliases.join('|') : '$.';
}

function extractAgentComposerSkillText(text) {
    const source = String(text || '');
    const pattern = getAgentComposerSkillAliasPattern();
    const match = new RegExp(`(^|\\s)(${pattern})(?=\\s|$)`, 'i').exec(source);
    if (!match) {
        return { skill: null, text: source };
    }
    const alias = String(match[2] || '').toLowerCase();
    const skill = AGENT_COMPOSER_SKILL_DEFS.find((candidate) => (
        [candidate.value, ...(candidate.aliases || [])]
            .some((value) => String(value).toLowerCase() === alias)
    )) || null;
    const leading = match[1] || '';
    const start = match.index + leading.length;
    const end = start + String(match[2] || '').length;
    const nextText = `${source.slice(0, start)}${source.slice(end)}`.replace(/[ \t]{2,}/g, ' ').trimStart();
    return { skill, text: nextText };
}

function parseAgentComposerSkillText(text) {
    let nextText = String(text || '');
    let selectedSkill = null;
    let changed = false;

    while (true) {
        const result = extractAgentComposerSkillText(nextText);
        if (!result.skill) break;
        selectedSkill = result.skill;
        nextText = result.text;
        changed = true;
    }

    return { skill: selectedSkill, text: nextText, changed };
}

function isAgentComposerSkillTokenMounted() {
    return dom.agentComposerInput instanceof HTMLElement
        && dom.agentComposerSkillTokens instanceof HTMLElement
        && dom.agentComposerInput.contains(dom.agentComposerSkillTokens);
}

function renderAgentComposerSkillControls() {
    const selectedSkill = getAgentComposerSkillDef();
    const hasSkill = Boolean(selectedSkill);
    const tokenHost = ensureAgentComposerSkillTokenHost();
    dom.agentComposerSkillToolbar?.querySelectorAll('[data-agent-skill-insert]').forEach((button) => {
        if (!(button instanceof HTMLButtonElement)) return;
        const skill = getAgentComposerSkillDef(button.dataset.agentSkillInsert);
        const isActive = Boolean(selectedSkill && skill?.id === selectedSkill.id);
        button.disabled = hasSkill;
        button.classList.toggle('is-active', isActive);
        button.setAttribute('aria-pressed', isActive ? 'true' : 'false');
        if (skill) {
            button.textContent = t(skill.labelKey);
        }
    });
    if (!tokenHost) return;
    tokenHost.hidden = !selectedSkill;
    tokenHost.innerHTML = selectedSkill ? `
        <span
            role="button"
            tabindex="0"
            class="agent-composer-skill-token"
            data-agent-skill-remove="${escapeHtml(selectedSkill.id)}"
            aria-label="${escapeHtml(t('agent.removeSkill', { name: selectedSkill.value }))}"
            title="${escapeHtml(t('agent.removeSkill', { name: selectedSkill.value }))}"
        >
            <span>${escapeHtml(selectedSkill.value)}</span>
            <span class="agent-composer-skill-token-remove" aria-hidden="true">×</span>
        </span>
    ` : '';
    syncAgentComposerInputEmptyState();
}

function setAgentComposerSkill(skillId) {
    const skill = getAgentComposerSkillDef(skillId);
    state.agentComposerSkillId = skill?.id || '';
    renderAgentComposerSkillControls();
}

function clearAgentComposerSkill() {
    setAgentComposerSkill('');
}

function syncAgentComposerSkillFromInput() {
    if (!dom.agentComposerInput) return;
    const previousSkillId = state.agentComposerSkillId;
    const tokenWasRemoved = Boolean(previousSkillId) && !isAgentComposerSkillTokenMounted();
    const result = parseAgentComposerSkillText(getAgentComposerInputText());

    if (result.skill) {
        state.agentComposerSkillId = result.skill.id;
    } else if (tokenWasRemoved) {
        state.agentComposerSkillId = '';
    }

    const stateChanged = previousSkillId !== state.agentComposerSkillId;
    if (!result.changed && !stateChanged) return;

    if (result.changed) {
        setAgentComposerInputText(result.text, { focus: true });
    }
    renderAgentComposerSkillControls();
}

function buildAgentComposerPromptText(rawPrompt) {
    const prompt = String(rawPrompt || '').trim();
    const skill = getAgentComposerSkillDef();
    if (!skill) return prompt;
    return `${skill.value} ${prompt}`;
}

function getAgentWorkflowForPrompt(prompt, fallbackWorkflowId = state.agentWorkflow) {
    const parsed = parseAgentComposerSkillText(String(prompt || ''));
    const workflowId = parsed.skill?.workflow || '';
    return AGENT_WORKFLOW_DEFS[workflowId] ? workflowId : fallbackWorkflowId;
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
    const location = findAgentWorkflowThreadItemLocation(messageId);
    if (!location) return null;
    const message = location.items[location.index];
    if (message?.kind === 'session') return null;
    updater(message);
    location.items[location.index] = message;
    location.thread.items = location.items;
    if (location.isCurrent) {
        state.agentMessages = location.items;
        renderAgentMessages({ autoScroll: 'preserve-or-pin-bottom' });
    }
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
                message.isLoading = false;
            });
        },
        fail(errorText) {
            updateAgentMessageById(messageId, (message) => {
                message.text = String(errorText ?? t('messages.agentExecutionFailed'));
                message.isLoading = false;
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
                const failedBlocks = getAgentAttemptStepBlocks(activeAttempt).map((block) => (
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
                    ...(Array.isArray(activeAttempt?.steps) ? { steps: failedBlocks } : {}),
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
    isLoading = false,
} = {}) {
    const message = createAgentMessage('assistant', text, workflow);
    message.blocks = Array.isArray(blocks) ? blocks : [];
    message.promptSuggestions = Array.isArray(promptSuggestions) ? promptSuggestions : null;
    message.isLoading = Boolean(isLoading);
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
            ? getAgentAttemptStepBlocks(getAgentSessionActiveAttempt(item))
            : (item.blocks || []);
        for (const block of blocks) {
            if (isReadyAgentViewer3DBlock(block)) {
                const host = dom.agentMessageList?.querySelector(`[data-agent-viewer-block-id="${block.id}"]`);
                if (host instanceof HTMLElement) {
                    viewerBlocks.push({ block, host });
                }
                continue;
            }
            if (block?.type === 'progress') {
                const images = Array.isArray(block.images) ? block.images : [];
                const selectedIndex = Math.max(0, Math.min(images.length - 1, Number(block.selectedIndex) || 0));
                const selectedImage = images[selectedIndex] || null;
                const viewerBlock = createAgentStepImageViewer3DBlock(block, selectedImage, selectedIndex);
                if (!viewerBlock) continue;
                const host = dom.agentMessageList?.querySelector(`[data-agent-viewer-block-id="${viewerBlock.id}"]`);
                if (host instanceof HTMLElement) {
                    viewerBlocks.push({ block: viewerBlock, host });
                }
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

function renderAgentStepGalleryMain({
    block,
    images = [],
    selectedImage,
    selectedIndex = 0,
    isApplied = false,
    isInterruptedAttempt = false,
} = {}) {
    const viewerBlock = createAgentStepImageViewer3DBlock(block, selectedImage, selectedIndex);
    const thumbnailSrc = getAgentStepImageThumbnailSrc(selectedImage);
    const isGalleryLocked = isAgentStepGalleryNavigationLocked(block, {
        status: isInterruptedAttempt ? 'interrupted' : '',
    });
    const nav = `
        ${images.length > 1 ? `<span class="agent-step-gallery-count">${selectedIndex + 1} / ${images.length}</span>` : ''}
        ${images.length > 1 ? `<button type="button" class="agent-step-gallery-nav is-prev" data-agent-step-gallery-nav="prev" data-agent-block-id="${block.id}" ${!isGalleryLocked && selectedIndex > 0 ? '' : 'disabled'} aria-label="Previous image">‹</button>` : ''}
        ${images.length > 1 ? `<button type="button" class="agent-step-gallery-nav is-next" data-agent-step-gallery-nav="next" data-agent-block-id="${block.id}" ${!isGalleryLocked && selectedIndex < images.length - 1 ? '' : 'disabled'} aria-label="Next image">›</button>` : ''}
    `;
    if (viewerBlock) {
        return `
            <div class="agent-step-gallery-image">
                <div class="agent-viewer-frame agent-step-viewer-frame is-ready">
                    <div class="agent-viewer-surface" data-agent-viewer-block-id="${escapeHtml(viewerBlock.id)}"></div>
                    ${nav}
                </div>
            </div>
        `;
    }
    return `
        <div class="agent-step-gallery-image">
            <div class="agent-image-frame is-ready"${renderAgentImageAspectStyle(selectedImage)}>
                <img src="${escapeHtml(thumbnailSrc)}" alt="${escapeHtml(selectedImage.alt || selectedImage.title || block.title || t('agent.blocks.image'))}" loading="eager" decoding="async">
                ${nav}
            </div>
        </div>
    `;
}

function renderAgentProgressBlock(block, context = {}) {
    const progress = Math.max(0, Math.min(1, Number(block.value) || 0));
    const percentText = block.indeterminate ? t('agent.promptProcessing') : `${Math.round(progress * 100)}%`;
    const images = Array.isArray(block.images) ? block.images : [];
    const artifacts = Array.isArray(block.artifacts) ? block.artifacts : [];
    const selectedIndex = Math.max(0, Math.min(images.length - 1, Number(block.selectedIndex) || 0));
    const selectedImage = images[selectedIndex] || null;
    const isApplied = Boolean(block.applied);
    const isStepBlock = Boolean(block.stepKey);
    const isInterruptedAttempt = context?.attempt?.status === 'interrupted';
    const statusId = normalizeAgentPipelineStatusId(block.statusId);
    const actions = isInterruptedAttempt && isStepBlock
        ? []
        : (Array.isArray(block.actions) ? block.actions : []);
    const isCanceledStep = isStepBlock && (statusId === 'canceled' || /^已取消|^Canceled/i.test(String(block.statusText || '')));
    const stepThumbnail = isStepBlock ? getAgentStepBlockThumbnail(block) : '';
    const showContinue = isStepBlock && shouldShowAgentPipelineContinue(context);
    const forceCollapsed = isStepBlock && Boolean(context.stepBlocksCollapsed);
    const isHiddenStepBlock = isStepBlock && context.hiddenStepBlockIds instanceof Set && context.hiddenStepBlockIds.has(block.id);
    const isOpen = !isStepBlock || (!forceCollapsed && Boolean(block.expanded || block.isCurrent || (!isApplied && (selectedImage || actions.length > 0 || showContinue))));
    const stepStateLabel = isStepBlock
        ? getAgentPipelineStatusLabel(statusId)
        : isApplied
            ? t('agent.pipelineSteps.applied')
            : isCanceledStep
                ? t('common.canceled')
                : isInterruptedAttempt
                    ? t('common.interrupted')
                    : '';
    const stepStateClass = getAgentPipelineStatusClass(statusId);
    const isCurrentStepStatus = isStepBlock
        && block.isCurrent
        && !isApplied
        && /^(当前步骤|Current step)$/i.test(String(block.statusText || '').trim());
    let statusText = block.statusText;
    if (
        isStepBlock
        && (
            isInterruptedAttempt
            || isCurrentStepStatus
            || (isApplied && /^已应用|^Applied/i.test(String(block.statusText || '')))
        )
    ) {
        statusText = '';
    }
    const showProgressTrack = !isStepBlock || (
        shouldShowAgentStepProgressTrack(statusId, block)
        && !isApplied
        && !isCanceledStep
        && !isInterruptedAttempt
    );
    const showInterruptedStepActions = isInterruptedAttempt && isStepBlock && block.isCurrent && !isApplied && context.sessionId;
    const content = `
            ${isStepBlock ? '' : `
            <div class="agent-block-header">
                <span class="agent-block-title">${escapeHtml(block.title || t('agent.blocks.progress'))}</span>
                <span class="agent-block-meta">${percentText}</span>
            </div>
            `}
            ${showProgressTrack ? `
            <div class="agent-progress-track ${block.indeterminate ? 'is-indeterminate' : ''}">
                <div class="agent-progress-fill" style="width:${Math.round(progress * 100)}%"></div>
            </div>
            ` : ''}
            ${statusText ? `<div class="agent-block-status">${escapeHtml(statusText)}</div>` : ''}
            ${selectedImage ? `
                <div class="agent-step-gallery ${isApplied ? 'is-applied' : ''}" data-agent-step-gallery="${block.id}">
                    <div class="agent-step-gallery-main">
                        ${renderAgentStepGalleryMain({ block, images, selectedImage, selectedIndex, isApplied, isInterruptedAttempt })}
                    </div>
                    ${renderAgentStepImageMetadata(selectedImage)}
                </div>
            ` : ''}
            ${renderAgentBlockArtifacts(artifacts)}
            ${actions.length > 0 ? `
                <div class="agent-step-actions">
                    ${actions.map((action) => `
                        <button type="button" class="agent-inline-btn agent-step-action-btn" data-agent-step-action="${escapeHtml(action)}" data-agent-block-id="${block.id}" ${isApplied ? 'disabled' : ''}>${escapeHtml(t(`agent.actions.${action}`))}</button>
                    `).join('')}
                </div>
            ` : ''}
            ${showInterruptedStepActions ? `
                <div class="agent-step-actions">
                    <button type="button" class="agent-inline-btn" data-agent-interrupted-step-action="cancel" data-agent-block-id="${block.id}">${escapeHtml(t('agent.actions.cancel'))}</button>
                    <button type="button" class="agent-inline-btn" data-agent-interrupted-step-action="retry" data-agent-block-id="${block.id}">${escapeHtml(t('agent.actions.retry'))}</button>
                </div>
            ` : ''}
            ${showContinue ? `
                <div class="agent-step-continue">
                    <button type="button" class="agent-inline-btn agent-step-continue-btn" data-agent-pipeline-continue="${escapeHtml(block.stepKey)}" data-agent-block-id="${block.id}">${escapeHtml(t('agent.pipelineSteps.continueAction'))}</button>
                </div>
            ` : ''}
    `;
    if (isStepBlock) {
        return `
            <details class="agent-block agent-block-progress agent-step-block ${isApplied ? 'is-applied' : ''} ${block.isCurrent ? 'is-current' : ''} ${isHiddenStepBlock ? 'is-deferred-hidden' : ''}" data-agent-block-id="${block.id}" data-agent-session-id="${escapeHtml(context.sessionId || '')}" data-agent-attempt-id="${escapeHtml(context.attemptId || '')}" data-agent-step-key="${escapeHtml(block.stepKey || '')}" ${isOpen ? 'open' : ''} ${isHiddenStepBlock ? 'hidden' : ''}>
                <summary class="agent-block-header agent-step-summary">
                    ${stepThumbnail ? `<span class="agent-step-summary-thumb"><img src="${escapeHtml(stepThumbnail)}" alt="" loading="eager" decoding="async"></span>` : ''}
                    <span class="agent-block-title">${escapeHtml(block.title || t('agent.blocks.progress'))}</span>
                    <span class="agent-step-summary-meta">
                        ${stepStateLabel ? `<span class="agent-step-state ${escapeHtml(stepStateClass)}">${escapeHtml(stepStateLabel)}</span>` : ''}
                        ${showProgressTrack ? `<span class="agent-block-meta">${percentText}</span>` : ''}
                    </span>
                </summary>
                <div class="agent-step-body">
                    ${content}
                </div>
            </details>
        `;
    }
    return `
        <section class="agent-block agent-block-progress" data-agent-block-id="${block.id}" data-agent-session-id="${escapeHtml(context.sessionId || '')}" data-agent-attempt-id="${escapeHtml(context.attemptId || '')}" data-agent-step-key="${escapeHtml(block.stepKey || '')}">
            ${content}
        </section>
    `;
}

function renderAgentBlockArtifacts(artifacts = []) {
    const items = (Array.isArray(artifacts) ? artifacts : [])
        .map((artifact) => {
            if (!artifact || typeof artifact !== 'object') return null;
            const text = String(artifact.text || artifact.content || '').trim();
            if (!text) return null;
            return {
                title: String(artifact.title || '').trim(),
                text,
            };
        })
        .filter(Boolean);
    if (items.length <= 0) return '';
    return `
        <div class="agent-step-artifacts">
            ${items.map((item) => `
                <div class="agent-step-artifact">
                    ${item.title ? `<div class="agent-step-artifact-title">${escapeHtml(item.title)}</div>` : ''}
                    <div class="agent-step-artifact-text">${escapeHtml(item.text)}</div>
                </div>
            `).join('')}
        </div>
    `;
}

function renderAgentStepImageMetadata(image) {
    const metadata = image?.metadata && typeof image.metadata === 'object' ? image.metadata : null;
    if (!metadata) return '';
    if (metadata.kind === 'components_3d') {
        const details = [
            metadata.label ? String(metadata.label) : '',
        ].filter(Boolean);
        return `
        <div class="agent-step-metadata">
            ${details.map((item) => `<span>${escapeHtml(item)}</span>`).join('')}
        </div>
    `;
    }
    if (metadata.kind === 'insert_scene') {
        const objectCount = Number(metadata.objectCount) || 0;
        return `
        <div class="agent-step-metadata">
            <span>${escapeHtml(t('agent.pipelineSteps.insertSceneAsset', { count: objectCount }))}</span>
            ${metadata.blendPath ? `<span>${escapeHtml(metadata.blendPath)}</span>` : ''}
        </div>
    `;
    }
    if (metadata.kind !== 'layout_bbox') return '';
    const bboxData = Array.isArray(metadata.bboxData) ? metadata.bboxData : [];
    const labels = bboxData
        .map((item) => String(item?.label || '').trim())
        .filter(Boolean)
        .slice(0, 4);
    const detectionCount = Number(metadata.detectionCount) || 9;
    return `
        <div class="agent-step-metadata">
            <span>${escapeHtml(t('agent.pipelineSteps.layoutDetections', { count: detectionCount }))}</span>
            ${labels.length > 0 ? `<span>${escapeHtml(labels.join(' / '))}</span>` : ''}
        </div>
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
            <div class="agent-image-frame ${ready ? 'is-ready' : ''}"${ready ? renderAgentImageAspectStyle(block) : ''}>
                ${ready
                    ? `<img src="${escapeHtml(block.src)}" alt="${escapeHtml(block.alt || block.title || t('agent.blocks.image'))}" loading="eager" decoding="async">`
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

function renderAgentBlocks(blocks, context = {}) {
    if (!Array.isArray(blocks) || blocks.length === 0) return '';
    const allStepBlocks = blocks.every((block) => block?.type === 'progress' && block.stepKey);
    if (allStepBlocks) {
        return renderAgentStepBlocks(blocks, context);
    }
    return `
        <div class="agent-message-blocks">
            ${blocks.map((block) => {
                if (block.type === 'progress') return renderAgentProgressBlock(block, context);
                if (block.type === 'image') return renderAgentImageBlock(block);
                if (block.type === 'viewer3d') return renderAgentViewer3DBlock(block);
                return '';
            }).join('')}
        </div>
    `;
}

function shouldShowAgentStepBlock(block) {
    return Boolean(
        block?.applied
        || block?.isCurrent
        || block?.expanded
        || (Array.isArray(block?.images) && block.images.length > 0)
        || (Array.isArray(block?.actions) && block.actions.length > 0)
    );
}

function renderAgentStepBlocks(blocks, context = {}) {
    if (context.stepBlocksCollapsed) {
        return `
            <div class="agent-message-blocks agent-step-list">
                ${blocks.map((block) => renderAgentProgressBlock(block, context)).join('')}
            </div>
        `;
    }
    const hiddenStepBlockIds = getDeferredAgentStepBlockIds(blocks);
    return `
        <div class="agent-message-blocks agent-step-list">
            ${blocks.map((block) => renderAgentProgressBlock(block, { ...context, hiddenStepBlockIds })).join('')}
        </div>
    `;
}

function getDeferredAgentStepBlockIds(blocks = []) {
    const stepBlocks = Array.isArray(blocks) ? blocks : [];
    let anchorIndex = -1;
    for (let index = stepBlocks.length - 1; index >= 0; index -= 1) {
        if (shouldShowAgentStepBlock(stepBlocks[index])) {
            anchorIndex = index;
            break;
        }
    }
    if (anchorIndex < 0) anchorIndex = 0;
    const nextIndex = Math.min(stepBlocks.length - 1, anchorIndex + 1);
    const visibleBlocks = stepBlocks.filter((block, index) => shouldShowAgentStepBlock(block) || index === nextIndex);
    return new Set(stepBlocks
        .filter((block, index) => !visibleBlocks.includes(block) && index > nextIndex)
        .map((block) => block.id));
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
    const isAssistant = message.role === 'assistant';
    const isLoading = isAssistant && message.isLoading;
    const messageText = String(message.text || '');
    return `
        <div class="agent-message ${message.role === 'user' ? 'is-user' : 'is-assistant'} ${isLoading ? 'is-loading' : ''}">
            <div class="agent-message-bubble">
                ${isAssistant ? `<span class="agent-message-role">${escapeHtml(t('common.agent'))}</span>` : ''}
                ${isLoading ? '<span class="agent-message-loading-spinner" aria-hidden="true"></span>' : ''}
                ${renderAgentAttachments(message.attachments)}
                ${messageText ? `<div class="agent-message-text">${escapeHtml(messageText)}</div>` : ''}
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
            <div class="agent-message is-assistant is-session is-session-collapsed" data-agent-session-id="${escapeHtml(session.id)}">
                ${renderAgentSessionArchiveTag(session)}
            </div>
        `;
    }

    const attempt = getAgentSessionActiveAttempt(session);
    const totalAttempts = session.attempts?.length || 0;
    const pipelineProgressLabel = getAgentPipelineProgressLabel(attempt);
    const hasPipelineStepToggle = Boolean(pipelineProgressLabel);
    const arePipelineStepsCollapsed = Boolean(attempt?.stepBlocksCollapsed);
    const archiveStateLabel = getAgentSessionStatusLabel(session, attempt);
    const isArchivedExpanded = session.archiveState !== 'active' && !session.collapsed;
    const attemptBlocks = getAgentAttemptStepBlocks(attempt);
    const isThinkingBeforeMcp = session.archiveState === 'active'
        && attempt?.status === 'running'
        && attemptBlocks.length <= 0;
    const actionAvailability = resolveAgentSessionActionAvailability({
        archiveState: session.archiveState,
        attemptStatus: attempt?.status || 'running',
    });

    return `
        <div class="agent-message is-assistant is-session" data-agent-session-id="${escapeHtml(session.id)}">
            <div class="agent-session-stack">
                <div class="agent-message-bubble agent-session-bubble">
                    <div class="agent-session-header">
                        <span class="agent-message-role">${escapeHtml(t('common.agent'))}</span>
                        <div class="agent-session-header-meta">
                            ${totalAttempts > 1 ? `<span class="agent-session-attempt-label">${escapeHtml(t('common.version', { current: session.activeAttemptIndex + 1, total: totalAttempts }))}</span>` : ''}
                            ${hasPipelineStepToggle ? `
                                <button
                                    type="button"
                                    class="agent-session-step-toggle ${arePipelineStepsCollapsed ? 'is-collapsed' : ''}"
                                    data-agent-session-step-toggle="${session.id}"
                                    data-agent-session-attempt-id="${attempt?.id || ''}"
                                    aria-pressed="${arePipelineStepsCollapsed ? 'true' : 'false'}"
                                    title="${escapeHtml(arePipelineStepsCollapsed ? t('agent.expandAllSteps') : t('agent.collapseAllSteps'))}"
                                    aria-label="${escapeHtml(arePipelineStepsCollapsed ? t('agent.expandAllSteps') : t('agent.collapseAllSteps'))}"
                                >${createAgentStepExpandToggleIcon()}</button>
                            ` : ''}
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
                    <div class="agent-message-text ${isThinkingBeforeMcp ? 'agent-thinking-text' : ''}">${escapeHtml(attempt?.text || '')}</div>
                    ${renderAgentBlocks(attemptBlocks, { sessionId: session.id, attemptId: attempt?.id || '', attempt, stepBlocksCollapsed: arePipelineStepsCollapsed })}
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

function invalidateAgentMessageScrollbarMetrics() {
    agentMessageScrollbarMeasureDirty = true;
}

function measureAgentMessageScrollbarMetrics() {
    if (!dom.agentMessageScroll || !dom.agentMessageScrollbar) {
        agentMessageScrollbarMetricsCache = null;
        agentMessageScrollbarMeasureDirty = true;
        return null;
    }
    const clientHeight = dom.agentMessageScroll.clientHeight;
    const scrollHeight = dom.agentMessageScroll.scrollHeight;
    const maxScrollTop = Math.max(0, scrollHeight - clientHeight);
    const trackHeight = dom.agentMessageScrollbar.clientHeight;
    if (trackHeight <= 0) {
        agentMessageScrollbarMetricsCache = {
            clientHeight,
            scrollHeight,
            maxScrollTop,
            trackHeight: 0,
            thumbHeight: 0,
            thumbTravel: 0,
        };
        agentMessageScrollbarMeasureDirty = false;
        return agentMessageScrollbarMetricsCache;
    }
    const thumbHeight = maxScrollTop <= 0
        ? trackHeight
        : Math.max(36, Math.min(trackHeight, (clientHeight / scrollHeight) * trackHeight));
    const thumbTravel = Math.max(0, trackHeight - thumbHeight);
    agentMessageScrollbarMetricsCache = {
        clientHeight,
        scrollHeight,
        maxScrollTop,
        trackHeight,
        thumbHeight,
        thumbTravel,
    };
    agentMessageScrollbarMeasureDirty = false;
    return agentMessageScrollbarMetricsCache;
}

function getAgentMessageScrollbarMetrics({ measure = false } = {}) {
    if (measure || agentMessageScrollbarMeasureDirty || !agentMessageScrollbarMetricsCache) {
        return measureAgentMessageScrollbarMetrics();
    }
    return agentMessageScrollbarMetricsCache;
}

function updateAgentMessageScrollbarThumb(metrics = agentMessageScrollbarMetricsCache) {
    if (!dom.agentMessageScroll || !dom.agentMessageScrollbar || !dom.agentMessageScrollbarThumb || !metrics) return;
    const shouldHide = metrics.maxScrollTop <= 0 || metrics.trackHeight <= 0 || state.agentWorkbenchCollapsed;
    const nextHeight = `${Math.max(0, metrics.thumbHeight)}px`;
    const thumbTop = metrics.maxScrollTop <= 0 || metrics.thumbTravel <= 0
        ? 0
        : (dom.agentMessageScroll.scrollTop / metrics.maxScrollTop) * metrics.thumbTravel;
    const nextTransform = `translate3d(0, ${Math.max(0, thumbTop)}px, 0)`;
    if (dom.agentMessageScrollbar.classList.contains('is-hidden') !== shouldHide) {
        dom.agentMessageScrollbar.classList.toggle('is-hidden', shouldHide);
    }
    if (dom.agentMessageScrollbarThumb.style.height !== nextHeight) {
        dom.agentMessageScrollbarThumb.style.height = nextHeight;
    }
    if (dom.agentMessageScrollbarThumb.style.transform !== nextTransform) {
        dom.agentMessageScrollbarThumb.style.transform = nextTransform;
    }
}

function syncAgentMessageScrollbar({ measure = true } = {}) {
    if (!dom.agentMessageScroll || !dom.agentMessageScrollbar || !dom.agentMessageScrollbarThumb) return;
    const metrics = getAgentMessageScrollbarMetrics({ measure });
    if (!metrics) return;
    updateAgentMessageScrollbarThumb(metrics);
}

function scheduleAgentMessageScrollbarSync({ measure = true } = {}) {
    agentMessageScrollbarScheduledMeasure = agentMessageScrollbarScheduledMeasure || Boolean(measure);
    if (measure) {
        invalidateAgentMessageScrollbarMetrics();
    }
    if (agentMessageScrollbarSyncRaf !== 0) return;
    agentMessageScrollbarSyncRaf = requestAnimationFrame(() => {
        agentMessageScrollbarSyncRaf = 0;
        const shouldMeasure = agentMessageScrollbarScheduledMeasure;
        agentMessageScrollbarScheduledMeasure = false;
        syncAgentMessageScrollbar({ measure: shouldMeasure });
    });
}

function initAgentMessageScrollbarObservers() {
    if (agentMessageScrollbarResizeObserver || typeof ResizeObserver === 'undefined') return;
    agentMessageScrollbarResizeObserver = new ResizeObserver(() => {
        scheduleAgentMessageScrollbarSync({ measure: true });
    });
    if (dom.agentMessageScroll) {
        agentMessageScrollbarResizeObserver.observe(dom.agentMessageScroll);
    }
    if (dom.agentMessageList) {
        agentMessageScrollbarResizeObserver.observe(dom.agentMessageList);
    }
}

function beginAgentMessageScrollbarDrag(event) {
    if (event.button !== 0 || !dom.agentMessageScroll) return;
    const metrics = getAgentMessageScrollbarMetrics({ measure: true });
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
    syncAgentMessageScrollbar({ measure: false });
    event.preventDefault();
}

function onAgentMessageScrollbarDragMove(event) {
    if (!agentMessageScrollbarDragState || !dom.agentMessageScroll) return;
    const { startY, startScrollTop, maxScrollTop, thumbTravel } = agentMessageScrollbarDragState;
    if (thumbTravel <= 0 || maxScrollTop <= 0) return;
    const deltaY = event.clientY - startY;
    const nextScrollTop = startScrollTop + (deltaY / thumbTravel) * maxScrollTop;
    dom.agentMessageScroll.scrollTop = Math.max(0, Math.min(maxScrollTop, nextScrollTop));
    syncAgentMessageScrollbar({ measure: false });
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
    syncAgentMessageScrollbar({ measure: true });
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

function retainAgentThumbnailImageCache(root = dom.agentMessageList) {
    if (!root || typeof Image === 'undefined') return;
    const activeSources = new Set();
    root.querySelectorAll('.agent-step-summary-thumb img, .agent-session-archive-thumb img').forEach((img) => {
        if (!(img instanceof HTMLImageElement)) return;
        const src = String(img.currentSrc || img.src || '').trim();
        if (!src) return;
        activeSources.add(src);
        if (agentThumbnailImageCache.has(src)) return;
        const cachedImage = new Image();
        cachedImage.decoding = 'async';
        cachedImage.loading = 'eager';
        cachedImage.src = src;
        agentThumbnailImageCache.set(src, cachedImage);
        cachedImage.decode?.().catch(() => {});
    });
    Array.from(agentThumbnailImageCache.keys()).forEach((src) => {
        if (!activeSources.has(src)) {
            agentThumbnailImageCache.delete(src);
        }
    });
}

function syncAgentImageFrameAspectRatios(root = dom.agentMessageList) {
    if (!root) return;
    root.querySelectorAll('.agent-image-frame.is-ready img').forEach((img) => {
        if (!(img instanceof HTMLImageElement)) return;
        const frame = img.closest('.agent-image-frame');
        if (!(frame instanceof HTMLElement)) return;
        const applyRatio = () => {
            const width = Number(img.naturalWidth || 0);
            const height = Number(img.naturalHeight || 0);
            if (width > 0 && height > 0) {
                frame.style.setProperty('--agent-image-aspect-ratio', (width / height).toFixed(4));
            }
        };
        if (img.complete) {
            applyRatio();
            return;
        }
        img.addEventListener('load', applyRatio, { once: true });
    });
}

function syncAgentStepSummaryTitleReserves(root = dom.agentMessageList) {
    if (!root) return;
    root.querySelectorAll('.agent-step-summary').forEach((summary) => {
        if (!(summary instanceof HTMLElement)) return;
        const styles = window.getComputedStyle(summary);
        const paddingLeft = Number.parseFloat(styles.paddingLeft) || 0;
        const paddingRight = Number.parseFloat(styles.paddingRight) || 0;
        const thumb = summary.querySelector('.agent-step-summary-thumb');
        const meta = summary.querySelector('.agent-step-summary-meta');
        const leftReserve = thumb instanceof HTMLElement
            ? Math.ceil((thumb.offsetLeft - summary.offsetLeft) + thumb.offsetWidth + 6)
            : Math.ceil(paddingLeft);
        const rightReserve = meta instanceof HTMLElement
            ? Math.ceil(summary.clientWidth - meta.offsetLeft + paddingRight)
            : Math.ceil(paddingRight);
        summary.style.setProperty('--agent-step-summary-left-reserve', `${leftReserve}px`);
        summary.style.setProperty('--agent-step-summary-right-reserve', `${rightReserve}px`);
    });
}

function getAgentSessionDomElement(sessionId) {
    if (!dom.agentMessageList || !sessionId) return null;
    return dom.agentMessageList.querySelector(`[data-agent-session-id="${escapeCssIdentifier(sessionId)}"]`);
}

function getAgentStepBlockDomSelector(sessionId, attemptId) {
    return `.agent-step-block[data-agent-session-id="${escapeCssIdentifier(sessionId)}"][data-agent-attempt-id="${escapeCssIdentifier(attemptId)}"]`;
}

function captureAgentMessageLayoutAnimation(options = null) {
    if (!options || !dom.agentMessageList || !dom.agentMessageScroll) return null;
    const sessionId = String(options.sessionId || '').trim();
    const attemptId = String(options.attemptId || '').trim();
    if (!sessionId || !attemptId) return null;
    const sessionElement = getAgentSessionDomElement(sessionId);
    const sessionRect = sessionElement?.getBoundingClientRect?.() || null;
    const blocks = new Map();
    dom.agentMessageList.querySelectorAll(getAgentStepBlockDomSelector(sessionId, attemptId)).forEach((element) => {
        if (!(element instanceof HTMLDetailsElement)) return;
        const blockId = String(element.dataset.agentBlockId || '').trim();
        if (!blockId) return;
        blocks.set(blockId, {
            height: element.offsetHeight,
            open: element.open,
        });
    });
    return {
        sessionId,
        attemptId,
        expand: Boolean(options.expand),
        sessionTop: sessionRect?.top ?? null,
        scrollTop: dom.agentMessageScroll.scrollTop,
        clientHeight: dom.agentMessageScroll.clientHeight,
        scrollHeight: dom.agentMessageScroll.scrollHeight,
        wasPinnedToBottom: shouldForceAgentMessageBottomAfterRender({
            mode: 'preserve-or-pin-bottom',
            prevScrollTop: dom.agentMessageScroll.scrollTop,
            prevClientHeight: dom.agentMessageScroll.clientHeight,
            prevScrollHeight: dom.agentMessageScroll.scrollHeight,
        }),
        blocks,
    };
}

function prepareAgentMessageLayoutAnimation(snapshot) {
    if (!snapshot || !dom.agentMessageList) return null;
    const prefersReducedMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches;
    if (prefersReducedMotion) return null;

    const items = [];
    dom.agentMessageList.querySelectorAll(getAgentStepBlockDomSelector(snapshot.sessionId, snapshot.attemptId)).forEach((element) => {
        if (!(element instanceof HTMLDetailsElement)) return;
        const blockId = String(element.dataset.agentBlockId || '').trim();
        const previous = snapshot.blocks.get(blockId);
        if (!previous) return;
        const endHeight = element.offsetHeight;
        const startHeight = Math.max(0, previous.height);
        if (Math.abs(endHeight - startHeight) < 1) return;
        element.classList.add('is-animating', snapshot.expand ? 'is-opening' : 'is-closing');
        element.style.height = `${startHeight}px`;
        items.push({
            element,
            endHeight,
        });
    });
    return items.length > 0 ? { ...snapshot, items } : null;
}

function restoreAgentMessageLayoutAnchor(snapshot) {
    if (!snapshot || !dom.agentMessageScroll || snapshot.sessionTop === null) return;
    if (snapshot.wasPinnedToBottom) {
        forceAgentMessageScrollToBottom();
        return;
    }
    const sessionElement = getAgentSessionDomElement(snapshot.sessionId);
    const nextTop = sessionElement?.getBoundingClientRect?.().top;
    if (!Number.isFinite(nextTop)) return;
    dom.agentMessageScroll.scrollTop += nextTop - snapshot.sessionTop;
}

function runAgentMessageLayoutAnimation(animation) {
    if (!animation || animation.items.length <= 0) return;
    if (agentMessageLayoutAnimationRaf !== 0) {
        cancelAnimationFrame(agentMessageLayoutAnimationRaf);
        agentMessageLayoutAnimationRaf = 0;
    }
    agentMessageLayoutAnimationRaf = requestAnimationFrame(() => {
        agentMessageLayoutAnimationRaf = 0;
        animation.items.forEach(({ element, endHeight }) => {
            if (animation.expand) {
                element.classList.remove('is-opening');
            }
            element.style.height = `${endHeight}px`;
        });
        scheduleAgentMessageScrollbarSync();
    });
    window.setTimeout(() => {
        animation.items.forEach(({ element }) => {
            element.classList.remove('is-animating', 'is-opening', 'is-closing');
            element.style.height = '';
        });
        if (animation.wasPinnedToBottom) {
            scheduleAgentMessageBottomPin(2);
        } else {
            restoreAgentMessageLayoutAnchor(animation);
        }
        syncAgentMessageScrollbar();
    }, AGENT_STEP_ANIMATION_MS + 40);
}

function syncAgentSessionStepToggleDom(sessionId, collapsed) {
    const sessionElement = getAgentSessionDomElement(sessionId);
    const toggle = sessionElement?.querySelector?.('[data-agent-session-step-toggle]');
    if (!(toggle instanceof HTMLElement)) return;
    toggle.classList.toggle('is-collapsed', Boolean(collapsed));
    toggle.setAttribute('aria-pressed', collapsed ? 'true' : 'false');
    const label = collapsed ? t('agent.expandAllSteps') : t('agent.collapseAllSteps');
    toggle.title = label;
    toggle.setAttribute('aria-label', label);
}

function getAgentSessionStatusLabel(session, attempt) {
    const pipelineProgressLabel = getAgentPipelineProgressLabel(attempt);
    if (session?.archiveState === 'canceled') return t('common.canceled');
    if (session?.archiveState === 'applied') return t('common.applied');
    if (attempt?.status === 'interrupted') return t('common.interrupted');
    if (attempt?.status === 'failed') return t('common.failed');
    return pipelineProgressLabel || (attempt?.status === 'complete'
        ? t('common.completed')
        : t('common.generating'));
}

function syncAgentSessionHeaderDom(sessionId) {
    const session = state.agentMessages.find((item) => item?.kind === 'session' && item.id === sessionId);
    const sessionElement = getAgentSessionDomElement(sessionId);
    if (!session || !(sessionElement instanceof HTMLElement)) return false;
    const attempt = getAgentSessionActiveAttempt(session);
    const status = sessionElement.querySelector('.agent-session-status');
    if (status) {
        status.textContent = getAgentSessionStatusLabel(session, attempt);
    }
    const actionAvailability = resolveAgentSessionActionAvailability({
        archiveState: session.archiveState,
        attemptStatus: attempt?.status || 'running',
    });
    const retryButton = sessionElement.querySelector('[data-agent-session-action="retry"]');
    if (retryButton instanceof HTMLButtonElement) {
        retryButton.disabled = !actionAvailability.canRetry;
    }
    const applyButton = sessionElement.querySelector('[data-agent-session-action="apply"]');
    if (applyButton instanceof HTMLButtonElement) {
        applyButton.disabled = !actionAvailability.canApply;
    }
    return true;
}

function syncAgentSessionStepBlocksDom(sessionId, attemptId, expanded) {
    if (!dom.agentMessageList || !sessionId || !attemptId) return false;
    const blocks = Array.from(dom.agentMessageList.querySelectorAll(getAgentStepBlockDomSelector(sessionId, attemptId)))
        .filter((element) => element instanceof HTMLDetailsElement);
    if (blocks.length <= 0) return false;

    const shouldExpand = Boolean(expanded);
    const snapshot = captureAgentMessageLayoutAnimation({ sessionId, attemptId, expand: shouldExpand });
    blocks.forEach((details) => {
        details.hidden = false;
        details.classList.remove('is-deferred-hidden');
        details.open = shouldExpand;
    });
    syncAgentSessionStepToggleDom(sessionId, !shouldExpand);
    const animation = prepareAgentMessageLayoutAnimation(snapshot);
    restoreAgentMessageLayoutAnchor(snapshot);
    syncAgentImageFrameAspectRatios(getAgentSessionDomElement(sessionId) || dom.agentMessageList);
    retainAgentThumbnailImageCache(dom.agentMessageList);
    syncAgentMessageScrollbar();
    runAgentMessageLayoutAnimation(animation);
    requestAnimationFrame(() => {
        syncAgentMessageScrollbar();
        void syncAgent3DBlocks();
    });
    return true;
}

function renderAgentSessionElement(sessionId, { autoScroll = 'preserve-or-pin-bottom', animateLayout = null } = {}) {
    if (!dom.agentMessageList) return false;
    const session = state.agentMessages.find((item) => item?.kind === 'session' && item.id === sessionId);
    const currentElement = getAgentSessionDomElement(sessionId);
    if (!session || !currentElement) {
        renderAgentMessages({ autoScroll, animateLayout });
        return false;
    }

    const prevScrollTop = dom.agentMessageScroll?.scrollTop ?? 0;
    const prevClientHeight = dom.agentMessageScroll?.clientHeight ?? 0;
    const prevScrollHeight = dom.agentMessageScroll?.scrollHeight ?? 0;
    const layoutSnapshot = captureAgentMessageLayoutAnimation(animateLayout);
    const shouldForceBottomAfterRender = shouldForceAgentMessageBottomAfterRender({
        mode: autoScroll,
        prevScrollTop,
        prevClientHeight,
        prevScrollHeight,
    });
    const template = document.createElement('template');
    template.innerHTML = renderAgentSessionItem(session).trim();
    const nextElement = template.content.firstElementChild;
    if (!(nextElement instanceof HTMLElement)) {
        renderAgentMessages({ autoScroll, animateLayout });
        return false;
    }
    currentElement.replaceWith(nextElement);
    const layoutAnimation = prepareAgentMessageLayoutAnimation(layoutSnapshot);
    restoreAgentMessageLayoutAnchor(layoutSnapshot);
    syncAgentImageFrameAspectRatios(nextElement);
    retainAgentThumbnailImageCache(dom.agentMessageList);
    syncAgentMessageScrollbar();
    runAgentMessageLayoutAnimation(layoutAnimation);
    requestAnimationFrame(() => {
        if (shouldForceBottomAfterRender) {
            scheduleAgentMessageBottomPin(4);
            bindAgentMessageAsyncBottomPin();
            return;
        }
        syncAgentMessageScrollbar();
    });
    void syncAgent3DBlocks();
    return true;
}

function renderAgentMessages({ autoScroll = 'preserve-or-pin-bottom', animateLayout = null } = {}) {
    if (!dom.agentMessageList) return;
    const prevScrollTop = dom.agentMessageScroll?.scrollTop ?? 0;
    const prevClientHeight = dom.agentMessageScroll?.clientHeight ?? 0;
    const prevScrollHeight = dom.agentMessageScroll?.scrollHeight ?? 0;
    const layoutSnapshot = captureAgentMessageLayoutAnimation(animateLayout);
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
    const layoutAnimation = prepareAgentMessageLayoutAnimation(layoutSnapshot);
    syncAgentImageFrameAspectRatios(dom.agentMessageList);
    syncAgentStepSummaryTitleReserves(dom.agentMessageList);
    retainAgentThumbnailImageCache(dom.agentMessageList);
    if (dom.agentMessageScroll) {
        dom.agentMessageScroll.scrollTop = resolveAgentMessageRefreshScrollTop({
            mode: autoScroll,
            prevScrollTop,
            prevClientHeight,
            prevScrollHeight,
            nextScrollHeight: dom.agentMessageScroll.scrollHeight,
        });
    }
    restoreAgentMessageLayoutAnchor(layoutSnapshot);
    syncAgentMessageScrollbar();
    runAgentMessageLayoutAnimation(layoutAnimation);
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

function syncAgentWorkbenchModeTabs() {
    [dom.agentWorkbenchModeTabs, dom.agentWorkbenchCollapsedModeTabs].forEach((tabGroup) => {
        tabGroup?.querySelectorAll('[data-mode]').forEach((button) => {
            const isActive = button.dataset.mode === state.agentWorkbenchMode;
            button.classList.toggle('active', isActive);
            button.setAttribute('aria-pressed', String(isActive));
        });
    });
    dom.agentWorkbenchPanels.forEach((panel) => {
        const isActive = panel instanceof HTMLElement && panel.dataset.modePanel === state.agentWorkbenchMode;
        panel.classList.toggle('hidden', !isActive);
    });
}

function syncAssetLibraryTabs() {
    dom.assetLibraryTabs?.querySelectorAll('[data-asset-tab]').forEach((button) => {
        const isActive = button.dataset.assetTab === state.agentAssetLibraryTab;
        button.classList.toggle('active', isActive);
        button.setAttribute('aria-pressed', String(isActive));
    });
    dom.assetLibraryPanels.forEach((panel) => {
        const isActive = panel instanceof HTMLElement && panel.dataset.assetPanel === state.agentAssetLibraryTab;
        panel.classList.toggle('hidden', !isActive);
    });
}

function syncAgentWorkflowTabs() {
    dom.agentWorkflowTabs?.querySelectorAll('[data-workflow]').forEach((button) => {
        const isActive = button.dataset.workflow === state.agentWorkflow;
        button.classList.toggle('active', isActive);
        button.setAttribute('aria-pressed', String(isActive));
    });
}

function refreshAgentWorkbench() {
    syncAgentWorkbenchModeTabs();
    syncAssetLibraryTabs();
    syncAgentWorkflowTabs();
    renderAgentComposerAttachments();
    renderAgentMessages();
}

function syncAgentWorkbenchCollapsedState() {
    const collapsed = Boolean(state.agentWorkbenchCollapsed);
    dom.agentWorkbenchShell?.classList.toggle('is-collapsed', collapsed);
    dom.agentWorkbench?.classList.toggle('is-collapsed', collapsed);
    if (dom.agentWorkbenchCollapsedControls) {
        dom.agentWorkbenchCollapsedControls.hidden = !collapsed;
    }
    if (dom.btnToggleAgentWorkbench) {
        dom.btnToggleAgentWorkbench.textContent = '‹';
        dom.btnToggleAgentWorkbench.setAttribute('aria-expanded', String(!collapsed));
        const label = collapsed ? t('agent.expandedTooltip') : t('agent.collapsedTooltip');
        dom.btnToggleAgentWorkbench.title = label;
        dom.btnToggleAgentWorkbench.setAttribute('aria-label', label);
    }
    syncAgentWorkbenchLayoutVars();
    scheduleAgentMessageScrollbarSync();
}

function scheduleAgentWorkbenchCollapseLayoutSync({ persist = true } = {}) {
    if (agentWorkbenchTogglingTimer !== 0) {
        clearTimeout(agentWorkbenchTogglingTimer);
    }
    document.body.classList.add('agent-workbench-toggling');

    if (agentWorkbenchCollapseSyncRaf !== 0) {
        return;
    }

    agentWorkbenchCollapseSyncRaf = requestAnimationFrame(() => {
        agentWorkbenchCollapseSyncRaf = requestAnimationFrame(() => {
            agentWorkbenchCollapseSyncRaf = 0;
            if (persist) {
                localStorage.setItem(AGENT_WORKBENCH_COLLAPSED_STORAGE_KEY, String(state.agentWorkbenchCollapsed));
            }
            syncCanvasContainerToViewport();
            scheduleAgentMessageScrollbarSync();

            agentWorkbenchTogglingTimer = setTimeout(() => {
                agentWorkbenchTogglingTimer = 0;
                document.body.classList.remove('agent-workbench-toggling');
            }, 120);
        });
    });
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
    scheduleAgentWorkbenchCollapseLayoutSync({ persist });
}

function setAgentWorkbenchMode(mode) {
    if (!['conversation', 'asset-library'].includes(mode)) return;
    state.agentWorkbenchMode = mode;
    syncAgentWorkbenchModeTabs();
    if (dom.agentWorkbench instanceof HTMLElement) {
        dom.agentWorkbench.dataset.mode = mode;
    }
    if (mode === 'conversation') {
        scheduleAgentMessageScrollbarSync();
    }
}

function setAgentAssetLibraryTab(tab) {
    if (!['scene', 'object', 'character', 'camera'].includes(tab)) return;
    state.agentAssetLibraryTab = tab;
    syncAssetLibraryTabs();
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

function resetAllAgentConversations() {
    Object.keys(AGENT_WORKFLOW_DEFS).forEach((workflowId) => {
        const thread = ensureAgentWorkflowThread(workflowId);
        thread.items = createDefaultAgentMessages(workflowId);
    });
    setCurrentAgentWorkflowThread(state.agentWorkflow);
    state.agentPendingImages = [];
    renderAgentComposerAttachments();
    renderAgentMessages({ autoScroll: 'always' });
}

function animateAgentStepBlockToggle(details, expand) {
    if (!(details instanceof HTMLDetailsElement)) return false;
    if (details.classList.contains('is-animating')) return true;
    const prefersReducedMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches;
    if (prefersReducedMotion) {
        details.open = Boolean(expand);
        return true;
    }

    const startHeight = details.offsetHeight;
    details.classList.add('is-animating', expand ? 'is-opening' : 'is-closing');
    if (expand) {
        details.open = true;
    }
    details.style.height = `${startHeight}px`;
    details.offsetHeight;
    if (expand) {
        requestAnimationFrame(() => {
            details.classList.remove('is-opening');
        });
    }
    const endHeight = expand ? details.scrollHeight : (details.querySelector('.agent-step-summary')?.offsetHeight || 34);
    details.style.height = `${endHeight}px`;

    const finish = () => {
        details.classList.remove('is-animating', 'is-opening', 'is-closing');
        details.style.height = '';
        details.open = Boolean(expand);
    };
    window.setTimeout(finish, 220);
    return true;
}

function handleAgentStepSummaryToggle(event, summary) {
    const details = summary?.closest?.('.agent-step-block');
    if (!(details instanceof HTMLDetailsElement)) return false;
    event.preventDefault();
    return animateAgentStepBlockToggle(details, !details.open);
}

function escapeCssIdentifier(value) {
    return typeof CSS !== 'undefined' && typeof CSS.escape === 'function'
        ? CSS.escape(value)
        : String(value).replace(/["\\]/g, '\\$&');
}

function handleAgentMessageListClick(event) {
    if (!(event.target instanceof Element)) return;
    const sessionStepToggle = event.target.closest('[data-agent-session-step-toggle]');
    if (sessionStepToggle instanceof HTMLElement) {
        const sessionId = String(sessionStepToggle.dataset.agentSessionStepToggle || '').trim();
        const attemptId = String(sessionStepToggle.dataset.agentSessionAttemptId || '').trim();
        const session = state.agentMessages.find((item) => item?.kind === 'session' && item.id === sessionId);
        const attempt = session?.attempts?.find((item) => item?.id === attemptId);
        if (!session || !attempt) return;
        const nextCollapsed = !Boolean(attempt.stepBlocksCollapsed);
        renderAgentSessionStepBlocksExpanded(sessionId, attemptId, !nextCollapsed);
        return;
    }
    const stepSummary = event.target.closest('.agent-step-summary');
    if (stepSummary instanceof HTMLElement && handleAgentStepSummaryToggle(event, stepSummary)) {
        return;
    }
    const pipelineContinueButton = event.target.closest('[data-agent-pipeline-continue]');
    if (pipelineContinueButton instanceof HTMLElement) {
        const context = getAgentStepBlockContextFromElement(pipelineContinueButton);
        if (!context || context.attempt?.status === 'interrupted' || !shouldShowAgentPipelineContinue(context)) return;
        handleAgentStepAction(context, 'retry').catch((error) => {
            console.warn('[Agent Step] continue failed', error);
            showError(t('messages.agentOperationFailed', { message: error?.message || String(error) }));
        });
        return;
    }
    const stepGalleryNav = event.target.closest('[data-agent-step-gallery-nav]');
    if (stepGalleryNav instanceof HTMLElement) {
        const context = getAgentStepBlockContextFromElement(stepGalleryNav);
        if (!context || isAgentStepGalleryNavigationLocked(context.block, context.attempt)) return;
        const images = Array.isArray(context.block.images) ? context.block.images : [];
        if (images.length <= 1) return;
        const direction = stepGalleryNav.dataset.agentStepGalleryNav;
        const currentIndex = Math.max(0, Math.min(images.length - 1, Number(context.block.selectedIndex) || 0));
        const selectedIndex = direction === 'prev'
            ? Math.max(0, currentIndex - 1)
            : Math.min(images.length - 1, currentIndex + 1);
        updateAgentStepSelectedIndex(context, selectedIndex);
        return;
    }
    const stepActionButton = event.target.closest('[data-agent-step-action]');
    if (stepActionButton instanceof HTMLElement) {
        const context = getAgentStepBlockContextFromElement(stepActionButton);
        const action = String(stepActionButton.dataset.agentStepAction || '').trim();
        if (!context || context.attempt?.status === 'interrupted' || !action) return;
        handleAgentStepAction(context, action).catch((error) => {
            console.warn('[Agent Step] action failed', error);
            showError(t('messages.agentOperationFailed', { message: error?.message || String(error) }));
        });
        return;
    }
    const interruptedStepActionButton = event.target.closest('[data-agent-interrupted-step-action]');
    if (interruptedStepActionButton instanceof HTMLElement) {
        const context = getAgentStepBlockContextFromElement(interruptedStepActionButton);
        const action = String(interruptedStepActionButton.dataset.agentInterruptedStepAction || '').trim();
        if (!context || !action) return;
        handleInterruptedAgentStepAction(context, action).catch((error) => {
            console.warn('[Agent Step] interrupted action failed', error);
            showError(t('messages.agentOperationFailed', { message: error?.message || String(error) }));
        });
        return;
    }
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
    fillAgentComposerFromSuggestion(prompt);
}

function handleAgentWorkflowClick(event) {
    if (!(event.target instanceof Element)) return;
    const button = event.target.closest('[data-workflow]');
    if (!(button instanceof HTMLElement)) return;
    const workflowId = button.dataset.workflow;
    if (!workflowId) return;
    setAgentWorkflow(workflowId);
}

window.addEventListener('pagehide', interruptAgentTasksForPageExit);
window.addEventListener('beforeunload', interruptAgentTasksForPageExit);

function handleAgentWorkbenchModeClick(event) {
    if (!(event.target instanceof Element)) return;
    const button = event.target.closest('[data-mode]');
    if (!(button instanceof HTMLElement)) return;
    const mode = button.dataset.mode;
    if (!mode) return;
    if (state.agentWorkbenchCollapsed) {
        setAgentWorkbenchCollapsed(false);
    }
    setAgentWorkbenchMode(mode);
}

async function handleProjectSessionButtonClick(event) {
    event.preventDefault();
    event.stopPropagation();
    await openProjectSessionPopover();
}

function handleAssetLibraryTabClick(event) {
    if (!(event.target instanceof Element)) return;
    const button = event.target.closest('[data-asset-tab]');
    if (!(button instanceof HTMLElement)) return;
    const tab = button.dataset.assetTab;
    if (!tab) return;
    setAgentAssetLibraryTab(tab);
}

function handleAgentComposerKeydown(event) {
    if (
        event.key === 'Backspace'
        && state.agentComposerSkillId
        && dom.agentComposerInput
        && getAgentComposerInputText().length === 0
    ) {
        event.preventDefault();
        clearAgentComposerSkill();
        return;
    }
    if (event.key !== 'Enter' || event.shiftKey) return;
    event.preventDefault();
    dom.agentComposer?.requestSubmit();
}

function handleAgentComposerInput() {
    syncAgentComposerSkillFromInput();
    syncAgentComposerInputEmptyState();
}

function fillAgentComposerFromSuggestion(prompt) {
    setAgentComposerInputText(prompt, { focus: true });
    syncAgentComposerSkillFromInput();
    syncAgentComposerInputEmptyState();
}

function handleAgentComposerSkillToolbarClick(event) {
    if (!(event.target instanceof Element)) return;
    const button = event.target.closest('[data-agent-skill-insert]');
    if (!(button instanceof HTMLButtonElement)) return;
    if (state.agentComposerSkillId) return;
    setAgentComposerSkill(button.dataset.agentSkillInsert || '');
    placeAgentComposerCaretAtEnd();
}

function handleAgentComposerSkillTokenClick(event) {
    if (!(event.target instanceof Element)) return;
    const button = event.target.closest('[data-agent-skill-remove]');
    if (!(button instanceof HTMLElement)) return;
    clearAgentComposerSkill();
    placeAgentComposerCaretAtEnd();
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

function canUseServerCodexAgent() {
    return getAgentRuntimeStatus().ready;
}

function getCodexAgentConversationId() {
    if (state.agentCodexConversationId) {
        return state.agentCodexConversationId;
    }
    const projectId = state.projectSession?.activeProjectId || 'local';
    state.agentCodexConversationId = `project:${projectId}`;
    return state.agentCodexConversationId;
}

function resetAgentCodexSessionBinding() {
    state.agentCodexConversationId = '';
    state.agentCodexThreadId = '';
}

function hasCodexTaskSignal(result) {
    return Boolean(result?.task?.started);
}

function isAgentDebugEnabled(workflowId = '') {
    if (workflowId === 'camera-direct') return true;
    try {
        return localStorage.getItem('VISIONARY_AGENT_DEBUG') === '1';
    } catch {
        return false;
    }
}

function agentDebugNow() {
    return typeof performance !== 'undefined' && typeof performance.now === 'function'
        ? performance.now()
        : Date.now();
}

function logAgentDebug(workflowId, message, details = {}) {
    if (!isAgentDebugEnabled(workflowId) || typeof console === 'undefined') return;
    const logger = typeof console.debug === 'function' ? console.debug : console.log;
    logger.call(console, `[Visionary Agent][${workflowId || 'workflow'}] ${message}`, details);
}

function summarizeCodexTaskEvents(result) {
    const events = Array.isArray(result?.task?.events) ? result.task.events : [];
    return events.map((event, index) => {
        const payload = event?.payload && typeof event.payload === 'object' ? event.payload : {};
        const nestedPayload = payload.payload && typeof payload.payload === 'object' ? payload.payload : payload;
        return {
            index,
            type: event?.type || '',
            title: nestedPayload.title || '',
            message: nestedPayload.message || nestedPayload.statusText || nestedPayload.status || '',
            progress: nestedPayload.progress ?? nestedPayload.value ?? nestedPayload.percent ?? '',
        };
    });
}

function startAgentEndpointDebug({
    workflowId,
    endpoint,
    prompt,
    sessionId = '',
    attemptId = '',
} = {}) {
    const startedAt = agentDebugNow();
    logAgentDebug(workflowId, `request started: ${endpoint}`, {
        endpoint,
        sessionId,
        attemptId,
        promptLength: String(prompt || '').length,
    });
    const timer = window.setInterval(() => {
        const elapsedMs = Math.round(agentDebugNow() - startedAt);
        logAgentDebug(workflowId, `waiting for ${endpoint}`, {
            elapsedMs,
            elapsedSec: Math.round(elapsedMs / 1000),
            likelyState: 'waiting for stream activity or final response; task events update the UI as soon as Codex emits progress',
        });
    }, 5000);
    return {
        finish(result, error = null) {
            window.clearInterval(timer);
            const elapsedMs = Math.round(agentDebugNow() - startedAt);
            if (error) {
                logAgentDebug(workflowId, `request failed: ${endpoint}`, {
                    elapsedMs,
                    message: error?.message || String(error),
                });
                return;
            }
            logAgentDebug(workflowId, `request completed: ${endpoint}`, {
                elapsedMs,
                threadId: result?.threadId || '',
                finalTextLength: String(result?.finalText || '').length,
                task: result?.task || null,
                taskEvents: summarizeCodexTaskEvents(result),
            });
        },
    };
}

function replaceAgentSessionAttempt(session, attemptId, nextAttempt) {
    if (!session || session.kind !== 'session' || !attemptId || !nextAttempt) return session;
    return {
        ...session,
        attempts: (session.attempts || []).map((attempt) => (
            attempt.id === attemptId ? { ...nextAttempt, id: attemptId } : attempt
        )),
        updatedAt: new Date().toISOString(),
    };
}

function replaceAgentMessageWithSession(messageId, session) {
    const location = findAgentWorkflowThreadItemLocation(messageId);
    if (!location || !session) return null;
    location.items[location.index] = session;
    location.thread.items = location.items;
    if (location.isCurrent) {
        state.agentMessages = location.items;
        renderAgentMessages({ autoScroll: 'preserve-or-pin-bottom' });
    }
    schedulePersistAgentConversations();
    return session;
}

function shouldUseScenePipelineState(workflowId) {
    return workflowId === 'scene-build';
}

function shouldCreatePendingCodexTaskSession(workflowId) {
    return shouldUseScenePipelineState(workflowId) || workflowId === 'camera-direct';
}

function normalizeAgentCameraTimelineKeyframes(keyframes = []) {
    return (Array.isArray(keyframes) ? keyframes : [])
        .map((item) => {
            const frame = Math.round(Number(item?.frame));
            const time = Number.isFinite(Number(item?.time))
                ? Number(item.time)
                : frameToTime(Number.isFinite(frame) ? frame : 0);
            const camera = item?.camera && typeof item.camera === 'object' ? item.camera : {};
            const position = camera.position && typeof camera.position === 'object' ? camera.position : {};
            const rotation = camera.rotation && typeof camera.rotation === 'object' ? camera.rotation : {};
            if (!Number.isFinite(frame)) return null;
            return {
                frame,
                time,
                camera: {
                    position: {
                        x: Number(position.x) || 0,
                        y: Number(position.y) || 0,
                        z: Number(position.z) || 0,
                    },
                    rotation: {
                        x: Number(rotation.x) || 0,
                        y: Number(rotation.y) || 0,
                        z: Number(rotation.z) || 0,
                        w: Number(rotation.w) || 1,
                    },
                },
            };
        })
        .filter(Boolean)
        .sort((a, b) => a.frame - b.frame);
}

function normalizeAgentCameraTimelineFovKeyframes(keyframes = []) {
    return (Array.isArray(keyframes) ? keyframes : [])
        .map((item) => {
            const frame = Math.round(Number(item?.frame));
            if (!Number.isFinite(frame)) return null;
            const fovDegrees = clampSceneFov(item?.fovDegrees);
            if (fovDegrees === null) return null;
            return {
                frame,
                time: Number.isFinite(Number(item?.time)) ? Number(item.time) : frameToTime(frame),
                fovDegrees,
            };
        })
        .filter(Boolean)
        .sort((a, b) => a.frame - b.frame);
}

function getAgentCameraTrajectoryTimeline(source) {
    const trajectory = source?.trajectory && typeof source.trajectory === 'object' ? source.trajectory : null;
    const data = trajectory?.data && typeof trajectory.data === 'object' ? trajectory.data : trajectory;
    const timeline = data?.timeline && typeof data.timeline === 'object' ? data.timeline : null;
    return timeline && Array.isArray(timeline.keyframes) ? timeline : null;
}

function snapshotCameraTrajectoryTimeline() {
    return {
        keyframes: state.keyframes.map((keyframe) => ({
            frame: keyframe.frame,
            time: keyframe.time,
            camera: {
                position: { ...keyframe.camera.position },
                rotation: { ...keyframe.camera.rotation },
            },
        })),
        fovKeyframes: state.cameraFovKeyframes.map((keyframe) => ({ ...keyframe })),
        fps: state.timelineFps,
        durationSec: state.timelineDurationSec,
        isLooping: state.isLooping,
        selectedFrame: state.selectedCameraSequenceFrame,
        cameraSequenceVisible: state.cameraSequenceVisible,
    };
}

function restoreCameraTrajectoryTimeline(snapshot) {
    if (!snapshot || typeof snapshot !== 'object') return false;
    state.keyframes = Array.isArray(snapshot.keyframes) ? snapshot.keyframes.map((keyframe) => ({
        frame: keyframe.frame,
        time: keyframe.time,
        camera: {
            position: { ...keyframe.camera.position },
            rotation: { ...keyframe.camera.rotation },
        },
    })) : [];
    state.cameraFovKeyframes = Array.isArray(snapshot.fovKeyframes) ? snapshot.fovKeyframes.map((keyframe) => ({ ...keyframe })) : [];
    state.timelineFps = Math.max(1, Number(snapshot.fps || state.timelineFps || 24));
    if (dom.timelineFps) dom.timelineFps.value = String(state.timelineFps);
    state.timelineDurationSec = Math.max(TIMELINE_MIN_DURATION_SEC, Number(snapshot.durationSec || state.timelineDurationSec || TIMELINE_MIN_DURATION_SEC));
    state.isLooping = Boolean(snapshot.isLooping);
    dom.btnLoopCamera?.classList.toggle('active', state.isLooping);
    state.selectedCameraSequenceFrame = Number.isFinite(Number(snapshot.selectedFrame)) ? Number(snapshot.selectedFrame) : null;
    setCameraSequenceVisibility(Boolean(snapshot.cameraSequenceVisible), true);
    setTimelineFrame(state.selectedCameraSequenceFrame ?? state.keyframes[0]?.frame ?? 0, {
        applyPose: true,
        syncSlider: true,
        syncGizmo: true,
    });
    syncCameraSequenceVisualization();
    updateTimelineUI();
    markWorkspaceDirty('agent-camera-trajectory-restore');
    return true;
}

function applyAgentCameraTrajectoryTimeline(source) {
    const timeline = getAgentCameraTrajectoryTimeline(source);
    if (!timeline) return false;
    const nextKeyframes = normalizeAgentCameraTimelineKeyframes(timeline.keyframes);
    if (nextKeyframes.length === 0) return false;
    if (!agentCameraTrajectoryPreview) {
        agentCameraTrajectoryPreview = {
            backup: snapshotCameraTrajectoryTimeline(),
            source,
            createdAt: new Date().toISOString(),
        };
    } else {
        agentCameraTrajectoryPreview = {
            ...agentCameraTrajectoryPreview,
            source,
            updatedAt: new Date().toISOString(),
        };
    }
    state.keyframes = nextKeyframes;
    state.cameraFovKeyframes = normalizeAgentCameraTimelineFovKeyframes(timeline.fovKeyframes);
    if (Number.isFinite(Number(timeline.fps))) {
        state.timelineFps = Math.max(1, Number(timeline.fps));
        if (dom.timelineFps) dom.timelineFps.value = String(state.timelineFps);
    }
    if (Number.isFinite(Number(timeline.durationSec))) {
        state.timelineDurationSec = Math.max(TIMELINE_MIN_DURATION_SEC, Number(timeline.durationSec));
    }
    if (typeof timeline.isLooping === 'boolean') {
        state.isLooping = timeline.isLooping;
        dom.btnLoopCamera?.classList.toggle('active', state.isLooping);
    }
    state.selectedCameraSequenceFrame = nextKeyframes[0]?.frame ?? 0;
    setCameraSequenceVisibility(true, true);
    setTimelineFrame(Number(timeline.selectedFrame) || state.selectedCameraSequenceFrame || 0, {
        applyPose: true,
        syncSlider: true,
        syncGizmo: true,
    });
    syncCameraSequenceVisualization();
    updateTimelineUI();
    markWorkspaceDirty('agent-camera-trajectory');
    return true;
}

function commitAgentCameraTrajectoryPreview() {
    agentCameraTrajectoryPreview = null;
}

function restoreAgentCameraTrajectoryPreview() {
    const backup = agentCameraTrajectoryPreview?.backup;
    agentCameraTrajectoryPreview = null;
    return restoreCameraTrajectoryTimeline(backup);
}

function resetAgentCameraTrajectoryPreviewForRetry() {
    const preview = agentCameraTrajectoryPreview;
    if (!preview?.backup) return false;
    const restored = restoreCameraTrajectoryTimeline(preview.backup);
    agentCameraTrajectoryPreview = {
        ...preview,
        source: null,
        retryingAt: new Date().toISOString(),
    };
    return restored;
}

function getCameraTrajectoryReviewText(result = {}) {
    const finalText = String(result?.finalText || '').trim();
    if (finalText) return finalText;
    return '已把生成的相机轨迹放到时间轴预览，点击“应用”将确认保留当前预览轨迹并清理备份，点击“重试”将重新生成，点击“取消”将放弃并恢复旧轨迹。';
}

function getCameraPipelineStageStatusesForStage(stage, statusId, options = {}) {
    const normalizedStage = normalizeCameraPipelineStage(stage);
    const normalizedStatus = normalizeAgentPipelineStatusId(statusId) || 'running';
    const currentIndex = CAMERA_PIPELINE_STAGE_PLAN.indexOf(normalizedStage);
    return CAMERA_PIPELINE_STAGE_PLAN.map((item, index) => {
        if (index < currentIndex) return { stage: item, statusId: 'done' };
        if (index === currentIndex) return { stage: item, statusId: normalizedStatus };
        if (options.skipEvalRender && item === 'camera_trajectory_eval_render') {
            return { stage: item, statusId: 'skipped' };
        }
        if (options.evalRenderStatusId && item === 'camera_trajectory_eval_render') {
            return { stage: item, statusId: options.evalRenderStatusId };
        }
        return { stage: item, statusId: 'pending' };
    });
}

function applyCameraPipelineImplicitHandoffStatuses(task = {}, statuses = {}) {
    const currentStage = normalizeCameraPipelineStage(task?.stage || '');
    const currentStatusId = normalizeAgentPipelineStatusId(task?.statusId || '');
    if (
        currentStage === 'camera_scene_info_export'
        && (currentStatusId === 'done' || statuses.camera_scene_info_export === 'done')
        && statuses.camera_scene_info_export === 'done'
        && statuses.camera_initial_view_prepare === 'pending'
    ) {
        return {
            ...statuses,
            camera_initial_view_prepare: 'running',
        };
    }
    return statuses;
}

function cancelAgentCameraRenderJob() {
    if (!agentCameraRenderJob) return;
    agentCameraRenderJob = {
        ...agentCameraRenderJob,
        status: 'canceled',
        canceledAt: new Date().toISOString(),
    };
}

function isAgentCameraRenderJobActive(job) {
    return Boolean(job?.jobId && agentCameraRenderJob?.jobId === job.jobId && agentCameraRenderJob.status === 'running');
}

function getCameraTrajectoryPreparedPath(result = {}) {
    const prepared = result?.prepared && typeof result.prepared === 'object' ? result.prepared : null;
    return String(result?.preparedPath || prepared?.relativePath || '').trim();
}

function normalizeCameraRenderRequests(requests = []) {
    return (Array.isArray(requests) ? requests : [])
        .map((request, index) => {
            const outputPath = String(request?.outputPath || request?.relativePath || '').trim();
            const resolution = request?.resolution && typeof request.resolution === 'object' ? request.resolution : {};
            const camera = request?.camera && typeof request.camera === 'object' ? request.camera : {};
            const width = Math.max(1, Math.round(Number(resolution.width) || 1920));
            const height = Math.max(1, Math.round(Number(resolution.height) || 1080));
            if (!outputPath || Object.keys(camera).length <= 0) return null;
            return {
                ...request,
                id: String(request?.id || request?.name || `camera_render_${index + 1}`).trim(),
                title: String(request?.title || request?.name || `Camera render ${index + 1}`).trim(),
                outputPath,
                resolution: { width, height },
                camera,
            };
        })
        .filter(Boolean);
}

async function ensureCameraRenderFrameApiLoaded() {
    return import('../src/exportMedia/renderFrame.js');
}

function getCameraRenderFrameContext() {
    const renderer = app?.getMeshRenderer?.();
    const scene = app?.getMeshScene?.();
    const fusedRenderer = app?.getFusedRenderer?.();
    if (!renderer || !scene) {
        throw new Error(t('messages.renderContextUnavailableImage'));
    }
    return {
        renderer,
        scene,
        gaussianModels: fusedRenderer?.getGaussianModels?.() || [],
    };
}

function createCameraRenderAssetFromRequest(request, index, blob) {
    const relativePath = String(request.outputPath || '').trim();
    return {
        id: request.id || `camera_render_${index + 1}`,
        title: request.title || request.id || `Camera render ${index + 1}`,
        relativePath,
        assetPath: relativePath,
        mimeType: blob?.type || 'image/png',
        bytes: Number(blob?.size || 0),
        metadata: {
            kind: 'camera_render',
            requestName: request.name || request.id || '',
            width: request.resolution.width,
            height: request.resolution.height,
        },
        src: projectApi.getAssetUrl(state.projectSession.user, state.projectSession.activeProjectId, relativePath),
        alt: request.title || request.name || '',
    };
}

function updateCameraRenderJobProgress(job, {
    stage,
    statusId = 'rendering',
    message = '',
    progress = 0,
    images = [],
    artifacts = [],
    pipelineStageOptions = {},
} = {}) {
    if (!isAgentCameraRenderJobActive(job)) return;
    const normalizedStage = normalizeCameraPipelineStage(stage || job.stage);
    const payload = {
        started: true,
        title: t(getCameraPipelineStepDefinitionForStage(normalizedStage).titleKey),
        statusText: message,
        progress,
        stage: normalizedStage,
        statusId,
        pipelineStageStatuses: getCameraPipelineStageStatusesForStage(normalizedStage, statusId, pipelineStageOptions),
        ...(normalizedStage === 'camera_initial_view_prepare'
            ? { initialViewImages: images }
            : {
                images,
                ...(Array.isArray(job?.initialViewImages) && job.initialViewImages.length > 0
                    ? { initialViewImages: job.initialViewImages }
                    : {}),
            }),
        artifacts,
    };
    updateCodexTaskSessionProgress({
        sessionId: job.sessionId,
        attemptId: job.attemptId,
        workflowId: 'camera-direct',
        task: payload,
    });
}

async function renderAgentCameraRequests(job, requests, stage) {
    const normalizedRequests = normalizeCameraRenderRequests(requests);
    const images = [];
    if (normalizedRequests.length <= 0) {
        throw new Error('Camera render stage did not include any render requests');
    }
    const { renderVisionaryFrame } = await ensureCameraRenderFrameApiLoaded();
    const context = getCameraRenderFrameContext();
    for (const [index, request] of normalizedRequests.entries()) {
        if (!isAgentCameraRenderJobActive(job)) {
            throw new Error('Camera render job was canceled');
        }
        updateCameraRenderJobProgress(job, {
            stage,
            statusId: 'rendering',
            message: `${t(getCameraPipelineStepDefinitionForStage(stage).titleKey)} ${index + 1}/${normalizedRequests.length}`,
            progress: Math.max(0.01, index / normalizedRequests.length),
            images,
        });
        const frame = await renderVisionaryFrame(context, {
            id: request.id,
            resolution: request.resolution,
            camera: request.camera,
            mode: 'color',
            outputs: ['blob'],
            mimeType: 'image/png',
        });
        if (!frame.blob) {
            throw new Error('Camera render did not return an image blob');
        }
        await projectApi.writeAsset({
            user: state.projectSession.user,
            projectId: state.projectSession.activeProjectId,
            relativePath: request.outputPath,
            content: frame.blob,
        });
        images.push(createCameraRenderAssetFromRequest(request, index, frame.blob));
        updateCameraRenderJobProgress(job, {
            stage,
            statusId: 'rendering',
            message: `${t(getCameraPipelineStepDefinitionForStage(stage).titleKey)} ${index + 1}/${normalizedRequests.length}`,
            progress: Math.min(0.99, (index + 1) / normalizedRequests.length),
            images,
        });
    }
    return images;
}

function normalizeCameraTaskResult(result = {}, finalText = '') {
    return {
        conversationId: state.agentCodexConversationId,
        threadId: state.agentCodexThreadId,
        finalText,
        task: buildCameraTrajectoryTaskFromResult(result),
        events: [],
        images: [],
    };
}

function startAgentCameraRenderJob({ sessionId, attemptId }) {
    cancelAgentCameraRenderJob();
    agentCameraRenderJob = {
        jobId: `camera-render-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        sessionId,
        attemptId,
        stage: 'camera_initial_view_prepare',
        status: 'running',
        createdAt: new Date().toISOString(),
        initialViewImages: [],
    };
    return agentCameraRenderJob;
}

function hasCameraTrajectoryHostRenderRequest(result = {}) {
    return Boolean(
        result?.needsRender === true
        || Array.isArray(result?.renderRequests)
        || (result?.stage === 'camera_initial_view_prepare' && getCameraTrajectoryPreparedPath(result))
    );
}

async function continueAgentCameraTrajectoryAfterHostRender(job, result, finalText) {
    const preparedPath = getCameraTrajectoryPreparedPath(result);
    if (!preparedPath) {
        throw new Error('Camera trajectory prepare result did not include preparedPath');
    }
    updateCameraRenderJobProgress(job, {
        stage: 'camera_initial_view_prepare',
        statusId: 'rendering',
        message: t('agent.pipelineSteps.cameraInitialViews'),
        progress: 0.01,
    });
    const initialImages = await renderAgentCameraRequests(job, result?.renderRequests || [], 'camera_initial_view_prepare');
    job.initialViewImages = initialImages;
    updateCameraRenderJobProgress(job, {
        stage: 'camera_initial_view_prepare',
        statusId: 'done',
        message: t('agent.blocks.progressDone'),
        progress: 1,
        images: initialImages,
    });
    job.stage = 'camera_director_analysis';
    updateCameraRenderJobProgress(job, {
        stage: 'camera_director_analysis',
        statusId: 'running',
        message: t('agent.pipelineSteps.cameraDirector'),
        progress: 0.01,
    });

    let generated = await projectApi.continueCameraTrajectory({
        user: state.projectSession.user,
        projectId: state.projectSession.activeProjectId,
        preparedPath,
    });
    if (!isAgentCameraRenderJobActive(job)) return null;

    if (generated?.needsEvalRender === true) {
        job.stage = 'camera_trajectory_eval_render';
        const evalImages = await renderAgentCameraRequests(job, generated.evalRenderRequests || [], 'camera_trajectory_eval_render');
        updateCameraRenderJobProgress(job, {
            stage: 'camera_trajectory_eval_render',
            statusId: 'rendering',
            message: t('agent.pipelineSteps.cameraEval'),
            progress: 0.99,
            images: evalImages,
        });
        generated = await projectApi.optimizeCameraTrajectory({
            user: state.projectSession.user,
            projectId: state.projectSession.activeProjectId,
            preparedPath,
        });
    }

    if (!isAgentCameraRenderJobActive(job)) return null;
    agentCameraRenderJob = {
        ...job,
        status: 'done',
        completedAt: new Date().toISOString(),
    };
    return normalizeCameraTaskResult(generated, finalText);
}

async function completeCameraDirectResultWithHostRender({ sessionId, attemptId, prompt, result }) {
    const finalText = getCameraTrajectoryReviewText(result);
    const cameraResult = result?.task && typeof result.task === 'object' ? result.task : result;
    if (!hasCameraTrajectoryHostRenderRequest(cameraResult)) return false;
    const job = startAgentCameraRenderJob({ sessionId, attemptId });
    try {
        const completed = await continueAgentCameraTrajectoryAfterHostRender(job, cameraResult, finalText);
        if (!completed) return true;
        completeServerCodexAgentSessionAttempt({
            sessionId,
            attemptId,
            workflowId: 'camera-direct',
            prompt,
            result: completed,
        });
    } catch (error) {
        if (isAgentCameraRenderJobActive(job)) {
            updateCameraRenderJobProgress(job, {
                stage: job.stage,
                statusId: 'canceled',
                message: error?.message || String(error),
                progress: 1,
            });
            agentCameraRenderJob = {
                ...job,
                status: 'failed',
                error: error?.message || String(error),
                failedAt: new Date().toISOString(),
            };
            createAgentSessionHandle(sessionId, attemptId).fail(t('messages.codexAgentFailed', {
                message: error?.message || String(error),
            }));
        }
    }
    return true;
}

function markCameraAttemptCanceled(attempt = {}) {
    const payloads = coalesceAgentTaskStepPayloads(
        (Array.isArray(attempt.steps) && attempt.steps.length > 0 ? attempt.steps : attempt.blocks || [])
            .map((block) => ({
                stage: block?.stepKey,
                statusId: block?.statusId,
                progress: block?.value,
                images: block?.images,
                artifacts: block?.artifacts,
            }))
    );
    const plannedStages = getCameraTaskPipelineStages(payloads);
    const stageStatuses = getCanceledCameraPipelineStageStatuses(plannedStages, payloads);
    const steps = createCameraPipelineSteps({
        task: {
            started: true,
            pipelineStageStatuses: plannedStages.map((stage) => ({
                stage,
                statusId: stageStatuses[stage] || 'canceled',
            })),
            events: payloads.map((payload) => ({
                payload: {
                    ...payload,
                    statusId: stageStatuses[payload.stage] || 'canceled',
                    message: stageStatuses[payload.stage] === 'done'
                        ? payload.statusText || t('agent.blocks.progressDone')
                        : t('common.canceled'),
                },
            })),
        },
    });
    return {
        ...attempt,
        status: 'canceled',
        blocks: steps,
        steps,
        updatedAt: new Date().toISOString(),
    };
}

function createCodexTaskAttemptFromResult({
    workflowId,
    prompt,
    result,
} = {}) {
    const task = result?.task || {};
    const progressImages = Array.isArray(result?.images)
        ? result.images
            .map((image, index) => {
                const assetPath = String(image?.relativePath || '');
                if (!assetPath) return null;
                return {
                    title: image.id || `Image ${index + 1}`,
                    src: projectApi.getAssetUrl(state.projectSession.user, state.projectSession.activeProjectId, assetPath),
                    alt: prompt,
                    assetPath,
                    relativePath: assetPath,
                    id: image.id || `Image ${index + 1}`,
                    mimeType: image.mimeType || '',
                    bytes: image.bytes || 0,
                };
            })
            .filter(Boolean)
        : [];
    if (workflowId === 'camera-direct') {
        const steps = createCameraPipelineSteps({ task });
        return createAgentGenerationAttempt({
            workflow: workflowId,
            text: getCameraTrajectoryReviewText(result),
            blocks: steps,
            steps,
            status: 'complete',
        });
    }

    const taskStatusId = normalizeAgentPipelineStatusId(task.statusId);
    const isFailedTask = taskStatusId === 'failed';
    const progressBlock = createAgentProgressBlock({
        title: task.title || 'Codex',
        stepKey: 'main-image',
        statusText: task.statusText || t('agent.blocks.progressDone'),
        statusId: taskStatusId || (progressImages.length > 0 ? 'done' : ''),
        value: task.progress ?? 1,
        indeterminate: false,
        images: progressImages,
        selectedIndex: 0,
        applied: false,
        actions: progressImages.length > 0 ? ['cancel', 'retry', 'apply'] : (isFailedTask ? ['cancel', 'retry'] : []),
        isCurrent: progressImages.length > 0 || isFailedTask,
        expanded: true,
    });
    const steps = createScenePipelineSteps({
        mainImageBlock: progressBlock,
    });
    const attempt = createAgentGenerationAttempt({
        workflow: workflowId,
        text: result?.finalText || t('messages.agentExecutionFailed'),
        blocks: steps,
        steps,
        status: 'complete',
    });
    return attempt;
}

function createCodexTaskSessionFromResult({
    workflowId,
    prompt,
    attachments,
    result,
} = {}) {
    if (workflowId === 'camera-direct') {
        applyAgentCameraTrajectoryTimeline(result?.task);
    }
    const attempt = createCodexTaskAttemptFromResult({
        workflowId,
        prompt,
        result,
    });
    const session = createAgentSession({
        workflow: workflowId,
        prompt,
        attachments,
        attempt,
    });
    const activeAttempt = session.attempts[0];
    if (shouldUseScenePipelineState(workflowId)) {
        activeAttempt.pipelineState = deriveScenePipelineState(session, activeAttempt);
    }
    return session;
}

function completeServerCodexAgentSessionAttempt({
    sessionId,
    attemptId,
    workflowId,
    prompt,
    result,
} = {}) {
    if (hasCodexTaskSignal(result)) {
        if (workflowId === 'camera-direct') {
            applyAgentCameraTrajectoryTimeline(result?.task);
        }
        const nextAttempt = createCodexTaskAttemptFromResult({
            workflowId,
            prompt,
            result,
        });
        updateAgentSessionById(sessionId, (session) => {
            const nextSession = replaceAgentSessionAttempt(session, attemptId, nextAttempt);
            const attempt = nextSession.attempts?.find((item) => item?.id === attemptId);
            if (!attempt) return nextSession;
            if (!shouldUseScenePipelineState(workflowId)) return nextSession;
            return replaceAgentSessionAttempt(nextSession, attemptId, {
                ...attempt,
                pipelineState: deriveScenePipelineState(nextSession, attempt),
            });
        }, {
            autoScroll: 'preserve-or-pin-bottom',
        });
        return;
    }
    updateAgentSessionById(sessionId, (session) => updateAgentSessionAttempt(session, {
        attemptId,
        text: result?.finalText || t('messages.agentExecutionFailed'),
        status: 'complete',
        blocks: [],
        steps: [],
    }), {
        autoScroll: 'preserve-or-pin-bottom',
    });
}

function updateCodexTaskSessionProgress({
    sessionId,
    attemptId,
    workflowId,
    task,
} = {}) {
    if (!sessionId || !attemptId || !task?.started) return;
    if (workflowId === 'camera-direct' && task?.trajectory) {
        applyAgentCameraTrajectoryTimeline(task);
    }
    updateAgentSessionById(sessionId, (session) => {
        const nextAttempts = (session.attempts || []).map((attempt) => {
            if (attempt.id !== attemptId) return attempt;
            const taskImages = Array.isArray(task.images) ? task.images : [];
            const steps = workflowId === 'camera-direct'
                ? createCameraPipelineSteps({ task })
                : getAgentAttemptStepBlocks(attempt).map((block) => {
                    if (block?.type !== 'progress' || !block.indeterminate) return block;
                    return {
                        ...block,
                        title: task.title || block.title,
                        statusText: task.statusText || block.statusText || t('common.generating'),
                        value: task.progress ?? block.value ?? 0.01,
                        images: taskImages.length > 0 ? taskImages : (Array.isArray(block.images) ? block.images : []),
                        selectedIndex: taskImages.length > 0 ? taskImages.length - 1 : block.selectedIndex,
                        expanded: true,
                    };
                });
            return {
                ...attempt,
                text: attempt.text || t('common.generating'),
                blocks: steps,
                steps,
                status: 'running',
                ...(shouldUseScenePipelineState(workflowId)
                    ? { pipelineState: deriveScenePipelineState(session, { ...attempt, blocks: steps, steps }) }
                    : {}),
                updatedAt: new Date().toISOString(),
            };
        });
        return {
            ...session,
            attempts: nextAttempts,
            updatedAt: new Date().toISOString(),
        };
    }, {
        autoScroll: 'preserve-or-pin-bottom',
    });
}

function runServerCodexAgentSessionAttempt({
    workflowId,
    prompt,
    sessionId,
    attemptId,
} = {}) {
    const debug = startAgentEndpointDebug({
        workflowId,
        endpoint: '/api/codex-agent/messages',
        prompt,
        sessionId,
        attemptId,
    });
    projectApi.sendCodexAgentMessageStream({
        user: state.projectSession.user,
        projectId: state.projectSession.activeProjectId,
        conversationId: getCodexAgentConversationId(),
        threadId: state.agentCodexThreadId,
        prompt,
        workflow: workflowId,
        onTask: (task) => {
            logAgentDebug(workflowId, 'task update', {
                sessionId,
                attemptId,
                title: task?.title || '',
                statusText: task?.statusText || '',
                progress: task?.progress ?? '',
            });
            updateCodexTaskSessionProgress({
                sessionId,
                attemptId,
                workflowId,
                task,
            });
        },
    }).then(async (result) => {
        debug.finish(result);
        state.agentCodexConversationId = result?.conversationId || state.agentCodexConversationId;
        state.agentCodexThreadId = result?.threadId || state.agentCodexThreadId;
        if (workflowId === 'camera-direct') {
            const handled = await completeCameraDirectResultWithHostRender({
                sessionId,
                attemptId,
                prompt,
                result,
            });
            if (handled) return;
            completeServerCodexAgentSessionAttempt({
                sessionId,
                attemptId,
                workflowId,
                prompt,
                result,
            });
            return;
        }
        completeServerCodexAgentSessionAttempt({
            sessionId,
            attemptId,
            workflowId,
            prompt,
            result,
        });
    }).catch((error) => {
        debug.finish(null, error);
        createAgentSessionHandle(sessionId, attemptId).fail(t('messages.codexAgentFailed', {
            message: error?.message || String(error),
        }));
    });
}

function buildCameraTrajectoryTaskFromResult(result, fallbackMessage = '') {
    const taskPayload = result?.visionaryTask && typeof result.visionaryTask === 'object' ? result.visionaryTask : {};
    return {
        started: true,
        stage: normalizeCameraPipelineStage(taskPayload.stage || 'camera_trajectory_generation'),
        title: taskPayload.title || t('agent.workflows.camera-direct.progressTitle'),
        progress: Number.isFinite(Number(taskPayload.progress)) ? Number(taskPayload.progress) : 1,
        statusText: taskPayload.message || fallbackMessage || t('agent.blocks.progressDone'),
        statusId: normalizeAgentPipelineStatusId(taskPayload.statusId || '') || 'done',
        trajectory: result?.trajectory || null,
        vlmDebug: result?.vlmDebug || result?.generation?.vlmDebug || null,
        pipelineStages: Array.isArray(taskPayload.pipelineStages) ? taskPayload.pipelineStages : undefined,
        pipelineStageStatuses: Array.isArray(taskPayload.pipelineStageStatuses) ? taskPayload.pipelineStageStatuses : undefined,
        initialViewImages: Array.isArray(taskPayload.initialViewImages) ? taskPayload.initialViewImages : undefined,
        images: Array.isArray(taskPayload.images) ? taskPayload.images : undefined,
        artifacts: Array.isArray(taskPayload.artifacts) ? taskPayload.artifacts : undefined,
        directorIntentText: typeof taskPayload.directorIntentText === 'string' ? taskPayload.directorIntentText : undefined,
        files: Array.isArray(taskPayload.files) ? taskPayload.files : undefined,
        dependencyTree: taskPayload.dependencyTree || result?.dependencyTree || undefined,
        warnings: Array.isArray(taskPayload.warnings) ? taskPayload.warnings : undefined,
        prepared: result?.prepared || taskPayload.prepared || undefined,
        preparedPath: result?.preparedPath || taskPayload.preparedPath || result?.prepared?.relativePath || undefined,
        renderRequests: Array.isArray(result?.renderRequests) ? result.renderRequests : Array.isArray(taskPayload.renderRequests) ? taskPayload.renderRequests : undefined,
        evalRenderRequests: Array.isArray(result?.evalRenderRequests) ? result.evalRenderRequests : Array.isArray(taskPayload.evalRenderRequests) ? taskPayload.evalRenderRequests : undefined,
        needsRender: typeof result?.needsRender === 'boolean' ? result.needsRender : typeof taskPayload.needsRender === 'boolean' ? taskPayload.needsRender : undefined,
        needsEvalRender: typeof result?.needsEvalRender === 'boolean' ? result.needsEvalRender : typeof taskPayload.needsEvalRender === 'boolean' ? taskPayload.needsEvalRender : undefined,
        renderStage: result?.renderStage || taskPayload.renderStage || undefined,
        events: [],
    };
}

function logCameraTrajectoryDebugPath(result) {
    const debugInfo = result?.vlmDebug || result?.generation?.vlmDebug || null;
    const manifestPath = String(debugInfo?.relativePath || '').trim();
    const directory = String(debugInfo?.directory || '').trim();
    if (!manifestPath && !directory) return;
    const assetUrl = manifestPath && state.projectSession.user && state.projectSession.activeProjectId
        ? projectApi.getAssetUrl(state.projectSession.user, state.projectSession.activeProjectId, manifestPath)
        : '';
    console.info('[Visionary Camera Debug]', {
        manifestPath,
        directory,
        ...(assetUrl ? { manifestUrl: assetUrl } : {}),
    });
}

function startServerCodexAgentResponse(workflowId, prompt, attachments = []) {
    const handle = openAgentAssistantMessage({
        workflow: workflowId,
        isLoading: true,
    });
    let pendingSession = null;
    if (shouldCreatePendingCodexTaskSession(workflowId)) {
        pendingSession = replaceAgentMessageWithSession(handle.messageId, createPendingCodexTaskSession({
            workflowId,
            prompt,
            attachments,
        }));
    }

    const debug = startAgentEndpointDebug({
        workflowId,
        endpoint: '/api/codex-agent/messages',
        prompt,
        sessionId: pendingSession?.id || '',
        attemptId: pendingSession ? getAgentSessionActiveAttempt(pendingSession)?.id || '' : '',
    });
    const activePendingAttemptId = pendingSession ? getAgentSessionActiveAttempt(pendingSession)?.id || '' : '';
    projectApi.sendCodexAgentMessageStream({
        user: state.projectSession.user,
        projectId: state.projectSession.activeProjectId,
        conversationId: getCodexAgentConversationId(),
        threadId: state.agentCodexThreadId,
        prompt,
        workflow: workflowId,
        onTask: (task) => {
            logAgentDebug(workflowId, 'task update', {
                sessionId: pendingSession?.id || '',
                attemptId: activePendingAttemptId,
                title: task?.title || '',
                statusText: task?.statusText || '',
                progress: task?.progress ?? '',
            });
            updateCodexTaskSessionProgress({
                sessionId: pendingSession?.id || '',
                attemptId: activePendingAttemptId,
                workflowId,
                task,
            });
        },
    }).then(async (result) => {
        debug.finish(result);
        state.agentCodexConversationId = result?.conversationId || state.agentCodexConversationId;
        state.agentCodexThreadId = result?.threadId || state.agentCodexThreadId;
        if (workflowId === 'camera-direct' && pendingSession) {
            const handled = await completeCameraDirectResultWithHostRender({
                sessionId: pendingSession.id,
                attemptId: getAgentSessionActiveAttempt(pendingSession)?.id || '',
                prompt,
                result,
            });
            if (handled) return;
            completeServerCodexAgentSessionAttempt({
                sessionId: pendingSession.id,
                attemptId: getAgentSessionActiveAttempt(pendingSession)?.id || '',
                workflowId,
                prompt,
                result,
            });
            return;
        }
        if (hasCodexTaskSignal(result)) {
            if (pendingSession) {
                completeServerCodexAgentSessionAttempt({
                    sessionId: pendingSession.id,
                    attemptId: getAgentSessionActiveAttempt(pendingSession)?.id || '',
                    workflowId,
                    prompt,
                    result,
                });
                return;
            }
            replaceAgentMessageWithSession(handle.messageId, createCodexTaskSessionFromResult({
                workflowId,
                prompt,
                attachments,
                result,
            }));
            return;
        }
        handle.updateText(result?.finalText || t('messages.agentExecutionFailed'));
        handle.finish();
    }).catch((error) => {
        debug.finish(null, error);
        handle.fail(t('messages.codexAgentFailed', {
            message: error?.message || String(error),
        }));
    });

    return handle;
}

async function handleAgentStepAction(context, action) {
    if (!canUseServerCodexAgent()) return;
    const liveContext = getAgentStepBlockContextById(context?.sessionId, context?.attemptId, context?.blockId) || context;
    if (!liveContext) return;
    if (action === 'apply' && liveContext.stepKey === 'insert-scene') {
        const plan = liveContext.block?.sceneInsertPlan;
        if (!plan || typeof plan !== 'object') {
            throw new Error(t('messages.agentOperationFailed', { message: 'insert-scene plan is missing' }));
        }
        let inserted = { loaded: 0, failed: 0 };
        try {
            inserted = commitAgentSceneInsertPreview(liveContext) || await applyAgentSceneInsertPlan(plan);
            if (inserted.loaded <= 0) {
                throw new Error(t('messages.loadModelFailed', { name: 'insert-scene' }));
            }
        } catch (error) {
            patchAgentStepBlock(liveContext, {
                statusText: error?.message || String(error),
                statusId: 'failed',
                value: 1,
                indeterminate: false,
                applied: false,
                actions: ['cancel', 'retry', 'apply'],
            });
            throw error;
        }
        patchAgentStepBlock(liveContext, {
            statusText: t('agent.pipelineSteps.insertSceneInserted', { count: inserted.loaded }),
            statusId: 'done',
            value: 1,
            indeterminate: false,
            applied: true,
            actions: [],
        });
        updateAgentSessionById(liveContext.sessionId, (current) => setAgentSessionArchiveState(current, {
            archiveState: 'applied',
            summaryLabel: t('common.applied'),
            thumbnailUrl: getAgentSessionArchiveThumbnail(current),
        }));
        return;
    }
    clearAgentSceneInsertPreviewForContext(liveContext);
    if (action === 'retry') {
        resetDownstreamScenePipelineStepsForRetry(liveContext);
    }
    const currentImages = Array.isArray(liveContext.block.images) ? liveContext.block.images : [];
    const selectedIndex = Math.max(0, Math.min(currentImages.length - 1, Number(liveContext.block.selectedIndex) || 0));
    patchAgentStepBlock(liveContext, {
        statusText: action === 'retry' ? t('common.generating') : liveContext.block.statusText,
        statusId: action === 'retry' ? 'running' : liveContext.block.statusId,
        indeterminate: action === 'retry',
    });
    let result;
    try {
        result = await projectApi.sendCodexAgentStepAction({
            user: state.projectSession.user,
            projectId: state.projectSession.activeProjectId,
            sessionId: liveContext.sessionId,
            stepKey: liveContext.stepKey,
            action,
            prompt: liveContext.session.prompt || liveContext.attempt.text || '',
            selectedIndex,
            images: currentImages.map((image) => serializeAgentStepImage(image)),
            sourceImages: [
                serializeAgentSessionStepSourceImage(liveContext.session, liveContext.attempt, 'main-image'),
                serializeAgentSessionStepSourceImage(liveContext.session, liveContext.attempt, 'top-view'),
                serializeAgentSessionStepSourceImage(liveContext.session, liveContext.attempt, 'layout'),
                serializeAgentSessionStepSourceImage(liveContext.session, liveContext.attempt, 'components-3d'),
            ].filter(Boolean),
        });
    } catch (error) {
        patchAgentStepBlock(liveContext, {
            statusText: error?.message || String(error),
            statusId: 'failed',
            value: 1,
            indeterminate: false,
            applied: false,
            actions: ['cancel', 'retry'],
            isCurrent: true,
            expanded: true,
        });
        throw error;
    }
    const patch = result?.blockPatch || {};
    const nextImages = Array.isArray(patch.images)
        ? patch.images.map((image, index) => {
            const assetPath = String(image?.relativePath || image?.assetPath || '');
            return {
                id: image?.id || image?.title || `Image ${index + 1}`,
                title: image?.title || image?.id || `Image ${index + 1}`,
                relativePath: assetPath,
                assetPath,
                mimeType: image?.mimeType || '',
                bytes: image?.bytes || 0,
                metadata: image?.metadata && typeof image.metadata === 'object' ? image.metadata : undefined,
                src: assetPath
                    ? projectApi.getAssetUrl(state.projectSession.user, state.projectSession.activeProjectId, assetPath)
                    : image?.src || '',
                alt: liveContext.session.prompt || liveContext.attempt.text || '',
            };
        })
        : currentImages;
    patchAgentStepBlock(liveContext, {
        ...patch,
        images: nextImages,
        ...(patch.sceneInsertPlan && typeof patch.sceneInsertPlan === 'object' ? { sceneInsertPlan: patch.sceneInsertPlan } : {}),
    });
    if (action === 'retry' && liveContext.stepKey === 'insert-scene' && patch.sceneInsertPlan && typeof patch.sceneInsertPlan === 'object') {
        try {
            const preview = await createAgentSceneInsertPreview(liveContext, patch.sceneInsertPlan);
            if (preview.loaded > 0) {
                patchAgentStepBlock(liveContext, {
                    statusText: t('agent.pipelineSteps.insertScenePreviewReady', { count: preview.loaded }),
                    statusId: 'done',
                    value: 1,
                    indeterminate: false,
                    applied: false,
                    actions: ['cancel', 'retry', 'apply'],
                });
            }
        } catch (error) {
            patchAgentStepBlock(liveContext, {
                statusText: error?.message || String(error),
                statusId: 'failed',
                value: 1,
                indeterminate: false,
                applied: false,
                actions: ['cancel', 'retry'],
                isCurrent: true,
                expanded: true,
            });
            throw error;
        }
    }
    if (action === 'cancel') {
        markSceneAttemptCanceled(liveContext);
        return;
    }
    if (action === 'apply') {
        await advanceAgentPipelineAfterStepApply(liveContext);
    }
}

async function advanceAgentPipelineAfterStepApply(context) {
    const nextStepKey = getNextScenePipelineStepKey(context?.stepKey || '');
    if (!nextStepKey) return;
    patchAgentStepBlockByStepKey(context.sessionId, context.attemptId, nextStepKey, {
        statusText: t('common.generating'),
        statusId: 'running',
        value: 0.01,
        indeterminate: true,
        applied: false,
        actions: [],
        isCurrent: true,
        expanded: true,
    });
    const nextContext = getAgentStepBlockContextByStepKey(context.sessionId, context.attemptId, nextStepKey);
    if (!nextContext) return;
    await handleAgentStepAction(nextContext, 'retry');
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
        if (session.workflow === 'camera-direct') {
            cancelAgentCameraRenderJob();
            restoreAgentCameraTrajectoryPreview();
        }
        if (session.workflow === 'scene-build') {
            clearAgentSceneInsertPreviewForContext({
                sessionId,
                attemptId: activeAttempt?.id || '',
            });
        }
        updateAgentSessionById(sessionId, (current) => setAgentSessionArchiveState(current, {
            archiveState: 'canceled',
            summaryLabel: t('common.canceled'),
            thumbnailUrl,
        }));
        if (session.workflow === 'camera-direct' && activeAttempt?.id) {
            updateAgentSessionById(sessionId, (current) => replaceAgentSessionAttempt(
                current,
                activeAttempt.id,
                markCameraAttemptCanceled(activeAttempt)
            ));
        }
        await invokeAgentSessionActionHandler('onCancel', payload);
        return;
    }

    if (action === 'apply') {
        if (session.workflow === 'camera-direct') {
            commitAgentCameraTrajectoryPreview();
        }
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
        if (session.workflow === 'camera-direct') {
            cancelAgentCameraRenderJob();
            resetAgentCameraTrajectoryPreviewForRetry();
            const nextAttempt = createAgentGenerationAttempt({
                workflow: session.workflow,
                text: `${t('common.generating')}: ${retryPrompt}`,
                blocks: [],
                steps: [],
                status: 'running',
            });
            updateAgentSessionById(sessionId, (current) => appendAgentSessionRetryAttempt(current, nextAttempt), {
                autoScroll: 'preserve-or-pin-bottom',
            });
            await invokeAgentSessionActionHandler('onRetry', {
                ...payload,
                nextAttempt,
            });
            runServerCodexAgentSessionAttempt({
                workflowId: session.workflow,
                prompt: retryPrompt,
                sessionId,
                attemptId: nextAttempt.id,
            });
            return;
        }
        if (session.workflow === 'scene-build') {
            clearAgentSceneInsertPreviewForContext({
                sessionId,
                attemptId: activeAttempt?.id || '',
            });
        }
        const interruptedStepContext = getInterruptedAgentStepContext(sessionId, activeAttempt?.id || '');
        if (interruptedStepContext) {
            await handleInterruptedAgentStepAction(interruptedStepContext, 'retry');
            return;
        }
        if (canUseServerCodexAgent()) {
            const nextAttempt = createAgentGenerationAttempt({
                workflow: session.workflow,
                text: `${t('common.generating')}: ${retryPrompt}`,
                blocks: [],
            });
            updateAgentSessionById(sessionId, (current) => appendAgentSessionRetryAttempt(current, nextAttempt), {
                autoScroll: 'preserve-or-pin-bottom',
            });
            await invokeAgentSessionActionHandler('onRetry', {
                ...payload,
                nextAttempt,
            });
            runServerCodexAgentSessionAttempt({
                workflowId: session.workflow,
                prompt: retryPrompt,
                sessionId,
                attemptId: nextAttempt.id,
            });
            return;
        }
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
    const rawPrompt = String(promptText || '');
    const prompt = rawPrompt.trim();
    if (!prompt && attachments.length === 0) return;
    const attachmentFallback = t('messages.imageInput');
    const effectivePrompt = prompt ? rawPrompt.trimStart() : attachmentFallback;
    const workflowId = getAgentWorkflowForPrompt(effectivePrompt, state.agentWorkflow);

    const userMessage = createAgentMessage('user', effectivePrompt, workflowId);
    userMessage.attachments = attachments;
    state.agentMessages.push(userMessage);
    renderAgentMessages({ autoScroll: 'always' });
    schedulePersistAgentConversations();
    if (canUseServerCodexAgent()) {
        startServerCodexAgentResponse(workflowId, effectivePrompt, attachments);
        return;
    }
    startMockAgentResponse(workflowId, effectivePrompt, attachments);
}

function handleAgentComposerSubmit(event) {
    event.preventDefault();
    if (!dom.agentComposerInput) return;
    syncAgentComposerSkillFromInput();
    const prompt = buildAgentComposerPromptText(getAgentComposerInputText());
    const attachments = state.agentPendingImages.map((file, index) => ({
        id: `attachment-${Date.now()}-${index}`,
        name: file.name,
        type: file.type || 'image/*',
        file,
    }));
    if (!prompt && attachments.length === 0) return;

    submitAgentPrompt(prompt, attachments);
    setAgentComposerInputText('', { focus: false });
    clearAgentComposerSkill();
    state.agentPendingImages = [];
    renderAgentComposerAttachments();
}

function handleAgentComposerFocusIn() {
    if (state.agentWorkbenchMode !== 'conversation') {
        setAgentWorkbenchMode('conversation');
    }
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
    if (dom.timelineCameraFovNumber && document.activeElement !== dom.timelineCameraFovNumber) {
        dom.timelineCameraFovNumber.value = fixed;
    }
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

function updateTimelineCameraFovFromInput() {
    if (!dom.timelineCameraFovNumber) return;
    const parsed = extractNumericValue(dom.timelineCameraFovNumber.value);
    if (parsed === null) return;
    applyTimelineCameraFov(parsed, true);
}

function commitTimelineCameraFovFromInput() {
    if (!dom.timelineCameraFovNumber) return;
    const parsed = extractNumericValue(dom.timelineCameraFovNumber.value);
    if (parsed === null) {
        dom.timelineCameraFovNumber.value = Number(getTimelineCameraFovAtTime(Number(state.currentTime) || 0) || getFallbackTimelineCameraFov()).toFixed(3);
        return;
    }
    applyTimelineCameraFov(parsed, false);
    dom.timelineCameraFovNumber.value = Number(getTimelineCameraFovAtTime(Number(state.currentTime) || 0) || getFallbackTimelineCameraFov()).toFixed(3);
}

function handleTimelineCameraFovInputKeydown(e) {
    if (!dom.timelineCameraFovNumber) return;
    if (e.key === 'Enter') {
        commitTimelineCameraFovFromInput();
        dom.timelineCameraFovNumber.blur();
        return;
    }
    if (e.key !== 'ArrowUp' && e.key !== 'ArrowDown') return;

    e.preventDefault();
    const direction = e.key === 'ArrowUp' ? 1 : -1;
    const nextValue = nudgeNumericInputValue(
        dom.timelineCameraFovNumber.value,
        0.001,
        Number(getTimelineCameraFovAtTime(Number(state.currentTime) || 0) || getFallbackTimelineCameraFov()),
        direction
    );
    dom.timelineCameraFovNumber.value = nextValue.toFixed(3);
    applyTimelineCameraFov(nextValue, true);
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
    const frame = state.selectedModelId
        ? null
        : Number.isFinite(Number(state.selectedCameraSequenceFrame))
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
            const loadingDetail = dom.loadingOverlay.querySelector('.loading-detail');
            if (loadingText) loadingText.textContent = text;
            if (loadingDetail) {
                loadingDetail.textContent = options?.detail || '';
                loadingDetail.toggleAttribute('hidden', !options?.detail);
            }
            if (dom.progressFill) dom.progressFill.style.width = `${progress}%`;
            if (dom.progressText) dom.progressText.textContent = `${Math.round(progress)}%`;
        } else {
            dom.loadingOverlay.classList.remove('loading-overlay-passive');
            dom.loadingOverlay.classList.add('hidden');
        }
    }
}

function setBootLoadingVisible(visible) {
    if (!dom.bootLoadingOverlay) return;
    dom.bootLoadingOverlay.classList.toggle('hidden', !visible);
    dom.bootLoadingOverlay.setAttribute('aria-busy', visible ? 'true' : 'false');
}

function setBootLoadingStatus(detail = t('loading.bootPreparing')) {
    if (!dom.bootLoadingOverlay) return;
    const loadingText = dom.bootLoadingOverlay.querySelector('.loading-text');
    const loadingDetail = dom.bootLoadingOverlay.querySelector('.loading-detail');
    if (loadingText) loadingText.textContent = t('canvas.loading');
    if (loadingDetail) loadingDetail.textContent = detail;
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
    if (dom.cameraDisplayScaleValue && document.activeElement !== dom.cameraDisplayScaleValue) {
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

function updateCameraSequenceDisplayScaleFromInput() {
    if (!dom.cameraDisplayScaleValue) return;
    const parsed = extractNumericValue(dom.cameraDisplayScaleValue.value);
    if (parsed === null) return;
    setCameraSequenceDisplayScale(parsed, true);
}

function commitCameraSequenceDisplayScaleFromInput() {
    if (!dom.cameraDisplayScaleValue) return;
    const parsed = extractNumericValue(dom.cameraDisplayScaleValue.value);
    if (parsed === null) {
        dom.cameraDisplayScaleValue.value = Number(state.cameraSequenceDisplayScale || CAMERA_DISPLAY_SCALE_DEFAULT).toFixed(2);
        return;
    }
    setCameraSequenceDisplayScale(parsed, false);
    dom.cameraDisplayScaleValue.value = Number(state.cameraSequenceDisplayScale || CAMERA_DISPLAY_SCALE_DEFAULT).toFixed(2);
}

function handleCameraSequenceDisplayScaleInputKeydown(e) {
    if (!dom.cameraDisplayScaleValue) return;
    if (e.key === 'Enter') {
        commitCameraSequenceDisplayScaleFromInput();
        dom.cameraDisplayScaleValue.blur();
        return;
    }
    if (e.key !== 'ArrowUp' && e.key !== 'ArrowDown') return;

    e.preventDefault();
    const direction = e.key === 'ArrowUp' ? 1 : -1;
    const nextValue = nudgeNumericInputValue(
        dom.cameraDisplayScaleValue.value,
        0.01,
        Number(state.cameraSequenceDisplayScale || CAMERA_DISPLAY_SCALE_DEFAULT),
        direction
    );
    dom.cameraDisplayScaleValue.value = nextValue.toFixed(2);
    setCameraSequenceDisplayScale(nextValue, true);
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

function renderModelVisibilityIcon(visible) {
    return visible
        ? `
            <svg class="model-visibility-icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
                <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12Z" />
                <circle cx="12" cy="12" r="3" />
            </svg>
        `
        : `
            <svg class="model-visibility-icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
                <path d="M3 12c2.4 3 5.4 4.5 9 4.5s6.6-1.5 9-4.5" />
                <path d="m5 15-1.5 2" />
                <path d="m9 16.3-.5 2.2" />
                <path d="m15 16.3.5 2.2" />
                <path d="m19 15 1.5 2" />
            </svg>
        `;
}

/**
 * 更新模型列表 UI
 */
function updateModelList() {
    if (!dom.modelList) return;
    const models = app?.getModels?.() || [];
    if (modelRenameState && !models.some((model) => model.id === modelRenameState.modelId)) {
        modelRenameState = null;
    }
    updateCameraSequenceToggleButton();

    if (models.length === 0) {
        dom.modelList.innerHTML = '<div class="empty-list">' +
            `<p>${escapeHtml(t('sidebar.emptyTitle'))}</p>` +
            `<p class="empty-hint">${escapeHtml(t('sidebar.emptyHint'))}</p>` +
            '</div>';
    } else {
        dom.modelList.innerHTML = models.map((model) => `
            <div class="model-item ${state.selectedModelId === model.id ? 'selected' : ''}" data-id="${model.id}">
                ${(() => {
                    const renameDraft = getModelRenameDraft(model);
                    if (modelRenameState?.modelId !== model.id) {
                        return `<span class="model-name" title="${escapeHtml(model.name)}">${escapeHtml(model.name)}</span>`;
                    }
                    return `
                        <label class="model-name-edit" data-id="${model.id}">
                            <input
                                type="text"
                                class="model-name-input"
                                data-id="${model.id}"
                                value="${escapeHtml(modelRenameState.draftStem)}"
                                spellcheck="false"
                                autocomplete="off"
                                aria-label="${escapeHtml(t('sidebar.renameModel'))}"
                            >
                            ${renameDraft.extension ? `<span class="model-name-ext">${escapeHtml(renameDraft.extension)}</span>` : ''}
                        </label>
                    `;
                })()}
                <span class="model-points">${t('sidebar.pointCount', { count: model.pointCount.toLocaleString() })}</span>
                <button
                    class="model-visibility-btn ${model.visible ? 'active' : ''}"
                    data-id="${model.id}"
                    title="${escapeHtml(model.visible ? t('common.visible') : t('common.hidden'))}"
                    aria-label="${escapeHtml(t('sidebar.toggleVisibility'))}: ${escapeHtml(model.visible ? t('common.visible') : t('common.hidden'))}"
                >
                    ${renderModelVisibilityIcon(model.visible)}
                </button>
                <span class="model-remove" data-id="${model.id}" title="${t('sidebar.deleteModel')}">&times;</span>
            </div>
        `).join('');

        // 绑定删除事件
        dom.modelList.querySelectorAll('.model-remove').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const id = btn.dataset.id;
                if (modelRenameState?.modelId === id) {
                    modelRenameState = null;
                }
                app.removeModel(id);
                refreshCanonicalAssetReferenceState();
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
            item.addEventListener('dblclick', (event) => {
                if (event.target?.closest?.('.model-visibility-btn, .model-remove, .model-name-input')) {
                    return;
                }
                beginModelRename(item.dataset.id);
            });
        });

        dom.modelList.querySelectorAll('.model-name').forEach(label => {
            label.addEventListener('dblclick', (event) => {
                event.stopPropagation();
                beginModelRename(label.closest('.model-item')?.dataset.id);
            });
        });

        dom.modelList.querySelectorAll('.model-name-input').forEach(input => {
            input.addEventListener('click', (event) => {
                event.stopPropagation();
            });
            input.addEventListener('dblclick', (event) => {
                event.stopPropagation();
            });
            input.addEventListener('input', () => {
                if (!modelRenameState || modelRenameState.modelId !== input.dataset.id) return;
                const sanitized = sanitizeRenameStemInput(input.value);
                modelRenameState.draftStem = sanitized;
                if (sanitized !== input.value) {
                    input.value = sanitized;
                }
            });
            input.addEventListener('keydown', (event) => {
                if (event.key === 'Enter') {
                    event.preventDefault();
                    void commitModelRename(input.dataset.id, { keepEditingOnError: true });
                } else if (event.key === 'Escape') {
                    event.preventDefault();
                    cancelModelRename();
                }
            });
            input.addEventListener('blur', () => {
                handleModelRenameInputBlur(input.dataset.id);
            });
        });

        if (modelRenameState?.modelId) {
            focusModelRenameInput(modelRenameState.modelId);
        }
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
    if (state.viewportGizmoMode) {
        app.setViewportGizmoMode?.(state.viewportGizmoMode);
    } else {
        app.refreshSelectedModelViewportGizmo?.();
    }
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
        color: t('modal.exportRenderModes.rgb'),
        depth: t('modal.exportRenderModes.depth'),
        normal: t('modal.exportRenderModes.normal'),
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
    const displayPercent = Math.round(safePercent);
    dom.exportProgress?.classList.toggle('hidden', !visible);
    dom.exportProgress?.setAttribute('aria-hidden', visible ? 'false' : 'true');
    if (dom.exportProgressFill) {
        dom.exportProgressFill.style.width = `${displayPercent}%`;
    }
    if (dom.exportProgressText) {
        dom.exportProgressText.textContent = displayPercent > 0
            ? t('modal.exportProgressValue', { percent: displayPercent })
            : t('modal.exportProgressIdle');
    }
    return displayPercent;
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

// Timeline camera rotations are stored as world-to-camera quaternions. Invert to C2W
// before applying to Three.js, then derive view direction from local -Z, not +Z.
// Using +Z makes orbit/lookAt paths face outward even when the positions are correct.
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
    const forward = rotateVectorByQuaternion({ x: 0, y: 0, z: -1 }, c2w);
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
                const displayPercent = setExportProgress(percent, true);
                showLoading(true, t('loading.renderingVideo'), displayPercent, { passive: true });
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

const MODEL_COMPOUND_EXTENSIONS = ['.compressed.ply'];
const WINDOWS_RESERVED_FILE_STEM_RE = /^(con|prn|aux|nul|com[1-9]|lpt[1-9])$/i;

function splitEditableFileNameParts(fileName) {
    const normalized = sanitizeFileName(extractFileName(fileName || 'model'));
    const lower = normalized.toLowerCase();
    const compoundExtension = MODEL_COMPOUND_EXTENSIONS.find((extension) => lower.endsWith(extension));
    if (compoundExtension && normalized.length > compoundExtension.length) {
        return {
            stem: normalized.slice(0, normalized.length - compoundExtension.length),
            extension: normalized.slice(normalized.length - compoundExtension.length),
        };
    }
    const dotIndex = normalized.lastIndexOf('.');
    if (dotIndex <= 0) {
        return { stem: normalized, extension: '' };
    }
    return {
        stem: normalized.slice(0, dotIndex),
        extension: normalized.slice(dotIndex),
    };
}

function sanitizeRenameStemInput(value) {
    return String(value || '')
        .replace(/[\u0000-\u001f]/g, '')
        .replace(/[\\/:*?"<>|]/g, '_')
        .replace(/^\.+/, '')
        .replace(/\s+$/g, '')
        .replace(/\.+$/g, '');
}

function validateRenameStem(stem) {
    const candidate = String(stem || '').trim();
    if (!candidate) {
        return 'messages.invalidRenameEmpty';
    }
    if (candidate === '.' || candidate === '..' || WINDOWS_RESERVED_FILE_STEM_RE.test(candidate)) {
        return 'messages.invalidRenameReserved';
    }
    return null;
}

function isRelativeWorkspaceAssetPath(sourcePath) {
    if (typeof sourcePath !== 'string') return false;
    const normalized = sourcePath.trim().replace(/\\/g, '/');
    if (!normalized || normalized.startsWith('/')) return false;
    if (/^[a-z]:\//i.test(normalized)) return false;
    if (isHttpUrl(normalized)) return false;
    if (isWorkspaceMaterializedAssetPath(normalized)) return false;
    if (isServerMaterializedAssetPath(normalized)) return false;
    if (isServerAgentAssetPath(normalized)) return false;
    return true;
}

function buildSiblingAssetPath(relativePath, fileName) {
    const parts = String(relativePath || '').replace(/\\/g, '/').split('/').filter(Boolean);
    if (parts.length === 0) {
        return fileName;
    }
    parts[parts.length - 1] = fileName;
    return parts.join('/');
}

function getModelRenameDraft(model) {
    const fileName = sanitizeFileName(model?.name || extractFileName(model?.sourcePath || '') || 'model');
    return splitEditableFileNameParts(fileName);
}

function focusModelRenameInput(modelId) {
    if (!dom.modelList || !modelId) return;
    const selector = `.model-name-input[data-id="${CSS.escape(String(modelId))}"]`;
    const input = dom.modelList.querySelector(selector);
    if (!(input instanceof HTMLInputElement) || document.activeElement === input) return;
    requestAnimationFrame(() => {
        input.focus();
        input.select();
    });
}

function handleModelRenameInputBlur(modelId) {
    requestAnimationFrame(() => {
        if (!document.hasFocus()) return;
        void commitModelRename(modelId, { keepEditingOnError: true });
    });
}

function beginModelRename(modelId) {
    const model = app?.getModel?.(modelId);
    if (!model) return;
    const draft = getModelRenameDraft(model);
    modelRenameState = {
        modelId,
        draftStem: draft.stem,
        busy: false,
    };
    updateModelList();
    focusModelRenameInput(modelId);
}

function cancelModelRename() {
    if (!modelRenameState) return;
    modelRenameState = null;
    updateModelList();
}

async function persistModelRenameNow() {
    if (isServerProjectSessionActive()) {
        return saveServerProjectToCurrentProject({ silent: true });
    }
    if (isLocalWorkspaceSyncMode() && sceneFs.isWorkspaceWritable?.()) {
        return saveWorkspaceToCurrentWorkspace({
            requestWorkspaceIfNeeded: false,
            silent: true,
            includeAssetPayloads: false,
        });
    }
    return false;
}

async function commitModelRename(modelId, options = {}) {
    const { keepEditingOnError = true } = options;
    if (!modelRenameState || modelRenameState.modelId !== modelId || modelRenameState.busy) {
        return false;
    }
    const model = app?.getModel?.(modelId);
    if (!model) {
        modelRenameState = null;
        updateModelList();
        return false;
    }

    const renameDraft = getModelRenameDraft(model);
    const nextStem = sanitizeRenameStemInput(modelRenameState.draftStem);
    modelRenameState.draftStem = nextStem;
    const validationErrorKey = validateRenameStem(nextStem);
    if (validationErrorKey) {
        showError(t(validationErrorKey));
        updateModelList();
        if (keepEditingOnError) {
            focusModelRenameInput(modelId);
        } else {
            modelRenameState = null;
            updateModelList();
        }
        return false;
    }

    const nextName = `${nextStem}${renameDraft.extension}`;
    if (nextName === model.name) {
        modelRenameState = null;
        updateModelList();
        return true;
    }

    modelRenameState.busy = true;
    let nextSourcePath = typeof model.sourcePath === 'string' ? model.sourcePath : undefined;
    let nextSourceFile = model.sourceFile instanceof File ? model.sourceFile : undefined;
    let renameApplied = false;
    try {
        if (sceneFs.isWorkspaceWritable?.() && isRelativeWorkspaceAssetPath(nextSourcePath)) {
            const renamedSourcePath = buildSiblingAssetPath(nextSourcePath, nextName);
            if (renamedSourcePath !== nextSourcePath) {
                try {
                    await sceneFs.readBinaryFromRoot(nextSourcePath);
                    await sceneFs.renameRootFile(nextSourcePath, renamedSourcePath);
                    nextSourcePath = renamedSourcePath;
                } catch (error) {
                    const errorMessage = error?.message || String(error);
                    if (/target already exists/i.test(errorMessage)) {
                        throw new Error(t('messages.modelRenameConflict', { name: nextName }));
                    }
                    if (!/file not found/i.test(errorMessage)) {
                        throw error;
                    }
                }
            }
        }

        if (nextSourceFile instanceof File && nextSourceFile.name !== nextName) {
            nextSourceFile = new File([nextSourceFile], nextName, {
                type: nextSourceFile.type,
                lastModified: nextSourceFile.lastModified,
            });
        }

        const renamed = app.renameModel(modelId, nextName, {
            sourcePath: nextSourcePath,
            sourceFile: nextSourceFile,
        });
        if (!renamed) {
            throw new Error(t('messages.modelRenameRejected'));
        }
        renameApplied = true;

        modelRenameState = null;
        if (state.selectedModelId === modelId && dom.selectedModelName) {
            dom.selectedModelName.textContent = nextName;
        }
        markWorkspaceDirty('model-rename');
        await persistModelRenameNow();
        showInfo(t('messages.modelRenamed', { name: nextName }));
        return true;
    } catch (error) {
        modelRenameState.busy = false;
        const message = error?.message || String(error);
        if (renameApplied) {
            modelRenameState = null;
            updateModelList();
            showError(t('messages.modelRenameFailed', { message }));
            return false;
        }
        showError(
            /^模型重命名冲突|^Model rename conflict/i.test(message)
                ? message
                : t('messages.modelRenameFailed', { message })
        );
        updateModelList();
        if (keepEditingOnError) {
            focusModelRenameInput(modelId);
        }
        return false;
    }
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

function finiteNumberTuple(value, length, fallback = []) {
    if (!Array.isArray(value) || value.length < length) return fallback;
    const values = value.slice(0, length).map((item, index) => {
        const numeric = Number(item);
        return Number.isFinite(numeric) ? numeric : Number(fallback[index] ?? 0);
    });
    return values.length === length ? values : fallback;
}

function roundFiniteNumber(value, digits = 4) {
    const number = Number(value);
    if (!Number.isFinite(number)) return 0;
    const scale = 10 ** digits;
    return Math.round(number * scale) / scale;
}

function computeObject3DWorldBounds(root) {
    if (!root || typeof root.traverse !== 'function') return null;
    root.updateMatrixWorld?.(true);
    const min = [Infinity, Infinity, Infinity];
    const max = [-Infinity, -Infinity, -Infinity];
    const corners = [
        [0, 0, 0],
        [0, 0, 1],
        [0, 1, 0],
        [0, 1, 1],
        [1, 0, 0],
        [1, 0, 1],
        [1, 1, 0],
        [1, 1, 1],
    ];
    root.traverse((child) => {
        const geometry = child?.geometry;
        const box = geometry?.boundingBox;
        if (!geometry || !child?.matrixWorld) return;
        if (!box && typeof geometry.computeBoundingBox === 'function') {
            geometry.computeBoundingBox();
        }
        const bounds = geometry.boundingBox;
        if (!bounds?.min || !bounds?.max) return;
        const e = child.matrixWorld.elements;
        if (!e || e.length < 16) return;
        for (const corner of corners) {
            const x = corner[0] ? bounds.max.x : bounds.min.x;
            const y = corner[1] ? bounds.max.y : bounds.min.y;
            const z = corner[2] ? bounds.max.z : bounds.min.z;
            const wx = e[0] * x + e[4] * y + e[8] * z + e[12];
            const wy = e[1] * x + e[5] * y + e[9] * z + e[13];
            const wz = e[2] * x + e[6] * y + e[10] * z + e[14];
            min[0] = Math.min(min[0], wx);
            min[1] = Math.min(min[1], wy);
            min[2] = Math.min(min[2], wz);
            max[0] = Math.max(max[0], wx);
            max[1] = Math.max(max[1], wy);
            max[2] = Math.max(max[2], wz);
        }
    });
    if (!min.every(Number.isFinite) || !max.every(Number.isFinite)) return null;
    const dimensions = [
        Math.abs(max[0] - min[0]),
        Math.abs(max[1] - min[1]),
        Math.abs(max[2] - min[2]),
    ];
    if (!dimensions.every((value) => Number.isFinite(value) && value > 0)) return null;
    return {
        min: min.map((value) => roundFiniteNumber(value)),
        max: max.map((value) => roundFiniteNumber(value)),
        size: dimensions.map((value) => roundFiniteNumber(value)),
        center: [
            roundFiniteNumber((min[0] + max[0]) / 2),
            roundFiniteNumber((min[1] + max[1]) / 2),
            roundFiniteNumber((min[2] + max[2]) / 2),
        ],
    };
}

function computeObject3DDimensions(root) {
    const bounds = computeObject3DWorldBounds(root);
    return bounds?.size || null;
}

function computeModelWorldBounds(model) {
    const objectBounds = computeObject3DWorldBounds(model?.object3D);
    if (objectBounds) return { ...objectBounds, source: 'object3D.worldBounds' };

    const gaussianAabb = model?.gaussianModel?.getWorldAABB?.();
    const min = finiteNumberTuple(gaussianAabb?.min, 3, []);
    const max = finiteNumberTuple(gaussianAabb?.max, 3, []);
    if (min.length === 3 && max.length === 3) {
        const orderedMin = min.map((value, index) => Math.min(value, max[index]));
        const orderedMax = min.map((value, index) => Math.max(value, max[index]));
        const size = orderedMin.map((value, index) => orderedMax[index] - value);
        if (size.every((value) => Number.isFinite(value) && value > 0)) {
            return {
                min: orderedMin.map((value) => roundFiniteNumber(value)),
                max: orderedMax.map((value) => roundFiniteNumber(value)),
                size: size.map((value) => roundFiniteNumber(value)),
                center: orderedMin.map((value, index) => roundFiniteNumber((value + orderedMax[index]) / 2)),
                source: 'gaussianModel.worldAABB',
            };
        }
    }
    return null;
}

function resolveAgentSceneInsertScale(loadedModel, transform = {}, fallbackScale = [1, 1, 1]) {
    if (transform.scaleMode === 'embedded') return 1;
    const referenceSize = finiteNumberTuple(transform.referenceSize, 3, []);
    const minScale = Number.isFinite(Number(transform.minScale)) ? Number(transform.minScale) : 0.05;
    const maxScale = Number.isFinite(Number(transform.maxScale)) ? Number(transform.maxScale) : 50;
    const dimensions = computeObject3DDimensions(loadedModel?.object3D);
    if (dimensions && referenceSize.length === 3) {
        const ratios = referenceSize
            .map((size, index) => dimensions[index] > 0 ? Number(size) / dimensions[index] : null)
            .filter((value) => Number.isFinite(value) && value > 0);
        if (ratios.length > 0) {
            const scale = Math.min(...ratios);
            return Math.max(minScale, Math.min(maxScale, scale));
        }
    }
    const scale = finiteNumberTuple(transform.scale, 3, fallbackScale);
    return (Math.abs(scale[0] - scale[1]) < 1e-6 && Math.abs(scale[1] - scale[2]) < 1e-6)
        ? scale[0]
        : (scale[0] + scale[1] + scale[2]) / 3;
}

function getAgentSceneInsertPlanItems(plan) {
    return Array.isArray(plan?.items) ? plan.items : [];
}

function normalizeAgentCanonicalAssetCacheKey(value) {
    const normalized = String(value || '').trim().replace(/\\/g, '/');
    if (!normalized) return '';
    if (isServerMaterializedAssetPath(normalized)) return normalized.toLowerCase();
    return normalized;
}

function getCachedCanonicalizedServerProjectAsset(...keys) {
    for (const key of keys) {
        const cacheKey = normalizeAgentCanonicalAssetCacheKey(key);
        if (!cacheKey) continue;
        const cached = agentCanonicalAssetBlobCache.get(cacheKey);
        if (cached) return cached;
    }
    return null;
}

function rememberCanonicalizedServerProjectAsset(asset, ...keys) {
    if (!asset?.path || !asset?.hash || !asset?.content) return asset;
    const cacheKeys = [
        asset.path,
        `sha256:${asset.hash}`,
        ...keys,
    ];
    cacheKeys.forEach((key) => {
        const cacheKey = normalizeAgentCanonicalAssetCacheKey(key);
        if (cacheKey) {
            agentCanonicalAssetBlobCache.set(cacheKey, asset);
        }
    });
    return asset;
}

async function canonicalizeServerProjectAssetBlob({ sourcePath, fileName, blob }) {
    const cached = getCachedCanonicalizedServerProjectAsset(sourcePath);
    if (cached) return cached;
    const content = await blob.arrayBuffer();
    const hashHex = await computeAssetContentHashHex(content);
    const relativePath = buildServerAssetRelativePath(hashHex, fileName || sourcePath || 'asset.glb');
    const cachedByHash = getCachedCanonicalizedServerProjectAsset(relativePath, `sha256:${hashHex}`);
    if (cachedByHash) {
        return rememberCanonicalizedServerProjectAsset(cachedByHash, sourcePath);
    }
    if (isServerMaterializedAssetPath(sourcePath) && String(sourcePath).toLowerCase() === relativePath.toLowerCase()) {
        return rememberCanonicalizedServerProjectAsset({
            path: relativePath,
            hash: hashHex,
            bytes: content.byteLength,
            content,
        }, sourcePath);
    }
    await projectApi.writeAsset({
        user: state.projectSession.user,
        projectId: state.projectSession.activeProjectId,
        relativePath,
        content,
    });
    return rememberCanonicalizedServerProjectAsset({
        path: relativePath,
        hash: hashHex,
        bytes: content.byteLength,
        content,
    }, sourcePath);
}

function clearAgentSceneInsertPreviewForContext(context = null) {
    const preview = agentSceneInsertPreview;
    if (!preview) return { loaded: 0, failed: 0 };
    if (context?.sessionId && preview.sessionId && preview.sessionId !== context.sessionId) {
        return { loaded: 0, failed: 0 };
    }
    if (context?.attemptId && preview.attemptId && preview.attemptId !== context.attemptId) {
        return { loaded: 0, failed: 0 };
    }
    const modelIds = Array.isArray(preview.modelIds) ? preview.modelIds : [];
    let removed = 0;
    for (const modelId of modelIds) {
        if (modelId && app?.removeModel?.(modelId)) {
            removed++;
        }
    }
    agentSceneInsertPreview = null;
    refreshCanonicalAssetReferenceState();
    if (removed > 0) {
        updateModelList();
    }
    return { loaded: removed, failed: 0 };
}

async function loadAgentSceneInsertPlanModels(plan) {
    if (!app) {
        throw new Error(t('messages.editorNotInitialized'));
    }
    if (!isServerProjectSessionActive()) {
        throw new Error(t('projectSession.loginRequired'));
    }
    const items = getAgentSceneInsertPlanItems(plan);
    if (items.length <= 0) {
        return { loaded: 0, failed: 0, modelIds: [] };
    }

    let loaded = 0;
    let failed = 0;
    const modelIds = [];
    const assetReferences = [];
    showLoading(true, t('loading.loadingSceneAssets', { current: 0, total: items.length }), 0);
    try {
        for (let i = 0; i < items.length; i++) {
            const item = items[i] || {};
            const sourcePath = String(item.path || item.modelPath || item.relativePath || '').trim();
            showLoading(true, t('loading.loadingSceneAssets', { current: i + 1, total: items.length }), ((i + 1) / items.length) * 100);
            if (!sourcePath) {
                failed++;
                continue;
            }
            try {
                const response = await fetch(projectApi.getAssetUrl(
                    state.projectSession.user,
                    state.projectSession.activeProjectId,
                    sourcePath,
                ));
                if (!response.ok) {
                    throw new Error(t('messages.urlAssetLoadFailed', { status: response.status }));
                }
                const blob = await response.blob();
                let targetName = sanitizeFileName(item.name || item.label || extractFileName(sourcePath));
                const sourceExtension = (extractFileName(sourcePath).match(/\.[^.]+$/)?.[0] || '').toLowerCase();
                if (sourceExtension && !targetName.toLowerCase().endsWith(sourceExtension)) {
                    targetName = sanitizeFileName(`${targetName}${sourceExtension}`);
                }
                const canonicalAsset = await canonicalizeServerProjectAssetBlob({
                    sourcePath,
                    fileName: targetName,
                    blob,
                });
                const fileForLoad = new File([canonicalAsset.content], targetName, {
                    type: blob.type || 'model/gltf-binary',
                    lastModified: Date.now(),
                });
                const transform = item.transform && typeof item.transform === 'object' ? item.transform : {};
                const useEmbeddedTransformPlacement = transform.scaleMode === 'embedded';
                const loadedModel = await app.loadModel(fileForLoad, {
                    sourcePath: canonicalAsset.path,
                    suppressLoadingOverlay: true,
                    normalizeEmbeddedTransform: useEmbeddedTransformPlacement,
                });
                if (!loadedModel) {
                    throw new Error(t('messages.loadModelFailed', { name: targetName }));
                }
                if (targetName && loadedModel.name !== targetName) {
                    app.renameModel?.(loadedModel.id, targetName, {
                        sourcePath: canonicalAsset.path,
                        sourceFile: fileForLoad,
                    });
                }
                const position = finiteNumberTuple(transform.position, 3, [0, 0, 0]);
                const embeddedPosition = useEmbeddedTransformPlacement
                    ? [
                        Number.isFinite(Number(loadedModel.position?.x)) ? Number(loadedModel.position.x) : 0,
                        Number.isFinite(Number(loadedModel.position?.y)) ? Number(loadedModel.position.y) : 0,
                        Number.isFinite(Number(loadedModel.position?.z)) ? Number(loadedModel.position.z) : 0,
                    ]
                    : [0, 0, 0];
                const finalPosition = [
                    position[0] + embeddedPosition[0],
                    position[1] + embeddedPosition[1],
                    position[2] + embeddedPosition[2],
                ];
                const rotation = finiteNumberTuple(transform.rotationEulerRad, 3, [0, 0, 0]);
                app.setModelPosition(loadedModel.id, finalPosition[0], finalPosition[1], finalPosition[2]);
                app.setModelRotation(loadedModel.id, rotation[0], rotation[1], rotation[2]);
                app.setModelScale(loadedModel.id, resolveAgentSceneInsertScale(loadedModel, transform));
                applyPreviewModeToAllModels(state.exportMode);
                modelIds.push(loadedModel.id);
                assetReferences.push({
                    assetId: `sha256:${canonicalAsset.hash}`,
                    hash: canonicalAsset.hash,
                    path: canonicalAsset.path,
                    bytes: canonicalAsset.bytes,
                    kind: 'model',
                    sourcePath,
                });
                loaded++;
            } catch (assetError) {
                failed++;
                console.warn(`[Editor ${state.VERSION}] agent scene insert asset failed:`, item, assetError);
            }
        }
    } finally {
        showLoading(false);
    }
    return { loaded, failed, modelIds, assetReferences };
}

async function createAgentSceneInsertPreview(context, plan) {
    clearAgentSceneInsertPreviewForContext(context);
    const result = await loadAgentSceneInsertPlanModels(plan);
    if (result.loaded > 0) {
        updateModelList();
    }
    if (result.loaded <= 0) {
        return result;
    }
    agentSceneInsertPreview = {
        sessionId: context?.sessionId || '',
        attemptId: context?.attemptId || '',
        stepKey: 'insert-scene',
        modelIds: result.modelIds,
        assetReferences: result.assetReferences,
        createdAt: new Date().toISOString(),
        loaded: result.loaded,
        failed: result.failed,
    };
    refreshCanonicalAssetReferenceState();
    return result;
}

function commitAgentSceneInsertPreview(context) {
    const preview = agentSceneInsertPreview;
    if (!preview) return null;
    if (context?.sessionId && preview.sessionId && preview.sessionId !== context.sessionId) return null;
    if (context?.attemptId && preview.attemptId && preview.attemptId !== context.attemptId) return null;
    const loaded = Array.isArray(preview.modelIds) ? preview.modelIds.length : 0;
    const failed = Number(preview.failed) || 0;
    agentSceneInsertPreview = null;
    refreshCanonicalAssetReferenceState();
    if (loaded > 0) {
        updateModelList();
        markWorkspaceDirty('agent-insert-scene');
    }
    return { loaded, failed };
}

async function applyAgentSceneInsertPlan(plan) {
    const result = await loadAgentSceneInsertPlanModels(plan);
    if (result.loaded > 0) {
        refreshCanonicalAssetReferenceState();
        updateModelList();
        markWorkspaceDirty('agent-insert-scene');
    }
    return { loaded: result.loaded, failed: result.failed };
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

function applySceneTimelineSnapshot(timeline, {
    demoSceneActive = false,
    syncGizmo = true,
} = {}) {
    let loadedTimelineKeyframes = [];
    let loadedTimelineFovKeyframes = [];
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
                positionStrength: DEFAULT_CAMERA_POSITION_TENSION,
                rotationStrength: DEFAULT_CAMERA_ROTATION_STRENGTH,
                timingStrength: DEFAULT_CAMERA_TIMING_STRENGTH,
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
        loadedTimelineFovKeyframes = Array.isArray(timeline.fovKeyframes)
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
        setTimelineFrame(demoSceneActive ? 0 : selectedFrame, {
            applyPose: true,
            syncSlider: true,
            syncGizmo,
        });
        updateTimelineUI();
        syncCameraSequenceVisualization();
    } else {
        applyCameraInterpolationSettings({
            positionMode: CAMERA_POSITION_INTERPOLATION_LINEAR,
            rotationMode: CAMERA_ROTATION_INTERPOLATION_SLERP,
            timingMode: CAMERA_TIMING_INTERPOLATION_LINEAR,
        }, { syncVisualization: false });
    }
    return {
        keyframes: loadedTimelineKeyframes,
        fovKeyframes: loadedTimelineFovKeyframes,
    };
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

function createEmptyCanonicalAssetReferenceSnapshot() {
    return {
        scene: new Set(),
        agent: new Set(),
        preview: new Set(),
        active: new Set(),
        all: new Set(),
    };
}

function createEmptyCanonicalAssetGcPlan() {
    return {
        disabled: true,
        reason: 'Conservative canonical asset GC is report-only until scene, Agent history, preview, and active run references are all authoritative.',
        referenced: new Set(),
        candidates: new Set(),
        deletable: new Set(),
    };
}

function addCanonicalAssetReference(snapshot, owner, relativePath) {
    const normalized = String(relativePath || '').trim().replace(/\\/g, '/');
    if (!isServerMaterializedAssetPath(normalized)) return;
    const ownerSet = snapshot?.[owner];
    if (ownerSet instanceof Set) {
        ownerSet.add(normalized);
    }
    snapshot?.all?.add?.(normalized);
}

function collectCanonicalAssetPathsFromValue(value, output = new Set(), seen = new WeakSet()) {
    if (!value) return output;
    if (typeof value === 'string') {
        if (isServerMaterializedAssetPath(value)) {
            output.add(value.trim().replace(/\\/g, '/'));
        }
        return output;
    }
    if (typeof value !== 'object') return output;
    if (seen.has(value)) return output;
    seen.add(value);
    if (Array.isArray(value)) {
        value.forEach((item) => collectCanonicalAssetPathsFromValue(item, output, seen));
        return output;
    }
    ['path', 'relativePath', 'assetPath', 'sourcePath', 'modelPath', 'previewPath', 'thumbnailPath', 'frontRenderPath'].forEach((key) => {
        collectCanonicalAssetPathsFromValue(value[key], output, seen);
    });
    ['assetReferences', 'canonicalAssetReferences', 'assets', 'images', 'items', 'metadata', 'source', 'extras', 'steps', 'blocks', 'attempts', 'workflows'].forEach((key) => {
        collectCanonicalAssetPathsFromValue(value[key], output, seen);
    });
    return output;
}

function collectCanonicalAssetReferences({
    scene = null,
    agentHistory = null,
    preview = agentSceneInsertPreview,
    activeSceneAssetPaths = state.projectSession?.activeProjectSceneAssetPaths,
    activeAgentAssetPaths = state.projectSession?.activeProjectAgentAssetPaths,
} = {}) {
    const snapshot = createEmptyCanonicalAssetReferenceSnapshot();
    const models = app?.getModels?.() || [];
    models.forEach((model) => {
        addCanonicalAssetReference(snapshot, 'scene', model?.sourcePath || model?.sourceFile?.name || model?.name || '');
    });
    collectCanonicalAssetPathsFromValue(scene).forEach((pathValue) => addCanonicalAssetReference(snapshot, 'scene', pathValue));
    collectCanonicalAssetPathsFromValue(agentHistory).forEach((pathValue) => addCanonicalAssetReference(snapshot, 'agent', pathValue));
    collectCanonicalAssetPathsFromValue(preview).forEach((pathValue) => addCanonicalAssetReference(snapshot, 'preview', pathValue));
    [activeSceneAssetPaths, activeAgentAssetPaths].forEach((paths) => {
        if (!(paths instanceof Set)) return;
        paths.forEach((pathValue) => addCanonicalAssetReference(snapshot, 'active', pathValue));
    });
    return snapshot;
}

function buildConservativeCanonicalAssetGcPlan({
    indexedAssets = new Set(),
    references = collectCanonicalAssetReferences(),
} = {}) {
    const referenced = references?.all instanceof Set ? new Set(references.all) : new Set();
    const candidates = new Set();
    if (indexedAssets instanceof Set) {
        indexedAssets.forEach((pathValue) => {
            const normalized = String(pathValue || '').trim().replace(/\\/g, '/');
            if (isServerMaterializedAssetPath(normalized) && !referenced.has(normalized)) {
                candidates.add(normalized);
            }
        });
    }
    return {
        ...createEmptyCanonicalAssetGcPlan(),
        referenced,
        candidates,
        deletable: new Set(),
    };
}

function refreshCanonicalAssetReferenceState({ scene, agentHistory, indexedAssets } = {}) {
    const references = collectCanonicalAssetReferences({ scene, agentHistory });
    const canonicalIndexedAssets = indexedAssets instanceof Set
        ? indexedAssets
        : mergeServerAssetPathSets(
            state.projectSession.activeProjectSceneAssetPaths,
            state.projectSession.activeProjectAgentAssetPaths,
        );
    state.projectSession.canonicalAssetReferences = references;
    state.projectSession.canonicalAssetGcPlan = buildConservativeCanonicalAssetGcPlan({
        indexedAssets: canonicalIndexedAssets,
        references,
    });
    return state.projectSession.canonicalAssetGcPlan;
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
        if (isServerAgentAssetPath(relativePath) || isServerMaterializedAssetPath(relativePath)) {
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
    refreshCanonicalAssetReferenceState({ scene, agentHistory });
}

function clearActiveServerProjectAssetCaches() {
    state.projectSession.activeProjectSceneAssetPaths = new Set();
    state.projectSession.activeProjectAgentAssetPaths = new Set();
    state.projectSession.canonicalAssetReferences = createEmptyCanonicalAssetReferenceSnapshot();
    state.projectSession.canonicalAssetGcPlan = createEmptyCanonicalAssetGcPlan();
}

function mergeServerAssetPathSets(...sets) {
    const merged = new Set();
    sets.forEach((paths) => {
        if (!(paths instanceof Set)) return;
        paths.forEach((value) => {
            const relativePath = String(value || '').trim();
            if (relativePath) {
                merged.add(relativePath);
            }
        });
    });
    return merged;
}

async function resolveServerProjectExistingAssetPaths({ user, projectId, fallbackScenePaths = new Set(), fallbackAgentPaths = new Set() } = {}) {
    const fallback = {
        scene: mergeServerAssetPathSets(fallbackScenePaths),
        agent: mergeServerAssetPathSets(fallbackAgentPaths),
    };
    if (!user || !projectId) {
        return fallback;
    }
    try {
        const index = await projectApi.loadAssetIndex(user, projectId);
        const indexedScenePaths = new Set(
            (Array.isArray(index?.scene) ? index.scene : [])
                .map((value) => String(value || '').trim())
                .filter((value) => isServerMaterializedAssetPath(value))
        );
        const indexedAgentPaths = new Set(
            (Array.isArray(index?.agent) ? index.agent : [])
                .map((value) => String(value || '').trim())
                .filter((value) => isServerAgentAssetPath(value))
        );
        return {
            scene: mergeServerAssetPathSets(fallback.scene, indexedScenePaths),
            agent: mergeServerAssetPathSets(fallback.agent, indexedAgentPaths),
        };
    } catch (error) {
        console.debug('[ProjectSync] resolveServerProjectExistingAssetPaths:error', {
            user,
            projectId,
            error: error?.message || String(error),
        });
        return fallback;
    }
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
    const legacyInterpolation = buildLegacyCameraInterpolationSnapshot();
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
        const candidateName = sanitizeFileName(model.name || extractFileName(sourcePath));
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

        const worldBounds = computeModelWorldBounds(model);
        if (worldBounds) {
            asset.extras = {
                ...(asset.extras || {}),
                visionarySceneInfo: {
                    ...(asset.extras?.visionarySceneInfo || {}),
                    coordinateSystem: 'visionary_y_up_xz_ground',
                    world_bbox_min: worldBounds.min,
                    world_bbox_max: worldBounds.max,
                    center_xyz: worldBounds.center,
                    referenceSize: worldBounds.size,
                    bounds_source: worldBounds.source,
                },
            };
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
                cameraPoseConvention: CAMERA_POSE_CONVENTION_TIMELINE_MINUS_Z,
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
                positionInterpolationStrength: Number(state.cameraCatmullTension ?? DEFAULT_CAMERA_POSITION_TENSION),
                rotationInterpolationStrength: Number(state.cameraRotationStrength ?? DEFAULT_CAMERA_ROTATION_STRENGTH),
                timingInterpolationStrength: Number(state.cameraEaseStrength ?? DEFAULT_CAMERA_TIMING_STRENGTH),
                catmullTension: Number(state.cameraCatmullTension ?? DEFAULT_CAMERA_POSITION_TENSION),
                easeStrength: Number(state.cameraEaseStrength ?? DEFAULT_CAMERA_TIMING_STRENGTH),
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
            const existingServerAssetPaths = await resolveServerProjectExistingAssetPaths({
                user: state.projectSession.user,
                projectId: state.projectSession.activeProjectId,
                fallbackScenePaths: state.projectSession.activeProjectSceneAssetPaths,
                fallbackAgentPaths: state.projectSession.activeProjectAgentAssetPaths,
            });
            const assetWrites = await uploadServerProjectAssets({
                user: state.projectSession.user,
                projectId: state.projectSession.activeProjectId,
                assetInputs,
                existingAssetPaths: existingServerAssetPaths.scene,
            });
            await uploadServerAgentHistoryAssets({
                user: state.projectSession.user,
                projectId: state.projectSession.activeProjectId,
                assetPayloads: agentExport.assetPayloads,
                existingAssetPaths: existingServerAssetPaths.agent,
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

        const loadedTimeline = applySceneTimelineSnapshot(timeline, { demoSceneActive });

        if (demoSceneActive) {
            setDemoSceneState(createDemoSceneState({
                folderName: folderHandle?.name || '',
                models: demoLoadedModels,
                keyframes: buildDemoKeyframeRevealQueue(loadedTimeline.keyframes),
            }));
        }
        restoreSavedCameraPose(raw?.env);

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
    const timeline = parseSceneTimeline(raw);
    if (typeof raw?.env?.cameraSequenceVisible === 'boolean') {
        setCameraSequenceVisibility(raw.env.cameraSequenceVisible, true);
    } else if (Array.isArray(timeline?.keyframes) && timeline.keyframes.length > 0) {
        setCameraSequenceVisibility(true, true);
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
    applySceneTimelineSnapshot(timeline);
    restoreSavedCameraPose(raw?.env);
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
        resetAgentCodexSessionBinding();
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
        void refreshProjectBrowserCodexAuthStatus();
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
        : nameInput === dom.projectCreateName
            ? dom.projectCreateNameError
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
        const existingServerAssetPaths = await resolveServerProjectExistingAssetPaths({
            user: state.projectSession.user,
            projectId: draftProject?.id,
        });
        const assetWrites = await uploadServerProjectAssets({
            user: state.projectSession.user,
            projectId: draftProject?.id,
            assetInputs,
            existingAssetPaths: existingServerAssetPaths.scene,
        });
        await uploadServerAgentHistoryAssets({
            user: state.projectSession.user,
            projectId: draftProject?.id,
            assetPayloads: agentExport.assetPayloads,
            existingAssetPaths: existingServerAssetPaths.agent,
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
        resetAgentCodexSessionBinding();
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
        void refreshProjectBrowserCodexAuthStatus();
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
        } else if (reopenModalOnError === 'project-create' && dom.projectCreateName) {
            openProjectCreateDialog();
            dom.projectCreateName.value = projectName;
        }
        const reopenedInput = reopenModalOnError === 'project-browser-saveas'
            ? dom.projectBrowserSaveAsName
            : reopenModalOnError === 'project-create'
                ? dom.projectCreateName
                : dom.projectSessionNewProjectName;
        const reopenedErrorElement = reopenModalOnError === 'project-browser-saveas'
            ? dom.projectBrowserSaveAsNameError
            : reopenModalOnError === 'project-create'
                ? dom.projectCreateNameError
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
    resetAgentCodexSessionBinding();
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

async function requestProjectSessionLogout() {
    if (!isServerProjectSessionActive() || !state.workspace?.dirty) {
        logoutProjectSession();
        return true;
    }

    const shouldSyncBeforeLogout = confirm(t('projectSession.logoutDirtyConfirm'));
    if (shouldSyncBeforeLogout) {
        const saved = await saveServerProjectToCurrentProject({ silent: true });
        if (!saved) {
            showError(t('projectSession.logoutDirtySyncFailed'));
            return false;
        }
    }

    logoutProjectSession();
    return true;
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

function cameraPositionSmoothnessToTension(value) {
    return 1 - clampCameraCatmullTension(value);
}

function cameraPositionTensionToSmoothness(value) {
    return 1 - clampCameraCatmullTension(value);
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
    const formatInterpolationValue = (config, value) => {
        if (typeof config?.format === 'function') {
            return config.format(Number(value) || 0);
        }
        return String(value);
    };
    const positionSmoothness = cameraPositionTensionToSmoothness(state.cameraCatmullTension);
    if (dom.timelineCatmullParam) {
        dom.timelineCatmullParam.min = String(catmullConfig.min ?? 0);
        dom.timelineCatmullParam.max = String(catmullConfig.max ?? 1);
        dom.timelineCatmullParam.step = String(catmullConfig.step ?? 0.01);
        dom.timelineCatmullParam.value = String(positionSmoothness);
    }
    if (dom.timelineCatmullParamValue) {
        dom.timelineCatmullParamValue.min = String(catmullConfig.min ?? 0);
        dom.timelineCatmullParamValue.max = String(catmullConfig.max ?? 1);
        dom.timelineCatmullParamValue.step = String(catmullConfig.step ?? 0.01);
        if (document.activeElement !== dom.timelineCatmullParamValue) {
            dom.timelineCatmullParamValue.value = formatInterpolationValue(catmullConfig, positionSmoothness);
        }
    }
    if (dom.timelineRotationParam) {
        dom.timelineRotationParam.min = String(rotationConfig.min ?? 0);
        dom.timelineRotationParam.max = String(rotationConfig.max ?? 1);
        dom.timelineRotationParam.step = String(rotationConfig.step ?? 0.01);
        dom.timelineRotationParam.value = String(state.cameraRotationStrength);
    }
    if (dom.timelineRotationParamValue) {
        dom.timelineRotationParamValue.min = String(rotationConfig.min ?? 0);
        dom.timelineRotationParamValue.max = String(rotationConfig.max ?? 1);
        dom.timelineRotationParamValue.step = String(rotationConfig.step ?? 0.01);
        if (document.activeElement !== dom.timelineRotationParamValue) {
            dom.timelineRotationParamValue.value = formatInterpolationValue(rotationConfig, state.cameraRotationStrength);
        }
    }
    if (dom.timelineEaseParam) {
        dom.timelineEaseParam.min = String(easeConfig.min ?? 0);
        dom.timelineEaseParam.max = String(easeConfig.max ?? 1);
        dom.timelineEaseParam.step = String(easeConfig.step ?? 0.01);
        dom.timelineEaseParam.value = String(state.cameraEaseStrength);
    }
    if (dom.timelineEaseParamValue) {
        dom.timelineEaseParamValue.min = String(easeConfig.min ?? 0);
        dom.timelineEaseParamValue.max = String(easeConfig.max ?? 1);
        dom.timelineEaseParamValue.step = String(easeConfig.step ?? 0.01);
        if (document.activeElement !== dom.timelineEaseParamValue) {
            dom.timelineEaseParamValue.value = formatInterpolationValue(easeConfig, state.cameraEaseStrength);
        }
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
    const smoothness = clampCameraCatmullTension(value);
    state.cameraCatmullTension = cameraPositionSmoothnessToTension(smoothness);
    syncCameraInterpolationControls();
    persistCameraInterpolationSettings();
    syncCameraSequenceVisualization();
    if (!silent) {
        showInfo(t('messages.parameterSet', {
            label: t('timeline.positionInterpolation'),
            value: smoothness.toFixed(2),
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

function parseCameraInterpolationNumberInputValue(value) {
    return extractNumericValue(value);
}

function commitCameraInterpolationNumberInput(rawValue, applyFn, currentValue, digits) {
    const parsed = parseCameraInterpolationNumberInputValue(rawValue);
    if (parsed === null) {
        return Number(currentValue).toFixed(digits);
    }
    applyFn(parsed, false);
    return null;
}

function handleCameraInterpolationInputArrowKey(e, inputEl, step, fallbackValue, digits, applyFn) {
    if (!(inputEl instanceof HTMLInputElement)) return;
    if (e.key !== 'ArrowUp' && e.key !== 'ArrowDown') return;

    e.preventDefault();
    const direction = e.key === 'ArrowUp' ? 1 : -1;
    const nextValue = nudgeNumericInputValue(inputEl.value, step, fallbackValue, direction);
    inputEl.value = nextValue.toFixed(digits);
    applyFn(nextValue, true);
}

function updateCameraPositionInterpolationFromInput() {
    const parsed = parseCameraInterpolationNumberInputValue(dom.timelineCatmullParamValue?.value);
    if (parsed === null) return;
    setCameraPositionInterpolationStrength(parsed, true);
}

function commitCameraPositionInterpolationFromInput() {
    if (!dom.timelineCatmullParamValue) return false;
    const fallbackValue = cameraPositionTensionToSmoothness(state.cameraCatmullTension);
    const nextText = commitCameraInterpolationNumberInput(
        dom.timelineCatmullParamValue.value,
        setCameraPositionInterpolationStrength,
        fallbackValue,
        2
    );
    if (nextText !== null) {
        dom.timelineCatmullParamValue.value = nextText;
        return false;
    }
    dom.timelineCatmullParamValue.value = cameraPositionTensionToSmoothness(state.cameraCatmullTension).toFixed(2);
    return true;
}

function handleCameraPositionInterpolationInputKeydown(e) {
    if (!dom.timelineCatmullParamValue) return;
    if (e.key === 'Enter') {
        commitCameraPositionInterpolationFromInput();
        dom.timelineCatmullParamValue.blur();
        return;
    }
    handleCameraInterpolationInputArrowKey(
        e,
        dom.timelineCatmullParamValue,
        0.01,
        cameraPositionTensionToSmoothness(state.cameraCatmullTension),
        2,
        setCameraPositionInterpolationStrength
    );
}

function updateCameraRotationInterpolationFromInput() {
    const parsed = parseCameraInterpolationNumberInputValue(dom.timelineRotationParamValue?.value);
    if (parsed === null) return;
    setCameraRotationStrength(parsed, true);
}

function commitCameraRotationInterpolationFromInput() {
    if (!dom.timelineRotationParamValue) return false;
    const nextText = commitCameraInterpolationNumberInput(
        dom.timelineRotationParamValue.value,
        setCameraRotationStrength,
        state.cameraRotationStrength,
        2
    );
    if (nextText !== null) {
        dom.timelineRotationParamValue.value = nextText;
        return false;
    }
    dom.timelineRotationParamValue.value = state.cameraRotationStrength.toFixed(2);
    return true;
}

function handleCameraRotationInterpolationInputKeydown(e) {
    if (!dom.timelineRotationParamValue) return;
    if (e.key === 'Enter') {
        commitCameraRotationInterpolationFromInput();
        dom.timelineRotationParamValue.blur();
        return;
    }
    handleCameraInterpolationInputArrowKey(
        e,
        dom.timelineRotationParamValue,
        0.01,
        state.cameraRotationStrength,
        2,
        setCameraRotationStrength
    );
}

function updateCameraTimingInterpolationFromInput() {
    const parsed = parseCameraInterpolationNumberInputValue(dom.timelineEaseParamValue?.value);
    if (parsed === null) return;
    setCameraTimingInterpolationStrength(parsed, true);
}

function commitCameraTimingInterpolationFromInput() {
    if (!dom.timelineEaseParamValue) return false;
    const nextText = commitCameraInterpolationNumberInput(
        dom.timelineEaseParamValue.value,
        setCameraTimingInterpolationStrength,
        state.cameraEaseStrength,
        2
    );
    if (nextText !== null) {
        dom.timelineEaseParamValue.value = nextText;
        return false;
    }
    dom.timelineEaseParamValue.value = state.cameraEaseStrength.toFixed(2);
    return true;
}

function handleCameraTimingInterpolationInputKeydown(e) {
    if (!dom.timelineEaseParamValue) return;
    if (e.key === 'Enter') {
        commitCameraTimingInterpolationFromInput();
        dom.timelineEaseParamValue.blur();
        return;
    }
    handleCameraInterpolationInputArrowKey(
        e,
        dom.timelineEaseParamValue,
        0.01,
        state.cameraEaseStrength,
        2,
        setCameraTimingInterpolationStrength
    );
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

function computeSquadTangent(prev, current, next, strength = 1) {
    const currentNorm = normalizeQuaternionValue(current);
    const prevAligned = alignQuaternionHemisphere(currentNorm, prev);
    const nextAligned = alignQuaternionHemisphere(currentNorm, next);
    const currentInverse = invertQuaternion(currentNorm);
    const prevDelta = multiplyQuaternions(currentInverse, prevAligned);
    const nextDelta = multiplyQuaternions(currentInverse, nextAligned);
    const prevLog = quaternionLogUnit(prevDelta);
    const nextLog = quaternionLogUnit(nextDelta);
    const strengthScale = clampCameraRotationStrength(strength);
    const omega = {
        x: -0.25 * strengthScale * (prevLog.x + nextLog.x),
        y: -0.25 * strengthScale * (prevLog.y + nextLog.y),
        z: -0.25 * strengthScale * (prevLog.z + nextLog.z),
    };
    return multiplyQuaternions(currentNorm, quaternionExpPure(omega));
}

function interpolateQuaternionSquad(prev, a, b, next, t, strength = state.cameraRotationStrength) {
    const start = normalizeQuaternionValue(a);
    const end = alignQuaternionHemisphere(start, b);
    const prevRef = prev ? alignQuaternionHemisphere(start, prev) : start;
    const nextRef = next ? alignQuaternionHemisphere(end, next) : end;
    const tangentA = computeSquadTangent(prevRef, start, end, strength);
    const tangentB = computeSquadTangent(start, end, nextRef, strength);
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

function restoreSavedCameraPose(env) {
    const pose = env?.cameraPose;
    if (!pose) return false;
    if (env?.cameraPoseConvention === CAMERA_POSE_CONVENTION_TIMELINE_MINUS_Z) {
        return Boolean(app.setCameraPose?.(pose));
    }
    if (typeof app.setCoreCameraPose === 'function') {
        return Boolean(app.setCoreCameraPose(pose));
    }
    return Boolean(app.setCameraPose?.(pose));
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
        positionInterpolationStrength: Number(state.cameraCatmullTension ?? DEFAULT_CAMERA_POSITION_TENSION),
        rotationInterpolationStrength: Number(state.cameraRotationStrength ?? DEFAULT_CAMERA_ROTATION_STRENGTH),
        timingInterpolationStrength: Number(state.cameraEaseStrength ?? DEFAULT_CAMERA_TIMING_STRENGTH),
        catmullTension: Number(state.cameraCatmullTension ?? DEFAULT_CAMERA_POSITION_TENSION),
        easeStrength: Number(state.cameraEaseStrength ?? DEFAULT_CAMERA_TIMING_STRENGTH),
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

function smootherstepQuintic(t) {
    if (t <= 0) return 0;
    if (t >= 1) return 1;
    return t * t * t * ((t * ((6 * t) - 15)) + 10);
}

function remapInterpolationTime(t, strength = state.cameraEaseStrength) {
    const clampedT = Math.max(0, Math.min(1, Number(t) || 0));
    const clampedStrength = Math.max(-1, Math.min(1, Number(strength) || 0));
    const strengthMagnitude = Math.abs(clampedStrength);
    const eased = smootherstepQuintic(clampedT);
    if (clampedStrength >= 0) {
        return lerpNumber(clampedT, eased, strengthMagnitude);
    }
    const accelerated = (2 * clampedT) - eased;
    return lerpNumber(clampedT, accelerated, strengthMagnitude);
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
    return interpolateQuaternionSquad(prev, a.camera.rotation, b.camera.rotation, next, t, squadStrength);
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
    state.timelinePlaybackSpeed = TIMELINE_PLAYBACK_SPEED_DEFAULT;
    if (dom.timelineSpeed) {
        dom.timelineSpeed.value = TIMELINE_PLAYBACK_SPEED_DEFAULT.toFixed(1);
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
    dom.agentWorkbenchModeTabs?.addEventListener('click', handleAgentWorkbenchModeClick);
    dom.agentWorkbenchCollapsedModeTabs?.addEventListener('click', handleAgentWorkbenchModeClick);
    dom.agentWorkflowTabs?.addEventListener('click', handleAgentWorkflowClick);
    dom.assetLibraryTabs?.addEventListener('click', handleAssetLibraryTabClick);
    dom.btnUserSession?.addEventListener('click', handleProjectSessionButtonClick);
    dom.btnCollapsedUserSession?.addEventListener('click', handleProjectSessionButtonClick);
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
        const deleteButton = event.target.closest?.('[data-project-delete]');
        if (deleteButton instanceof HTMLElement) {
            const projectId = String(deleteButton.dataset.projectDelete || '').trim();
            if (projectId) {
                void deleteProjectFromBrowser(projectId);
            }
            return;
        }
        const renameButton = event.target.closest?.('[data-project-rename-start]');
        if (renameButton instanceof HTMLElement) {
            const projectId = String(renameButton.dataset.projectRenameStart || '').trim();
            if (projectId) {
                startProjectRename(projectId);
            }
            return;
        }
        const button = event.target.closest?.('[data-project-open]');
        if (!(button instanceof HTMLElement)) return;
        const projectId = String(button.dataset.projectOpen || '').trim();
        if (!projectId) return;
        void openServerProject(projectId);
    });
    dom.projectBrowserProjectGrid?.addEventListener('input', (event) => {
        const input = event.target;
        if (!(input instanceof HTMLInputElement) || !input.dataset.projectRenameInput) return;
        state.projectSession.renamingProjectName = input.value;
        state.projectSession.renamingProjectError = '';
        input.classList.remove('has-error');
    });
    dom.projectBrowserProjectGrid?.addEventListener('keydown', (event) => {
        const input = event.target;
        if (!(input instanceof HTMLInputElement) || !input.dataset.projectRenameInput) return;
        if (event.key === 'Enter') {
            event.preventDefault();
            void commitProjectRename(input.dataset.projectRenameInput);
        } else if (event.key === 'Escape') {
            event.preventDefault();
            cancelProjectRename();
        }
    });
    dom.projectBrowserProjectGrid?.addEventListener('focusout', (event) => {
        const input = event.target;
        if (!(input instanceof HTMLInputElement) || !input.dataset.projectRenameInput) return;
        void commitProjectRename(input.dataset.projectRenameInput);
    });
    dom.btnProjectBrowserClose?.addEventListener('click', closeProjectBrowserModal);
    dom.btnProjectBrowserCreateNew?.addEventListener('click', openProjectCreateDialog);
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
    dom.btnProjectBrowserEditCodexAuth?.addEventListener('click', openProjectBrowserCodexAuthEditor);
    dom.btnProjectBrowserSaveCodexAuth?.addEventListener('mousedown', (event) => {
        event.preventDefault();
    });
    dom.btnProjectBrowserSaveCodexAuth?.addEventListener('click', () => {
        void saveProjectBrowserCodexAuth();
    });
    dom.projectBrowserCodexAuthKey?.addEventListener('keydown', (event) => {
        if (event.key !== 'Enter') return;
        event.preventDefault();
        void saveProjectBrowserCodexAuth();
    });
    dom.projectBrowserCodexAuthKey?.addEventListener('blur', () => {
        if (!state.projectSession.codexAuthEditing || state.projectSession.codexAuthSaving) return;
        closeProjectBrowserCodexAuthEditor();
    });
    dom.projectCreateName?.addEventListener('input', () => {
        clearProjectNameConflictState(dom.projectCreateName, dom.projectCreateNameError);
    });
    dom.btnProjectCreateClose?.addEventListener('click', closeProjectCreateDialog);
    dom.btnProjectCreateCancel?.addEventListener('click', closeProjectCreateDialog);
    dom.btnProjectCreateConfirm?.addEventListener('click', async () => {
        const saved = await createServerProjectFromCurrentScene({
            nameInput: dom.projectCreateName,
            closeModal: false,
            reopenModalOnError: 'project-create',
        });
        if (saved) {
            closeProjectCreateDialog();
        }
    });
    dom.btnProjectBrowserLogout?.addEventListener('click', () => {
        void requestProjectSessionLogout();
    });
    dom.btnAdminProjectClose?.addEventListener('click', closeAdminProjectModal);
    dom.btnAdminProjectLogout?.addEventListener('click', () => {
        void requestProjectSessionLogout();
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
    dom.agentMessageScroll?.addEventListener('scroll', () => {
        scheduleAgentMessageScrollbarSync({ measure: false });
    }, { passive: true });
    dom.agentMessageScrollbar?.addEventListener('mousedown', beginAgentMessageScrollbarDrag);
    dom.agentComposer?.addEventListener('submit', handleAgentComposerSubmit);
    dom.agentComposerSkillToolbar?.addEventListener('click', handleAgentComposerSkillToolbarClick);
    dom.agentComposerSkillTokens?.addEventListener('click', handleAgentComposerSkillTokenClick);
    dom.agentComposerInput?.addEventListener('input', handleAgentComposerInput);
    dom.agentComposerInput?.addEventListener('keydown', handleAgentComposerKeydown);
    dom.agentComposerInput?.addEventListener('focusin', handleAgentComposerFocusIn);
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
    dom.timelineRotationParamValue?.addEventListener('input', updateCameraRotationInterpolationFromInput);
    dom.timelineRotationParamValue?.addEventListener('change', commitCameraRotationInterpolationFromInput);
    dom.timelineRotationParamValue?.addEventListener('blur', commitCameraRotationInterpolationFromInput);
    dom.timelineRotationParamValue?.addEventListener('keydown', handleCameraRotationInterpolationInputKeydown);
    dom.timelineCatmullParam?.addEventListener('input', (e) => {
        setCameraPositionInterpolationStrength(e.target.value, true);
    });
    dom.timelineCatmullParam?.addEventListener('change', (e) => {
        setCameraPositionInterpolationStrength(e.target.value);
    });
    dom.timelineCatmullParamValue?.addEventListener('input', updateCameraPositionInterpolationFromInput);
    dom.timelineCatmullParamValue?.addEventListener('change', commitCameraPositionInterpolationFromInput);
    dom.timelineCatmullParamValue?.addEventListener('blur', commitCameraPositionInterpolationFromInput);
    dom.timelineCatmullParamValue?.addEventListener('keydown', handleCameraPositionInterpolationInputKeydown);
    dom.timelineEaseParam?.addEventListener('input', (e) => {
        setCameraTimingInterpolationStrength(e.target.value, true);
    });
    dom.timelineEaseParam?.addEventListener('change', (e) => {
        setCameraTimingInterpolationStrength(e.target.value);
    });
    dom.timelineEaseParamValue?.addEventListener('input', updateCameraTimingInterpolationFromInput);
    dom.timelineEaseParamValue?.addEventListener('change', commitCameraTimingInterpolationFromInput);
    dom.timelineEaseParamValue?.addEventListener('blur', commitCameraTimingInterpolationFromInput);
    dom.timelineEaseParamValue?.addEventListener('keydown', handleCameraTimingInterpolationInputKeydown);
    dom.cameraDisplayScale?.addEventListener('input', (e) => {
        setCameraSequenceDisplayScale(e.target.value, true);
    });
    dom.cameraDisplayScale?.addEventListener('change', (e) => {
        setCameraSequenceDisplayScale(e.target.value);
    });
    dom.cameraDisplayScaleValue?.addEventListener('input', updateCameraSequenceDisplayScaleFromInput);
    dom.cameraDisplayScaleValue?.addEventListener('change', commitCameraSequenceDisplayScaleFromInput);
    dom.cameraDisplayScaleValue?.addEventListener('blur', commitCameraSequenceDisplayScaleFromInput);
    dom.cameraDisplayScaleValue?.addEventListener('keydown', handleCameraSequenceDisplayScaleInputKeydown);
    dom.timelineCameraFovRange?.addEventListener('input', (e) => {
        applyTimelineCameraFov(e.target.value, true);
    });
    dom.timelineCameraFovRange?.addEventListener('change', (e) => {
        applyTimelineCameraFov(e.target.value);
    });
    dom.timelineCameraFovNumber?.addEventListener('input', updateTimelineCameraFovFromInput);
    dom.timelineCameraFovNumber?.addEventListener('change', commitTimelineCameraFovFromInput);
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
        if (e.key === 'Escape' && dom.projectCreateModal && !dom.projectCreateModal.classList.contains('hidden')) {
            closeProjectCreateDialog();
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
    setBootLoadingVisible(true);
    setBootLoadingStatus(t('loading.bootPreparing'));
    console.log(`[Editor ${state.VERSION}] Initializing...`);
    console.log(`[Editor ${state.VERSION}] Version: ${state.VERSION}`);
    console.log(`[Editor ${state.VERSION}] Checking DOM elements...`);

    // 更新版本标签
    if (dom.versionLabel) {
        dom.versionLabel.textContent = state.VERSION;
    }
    setBootLoadingStatus(t('loading.bootRestoringPreferences'));
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
    setBootLoadingStatus(t('loading.bootInitializingWorkbench'));
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
    setBootLoadingStatus(t('loading.bootLoadingEditorApp'));
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
    globalThis.visionaryDebugGizmo = (reason = 'manual') => app?.debugViewportGizmoState?.(reason);
    globalThis.__visionaryDebugGizmo = globalThis.visionaryDebugGizmo;

    // 初始化编辑器应用
    setBootLoadingStatus(t('loading.bootInitializingWebGpu'));
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
    setBootLoadingStatus(t('loading.bootConnectingEditor'));
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
        markWorkspaceDirty('canvas-camera-pose');
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
        if (!state.cameraSequenceDragEnabled) {
            state.cameraSequenceDragEnabled = true;
            app.setCameraSequenceEditEnabled?.(true);
        }
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
        syncCameraSequenceDragButton();
        syncCameraSequenceInteractionEnabled();
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
    setBootLoadingStatus(t('loading.bootFinalizingUi'));
    initEventListeners();
    initAgentMessageScrollbarObservers();
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
        scheduleAgentMessageScrollbarSync({ measure: true });
    });
    initSceneSettingsUI();
    initTimelineUI();
    closeEditor();
    syncSceneSettingsPanel();
    syncCameraPreviewPanel();
    syncViewportGizmoControls();
    syncAgentMessageScrollbar({ measure: true });
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
    console.log('');
    console.log('调试信息：');
    console.log('- 打开浏览器开发者工具查看控制台输出');
    console.log('- 如果有问题，请提供控制台错误信息');
    console.log('- 版本号：', state.VERSION);
    setBootLoadingVisible(false);
}

// 启动应用
document.addEventListener('DOMContentLoaded', init);
