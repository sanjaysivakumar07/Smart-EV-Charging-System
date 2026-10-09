/**
 * VOLTGRID PRO - SMART EV CHARGING SYSTEM DASHBOARD v2.0
 * Real-time REST API Client, DSA Visualization Engine & Full Feature Suite
 */

// ============================================================
// CONFIGURATION & STATE
// ============================================================
const API_BASE = window.location.origin.includes('http') ? window.location.origin : 'http://localhost:8080';
let pollInterval = null;
let isConnected = false;
let currentSortDeparture = false;
let autoChargeEnabled = true;
let autoChargeTimer = null;
let audioEnabled = true;
let currentStatusFilter = 'all';
let currentBayFilter = 'all';

// Format "HH:MM" (24h) → "HH:MM AM/PM" for display
function formatDeparture(t) {
    if (!t || t === '—') return '—';
    const parts = t.split(':');
    if (parts.length < 2) return t;
    let h = parseInt(parts[0], 10);
    const m = parts[1].padStart(2, '0');
    const ampm = h >= 12 ? 'PM' : 'AM';
    h = h % 12 || 12;
    return `${h}:${m} ${ampm}`;
}

// Audio context for UI sound effects
let audioCtx = null;
function getAudioCtx() {
    if (!audioCtx) {
        audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    }
    return audioCtx;
}

function playSound(type) {
    if (!audioEnabled) return;
    try {
        const ctx = getAudioCtx();
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain);
        gain.connect(ctx.destination);
        gain.gain.value = 0.08;

        if (type === 'success') {
            osc.frequency.value = 880;
            osc.type = 'sine';
            gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.3);
            osc.start(ctx.currentTime);
            osc.stop(ctx.currentTime + 0.3);
        } else if (type === 'error') {
            osc.frequency.value = 220;
            osc.type = 'sawtooth';
            gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.4);
            osc.start(ctx.currentTime);
            osc.stop(ctx.currentTime + 0.4);
        } else if (type === 'click') {
            osc.frequency.value = 1200;
            osc.type = 'sine';
            gain.gain.value = 0.04;
            gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.08);
            osc.start(ctx.currentTime);
            osc.stop(ctx.currentTime + 0.08);
        } else if (type === 'charge') {
            osc.frequency.value = 600;
            osc.type = 'triangle';
            gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.15);
            osc.start(ctx.currentTime);
            osc.stop(ctx.currentTime + 0.15);
            // Second beep
            const osc2 = ctx.createOscillator();
            const gain2 = ctx.createGain();
            osc2.connect(gain2);
            gain2.connect(ctx.destination);
            osc2.frequency.value = 900;
            osc2.type = 'triangle';
            gain2.gain.value = 0.06;
            gain2.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.35);
            osc2.start(ctx.currentTime + 0.15);
            osc2.stop(ctx.currentTime + 0.35);
        }
    } catch (e) {
        // Audio not available, ignore
    }
}

// ============================================================
// DOM ELEMENTS
// ============================================================
const backendStatusPill = document.getElementById('backendStatusPill');
const statusDot = document.getElementById('statusDot');
const statusText = document.getElementById('statusText');
const latencyBadge = document.getElementById('latencyBadge');
const liveClock = document.getElementById('liveClock');

// Stats Counters
const statTotalVehicles = document.getElementById('statTotalVehicles');
const statChargingCount = document.getElementById('statChargingCount');
const statUtilization = document.getElementById('statUtilization');
const statPriorityQueue = document.getElementById('statPriorityQueue');
const statNormalQueue = document.getElementById('statNormalQueue');
const statCompletedCount = document.getElementById('statCompletedCount');

// Badges
const badgePriorityCount = document.getElementById('badgePriorityCount');
const badgeNormalCount = document.getElementById('badgeNormalCount');
const badgeStackCount = document.getElementById('badgeStackCount');
const badgeRegistryCount = document.getElementById('badgeRegistryCount');

// Grid Telemetry
const gridPowerText = document.getElementById('gridPowerText');
const gridMeterFill = document.getElementById('gridMeterFill');
const gridLoadStatus = document.getElementById('gridLoadStatus');
const solarMixText = document.getElementById('solarMixText');
const co2SavedText = document.getElementById('co2SavedText');
const tariffText = document.getElementById('tariffText');
const activeBaySummary = document.getElementById('activeBaySummary');

// Containers
const stationsGrid = document.getElementById('stationsGrid');
const priorityQueueContainer = document.getElementById('priorityQueueContainer');
const normalQueueContainer = document.getElementById('normalQueueContainer');
const stackContainer = document.getElementById('stackContainer');
const vehiclesTableBody = document.getElementById('vehiclesTableBody');
const consoleBody = document.getElementById('consoleBody');
const logCountDisplay = document.getElementById('logCount');

// Modal & Form Elements
const modalAddEV = document.getElementById('modalAddEV');
const btnOpenAddModal = document.getElementById('btnOpenAddModal');
const btnCloseModal = document.getElementById('btnCloseModal');
const btnCancelModal = document.getElementById('btnCancelModal');
const formAddVehicle = document.getElementById('formAddVehicle');
const rangeBattery = document.getElementById('rangeBattery');
const batteryValDisplay = document.getElementById('batteryValDisplay');
const batteryFill = document.getElementById('batteryFill');
const inputVehicleId = document.getElementById('inputVehicleId');
const inputDeparture = document.getElementById('inputDeparture');
const selectMembership = document.getElementById('selectMembership');
const selectReservation = document.getElementById('selectReservation');

// Receipt Modal
const modalReceipt = document.getElementById('modalReceipt');
const receiptContent = document.getElementById('receiptContent');
const btnCloseReceipt = document.getElementById('btnCloseReceipt');
const btnCloseReceiptBtn = document.getElementById('btnCloseReceiptBtn');
const btnPrintReceipt = document.getElementById('btnPrintReceipt');

