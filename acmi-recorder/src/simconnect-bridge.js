'use strict';

/**
 * simconnect-bridge.js
 * 
 * Wraps node-simconnect to poll all aircraft (including MSFS 2024 multiplayer)
 * and expose a clean aircraft state map to the rest of the app.
 * 
 * Compatible with node-simconnect v0.8.x
 * https://github.com/EvenAR/node-simconnect
 */

const { EventEmitter } = require('events');

// ── SimConnect numeric IDs ──────────────────────────────────────────────────
const DEFINE_FLIGHT = 1;   // data definition for flight dynamics
const REQ_FLIGHT    = 1;   // request ID for SimObjectType queries

// ── Stale timeout: remove aircraft not seen in N ms ────────────────────────
const STALE_MS = 3000;

class SimConnectBridge extends EventEmitter {
    constructor() {
        super();
        this.handle   = null;
        this.aircraft = new Map(); // objectId (number) → AircraftState
        this._requestCounter = 0;
    }

    /**
     * Attempt to connect to a running MSFS instance.
     * Throws if MSFS is not running or SimConnect is not available.
     */
    async connect() {
        let pkg;
        try {
            pkg = require('node-simconnect');
        } catch (e) {
            throw new Error(
                'node-simconnect is not installed or could not be loaded. ' +
                'Run: npm install && npm run rebuild'
            );
        }

        const { open, Protocol, SimConnectDataType } = pkg;

        const { handle } = await open('158FW-ACMI-Recorder', Protocol.KittyHawk);
        this.handle = handle;

        // ── Define the data layout we want for each aircraft ──────────────
        // Each addToDataDefinition call appends a field in order.
        // We read them back in the same order in _handleData().
        const F64 = SimConnectDataType.FLOAT64;

        handle.addToDataDefinition(DEFINE_FLIGHT, 'PLANE LATITUDE',              'degrees', F64);
        handle.addToDataDefinition(DEFINE_FLIGHT, 'PLANE LONGITUDE',             'degrees', F64);
        handle.addToDataDefinition(DEFINE_FLIGHT, 'PLANE ALTITUDE',              'feet',    F64);
        handle.addToDataDefinition(DEFINE_FLIGHT, 'PLANE HEADING DEGREES TRUE',  'degrees', F64);
        handle.addToDataDefinition(DEFINE_FLIGHT, 'PLANE PITCH DEGREES',         'degrees', F64);
        handle.addToDataDefinition(DEFINE_FLIGHT, 'PLANE BANK DEGREES',          'degrees', F64);
        handle.addToDataDefinition(DEFINE_FLIGHT, 'AIRSPEED INDICATED',          'knots',   F64);
        handle.addToDataDefinition(DEFINE_FLIGHT, 'G FORCE',                     'number',  F64);

        // ── Wire up events ────────────────────────────────────────────────
        handle.on('simObjectDataByType', (packet) => this._handleData(packet));

        handle.on('exception', (ex) => {
            // SimConnect exceptions are recoverable — log but don't crash
            this.emit('warning', `SimConnect exception: ${JSON.stringify(ex)}`);
        });

        handle.on('quit', () => {
            this.disconnect();
            this.emit('disconnected', 'Simulator closed or restarted');
        });

        handle.on('close', () => {
            this.disconnect();
            this.emit('disconnected', 'Connection to SimConnect closed');
        });

        handle.on('error', (err) => {
            this.emit('error', err.message || String(err));
        });

        this.emit('connected');
    }

    /**
     * Send one snapshot request for all aircraft within 200 km.
     * Responses arrive asynchronously via the 'simObjectDataByType' event.
     * SimObjectType 2 = SIMCONNECT_SIMOBJECT_TYPE_AIRCRAFT
     * (includes user's own aircraft + all AI / multiplayer aircraft)
     */
    requestUpdate() {
        if (!this.handle) return;
        const reqId = (++this._requestCounter) & 0x7FFFFFFF; // keep positive
        try {
            this.handle.requestDataOnSimObjectType(
                reqId,
                DEFINE_FLIGHT,
                200000, // radius in metres (200 km)
                2       // SIMCONNECT_SIMOBJECT_TYPE_AIRCRAFT
            );
        } catch (e) {
            // If SimConnect isn't ready yet, silently skip
        }
    }

    /**
     * Called for every aircraft in the snapshot response.
     */
    _handleData(packet) {
        const { objectID, data } = packet;
        if (!data || objectID === undefined) return;

        try {
            const lat     = data.readFloat64();
            const lon     = data.readFloat64();
            const alt_ft  = data.readFloat64();
            const heading = data.readFloat64();
            const pitch   = data.readFloat64(); // SimConnect: + = nose DOWN
            const bank    = data.readFloat64(); // SimConnect: + = left wing DOWN
            const ias     = data.readFloat64();
            const gforce  = data.readFloat64();

            const existing = this.aircraft.get(objectID);
            this.aircraft.set(objectID, {
                lat,
                lon,
                alt_ft,
                heading,
                pitch,
                bank,
                ias,
                gforce,
                name:      existing?.name || null,
                updatedAt: Date.now(),
            });
        } catch (_) {
            // Malformed packet — skip silently
        }
    }

    /**
     * Returns a copy of the current aircraft map, pruning stale entries.
     * objectId (number) → AircraftState
     */
    getAircraft() {
        const now = Date.now();
        const stale = [];
        for (const [id, state] of this.aircraft) {
            if (now - state.updatedAt > STALE_MS) stale.push(id);
        }
        for (const id of stale) {
            this.aircraft.delete(id);
            this.emit('aircraftLeft', id);
        }
        return new Map(this.aircraft);
    }

    /**
     * Number of currently tracked aircraft (before stale pruning).
     */
    get aircraftCount() {
        return this.aircraft.size;
    }

    disconnect() {
        if (this.handle) {
            try { this.handle.close(); } catch (_) {}
            this.handle = null;
        }
        this.aircraft.clear();
    }

    get isConnected() {
        return this.handle !== null;
    }
}

module.exports = SimConnectBridge;
