// --- State Management ---
let currentMode = 0; // 0 = Single, 1 = Dual, 2 = Manual
const singleFile = { file: null };
const dualFiles = { small: null, large: null };
const manualFiles = { 16: null, 32: null, 48: null, 64: null, 128: null, 256: null };
let userPlatform = 'Unknown';

// --- UI Logic ---
function switchTab(index) {
    currentMode = index;

    // Tab Styles
    const btns = document.querySelectorAll('.tab-btn');
    btns.forEach((b, i) => i === index ? b.classList.add('active') : b.classList.remove('active'));

    // Indicator Animation
    const indicator = document.getElementById('tabIndicator');
    indicator.style.transform = `translateX(${index * 100}%)`;

    // View Visibility
    document.getElementById('view-single').classList.toggle('active', index === 0);
    document.getElementById('view-dual').classList.toggle('active', index === 1);
    document.getElementById('view-manual').classList.toggle('active', index === 2);

    // Preview remains consistent because we sync state.
    updateLivePreviews();
}

// --- Upload Handlers ---

function updateBoxUI(boxId, file) {
    const box = document.getElementById(boxId);
    if (!box) return;

    const thumb = box.querySelector('.thumb-preview');

    if (file) {
        box.classList.add('has-file');
        const reader = new FileReader();
        reader.onload = (e) => {
            thumb.style.backgroundImage = `url('${e.target.result}')`;
        };
        reader.readAsDataURL(file);
    } else {
        box.classList.remove('has-file');
        thumb.style.backgroundImage = 'none';
    }
}

function handleSingleUpload(input) {
    if (input.files && input.files[0]) {
        const file = input.files[0];
        singleFile.file = file;
        updateBoxUI('box-single', file);

        // Sync to all manual slots
        [16, 32, 48, 64, 128, 256].forEach(size => {
            manualFiles[size] = file;
            updateBoxUI(`box-manual-${size}`, file);
        });
        updateLivePreviews();
    }
}

function handleDualUpload(input, type) {
    if (input.files && input.files[0]) {
        const file = input.files[0];
        dualFiles[type] = file;
        updateBoxUI(input.parentElement.id, file);
        if (type === 'small') {
            manualFiles[16] = file;
            manualFiles[32] = file;
            updateBoxUI('box-manual-16', file);
            updateBoxUI('box-manual-32', file);
        } else if (type === 'large') {
            [48, 64, 128, 256].forEach(size => {
                manualFiles[size] = file;
                updateBoxUI(`box-manual-${size}`, file);
            });
        }
        updateLivePreviews();
    }
}

function handleManualUpload(input, size) {
    if (input.files && input.files[0]) {
        const file = input.files[0];
        manualFiles[size] = file;
        updateBoxUI(input.parentElement.id, file);
        updateLivePreviews();
    }
}

// --- Clear Logic ---
function clearAll() {
    // Reset State
    singleFile.file = null;
    dualFiles.small = null;
    dualFiles.large = null;
    for (let key in manualFiles) manualFiles[key] = null;
    document.querySelectorAll('input[type="file"]').forEach(input => input.value = '');
    document.querySelectorAll('.upload-box').forEach(box => {
        box.classList.remove('has-file');
        box.querySelector('.thumb-preview').style.backgroundImage = 'none';
    });
    updateLivePreviews();
}

// --- Drag & Drop Enhancements ---

document.querySelectorAll('.upload-box').forEach(box => {
    box.addEventListener('dragover', (e) => {
        e.preventDefault();
        box.classList.add('drag-over');
    });
    box.addEventListener('dragleave', (e) => {
        box.classList.remove('drag-over');
    });
    box.addEventListener('drop', (e) => {
        e.preventDefault();
        box.classList.remove('drag-over');
        const file = e.dataTransfer.files[0];
        if (file && (file.type === 'image/png' || file.type === 'image/jpeg')) {
            const input = box.querySelector('input');
            const dataTransfer = new DataTransfer();
            dataTransfer.items.add(file);
            input.files = dataTransfer.files;
            if (box.id === 'box-single') handleSingleUpload(input);
            else if (box.id.includes('dual-small')) handleDualUpload(input, 'small');
            else if (box.id.includes('dual-large')) handleDualUpload(input, 'large');
            else {
                const size = parseInt(box.id.split('-')[2]);
                handleManualUpload(input, size);
            }
        }
    });
});

// --- Live Preview Engine ---

async function updateLivePreviews() {
    const sizes = [256, 128, 64, 48, 32, 16];
    const loadedManuals = {};
    for (let s of sizes) {
        if (manualFiles[s]) loadedManuals[s] = await loadImage(manualFiles[s]);
    }
    let fallbackImg = null;
    for (let s of sizes) {
        if (loadedManuals[s]) {
            fallbackImg = loadedManuals[s];
            break;
        }
    }
    for (let s of sizes) {
        const imgEl = document.getElementById(`preview-${s}`);
        const emptyEl = document.getElementById(`empty-${s}`);
        const source = loadedManuals[s] || fallbackImg;

        if (source) {
            const dataUrl = await resizeToDataURL(source, s);
            imgEl.src = dataUrl;
            imgEl.style.display = 'block';
            emptyEl.style.display = 'none';
        } else {
            imgEl.style.display = 'none';
            emptyEl.style.display = 'block';
        }
    }
}