// Action Buttons
const btnSimulateTraffic = document.getElementById('btnSimulateTraffic');
const btnResetSystem = document.getElementById('btnResetSystem');
const btnSortDeparture = document.getElementById('btnSortDeparture');
const btnClearLogs = document.getElementById('btnClearLogs');
const btnExportCsv = document.getElementById('btnExportCsv');
const btnTickBattery = document.getElementById('btnTickBattery');
const btnAudioToggle = document.getElementById('btnAudioToggle');
const registrySearch = document.getElementById('registrySearch');
const toastContainer = document.getElementById('toastContainer');

// Simulation toggle
const simTogglePill = document.getElementById('simTogglePill');
const simIndicator = document.getElementById('simIndicator');
const simStatusText = document.getElementById('simStatusText');

// ============================================================
// CLOCK & UTILITIES
// ============================================================
function updateClock() {
    const now = new Date();
    liveClock.textContent = now.toTimeString().split(' ')[0];
}
setInterval(updateClock, 1000);
updateClock();

function showToast(message, type = 'info') {
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    
    let iconSvg = '';
    if (type === 'success') {
        iconSvg = `<svg class="toast-icon" viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"></polyline></svg>`;
        playSound('success');
    } else if (type === 'error') {
        iconSvg = `<svg class="toast-icon" viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2.5"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line></svg>`;
        playSound('error');
    } else {
        iconSvg = `<svg class="toast-icon" viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2.5"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="16" x2="12" y2="12"></line><line x1="12" y1="8" x2="12.01" y2="8"></line></svg>`;
    }

    toast.innerHTML = `${iconSvg} <span>${message}</span>`;
    toastContainer.appendChild(toast);

    // Trigger enter animation
    requestAnimationFrame(() => {
        toast.classList.add('toast-enter');
    });

    setTimeout(() => {
        toast.style.opacity = '0';
        toast.style.transform = 'translateX(100%)';
        setTimeout(() => toast.remove(), 300);
    }, 4000);
}

function animateCounter(element, targetValue, duration = 500) {
    const startValue = parseInt(element.textContent) || 0;
    if (startValue === targetValue) return;
    const diff = targetValue - startValue;
    const startTime = performance.now();
    
    function step(currentTime) {
        const elapsed = currentTime - startTime;
        const progress = Math.min(elapsed / duration, 1);
        const eased = 1 - Math.pow(1 - progress, 3); // easeOutCubic
        element.textContent = Math.round(startValue + diff * eased);
        if (progress < 1) {
            requestAnimationFrame(step);
        }
    }
    requestAnimationFrame(step);
}

// ============================================================
// API CLIENT
// ============================================================
async function apiFetch(endpoint, options = {}) {
    const start = performance.now();
    try {
        const response = await fetch(`${API_BASE}${endpoint}`, {
            ...options,
            headers: {
                'Content-Type': 'application/json',
                ...(options.headers || {})
            }
        });
        const duration = Math.round(performance.now() - start);
        updateConnectionStatus(true, duration);
        if (!response.ok) {
            const errData = await response.json().catch(() => ({ error: response.statusText }));
            throw new Error(errData.error || `HTTP ${response.status}`);
        }
        const contentType = response.headers.get('content-type') || '';
        if (contentType.includes('text/csv')) {
            return await response.text();
        }
        return await response.json();
    } catch (err) {
        updateConnectionStatus(false, 0);
        throw err;
    }
}

function updateConnectionStatus(connected, latency) {
    isConnected = connected;
    if (connected) {
        statusDot.className = 'status-dot pulsing';
        statusText.textContent = 'Backend Online (Port 8080)';
        latencyBadge.textContent = `${latency} ms`;
        latencyBadge.style.display = 'inline-block';
        backendStatusPill.classList.remove('disconnected');
    } else {
        statusDot.className = 'status-dot error';
        statusText.textContent = 'Backend Disconnected';
        latencyBadge.style.display = 'none';
        backendStatusPill.classList.add('disconnected');
    }
}

// ============================================================
// DATA FETCHING & RENDERING
// ============================================================
async function refreshAllData() {
    try {
        const [status, stations, queues, completed, vehicles, logs] = await Promise.all([
            apiFetch('/api/status'),
            apiFetch('/api/stations'),
            apiFetch('/api/queues'),
            apiFetch('/api/completed'),
            apiFetch(`/api/vehicles${currentSortDeparture ? '?sort=departure' : ''}`),
            apiFetch('/api/logs')
        ]);

        renderTelemetry(status);
        renderGridBanner(status);
        renderStations(stations);
        renderQueues(queues);
        renderStack(completed);
        renderVehiclesTable(vehicles);
        renderLogs(logs);
    } catch (err) {
        console.warn('Backend fetch failed:', err.message);
    }
}

function renderTelemetry(status) {
    if (!status) return;
    
    animateCounter(statTotalVehicles, status.totalVehicles || 0);
    statChargingCount.textContent = `${status.chargingCount || 0} / ${status.totalStations || 5}`;
    
    const util = Math.round(((status.chargingCount || 0) / (status.totalStations || 5)) * 100);
    statUtilization.textContent = `${util}% Bay Utilization`;
    
    animateCounter(statPriorityQueue, status.priorityQueueCount || 0);
    animateCounter(statNormalQueue, status.normalQueueCount || 0);
    animateCounter(statCompletedCount, status.completedCount || 0);

    badgePriorityCount.textContent = status.priorityQueueCount || 0;
    badgeNormalCount.textContent = status.normalQueueCount || 0;
    badgeStackCount.textContent = status.completedCount || 0;
    badgeRegistryCount.textContent = status.totalVehicles || 0;

    // Bay summary pill
    const activeCount = status.chargingCount || 0;
    const availCount = status.availableStations || 0;
    const maintCount = status.maintenanceStations || 0;
    if (activeBaySummary) {
        activeBaySummary.textContent = `${activeCount} Active • ${availCount} Available • ${maintCount} Maintenance`;
    }
}

