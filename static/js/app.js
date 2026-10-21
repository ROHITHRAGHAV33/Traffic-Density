/* ==========================================
   OPTIFLOW AI - FRONTEND INTERACTION SCRIPT
   ========================================== */

// --- Global Application State ---
let appMode = 'demo'; // 'api' or 'demo' (simulation)
let currentTaskId = null;
let pollingInterval = null;
let densityChart = null;

// Mock configuration parameters
let config = {
    confidence: 0.30,
    criticalAlertLimit: 30,
    drawGrid: true,
    showIds: true,
    audioAlerts: false
};

// Available sample videos
const FALLBACK_SAMPLES = ['traffic1.mp4', 'traffic2.mp4', 'traffic3.mp4', 'traffic4.mp4'];
let availableSamples = [];
let selectedVideo = null;

// --- Initialize App ---
document.addEventListener('DOMContentLoaded', () => {
    initTabs();
    initSliders();
    initUploadZone();
    initChart();
    checkBackendHealth();
    
    // Quickstart button
    document.getElementById('btn-quick-start').addEventListener('click', () => {
        switchTab('dashboard');
    });

    // Check backend health periodically (every 10 seconds)
    setInterval(checkBackendHealth, 10000);
});

// --- Tab System ---
function initTabs() {
    const navItems = document.querySelectorAll('.nav-item');
    navItems.forEach(item => {
        item.addEventListener('click', (e) => {
            e.preventDefault();
            const tabId = item.getAttribute('data-tab');
            switchTab(tabId);
        });
    });
}

function switchTab(tabId) {
    // Update nav links active state
    document.querySelectorAll('.nav-item').forEach(item => {
        if (item.getAttribute('data-tab') === tabId) {
            item.classList.add('active');
        } else {
            item.classList.remove('active');
        }
    });

    // Update tab panes active state
    document.querySelectorAll('.tab-pane').forEach(pane => {
        if (pane.id === tabId) {
            pane.classList.add('active');
        } else {
            pane.classList.remove('active');
        }
    });

    log(`[SYSTEM] Navigated to: ${tabId.toUpperCase()}`);
}

// --- Configuration Control Sliders ---
function initSliders() {
    const confSlider = document.getElementById('conf-threshold');
    const alertSlider = document.getElementById('alert-threshold');
    
    confSlider.addEventListener('input', (e) => {
        config.confidence = parseFloat(e.target.value);
        document.getElementById('conf-val').innerText = config.confidence.toFixed(2);
    });
    
    confSlider.addEventListener('change', (e) => {
        log(`[SETTINGS] Confidence threshold updated to ${config.confidence.toFixed(2)}`);
    });

    alertSlider.addEventListener('input', (e) => {
        config.criticalAlertLimit = parseInt(e.target.value);
        document.getElementById('alert-val').innerText = config.criticalAlertLimit;
    });

    alertSlider.addEventListener('change', (e) => {
        log(`[SETTINGS] Critical alert vehicle threshold set to ${config.criticalAlertLimit}`);
    });

    // Option checkboxes
    document.getElementById('chk-grid').addEventListener('change', (e) => {
        config.drawGrid = e.target.checked;
        log(`[SETTINGS] Detection grid rendering: ${config.drawGrid ? 'ENABLED' : 'DISABLED'}`);
    });
    document.getElementById('chk-ids').addEventListener('change', (e) => {
        config.showIds = e.target.checked;
        log(`[SETTINGS] Unique tracking identifier overlays: ${config.showIds ? 'ENABLED' : 'DISABLED'}`);
    });
    document.getElementById('chk-audio').addEventListener('change', (e) => {
        config.audioAlerts = e.target.checked;
        log(`[SETTINGS] Critical audio notification: ${config.audioAlerts ? 'ENABLED' : 'DISABLED'}`);
    });
}

