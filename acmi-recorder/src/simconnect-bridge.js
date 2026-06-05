'use strict';

/**
 * simconnect-bridge.js
 * 
 * Wraps node-simconnect v4 to poll all aircraft (including MSFS 2024 multiplayer)
 * and expose a clean aircraft state map to the rest of the app.
 * 
 * node-simconnect v4 is pure JavaScript — no native rebuild needed.
 * https://github.com/EvenAR/node-simconnect
 */

const { EventEmitter } = require('events');

// ── SimConnect numeric IDs ──────────────────────────────────────────────────
const DEFINE_FLIGHT = 1;   // data definition ID for flight dynamics

// ── Stale timeout: remove aircraft not seen in N ms ────────────────────────
const STALE_MS = 3000;

// SIMCONNECT_SIMOBJECT_TYPE_AIRCRAFT = 2
// Captures user aircraft + AI traffic + multiplayer aircraft
const SIMOBJECT_TYPE_AIRCRAFT = 2;

class SimConnectBridge extends EventEmitter {
    constructor() {
        super();
        this.handle   = null;
        this.aircraft = new Map(); // objectId (number) → AircraftState
        this._requestCounter = 0;
        this._definitionReady = false;
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
                'node-simconnect is not installed. Run: npm install'
            );
        }

        const { open, Protocol, SimConnectDataType } = pkg;

        // KittyHawk = MSFS 2020/2024. Falls back to FSX_SP2 if not available.
        const protocol = pkg.Protocol.KittyHawk ?? pkg.Protocol.FSX_SP2;

        const { handle } = await open('158FW-ACMI-Recorder', protocol);
        this.handle = handle;

        // ── Define the data layout we want per aircraft ────────────────────
        // Each addToDataDefinition appends a field; read back in the same order.
        const F64 = SimConnectDataType.FLOAT64;

        handle.addToDataDefinition(DEFINE_FLIGHT, 'PLANE LATITUDE',             'degrees', F64);
        handle.addToDataDefinition(DEFINE_FLIGHT, 'PLANE LONGITUDE',            'degrees', F64);
        handle.addToDataDefinition(DEFINE_FLIGHT, 'PLANE ALTITUDE',             'feet',    F64);
        handle.addToDataDefinition(DEFINE_FLIGHT, 'PLANE HEADING DEGREES TRUE', 'degrees', F64);
        handle.addToDataDefinition(DEFINE_FLIGHT, 'PLANE PITCH DEGREES',        'degrees', F64);
        handle.addToDataDefinition(DEFINE_FLIGHT, 'PLANE BANK DEGREES',         'degrees', F64);
        handle.addToDataDefinition(DEFINE_FLIGHT, 'AIRSPEED INDICATED',         'knots',   F64);
        handle.addToDataDefinition(DEFINE_FLIGHT, 'G FORCE',                    'number',  F64);

        this._definitionReady = true;

        // ── Wire up events ─────────────────────────────────────────────────
        handle.on('simObjectDataByType', (packet) => this._handleData(packet));

        handle.on('exception', (ex) => {
            // SimConnect exceptions are generally recoverable — warn but don't crash
            this.emit('warning', `SimConnect exception ${ex.exceptionCode ?? ''}`);
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
            this.emit('error', err.message ?? String(err));
        });

        this.emit('connected');
    }

    /**
     * Send one snapshot request for all aircraft within 200 km.
     * Responses arrive asynchronously via the 'simObjectDataByType' event.
     */
    requestUpdate() {
        if (!this.handle || !this._definitionReady) return;
        const reqId = (++this._requestCounter) & 0x7FFFFFFF;
        try {
            this.handle.requestDataOnSimObjectType(
                reqId,
                DEFINE_FLIGHT,
                200000,                   // radius metres (200 km)
                SIMOBJECT_TYPE_AIRCRAFT   // 2 = SIMCONNECT_SIMOBJECT_TYPE_AIRCRAFT
            );
        } catch (_) {
            // If sim isn't in a loaded state yet, skip silently
        }
    }

    /**
     * Called for every aircraft returned by a requestDataOnSimObjectType call.
     * packet.objectID is the sim's internal object handle (unique per session).
     */
    _handleData(packet) {
        // node-simconnect v4 uses camelCase: objectID, requestID, data
        const objectID = packet.objectID ?? packet.objectId;
        const data     = packet.data;
        if (!data || objectID === undefined) return;

        try {
            const lat     = data.readFloat64();
            const lon     = data.readFloat64();
            const alt_ft  = data.readFloat64();
            const heading = data.readFloat64();
            const pitch   = data.readFloat64(); // SimConnect: + = nose DOWN
            const bank    = data.readFloat64(); // SimConnect: + = left-wing DOWN
            const ias     = data.readFloat64();
            const gforce  = data.readFloat64();

            const existing = this.aircraft.get(objectID);
            this.aircraft.set(objectID, {
                lat, lon, alt_ft, heading, pitch, bank, ias, gforce,
                name:      existing?.name ?? null,
                updatedAt: Date.now(),
            });
        } catch (_) {
            // Malformed packet — skip silently
        }
    }

    /**
     * Returns a snapshot of the aircraft map, pruning stale entries first.
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

    get aircraftCount() { return this.aircraft.size; }

    disconnect() {
        this._definitionReady = false;
        if (this.handle) {
            try { this.handle.close(); } catch (_) {}
            this.handle = null;
        }
        this.aircraft.clear();
    }

    get isConnected() { return this.handle !== null; }
}

module.exports = SimConnectBridge;
