'use strict';

/**
 * renderer.js — UI logic for the ACMI Recorder
 * Communicates with main process via window.acmiRecorder (exposed by preload.js)
 */

// ── DOM refs ────────────────────────────────────────────────────────────────
const statusDot      = document.getElementById('statusDot');
const statusLabel    = document.getElementById('statusLabel');
const connectBtn     = document.getElementById('connectBtn');
const missionNameIn  = document.getElementById('missionName');
const pilotCallsign  = document.getElementById('pilotCallsign');
const missionDateIn  = document.getElementById('missionDate');
const recordBtn      = document.getElementById('recordBtn');
const recTimer       = document.getElementById('recTimer');
const bottomInfo     = document.getElementById('bottomInfo');
const lastSaved      = document.getElementById('lastSaved');
const aircraftCount  = document.getElementById('aircraftCount');
const noAircraft     = document.getElementById('noAircraft');
const aircraftTable  = document.getElementById('aircraftTable');
const aircraftBody   = document.getElementById('aircraftBody');
const toast          = document.getElementById('toast');

// ── App state ────────────────────────────────────────────────────────────────
let simConnected  = false;
let isRecording   = false;
let lastFilePath  = null;
let timerInterval = null;
let recordStart   = null;

// ── Init ─────────────────────────────────────────────────────────────────────
missionDateIn.value = new Date().toISOString().slice(0, 10);

// Fetch initial state in case the window was reloaded
window.acmiRecorder.getStatus().then(s => {
    setConnected(s.connected);
    if (s.recording) setRecording(true);
});

// ── SimConnect events from main ───────────────────────────────────────────────
window.acmiRecorder.onSimEvent(payload => {
    switch (payload.type) {
        case 'connected':
            setConnected(true);
            showToast('Connected to MSFS', 'success');
            break;

        case 'disconnected':
            setConnected(false);
            if (isRecording) setRecording(false);
            showToast(payload.reason || 'Disconnected from MSFS', 'warning');
            break;

        case 'warning':
            showToast(payload.message, 'warning');
            break;

        case 'error':
            showToast(payload.message, 'error');
            break;

        case 'file-saved':
            lastFilePath = payload.filePath;
            lastSaved.textContent = `Saved: ${payload.filePath.split(/[\\/]/).pop()}`;
            lastSaved.classList.add('visible');
            showToast('Recording saved!', 'success');
            break;
    }
});

// ── Recording tick: update table ──────────────────────────────────────────────
window.acmiRecorder.onRecordingTick(payload => {
    updateAircraftTable(payload.aircraft);
    updateCount(payload.aircraftCount);
});

// ── Connect / Disconnect ──────────────────────────────────────────────────────
connectBtn.addEventListener('click', async () => {
    if (simConnected) {
        connectBtn.disabled = true;
        await window.acmiRecorder.disconnectSim();
        setConnected(false);
        connectBtn.disabled = false;
    } else {
        connectBtn.disabled = true;
        connectBtn.textContent = 'Connecting…';
        const result = await window.acmiRecorder.connectSim();
        connectBtn.disabled = false;
        if (!result.ok) {
            showToast(result.error || 'Failed to connect', 'error');
            connectBtn.textContent = 'Connect to MSFS';
        }
        // Success is handled by the 'connected' sim-event
    }
});

// ── Start / Stop Recording ────────────────────────────────────────────────────
recordBtn.addEventListener('click', async () => {
    recordBtn.disabled = true;

    if (!isRecording) {
        const opts = {
            missionName:   missionNameIn.value.trim() || '158th FW Mission',
            pilotCallsign: pilotCallsign.value.trim(),
            missionDate:   missionDateIn.value,
        };
        const result = await window.acmiRecorder.startRecording(opts);
        if (result.ok) {
            setRecording(true);
        } else {
            showToast(result.error || 'Could not start recording', 'error');
        }
    } else {
        const opts = { missionName: missionNameIn.value.trim() || '158th FW Mission' };
        const result = await window.acmiRecorder.stopRecording(opts);
        setRecording(false);
        if (!result.ok && result.error !== 'Save cancelled') {
            showToast(result.error || 'Error stopping recording', 'error');
        }
    }

    recordBtn.disabled = false;
});

// ── Open in Explorer ──────────────────────────────────────────────────────────
lastSaved.addEventListener('click', () => {
    if (lastFilePath) window.acmiRecorder.showInExplorer(lastFilePath);
});