// --- Backend Health Check & Mode Management ---
async function checkBackendHealth() {
    try {
        const response = await fetch('/api/health');
        const data = await response.json();
        
        if (data.status === 'ok') {
            updateApiBadge('online', 'Connected');
            // If we successfully found backend and were in demo, upgrade to API mode
            if (appMode !== 'api') {
                setOperationalMode('api');
            }
            loadSampleVideos();
        } else {
            throw new Error('API reported status is not OK');
        }
    } catch (error) {
        updateApiBadge('offline', 'Disconnected');
        if (appMode === 'api') {
            setOperationalMode('demo');
        }
        setupDemoSamples();
    }
}

function updateApiBadge(status, text) {
    const badge = document.getElementById('api-status');
    const footerMode = document.getElementById('footer-mode');
    
    badge.className = `api-status-badge ${status}`;
    badge.querySelector('.status-text').innerText = text;
    
    if (footerMode) {
        footerMode.innerText = text;
        footerMode.className = `badge ${status === 'online' ? 'badge-success' : 'badge-danger'}`;
    }
}

function setOperationalMode(mode) {
    appMode = mode;
    const apiBtn = document.getElementById('mode-api');
    const demoBtn = document.getElementById('mode-demo');
    const descText = document.getElementById('mode-desc');

    if (mode === 'api') {
        apiBtn.classList.add('active');
        demoBtn.classList.remove('active');
        descText.innerText = 'Processing using YOLOv8 via Python server.';
        log('[SYSTEM] Operational Mode: Python API Backend (production)');
    } else {
        apiBtn.classList.remove('active');
        demoBtn.classList.add('active');
        descText.innerText = 'Standalone Browser Simulation (sandbox).';
        log('[SYSTEM] Operational Mode: Standalone Sandbox Simulation (demo)');
        setupDemoSamples();
    }
}

// --- Load Predefined Sample Videos ---
async function loadSampleVideos() {
    try {
        const response = await fetch('/api/sample-videos');
        const data = await response.json();
        availableSamples = data.videos || [];
        renderSampleVideos();
    } catch (e) {
        setupDemoSamples();
    }
}

function setupDemoSamples() {
    availableSamples = FALLBACK_SAMPLES;
    renderSampleVideos();
}

function renderSampleVideos() {
    const container = document.getElementById('sample-video-container');
    container.innerHTML = '';
    
    if (availableSamples.length === 0) {
        container.innerHTML = '<div class="sample-item text-center">No samples found</div>';
        return;
    }

    availableSamples.forEach(vid => {
        const item = document.createElement('div');
        item.className = 'sample-item';
        item.innerHTML = `<i class="fa-solid fa-file-video"></i> <span>${vid}</span>`;
        item.addEventListener('click', () => selectSampleVideo(vid, item));
        container.appendChild(item);
    });
}

function selectSampleVideo(videoName, element) {
    // Highlight item
    document.querySelectorAll('.sample-item').forEach(el => el.classList.remove('active'));
    element.classList.add('active');
    selectedVideo = videoName;
    
    // Set status
    document.getElementById('source-badge').innerText = videoName;
    log(`[SOURCE] Loaded sample video: ${videoName}`);
    
    // Setup video source
    const inputVideo = document.getElementById('input-video');
    const uploadPlaceholder = document.getElementById('upload-placeholder');
    
    // Set video src URL
    // If online, fetch from backend endpoint /videos/{filename}
    // If offline, we can stream standard mock files if they're available relative to static
    inputVideo.src = appMode === 'api' ? `/videos/${videoName}` : `/static/videos/${videoName}`;
    inputVideo.style.display = 'block';
    uploadPlaceholder.style.display = 'none';

    // Clear output state
    resetProcessingState();
    
    // Add start analysis log
    log(`[INPUT] Ready for tracking. Click "🚀 Start Analysis" in side panels or process directly.`);
    
    // Automatically trigger run analysis since it's loaded
    startVideoAnalysis();
}

