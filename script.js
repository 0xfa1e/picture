document.addEventListener('DOMContentLoaded', function() {
    const dropZone = document.getElementById('dropZone');
    const fileInput = document.getElementById('fileInput');
    const uploadBtn = document.querySelector('.upload-btn');
    const previewSection = document.querySelector('.preview-section');
    const originalImage = document.getElementById('originalImage');
    const compressedImage = document.getElementById('compressedImage');
    const originalSize = document.getElementById('originalSize');
    const compressedSize = document.getElementById('compressedSize');
    const qualitySlider = document.getElementById('quality');
    const qualityValue = document.getElementById('qualityValue');
    const downloadBtn = document.getElementById('downloadBtn');
    const toggleCropBtn = document.getElementById('toggleCropBtn');
    const resetCropBtn = document.getElementById('resetCropBtn');

    let originalFile = null;
    let isCroppingMode = true;
    let isDraggingCrop = false;
    let isMovingCrop = false;
    let isResizingCrop = false;
    let resizeDir = '';
    let dragStart = { x: 0, y: 0 };
    let cropRectDisplay = { x: 0, y: 0, width: 0, height: 0 };
    let activeCrop = null; // { sx, sy, sWidth, sHeight }
    const MIN_SIZE = 20;

    // 裁剪 UI 元素
    const originalImageContainer = originalImage.closest('.image-container');
    const cropOverlay = document.createElement('div');
    cropOverlay.className = 'crop-overlay';
    cropOverlay.style.display = 'block';
    const cropRectEl = document.createElement('div');
    cropRectEl.className = 'crop-rect';
    cropRectEl.style.display = 'block';
    originalImageContainer.appendChild(cropOverlay);
    originalImageContainer.appendChild(cropRectEl);

    // 创建 8 个缩放手柄
    const handleDirs = ['nw','n','ne','e','se','s','sw','w'];
    handleDirs.forEach((dir) => {
        const h = document.createElement('div');
        h.className = `crop-handle handle-${dir}`;
        h.dataset.dir = dir;
        cropRectEl.appendChild(h);
        h.addEventListener('mousedown', (e) => {
            if (!isCroppingMode) return;
            e.stopPropagation();
            isResizingCrop = true;
            resizeDir = dir;
        });
    });

    // 处理文件上传
    function handleFile(file) {
        if (!file.type.startsWith('image/')) {
            alert('请上传图片文件！');
            return;
        }

        originalFile = file;
        originalSize.textContent = formatFileSize(file.size);

        const reader = new FileReader();
        reader.onload = function(e) {
            originalImage.onload = function() {
                cropOverlay.style.display = 'block';
                cropRectEl.style.display = 'block';
                setCropDisplayToFull();
                resetCropBtn.style.display = 'inline-block';
                recompressCurrent();
            };
            originalImage.src = e.target.result;
        };
        reader.readAsDataURL(file);

        previewSection.style.display = 'block';
    }

    // 压缩图片
    function compressImage(src, quality, crop) {
        const img = new Image();
        img.onload = function() {
            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d');

            if (crop && crop.sWidth > 0 && crop.sHeight > 0) {
                canvas.width = crop.sWidth;
                canvas.height = crop.sHeight;
                ctx.drawImage(
                    img,
                    crop.sx,
                    crop.sy,
                    crop.sWidth,
                    crop.sHeight,
                    0,
                    0,
                    crop.sWidth,
                    crop.sHeight
                );
            } else {
                canvas.width = img.width;
                canvas.height = img.height;
                ctx.drawImage(img, 0, 0);
            }

            const compressedDataUrl = canvas.toDataURL('image/jpeg', quality);
            compressedImage.src = compressedDataUrl;

            // 计算压缩后的文件大小
            const base64str = compressedDataUrl.split(',')[1];
            const compressedBytes = atob(base64str).length;
            compressedSize.textContent = formatFileSize(compressedBytes);
        };
        img.src = src;
    }

    function recompressCurrent() {
        if (!originalFile) return;
        const reader = new FileReader();
        reader.onload = function(e) {
            compressImage(e.target.result, qualitySlider.value / 100, activeCrop);
        };
        reader.readAsDataURL(originalFile);
    }

    function setCropDisplayToFull() {
        const w = originalImage.clientWidth;
        const h = originalImage.clientHeight;
        if (!w || !h) return;
        cropRectDisplay = { x: 0, y: 0, width: w, height: h };
        updateCropRectEl();
        updateActiveCropFromDisplay();
    }

    function updateActiveCropFromDisplay() {
        const displayWidth = originalImage.clientWidth;
        const displayHeight = originalImage.clientHeight;
        if (!displayWidth || !displayHeight) return;
        const scaleX = originalImage.naturalWidth / displayWidth;
        const scaleY = originalImage.naturalHeight / displayHeight;
        const sx = Math.round(cropRectDisplay.x * scaleX);
        const sy = Math.round(cropRectDisplay.y * scaleY);
        const sWidth = Math.round(cropRectDisplay.width * scaleX);
        const sHeight = Math.round(cropRectDisplay.height * scaleY);
        const bounded = boundCrop({
            sx,
            sy,
            sWidth,
            sHeight,
            maxW: originalImage.naturalWidth,
            maxH: originalImage.naturalHeight
        });
        activeCrop = bounded;
    }

    // 格式化文件大小
    function formatFileSize(bytes) {
        if (bytes < 1024) return bytes + ' B';
        if (bytes < 1048576) return (bytes / 1024).toFixed(2) + ' KB';
        return (bytes / 1048576).toFixed(2) + ' MB';
    }

    // 事件监听器
    dropZone.addEventListener('dragover', (e) => {
        e.preventDefault();
        dropZone.style.borderColor = getComputedStyle(document.documentElement).getPropertyValue('--primary-color').trim();
    });

    dropZone.addEventListener('dragleave', (e) => {
        e.preventDefault();
        dropZone.style.borderColor = '#DEDEDE';
    });

    dropZone.addEventListener('drop', (e) => {
        e.preventDefault();
        dropZone.style.borderColor = '#DEDEDE';
        handleFile(e.dataTransfer.files[0]);
    });

    uploadBtn.addEventListener('click', () => {
        fileInput.click();
    });

    fileInput.addEventListener('change', (e) => {
        handleFile(e.target.files[0]);
    });

    qualitySlider.addEventListener('input', (e) => {
        qualityValue.textContent = e.target.value + '%';
        recompressCurrent();
    });

    downloadBtn.addEventListener('click', () => {
        const link = document.createElement('a');
        link.download = 'compressed-image.jpg';
        link.href = compressedImage.src;
        link.click();
    });

    // 裁剪开关按钮默认隐藏（始终为裁剪模式）
    if (toggleCropBtn) {
        toggleCropBtn.style.display = 'none';
    }

    resetCropBtn.addEventListener('click', () => {
        // 恢复为默认全图裁剪，并保持裁剪框可见
        isDraggingCrop = false;
        isMovingCrop = false;
        isResizingCrop = false;
        cropOverlay.style.display = 'block';
        cropRectEl.style.display = 'block';
        setCropDisplayToFull();
        resetCropBtn.style.display = 'inline-block';
        recompressCurrent();
    });

    // 在裁剪矩形内部拖动：移动位置
    cropRectEl.addEventListener('mousedown', (e) => {
        if (!isCroppingMode) return;
        if (e.target.classList.contains('crop-handle')) return; // 由手柄处理
        isMovingCrop = true;
        const rect = cropOverlay.getBoundingClientRect();
        const cropRectBox = cropRectEl.getBoundingClientRect();
        dragStart = { x: e.clientX - cropRectBox.left, y: e.clientY - cropRectBox.top };
    });

    // 在空白区域拖拽：创建新裁剪框
    cropOverlay.addEventListener('mousedown', (e) => {
        if (!isCroppingMode) return;
        const bounds = cropOverlay.getBoundingClientRect();
        const startX = Math.max(0, Math.min(e.clientX - bounds.left, bounds.width));
        const startY = Math.max(0, Math.min(e.clientY - bounds.top, bounds.height));
        isDraggingCrop = true;
        dragStart = { x: startX, y: startY };
        cropRectDisplay = { x: startX, y: startY, width: 0, height: 0 };
        updateCropRectEl();
        cropRectEl.style.display = 'block';
    });

    window.addEventListener('mousemove', (e) => {
        const rect = cropOverlay.getBoundingClientRect();
        if (isDraggingCrop) {
            const currentX = Math.max(0, Math.min(e.clientX - rect.left, rect.width));
            const currentY = Math.max(0, Math.min(e.clientY - rect.top, rect.height));
            const x = Math.min(dragStart.x, currentX);
            const y = Math.min(dragStart.y, currentY);
            const w = Math.abs(currentX - dragStart.x);
            const h = Math.abs(currentY - dragStart.y);
            cropRectDisplay = { x, y, width: Math.max(MIN_SIZE, w), height: Math.max(MIN_SIZE, h) };
            updateCropRectEl();
        }
        if (isMovingCrop) {
            const newLeft = Math.min(Math.max(0, e.clientX - rect.left - dragStart.x), rect.width - cropRectDisplay.width);
            const newTop = Math.min(Math.max(0, e.clientY - rect.top - dragStart.y), rect.height - cropRectDisplay.height);
            cropRectDisplay.x = newLeft;
            cropRectDisplay.y = newTop;
            updateCropRectEl();
        }
        if (isResizingCrop) {
            const mouseX = Math.max(0, Math.min(e.clientX - rect.left, rect.width));
            const mouseY = Math.max(0, Math.min(e.clientY - rect.top, rect.height));
            let { x, y, width, height } = cropRectDisplay;
            const right = x + width;
            const bottom = y + height;
            switch (resizeDir) {
                case 'nw':
                    x = Math.min(mouseX, right - MIN_SIZE);
                    y = Math.min(mouseY, bottom - MIN_SIZE);
                    width = right - x;
                    height = bottom - y;
                    break;
                case 'ne':
                    y = Math.min(mouseY, bottom - MIN_SIZE);
                    width = Math.max(MIN_SIZE, mouseX - x);
                    height = bottom - y;
                    break;
                case 'se':
                    width = Math.max(MIN_SIZE, mouseX - x);
                    height = Math.max(MIN_SIZE, mouseY - y);
                    break;
                case 'sw':
                    x = Math.min(mouseX, right - MIN_SIZE);
                    width = right - x;
                    height = Math.max(MIN_SIZE, mouseY - y);
                    break;
                case 'n':
                    y = Math.min(mouseY, bottom - MIN_SIZE);
                    height = bottom - y;
                    break;
                case 's':
                    height = Math.max(MIN_SIZE, mouseY - y);
                    break;
                case 'e':
                    width = Math.max(MIN_SIZE, mouseX - x);
                    break;
                case 'w':
                    x = Math.min(mouseX, right - MIN_SIZE);
                    width = right - x;
                    break;
                default:
                    break;
            }
            // 边界限制
            x = Math.max(0, x);
            y = Math.max(0, y);
            width = Math.min(rect.width - x, width);
            height = Math.min(rect.height - y, height);
            cropRectDisplay = { x, y, width, height };
            updateCropRectEl();
        }
    });

    window.addEventListener('mouseup', () => {
        if (!(isDraggingCrop || isMovingCrop || isResizingCrop)) return;
        isDraggingCrop = false;
        isMovingCrop = false;
        isResizingCrop = false;
        updateActiveCropFromDisplay();
        resetCropBtn.style.display = 'inline-block';
        recompressCurrent();
    });

    function updateCropRectEl() {
        cropRectEl.style.left = cropRectDisplay.x + 'px';
        cropRectEl.style.top = cropRectDisplay.y + 'px';
        cropRectEl.style.width = cropRectDisplay.width + 'px';
        cropRectEl.style.height = cropRectDisplay.height + 'px';
    }

    function boundCrop({ sx, sy, sWidth, sHeight, maxW, maxH }) {
        const bx = Math.max(0, Math.min(sx, maxW));
        const by = Math.max(0, Math.min(sy, maxH));
        const bw = Math.max(1, Math.min(sWidth, maxW - bx));
        const bh = Math.max(1, Math.min(sHeight, maxH - by));
        return { sx: bx, sy: by, sWidth: bw, sHeight: bh };
    }
}); 