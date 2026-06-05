'use strict';

/**
 * preload.js — secure contextBridge between main process and renderer
 * 
 * Exposes a safe, minimal API surface via window.acmiRecorder
 */

const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('acmiRecorder', {

    // ── Commands (renderer → main) ──────────────────────────────────────
    connectSim:       ()      => ipcRenderer.invoke('connect-sim'),
    disconnectSim:    ()      => ipcRenderer.invoke('disconnect-sim'),
    getStatus:        ()      => ipcRenderer.invoke('get-status'),
    startRecording:   (opts)  => ipcRenderer.invoke('start-recording', opts),
    stopRecording:    (opts)  => ipcRenderer.invoke('stop-recording',  opts),
    showInExplorer:   (path)  => ipcRenderer.invoke('show-in-explorer', path),

    // ── Events (main → renderer) ────────────────────────────────────────
    // Register a callback for SimConnect lifecycle events.
    // Possible event types: 'connected' | 'disconnected' | 'warning' | 'error' | 'file-saved'
    onSimEvent: (callback) => {
        ipcRenderer.on('sim-event', (_evt, payload) => callback(payload));
    },

    // Fired every 500 ms while recording.
    // Payload: { elapsed, aircraftCount, aircraft: [...] }
    onRecordingTick: (callback) => {
        ipcRenderer.on('recording-tick', (_evt, payload) => callback(payload));
    },
});