// --- Reset Processing Display ---
function resetProcessingState() {
    // Reset stats
    document.getElementById('stat-active-count').innerText = '0';
    document.getElementById('stat-density').innerText = 'IDLE';
    document.getElementById('stat-density').style.color = 'var(--color-text-muted)';
    document.getElementById('stat-total-unique').innerText = '0';
    document.getElementById('stat-congestion').innerText = '0%';
    
    // Hide output video and show overlay
    const outputVideo = document.getElementById('output-video');
    outputVideo.style.display = 'none';
    outputVideo.src = '';
    
    const overlay = document.getElementById('video-overlay');
    overlay.style.display = 'flex';
    document.getElementById('overlay-text').innerText = 'Ready to Analyze. Click Start.';
    overlay.querySelector('.overlay-spinner').style.display = 'none';
    
    // Reset progress bar
    document.getElementById('analysis-progress-panel').style.display = 'none';
    document.getElementById('analysis-progress-bar').style.style = '0%';
    document.getElementById('progress-percent-text').innerText = '0%';

    // Clear chart
    clearChart();
}

// --- Drag & Drop / File Input Upload handlers ---
function initUploadZone() {
    const uploadZone = document.getElementById('upload-zone');
    const fileInput = document.getElementById('video-file-input');
    const placeholder = document.getElementById('upload-placeholder');

    placeholder.addEventListener('click', () => {
        fileInput.click();
    });

    fileInput.addEventListener('change', (e) => {
        if (e.target.files.length > 0) {
            handleUploadedFile(e.target.files[0]);
        }
    });

    uploadZone.addEventListener('dragover', (e) => {
        e.preventDefault();
        uploadZone.style.borderColor = 'var(--primary)';
    });

    uploadZone.addEventListener('dragleave', () => {
        uploadZone.style.borderColor = 'var(--border-color)';
    });

    uploadZone.addEventListener('drop', (e) => {
        e.preventDefault();
        uploadZone.style.borderColor = 'var(--border-color)';
        if (e.dataTransfer.files.length > 0) {
            handleUploadedFile(e.dataTransfer.files[0]);
        }
    });
}

function handleUploadedFile(file) {
    if (!file.type.match('video/mp4') && !file.name.endsWith('.mp4')) {
        log('[ERROR] Invalid file format. Please upload an MP4 video file.', 'danger');
        return;
    }

    log(`[INPUT] User uploaded local file: ${file.name} (${(file.size / (1024*1024)).toFixed(2)} MB)`);
    document.getElementById('source-badge').innerText = file.name;

    // Load file in input player
    const inputVideo = document.getElementById('input-video');
    const uploadPlaceholder = document.getElementById('upload-placeholder');
    
    inputVideo.src = URL.createObjectURL(file);
    inputVideo.style.display = 'block';
    placeholder.style.display = 'none';

    resetProcessingState();
    
    // Save file reference for processing
    selectedVideo = file;
    
    startVideoAnalysis();
}

// --- Start Analysis Dispatcher ---
function startVideoAnalysis() {
    if (!selectedVideo) {
        log('[WARN] Please load a video or select a sample first.', 'warn');
        return;
    }

    log('[SYSTEM] Initializing video analysis pipeline...');
    resetProcessingState();

    if (appMode === 'api' && !(selectedVideo instanceof File)) {
        // Sample video selected, run API on sample
        log(`[API] Processing sample file: ${selectedVideo}`);
        processSampleViaApi(selectedVideo);
    } else if (appMode === 'api' && (selectedVideo instanceof File)) {
        // Custom upload, send file via multipart
        log(`[API] Uploading and processing custom file: ${selectedVideo.name}`);
        uploadAndProcessFile(selectedVideo);
    } else {
        // Sandbox Simulation Mode
        log('[SIMULATOR] Starting client-side mock tracker simulation...');
        runSandboxSimulation();
    }
}

