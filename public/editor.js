/**
 * Visionary Editor UI Controller 0.05
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
    btnClearScene: document.getElementById('btnClearScene'),

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
    btnLoadModels: document.getElementById('btnLoadModels'),

    // 右侧边栏 - 模型编辑器
    rightSidebar: document.getElementById('right-sidebar'),
    selectedModelName: document.getElementById('selectedModelName'),
    btnCloseEditor: document.getElementById('btnCloseEditor'),

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

    // 可见性
    btnToggleVisible: document.getElementById('btnToggleVisible'),
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
    VERSION: '0.05',
    renderMode: 'video', // 'video' | 'image'
    exportMode: 'color', // 'color' | 'depth' | 'normal'
    selectedModelId: null,
    currentTime: 0,
    isPlaying: false,
    isLooping: false,
    keyframes: [],
    currentKeyframeIndex: -1,
};

// EditorApp 实例 (会在 init 后设置)
let app = null;

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
            '<div class="empty-icon">📁</div>' +
            '<p>暂无模型</p>' +
            '<p class="empty-hint">拖拽文件到此处，或点击下方按钮</p>' +
            '</div>';
    } else {
        dom.modelList.innerHTML = models.map((model) => `
            <div class="model-item ${state.selectedModelId === model.id ? 'selected' : ''}" data-id="${model.id}">
                <span class="model-name">${model.name}</span>
                <span class="model-points">${model.pointCount.toLocaleString()} 点</span>
                <span class="model-visibility">${model.visible ? '👁' : '🚫'}</span>
                <span class="model-remove" data-id="${model.id}" title="删除">✕</span>
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
    if (dom.rightSidebar) dom.rightSidebar.classList.remove('hidden');
    if (dom.selectedModelName) dom.selectedModelName.textContent = model.name;

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
    if (dom.posX) dom.posX.value = model.position.x.toFixed(2);
    if (dom.posY) dom.posY.value = model.position.y.toFixed(2);
    if (dom.posZ) dom.posZ.value = model.position.z.toFixed(2);

    // 旋转（转换为角度）
    if (dom.rotX) dom.rotX.value = (model.rotation.x * 180 / Math.PI).toFixed(2);
    if (dom.rotY) dom.rotY.value = (model.rotation.y * 180 / Math.PI).toFixed(2);
    if (dom.rotZ) dom.rotZ.value = (model.rotation.z * 180 / Math.PI).toFixed(2);

    // 缩放
    if (dom.scaleS) dom.scaleS.value = model.scale.toFixed(2);

    // 可见性
    updateVisibilityToggle(model.visible);
}

/**
 * 更新可见性按钮状态
 */