function renderGridBanner(status) {
    if (!status) return;

    // Grid Power
    const power = status.gridPowerKW || 10;
    const capacity = status.gridCapacityKW || 500;
    const loadPercent = Math.round((power / capacity) * 100);
    if (gridPowerText) gridPowerText.textContent = `${power} kW / ${capacity} kW`;
    if (gridMeterFill) {
        gridMeterFill.style.width = `${loadPercent}%`;
        // Color based on load
        if (loadPercent > 80) {
            gridMeterFill.style.background = 'linear-gradient(90deg, var(--amber), var(--rose))';
        } else if (loadPercent > 50) {
            gridMeterFill.style.background = 'linear-gradient(90deg, var(--blue), var(--amber))';
        } else {
            gridMeterFill.style.background = 'linear-gradient(90deg, var(--emerald), var(--blue))';
        }
    }
    if (gridLoadStatus) {
        const available = capacity - power;
        let healthLabel = 'Nominal';
        if (loadPercent > 80) healthLabel = '⚠️ High Load';
        else if (loadPercent > 50) healthLabel = 'Moderate';
        gridLoadStatus.textContent = `Grid Health: ${healthLabel} • ${available} kW Available`;
    }

    // Solar Mix
    const solar = status.solarMixPercent || 48;
    if (solarMixText) solarMixText.textContent = `${solar}% Solar`;
    const solarFill = document.querySelector('.bg-solar');
    if (solarFill) solarFill.style.width = `${solar}%`;

    // CO2 Saved
    const co2 = status.co2SavedKg || 0;
    if (co2SavedText) co2SavedText.textContent = `${co2} kg`;
    const treesEquiv = Math.floor(co2 / 21.77);
    const treeSpan = document.querySelector('.grid-metric-sub-icon span');
    if (treeSpan) treeSpan.textContent = `~${treesEquiv} trees planted equivalent`;

    // Tariff
    const tariff = status.tariffRate || 0.25;
    if (tariffText) tariffText.textContent = `$${tariff.toFixed(2)} / kWh`;
}

function renderStations(stations) {
    if (!stations || !stations.length) return;

    const filteredStations = stations.filter(s => {
        if (currentBayFilter === 'all') return true;
        if (currentBayFilter === 'available') return s.available && !s.maintenance;
        if (currentBayFilter === 'charging') return !s.available && !s.maintenance && s.vehicleId !== -1;
        if (currentBayFilter === 'ccs') return s.connectorType === 'CCS';
        if (currentBayFilter === 'type2') return s.connectorType === 'Type2';
        return true;
    });

    if (filteredStations.length === 0) {
        stationsGrid.innerHTML = '<div class="empty-state">No bays match the selected filter.</div>';
        return;
    }
    
    stationsGrid.innerHTML = filteredStations.map(s => {
        let stateClass = 'state-available';
        let statusBadgeHtml = '<span class="bay-status-badge badge-status-available">Available</span>';
        let bodyHtml = '';
        let actionBtnHtml = '';

        if (s.maintenance) {
            stateClass = 'state-maintenance';
            statusBadgeHtml = '<span class="bay-status-badge badge-status-maintenance">Maintenance</span>';
            bodyHtml = `
                <div class="maintenance-visual">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"/></svg>
                    <span>Bay Offline / Service Mode</span>
                </div>
            `;
            actionBtnHtml = `
                <button class="btn-maintenance-toggle" onclick="toggleMaintenance(${s.id})">Resume Bay</button>
            `;
        } else if (!s.available && s.vehicle) {
            stateClass = 'state-charging';
            statusBadgeHtml = '<span class="bay-status-badge badge-status-charging">⚡ Charging</span>';
            
            const v = s.vehicle;
            const priorityClass = v.priority === 'Emergency' ? 'badge-emergency' : (v.priority === 'Reserved' ? 'badge-reserved' : 'badge-normal');
            const battLevel = v.batteryLevel || 0;
            let battColor = 'var(--rose)';
            if (battLevel >= 80) battColor = 'var(--emerald)';
            else if (battLevel >= 40) battColor = 'var(--blue)';
            else if (battLevel >= 20) battColor = 'var(--amber)';

            bodyHtml = `
                <div class="active-ev-card">
                    <div class="ev-header-row">
                        <span class="ev-id-badge">
                            <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="var(--cyan-primary)" stroke-width="2.5"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"></polygon></svg>
                            EV #${v.id}
                        </span>
                        <span class="ev-priority-badge ${priorityClass}">${v.priority}</span>
                    </div>

                    <div class="ev-battery-row">
                        <div class="battery-meta">
                            <span>Battery Charge</span>
                            <span class="battery-percent-text" style="color: ${battColor}">${battLevel}%</span>
                        </div>
                        <div class="battery-track">
                            <div class="battery-fill" style="width: ${battLevel}%; background: ${battColor};"></div>
                        </div>
                    </div>

                    <div class="ev-details-grid">
                        <div class="detail-item"><span>Dep:</span> <span class="detail-val">${formatDeparture(v.departureTime)}</span></div>
                        <div class="detail-item"><span>Tier:</span> <span class="detail-val">${v.membership}</span></div>
                        <div class="detail-item"><span>Speed:</span> <span class="detail-val">${v.chargingRequirement}</span></div>
                        <div class="detail-item"><span>Plug:</span> <span class="detail-val">${v.connectorType}</span></div>
                    </div>
                </div>
            `;

            actionBtnHtml = `
                <button class="btn-release" onclick="releaseStation(${s.id})">
                    ⚡ Complete &amp; Release
                </button>
                <button class="btn-maintenance-toggle" onclick="toggleMaintenance(${s.id})">Service</button>
            `;
        } else {
            bodyHtml = `
                <div class="available-visual">
                    <div class="pulse-ring-icon">
                        <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M5 12h14M12 5l7 7-7 7"/></svg>
                    </div>
                    <span class="bay-idle-text">Ready for Connection</span>
                </div>
            `;
            actionBtnHtml = `
                <button class="btn-maintenance-toggle" onclick="toggleMaintenance(${s.id})">Take Offline</button>
            `;
        }

        const isFast = s.chargingSpeed === 'Fast';
        const speedBadge = isFast ? '<span class="spec-badge badge-fast">⚡ Fast 150kW</span>' : '<span class="spec-badge">🔋 Med 50kW</span>';

        return `
            <div class="station-bay-card ${stateClass}">
                <div class="bay-header">
                    <div class="bay-number-wrap">
                        <span class="bay-num">Bay 0${s.id}</span>
                        <div class="bay-spec-tags">
                            <span class="spec-badge">${s.connectorType}</span>
                            ${speedBadge}
                        </div>
                    </div>
                    ${statusBadgeHtml}
                </div>

                <div class="bay-body">
                    ${bodyHtml}
                </div>

                <div class="bay-actions">
                    ${actionBtnHtml}
                </div>
            </div>
        `;
    }).join('');
}