// --- API Processing Integration ---
async function uploadAndProcessFile(file) {
    const formData = new FormData();
    formData.append('file', file);

    const progressPanel = document.getElementById('analysis-progress-panel');
    progressPanel.style.display = 'block';
    document.getElementById('progress-status-text').innerText = 'Uploading video file...';
    
    const overlay = document.getElementById('video-overlay');
    overlay.style.display = 'flex';
    document.getElementById('overlay-text').innerText = 'Uploading to FastAPI Server...';
    overlay.querySelector('.overlay-spinner').style.display = 'block';

    try {
        const response = await fetch('/api/process', {
            method: 'POST',
            body: formData
        });
        
        if (!response.ok) throw new Error('API server returned error on file upload');
        const data = await response.json();
        
        currentTaskId = data.task_id;
        log(`[API] Upload complete. Task ID: ${currentTaskId}. Starting tracker...`, 'success');
        startStatusPolling(currentTaskId);

    } catch (err) {
        log(`[ERROR] Upload failed: ${err.message}. Defaulting to simulation.`, 'danger');
        setOperationalMode('demo');
        runSandboxSimulation();
    }
}

async function processSampleViaApi(filename) {
    // To process a sample video via the API, we fetch the video blob and upload it,
    // or call an API process endpoint that processes a local filename.
    // In our api.py, it expects a file upload. So we will fetch the video and upload it.
    try {
        const overlay = document.getElementById('video-overlay');
        overlay.style.display = 'flex';
        document.getElementById('overlay-text').innerText = 'Initializing API session...';
        overlay.querySelector('.overlay-spinner').style.display = 'block';

        const videoUrl = `/videos/${filename}`;
        log(`[API] Retrieving sample video data from: ${videoUrl}`);
        
        const videoResponse = await fetch(videoUrl);
        const blob = await videoResponse.blob();
        
        const file = new File([blob], filename, { type: 'video/mp4' });
        uploadAndProcessFile(file);
    } catch (err) {
        log(`[ERROR] Failed to fetch sample file: ${err.message}. Running simulation instead.`, 'danger');
        setOperationalMode('demo');
        runSandboxSimulation();
    }
}

// --- Poll Status of API Background Job ---
function startStatusPolling(taskId) {
    if (pollingInterval) clearInterval(pollingInterval);
    
    document.getElementById('progress-status-text').innerText = 'FastAPI server running YOLO tracker...';
    
    pollingInterval = setInterval(async () => {
        try {
            const response = await fetch(`/api/status/${taskId}`);
            if (!response.ok) throw new Error('Failed to fetch status');
            const statusData = await response.json();

            // Update progress
            const progress = statusData.progress;
            document.getElementById('analysis-progress-bar').style.width = `${progress}%`;
            document.getElementById('progress-percent-text').innerText = `${progress}%`;

            // Update stats
            document.getElementById('stat-active-count').innerText = statusData.active_count;
            updateDensityUI(statusData.density);
            document.getElementById('stat-total-unique').innerText = statusData.unique_ids_count;
            
            // Congestion Index (based on settings)
            const congestion = Math.min(Math.round((statusData.active_count / config.criticalAlertLimit) * 100), 100);
            document.getElementById('stat-congestion').innerText = `${congestion}%`;
            checkCongestionAlert(congestion);

            // Log output
            if (statusData.current_frame > 0 && statusData.current_frame % 5 === 0) {
                log(`[TRACKER] Frame ${statusData.current_frame}/${statusData.total_frames} | Active: ${statusData.active_count} | Unique Total: ${statusData.unique_ids_count}`);
            }

            // Update Chart
            if (statusData.vehicle_counts && statusData.vehicle_counts.length > 0) {
                // Synchronize chart data
                updateChartData(statusData.vehicle_counts);
            }

            if (statusData.status === 'completed') {
                clearInterval(pollingInterval);
                log(`[API] Processing complete. Average Vehicles: ${statusData.average_vehicles} | Peak: ${statusData.peak_vehicles}`, 'success');
                
                // Show output video
                const outputVideo = document.getElementById('output-video');
                outputVideo.src = statusData.output_url;
                outputVideo.style.display = 'block';
                
                document.getElementById('video-overlay').style.display = 'none';
                document.getElementById('analysis-progress-panel').style.display = 'none';
                
                // Play video
                outputVideo.play();
                document.getElementById('input-video').play();

            } else if (statusData.status === 'failed') {
                clearInterval(pollingInterval);
                log(`[ERROR] YOLO processing failed: ${statusData.error}`, 'danger');
                document.getElementById('overlay-text').innerText = 'Analysis Failed';
                document.getElementById('video-overlay').querySelector('.overlay-spinner').style.display = 'none';
            }

        } catch (err) {
            clearInterval(pollingInterval);
            log(`[ERROR] Connection lost to polling service: ${err.message}`, 'danger');
        }
    }, 800);
}

