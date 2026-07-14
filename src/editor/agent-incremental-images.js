function clampImageIndex(images, index) {
    return Math.max(0, Math.min(images.length - 1, Number(index) || 0));
}

export function getAgentImageStableKey(image) {
    return String(
        image?.id
        || image?.relativePath
        || image?.assetPath
        || image?.src
        || '',
    ).trim();
}

function getAgentImageSourceOrdinal(image) {
    const ordinal = Number(image?.metadata?.sourceOrdinal);
    if (Number.isInteger(ordinal) && ordinal >= 0) return ordinal;
    const idMatch = /^component_3d_(\d+)$/i.exec(String(image?.id || '').trim());
    const idOrdinal = Number(idMatch?.[1]);
    return Number.isInteger(idOrdinal) && idOrdinal > 0 ? idOrdinal - 1 : null;
}

export function resolveAgentImageSelectionIndex(images = [], selectedImage = null, fallbackIndex = 0) {
    const gallery = Array.isArray(images) ? images : [];
    if (gallery.length <= 0) return 0;
    const selectedKey = getAgentImageStableKey(selectedImage);
    if (selectedKey) {
        const resolvedIndex = gallery.findIndex((image) => getAgentImageStableKey(image) === selectedKey);
        if (resolvedIndex >= 0) return resolvedIndex;
    }
    return clampImageIndex(gallery, fallbackIndex);
}

export function mergeAgentIncrementalImages(currentImages = [], incomingImages = [], selectedIndex = 0) {
    const current = Array.isArray(currentImages) ? currentImages : [];
    const incoming = Array.isArray(incomingImages) ? incomingImages : [];
    const selectedImage = current[clampImageIndex(current, selectedIndex)] || null;
    const orderByKey = new Map();
    const imagesByKey = new Map();

    [...current, ...incoming].forEach((image, index) => {
        const key = getAgentImageStableKey(image);
        if (!key) return;
        if (!orderByKey.has(key)) orderByKey.set(key, index);
        const previous = imagesByKey.get(key);
        imagesByKey.set(key, previous
            ? {
                ...previous,
                ...image,
                metadata: {
                    ...(previous.metadata && typeof previous.metadata === 'object' ? previous.metadata : {}),
                    ...(image?.metadata && typeof image.metadata === 'object' ? image.metadata : {}),
                },
            }
            : image);
    });

    const images = Array.from(imagesByKey.entries())
        .sort(([leftKey, left], [rightKey, right]) => {
            const leftOrdinal = getAgentImageSourceOrdinal(left);
            const rightOrdinal = getAgentImageSourceOrdinal(right);
            if (leftOrdinal !== null && rightOrdinal !== null && leftOrdinal !== rightOrdinal) {
                return leftOrdinal - rightOrdinal;
            }
            return (orderByKey.get(leftKey) || 0) - (orderByKey.get(rightKey) || 0);
        })
        .map(([, image]) => image);

    return {
        images,
        selectedIndex: selectedImage
            ? resolveAgentImageSelectionIndex(images, selectedImage, selectedIndex)
            : 0,
    };
}