// ── Helpers ───────────────────────────────────────────────────────────────────
function setConnected(connected) {
    simConnected = connected;

    statusDot.className   = 'status-dot' + (connected ? ' connected' : '');
    statusLabel.className = 'status-label' + (connected ? ' connected' : '');
    statusLabel.textContent = connected ? 'Connected to MSFS' : 'Disconnected';

    connectBtn.textContent = connected ? 'Disconnect' : 'Connect to MSFS';
    connectBtn.className   = 'btn-connect' + (connected ? ' connected' : '');
    connectBtn.disabled    = false;

    recordBtn.disabled = !connected;
    setInputsDisabled(isRecording);
}

function setRecording(recording) {
    isRecording = recording;

    recordBtn.textContent = recording ? '■ Stop Recording' : '▶ Start Recording';
    recordBtn.className   = 'btn-record' + (recording ? ' recording' : '');

    statusDot.className   = 'status-dot'   + (recording ? ' recording' : (simConnected ? ' connected' : ''));
    statusLabel.className = 'status-label' + (recording ? ' recording' : (simConnected ? ' connected' : ''));
    statusLabel.textContent = recording ? 'Recording' : (simConnected ? 'Connected to MSFS' : 'Disconnected');

    recTimer.classList.toggle('visible',   recording);
    recTimer.classList.toggle('recording', recording);

    setInputsDisabled(recording);

    if (recording) {
        recordStart = Date.now();
        bottomInfo.textContent = 'Recording in progress…';
        timerInterval = setInterval(updateTimer, 500);
    } else {
        if (timerInterval) { clearInterval(timerInterval); timerInterval = null; }
        bottomInfo.textContent = 'Not recording';
        recTimer.textContent   = '00:00:00';
    }
}

function setInputsDisabled(disabled) {
    missionNameIn.disabled = disabled;
    missionDateIn.disabled = disabled;
}

function updateTimer() {
    if (!recordStart) return;
    const s = Math.floor((Date.now() - recordStart) / 1000);
    const h = Math.floor(s / 3600);
    const m = Math.floor((s % 3600) / 60);
    const sec = s % 60;
    recTimer.textContent = `${pad(h)}:${pad(m)}:${pad(sec)}`;
}

function updateCount(count) {
    aircraftCount.textContent = `${count} aircraft`;
}

function updateAircraftTable(list) {
    if (!list || !list.length) {
        aircraftTable.style.display = 'none';
        noAircraft.style.display = 'block';
        noAircraft.textContent = simConnected
            ? 'No aircraft detected within 200 km. Is MSFS in a flight?'
            : 'Connect to MSFS and start recording to see aircraft.';
        return;
    }

    noAircraft.style.display    = 'none';
    aircraftTable.style.display = 'table';

    // Build rows — keep existing rows for smooth rendering
    const existing = {};
    for (const row of aircraftBody.querySelectorAll('tr[data-id]')) {
        existing[row.dataset.id] = row;
    }

    const ids = new Set(list.map(a => String(a.id)));

    // Remove stale rows
    for (const [id, row] of Object.entries(existing)) {
        if (!ids.has(id)) row.remove();
    }

    // Upsert rows
    for (const a of list) {
        const idKey = String(a.id);
        let row = existing[idKey];
        if (!row) {
            row = document.createElement('tr');
            row.dataset.id = idKey;
            row.innerHTML = `
                <td class="id-cell"></td>
                <td></td>
                <td></td>
                <td></td>
                <td></td>
                <td></td>
                <td class="muted"></td>
                <td class="muted"></td>`;
            aircraftBody.appendChild(row);
        }
        const cells = row.querySelectorAll('td');
        cells[0].textContent = a.hexId;
        cells[1].textContent = a.name;
        cells[2].textContent = a.alt_ft.toLocaleString();
        cells[3].textContent = a.heading;
        cells[4].textContent = a.ias;
        cells[5].textContent = a.gforce;
        cells[6].textContent = a.lat;
        cells[7].textContent = a.lon;
    }
}

function pad(n) { return String(n).padStart(2, '0'); }

let _toastTimeout = null;
function showToast(message, type = '') {
    toast.textContent  = message;
    toast.className    = `toast${type ? ' ' + type : ''} show`;
    if (_toastTimeout) clearTimeout(_toastTimeout);
    _toastTimeout = setTimeout(() => { toast.classList.remove('show'); }, 3500);
}
