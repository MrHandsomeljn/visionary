(function installEditorModuleLoadGuard() {
    const reportEndpoint = '/api/client-errors/module-load';
    const moduleErrorPattern = /(?:requested module .* does not provide an export named|failed to fetch dynamically imported module|importing a module script failed|error loading dynamically imported module|cannot use import statement outside a module)/i;
    let reported = false;
    let genericModuleErrorTimer = null;

    function getErrorDetails(value) {
        if (value instanceof Error) {
            return {
                message: value.message || value.name,
                isSyntaxError: value instanceof SyntaxError,
            };
        }
        return {
            message: String(value?.message || value || '').trim(),
            isSyntaxError: false,
        };
    }

    function isRelevantModuleError(details) {
        const bootOverlay = document.getElementById('bootLoadingOverlay');
        const editorIsBooting = Boolean(bootOverlay && !bootOverlay.classList.contains('hidden'));
        return moduleErrorPattern.test(details.message) || (details.isSyntaxError && editorIsBooting);
    }

    function getPromptText() {
        let language = '';
        try {
            language = localStorage.getItem('visionary_editor_ui_language_v1') || '';
        } catch {
            language = '';
        }
        if (language === 'en') {
            return {
                title: 'Editor code failed to load',
                detail: 'The frontend modules on the server may be temporarily inconsistent while code is being updated. Refresh after the deployment finishes. If this persists, contact the developer.',
                reload: 'Refresh page',
            };
        }
        return {
            title: '编辑器代码加载失败',
            detail: '服务器上的前端模块可能因代码正在更新而暂时不一致。请等待部署完成后刷新页面；如果持续出现，请联系开发者。',
            reload: '刷新页面',
        };
    }

    function showFrontendPrompt() {
        const prompt = getPromptText();
        const overlay = document.getElementById('bootLoadingOverlay');
        if (!overlay) {
            alert(`${prompt.title}\n\n${prompt.detail}`);
            return;
        }

        overlay.classList.remove('hidden');
        overlay.setAttribute('aria-busy', 'false');
        overlay.querySelector('.spinner')?.remove();
        const title = overlay.querySelector('.loading-text');
        const detail = overlay.querySelector('.loading-detail');
        if (title) title.textContent = prompt.title;
        if (detail) detail.textContent = prompt.detail;

        if (!overlay.querySelector('[data-module-load-reload]')) {
            const reloadButton = document.createElement('button');
            reloadButton.type = 'button';
            reloadButton.className = 'button button-primary';
            reloadButton.dataset.moduleLoadReload = 'true';
            reloadButton.textContent = prompt.reload;
            reloadButton.addEventListener('click', () => window.location.reload());
            overlay.append(reloadButton);
        }
    }

    function reportModuleLoadError(details, source = '', line = null, column = null) {
        if (reported) return;
        reported = true;
        if (genericModuleErrorTimer !== null) {
            clearTimeout(genericModuleErrorTimer);
            genericModuleErrorTimer = null;
        }

        const message = details.message || 'Editor entry module failed to load';
        console.error('[Visionary] Frontend module load failed:', message);
        showFrontendPrompt();
        void fetch(reportEndpoint, {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({
                message,
                source,
                line,
                column,
                pageUrl: window.location.href,
                userAgent: navigator.userAgent,
            }),
            keepalive: true,
        }).catch(() => {});
    }

    window.addEventListener('error', (event) => {
        const details = getErrorDetails(event.error || event.message);
        if (isRelevantModuleError(details)) {
            reportModuleLoadError(details, event.filename, event.lineno, event.colno);
            return;
        }

        const target = event.target;
        if (target instanceof HTMLScriptElement && target.type === 'module') {
            genericModuleErrorTimer = window.setTimeout(() => {
                reportModuleLoadError(
                    { message: 'Editor entry module failed to load', isSyntaxError: false },
                    target.src,
                );
            }, 0);
        }
    }, true);

    window.addEventListener('unhandledrejection', (event) => {
        const details = getErrorDetails(event.reason);
        if (isRelevantModuleError(details)) {
            reportModuleLoadError(details);
        }
    });
})();