// --- Standalone Simulation Sandbox ---
function runSandboxSimulation() {
    const progressPanel = document.getElementById('analysis-progress-panel');
    progressPanel.style.display = 'block';
    document.getElementById('progress-status-text').innerText = 'Simulating local YOLOv8 execution...';

    const overlay = document.getElementById('video-overlay');
    overlay.style.display = 'flex';
    document.getElementById('overlay-text').innerText = 'Loading model weights (6.2MB)...';
    overlay.querySelector('.overlay-spinner').style.display = 'block';

    let mockFrame = 0;
    const totalMockFrames = 120;
    let uniqueCount = 0;
    let countsArray = [];

    // Trigger video play for input side
    const inputVideo = document.getElementById('input-video');
    inputVideo.currentTime = 0;
    inputVideo.play();

    setTimeout(() => {
        document.getElementById('overlay-text').innerText = 'Rendering YOLO tracking layers...';
        log('[SIMULATOR] Model loaded. Processing frames at 25.4 FPS...');
    }, 1500);

    setTimeout(() => {
        document.getElementById('overlay-text').innerText = 'Running tracking...';
        
        if (pollingInterval) clearInterval(pollingInterval);

        pollingInterval = setInterval(() => {
            mockFrame += 4; // Fast forward simulation
            if (mockFrame > totalMockFrames) mockFrame = totalMockFrames;

            const progress = Math.round((mockFrame / totalMockFrames) * 100);
            document.getElementById('analysis-progress-bar').style.width = `${progress}%`;
            document.getElementById('progress-percent-text').innerText = `${progress}%`;

            // Synthesize realistic counts based on configuration/video selection
            let baseCount = 8;
            if (selectedVideo && selectedVideo.toString().includes('2')) baseCount = 18;
            if (selectedVideo && selectedVideo.toString().includes('3')) baseCount = 32;
            if (selectedVideo && selectedVideo.toString().includes('4')) baseCount = 12;

            // Generate noise
            const noise = Math.round((Math.random() - 0.5) * 6);
            const currentCount = Math.max(0, baseCount + noise);
            countsArray.push(currentCount);

            // Unique vehicle incremental count
            uniqueCount = Math.max(uniqueCount, Math.round(uniqueCount + (Math.random() * 0.4)));

            // Classify density
            let density = 'LOW';
            if (currentCount > 8 && currentCount <= 20) density = 'MEDIUM';
            else if (currentCount > 20 && currentCount <= 40) density = 'HIGH';
            else if (currentCount > 40) density = 'CRITICAL';

            // Update UI values
            document.getElementById('stat-active-count').innerText = currentCount;
            updateDensityUI(density);
            document.getElementById('stat-total-unique').innerText = uniqueCount;

            const congestion = Math.min(Math.round((currentCount / config.criticalAlertLimit) * 100), 100);
            document.getElementById('stat-congestion').innerText = `${congestion}%`;
            checkCongestionAlert(congestion);

            // Logs
            if (mockFrame % 12 === 0) {
                log(`[SIMULATOR] Decoded frame ${mockFrame}/${totalMockFrames} | Identified: ${currentCount} vehicles | Tracking IDs: ${uniqueCount}`);
            }

            // Chart update
            updateChartData(countsArray);

            if (mockFrame >= totalMockFrames) {
                clearInterval(pollingInterval);
                log('[SIMULATOR] Sandbox tracking complete. Output layers generated successfully.', 'success');
                
                // Show output video (in demo mode we loop input video as output and overlay mock tags)
                const outputVideo = document.getElementById('output-video');
                outputVideo.src = inputVideo.src;
                outputVideo.style.display = 'block';
                
                overlay.style.display = 'none';
                progressPanel.style.display = 'none';
                
                outputVideo.currentTime = 0;
                outputVideo.play();
                
                log(`[SIMULATOR] Final Report: Avg Vehicles: ${(countsArray.reduce((a,b)=>a+b, 0)/countsArray.length).toFixed(1)} | Max Load: ${Math.max(...countsArray)}`, 'success');
            }
        }, 120);

    }, 3000);
}