function renderQueues(queues) {
    if (!queues) return;

    // Render Priority Queue
    const pq = queues.priorityQueue || [];
    if (pq.length === 0) {
        priorityQueueContainer.innerHTML = '<div class="empty-state">No vehicles in Priority Queue. All prioritized EVs are dispatched or none waiting!</div>';
    } else {
        priorityQueueContainer.innerHTML = pq.map((v, idx) => {
            const isTop = idx === 0;
            const priorityClass = v.priority === 'Emergency' ? 'badge-emergency' : 'badge-reserved';
            return `
                <div class="queue-ev-card ${isTop ? 'is-next-dispatch' : ''}">
                    ${isTop ? '<span class="next-dispatch-tag">🎯 Next Priority Dispatch</span>' : ''}
                    <div class="ev-header-row">
                        <div style="display:flex; align-items:center; gap:8px;">
                            <span class="queue-rank-badge">#${idx + 1}</span>
                            <span class="ev-id-badge">EV #${v.id}</span>
                        </div>
                        <div style="display:flex; gap:6px; align-items:center;">
                            <span class="ev-priority-badge ${priorityClass}">${v.priority}</span>
                            <button class="btn-inline-action btn-cancel-sm" onclick="cancelVehicle(${v.id})" title="Remove from queue">✕</button>
                        </div>
                    </div>
                    <div class="ev-battery-row">
                        <div class="battery-meta">
                            <span>Battery</span>
                            <span class="battery-percent-text">${v.batteryLevel}%</span>
                        </div>
                        <div class="battery-track">
                            <div class="battery-fill" style="width: ${v.batteryLevel}%;"></div>
                        </div>
                    </div>
                    <div class="ev-details-grid">
                        <div class="detail-item"><span>Connector:</span> <span class="detail-val">${v.connectorType}</span></div>
                        <div class="detail-item"><span>Speed:</span> <span class="detail-val">${v.chargingRequirement}</span></div>
                        <div class="detail-item"><span>Dep Time:</span> <span class="detail-val">${formatDeparture(v.departureTime)}</span></div>
                        <div class="detail-item"><span>Membership:</span> <span class="detail-val">${v.membership}</span></div>
                    </div>
                </div>
            `;
        }).join('');
    }

    // Render Normal Queue
    const nq = queues.normalQueue || [];
    if (nq.length === 0) {
        normalQueueContainer.innerHTML = '<div class="empty-state">No vehicles in Normal Queue.</div>';
    } else {
        normalQueueContainer.innerHTML = nq.map((v, idx) => {
            return `
                <div class="queue-ev-card">
                    <div class="ev-header-row">
                        <div style="display:flex; align-items:center; gap:8px;">
                            <span class="queue-rank-badge">#${idx + 1}</span>
                            <span class="ev-id-badge">EV #${v.id}</span>
                        </div>
                        <div style="display:flex; gap:6px; align-items:center;">
                            <span class="ev-priority-badge badge-normal">Normal</span>
                            <button class="btn-inline-action btn-escalate-sm" onclick="escalateVehicle(${v.id})" title="Escalate to Emergency">🚨</button>
                            <button class="btn-inline-action btn-cancel-sm" onclick="cancelVehicle(${v.id})" title="Remove from queue">✕</button>
                        </div>
                    </div>
                    <div class="ev-battery-row">
                        <div class="battery-meta">
                            <span>Battery</span>
                            <span class="battery-percent-text">${v.batteryLevel}%</span>
                        </div>
                        <div class="battery-track">
                            <div class="battery-fill" style="width: ${v.batteryLevel}%;"></div>
                        </div>
                    </div>
                    <div class="ev-details-grid">
                        <div class="detail-item"><span>Connector:</span> <span class="detail-val">${v.connectorType}</span></div>
                        <div class="detail-item"><span>Speed:</span> <span class="detail-val">${v.chargingRequirement}</span></div>
                        <div class="detail-item"><span>Dep Time:</span> <span class="detail-val">${formatDeparture(v.departureTime)}</span></div>
                        <div class="detail-item"><span>Membership:</span> <span class="detail-val">${v.membership}</span></div>
                    </div>
                </div>
            `;
        }).join('');
    }
}

function renderStack(completedList) {
    if (!completedList || completedList.length === 0) {
        stackContainer.innerHTML = '<div class="empty-state">No vehicles completed yet. Release a bay to push to stack!</div>';
        return;
    }

    stackContainer.innerHTML = completedList.map((v, idx) => {
        const isTop = idx === 0;
        return `
            <div class="stack-item-card ${isTop ? 'is-top' : ''}" onclick="showReceipt(${v.id}, '${(v.connectorType || 'CCS').replace(/'/g, "\\'")}', ${v.batteryLevel || 100}, '${(v.membership || 'Regular').replace(/'/g, "\\'")}', '${(v.departureTime || '—').replace(/'/g, "\\'")}', '${(v.priority || 'Normal').replace(/'/g, "\\'")}', '${(v.chargingRequirement || 'Normal').replace(/'/g, "\\'")}')" style="cursor: pointer;">
                <div style="display: flex; align-items: center; gap: 12px;">
                    <span class="ev-id-badge">EV #${v.id}</span>
                    <span class="status-pill-table status-pill-completed">Completed</span>
                </div>
                <div style="display: flex; align-items: center; gap: 10px;">
                    <span style="font-size:0.75rem; color:var(--text-muted);">${v.connectorType || 'CCS'} • ${v.membership || 'Regular'}</span>
                    ${isTop ? '<span class="stack-top-badge">&uarr; TOP (LIFO)</span>' : ''}
                    <span class="receipt-hint-badge">🧾 Invoice</span>
                </div>
            </div>
        `;
    }).join('');
}