// --- Helpers ---

function loadImage(file) {
    return new Promise((resolve, reject) => {
        const img = new Image();
        img.onload = () => resolve(img);
        img.onerror = reject;
        img.src = URL.createObjectURL(file);
    });
}

function resizeToDataURL(img, size) {
    return new Promise((resolve) => {
        const canvas = document.createElement('canvas');
        canvas.width = size;
        canvas.height = size;
        const ctx = canvas.getContext('2d');
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'high';
        ctx.drawImage(img, 0, 0, size, size);
        resolve(canvas.toDataURL('image/png'));
    });
}

function resizeToBuffer(img, size) {
    return new Promise((resolve) => {
        const canvas = document.createElement('canvas');
        canvas.width = size;
        canvas.height = size;
        const ctx = canvas.getContext('2d');
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'high';
        ctx.drawImage(img, 0, 0, size, size);
        canvas.toBlob(blob => {
            const reader = new FileReader();
            reader.onloadend = () => resolve(new Uint8Array(reader.result));
            reader.readAsArrayBuffer(blob);
        }, 'image/png');
    });
}

// --- Generation ---

async function generateICO() {
    const btn = document.getElementById('generateBtn');
    const originalText = btn.textContent;
    try {
        const hasFiles = Object.values(manualFiles).some(f => f !== null);
        if (!hasFiles) throw new Error("Please upload an image first.");
        btn.disabled = true;
        btn.textContent = "Processing...";
        let icoPlan = [];
        const sizes = [16, 32, 48, 64, 128, 256];
        const loadedManuals = {};
        for (let s of sizes) {
            if (manualFiles[s]) loadedManuals[s] = await loadImage(manualFiles[s]);
        }
        let fallbackImg = null;
        for (let i = sizes.length - 1; i >= 0; i--) {
            if (loadedManuals[sizes[i]]) { fallbackImg = loadedManuals[sizes[i]]; break; }
        }
        for (let s of sizes) {
            const source = loadedManuals[s] || fallbackImg;
            const buffer = await resizeToBuffer(source, s);
            icoPlan.push({ size: s, buffer });
        }

        const blob = buildIcoBlob(icoPlan);
        downloadBlob(blob, 'icon.ico');

    } catch (err) {
        alert(err.message);
    } finally {
        btn.textContent = originalText;
        btn.disabled = false;
    }
}

function buildIcoBlob(images) {
    const numImages = images.length;
    const headerSize = 6;
    const directorySize = 16 * numImages;
    let currentOffset = headerSize + directorySize;
    const parts = [];
    const header = new Uint8Array(6);
    const view = new DataView(header.buffer);
    view.setUint16(0, 0, true);
    view.setUint16(2, 1, true);
    view.setUint16(4, numImages, true);
    parts.push(header);
    images.forEach(img => {
        const entry = new Uint8Array(16);
        const entryView = new DataView(entry.buffer);
        const dim = img.size === 256 ? 0 : img.size;

        entry[0] = dim; entry[1] = dim; entry[2] = 0; entry[3] = 0;
        entryView.setUint16(4, 1, true);
        entryView.setUint16(6, 32, true);
        entryView.setUint32(8, img.buffer.length, true);
        entryView.setUint32(12, currentOffset, true);
        parts.push(entry);
        currentOffset += img.buffer.length;
    });
    images.forEach(img => parts.push(img.buffer));
    return new Blob(parts, { type: 'image/x-icon' });
}

function downloadBlob(blob, name) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = name;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}

// --- AI Generation ---

