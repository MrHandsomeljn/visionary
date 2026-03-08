/**
 * Visionary Editor UI Controller 0.0.6
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
    btnThemeToggle: document.getElementById('btnThemeToggle'),

    // 模式按钮
    modeColor: document.getElementById('modeColor'),
    modeDepth: document.getElementById('modeDepth'),
    modeNormal: document.getElementById('modeNormal'),
    btnRenderVideo: document.getElementById('renderVideo'),
    btnRenderImage: document.getElementById('renderImage'),

    // 中部区域
    leftSidebar: document.getElementById('left-sidebar'),
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
    btnModelAnimPlayPause: document.getElementById('btnModelAnimPlayPause'),
    btnModelAnimLoop: document.getElementById('btnModelAnimLoop'),
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
    timelineSlider: document.getElementById('timelineSlider'),
    timeValue: document.getElementById('timeValue'),

    // 文件输入
    fileInput: document.getElementById('fileInput'),
    modalFileInput: document.getElementById('modalFileInput'),

    // 模态框
    modelModal: document.getElementById('modelModal'),
    modalCancel: document.getElementById('modalCancel'),
    modalConfirm: document.getElementById('modalConfirm'),

    // 版本标签
    versionLabel: document.getElementById('versionLabel'),
};

// 应用状态
const state = {
    VERSION: '0.0.6',
    renderMode: 'video', // 'video' | 'image'
    exportMode: 'color', // 'color' | 'depth' | 'normal'
    selectedModelId: null,
    currentTime: 0,
    isPlaying: false,
    isLooping: false,
    keyframes: [],
    currentKeyframeIndex: -1,
    sceneBackgroundHex: '#050814',
    sceneSkyPresetId: 'night',
    sceneDepthRangeScale: 1.0,
};

// EditorApp 实例 (会在 init 后设置)
let app = null;
let animationUiSyncTimer = null;
let labelDragState = null;
let isInputLabelDragging = false;
const THEME_STORAGE_KEY = 'visionary_editor_theme';

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

    syncSceneBackgroundInputs();
    syncSceneDepthRangeInputs();
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

/**
 * 更新模型列表 UI
 */