function renderVehiclesTable(vehicles) {
    if (!vehicles || vehicles.length === 0) {
        vehiclesTableBody.innerHTML = '<tr><td colspan="11" class="text-center">No vehicles in registry.</td></tr>';
        return;
    }

    const searchTerm = (registrySearch.value || '').trim().toLowerCase();
    
    let filtered = vehicles.filter(v => {
        // Status filter
        if (currentStatusFilter !== 'all' && v.status !== currentStatusFilter) return false;
        // Search filter
        if (!searchTerm) return true;
        return String(v.id).includes(searchTerm) ||
               (v.connectorType && v.connectorType.toLowerCase().includes(searchTerm)) ||
               (v.priority && v.priority.toLowerCase().includes(searchTerm)) ||
               (v.status && v.status.toLowerCase().includes(searchTerm)) ||
               (v.membership && v.membership.toLowerCase().includes(searchTerm));
    });

    if (filtered.length === 0) {
        vehiclesTableBody.innerHTML = '<tr><td colspan="11" class="text-center">No matching vehicles found.</td></tr>';
        return;
    }

    vehiclesTableBody.innerHTML = filtered.map(v => {
        let statusPillClass = 'status-pill-waiting';
        if (v.status === 'Charging') statusPillClass = 'status-pill-charging';
        else if (v.status === 'Completed') statusPillClass = 'status-pill-completed';
        else if (v.status === 'Cancelled') statusPillClass = 'status-pill-cancelled';

        let priorityBadge = `<span class="ev-priority-badge badge-normal">${v.priority}</span>`;
        if (v.priority === 'Emergency') priorityBadge = `<span class="ev-priority-badge badge-emergency">${v.priority}</span>`;
        else if (v.priority === 'Reserved') priorityBadge = `<span class="ev-priority-badge badge-reserved">${v.priority}</span>`;

        // Quick actions based on status
        let actionsHtml = '';
        if (v.status === 'Waiting') {
            actionsHtml = `
                <button class="btn-table-action btn-table-escalate" onclick="escalateVehicle(${v.id})" title="Escalate to Emergency">🚨</button>
                <button class="btn-table-action btn-table-cancel" onclick="cancelVehicle(${v.id})" title="Cancel & Remove">✕</button>
            `;
        } else if (v.status === 'Charging') {
            const stId = v.assignedStationId;
            actionsHtml = `
                <button class="btn-table-action btn-table-release" onclick="releaseStation(${stId})" title="Complete & Release">⚡</button>
            `;
        } else if (v.status === 'Completed') {
            actionsHtml = `
                <button class="btn-table-action btn-table-receipt" onclick="showReceipt(${v.id}, '${(v.connectorType || 'CCS')}', ${v.batteryLevel || 100}, '${v.membership || 'Regular'}', '${v.departureTime || '—'}', '${v.priority || 'Normal'}', '${v.chargingRequirement || 'Normal'}')" title="View Invoice">🧾</button>
            `;
        }

        return `
            <tr>
                <td><strong>#${v.id}</strong></td>
                <td>${v.batteryLevel}%</td>
                <td><span class="spec-badge">${v.connectorType}</span></td>
                <td>${v.chargingRequirement}</td>
                <td>${priorityBadge}</td>
                <td>${formatDeparture(v.departureTime)}</td>
                <td>${v.membership}</td>
                <td>${v.reservation}</td>
                <td><span class="status-pill-table ${statusPillClass}">${v.status}</span></td>
                <td>${v.assignedStationId && v.assignedStationId !== -1 ? `Bay ${v.assignedStationId}` : '—'}</td>
                <td class="actions-cell">${actionsHtml}</td>
            </tr>
        `;
    }).join('');
}

function renderLogs(logs) {
    if (!logs) return;
    logCountDisplay.textContent = `${logs.length} events`;
    
    consoleBody.innerHTML = logs.map(l => {
        const typeClass = `log-${l.type.toLowerCase().replace(/[^a-z0-9]/g, '-')}`;
        return `
            <div class="log-line ${typeClass}">
                <span class="log-time">[${l.time}]</span>
                <span class="log-tag">[${l.type}]</span>
                <span>${l.message}</span>
            </div>
        `;
    }).join('');

    consoleBody.scrollTop = consoleBody.scrollHeight;
}

// ============================================================
// ACTIONS & CONTROLS
// ============================================================
window.releaseStation = async function(stationId) {
    try {
        await apiFetch(`/api/stations/release?stationId=${stationId}`, {
            method: 'POST',
            body: JSON.stringify({ stationId })
        });
        showToast(`Bay ${stationId} released! Vehicle completed & pushed to stack.`, 'success');
        playSound('charge');
        refreshAllData();
    } catch (err) {
        showToast(err.message, 'error');
    }
};

window.toggleMaintenance = async function(stationId) {
    try {
        await apiFetch(`/api/stations/maintenance?stationId=${stationId}`, {
            method: 'POST',
            body: JSON.stringify({ stationId })
        });
        showToast(`Bay ${stationId} maintenance mode toggled.`, 'info');
        playSound('click');
        refreshAllData();
    } catch (err) {
        showToast(err.message, 'error');
    }
};

window.escalateVehicle = async function(vehicleId) {
    try {
        await apiFetch('/api/vehicles/escalate', {
            method: 'POST',
            body: JSON.stringify({ id: vehicleId, priority: 'Emergency' })
        });
        showToast(`Vehicle #${vehicleId} escalated to EMERGENCY priority!`, 'success');
        playSound('charge');
        refreshAllData();
    } catch (err) {
        showToast(`Escalation failed: ${err.message}`, 'error');
    }
};

