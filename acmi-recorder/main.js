'use strict';

/**
 * main.js — Electron main process
 * 
 * Responsibilities:
 *  - Create the BrowserWindow
 *  - Own the SimConnectBridge and ACMIWriter instances
 *  - Handle IPC calls from the renderer
 *  - Manage the recording loop (poll → write frame → repeat)
 *  - Show save dialog and write the .acmi file to disk
 */

const { app, BrowserWindow, ipcMain, dialog, shell } = require('electron');
const path   = require('path');
const fs     = require('fs');

const SimConnectBridge = require('./src/simconnect-bridge');
const ACMIWriter       = require('./src/acmi-writer');

// ── State ──────────────────────────────────────────────────────────────────
const bridge  = new SimConnectBridge();
const writer  = new ACMIWriter();
let   win     = null;

let isRecording    = false;
let recordingTimer = null;   // setInterval handle
let recordingStart = null;   // Date object

// Per-aircraft metadata supplied by the user (callsign overrides, aircraft type)
// Map<objectId, { callsign, aircraftType }>
const metaOverrides = new Map();

// ── Create window ──────────────────────────────────────────────────────────
function createWindow() {
    win = new BrowserWindow({
        width:           960,
        height:          660,
        minWidth:        820,
        minHeight:       560,
        title:           '158th FW ACMI Recorder',
        backgroundColor: '#141618',
        autoHideMenuBar: true,
        webPreferences:  {
            preload:          path.join(__dirname, 'preload.js'),
            contextIsolation: true,
            nodeIntegration:  false,
            sandbox:          false,  // needed so preload can require() modules
        },
    });

    win.loadFile(path.join(__dirname, 'renderer', 'index.html'));
}

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
    stopRecording(false); // clean up without saving
    bridge.disconnect();
    app.quit();
});

// ── SimConnect bridge events → forward to renderer ─────────────────────────
bridge.on('connected',    ()        => sendToRenderer('sim-event', { type: 'connected' }));
bridge.on('disconnected', (reason)  => sendToRenderer('sim-event', { type: 'disconnected', reason }));
bridge.on('warning',      (msg)     => sendToRenderer('sim-event', { type: 'warning', message: msg }));
bridge.on('error',        (msg)     => sendToRenderer('sim-event', { type: 'error',   message: msg }));
bridge.on('aircraftLeft', (id)      => {
    if (isRecording) writer.removeObject(id);
});

function sendToRenderer(channel, payload) {
    if (win && !win.isDestroyed()) {
        win.webContents.send(channel, payload);
    }
}

// ── IPC: connect to MSFS ───────────────────────────────────────────────────
ipcMain.handle('connect-sim', async () => {
    if (bridge.isConnected) return { ok: true };
    try {
        await bridge.connect();
        return { ok: true };
    } catch (e) {
        return { ok: false, error: e.message };
    }
});

// ── IPC: disconnect from MSFS ──────────────────────────────────────────────
ipcMain.handle('disconnect-sim', async () => {
    if (isRecording) await stopRecording(false);
    bridge.disconnect();
    return { ok: true };
});

// ── IPC: start recording ───────────────────────────────────────────────────
ipcMain.handle('start-recording', async (_evt, opts) => {
    if (!bridge.isConnected) return { ok: false, error: 'Not connected to MSFS' };
    if (isRecording)         return { ok: false, error: 'Already recording' };

    const title = opts?.missionName || '158th FW Mission';
    writer.reset();
    writer.initialize(title, new Date());

    isRecording    = true;
    recordingStart = Date.now();

    // Prime the first snapshot immediately
    bridge.requestUpdate();

    // Recording loop: every 500 ms
    //   1. Write a frame from previously received data
    //   2. Request fresh data for the next frame
    recordingTimer = setInterval(() => {
        const elapsed  = (Date.now() - recordingStart) / 1000;
        const aircraft = bridge.getAircraft();

        if (aircraft.size > 0) {
            writer.writeFrame(elapsed, aircraft, metaOverrides);
        }

        // Push status to renderer
        sendToRenderer('recording-tick', {
            elapsed,
            aircraftCount: aircraft.size,
            aircraft: [...aircraft.entries()].map(([id, s]) => ({
                id,
                hexId:   id.toString(16).toUpperCase(),
                lat:     s.lat.toFixed(5),
                lon:     s.lon.toFixed(5),
                alt_ft:  Math.round(s.alt_ft),
                heading: Math.round(s.heading),
                ias:     Math.round(s.ias),
                gforce:  s.gforce.toFixed(2),
                name:    metaOverrides.get(id)?.callsign || s.name || `Aircraft-${id.toString(16).toUpperCase()}`,
            })),
        });

        // Request next snapshot
        bridge.requestUpdate();

    }, 500);

    return { ok: true };
});

// ── IPC: stop recording ────────────────────────────────────────────────────
ipcMain.handle('stop-recording', async (_evt, opts) => {
    if (!isRecording) return { ok: false, error: 'Not recording' };
    return stopRecording(true, opts);
});

async function stopRecording(save, opts) {
    if (recordingTimer) {
        clearInterval(recordingTimer);
        recordingTimer = null;
    }
    isRecording = false;

    if (!save) return { ok: true };

    const content = writer.getContent();
    const missionName = opts?.missionName || 'mission';
    const dateStr     = new Date().toISOString().slice(0, 10);
    const defaultName = `${missionName.replace(/[^a-zA-Z0-9_\-]/g, '_')}_${dateStr}.acmi`;

    const { filePath } = await dialog.showSaveDialog(win, {
        title:       'Save ACMI Recording',
        defaultPath: path.join(app.getPath('documents'), defaultName),
        filters:     [
            { name: 'Tacview ACMI', extensions: ['acmi'] },
            { name: 'All Files',    extensions: ['*']    },
        ],
    });

    if (!filePath) return { ok: false, error: 'Save cancelled' };

    try {
        fs.writeFileSync(filePath, content, 'utf-8');
        sendToRenderer('sim-event', { type: 'file-saved', filePath });
        return { ok: true, filePath };
    } catch (e) {
        return { ok: false, error: `Failed to write file: ${e.message}` };
    }
}

// ── IPC: open file in explorer ─────────────────────────────────────────────
ipcMain.handle('show-in-explorer', async (_evt, filePath) => {
    shell.showItemInFolder(filePath);
    return { ok: true };
});

// ── IPC: get status ────────────────────────────────────────────────────────
ipcMain.handle('get-status', async () => {
    return {
        connected:    bridge.isConnected,
        recording:    isRecording,
        aircraftCount: bridge.aircraftCount,
    };
});
