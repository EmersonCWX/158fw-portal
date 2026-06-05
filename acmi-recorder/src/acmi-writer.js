'use strict';

/**
 * acmi-writer.js
 * 
 * Builds a Tacview ACMI 2.2 text file from accumulated SimConnect data.
 * 
 * ACMI format reference:
 *   https://www.tacview.net/documentation/acmi/en/
 * 
 * Coordinate system:
 *   T= field: longitude | latitude | altitude_metres [| roll | pitch | yaw ]
 *     - longitude: decimal degrees (+ east)
 *     - latitude:  decimal degrees (+ north)
 *     - altitude:  metres MSL
 *     - roll:      degrees, right-wing-down positive
 *     - pitch:     degrees, nose-up positive
 *     - yaw:       true heading 0–360
 * 
 * SimConnect to ACMI conversions:
 *   - altitude: feet → metres (* 0.3048)
 *   - pitch:    SimConnect positive = nose DOWN → negate for ACMI
 *   - bank:     SimConnect positive = left-wing DOWN → negate for ACMI (right positive)
 */

class ACMIWriter {
    constructor() {
        this._lines    = [];
        this._known    = new Set(); // object IDs written on first frame
        this._startMs  = null;
    }

    /**
     * Write the ACMI file header.
     * @param {string} title       Mission / session name
     * @param {Date}   [refDate]   Reference time (defaults to now)
     */
    initialize(title, refDate) {
        this._startMs = Date.now();
        const ref = (refDate instanceof Date ? refDate : new Date())
            .toISOString()
            .replace(/\.\d+Z$/, 'Z');

        this._lines = [
            'FileType=text/acmi/tacview',
            'FileVersion=2.2',
            `0,ReferenceTime=${ref}`,
            `0,RecordingTime=${ref}`,
            `0,Title=${_sanitize(title || '158th FW Mission Recording')}`,
            `0,Author=158th FW ACMI Recorder`,
            `0,Category=Multiplayer`,
        ];
    }

    /**
     * Append one time-stamped frame to the file.
     * 
     * @param {number}  elapsedSeconds  Seconds since recording started
     * @param {Map}     aircraft        objectId → AircraftState from simconnect-bridge
     * @param {Map}     [names]         objectId → { callsign, aircraftType } overrides
     */
    writeFrame(elapsedSeconds, aircraft, names) {
        if (!aircraft.size) return;

        this._lines.push(`#${elapsedSeconds.toFixed(2)}`);

        for (const [objectId, state] of aircraft) {
            const hexId  = objectId.toString(16).toUpperCase();
            const meta   = names?.get(objectId);
            const altM   = (state.alt_ft * 0.3048).toFixed(1);
            const roll   = (-state.bank).toFixed(2);    // invert: see header comment
            const pitch  = (-state.pitch).toFixed(2);   // invert: see header comment
            const yaw    = state.heading.toFixed(2);
            const T      = `${state.lon.toFixed(8)}|${state.lat.toFixed(8)}|${altM}|${roll}|${pitch}|${yaw}`;

            if (!this._known.has(objectId)) {
                // ── First appearance: write full static properties ──────────
                this._known.add(objectId);
                const name  = meta?.callsign     || state.name || `Aircraft-${hexId}`;
                const acType = meta?.aircraftType || 'Unknown';
                this._lines.push(
                    `${hexId},T=${T},` +
                    `Name=${_sanitize(acType)},` +
                    `Pilot=${_sanitize(name)},` +
                    `Type=Air+FixedWing,` +
                    `Color=Cyan,` +
                    `IAS=${state.ias.toFixed(1)},` +
                    `Throttle=0`
                );
            } else {
                // ── Subsequent frames: position + changing dynamics only ─────
                this._lines.push(
                    `${hexId},T=${T},IAS=${state.ias.toFixed(1)}`
                );
            }
        }
    }

    /**
     * Mark an aircraft as having left the recording.
     * @param {number} objectId
     */
    removeObject(objectId) {
        if (this._known.has(objectId)) {
            this._lines.push(`-${objectId.toString(16).toUpperCase()}`);
            this._known.delete(objectId);
        }
    }

    /**
     * Seconds elapsed since initialize() was called.
     */
    get elapsedSeconds() {
        if (!this._startMs) return 0;
        return (Date.now() - this._startMs) / 1000;
    }

    /**
     * Return the complete ACMI file content as a string.
     * Uses Unix line endings as required by the ACMI spec.
     */
    getContent() {
        return this._lines.join('\n') + '\n';
    }

    reset() {
        this._lines   = [];
        this._known   = new Set();
        this._startMs = null;
    }
}

// Remove characters that would break the ACMI text format
function _sanitize(str) {
    return String(str ?? '').replace(/[,\r\n]/g, ' ').trim();
}

module.exports = ACMIWriter;