window.cancelVehicle = async function(vehicleId) {
    if (!confirm(`Cancel Vehicle #${vehicleId} and remove from queue?`)) return;
    try {
        await apiFetch('/api/vehicles/cancel', {
            method: 'POST',
            body: JSON.stringify({ id: vehicleId })
        });
        showToast(`Vehicle #${vehicleId} cancelled and removed.`, 'info');
        playSound('click');
        refreshAllData();
    } catch (err) {
        showToast(`Cancel failed: ${err.message}`, 'error');
    }
};

// Receipt / Invoice Modal
window.showReceipt = function(id, connector, battery, membership, departure, priority, speed) {
    if (!modalReceipt) return;
    
    const sessionId = `VG-${Date.now().toString(36).toUpperCase()}-${id}`;
    const kwhDelivered = Math.round((100 - Math.max(battery - 20, 0)) * 0.48 * 10) / 10;
    const tariff = 8; // ₹8 per kWh
    const baseCharge = Math.round(kwhDelivered * tariff * 100) / 100;
    const discount = membership === 'Premium' ? 0.15 : 0;
    const discountAmount = Math.round(baseCharge * discount * 100) / 100;
    const total = Math.round((baseCharge - discountAmount) * 100) / 100;
    const gst = Math.round(total * 0.18 * 100) / 100; // 18% GST
    const grandTotal = Math.round((total + gst) * 100) / 100;
    const now = new Date();

    receiptContent.innerHTML = `
        <div class="receipt-section">
            <div class="receipt-section-title">SESSION DETAILS</div>
            <div class="receipt-row"><span>Session ID</span><span class="receipt-val mono">${sessionId}</span></div>
            <div class="receipt-row"><span>Vehicle ID</span><span class="receipt-val">#${id}</span></div>
            <div class="receipt-row"><span>Date</span><span class="receipt-val">${now.toLocaleDateString('en-IN', { year: 'numeric', month: 'long', day: 'numeric' })}</span></div>
            <div class="receipt-row"><span>Time</span><span class="receipt-val">${now.toLocaleTimeString('en-IN')}</span></div>
            <div class="receipt-row"><span>Departure</span><span class="receipt-val">${formatDeparture(departure)}</span></div>
        </div>

        <div class="receipt-section">
            <div class="receipt-section-title">CHARGING SPECS</div>
            <div class="receipt-row"><span>Connector Type</span><span class="receipt-val">${connector}</span></div>
            <div class="receipt-row"><span>Charging Speed</span><span class="receipt-val">${speed}</span></div>
            <div class="receipt-row"><span>Priority Class</span><span class="receipt-val">${priority}</span></div>
            <div class="receipt-row"><span>Final Battery</span><span class="receipt-val text-emerald">${battery}%</span></div>
        </div>

        <div class="receipt-section receipt-billing">
            <div class="receipt-section-title">BILLING SUMMARY</div>
            <div class="receipt-row"><span>Energy Delivered</span><span class="receipt-val">${kwhDelivered} kWh</span></div>
            <div class="receipt-row"><span>Tariff Rate</span><span class="receipt-val">₹${tariff.toFixed(2)} / kWh</span></div>
            <div class="receipt-row"><span>Base Charge</span><span class="receipt-val">₹${baseCharge.toFixed(2)}</span></div>
            ${discount > 0 ? `<div class="receipt-row receipt-discount"><span>Premium Discount (${Math.round(discount * 100)}%)</span><span class="receipt-val text-emerald">-₹${discountAmount.toFixed(2)}</span></div>` : ''}
            <div class="receipt-row"><span>Subtotal</span><span class="receipt-val">₹${total.toFixed(2)}</span></div>
            <div class="receipt-row"><span>GST (18%)</span><span class="receipt-val">₹${gst.toFixed(2)}</span></div>
            <div class="receipt-row receipt-total"><span>TOTAL</span><span class="receipt-val">₹${grandTotal.toFixed(2)}</span></div>
        </div>

        <div class="receipt-section receipt-eco">
            <div class="receipt-eco-badge">
                <span>⚡</span>
                <span>Membership: <strong>${membership}</strong> • Session: <strong>${sessionId}</strong></span>
            </div>
        </div>
    `;

    modalReceipt.classList.add('open');
    playSound('success');
};

function closeReceipt() {
    if (modalReceipt) modalReceipt.classList.remove('open');
}

if (btnCloseReceipt) btnCloseReceipt.addEventListener('click', closeReceipt);
if (btnCloseReceiptBtn) btnCloseReceiptBtn.addEventListener('click', closeReceipt);
if (modalReceipt) {
    modalReceipt.addEventListener('click', (e) => {
        if (e.target === modalReceipt) closeReceipt();
    });
}

if (btnPrintReceipt) {
    btnPrintReceipt.addEventListener('click', () => {
        window.print();
    });
}

// Simulate Traffic
btnSimulateTraffic.addEventListener('click', async () => {
    btnSimulateTraffic.disabled = true;
    try {
        await apiFetch('/api/simulate', { method: 'POST' });
        showToast('Rush Hour batch injected! 6 EVs added to simulation.', 'success');
        refreshAllData();
    } catch (err) {
        showToast(`Simulation failed: ${err.message}`, 'error');
    } finally {
        btnSimulateTraffic.disabled = false;
    }
});

// Reset System
btnResetSystem.addEventListener('click', async () => {
    if (!confirm('Are you sure you want to reset all stations, queues, and vehicle data to initial state?')) return;
    try {
        await apiFetch('/api/reset', { method: 'POST' });
        showToast('System reset to default state.', 'info');
        refreshAllData();
    } catch (err) {
        showToast(`Reset failed: ${err.message}`, 'error');
    }
});

// Sort by Departure
btnSortDeparture.addEventListener('click', () => {
    currentSortDeparture = !currentSortDeparture;
    btnSortDeparture.classList.toggle('active', currentSortDeparture);
    refreshAllData();
    showToast(currentSortDeparture ? 'Sorted vehicles by departure time.' : 'Default registry order.', 'info');
    playSound('click');
});