function updateModelList() {
    if (!app || !dom.modelList) return;
    const models = app.getModels();

    if (models.length === 0) {
        dom.modelList.innerHTML = '<div class="empty-list">' +
            '<p>暂无模型</p>' +
            '<p class="empty-hint">拖拽文件到此处，或点击下方按钮</p>' +
            '</div>';
    } else {
        dom.modelList.innerHTML = models.map((model) => `
            <div class="model-item ${state.selectedModelId === model.id ? 'selected' : ''}" data-id="${model.id}">
                <span class="model-name">${model.name}</span>
                <span class="model-points">${model.pointCount.toLocaleString()} 点</span>
                <button class="model-visibility-btn ${model.visible ? 'active' : ''}" data-id="${model.id}" title="切换可见性">
                    ${model.visible ? '可见' : '隐藏'}
                </button>
                <span class="model-remove" data-id="${model.id}" title="删除">删除</span>
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

    if (dom.btnModelAnimPlayPause) {
        const icon = dom.btnModelAnimPlayPause.querySelector('.btn-icon');
        const text = dom.btnModelAnimPlayPause.querySelector('.btn-text');
        if (anim.isPlaying) {
            dom.btnModelAnimPlayPause.classList.add('active');
            if (text) text.textContent = '暂停';
        } else {
            dom.btnModelAnimPlayPause.classList.remove('active');
            if (text) text.textContent = '播放';
        }
    }

    if (dom.btnModelAnimLoop) {
        dom.btnModelAnimLoop.classList.toggle('active', anim.isLooping);
    }

    if (dom.modelAnimSpeed) {
        dom.modelAnimSpeed.value = Number(anim.speed || 1).toFixed(3);
    }
    if (dom.modelAnimSpeedValue) {
        dom.modelAnimSpeedValue.textContent = `${Number(anim.speed || 1).toFixed(3)}x`;
    }
}

function toggleSelectedModelAnimationPlayPause() {
    if (!app || !state.selectedModelId) return;
    const anim = getSelectedModelAnimationState();
    if (!anim || !anim.supported) return;

    const targetPlaying = !anim.isPlaying;
    app.setModelAnimationPlaying(state.selectedModelId, targetPlaying);
    updateModelAnimationControls(state.selectedModelId);
    showInfo(`模型动画: ${targetPlaying ? '播放' : '暂停'}`);
}

function toggleSelectedModelAnimationLoop() {
    if (!app || !state.selectedModelId) return;
    const anim = getSelectedModelAnimationState();
    if (!anim || !anim.supported) return;

    const targetLooping = !anim.isLooping;
    app.setModelAnimationLoop(state.selectedModelId, targetLooping);
    updateModelAnimationControls(state.selectedModelId);
    showInfo(`模型动画循环: ${targetLooping ? '开启' : '关闭'}`);
}

function updateSelectedModelAnimationSpeed() {
    if (!app || !state.selectedModelId || !dom.modelAnimSpeed) return;
    const speed = Math.max(0.001, parseFloat(dom.modelAnimSpeed.value || '1'));
    app.setModelAnimationSpeed(state.selectedModelId, speed);
    if (dom.modelAnimSpeedValue) {
        dom.modelAnimSpeedValue.textContent = `${speed.toFixed(3)}x`;
    }
}

/**
 * 设置渲染模式
 */
function setRenderMode(mode) {
    state.renderMode = mode;
    if (dom.btnRenderVideo) dom.btnRenderVideo.classList.toggle('menu-btn-active', mode === 'video');
    if (dom.btnRenderImage) dom.btnRenderImage.classList.toggle('menu-btn-active', mode === 'image');
    showInfo(`渲染模式: ${mode}`);
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
function setExportMode(mode) {
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
    showInfo(`显示模式: ${labelMap[mode] || mode}`);
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

/**
 * 添加关键帧（占位符）
 */
function addKeyframe() {
    const camera = app?.getCamera();
    if (camera) {
        const keyframe = {
            time: state.currentTime,
            camera: camera
        };
        state.keyframes.push(keyframe);
        updateTimelineUI();
    }
    showInfo('addKeyframe - 占位符（功能开发中）');
}

/**
 * 删除关键帧
 */
function removeKeyframe() {
    if (state.keyframes.length > 0) {
        state.keyframes.pop();
        updateTimelineUI();
        showInfo('removeKeyframe - 占位符（功能开发中）');
    }
}

/**
 * 更新时间轴 UI
 */
function updateTimelineUI() {
    const count = state.keyframes.length;
    showInfo(`关键帧数量: ${count}`);
}

/**
 * 更新播放按钮 UI
 */
function updatePlayButtonUI() {
    if (!dom.btnPlayCamera) return;
    const icon = dom.btnPlayCamera.querySelector('.btn-icon');
    if (state.isPlaying) {
        dom.btnPlayCamera.classList.add('active');
        if (icon) icon.textContent = '||';
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
 * 播放/暂停相机动画（占位）
 */
function playCameraAnimation() {
    state.isPlaying = !state.isPlaying;
    showInfo(`相机动画: ${state.isPlaying ? '播放' : '暂停'}（占位）`);
    updatePlayButtonUI();
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
    showInfo(`相机动画循环: ${state.isLooping ? '开启' : '关闭'}（占位）`);
}

/**
 * 更新时间显示
 */
function updateTimeDisplay() {
    if (dom.timeValue) dom.timeValue.textContent = `${state.currentTime.toFixed(3)}s`;
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

    // 场景菜单
    dom.btnSaveScene?.addEventListener('click', saveScene);
    dom.btnLoadScene?.addEventListener('click', loadScene);
    dom.btnClearScene?.addEventListener('click', clearScene);

    // 模式按钮
    dom.modeColor?.addEventListener('click', () => setExportMode('color'));
    dom.modeDepth?.addEventListener('click', () => setExportMode('depth'));
    dom.modeNormal?.addEventListener('click', () => setExportMode('normal'));

    // 渲染模式
    dom.btnRenderVideo?.addEventListener('click', () => setRenderMode('video'));
    dom.btnRenderImage?.addEventListener('click', () => setRenderMode('image'));
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

    dom.btnModelAnimPlayPause?.addEventListener('click', toggleSelectedModelAnimationPlayPause);
    dom.btnModelAnimLoop?.addEventListener('click', toggleSelectedModelAnimationLoop);
    dom.modelAnimSpeed?.addEventListener('input', updateSelectedModelAnimationSpeed);

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
    dom.timelineSlider?.addEventListener('input', (e) => {
        state.currentTime = parseFloat(e.target.value);
        updateTimeDisplay();
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

    // 注册模型变化回调
    app.onModelsChanged((models) => {
        updateModelList();
        updateModelAnimationControls(state.selectedModelId);
    });

    registerDebugHooks();

    // 同步渲染模式（颜色/深度/法向）到核心渲染器
    setExportMode(state.exportMode);

    // 初始化事件监听
    initEventListeners();
    initSceneSettingsUI();
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
    console.log('模型加载：已实现（支持 .ply, .onnx, .splat, .ksplat 等）');
    console.log('相机控制：已实现（轨道/自由模式，预设视角）');
    console.log('');
    console.log('请测试以下功能：');
    console.log('1. 点击"添加模型"按钮，选择文件');
    console.log('2. 拖拽 .ply 或 .onnx 文件到页面');
    console.log('3. 使用鼠标控制相机（左键旋转，右键平移，滚轮缩放）');
    console.log('');
    console.log('调试信息：');
    console.log('- 打开浏览器开发者工具查看控制台输出');
    console.log('- 如果有问题，请提供控制台错误信息');
    console.log('- 版本号：', state.VERSION);
}

// 启动应用
document.addEventListener('DOMContentLoaded', init);
