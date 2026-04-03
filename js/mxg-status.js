// ── v158th MXG Tail Status — shared module ──────────────────────────────────
// Edit PHASE_CYCLE_PAUSED / PHASE_PINNED_TAILS here to control phase status
// across ALL pages (airfield-status.html, post-mission.html, etc.)

window.MxgStatus = (function () {

    const TAILS = [
        { id: '17-5265', wing: true },
        { id: '17-5266' }, { id: '17-5277' }, { id: '17-5278' }, { id: '17-5279' },
        { id: '17-5280' }, { id: '17-5284' },
        { id: '18-5336' }, { id: '18-5337' }, { id: '18-5338' }, { id: '18-5339' },
        { id: '18-5340' }, { id: '18-5341' }, { id: '18-5343' }, { id: '18-5344' },
        { id: '18-5349' }, { id: '18-5358' }, { id: '18-5359' }, { id: '18-5360' },
        { id: '18-5361' }
    ];

    // Set to true to pause the 12-day phase cycle and use PHASE_PINNED_TAILS below.
    // Set to false to resume normal rotation.
    const PHASE_CYCLE_PAUSED = false;
    const PHASE_PINNED_TAILS = [];

    // Xorshift32 seeded PRNG
    function mkRng(seed) {
        let s = (seed ^ 0xDEADBEEF) >>> 0 || 1;
        return function () {
            s ^= s << 13; s ^= s >> 17; s ^= s << 5;
            s = s >>> 0;
            return s / 4294967296;
        };
    }

    // Seeded Fisher-Yates shuffle (returns new array)
    function shuffle(arr, rng) {
        const a = arr.slice();
        for (let i = a.length - 1; i > 0; i--) {
            const j = Math.floor(rng() * (i + 1));
            const tmp = a[i]; a[i] = a[j]; a[j] = tmp;
        }
        return a;
    }

    // Days since 2025-01-01 (local date)
    function dayIndex() {
        const now = new Date();
        const local = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        return Math.floor((local - new Date(2025, 0, 1)) / 86400000);
    }

    function computeStatus() {
        const day = dayIndex();

        let phaseTails;
        if (PHASE_CYCLE_PAUSED) {
            phaseTails = new Set(PHASE_PINNED_TAILS);
        } else {
            const phaseCycle = Math.floor(day / 12);
            const phRng = mkRng(phaseCycle * 7919 + 42);
            const phaseCount = phRng() < 0.45 ? 1 : 2;
            const phasePool = shuffle(TAILS.filter(t => !t.wing).map(t => t.id), phRng);
            phaseTails = new Set(phasePool.slice(0, phaseCount));
        }

        const dayRng = mkRng(day * 2053 + 137);
        const activeCount = 12 + Math.floor(dayRng() * 5); // 12–16
        const nonSpecial = TAILS.filter(t => !t.wing && !phaseTails.has(t.id)).map(t => t.id);
        const poolShuffled = shuffle(nonSpecial, mkRng(day * 1777 + 55));
        const needed = Math.max(0, activeCount - 1);
        const fromPool = poolShuffled.slice(0, needed);
        const activeTails = new Set(['17-5265', ...fromPool]);

        const mxRng = mkRng(day * 3571 + 99);
        const maintCount = mxRng() < 0.5 ? 1 : 2;
        const maintCandidates = shuffle(fromPool.slice(), mxRng);
        const maintTails = new Set(maintCandidates.slice(0, maintCount));

        const map = {};
        for (const t of TAILS) {
            if (phaseTails.has(t.id))        map[t.id] = 'phase';
            else if (!activeTails.has(t.id)) map[t.id] = 'inactive';
            else if (maintTails.has(t.id))   map[t.id] = 'maint';
            else                             map[t.id] = 'ready';
        }
        return map;
    }

    return { TAILS, PHASE_CYCLE_PAUSED, PHASE_PINNED_TAILS, mkRng, shuffle, dayIndex, computeStatus };
})();