async function generateAIIcon() {
    const provider = document.getElementById('aiProvider').value;
    const apiKey = document.getElementById('apiKey').value.trim();
    let prompt = document.getElementById('aiPrompt').value.trim();
    const btn = document.getElementById('aiGenerateBtn');
    const resultArea = document.getElementById('aiResult');
    const imgEl = document.getElementById('aiImage');
    const usePrePrompt = document.getElementById('usePrePrompt').checked;

    if (!apiKey) { alert('Please enter your API Key.'); return; }
    if (!prompt) { alert('Please enter a prompt.'); return; }

    if (usePrePrompt) {
        const prePrompt = "Microsoft Windows 11 app icon style, fluent design, 3D, isometric, soft shadows, gradient, vector, minimal, white background. Icon representing: ";
        prompt = prePrompt + prompt;
    }

    // Save key for convenience
    localStorage.setItem(`${provider}_key`, apiKey);
    localStorage.setItem('last_provider', provider);

    btn.disabled = true;
    btn.innerHTML = 'Generating...';
    resultArea.style.display = 'none';

    try {
        let dataUrl;

        if (provider === 'stability') {
            const response = await fetch('https://api.stability.ai/v1/generation/stable-diffusion-xl-1024-v1-0/text-to-image', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Accept': 'application/json',
                    'Authorization': `Bearer ${apiKey}`
                },
                body: JSON.stringify({
                    text_prompts: [{ text: `App icon, ${prompt}, white background, high quality, vector style, centered` }],
                    cfg_scale: 7,
                    height: 1024,
                    width: 1024,
                    samples: 1,
                    steps: 30
                })
            });
            const data = await response.json();
            if (!response.ok) throw new Error(data.message || 'Stability AI Error');
            dataUrl = `data:image/png;base64,${data.artifacts[0].base64}`;
        } else {
            // OpenAI
            const response = await fetch('https://api.openai.com/v1/images/generations', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${apiKey}`
                },
                body: JSON.stringify({
                    model: "dall-e-3",
                    prompt: `App icon, ${prompt}, white background, high quality, vector style, centered`,
                    n: 1,
                    size: "1024x1024",
                    response_format: "b64_json"
                })
            });
            const data = await response.json();
            if (data.error) throw new Error(data.error.message);
            dataUrl = `data:image/png;base64,${data.data[0].b64_json}`;
        }

        imgEl.src = dataUrl;
        resultArea.style.display = 'flex';
    } catch (err) {
        alert('Generation failed: ' + err.message);
    } finally {
        btn.disabled = false;
        btn.innerHTML = 'Generate Icon';
    }
}

function useGeneratedImage() {
    const imgEl = document.getElementById('aiImage');
    fetch(imgEl.src)
        .then(res => res.blob())
        .then(blob => {
            const file = new File([blob], "ai-generated-icon.png", { type: "image/png" });
            closeAIModal({ target: document.getElementById('aiModal') });
            const dataTransfer = new DataTransfer();
            dataTransfer.items.add(file);
            handleSingleUpload({ files: dataTransfer.files });
        });
}

function openAIModal(e) {
    e.stopPropagation();
    document.getElementById('aiModal').classList.add('open');
    const lastProvider = localStorage.getItem('last_provider') || 'openai';
    document.getElementById('aiProvider').value = lastProvider;
    const savedKey = localStorage.getItem(`${lastProvider}_key`);
    if (savedKey) document.getElementById('apiKey').value = savedKey;
}

function closeAIModal(e) {
    if (e.target === e.currentTarget || e.target.classList.contains('close-modal-btn')) {
        document.getElementById('aiModal').classList.remove('open');
    }
}

function updateAIPlaceholder() {
    const provider = document.getElementById('aiProvider').value;
    const savedKey = localStorage.getItem(`${provider}_key`);
    const input = document.getElementById('apiKey');
    input.value = savedKey || '';
    if (provider === 'openai') input.placeholder = 'sk-...';
    else if (provider === 'gemini') input.placeholder = 'AIza...';
    else if (provider === 'stability') input.placeholder = 'sk-...';
}

// --- Theme Logic ---

const THEME_ICONS = {
    sun: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="5"></circle><line x1="12" y1="1" x2="12" y2="3"></line><line x1="12" y1="21" x2="12" y2="23"></line><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"></line><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"></line><line x1="1" y1="12" x2="3" y2="12"></line><line x1="21" y1="12" x2="23" y2="12"></line><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"></line><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"></line></svg>',
    moon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"></path></svg>'
};

function initTheme() {
    const saved = localStorage.getItem('theme');
    const systemDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    if (saved) {
        document.documentElement.setAttribute('data-theme', saved);
        updateThemeIcon(saved);
    } else {
        updateThemeIcon(systemDark ? 'dark' : 'light');
    }
    window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', e => {
        if (!localStorage.getItem('theme')) {
            updateThemeIcon(e.matches ? 'dark' : 'light');
        }
    });
}
function toggleTheme() {
    const current = document.documentElement.getAttribute('data-theme');
    const systemDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    const isDark = current === 'dark' || (!current && systemDark);
    const target = isDark ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', target);
    localStorage.setItem('theme', target);
    updateThemeIcon(target);
}
function updateThemeIcon(theme) {
    const btn = document.getElementById('themeBtn');
    if (btn) btn.innerHTML = theme === 'dark' ? THEME_ICONS.sun : THEME_ICONS.moon;
}

// --- Platform Detection ---
function detectPlatform() {
    const ua = navigator.userAgent || navigator.vendor || window.opera;
    if (/windows/i.test(ua)) userPlatform = 'Windows';
    else if (/macintosh|mac os x/i.test(ua)) userPlatform = 'macOS';
    else if (/linux/i.test(ua)) userPlatform = 'Linux';

    const promptInput = document.getElementById('aiPrompt');
    if (userPlatform === 'Windows') {
        promptInput.placeholder = "Fluent Design style, blue folder, 3D perspective...";
    } else if (userPlatform === 'macOS') {
        promptInput.placeholder = "Rounded square, realistic texture, drop shadow...";
    }
}

// --- Modal Logic ---
function openHelp() {
    document.getElementById('helpModal').classList.add('open');
}

function closeHelp(e) {
    if (e.target === e.currentTarget || e.target.classList.contains('close-modal-btn') || e.target.classList.contains('action-btn')) {
        document.getElementById('helpModal').classList.remove('open');
    }
}

// Init
initTheme();
detectPlatform();
document.getElementById('year').textContent = new Date().getFullYear();