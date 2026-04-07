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
    CAMERA_PREVIEW_ASPECT_OPTIONS,
    getCameraPreviewAspectOption,
    normalizeCameraPreviewAspectId,
} from './editor-camera-preview.js';
import {
    normalizeViewportGizmoModeForSelection,
    resolveViewportSelectionKind,
} from './editor-gizmo-selection.js';
import {
    resolveFloatingPanelPosition,
    resolveFloatingPanelLayerZIndices,
} from './editor-floating-panels.js';

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
    btnCameraSettingsClose: document.getElementById('btnCameraSettingsClose'),
    cameraSettingsPanel: document.getElementById('cameraSettingsPanel'),
    btnToggleCameraSequence: document.getElementById('btnToggleCameraSequence'),
    btnToggleCameraSequenceDrag: document.getElementById('btnToggleCameraSequenceDrag'),
    timelineCameraInterpolation: document.getElementById('timelineCameraInterpolation'),
    timelineInterpolationParamControl: document.getElementById('timelineInterpolationParamControl'),
    timelineInterpolationParamLabel: document.getElementById('timelineInterpolationParamLabel'),
    timelineInterpolationParam: document.getElementById('timelineInterpolationParam'),
    timelineInterpolationParamValue: document.getElementById('timelineInterpolationParamValue'),
    cameraDisplayScale: document.getElementById('cameraDisplayScale'),
    cameraDisplayScaleValue: document.getElementById('cameraDisplayScaleValue'),
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
    exportMode: document.getElementById('exportMode'),
    exportFov: document.getElementById('exportFov'),
    exportTimelineHint: document.getElementById('exportTimelineHint'),
    exportCancel: document.getElementById('exportCancel'),
    exportConfirm: document.getElementById('exportConfirm'),
    helpTipsModal: document.getElementById('helpTipsModal'),
    helpTipsClose: document.getElementById('helpTipsClose'),
    helpTipsConfirm: document.getElementById('helpTipsConfirm'),

    // 版本标签
    versionLabel: document.getElementById('versionLabel'),
};

// 应用状态
const state = {
    VERSION: '0.1.8',
    exportMode: 'color', // 'color' | 'depth' | 'normal'
    selectedModelId: null,
    cameraSequenceVisible: true,
    cameraSequenceDragEnabled: false,
    selectedCameraSequenceFrame: null,
    cameraMode: 'orbit',
    currentTime: 0,
    isPlaying: false,
    isLooping: false,
    keyframes: [],
    currentKeyframeIndex: -1,
    selectedFrame: 0,
    timelineFps: 24,
    timelinePlaybackSpeed: 1.0,
    cameraInterpolationMode: 'linear',
    cameraInterpolationParam: 0.5,
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
};

