/**
 * Visionary Editor UI Controller 0.0.10
 * Handles UI interactions and connects to EditorApp
 */

// DOM 元素引用
const dom = {
    // Canvas 相关
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

    // 模式按钮
    modeColor: document.getElementById('modeColor'),
    modeDepth: document.getElementById('modeDepth'),
    modeNormal: document.getElementById('modeNormal'),
    btnRenderVideo: document.getElementById('renderVideo'),
    btnRenderImage: document.getElementById('renderImage'),

    // 中部区域
    leftSidebar: document.getElementById('left-sidebar'),
    centerViewport: document.getElementById('center-viewport'),
    modelCountBadge: document.getElementById('modelCountBadge'),
    modelList: document.getElementById('modelList'),
    btnAddModel: document.getElementById('btnAddModel'),

    // 右侧边栏 - 模型编辑器
    rightSidebar: document.getElementById('right-sidebar'),
    modelSettingsCard: document.getElementById('modelSettingsCard'),
    modelTransformSection: document.getElementById('modelTransformSection'),
    selectedModelName: document.getElementById('selectedModelName'),
    btnCloseEditor: document.getElementById('btnCloseEditor'),
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
    btnPlayCamera: document.getElementById('btnPlayCamera'),
    btnLoopCamera: document.getElementById('btnLoopCamera'),
    timelineSpeed: document.getElementById('timelineSpeed'),
    timelineFps: document.getElementById('timelineFps'),
    timelineRuler: document.getElementById('timelineRuler'),
    timelineTrack: document.getElementById('timelineTrack'),
    timelineSlider: document.getElementById('timelineSlider'),
    timeValue: document.getElementById('timeValue'),

    // 文件输入
    fileInput: document.getElementById('fileInput'),
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
    VERSION: '0.0.10',
    exportMode: 'color', // 'color' | 'depth' | 'normal'
    selectedModelId: null,
    cameraSequenceVisible: true,
    currentTime: 0,
    isPlaying: false,
    isLooping: false,
    keyframes: [],
    currentKeyframeIndex: -1,
    selectedFrame: 0,
    timelineFps: 24,
    timelinePlaybackSpeed: 1.0,
    timelineDurationSec: 10,
    sceneBackgroundHex: '#050814',
    sceneSkyPresetId: 'night',
    sceneDepthRangeScale: 1.0,
    sceneCameraFov: 45.0,
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
let keyframeMarkerDrag = null;
let suppressMarkerClickOnce = false;
const THEME_STORAGE_KEY = 'visionary_editor_theme';
const TIMELINE_FPS_OPTIONS = [12, 24, 30, 60];
const TIMELINE_MIN_DURATION_SEC = 10;
const TIMELINE_SLIDER_THUMB_PX = 16;
const EXPORT_FALLBACK_FPS = 24;
const CAMERA_SEQUENCE_LIST_ITEM_ID = '__editor_camera_sequence__';
const MODEL_ANIM_SPEED_MIN = 0.001;
const MODEL_ANIM_SPEED_MAX = 10;
const MODEL_ANIM_SPEED_STEP = 0.001;
const MODEL_ANIM_SPEED_MIN_LOG = Math.log10(MODEL_ANIM_SPEED_MIN);
const MODEL_ANIM_SPEED_MAX_LOG = Math.log10(MODEL_ANIM_SPEED_MAX);
const MODEL_ANIM_SPEED_ONE_LOG = Math.log10(1);
const MODEL_ANIM_DURATION_FALLBACK_SEC = 2.5;
const EXPORT_PRESET_RESOLUTIONS = [
    { width: 1280, height: 720, label: '1280 x 720 (720p)' },
    { width: 1920, height: 1080, label: '1920 x 1080 (1080p)' },
    { width: 2560, height: 1440, label: '2560 x 1440 (2K)' },
    { width: 3840, height: 2160, label: '3840 x 2160 (4K)' },
];

const FALLBACK_SKY_PRESETS = [
    { id: 'studio', name: '工作室', colorHex: '#10131C' },
    { id: 'clear_day', name: '晴空', colorHex: '#6EAEEA' },
    { id: 'sunset', name: '日落', colorHex: '#E9875A' },
    { id: 'dusk', name: '暮光', colorHex: '#4A5D86' },
    { id: 'night', name: '夜空', colorHex: '#050814' },
];

function normalizeHexColor(value) {
    if (!value) return null;
    const text = String(value).trim();
    const matched = text.match(/^#?([0-9a-fA-F]{6})$/);
    if (!matched) return null;
    return `#${matched[1].toUpperCase()}`;
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

function speedToSliderValue(speed) {
    const safeSpeed = clampModelAnimationSpeedForSlider(speed);
    const logSpeed = Math.log10(safeSpeed);
    if (safeSpeed <= 1) {
        const leftRatio = (logSpeed - MODEL_ANIM_SPEED_MIN_LOG) / (MODEL_ANIM_SPEED_ONE_LOG - MODEL_ANIM_SPEED_MIN_LOG);
        return Math.min(0.5, Math.max(0, leftRatio * 0.5));
    }

    const rightRatio = (logSpeed - MODEL_ANIM_SPEED_ONE_LOG) / (MODEL_ANIM_SPEED_MAX_LOG - MODEL_ANIM_SPEED_ONE_LOG);
    return Math.min(1, Math.max(0.5, 0.5 + rightRatio * 0.5));
}

function sliderValueToSpeed(value) {
    const ratio = Math.min(1, Math.max(0, Number(value) || 0));
    let logSpeed;
    if (ratio <= 0.5) {
        const leftRatio = ratio / 0.5;
        logSpeed = MODEL_ANIM_SPEED_MIN_LOG + leftRatio * (MODEL_ANIM_SPEED_ONE_LOG - MODEL_ANIM_SPEED_MIN_LOG);
    } else {
        const rightRatio = (ratio - 0.5) / 0.5;
        logSpeed = MODEL_ANIM_SPEED_ONE_LOG + rightRatio * (MODEL_ANIM_SPEED_MAX_LOG - MODEL_ANIM_SPEED_ONE_LOG);
    }
    return clampModelAnimationSpeed(10 ** logSpeed);
}

function renderSkyPresetGrid() {
    if (!dom.skyPresetGrid) return;
    const presets = (app?.getSceneSkyPresets?.() || FALLBACK_SKY_PRESETS);
    dom.skyPresetGrid.innerHTML = presets.map((preset) => `
        <button class="sky-preset-btn ${state.sceneSkyPresetId === preset.id ? 'active' : ''}" data-sky-id="${preset.id}" title="${preset.name}">
            <span class="sky-preset-swatch" style="background:${preset.colorHex};"></span>
            <span class="sky-preset-name">${preset.name}</span>
        </button>
    `).join('');
}

function syncSceneBackgroundInputs() {
    if (dom.sceneBgColorPicker) dom.sceneBgColorPicker.value = state.sceneBackgroundHex;
    if (dom.sceneBgColorHex) dom.sceneBgColorHex.value = state.sceneBackgroundHex;
}

function clampDepthRangeScale(value) {
    const n = Number(value);
    if (!Number.isFinite(n)) return null;
    return Math.max(0.01, Math.min(100, n));
}

function syncSceneDepthRangeInputs() {
    const fixed = Number(state.sceneDepthRangeScale || 1).toFixed(3);
    if (dom.sceneDepthScale) dom.sceneDepthScale.value = fixed;
    if (dom.sceneDepthScaleNumber) dom.sceneDepthScaleNumber.value = fixed;
}

function applySceneDepthRangeScale(value, silent = false) {
    const safe = clampDepthRangeScale(value);
    if (safe === null) {
        showError('深度倍率格式错误');
        return;
    }

    const ok = app?.setSceneDepthRangeScale?.(safe);
    if (!ok) {
        showError('设置深度倍率失败');
        return;
    }

    state.sceneDepthRangeScale = safe;
    syncSceneDepthRangeInputs();
    if (!silent) {
        showInfo(`深度倍率: ${safe.toFixed(3)}x`);
    }
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

    syncSceneBackgroundInputs();
    syncSceneDepthRangeInputs();
    syncSceneFovInputs();
    renderSkyPresetGrid();
}

function setModelEditorActive(active) {
    dom.btnCloseEditor && (dom.btnCloseEditor.disabled = !active);
    dom.modelSettingsCard?.classList.toggle('inactive', !active);
}

function updateThemeToggleLabel(theme) {
    if (!dom.btnThemeToggle) return;
    const nextTheme = theme === 'light' ? 'dark' : 'light';
    dom.btnThemeToggle.textContent = nextTheme === 'light' ? '白天' : '夜间';
    dom.btnThemeToggle.title = nextTheme === 'light' ? '切换到白天' : '切换到夜间';
}

function applyTheme(theme, persist = false) {
    const normalized = theme === 'light' ? 'light' : 'dark';
    document.body.classList.toggle('theme-light', normalized === 'light');
    updateThemeToggleLabel(normalized);

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
        getPreviewMode: () => state.exportMode,
        setPreviewMode: (mode) => setExportMode(mode),
        getDepthScale: () => state.sceneDepthRangeScale,
        setDepthScale: (value) => applySceneDepthRangeScale(value),
        getModelTrackLoopMarkerDebugInfo,
        getModelTracksDomDebugInfo,
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
    };

    window.__visionaryEditorDebug = hooks;
}

/**
 * 显示加载状态
 */
function showLoading(show, text = 'Loading...', progress = 0) {
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
    alert(`Error: ${message}`);
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
    dom.modelCountBadge.textContent = `${visibleCount}/${totalCount}`;
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
        showError('设置相机序列可见性失败');
        return false;
    }
    state.cameraSequenceVisible = safe;
    updateModelList();
    if (!silent) {
        showInfo(`相机序列: ${safe ? '可见' : '隐藏'}`);
    }
    return true;
}

/**
 * 更新模型列表 UI
 */
function updateModelList() {
    if (!app || !dom.modelList) return;
    const models = app.getModels();
    const cameraSequenceVisible = syncCameraSequenceVisibilityState();
    const cameraSequenceItemHtml = `
        <div class="model-item model-item-system" data-id="${CAMERA_SEQUENCE_LIST_ITEM_ID}" data-system-item="camera-sequence">
            <span class="model-name">相机序列</span>
            <button class="model-visibility-btn ${cameraSequenceVisible ? 'active' : ''}" data-system-action="toggle-camera-sequence-visibility" title="切换可见性">
                ${cameraSequenceVisible ? '可见' : '隐藏'}
            </button>
        </div>
    `;

    if (models.length === 0) {
        dom.modelList.innerHTML = cameraSequenceItemHtml + '<div class="empty-list">' +
            '<p>暂无模型</p>' +
            '<p class="empty-hint">拖拽文件到此处，或点击下方按钮</p>' +
            '</div>';
        dom.modelList.querySelectorAll('.model-visibility-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const systemAction = btn.dataset.systemAction;
                if (systemAction === 'toggle-camera-sequence-visibility') {
                    setCameraSequenceVisibility(!state.cameraSequenceVisible);
                }
            });
        });
    } else {
        dom.modelList.innerHTML = cameraSequenceItemHtml + models.map((model) => `
            <div class="model-item ${state.selectedModelId === model.id ? 'selected' : ''}" data-id="${model.id}">
                <span class="model-name">${model.name}</span>
                <span class="model-points">${model.pointCount.toLocaleString()} 点</span>
                <button class="model-visibility-btn ${model.visible ? 'active' : ''}" data-id="${model.id}" title="切换可见性">
                    ${model.visible ? '可见' : '隐藏'}
                </button>
                <span class="model-remove" data-id="${model.id}" title="删除">&times;</span>
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
                const systemAction = btn.dataset.systemAction;
                if (systemAction === 'toggle-camera-sequence-visibility') {
                    setCameraSequenceVisibility(!state.cameraSequenceVisible);
                    return;
                }
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
                if (item.dataset.systemItem === 'camera-sequence') return;
                selectModel(item.dataset.id);
            });
        });
    }

    updateModelCount();
}

/**
 * 选择模型进行编辑
 */
function selectModel(id) {
    const model = app.getModel(id);
    if (!model) return;

    state.selectedModelId = id;

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
    updateModelList();
    showInfo(`选中模型: ${model.name}`);
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
    if (dom.onnxAnimSection) dom.onnxAnimSection.classList.add('hidden');
    if (dom.selectedModelName) dom.selectedModelName.textContent = '未选中模型';
    state.selectedModelId = null;
    setModelEditorActive(false);
    updateModelList();
}

function getSelectedModelAnimationState() {
    if (!app || !state.selectedModelId) return null;
    return app.getModelAnimationState(state.selectedModelId);
}

function updateModelAnimationControls(id = state.selectedModelId) {
    if (!app || !id) {
        if (dom.onnxAnimSection) dom.onnxAnimSection.classList.add('hidden');
        return;
    }

    const anim = app.getModelAnimationState(id);
    if (!anim || !anim.supported) {
        if (dom.onnxAnimSection) dom.onnxAnimSection.classList.add('hidden');
        return;
    }

    if (dom.onnxAnimSection) dom.onnxAnimSection.classList.remove('hidden');

    const speed = Number(anim.speed || 1);
    if (dom.modelAnimSpeed) {
        dom.modelAnimSpeed.value = speedToSliderValue(speed).toFixed(3);
    }
    if (dom.modelAnimSpeedValue && document.activeElement !== dom.modelAnimSpeedValue) {
        dom.modelAnimSpeedValue.value = speed.toFixed(3);
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
    dom.modelAnimSpeedValue.value = parsed.toFixed(3);
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
    const labels = { color: '图片', depth: '深度图', normal: '法向图' };
    return labels[mode] || mode;
}

function updateExportTimelineHint(type) {
    if (!dom.exportTimelineHint) return;
    if (type !== 'video') {
        dom.exportTimelineHint.textContent = '将导出当前视角的单帧图像';
        return;
    }
    const fps = Math.max(1, Number(state.timelineFps || EXPORT_FALLBACK_FPS));
    const totalFrames = Math.max(1, getTimelineTotalFrames() + 1);
    const duration = frameToTime(getTimelineTotalFrames());
    const keyframes = state.keyframes.length;
    dom.exportTimelineHint.textContent =
        `时间轴导出: ${duration.toFixed(3)}s, ${fps} FPS, ${totalFrames} 帧, 关键帧 ${keyframes}`;
}

function buildExportResolutionOptions() {
    if (!dom.exportResolution) return;

    const options = [];
    const seen = new Set();
    const current = getViewportResolution();
    const currentValue = resolutionToValue(current.width, current.height);
    options.push({ value: currentValue, label: `${current.width} x ${current.height} (当前窗口)` });
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
    if (dom.exportConfirm) dom.exportConfirm.textContent = busy ? '渲染中...' : '渲染';
}

function closeExportModal() {
    if (!dom.exportModal) return;
    if (isExporting) return;
    dom.exportModal.classList.add('hidden');
    pendingExportType = null;
}

function openExportModal(type) {
    if (!dom.exportModal || !dom.exportModalTitle) {
        showError('导出弹窗未初始化');
        return;
    }
    if (!app) {
        showError('编辑器尚未初始化，无法导出');
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

    dom.exportModalTitle.textContent = pendingExportType === 'video' ? '渲染视频' : '渲染图片';
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
    showLoading(true, pendingExportType === 'video' ? '渲染视频中...' : '渲染图片中...', 10);

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

        const bgHex = normalizeHexColor(state.sceneBackgroundHex) || '#050814';
        const r = Number.parseInt(bgHex.slice(1, 3), 16) / 255;
        const g = Number.parseInt(bgHex.slice(3, 5), 16) / 255;
        const b = Number.parseInt(bgHex.slice(5, 7), 16) / 255;

        for (let i = 0; i < models.length; i++) {
            const model = models[i];
            showLoading(true, `保存资源中... (${i + 1}/${models.length})`, (i / Math.max(1, models.length)) * 90);

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
            };

            if (asset.type === 'onnx' && model.isDynamic) {
                asset.dynamic = true;
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
            version: 1,
            meta: {
                app: 'WebGaussianJS',
                createdAt: new Date().toISOString(),
                unit: 'meter',
            },
            env: {
                bgColor: [r, g, b, 1],
                gaussianScale: 1,
                depthRangeScale: Number(state.sceneDepthRangeScale || 1.0),
            },
            assets,
        };

        showLoading(true, '写入 scene.json ...', 95);
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
        state.currentTime = 0;
        updateTimelineUI();
        syncCameraSequenceVisualization();
        closeEditor();

        const envBgHex = toHexFromBgColor(raw?.env?.bgColor);
        if (envBgHex) {
            applySceneBackgroundHex(envBgHex, 'custom');
        }
        if (Number.isFinite(raw?.env?.depthRangeScale)) {
            applySceneDepthRangeScale(raw.env.depthRangeScale, true);
        }

        let loaded = 0;
        let failed = 0;

        for (let i = 0; i < assets.length; i++) {
            const asset = assets[i];
            showLoading(true, `加载场景资源中... (${i + 1}/${assets.length})`, ((i + 1) / assets.length) * 100);
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

                loaded++;
            } catch (assetError) {
                failed++;
                console.warn(`[Editor ${state.VERSION}] 资产加载失败:`, asset, assetError);
            }
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
    app.setCameraSequenceVisualization(keyframes, state.selectedFrame, trajectory);
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

function applyCameraPoseForTime(timeSec) {
    if (!app || state.keyframes.length === 0) return;
    const pose = interpolateCameraPoseAt(timeSec);
    if (!pose) return;
    app.setCameraPose?.(pose);
    if (Number.isFinite(pose.fovDegrees)) {
        state.sceneCameraFov = pose.fovDegrees;
        syncSceneFovInputs();
    }
}

function setTimelineFrame(frame, options = {}) {
    const safeFrame = clampTimelineFrame(frame);
    state.selectedFrame = safeFrame;
    state.currentTime = frameToTime(safeFrame);
    state.currentKeyframeIndex = findKeyframeIndexByFrame(safeFrame);

    if (options.applyPose !== false) {
        applyCameraPoseForTime(state.currentTime);
    }

    if (app && typeof app.setGlobalTimelineTime === 'function') {
        app.setGlobalTimelineTime(state.currentTime);
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
    const rawDuration = Number(model?.animDuration ?? model?.modelEntry?.animDuration);
    const duration = Number.isFinite(rawDuration) && rawDuration > 0
        ? rawDuration
        : MODEL_ANIM_DURATION_FALLBACK_SEC;
    const speed = Math.abs(Number(model?.modelEntry?.animSpeed ?? 1));
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
            `<span class="model-track-loop-marker" style="left:${(ratio * 100).toFixed(4)}%;" title="循环结束 ${markerSec.toFixed(3)}s"></span>`
        );
    }

    return markers.join('');
}

function getModelTrackLoopMarkerDebugInfo() {
    const models = Array.from(app?.editorModels?.values?.() || []);
    return models
        .filter((model) => model?.isDynamic && model?.modelEntry)
        .map((model) => {
            const startSec = Number(model.modelEntry.animStartTime ?? 0);
            const endSec = Number(model.modelEntry.animEndTime ?? 10);
            const rawDuration = Number(model.animDuration ?? model.modelEntry.animDuration);
            const hasMetadataDuration = Number.isFinite(rawDuration) && rawDuration > 0;
            const duration = hasMetadataDuration ? rawDuration : MODEL_ANIM_DURATION_FALLBACK_SEC;
            const speed = Math.abs(Number(model.modelEntry.animSpeed ?? 1));
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
        if (!model.isDynamic || !model.modelEntry) continue;
        
        hasTracks = true;
        const startSec = model.modelEntry.animStartTime ?? 0;
        const endSec = model.modelEntry.animEndTime ?? 10;
        
        const startRatio = Math.max(0, Math.min(1, startSec / durationSec));
        const endRatio = Math.max(0, Math.min(1, endSec / durationSec));
        const widthRatio = Math.max(0, endRatio - startRatio);
        
        const leftStyle = timelineMappedLeftStyle(startRatio);
        const widthStyle = `calc((100% - ${TIMELINE_SLIDER_THUMB_PX}px) * ${widthRatio})`;
        const loopMarkersHtml = buildModelTrackLoopMarkers(model, startSec, endSec);
        
        const trackHtml = `
            <div class="model-track" data-model-id="${model.id}">
                <div class="model-track-clip" style="left: ${leftStyle}; width: ${widthStyle};" title="${model.name}">
                    ${loopMarkersHtml}
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
    if (!model || !model.modelEntry) return;

    const action = e.target.dataset.action || 'move';
    const startSec = model.modelEntry.animStartTime ?? 0;
    const endSec = model.modelEntry.animEndTime ?? 10;

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
        html.push('<div class="timeline-placeholder"><span class="placeholder-text">添加关键帧开始录制相机运动</span></div>');
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

/**
 * 更新播放按钮 UI
 */
function updatePlayButtonUI() {
    if (!dom.btnPlayCamera) return;
    const icon = dom.btnPlayCamera.querySelector('.btn-icon');
    if (state.isPlaying) {
        dom.btnPlayCamera.classList.add('active');
        if (icon) icon.textContent = '暂停';
    } else {
        dom.btnPlayCamera.classList.remove('active');
        if (icon) icon.textContent = '播放';
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
    const q1 = [a.x, a.y, a.z, a.w];
    let q2 = [b.x, b.y, b.z, b.w];
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

function interpolateCameraPoseAt(timeSec) {
    if (state.keyframes.length === 0) return null;
    const keyframes = state.keyframes;

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

    if (e.key === '?') {
        e.preventDefault();
        openHelpTipsModal();
        return;
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
                showLoading(true, `加载模型中... (${i + 1}/${files.length})`, ((i + 1) / files.length) * 100);
            }
            showLoading(false);
            // 清空 input 以便重复选择同一文件
            e.target.value = '';
        }
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
    dom.btnCloseEditor?.addEventListener('click', closeEditor);
    dom.btnResetTransform?.addEventListener('click', resetTransform);
    dom.sceneBgColorPicker?.addEventListener('input', (e) => {
        applySceneBackgroundHex(e.target.value, 'custom');
    });
    dom.sceneBgColorHex?.addEventListener('change', (e) => {
        applySceneBackgroundHex(e.target.value, 'custom');
    });
    dom.sceneDepthScale?.addEventListener('input', (e) => {
        applySceneDepthRangeScale(e.target.value, true);
    });
    dom.sceneDepthScaleNumber?.addEventListener('change', (e) => {
        applySceneDepthRangeScale(e.target.value);
    });
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

    dom.modelAnimSpeed?.addEventListener('input', updateSelectedModelAnimationSpeedFromSlider);
    dom.modelAnimSpeedValue?.addEventListener('input', updateSelectedModelAnimationSpeedFromInput);
    dom.modelAnimSpeedValue?.addEventListener('change', commitSelectedModelAnimationSpeedFromInput);
    dom.modelAnimSpeedValue?.addEventListener('blur', commitSelectedModelAnimationSpeedFromInput);
    dom.modelAnimSpeedValue?.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
            commitSelectedModelAnimationSpeedFromInput();
            dom.modelAnimSpeedValue?.blur();
        }
    });

    // 相机模式
    dom.cameraMode?.addEventListener('change', (e) => {
        const mode = e.target.value;
        if (app) app.setCameraMode(mode);
        showInfo(`相机模式: ${mode}`);
    });

    // 时间轴
    dom.btnAddKeyframe?.addEventListener('click', addKeyframe);
    dom.btnRemoveKeyframe?.addEventListener('click', removeKeyframe);
    dom.btnPlayCamera?.addEventListener('click', playCameraAnimation);
    dom.btnLoopCamera?.addEventListener('click', toggleCameraLoop);
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
    });

    // 文件拖拽
    console.log(`[Editor ${state.VERSION}] Setting up drag and drop...`);
    document.addEventListener('dragover', (e) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'copy';
    });

    document.addEventListener('drop', async (e) => {
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
        if (e.key === 'Escape' && dom.helpTipsModal && !dom.helpTipsModal.classList.contains('hidden')) {
            closeHelpTipsModal();
            return;
        }
        if (e.key === 'Escape' && dom.exportModal && !dom.exportModal.classList.contains('hidden')) {
            closeExportModal();
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
    initTheme();

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
    state.cameraSequenceVisible = Boolean(app.getCameraSequenceVisible?.() ?? state.cameraSequenceVisible);

    // 注册模型变化回调
    app.onModelsChanged((models) => {
        updateModelList();
        updateModelAnimationControls(state.selectedModelId);
        
        let maxEnd = state.timelineDurationSec;
        for (const model of models) {
             if (model.isDynamic && model.modelEntry && model.modelEntry.animEndTime) {
                  maxEnd = Math.max(maxEnd, model.modelEntry.animEndTime);
             }
        }
        if (maxEnd > state.timelineDurationSec && Number.isFinite(maxEnd)) {
            state.timelineDurationSec = maxEnd;
            if (typeof updateTimelineUI === 'function') updateTimelineUI();
            showInfo(`时间轴已自动适配到 ${maxEnd.toFixed(1)}s`);
        }
        
        if (typeof renderModelTracks === 'function') renderModelTracks();
    });
    app.onCameraInteraction?.((kind) => {
        if (!state.isPlaying) return;
        if (kind !== 'drag' && kind !== 'wheel' && kind !== 'keyboard') return;
        stopTimelinePlayback(false);
        showInfo('相机动画: 已暂停（手动控制）');
    });

    registerDebugHooks();

    // 同步渲染模式（颜色/深度/法向）到核心渲染器
    setExportMode(state.exportMode);

    // 初始化事件监听
    initEventListeners();
    initSceneSettingsUI();
    initTimelineUI();
    closeEditor();
    startAnimationControlsSyncLoop();

    // 初始化时间轴按钮状态
    updatePlayButtonUI();
    if (dom.btnLoopCamera) {
        dom.btnLoopCamera.classList.toggle('active', state.isLooping);
    }

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