function updateVisibilityToggle(isVisible) {
    const toggleIcon = dom.btnToggleVisible?.querySelector('.toggle-icon');
    const toggleLabel = dom.btnToggleVisible?.querySelector('.toggle-label');

    if (dom.btnToggleVisible) {
        if (isVisible) {
            dom.btnToggleVisible.classList.add('active');
            if (toggleIcon) toggleIcon.textContent = '👁';
            if (toggleLabel) toggleLabel.textContent = '可见';
        } else {
            dom.btnToggleVisible.classList.remove('active');
            if (toggleIcon) toggleIcon.textContent = '🚫';
            if (toggleLabel) toggleLabel.textContent = '隐藏';
        }
    }
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

    showInfo('模型已更新');
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
 * 切换模型可见性
 */
function toggleModelVisibility() {
    if (!state.selectedModelId || !app) return;
    const model = app.getModel(state.selectedModelId);
    if (model) {
        const newVisible = !model.visible;
        app.setModelVisibility(state.selectedModelId, newVisible);
        updateVisibilityToggle(newVisible);
        updateModelList();
        showInfo(`模型可见性: ${newVisible ? '可见' : '隐藏'}`);
    }
}

/**
 * 关闭模型编辑器
 */
function closeEditor() {
    if (dom.rightSidebar) dom.rightSidebar.classList.add('hidden');
    if (dom.onnxAnimSection) dom.onnxAnimSection.classList.add('hidden');
    state.selectedModelId = null;
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
            if (icon) icon.textContent = '⏸️';
            if (text) text.textContent = '暂停';
        } else {
            dom.btnModelAnimPlayPause.classList.remove('active');
            if (icon) icon.textContent = '▶️';
            if (text) text.textContent = '播放';
        }
    }

    if (dom.btnModelAnimLoop) {
        dom.btnModelAnimLoop.classList.toggle('active', anim.isLooping);
    }

    if (dom.modelAnimSpeed) {
        dom.modelAnimSpeed.value = Number(anim.speed || 1).toFixed(1);
    }
    if (dom.modelAnimSpeedValue) {
        dom.modelAnimSpeedValue.textContent = `${Number(anim.speed || 1).toFixed(1)}x`;
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
    const speed = parseFloat(dom.modelAnimSpeed.value || '1');
    app.setModelAnimationSpeed(state.selectedModelId, speed);
    if (dom.modelAnimSpeedValue) {
        dom.modelAnimSpeedValue.textContent = `${speed.toFixed(1)}x`;
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

/**
 * 设置导出模式
 */
function setExportMode(mode) {
    state.exportMode = mode;
    if (dom.modeColor) dom.modeColor.classList.toggle('menu-btn-active', mode === 'color');
    if (dom.modeDepth) dom.modeDepth.classList.toggle('menu-btn-active', mode === 'depth');
    if (dom.modeNormal) dom.modeNormal.classList.toggle('menu-btn-active', mode === 'normal');
    showInfo(`导出模式: ${mode}`);
}

/**
 * 保存场景（占位符）
 */
function saveScene() {
    showInfo('saveScene - 占位符（功能开发中）');
    showError('保存场景功能正在开发中');
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
        if (icon) icon.textContent = '⏸️';
    } else {
        dom.btnPlayCamera.classList.remove('active');
        if (icon) icon.textContent = '▶️';
    }
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
    if (dom.timeValue) dom.timeValue.textContent = `${state.currentTime.toFixed(2)}s`;
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
    }
}

/**
 * 初始化事件监听
 */
function initEventListeners() {
    console.log(`[Editor ${state.VERSION}] Initializing event listeners...`);

    // 场景菜单
    dom.btnSaveScene?.addEventListener('click', saveScene);
    dom.btnClearScene?.addEventListener('click', clearScene);

    // 模式按钮
    dom.modeColor?.addEventListener('click', () => setExportMode('color'));
    dom.modeDepth?.addEventListener('click', () => setExportMode('depth'));
    dom.modeNormal?.addEventListener('click', () => setExportMode('normal'));

    // 渲染模式
    dom.btnRenderVideo?.addEventListener('click', () => setRenderMode('video'));
    dom.btnRenderImage?.addEventListener('click', () => setRenderMode('image'));

    // 模型操作 - 添加模型按钮（打开文件选择器）
    dom.btnAddModel?.addEventListener('click', openModelFileSelector);

    // 模型加载
    dom.btnLoadModels?.addEventListener('click', openModelFileSelector);

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

    // 可见性
    dom.btnToggleVisible?.addEventListener('click', toggleModelVisibility);
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
    if (!dom.btnLoadModels) {
        console.error(`[Editor ${state.VERSION}] btnLoadModels not found!`);
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

    // 初始化事件监听
    initEventListeners();

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
    console.log('✓ 3D 场景渲染：已实现（WebGPU + GaussianRenderer）');
    console.log('✓ 模型加载：已实现（支持 .ply, .onnx, .splat, .ksplat 等）');
    console.log('✓ 相机控制：已实现（轨道/自由模式，预设视角）');
    console.log('');
    console.log('请测试以下功能：');
    console.log('1. 点击"添加模型"或"加载模型"按钮，选择文件');
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
