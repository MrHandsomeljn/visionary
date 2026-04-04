export const AGENT_MESSAGE_BOTTOM_PIN_THRESHOLD_PX = 2;

function clampScrollTop(scrollTop = 0, clientHeight = 0, scrollHeight = 0) {
    const maxScrollTop = Math.max(0, Number(scrollHeight) - Number(clientHeight));
    return Math.max(0, Math.min(maxScrollTop, Number(scrollTop) || 0));
}

export function isAgentMessageScrollPinnedToBottom({
    scrollTop = 0,
    clientHeight = 0,
    scrollHeight = 0,
    threshold = AGENT_MESSAGE_BOTTOM_PIN_THRESHOLD_PX,
} = {}) {
    const safeScrollTop = clampScrollTop(scrollTop, clientHeight, scrollHeight);
    const maxScrollTop = Math.max(0, Number(scrollHeight) - Number(clientHeight));
    return maxScrollTop - safeScrollTop <= Number(threshold);
}

export function resolveAgentMessageRefreshScrollTop({
    mode = 'preserve-or-pin-bottom',
    prevScrollTop = 0,
    prevClientHeight = 0,
    prevScrollHeight = 0,
    nextScrollHeight = prevScrollHeight,
    threshold = AGENT_MESSAGE_BOTTOM_PIN_THRESHOLD_PX,
} = {}) {
    if (mode === 'always') {
        return clampScrollTop(nextScrollHeight, prevClientHeight, nextScrollHeight);
    }

    if (mode === 'preserve-or-pin-bottom'
        && isAgentMessageScrollPinnedToBottom({
            scrollTop: prevScrollTop,
            clientHeight: prevClientHeight,
            scrollHeight: prevScrollHeight,
            threshold,
        })) {
        return clampScrollTop(nextScrollHeight, prevClientHeight, nextScrollHeight);
    }

    return clampScrollTop(prevScrollTop, prevClientHeight, nextScrollHeight);
}

export function shouldForceAgentMessageBottomAfterRender({
    mode = 'preserve-or-pin-bottom',
    prevScrollTop = 0,
    prevClientHeight = 0,
    prevScrollHeight = 0,
    threshold = AGENT_MESSAGE_BOTTOM_PIN_THRESHOLD_PX,
} = {}) {
    if (mode === 'always') {
        return true;
    }

    if (mode !== 'preserve-or-pin-bottom') {
        return false;
    }

    return isAgentMessageScrollPinnedToBottom({
        scrollTop: prevScrollTop,
        clientHeight: prevClientHeight,
        scrollHeight: prevScrollHeight,
        threshold,
    });
}