// Clear Logs
btnClearLogs.addEventListener('click', () => {
    consoleBody.innerHTML = '<div class="log-line log-system"><span class="log-time">[00:00:00]</span> <span class="log-tag">[SYSTEM]</span> Console cleared by user.</div>';
    logCountDisplay.textContent = '0 events';
    playSound('click');
});

// Search in Registry
registrySearch.addEventListener('input', () => {
    apiFetch(`/api/vehicles${currentSortDeparture ? '?sort=departure' : ''}`)
        .then(renderVehiclesTable)
        .catch(() => {});
});

// Export CSV
if (btnExportCsv) {
    btnExportCsv.addEventListener('click', async () => {
        try {
            const response = await fetch(`${API_BASE}/api/export`);
            const blob = await response.blob();
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = 'voltgrid_vehicles.csv';
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
            showToast('CSV exported successfully!', 'success');
        } catch (err) {
            showToast(`Export failed: ${err.message}`, 'error');
        }
    });
}

// Battery Tick (Boost +10%)
if (btnTickBattery) {
    btnTickBattery.addEventListener('click', async () => {
        btnTickBattery.disabled = true;
        try {
            const res = await apiFetch('/api/vehicles/tick', { method: 'POST' });
            const charged = res.fullyCharged || [];
            if (charged.length > 0) {
                showToast(`Battery boost applied! Vehicles fully charged: ${charged.join(', ')}`, 'success');
            } else {
                showToast('Battery boost applied to all active charging sessions.', 'info');
            }
            playSound('charge');
            refreshAllData();
        } catch (err) {
            showToast(`Tick failed: ${err.message}`, 'error');
        } finally {
            btnTickBattery.disabled = false;
        }
    });
}

// Audio Toggle
if (btnAudioToggle) {
    btnAudioToggle.addEventListener('click', () => {
        audioEnabled = !audioEnabled;
        const iconOn = document.getElementById('iconAudioOn');
        const iconOff = document.getElementById('iconAudioOff');
        if (audioEnabled) {
            iconOn.style.display = '';
            iconOff.style.display = 'none';
            playSound('click');
        } else {
            iconOn.style.display = 'none';
            iconOff.style.display = '';
        }
        showToast(audioEnabled ? 'Sound effects enabled.' : 'Sound effects muted.', 'info');
    });
}

// Auto-Charge Simulation Toggle
if (simTogglePill) {
    simTogglePill.addEventListener('click', () => {
        autoChargeEnabled = !autoChargeEnabled;
        updateAutoChargeState();
        playSound('click');
        showToast(autoChargeEnabled ? 'Auto-charge simulation ACTIVATED.' : 'Auto-charge simulation PAUSED.', 'info');
    });
}

function updateAutoChargeState() {
    if (autoChargeEnabled) {
        simIndicator.classList.add('active');
        simIndicator.classList.remove('paused');
        simStatusText.textContent = 'ACTIVE';
        simStatusText.style.color = 'var(--emerald)';
        if (!autoChargeTimer) {
            autoChargeTimer = setInterval(autoChargeTick, 4000);
        }
    } else {
        simIndicator.classList.remove('active');
        simIndicator.classList.add('paused');
        simStatusText.textContent = 'PAUSED';
        simStatusText.style.color = 'var(--amber)';
        if (autoChargeTimer) {
            clearInterval(autoChargeTimer);
            autoChargeTimer = null;
        }
    }
}

async function autoChargeTick() {
    if (!autoChargeEnabled || !isConnected) return;
    try {
        await apiFetch('/api/vehicles/tick', { method: 'POST' });
        // Silently refresh - no toast for auto ticks
        refreshAllData();
    } catch (e) {
        // Ignore auto-tick failures
    }
}

// ============================================================
// BAY FILTER CONTROLS
// ============================================================
document.querySelectorAll('.filter-chip').forEach(chip => {
    chip.addEventListener('click', () => {
        document.querySelectorAll('.filter-chip').forEach(c => c.classList.remove('active'));
        chip.classList.add('active');
        currentBayFilter = chip.getAttribute('data-filter');
        playSound('click');
        refreshAllData();
    });
});

// ============================================================
// STATUS FILTER PILLS (Vehicle Registry)
// ============================================================
document.querySelectorAll('.tbl-filter-btn').forEach(btn => {
    btn.addEventListener('click', () => {
        document.querySelectorAll('.tbl-filter-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        currentStatusFilter = btn.getAttribute('data-status');
        playSound('click');
        refreshAllData();
    });
});

// ============================================================
// TABS HANDLING
// ============================================================
document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
        document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
        document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
        
        btn.classList.add('active');
        const targetId = btn.getAttribute('data-tab');
        const targetContent = document.getElementById(targetId);
        if (targetContent) targetContent.classList.add('active');
        playSound('click');
    });
});

// ============================================================
// MODAL & PRESETS HANDLING
// ============================================================
function openModal() {
    modalAddEV.classList.add('open');
    apiFetch('/api/vehicles').then(vehicles => {
        const nextId = vehicles && vehicles.length ? Math.max(...vehicles.map(v => v.id)) + 1 : 101;
        inputVehicleId.value = nextId;
    }).catch(() => {
        inputVehicleId.value = 101;
    });
    playSound('click');
}

function closeModal() {
    modalAddEV.classList.remove('open');
}

btnOpenAddModal.addEventListener('click', openModal);
btnCloseModal.addEventListener('click', closeModal);
btnCancelModal.addEventListener('click', closeModal);

modalAddEV.addEventListener('click', (e) => {
    if (e.target === modalAddEV) closeModal();
});