// --- UI Density Color Mapper ---
function updateDensityUI(density) {
    const el = document.getElementById('stat-density');
    el.innerText = density;
    
    let color = 'var(--color-text-muted)';
    if (density === 'LOW') color = 'var(--success)';
    else if (density === 'MEDIUM') color = 'var(--warning)';
    else if (density === 'HIGH') color = 'var(--danger)';
    else if (density === 'CRITICAL') color = 'var(--critical)';

    el.style.color = color;
}

// --- Critical Alert Sound Trigger ---
function checkCongestionAlert(congestionIndex) {
    const statCard = document.querySelector('.card-red');
    if (congestionIndex >= 90) {
        statCard.style.boxShadow = '0 0 15px var(--danger-glow)';
        statCard.style.borderColor = 'var(--danger)';
        
        if (config.audioAlerts) {
            const sound = document.getElementById('alert-sound');
            if (sound && sound.paused) {
                sound.play().catch(e => {});
            }
        }
    } else {
        statCard.style.boxShadow = 'none';
        statCard.style.borderColor = 'var(--border-color)';
    }
}

// --- Chart.js Telemetry Config ---
function initChart() {
    const ctx = document.getElementById('densityChart').getContext('2d');
    
    // Create subtle gradient fill under chart
    const gradient = ctx.createLinearGradient(0, 0, 0, 200);
    gradient.addColorStop(0, 'rgba(59, 130, 246, 0.4)');
    gradient.addColorStop(1, 'rgba(59, 130, 246, 0.02)');

    densityChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: [],
            datasets: [{
                label: 'Vehicle Count',
                data: [],
                borderColor: '#3b82f6',
                borderWidth: 2.5,
                backgroundColor: gradient,
                fill: true,
                tension: 0.35,
                pointRadius: 0,
                pointHoverRadius: 4
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { display: false }
            },
            scales: {
                x: {
                    grid: { color: 'rgba(255, 255, 255, 0.03)' },
                    ticks: { color: '#6b7280', font: { size: 10 } }
                },
                y: {
                    grid: { color: 'rgba(255, 255, 255, 0.03)' },
                    ticks: { color: '#6b7280', font: { size: 10 } },
                    min: 0,
                    suggestedMax: 20
                }
            }
        }
    });
}

function updateChartData(vehicleCounts) {
    if (!densityChart) return;
    
    densityChart.data.labels = vehicleCounts.map((_, i) => `${i + 1}`);
    densityChart.data.datasets[0].data = vehicleCounts;
    
    // Auto scale Y axis if count exceeds default max
    const maxCount = Math.max(...vehicleCounts, 15);
    densityChart.options.scales.y.suggestedMax = Math.ceil(maxCount * 1.2);
    
    densityChart.update('none'); // Update without animation for speed
}

function clearChart() {
    if (!densityChart) return;
    densityChart.data.labels = [];
    densityChart.data.datasets[0].data = [];
    densityChart.update();
}

// --- Console Logs Helper ---
function log(msg, type = 'info') {
    const consoleLogs = document.getElementById('console-logs');
    if (!consoleLogs) return;

    const time = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    const line = document.createElement('div');
    line.className = `log-line ${type}`;
    line.innerText = `[${time}] ${msg}`;
    
    consoleLogs.appendChild(line);
    
    // Auto scroll to bottom
    consoleLogs.scrollTop = consoleLogs.scrollHeight;
}

function clearLogs() {
    const consoleLogs = document.getElementById('console-logs');
    if (consoleLogs) {
        consoleLogs.innerHTML = '<div class="log-line system">[SYSTEM] Console Logs Cleared.</div>';
    }
}