// EditorApp 实例 (会在 init 后设置)
let app = null;
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
let activeFloatingPanelKey = 'cameraPreview';
let keyframeMarkerDrag = null;
let suppressMarkerClickOnce = false;
let sidebarResizeState = null;
let agentWorkbenchResizeState = null;
let agentMessageScrollbarDragState = null;
let agentPreviewManagerPromise = null;
let agentMessageBottomPinRaf = 0;
let agentMessageBottomPinFramesRemaining = 0;
let agentSessionStore = null;
let agentSessionPersistTimer = 0;
let preferredLeftSidebarWidth = null;
let preferredRightSidebarWidth = null;
let preferredAgentWorkbenchWidth = null;
let sidebarWidthDebugHistory = [];
const agentSessionActionHandlers = {
    onCancel: null,
    onRetry: null,
    onApply: null,
};
const THEME_STORAGE_KEY = 'visionary_editor_theme';
const UI_LANGUAGE_STORAGE_KEY = 'visionary_editor_ui_language_v1';
const AGENT_WORKBENCH_WIDTH_STORAGE_KEY = 'visionary_editor_agent_workbench_width_v1';
const AGENT_WORKBENCH_COLLAPSED_STORAGE_KEY = 'visionary_editor_agent_workbench_collapsed_v1';
const AGENT_WORKBENCH_WORKFLOW_STORAGE_KEY = 'visionary_editor_agent_workbench_workflow_v1';
const AGENT_WORKBENCH_DEFAULT_WIDTH = 360;
const AGENT_WORKBENCH_MIN_WIDTH = 300;
const AGENT_WORKBENCH_MAX_WIDTH = 520;
const AGENT_WORKBENCH_COLLAPSED_WIDTH = 64;
const LEFT_SIDEBAR_WIDTH_STORAGE_KEY = 'visionary_editor_left_sidebar_width_v4';
const RIGHT_SIDEBAR_WIDTH_STORAGE_KEY = 'visionary_editor_right_sidebar_width';
const TIMELINE_FPS_OPTIONS = [12, 24, 30, 60];
const TIMELINE_MIN_DURATION_SEC = 10;
const TIMELINE_SLIDER_THUMB_PX = 16;
const EXPORT_FALLBACK_FPS = 24;
const CAMERA_INTERPOLATION_MODE_LINEAR = 'linear';
const CAMERA_INTERPOLATION_MODE_SQUAD = 'squad';
const CAMERA_INTERPOLATION_MODE_CATMULL = 'catmull';
const CAMERA_INTERPOLATION_MODE_EASE = 'ease';
const CAMERA_INTERPOLATION_PARAM_STORAGE_KEY = 'visionary_editor_camera_interpolation_param';
const CAMERA_INTERPOLATION_MODE_STORAGE_KEY = 'visionary_editor_camera_interpolation_mode';
const CAMERA_DISPLAY_SCALE_STORAGE_KEY = 'visionary_editor_camera_display_scale';
const CAMERA_PREVIEW_ASPECT_STORAGE_KEY = 'visionary_editor_camera_preview_aspect_ratio_v1';
const CAMERA_DISPLAY_SCALE_MIN = 0.25;
const CAMERA_DISPLAY_SCALE_MAX = 3.0;
const CAMERA_DISPLAY_SCALE_DEFAULT = 1.0;
const CAMERA_INTERPOLATION_CONFIGS = {
    [CAMERA_INTERPOLATION_MODE_LINEAR]: {
        get label() { return t('timeline.interpolationModes.linear'); },
        tunable: false,
        defaultParam: 0.5,
    },
    [CAMERA_INTERPOLATION_MODE_SQUAD]: {
        get label() { return t('timeline.interpolationModes.squad'); },
        tunable: false,
        defaultParam: 0.5,
    },
    [CAMERA_INTERPOLATION_MODE_CATMULL]: {
        get label() { return t('timeline.interpolationModes.catmull'); },
        tunable: true,
        get paramLabel() { return t('timeline.interpolationParams.catmull'); },
        min: 0,
        max: 1,
        step: 0.01,
        defaultParam: 0.35,
        format: (value) => value.toFixed(2),
    },
    [CAMERA_INTERPOLATION_MODE_EASE]: {
        get label() { return t('timeline.interpolationModes.ease'); },
        tunable: true,
        get paramLabel() { return t('timeline.interpolationParams.ease'); },
        min: 0,
        max: 1,
        step: 0.01,
        defaultParam: 0.65,
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
const EXPORT_PRESET_RESOLUTIONS = [
    { width: 1280, height: 720, label: '1280 x 720 (720p)' },
    { width: 1920, height: 1080, label: '1920 x 1080 (1080p)' },
    { width: 2560, height: 1440, label: '2560 x 1440 (2K)' },
    { width: 3840, height: 2160, label: '3840 x 2160 (4K)' },
];

const UI_TEXT = {
    zh: {
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
        },
        sceneSettings: {
            title: '场景设置',
            close: '收起设置',
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
            cameraPreview: '相机预览',
            cameraSettings: '相机设置',
            openCameraPreview: '打开相机预览',
            closeCameraPreview: '关闭相机预览',
            openCameraSettings: '打开相机设置',
            previewRatio: '比例',
            track: '轨迹',
            drag: '拖动',
            dragHint: '在自由视角下拖动相机关键帧',
            toggleSequenceVisibility: '切换相机序列可见性',
            size: '大小',
            interpolation: '插值',
            parameter: '参数',
            keyframes: '关键帧',
            cameraSequence: '相机序列',
            addKeyframe: '新增关键帧',
            removeKeyframe: '删除关键帧',
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
            renderMode: '渲染模式',
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
    },
    en: {
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
        },
        sceneSettings: {
            title: 'Scene Settings',
            close: 'Close settings',
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
            cameraPreview: 'Camera Preview',
            cameraSettings: 'Camera Settings',
            openCameraPreview: 'Open camera preview',
            closeCameraPreview: 'Close camera preview',
            openCameraSettings: 'Open camera settings',
            previewRatio: 'Aspect',
            track: 'Path',
            drag: 'Drag',
            dragHint: 'Drag camera keyframes in free camera mode',
            toggleSequenceVisibility: 'Toggle camera sequence visibility',
            size: 'Size',
            interpolation: 'Interpolation',
            parameter: 'Parameter',
            keyframes: 'Keyframes',
            cameraSequence: 'Camera sequence',
            addKeyframe: 'Add keyframe',
            removeKeyframe: 'Remove keyframe',
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
            renderMode: 'Render mode',
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

function setButtonTooltip(button, tooltip, ariaLabel = tooltip) {
    if (!button) return;
    button.title = tooltip;
    button.setAttribute('data-tooltip', tooltip);
    button.setAttribute('aria-label', ariaLabel);
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

    if (dom.loadingOverlay && dom.loadingOverlay.classList.contains('hidden')) {
        setElementText(dom.loadingOverlay.querySelector('.loading-text'), t('canvas.loading'));
    }
    setElementText(dom.noWebGPU?.querySelector('h2'), t('canvas.noWebgpuTitle'));
    const noWebGpuParagraphs = dom.noWebGPU?.querySelectorAll('p') || [];
    setElementText(noWebGpuParagraphs[0], t('canvas.noWebgpuIntro'));
    setElementText(noWebGpuParagraphs[1], t('canvas.noWebgpuBrowserHint'));
    const noWebGpuButton = dom.noWebGPU?.querySelector('a.button');
    setElementText(noWebGpuButton, t('canvas.noWebgpuCheck'));

    dom.agentWorkbench?.setAttribute('aria-label', t('agent.workbench'));
    dom.agentWorkflowTabs?.setAttribute('aria-label', t('agent.workflowTabs'));
    dom.agentMessageScroll?.setAttribute('aria-label', t('agent.messageHistory'));
    dom.agentComposerAttachments?.setAttribute('aria-label', t('agent.pendingImages'));
    if (dom.agentComposerInput) {
        dom.agentComposerInput.placeholder = t('agent.inputPlaceholder');
    }
    setButtonTooltip(dom.btnAgentAddImage, t('common.addImage'));
    setElementText(dom.btnAgentSend, t('common.send'));
    dom.agentWorkbenchResizer?.setAttribute('aria-label', t('agent.resizeAria'));
    document.querySelectorAll('.agent-workflow-tab').forEach((button) => {
        const workflowId = button.dataset.workflow;
        const label = AGENT_WORKFLOW_DEFS[workflowId]?.label || workflowId;
        const shortLabel = getAgentWorkflowShortLabel(workflowId);
        button.title = label;
        button.setAttribute('aria-label', label);
        setElementText(button.querySelector('.agent-workflow-label'), shortLabel);
    });

    setElementText(document.querySelector('#left-sidebar .sidebar-header h2'), t('sidebar.title'));
    setButtonTooltip(dom.btnAddModel, t('sidebar.loadModel'));
    setButtonTooltip(dom.btnLoadScene, t('sidebar.loadScene'));
    setButtonTooltip(dom.btnSaveScene, t('sidebar.saveScene'));
    setButtonTooltip(dom.btnClearScene, t('sidebar.clearScene'));
    setElementText(document.querySelector('#modelTransformSection .subsection-title'), t('sidebar.transform'));
    setButtonTooltip(dom.btnResetTransform, t('common.reset'));
    const transformLabels = dom.modelTransformSection?.querySelectorAll('.transform-property-row .property-label span') || [];
    setElementText(transformLabels[0], t('sidebar.position'));
    setElementText(transformLabels[1], t('sidebar.rotation'));
    setElementText(transformLabels[2], t('sidebar.scale'));
    setElementText(document.querySelector('#onnxAnimSection .subsection-title'), t('sidebar.animation'));
    setElementText(document.querySelector('#onnxAnimSection .property-label span'), t('sidebar.speed'));
    dom.modelAnimSpeedValue?.setAttribute('aria-label', t('sidebar.speed'));

    setElementText(document.querySelector('#sceneSettingsPanel .settings-card-header h3'), t('sceneSettings.title'));
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

    setElementText(document.querySelector('#bottom-timeline .timeline-header h2'), t('timeline.title'));
    setButtonTooltip(dom.btnToggleCameraPreview, t('timeline.openCameraPreview'), t('timeline.openCameraPreview'));
    setElementText(dom.btnToggleCameraPreview?.querySelector('.btn-text'), t('timeline.cameraPreview'));
    setButtonTooltip(dom.btnToggleCameraSettings, t('timeline.openCameraSettings'), t('timeline.openCameraSettings'));
    setElementText(dom.btnToggleCameraSettings?.querySelector('.btn-text'), t('timeline.cameraSettings'));
    setElementText(document.querySelector('#cameraPreviewPanel .settings-card-header h3'), t('timeline.cameraPreview'));
    setButtonTooltip(dom.btnCameraPreviewClose, t('timeline.closeCameraPreview'), t('timeline.closeCameraPreview'));
    setElementText(document.querySelector('#cameraPreviewPanel .property-label'), t('timeline.previewRatio'));
    setElementText(document.querySelector('#cameraSettingsPanel .settings-card-header h3'), t('timeline.cameraSettings'));
    setButtonTooltip(dom.btnCameraSettingsClose, t('sceneSettings.close'), t('sceneSettings.close'));
    const cameraSettingLabels = dom.cameraSettingsPanel?.querySelectorAll('.property-row .property-label') || [];
    setElementText(cameraSettingLabels[0], t('timeline.track'));
    setElementText(cameraSettingLabels[1], t('timeline.size'));
    setElementText(cameraSettingLabels[2], t('timeline.interpolation'));
    setElementText(dom.timelineInterpolationParamLabel, t('timeline.parameter'));
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
    setElementText(document.querySelector('.timeline-header-right .timeline-fps-control:first-child label'), t('timeline.speed'));
    setElementText(document.querySelector('.timeline-placeholder .placeholder-text'), t('timeline.placeholder'));
    const interpolationOptions = dom.timelineCameraInterpolation?.options || [];
    if (interpolationOptions[0]) interpolationOptions[0].textContent = t('timeline.interpolationModes.linear');
    if (interpolationOptions[1]) interpolationOptions[1].textContent = t('timeline.interpolationModes.squad');
    if (interpolationOptions[2]) interpolationOptions[2].textContent = t('timeline.interpolationModes.catmull');
    if (interpolationOptions[3]) interpolationOptions[3].textContent = t('timeline.interpolationModes.ease');

    setElementText(dom.modelModal?.querySelector('h3'), t('modal.modelTitle'));
    setElementText(dom.modelModal?.querySelector('.modal-body p'), t('modal.modelHint'));
    setElementText(dom.modalCancel, t('common.cancel'));
    setElementText(dom.modalConfirm, t('common.confirm'));
    if (!pendingExportType) {
        setElementText(dom.exportModalTitle, t('modal.exportTitle'));
    }
    setElementText(document.querySelector('label[for="exportResolution"]'), t('modal.resolution'));
    setElementText(document.querySelector('label[for="exportMode"]'), t('modal.renderMode'));
    const exportModeOptions = dom.exportMode?.options || [];
    if (exportModeOptions[0]) exportModeOptions[0].textContent = t('sceneSettings.renderModes.color');
    if (exportModeOptions[1]) exportModeOptions[1].textContent = t('sceneSettings.renderModes.depth');
    if (exportModeOptions[2]) exportModeOptions[2].textContent = t('sceneSettings.renderModes.normal');
    setElementText(dom.exportCancel, t('common.cancel'));

    setElementText(document.querySelector('#helpTipsModal h3'), t('modal.helpTitle'));
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
    setElementText(dom.helpTipsConfirm, t('modal.gotIt'));
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

function buildAgentConversationSnapshot() {
    return {
        version: 1,
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

async function persistAgentConversationsNow() {
    const store = ensureAgentSessionStore();
    if (!store.getStatus().enabled) return null;
    return store.persistSnapshot(buildAgentConversationSnapshot());
}

function schedulePersistAgentConversations() {
    window.clearTimeout(agentSessionPersistTimer);
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
                message.text = String(errorText ?? (state.uiLanguage === 'en' ? 'Agent execution failed' : 'Agent 执行失败'));
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
                    text: String(errorText ?? (state.uiLanguage === 'en' ? 'Agent execution failed' : 'Agent 执行失败')),
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
    ctx.fillText(state.uiLanguage === 'en' ? 'Agent preview placeholder' : 'Agent 生成预览占位', 48, 124);

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

function renderAgentAttachments(attachments) {
    if (!Array.isArray(attachments) || attachments.length === 0) return '';
    return `
        <div class="agent-message-attachments">
            ${attachments.map((attachment) => `
                <div class="agent-message-attachment">
                    <div class="agent-message-attachment-frame"></div>
                    <span class="agent-message-attachment-label">${escapeHtml(attachment.name)}</span>
                </div>
            `).join('')}
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
    dom.agentMessageList.querySelectorAll('.agent-image-frame.is-ready img').forEach((img) => {
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
    requestAnimationFrame(syncAgentMessageScrollbar);
}

function applyAgentWorkbenchWidth(width, persist = true) {
    preferredAgentWorkbenchWidth = clampAgentWorkbenchWidth(width);
    document.documentElement.style.setProperty('--agent-workbench-width', `${preferredAgentWorkbenchWidth}px`);
    if (persist) {
        localStorage.setItem(AGENT_WORKBENCH_WIDTH_STORAGE_KEY, String(preferredAgentWorkbenchWidth));
    }
    syncAgentWorkbenchLayoutVars();
    syncCanvasContainerToViewport();
    requestAnimationFrame(syncAgentMessageScrollbar);
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
            showError(`Agent 操作失败: ${error?.message || String(error)}`);
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
        showInfo(`已添加 ${count} 张图片到输入区`);
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
        showInfo(`已添加 ${count} 张图片到输入区`);
    }
    input.value = '';
}

function simulateProgressUpdates(handle, blockId, updates, onDone) {
    const runStep = (index) => {
        const step = updates[index];
        if (!step) {
            onDone?.();
            return;
        }
        window.setTimeout(() => {
            handle.patchBlock(blockId, step.patch);
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
        handle.updateText(workflow.reply(prompt));
        handle.finish();
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
        const retryPrompt = session.prompt || activeAttempt?.text || (state.uiLanguage === 'en' ? 'Retry request' : '重试任务');
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
    const attachmentFallback = state.uiLanguage === 'en' ? 'Image input' : '图片输入';

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

function beginAgentWorkbenchResize(event) {
    if (event.button !== 0 || state.agentWorkbenchCollapsed) return;
    agentWorkbenchResizeState = {
        startX: event.clientX,
        width: preferredAgentWorkbenchWidth ?? AGENT_WORKBENCH_DEFAULT_WIDTH,
    };
    dom.agentWorkbenchResizer?.classList.add('is-active');
    document.body.classList.add('sidebar-resizing');
    window.addEventListener('mousemove', onAgentWorkbenchResizeMove);
    window.addEventListener('mouseup', endAgentWorkbenchResize);
    window.addEventListener('blur', endAgentWorkbenchResize);
    event.preventDefault();
}

function onAgentWorkbenchResizeMove(event) {
    if (!agentWorkbenchResizeState) return;
    const deltaX = event.clientX - agentWorkbenchResizeState.startX;
    applyAgentWorkbenchWidth(agentWorkbenchResizeState.width + deltaX, true);
    event.preventDefault();
}

function endAgentWorkbenchResize() {
    if (!agentWorkbenchResizeState) return;
    agentWorkbenchResizeState = null;
    dom.agentWorkbenchResizer?.classList.remove('is-active');
    document.body.classList.remove('sidebar-resizing');
    window.removeEventListener('mousemove', onAgentWorkbenchResizeMove);
    window.removeEventListener('mouseup', endAgentWorkbenchResize);
    window.removeEventListener('blur', endAgentWorkbenchResize);
}

function initializeAgentWorkbench() {
    const savedWidth = localStorage.getItem(AGENT_WORKBENCH_WIDTH_STORAGE_KEY);
    const savedCollapsed = localStorage.getItem(AGENT_WORKBENCH_COLLAPSED_STORAGE_KEY);
    const savedWorkflow = localStorage.getItem(AGENT_WORKBENCH_WORKFLOW_STORAGE_KEY);

    preferredAgentWorkbenchWidth = clampAgentWorkbenchWidth(savedWidth);
    if (savedWorkflow && AGENT_WORKFLOW_DEFS[savedWorkflow]) {
        state.agentWorkflow = savedWorkflow;
    }
    state.agentWorkbenchCollapsed = savedCollapsed === 'true';
    setCurrentAgentWorkflowThread(state.agentWorkflow);

    applyAgentWorkbenchWidth(preferredAgentWorkbenchWidth, false);
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
    console.log('[Editor Sidebar Width]', debugEntry);

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

    dom.canvasContainer.style.left = `${Math.round(viewportRect.left - hostLeft)}px`;
    dom.canvasContainer.style.top = `${Math.round(viewportRect.top - hostTop)}px`;
    dom.canvasContainer.style.width = `${width}px`;
    dom.canvasContainer.style.height = `${height}px`;
    dom.canvasContainer.style.right = 'auto';
    dom.canvasContainer.style.bottom = 'auto';

    app?.refreshViewportLayout?.();
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
        showError('深度倍率格式错误');
        return;
    }

    const ok = app?.setSceneDepthRangeScale?.(safe);
    if (!ok) {
        showError('设置深度倍率失败');
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
        showInfo(`深度倍率: ${state.sceneDepthRangeScale.toFixed(3)}x`);
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

function syncSceneFovInputs() {
    const fixed = Number(state.sceneCameraFov || 45).toFixed(3);
    if (dom.sceneFovRange) dom.sceneFovRange.value = fixed;
    if (dom.sceneFovNumber) dom.sceneFovNumber.value = fixed;
}

function applySceneCameraFov(value, silent = false) {
    const safe = clampSceneFov(value);
    if (safe === null) {
        showError('FOV 格式错误');
        return;
    }

    const ok = app?.setSceneCameraFovDegrees?.(safe);
    if (!ok) {
        showError('设置 FOV 失败');
        return;
    }

    state.sceneCameraFov = safe;
    syncSceneFovInputs();
    if (state.keyframes.length === 0) {
        syncTimelineDrivenCameraPreviewPose();
    }
    if (!silent) {
        showInfo(`FOV: ${safe.toFixed(3)}°`);
    }
}

function applySceneBackgroundHex(hex, skyPresetId = 'custom') {
    const normalized = normalizeHexColor(hex);
    if (!normalized) {
        showError('背景色格式错误，请使用 #RRGGBB');
        return;
    }

    const ok = app?.setSceneBackgroundColorHex?.(normalized);
    if (!ok) {
        showError('设置背景色失败');
        return;
    }

    state.sceneBackgroundHex = normalized;
    state.sceneSkyPresetId = skyPresetId;
    syncAgentWorkbenchSceneBackground();
    syncSceneBackgroundInputs();
    renderSkyPresetGrid();
}

function applySkyPreset(presetId) {
    if (!app) return;
    const preset = app.applySceneSkyPreset?.(presetId);
    if (!preset) {
        showError(`天空球预设不存在: ${presetId}`);
        return;
    }

    state.sceneSkyPresetId = preset.id;
    state.sceneBackgroundHex = normalizeHexColor(preset.colorHex) || '#000000';
    syncAgentWorkbenchSceneBackground();
    syncSceneBackgroundInputs();
    renderSkyPresetGrid();
    showInfo(`天空球预设: ${preset.name}`);
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
    renderSkyPresetGrid();
}

function setModelEditorActive(active) {
    dom.modelSettingsCard?.classList.toggle('inactive', !active);
    syncViewportGizmoControls();
}

function syncViewportGizmoControls() {
    const selectionKind = resolveViewportSelectionKind({
        cameraSequenceDragEnabled: state.cameraSequenceDragEnabled,
        selectedCameraSequenceFrame: state.selectedCameraSequenceFrame,
        selectedModelId: state.selectedModelId,
    });
    const cameraSelectionActive = selectionKind === 'camera';
    const buttons = [
        [dom.btnGizmoTranslate, 'translate'],
        [dom.btnGizmoRotate, 'rotate'],
        [dom.btnGizmoScale, 'scale'],
    ];
    for (const [button, mode] of buttons) {
        if (!button) continue;
        const disabled = !app || (mode === 'scale' && cameraSelectionActive);
        button.disabled = disabled;
        button.classList.toggle('active', !disabled && state.viewportGizmoMode === mode);
    }
}

function setViewportGizmoMode(mode, silent = false) {
    if (!app) return false;
    const nextMode = state.viewportGizmoMode === mode ? null : mode;
    const selectionKind = resolveViewportSelectionKind({
        cameraSequenceDragEnabled: state.cameraSequenceDragEnabled,
        selectedCameraSequenceFrame: state.selectedCameraSequenceFrame,
        selectedModelId: state.selectedModelId,
    });
    if (nextMode === 'scale' && selectionKind === 'camera') {
        if (!silent) {
            showInfo('相机关键帧仅支持移动和旋转');
        }
        return false;
    }
    if (!app.setViewportGizmoMode?.(nextMode)) {
        return false;
    }
    state.viewportGizmoMode = nextMode;
    syncViewportGizmoControls();
    if (!silent) {
        const labels = { translate: '移动', rotate: '旋转', scale: '缩放' };
        showInfo(nextMode ? `视口控件: ${labels[nextMode] || nextMode}` : '视口控件: 已关闭');
    }
    return true;
}

function isFreeCameraMode() {
    if (!dom.cameraMode) {
        return true;
    }
    return state.cameraMode === 'fps';
}

function syncCameraSequenceDragButton() {
    if (!dom.btnToggleCameraSequenceDrag) return;
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

function syncManualTimelineCameraSelection(frame) {
    const safeFrame = clampTimelineFrame(frame);
    if (!state.cameraSequenceDragEnabled) {
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

function setCameraSequenceDragEnabled(enabled, silent = false) {
    if (!app?.setCameraSequenceEditEnabled) return false;
    const nextEnabled = Boolean(enabled);
    if (nextEnabled && !isFreeCameraMode()) {
        if (!silent) {
            showInfo('请先切换到自由视角');
        }
        return false;
    }
    if (!app.setCameraSequenceEditEnabled(nextEnabled)) {
        return false;
    }
    state.cameraSequenceDragEnabled = nextEnabled;
    if (!nextEnabled) {
        state.selectedCameraSequenceFrame = null;
        syncSelectedCameraSequenceFrameToApp();
    }
    state.viewportGizmoMode = normalizeViewportGizmoModeForSelection(
        state.viewportGizmoMode,
        resolveViewportSelectionKind({
            cameraSequenceDragEnabled: state.cameraSequenceDragEnabled,
            selectedCameraSequenceFrame: state.selectedCameraSequenceFrame,
            selectedModelId: state.selectedModelId,
        })
    );
    syncCameraSequenceDragButton();
    syncCameraSequenceVisualization();
    syncViewportGizmoControls();
    if (!silent) {
        showInfo(nextEnabled ? '相机关键帧拖动: 已开启' : '相机关键帧拖动: 已关闭');
    }
    return true;
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
}

function positionCameraPreviewPanel() {
    if (!dom.cameraPreviewPanel || !dom.editorStage) return;
    let left = Number.parseFloat(dom.cameraPreviewPanel.style.left || '');
    let top = Number.parseFloat(dom.cameraPreviewPanel.style.top || '');

    if (!Number.isFinite(left) || !Number.isFinite(top)) {
        const position = resolveFloatingPanelPosition({
            shellRect: dom.editorStage.getBoundingClientRect(),
            anchorRect: dom.btnToggleCameraPreview?.getBoundingClientRect(),
            panelWidth: dom.cameraPreviewPanel.offsetWidth || 320,
            panelHeight: dom.cameraPreviewPanel.offsetHeight || 0,
            viewportWidth: window.innerWidth,
            viewportHeight: window.innerHeight,
        });
        left = position.left;
        top = position.top;
    }

    const panelRect = dom.cameraPreviewPanel.getBoundingClientRect();
    const margin = 12;
    const shellRect = dom.editorStage.getBoundingClientRect();
    const minLeft = Math.max(margin, shellRect.left + margin);
    const maxLeft = Math.max(minLeft, Math.min(window.innerWidth - margin - panelRect.width, shellRect.right - margin - panelRect.width));
    const maxTop = Math.max(margin, window.innerHeight - margin - panelRect.height);
    dom.cameraPreviewPanel.style.left = `${Math.max(minLeft, Math.min(maxLeft, left))}px`;
    dom.cameraPreviewPanel.style.top = `${Math.max(margin, Math.min(maxTop, top))}px`;
}

function syncCameraPreviewPanel() {
    dom.cameraPreviewPanel?.classList.toggle('hidden', !state.cameraPreviewOpen);
    dom.btnToggleCameraPreview?.classList.toggle('active', state.cameraPreviewOpen);
    app?.setCameraPreviewVisible?.(state.cameraPreviewOpen);
    syncFloatingPanelLayerOrder();
    if (state.cameraPreviewOpen) {
        syncTimelineDrivenCameraPreviewPose();
        requestAnimationFrame(positionCameraPreviewPanel);
    }
}

function setCameraPreviewOpen(open) {
    state.cameraPreviewOpen = Boolean(open);
    if (state.cameraPreviewOpen) {
        activeFloatingPanelKey = 'cameraPreview';
    }
    syncCameraPreviewPanel();
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
    if (!silent) {
        showInfo(`相机预览比例: ${option.label}`);
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
    const maxLeft = Math.max(margin, window.innerWidth - margin - rect.width);
    const maxTop = Math.max(margin, window.innerHeight - margin - rect.height);
    dom.cameraPreviewPanel.style.left = `${Math.max(margin, Math.min(maxLeft, nextLeft))}px`;
    dom.cameraPreviewPanel.style.top = `${Math.max(margin, Math.min(maxTop, nextTop))}px`;
}

function endCameraPreviewPanelDrag() {
    cameraPreviewDragState = null;
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
function showLoading(show, text = t('loading.default'), progress = 0) {
    if (dom.loadingOverlay) {
        if (show) {
            dom.loadingOverlay.classList.remove('hidden');
            const loadingText = dom.loadingOverlay.querySelector('.loading-text');
            if (loadingText) loadingText.textContent = text;
            if (dom.progressFill) dom.progressFill.style.width = `${progress}%`;
            if (dom.progressText) dom.progressText.textContent = `${Math.round(progress)}%`;
        } else {
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
        showError(state.uiLanguage === 'en' ? 'Failed to set camera sequence visibility' : '设置相机序列可见性失败');
        return false;
    }
    state.cameraSequenceVisible = safe;
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
        dom.cameraDisplayScaleValue.textContent = state.cameraSequenceDisplayScale.toFixed(2);
    }
}

function setCameraSequenceDisplayScale(value, silent = false) {
    const safe = clampCameraSequenceDisplayScale(value);
    const ok = app?.setCameraSequenceDisplayScale?.(safe);
    if (ok === false) {
        showError(state.uiLanguage === 'en' ? 'Failed to set camera display size' : '设置相机显示大小失败');
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
                showInfo(`模型可见性: ${nextVisible ? '可见' : '隐藏'}`);
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
            showInfo('已取消选中模型');
        }
        return;
    }
    const model = app.getModel(id);
    if (!model) return;

    const preservedFrame = clampTimelineFrame(state.selectedFrame);
    state.selectedModelId = id;
    if (syncAppSelection) {
        syncingSelectedModelSelection = true;
        try {
            app.setSelectedModel?.(id);
        } finally {
            syncingSelectedModelSelection = false;
        }
    }
    state.selectedCameraSequenceFrame = null;
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
        showInfo(`选中模型: ${model.name}`);
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

    if (!isInputLabelDragging) {
        showInfo('模型已更新');
    }
}

/**
 * 重置模型变换
 */
function resetTransform() {
    if (!state.selectedModelId || !app) return;
    app.resetModelTransform(state.selectedModelId);
    app.setSelectedModel?.(state.selectedModelId);
    const model = app.getModel(state.selectedModelId);
    if (model) {
        updateEditorValues(model);
    }
    showInfo('变换已重置');
}

/**
 * 关闭模型编辑器
 */
function closeEditor() {
    if (dom.selectedModelName) dom.selectedModelName.textContent = '未选中模型';
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
        showError(`切换渲染模式失败: ${mode}`);
        return;
    }

    const labelMap = { color: '颜色', depth: '深度图', normal: '法向图' };
    if (!silent) {
        showInfo(`显示模式: ${labelMap[mode] || mode}`);
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

function getExportModeLabel(mode) {
    const labels = {
        color: t('sceneSettings.renderModes.color'),
        depth: t('sceneSettings.renderModes.depth'),
        normal: t('sceneSettings.renderModes.normal'),
    };
    return labels[mode] || mode;
}

function updateExportTimelineHint(type) {
    if (!dom.exportTimelineHint) return;
    if (type !== 'video') {
        dom.exportTimelineHint.textContent = t('modal.exportCurrentFrame');
        return;
    }
    const fps = Math.max(1, Number(state.timelineFps || EXPORT_FALLBACK_FPS));
    const totalFrames = Math.max(1, getTimelineTotalFrames() + 1);
    const duration = frameToTime(getTimelineTotalFrames());
    const keyframes = state.keyframes.length;
    dom.exportTimelineHint.textContent = t('modal.exportTimeline', {
        duration: duration.toFixed(3),
        fps,
        frames: totalFrames,
        keyframes,
    });
}

function buildExportResolutionOptions() {
    if (!dom.exportResolution) return;

    const options = [];
    const seen = new Set();
    const current = getViewportResolution();
    const currentValue = resolutionToValue(current.width, current.height);
    options.push({ value: currentValue, label: `${current.width} x ${current.height} (${t('common.currentWindow')})` });
    seen.add(currentValue);

    for (const preset of EXPORT_PRESET_RESOLUTIONS) {
        const value = resolutionToValue(preset.width, preset.height);
        if (seen.has(value)) continue;
        seen.add(value);
        options.push({ value, label: preset.label });
    }

    dom.exportResolution.innerHTML = options
        .map((opt) => `<option value="${opt.value}">${opt.label}</option>`)
        .join('');
    dom.exportResolution.value = currentValue;
}

function setExportModalBusy(busy) {
    if (dom.exportResolution) dom.exportResolution.disabled = busy;
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
        showError(state.uiLanguage === 'en' ? 'Export dialog is not initialized' : '导出弹窗未初始化');
        return;
    }
    if (!app) {
        showError(state.uiLanguage === 'en' ? 'Editor is not initialized, cannot export' : '编辑器尚未初始化，无法导出');
        return;
    }

    pendingExportType = type === 'video' ? 'video' : 'image';
    buildExportResolutionOptions();

    if (dom.exportMode) {
        dom.exportMode.value = state.exportMode;
    }
    if (dom.exportFov) {
        dom.exportFov.value = Number(state.sceneCameraFov || 45).toFixed(3);
    }

    dom.exportModalTitle.textContent = pendingExportType === 'video' ? t('modal.exportVideoTitle') : t('modal.exportImageTitle');
    updateExportTimelineHint(pendingExportType);
    setExportModalBusy(false);
    dom.exportModal.classList.remove('hidden');
}

function readExportOptionsFromModal() {
    const resolution = parseResolutionValue(dom.exportResolution?.value || '');
    if (!resolution) {
        throw new Error('分辨率格式错误');
    }

    const mode = String(dom.exportMode?.value || state.exportMode);
    if (!['color', 'depth', 'normal'].includes(mode)) {
        throw new Error(`渲染模式无效: ${mode}`);
    }

    const fov = clampSceneFov(dom.exportFov?.value);
    if (fov === null) {
        throw new Error('FOV 格式错误');
    }

    return { resolution, mode, fov };
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

function applySnapshotToRecordingCamera(recordingCamera, snapshot, fovOverride) {
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
    recordingCamera.camera.aspect = Math.max(1e-6, Number(snapshot.aspect || 1));
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
            throw new Error(`切换渲染模式失败: ${mode}`);
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

async function withTemporaryCameraSequenceHidden(fn) {
    const previousVisible = syncCameraSequenceVisibilityState();
    if (previousVisible) {
        setCameraSequenceVisibility(false, true);
    }
    try {
        return await fn();
    } finally {
        if (previousVisible) {
            setCameraSequenceVisibility(true, true);
        }
    }
}

function buildExportTimelineController(recordingCamera, exportFov) {
    const callbacks = new Set();
    const maxFrame = Math.max(0, getTimelineTotalFrames());
    const totalFrames = Math.max(1, maxFrame + 1);
    let currentIndex = 0;

    return {
        getTotalFrames() {
            return totalFrames;
        },
        getFrameRate() {
            return Math.max(1, Number(state.timelineFps || EXPORT_FALLBACK_FPS));
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
            return Math.min(maxFrame, Math.max(-1, max));
        },
        async setFrameIndex(frameIndex) {
            const safeFrame = Math.max(0, Math.min(maxFrame, Math.round(Number(frameIndex) || 0)));
            currentIndex = safeFrame;
            setTimelineFrame(safeFrame, { applyPose: true, syncSlider: true });
            const snapshot = app?.getRenderCameraSnapshot?.();
            if (snapshot) {
                applySnapshotToRecordingCamera(recordingCamera, snapshot, exportFov);
            }
            for (const callback of Array.from(callbacks)) {
                await callback();
            }
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
            reject(new Error('无法导出图片数据'));
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
        throw new Error('渲染上下文不可用，无法导出图片');
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
            throw new Error('录制相机初始化失败');
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
        throw new Error('请先在时间轴添加至少 1 个相机关键帧');
    }

    const { RecordingCamera, exportVideoWithRecordingCamera } = await ensureVideoExportApiLoaded();
    const renderer = app?.getMeshRenderer?.();
    const scene = app?.getMeshScene?.();
    const fusedRenderer = app?.getFusedRenderer?.();
    const cameraSnapshot = app?.getRenderCameraSnapshot?.();

    if (!renderer || !scene || !cameraSnapshot) {
        throw new Error('渲染上下文不可用，无法导出视频');
    }

    const recordingCamera = new RecordingCamera(
        `editor_export_video_${Date.now().toString(36)}`,
        options.resolution.width,
        options.resolution.height,
        options.fov,
        false,
        'EditorExportVideo'
    );

    const restoreFrame = Number(state.selectedFrame || 0);
    const wasPlaying = Boolean(state.isPlaying);
    if (state.isPlaying) {
        stopTimelinePlayback(false);
    }

    try {
        recordingCamera.setScenePreviewMode?.(options.mode);
        recordingCamera.setSceneDepthRangeScale?.(state.sceneDepthRangeScale);
        applySnapshotToRecordingCamera(recordingCamera, cameraSnapshot, options.fov);

        const timelineController = buildExportTimelineController(recordingCamera, options.fov);
        (window).startTime = Date.now();
        await exportVideoWithRecordingCamera(
            renderer,
            scene,
            recordingCamera,
            Math.max(0.1, frameToTime(getTimelineTotalFrames())),
            Math.max(1, Number(state.timelineFps || EXPORT_FALLBACK_FPS)),
            options.resolution,
            fusedRenderer || undefined,
            false,
            {},
            timelineController,
            getExportModeLabel(options.mode)
        );
    } finally {
        setTimelineFrame(restoreFrame, { applyPose: true, syncSlider: true });
        if (wasPlaying) {
            playCameraAnimation();
        }
        recordingCamera.dispose?.();
    }
}

async function onConfirmExportModal() {
    if (!pendingExportType || isExporting) return;
    if (!app) {
        showError('编辑器尚未初始化，无法导出');
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
    showLoading(true, pendingExportType === 'video' ? t('loading.renderingVideo') : t('loading.renderingImage'), 10);

    try {
        await withTemporaryCameraSequenceHidden(async () => {
            await withTemporaryPreviewMode(options.mode, async () => {
                if (pendingExportType === 'image') {
                    await exportImageWithOfficialPipeline(options);
                    showInfo(`图片导出完成: ${options.resolution.width}x${options.resolution.height}, ${getExportModeLabel(options.mode)}`);
                    return;
                }
                await exportVideoWithOfficialPipeline(options);
                showInfo(`视频导出完成: ${options.resolution.width}x${options.resolution.height}, ${getExportModeLabel(options.mode)}`);
            });
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
        showError(`导出失败: ${error?.message || String(error)}`);
    }
}

function isHttpUrl(value) {
    return typeof value === 'string' && /^https?:\/\//i.test(value);
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
        throw new Error(`无效资源路径: ${relativePath}`);
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

/**
 * 保存场景（Visionary 原生流程：文件夹 + scene.json + 资源文件）
 */
async function saveScene() {
    if (!app) {
        showError('编辑器尚未初始化，无法保存场景');
        return;
    }

    if (typeof window.showDirectoryPicker !== 'function') {
        showError('当前浏览器不支持文件夹读写（File System Access API）');
        return;
    }

    try {
        const folderHandle = await window.showDirectoryPicker({ mode: 'readwrite' });
        const models = app.getModels();
        const usedNames = new Set();
        const assets = [];
        let skipped = 0;

        const bgHex = normalizeHexColor(state.sceneBackgroundHex) || '#707070';
        const r = Number.parseInt(bgHex.slice(1, 3), 16) / 255;
        const g = Number.parseInt(bgHex.slice(3, 5), 16) / 255;
        const b = Number.parseInt(bgHex.slice(5, 7), 16) / 255;

        for (let i = 0; i < models.length; i++) {
            const model = models[i];
            showLoading(true, t('loading.savingAssets', { current: i + 1, total: models.length }), (i / Math.max(1, models.length)) * 90);

            const sourceFile = model.sourceFile;
            if (!(sourceFile instanceof Blob)) {
                skipped++;
                continue;
            }

            const candidateName = sanitizeFileName(
                extractFileName(model.sourcePath || sourceFile.name || model.name)
            );
            let saveName = candidateName;
            let suffix = 1;
            while (usedNames.has(saveName)) {
                const dot = candidateName.lastIndexOf('.');
                if (dot > 0) {
                    saveName = `${candidateName.slice(0, dot)}_${suffix}${candidateName.slice(dot)}`;
                } else {
                    saveName = `${candidateName}_${suffix}`;
                }
                suffix++;
            }
            usedNames.add(saveName);

            const fileHandle = await folderHandle.getFileHandle(saveName, { create: true });
            const writable = await fileHandle.createWritable();
            await writable.write(sourceFile);
            await writable.close();

            const asset = {
                name: saveName,
                type: model.modelType || inferAssetType(saveName),
                path: saveName,
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

            assets.push(asset);
        }

        const manifest = {
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
            },
            timeline: {
                fps: Number(state.timelineFps || 24),
                durationSec: Number(state.timelineDurationSec || TIMELINE_MIN_DURATION_SEC),
                playbackSpeed: Number(state.timelinePlaybackSpeed || 1),
                interpolationMode: normalizeCameraInterpolationMode(state.cameraInterpolationMode),
                interpolationParam: Number(state.cameraInterpolationParam ?? 0.5),
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
                        fovDegrees: Number(keyframe.camera?.fovDegrees || 45),
                    },
                })),
            },
            assets,
        };

        showLoading(true, t('loading.writingSceneJson'), 95);
        const sceneHandle = await folderHandle.getFileHandle('scene.json', { create: true });
        const sceneWritable = await sceneHandle.createWritable();
        await sceneWritable.write(JSON.stringify(manifest, null, 2));
        await sceneWritable.close();

        showLoading(false);
        showInfo(`场景已保存到文件夹 "${folderHandle.name}"：${assets.length} 个资源${skipped ? `，跳过 ${skipped} 个无源模型` : ''}`);
    } catch (error) {
        showLoading(false);
        if (error?.name === 'AbortError') {
            showInfo('已取消保存场景');
            return;
        }
        console.error(`[Editor ${state.VERSION}] saveScene failed:`, error);
        showError(`保存场景失败: ${error?.message || String(error)}`);
    }
}

/**
 * 加载场景（Visionary 原生流程：从文件夹读取 scene.json + 资源文件）
 */
async function loadScene() {
    if (!app) {
        showError('编辑器尚未初始化，无法加载场景');
        return;
    }

    if (typeof window.showDirectoryPicker !== 'function') {
        showError('当前浏览器不支持文件夹读取（File System Access API）');
        return;
    }

    try {
        const folderHandle = await window.showDirectoryPicker({ mode: 'read' });
        const sceneHandle = await folderHandle.getFileHandle('scene.json');
        const sceneFile = await sceneHandle.getFile();
        const raw = JSON.parse(await sceneFile.text());
        const assets = parseSceneAssets(raw);
        const timeline = parseSceneTimeline(raw);

        if (!Array.isArray(assets) || assets.length === 0) {
            throw new Error('scene.json 中没有可加载的 assets/scenes 模型条目');
        }

        if (app.getModels().length > 0) {
            const ok = confirm('加载场景会先清空当前模型，是否继续？');
            if (!ok) return;
        }

        app.clearAllModels();
        stopTimelinePlayback(false);
        state.keyframes = [];
        state.currentKeyframeIndex = -1;
        state.selectedFrame = 0;
        state.selectedCameraSequenceFrame = null;
        state.currentTime = 0;
        updateTimelineUI();
        syncCameraSequenceVisualization();
        closeEditor();

        const envBgHex = toHexFromBgColor(raw?.env?.bgColor);
        if (raw?.env?.skyPresetId && raw.env.skyPresetId !== 'custom') {
            applySkyPreset(raw.env.skyPresetId);
        } else if (envBgHex) {
            applySceneBackgroundHex(envBgHex, 'custom');
        }
        if (Number.isFinite(raw?.env?.depthRangeScale)) {
            applySceneDepthRangeScale(raw.env.depthRangeScale, true);
        }
        if (Number.isFinite(raw?.env?.cameraFov)) {
            applySceneCameraFov(raw.env.cameraFov, true);
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

        let loaded = 0;
        let failed = 0;

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
                    if (!response.ok) throw new Error(`URL 资源加载失败: ${response.status}`);
                    const blob = await response.blob();
                    const fileName = sanitizeFileName(asset.name || extractFileName(sourcePath));
                    file = new File([blob], fileName, { type: blob.type || '' });
                } else if (isHttpUrl(asset?.extras?.urlFallback)) {
                    const response = await fetch(asset.extras.urlFallback);
                    if (!response.ok) throw new Error(`Fallback URL 资源加载失败: ${response.status}`);
                    const blob = await response.blob();
                    const fileName = sanitizeFileName(asset.name || extractFileName(asset.extras.urlFallback));
                    file = new File([blob], fileName, { type: blob.type || '' });
                } else {
                    throw new Error(`资产缺少可读取路径: ${asset?.name || `#${i + 1}`}`);
                }

                const targetName = sanitizeFileName(asset.name || file.name || extractFileName(sourcePath));
                const fileForLoad = (file.name === targetName)
                    ? file
                    : new File([file], targetName, { type: file.type || '', lastModified: file.lastModified || Date.now() });

                const loadedModel = await app.loadModel(fileForLoad, { sourcePath: sourcePath || targetName });
                if (!loadedModel) {
                    throw new Error(`加载模型失败: ${targetName}`);
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

                loaded++;
            } catch (assetError) {
                failed++;
                console.warn(`[Editor ${state.VERSION}] 资产加载失败:`, asset, assetError);
            }
        }

        if (timeline) {
            if (Number.isFinite(timeline.durationSec)) {
                state.timelineDurationSec = Math.max(TIMELINE_MIN_DURATION_SEC, Number(timeline.durationSec));
            }
            if (typeof timeline.interpolationMode === 'string') {
                setCameraInterpolationMode(timeline.interpolationMode, true);
            } else {
                setCameraInterpolationMode(CAMERA_INTERPOLATION_MODE_LINEAR, true);
            }
            if (Number.isFinite(Number(timeline.interpolationParam))) {
                setCameraInterpolationParam(Number(timeline.interpolationParam), true);
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
            state.keyframes = Array.isArray(timeline.keyframes)
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
                                fovDegrees: Number(camera.fovDegrees || state.sceneCameraFov || 45),
                            },
                        };
                    })
                    .filter(Boolean)
                    .sort((a, b) => a.frame - b.frame)
                : [];

            state.selectedCameraSequenceFrame = null;
            const selectedFrame = Number.isFinite(Number(timeline.selectedFrame))
                ? Number(timeline.selectedFrame)
                : timeToFrame(Number(timeline.currentTime) || 0);
            setTimelineFrame(selectedFrame, { applyPose: true, syncSlider: true });
            updateTimelineUI();
            syncCameraSequenceVisualization();
        } else {
            setCameraInterpolationMode(CAMERA_INTERPOLATION_MODE_LINEAR, true);
        }

        showLoading(false);
        showInfo(`场景加载完成（${folderHandle.name}）：成功 ${loaded}，失败 ${failed}`);
    } catch (error) {
        showLoading(false);
        if (error?.name === 'AbortError') {
            showInfo('已取消加载场景');
            return;
        }
        console.error(`[Editor ${state.VERSION}] loadScene failed:`, error);
        showError(`加载场景失败: ${error?.message || String(error)}`);
    }
}

/**
 * 清空场景
 */
function clearScene() {
    if (confirm('确定要清空所有模型吗？')) {
        stopTimelinePlayback(false);
        state.keyframes = [];
        state.currentKeyframeIndex = -1;
        state.selectedFrame = 0;
        state.selectedCameraSequenceFrame = null;
        state.currentTime = 0;
        updateTimelineUI();
        syncCameraSequenceVisualization();
        app.clearAllModels();
        closeEditor();
        showInfo('场景已清空');
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
        camera: item.camera,
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
    const keyframe = {
        frame: safeFrame,
        time: frameToTime(safeFrame),
        camera: pose,
    };
    if (index < 0) {
        state.keyframes.push(keyframe);
        state.keyframes.sort((a, b) => a.frame - b.frame);
    } else {
        state.keyframes[index] = {
            ...state.keyframes[index],
            camera: pose,
        };
    }
    state.currentKeyframeIndex = findKeyframeIndexByFrame(state.selectedFrame);
    if (safeFrame === state.selectedFrame) {
        syncTimelineDrivenCameraPreviewPose();
    }
    return true;
}

function normalizeCameraInterpolationMode(mode) {
    if (mode === CAMERA_INTERPOLATION_MODE_SQUAD) return CAMERA_INTERPOLATION_MODE_SQUAD;
    if (mode === CAMERA_INTERPOLATION_MODE_CATMULL) return CAMERA_INTERPOLATION_MODE_CATMULL;
    if (mode === CAMERA_INTERPOLATION_MODE_EASE) return CAMERA_INTERPOLATION_MODE_EASE;
    return CAMERA_INTERPOLATION_MODE_LINEAR;
}

function getCameraInterpolationConfig(mode = state.cameraInterpolationMode) {
    return CAMERA_INTERPOLATION_CONFIGS[normalizeCameraInterpolationMode(mode)] || CAMERA_INTERPOLATION_CONFIGS[CAMERA_INTERPOLATION_MODE_LINEAR];
}

function clampCameraInterpolationParam(value, mode = state.cameraInterpolationMode) {
    const config = getCameraInterpolationConfig(mode);
    const n = Number(value);
    const fallback = Number(config.defaultParam ?? 0.5);
    const raw = Number.isFinite(n) ? n : fallback;
    return Math.max(config.min ?? 0, Math.min(config.max ?? 1, raw));
}

function syncCameraInterpolationModeControl() {
    if (dom.timelineCameraInterpolation) {
        dom.timelineCameraInterpolation.value = normalizeCameraInterpolationMode(state.cameraInterpolationMode);
    }
    const config = getCameraInterpolationConfig();
    const param = clampCameraInterpolationParam(state.cameraInterpolationParam, state.cameraInterpolationMode);
    state.cameraInterpolationParam = param;
    dom.timelineInterpolationParamControl?.classList.toggle('hidden', !config.tunable);
    if (dom.timelineInterpolationParamLabel) {
        dom.timelineInterpolationParamLabel.textContent = config.paramLabel || '参数';
    }
    if (dom.timelineInterpolationParam) {
        dom.timelineInterpolationParam.min = String(config.min ?? 0);
        dom.timelineInterpolationParam.max = String(config.max ?? 1);
        dom.timelineInterpolationParam.step = String(config.step ?? 0.01);
        dom.timelineInterpolationParam.value = String(param);
    }
    if (dom.timelineInterpolationParamValue) {
        const formatter = typeof config.format === 'function' ? config.format : (value) => Number(value).toFixed(2);
        dom.timelineInterpolationParamValue.textContent = formatter(param);
    }
}

function setCameraInterpolationMode(mode, silent = false) {
    const previousMode = normalizeCameraInterpolationMode(state.cameraInterpolationMode);
    const normalized = normalizeCameraInterpolationMode(mode);
    state.cameraInterpolationMode = normalized;
    const config = getCameraInterpolationConfig(normalized);
    if (normalized !== previousMode && config.tunable) {
        state.cameraInterpolationParam = Number(config.defaultParam ?? 0.5);
    } else {
        state.cameraInterpolationParam = clampCameraInterpolationParam(
            state.cameraInterpolationParam,
            normalized
        );
    }
    if (!Number.isFinite(Number(state.cameraInterpolationParam))) {
        state.cameraInterpolationParam = Number(config.defaultParam ?? 0.5);
    }
    syncCameraInterpolationModeControl();
    localStorage.setItem(CAMERA_INTERPOLATION_MODE_STORAGE_KEY, normalized);
    localStorage.setItem(CAMERA_INTERPOLATION_PARAM_STORAGE_KEY, String(state.cameraInterpolationParam));
    syncCameraSequenceVisualization();
    if (!silent) {
        showInfo(`相机插值: ${config.label || normalized}`);
    }
}

function setCameraInterpolationParam(value, silent = false) {
    const normalized = clampCameraInterpolationParam(value, state.cameraInterpolationMode);
    state.cameraInterpolationParam = normalized;
    syncCameraInterpolationModeControl();
    localStorage.setItem(CAMERA_INTERPOLATION_PARAM_STORAGE_KEY, String(normalized));
    syncCameraSequenceVisualization();
    if (!silent && getCameraInterpolationConfig().tunable) {
        showInfo(`${getCameraInterpolationConfig().paramLabel || '参数'}: ${normalized.toFixed(2)}`);
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
    const pose = state.keyframes.length > 0
        ? interpolateCameraPoseAt(state.currentTime)
        : captureCurrentCameraPose();
    app.setCameraPreviewPose?.(pose || null);
}

function setTimelineFrame(frame, options = {}) {
    const safeFrame = clampTimelineFrame(frame);
    state.selectedFrame = safeFrame;
    state.currentTime = frameToTime(safeFrame);
    state.currentKeyframeIndex = findKeyframeIndexByFrame(safeFrame);

    syncTimelineDrivenCameraPreviewPose();

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
    } else {
        updateTimelineUI();
    }
}

function setTimelineFps(nextFpsRaw) {
    const nextFps = Number(nextFpsRaw);
    if (!Number.isFinite(nextFps) || nextFps <= 0) {
        showError('FPS 格式错误');
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
        showInfo(`关键帧已调整: ${frameToTime(frame).toFixed(3)}s`);
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

    setTimelineFrame(clampTimelineFrame(keyframe.frame), { applyPose: false, syncSlider: true });
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
            `<span class="model-track-loop-marker" style="left:${(ratio * 100).toFixed(4)}%;" title="${state.uiLanguage === 'en' ? `Loop ends ${markerSec.toFixed(3)}s` : `循环结束 ${markerSec.toFixed(3)}s`}"></span>`
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

    return `<span class="model-track-overflow-indicator" title="${escapeHtml(state.uiLanguage === 'en' ? 'Model animation duration exceeds the current clip length' : '模型动画播放时长超过当前 clip 时长')}">&gt;</span>`;
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
        showInfo('模型动画片段已更新');
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
    const hasKeyframes = state.keyframes.length > 0;
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
            syncManualTimelineCameraSelection(frame);
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

    if (dom.btnRemoveKeyframe) {
        dom.btnRemoveKeyframe.disabled = findKeyframeIndexByFrame(state.selectedFrame) < 0;
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
        dom.btnRemoveKeyframe.disabled = findKeyframeIndexByFrame(state.selectedFrame) < 0;
    }

    renderTimelineRuler();
    renderTimelineTrack();
    renderModelTracks();
    updateTimeDisplay();
}

/**
 * 添加/覆盖关键帧（当前时间戳）
 */
function addKeyframe() {
    const pose = captureCurrentCameraPose();
    if (!pose) {
        showError('无法读取当前相机位姿');
        return;
    }

    const frame = clampTimelineFrame(state.selectedFrame);
    const keyframe = {
        frame,
        time: frameToTime(frame),
        camera: pose,
    };

    const existingIndex = findKeyframeIndexByFrame(frame);
    if (existingIndex >= 0) {
        state.keyframes[existingIndex] = keyframe;
        showInfo(`关键帧已覆盖: ${keyframe.time.toFixed(3)}s`);
    } else {
        state.keyframes.push(keyframe);
        state.keyframes.sort((a, b) => a.frame - b.frame);
        showInfo(`关键帧已新增: ${keyframe.time.toFixed(3)}s`);
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
    const index = findKeyframeIndexByFrame(frame);
    if (index < 0) {
        showInfo(`当前时间戳无关键帧: ${frameToTime(frame).toFixed(3)}s`);
        return;
    }

    const removed = state.keyframes.splice(index, 1)[0];
    state.currentKeyframeIndex = findKeyframeIndexByFrame(frame);
    updateTimelineUI();
    syncCameraSequenceVisualization();
    if (pendingExportType === 'video' && dom.exportModal && !dom.exportModal.classList.contains('hidden')) {
        updateExportTimelineHint('video');
    }
    showInfo(`关键帧已删除: ${removed.time.toFixed(3)}s`);
}

function buildCameraSequenceExportPayload() {
    return {
        version: 1,
        timelineFps: Number(state.timelineFps || 24),
        timelineDurationSec: Number(state.timelineDurationSec || 10),
        timelinePlaybackSpeed: Number(state.timelinePlaybackSpeed || 1),
        interpolationMode: normalizeCameraInterpolationMode(state.cameraInterpolationMode),
        interpolationParam: Number(state.cameraInterpolationParam || 0.5),
        keyframes: (Array.isArray(state.keyframes) ? state.keyframes : []).map((keyframe) => ({
            frame: Math.round(Number(keyframe.frame) || 0),
            time: Number(keyframe.time) || 0,
            camera: keyframe.camera,
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
    showInfo(`相机序列已导出: ${payload.keyframes.length} 个关键帧`);
}

function clearCameraSequence() {
    if (!confirm('确定要清空当前相机序列吗？')) return;
    stopTimelinePlayback(false);
    state.keyframes = [];
    state.currentKeyframeIndex = -1;
    setTimelineFrame(0, { applyPose: false, syncSlider: true });
    updateTimelineUI();
    syncCameraSequenceVisualization();
    showInfo('相机序列已清空');
}

async function importCameraSequenceFromFile(file) {
    if (!file) return;
    try {
        const raw = JSON.parse(await file.text());
        if (!Array.isArray(raw?.keyframes)) {
            throw new Error('缺少 keyframes 数组');
        }

        if (Number.isFinite(raw.timelineFps)) {
            setTimelineFps(raw.timelineFps);
        }
        if (Number.isFinite(raw.timelinePlaybackSpeed)) {
            state.timelinePlaybackSpeed = Number(raw.timelinePlaybackSpeed) || 1;
            if (dom.timelineSpeed) dom.timelineSpeed.value = String(state.timelinePlaybackSpeed);
        }
        if (raw.interpolationMode) {
            setCameraInterpolationMode(raw.interpolationMode, true);
        }
        if (Number.isFinite(raw.interpolationParam)) {
            setCameraInterpolationParam(raw.interpolationParam, true);
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

        state.currentKeyframeIndex = -1;
        setTimelineFrame(0, { applyPose: false, syncSlider: true });
        updateTimelineUI();
        syncCameraSequenceVisualization();
        showInfo(`相机序列已导入: ${state.keyframes.length} 个关键帧`);
    } catch (error) {
        console.error(`[Editor ${state.VERSION}] importCameraSequence failed:`, error);
        showError(`导入相机序列失败: ${error?.message || String(error)}`);
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
        const pauseLabel = state.uiLanguage === 'en' ? 'Pause camera animation' : '暂停相机动画';
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
        fovDegrees: a.camera.fovDegrees + (b.camera.fovDegrees - a.camera.fovDegrees) * t,
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

function easeInOutCubic(t) {
    if (t <= 0) return 0;
    if (t >= 1) return 1;
    return t < 0.5
        ? 4 * t * t * t
        : 1 - Math.pow(-2 * t + 2, 3) / 2;
}

function remapInterpolationTime(t, strength = state.cameraInterpolationParam) {
    const clampedT = Math.max(0, Math.min(1, Number(t) || 0));
    const clampedStrength = Math.max(0, Math.min(1, Number(strength) || 0));
    const eased = easeInOutCubic(clampedT);
    return lerpNumber(clampedT, eased, clampedStrength);
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

function interpolateCameraPositionCatmull(keyframes, index, t, tension = state.cameraInterpolationParam) {
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

function interpolateCameraPoseSquad(keyframes, index, t) {
    const a = keyframes[index];
    const b = keyframes[index + 1];
    if (!a || !b) return null;
    if (!Array.isArray(keyframes) || keyframes.length < 3) {
        return interpolateCameraPoseLinear(a, b, t);
    }

    const prev = keyframes[index - 1]?.camera?.rotation || a.camera.rotation;
    const next = keyframes[index + 2]?.camera?.rotation || b.camera.rotation;
    const rot = interpolateQuaternionSquad(prev, a.camera.rotation, b.camera.rotation, next, t);
    if (![rot.x, rot.y, rot.z, rot.w].every(Number.isFinite)) {
        return interpolateCameraPoseLinear(a, b, t);
    }

    return {
        position: {
            x: a.camera.position.x + (b.camera.position.x - a.camera.position.x) * t,
            y: a.camera.position.y + (b.camera.position.y - a.camera.position.y) * t,
            z: a.camera.position.z + (b.camera.position.z - a.camera.position.z) * t,
        },
        rotation: rot,
        fovDegrees: a.camera.fovDegrees + (b.camera.fovDegrees - a.camera.fovDegrees) * t,
    };
}

function interpolateCameraPoseCatmull(keyframes, index, t) {
    const a = keyframes[index];
    const b = keyframes[index + 1];
    if (!a || !b) return null;
    const position = interpolateCameraPositionCatmull(keyframes, index, t, state.cameraInterpolationParam);
    if (!position || ![position.x, position.y, position.z].every(Number.isFinite)) {
        return interpolateCameraPoseLinear(a, b, t);
    }
    return {
        position,
        rotation: slerpQuaternion(a.camera.rotation, b.camera.rotation, t),
        fovDegrees: lerpNumber(a.camera.fovDegrees, b.camera.fovDegrees, t),
    };
}

function interpolateCameraPoseEase(a, b, t) {
    const easedT = remapInterpolationTime(t, state.cameraInterpolationParam);
    const rot = slerpQuaternion(a.camera.rotation, b.camera.rotation, easedT);
    return {
        position: {
            x: lerpNumber(a.camera.position.x, b.camera.position.x, easedT),
            y: lerpNumber(a.camera.position.y, b.camera.position.y, easedT),
            z: lerpNumber(a.camera.position.z, b.camera.position.z, easedT),
        },
        rotation: rot,
        fovDegrees: lerpNumber(a.camera.fovDegrees, b.camera.fovDegrees, easedT),
    };
}

function interpolateCameraPoseAt(timeSec) {
    if (state.keyframes.length === 0) return null;
    const keyframes = state.keyframes;
    const mode = normalizeCameraInterpolationMode(state.cameraInterpolationMode);

    if (timeSec <= keyframes[0].time) {
        return keyframes[0].camera;
    }
    const last = keyframes[keyframes.length - 1];
    if (timeSec >= last.time) {
        return last.camera;
    }

    for (let i = 0; i < keyframes.length - 1; i++) {
        const a = keyframes[i];
        const b = keyframes[i + 1];
        if (timeSec < a.time || timeSec > b.time) continue;

        const span = Math.max(1e-6, b.time - a.time);
        const t = (timeSec - a.time) / span;
        if (mode === CAMERA_INTERPOLATION_MODE_SQUAD) {
            return interpolateCameraPoseSquad(keyframes, i, t) || interpolateCameraPoseLinear(a, b, t);
        }
        if (mode === CAMERA_INTERPOLATION_MODE_CATMULL) {
            return interpolateCameraPoseCatmull(keyframes, i, t) || interpolateCameraPoseLinear(a, b, t);
        }
        if (mode === CAMERA_INTERPOLATION_MODE_EASE) {
            return interpolateCameraPoseEase(a, b, t);
        }
        return interpolateCameraPoseLinear(a, b, t);
    }

    return last.camera;
}

function stopTimelinePlayback(resetToStart = false) {
    state.isPlaying = false;
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
        if (state.isLooping) {
            if (state.selectedFrame !== 0) {
                setTimelineFrame(0, { applyPose: true, syncSlider: true, lightweightUi: true });
            } else {
                state.currentTime = 0;
                updateTimeDisplay();
            }
        } else {
            stopTimelinePlayback(true);
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
        showInfo('相机动画: 暂停');
        return;
    }

    state.isPlaying = true;
    timelinePlaybackLastTime = performance.now();
    updatePlayButtonUI();
    timelinePlaybackRaf = requestAnimationFrame(tickTimelinePlayback);
    showInfo('相机动画: 播放');
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
    showInfo(`相机动画循环: ${state.isLooping ? '开启' : '关闭'}`);
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
    const savedInterpolationMode = localStorage.getItem(CAMERA_INTERPOLATION_MODE_STORAGE_KEY);
    const savedInterpolationParam = localStorage.getItem(CAMERA_INTERPOLATION_PARAM_STORAGE_KEY);
    const savedCameraDisplayScale = localStorage.getItem(CAMERA_DISPLAY_SCALE_STORAGE_KEY);
    const savedCameraPreviewAspectId = localStorage.getItem(CAMERA_PREVIEW_ASPECT_STORAGE_KEY);
    if (savedInterpolationMode) {
        state.cameraInterpolationMode = normalizeCameraInterpolationMode(savedInterpolationMode);
    }
    if (savedInterpolationParam !== null) {
        state.cameraInterpolationParam = clampCameraInterpolationParam(savedInterpolationParam, state.cameraInterpolationMode);
    }
    if (savedCameraDisplayScale !== null) {
        state.cameraSequenceDisplayScale = clampCameraSequenceDisplayScale(savedCameraDisplayScale);
    }
    if (savedCameraPreviewAspectId !== null) {
        state.cameraPreviewAspectId = normalizeCameraPreviewAspectId(savedCameraPreviewAspectId);
    }
    syncCameraInterpolationModeControl();
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
    showInfo(`相机预设: ${preset}`);
}

function isEditingText() {
    const active = document.activeElement;
    if (!active) return false;
    const tag = active.tagName;
    return tag === 'INPUT' || tag === 'TEXTAREA' || active.isContentEditable;
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
            if (model) showInfo(`聚焦模型: ${model.name}`);
        }
        return;
    }

    if (e.key.toLowerCase() === 'x') {
        if (!app) return;
        e.preventDefault();
        const ok = app.uprightCamera();
        if (ok) {
            showInfo('相机回正');
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
    dom.helpTipsClose?.addEventListener('click', closeHelpTipsModal);
    dom.helpTipsConfirm?.addEventListener('click', closeHelpTipsModal);
    dom.helpTipsModal?.addEventListener('click', (e) => {
        if (e.target === dom.helpTipsModal) {
            closeHelpTipsModal();
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
    dom.btnToggleCameraPreview?.addEventListener('click', () => setCameraPreviewOpen(!state.cameraPreviewOpen));
    dom.btnCameraPreviewClose?.addEventListener('click', () => setCameraPreviewOpen(false));
    dom.btnToggleCameraSettings?.addEventListener('click', () => setCameraSettingsOpen(!state.cameraSettingsOpen));
    dom.btnCameraSettingsClose?.addEventListener('click', () => setCameraSettingsOpen(false));
    dom.cameraPreviewPanel?.addEventListener('pointerdown', () => focusFloatingPanel('cameraPreview'));
    dom.cameraSettingsPanel?.addEventListener('pointerdown', () => focusFloatingPanel('cameraSettings'));
    dom.cameraPreviewPanel?.addEventListener('mousedown', beginCameraPreviewPanelDrag);
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
        showInfo(`相机模式: ${mode}`);
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
    dom.timelineCameraInterpolation?.addEventListener('change', (e) => {
        setCameraInterpolationMode(e.target.value);
    });
    dom.timelineInterpolationParam?.addEventListener('input', (e) => {
        setCameraInterpolationParam(e.target.value, true);
    });
    dom.timelineInterpolationParam?.addEventListener('change', (e) => {
        setCameraInterpolationParam(e.target.value);
    });
    dom.cameraDisplayScale?.addEventListener('input', (e) => {
        setCameraSequenceDisplayScale(e.target.value, true);
    });
    dom.cameraDisplayScale?.addEventListener('change', (e) => {
        setCameraSequenceDisplayScale(e.target.value);
    });
    dom.timelineFps?.addEventListener('change', (e) => {
        setTimelineFps(e.target.value);
    });
    dom.timelineSpeed?.addEventListener('change', (e) => {
        state.timelinePlaybackSpeed = Number(e.target.value) || 1.0;
        showInfo(`全局播放倍速: ${state.timelinePlaybackSpeed}x`);
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
            showInfo('图片已加入输入区');
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
            setCameraPreviewOpen(false);
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
        }
    });
    document.addEventListener('pointerdown', (e) => {
        if (!state.exportFlyoutOpen) return;
        if (dom.exportToolFlyout?.contains(e.target)) return;
        setExportFlyoutOpen(false);
    });
    document.addEventListener('mousemove', moveCameraPreviewPanel);
    document.addEventListener('mouseup', endCameraPreviewPanelDrag);
    window.addEventListener('resize', () => {
        if (state.cameraPreviewOpen) {
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
    initializeAgentWorkbench();
    syncClearScreenState();
    initializeCameraPreviewControls();
    mountCameraPreviewPanelToMainUi();
    mountCameraSettingsPanelToMainUi();

    // 检查关键 DOM 元素是否存在
    if (!dom.canvas) {
        showError('Canvas element not found');
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
        showError('Failed to load EditorApp module: ' + error.message);
        return;
    }

    // 初始化编辑器应用
    const success = await app.init();
    if (!success) {
        showError('Failed to initialize editor');
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
            showInfo(`时间轴已自动适配到 ${maxEnd.toFixed(1)}s`);
        }
        
        if (typeof renderModelTracks === 'function') renderModelTracks();
    });
    app.onViewportGizmoTransform?.((id, model) => {
        if (id !== state.selectedModelId) return;
        updateEditorValues(model);
    });
    app.onSelectedModel?.((id) => {
        if (syncingSelectedModelSelection) return;
        if (!id) return;
        selectModel(id, { syncApp: false, allowToggle: false, silent: true });
    });
    app.onCameraInteraction?.((kind) => {
        if (state.keyframes.length === 0) {
            syncTimelineDrivenCameraPreviewPose();
        }
        if (!state.isPlaying) return;
        if (kind !== 'drag' && kind !== 'wheel' && kind !== 'keyboard') return;
        stopTimelinePlayback(false);
        showInfo('相机动画: 已暂停（手动控制）');
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
                selectedCameraSequenceFrame: state.selectedCameraSequenceFrame,
                selectedModelId: state.selectedModelId,
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