// Battery Slider Sync
rangeBattery.addEventListener('input', () => {
    const val = rangeBattery.value;
    batteryValDisplay.textContent = `${val}%`;
    batteryFill.style.width = `${val}%`;
    
    // Dynamic color
    if (val < 20) {
        batteryFill.style.background = 'var(--rose)';
        batteryValDisplay.style.background = 'rgba(239, 68, 68, 0.15)';
        batteryValDisplay.style.color = 'var(--rose)';
    } else if (val < 50) {
        batteryFill.style.background = 'var(--amber)';
        batteryValDisplay.style.background = 'rgba(234, 179, 8, 0.15)';
        batteryValDisplay.style.color = 'var(--amber)';
    } else {
        batteryFill.style.background = 'var(--emerald)';
        batteryValDisplay.style.background = 'rgba(34, 197, 94, 0.15)';
        batteryValDisplay.style.color = 'var(--emerald)';
    }
});

// Radio Cards Visual Selection
document.querySelectorAll('.radio-card input').forEach(input => {
    input.addEventListener('change', () => {
        const groupName = input.name;
        document.querySelectorAll(`input[name="${groupName}"]`).forEach(r => {
            r.closest('.radio-card').classList.toggle('active', r.checked);
        });
        playSound('click');
    });
});

document.querySelectorAll('.priority-pill input').forEach(input => {
    input.addEventListener('change', () => {
        document.querySelectorAll('input[name="priority"]').forEach(r => {
            r.closest('.priority-pill').classList.toggle('active', r.checked);
        });
        playSound('click');
    });
});

// Quick Presets
document.getElementById('presetAmbulance').addEventListener('click', () => {
    rangeBattery.value = 15;
    rangeBattery.dispatchEvent(new Event('input'));
    document.querySelector('input[name="connectorType"][value="CCS"]').click();
    document.querySelector('input[name="chargingRequirement"][value="Fast"]').click();
    document.querySelector('input[name="priority"][value="Emergency"]').click();
    inputDeparture.value = '08:30';
    selectMembership.value = 'Premium';
    selectReservation.value = 'Yes';
    showToast('Preset loaded: Ambulance Emergency', 'info');
});

document.getElementById('presetVIP').addEventListener('click', () => {
    rangeBattery.value = 35;
    rangeBattery.dispatchEvent(new Event('input'));
    document.querySelector('input[name="connectorType"][value="Type2"]').click();
    document.querySelector('input[name="chargingRequirement"][value="Fast"]').click();
    document.querySelector('input[name="priority"][value="Reserved"]').click();
    inputDeparture.value = '09:15';
    selectMembership.value = 'Premium';
    selectReservation.value = 'Yes';
    showToast('Preset loaded: VIP Executive', 'info');
});

document.getElementById('presetTaxi').addEventListener('click', () => {
    rangeBattery.value = 20;
    rangeBattery.dispatchEvent(new Event('input'));
    document.querySelector('input[name="connectorType"][value="CCS"]').click();
    document.querySelector('input[name="chargingRequirement"][value="Fast"]').click();
    document.querySelector('input[name="priority"][value="Normal"]').click();
    inputDeparture.value = '11:00';
    selectMembership.value = 'Regular';
    selectReservation.value = 'No';
    showToast('Preset loaded: Taxi Fast Charge', 'info');
});

document.getElementById('presetCommuter').addEventListener('click', () => {
    rangeBattery.value = 55;
    rangeBattery.dispatchEvent(new Event('input'));
    document.querySelector('input[name="connectorType"][value="Type2"]').click();
    document.querySelector('input[name="chargingRequirement"][value="Normal"]').click();
    document.querySelector('input[name="priority"][value="Normal"]').click();
    inputDeparture.value = '17:30';
    selectMembership.value = 'Regular';
    selectReservation.value = 'No';
    showToast('Preset loaded: Daily Commuter', 'info');
});

// Form Submission
formAddVehicle.addEventListener('submit', async (e) => {
    e.preventDefault();
    const submitBtn = document.getElementById('btnSubmitEV');
    submitBtn.disabled = true;

    const payload = {
        id: parseInt(inputVehicleId.value, 10),
        batteryLevel: parseInt(rangeBattery.value, 10),
        connectorType: document.querySelector('input[name="connectorType"]:checked').value,
        chargingRequirement: document.querySelector('input[name="chargingRequirement"]:checked').value,
        priority: document.querySelector('input[name="priority"]:checked').value,
        departureTime: inputDeparture.value,
        membership: selectMembership.value,
        reservation: selectReservation.value
    };

    try {
        const res = await apiFetch('/api/vehicles', {
            method: 'POST',
            body: JSON.stringify(payload)
        });

        closeModal();
        if (res.assigned) {
            showToast(`Vehicle #${payload.id} successfully assigned to charging bay!`, 'success');
        } else {
            showToast(`Vehicle #${payload.id} placed into ${res.queueType} Queue.`, 'info');
        }
        refreshAllData();
    } catch (err) {
        showToast(`Failed to add vehicle: ${err.message}`, 'error');
    } finally {
        submitBtn.disabled = false;
    }
});

// Backend status pill click -> trigger reconnect test
backendStatusPill.addEventListener('click', () => {
    showToast('Testing backend connection...', 'info');
    refreshAllData();
});

// ============================================================
// KEYBOARD SHORTCUTS
// ============================================================
document.addEventListener('keydown', (e) => {
    // Escape closes modals
    if (e.key === 'Escape') {
        closeModal();
        closeReceipt();
    }
    // Ctrl+N opens new EV modal
    if (e.ctrlKey && e.key === 'n') {
        e.preventDefault();
        openModal();
    }
    // Ctrl+E exports CSV
    if (e.ctrlKey && e.key === 'e') {
        e.preventDefault();
        if (btnExportCsv) btnExportCsv.click();
    }
});

// ============================================================
// INITIALIZATION & POLLING
// ============================================================
refreshAllData();
pollInterval = setInterval(refreshAllData, 1500);

// Start auto-charge simulation
updateAutoChargeState();

console.log('%c⚡ VoltGrid Pro v2.0 Dashboard Initialized', 'color: #e12d39; font-weight: bold; font-size: 14px;');
console.log('%cBackend: ' + API_BASE, 'color: #94a3b8;');
