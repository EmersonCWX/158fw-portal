// Member Navigation — Auth guard + injected header for all protected pages
(function () {
    const SUPABASE_URL = 'https://gcumgpfyfqtfwbskkngt.supabase.co';
    const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdjdW1ncGZ5ZnF0Zndic2trbmd0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzI4MDczMTAsImV4cCI6MjA4ODM4MzMxMH0.OSY0XEPQp-WsFWuiGrUG5fcLIVMI3c8AxBEv2shFftg';

    const _supabase = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
        auth: {
            persistSession: true,
            autoRefreshToken: true,
            detectSessionInUrl: true,
            storageKey: 'v158fw-auth'
        }
    });

    // ── CSS ──────────────────────────────────────────────────────────────────
    const css = `
        .member-header {
            background: #2c3035;
            height: 60px;
            position: fixed;
            top: 0; left: 0; right: 0;
            z-index: 9999;
            display: flex;
            align-items: center;
            padding: 0 1.5rem;
            box-shadow: 0 2px 12px rgba(0,0,0,0.6);
            border-bottom: 1px solid #3a3f45;
            box-sizing: border-box;
        }
        .member-header-inner {
            display: flex;
            align-items: center;
            justify-content: space-between;
            width: 100%;
        }
        .member-header-left {
            display: flex;
            align-items: center;
            gap: 10px;
            text-decoration: none;
        }
        .member-header-logo {
            height: 32px;
            width: 32px;
            object-fit: contain;
        }
        .member-header-title {
            color: #F5E6D3;
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
            font-size: 0.9rem;
            font-weight: 700;
            letter-spacing: 1px;
            text-transform: uppercase;
            font-style: italic;
        }
        .member-nav {
            display: flex;
            align-items: center;
            gap: 0.25rem;
        }
        .member-nav-item {
            position: relative;
        }
        .member-nav-link {
            color: #F5E6D3;
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
            font-size: 0.82rem;
            font-weight: 600;
            letter-spacing: 1.2px;
            text-transform: uppercase;
            text-decoration: none;
            background: transparent;
            border: none;
            cursor: pointer;
            padding: 6px 14px;
            display: block;
            white-space: nowrap;
            transition: color 0.2s, background 0.2s;
            border-radius: 2px;
        }
        .member-nav-link:hover,
        .member-nav-link.active-page {
            color: var #1a1a1a;
            background: rgba(160,170,180,0.07);
        }
        .member-nav-link .member-caret {
            font-size: 0.82rem;
            margin-left: 4px;
            vertical-align: middle;
            line-height: 1;
            display: inline-block;
            position: relative;
            top: 1px;
        }
        /* Dropdown */
        .member-dropdown-menu {
            display: none;
            position: absolute;
            top: calc(100% + 4px);
            right: 0;
            min-width: 180px;
            background: #1f2226;
            border: 1px solid #3a3f45;
            box-shadow: 0 8px 24px rgba(0,0,0,0.7);
            list-style: none;
            margin: 0;
            padding: 4px 0;
            z-index: 10000;
        }
        .member-nav-item.open > .member-dropdown-menu {
            display: block;
        }
        .member-dropdown-menu li a {
            display: block;
            padding: 9px 18px;
            color: #ccc;
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
            font-size: 0.8rem;
            font-weight: 500;
            letter-spacing: 0.8px;
            text-transform: uppercase;
            text-decoration: none;
            transition: background 0.15s, color 0.15s;
        }
        .member-dropdown-menu li a:hover {
            background: rgba(160,170,180,0.1);
            color: #a0aab4;
        }
        .member-dropdown-divider {
            height: 1px;
            background: #3a3f45;
            margin: 4px 0;
        }
        .member-user-badge {
            color: #ccc
            font-size: 0.78rem;
            font-weight: 700;
            letter-spacing: 1px;
        }
        /* Push page content below fixed header */
        body.member-page {
            padding-top: 60px !important;
        }
        /* Remove the public-header margin offset on pages that use it (e.g. roster) */
        body.member-page .roster-page {
            margin-top: 0 !important;
            height: calc(100vh - 60px) !important;
        }
        /* Clocks */
        .member-header-clocks {
            display: flex;
            gap: 20px;
            align-items: center;
            position: absolute;
            left: 50%;
            transform: translateX(-50%);
        }
        .member-header-clock-item {
            display: flex;
            flex-direction: column;
            align-items: center;
            line-height: 1.2;
        }
        .member-header-clock-label {
            font-size: 0.58rem;
            color: #888;
            letter-spacing: 1.2px;
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
            font-weight: 700;
            text-transform: uppercase;
        }
        .member-header-clock-time {
            font-family: 'Courier New', Courier, monospace;
            font-size: 0.88rem;
            color: #e85a4a;
            font-weight: 700;
            letter-spacing: 1.5px;
        }
        /* ── Member-nav hamburger button ── */
        .member-hamburger {
            display: none;
            background: transparent;
            border: none;
            cursor: pointer;
            padding: 6px;
            flex-direction: column;
            gap: 5px;
            flex-shrink: 0;
            align-self: center;
        }
        .member-hamburger span {
            display: block;
            width: 24px;
            height: 3px;
            background: #F5E6D3;
            border-radius: 2px;
        }
        /* ── Mobile breakpoint ── */
        @media (max-width: 768px) {
            .member-header { padding: 0 1rem; }
            .member-header-title { display: none; }
            .member-header-clocks {
                position: static;
                transform: none;
                gap: 10px;
                flex: 1;
                justify-content: center;
            }
            .member-header-clock-time { font-size: 0.78rem; }
            .member-header-clock-label { font-size: 0.5rem; }
            .member-hamburger { display: flex; }
            .member-nav {
                display: none;
                flex-direction: column;
                position: fixed;
                top: 60px;
                left: 0;
                right: 0;
                background: #1f2226;
                border-top: 1px solid #3a3f45;
                padding: 0.5rem 0;
                z-index: 9998;
                box-shadow: 0 4px 16px rgba(0,0,0,0.7);
                max-height: calc(100vh - 60px);
                overflow-y: auto;
            }
            .member-nav.mobile-open { display: flex; }
            .member-nav-item { width: 100%; }
            .member-nav-link {
                padding: 0.85rem 1.5rem;
                font-size: 0.85rem;
                border-radius: 0;
                width: 100%;
                text-align: left;
                border-bottom: 1px solid rgba(255,255,255,0.06);
            }
            .member-dropdown-menu {
                position: static !important;
                box-shadow: none;
                background: #161a1e;
                border: none;
                border-top: 1px solid #2a2f35;
                min-width: unset;
                width: 100%;
            }
            .member-dropdown-menu li a { padding: 0.8rem 2.5rem; }
            /* Common member-page multi-column layouts → single column */
            .page-content {
                grid-template-columns: 1fr !important;
            }
            .pg-sidebar {
                position: static !important;
                top: auto !important;
            }
            .grid {
                grid-template-columns: 1fr !important;
            }
        }
    `;

    // ── HTML ─────────────────────────────────────────────────────────────────
    const headerHTML = `
        <header class="member-header" id="memberHeader">
            <div class="member-header-inner">
                <a href="airfield-status.html" class="member-header-left">
                    <img src="assets/vang-logo.png.png" alt="VANG Logo" class="member-header-logo">
                    <span class="member-header-title">Virtual Vermont Air National Guard</span>
                </a>
                <div class="member-header-clocks">
                    <div class="member-header-clock-item">
                        <span class="member-header-clock-label">Local</span>
                        <span class="member-header-clock-time" id="memberNavLocalClock">--:--:--</span>
                    </div>
                    <div class="member-header-clock-item">
                        <span class="member-header-clock-label">Zulu</span>
                        <span class="member-header-clock-time" id="memberNavZuluClock">--:--:--</span>
                    </div>
                </div>
                <nav class="member-nav" id="memberNav">
                    <!-- Operations dropdown -->
                    <div class="member-nav-item" id="opsDropdownItem">
                        <button class="member-nav-link" id="opsDropdownBtn">
                            OPERATIONS
                        </button>
                        <ul class="member-dropdown-menu" id="opsDropdownMenu">
                            <li><a href="airfield-status.html">Airfield Status</a></li>
                            <li><a href="pre-mission.html">Pre-Mission</a></li>
                            <li><a href="post-mission.html">Post Mission</a></li>
                        </ul>
                    </div>
                    <!-- Roster -->
                    <a href="roster.html" class="member-nav-link">ROSTER</a>
                    <!-- Pilot resources dropdown -->
                    <div class="member-nav-item" id="pilotResourcesDropdownItem">
                        <button class="member-nav-link" id="pilotResourcesDropdownBtn">
                            PILOT RESOURCES
                        </button>
                        <ul class="member-dropdown-menu" id="pilotResourcesDropdownMenu">
                            <li><a href="flight-history.html">Flight History</a></li>
                            <li><a href="vsaferep.html">vSAFEREP</a></li>
                            <li><a href="training.html">v158th FW EPUBS</a></li>
                            <li><div class="member-dropdown-divider"></div></li>
                            <li><a href="admin.html" style="color:#e85a4a;">158th FW Leadership</a></li>
                        </ul>
                    </div>
                    <!-- User dropdown -->
                    <div class="member-nav-item" id="userDropdownItem">
                        <button class="member-nav-link" id="userDropdownBtn">
                            <span id="memberUserLabel" class="member-user-badge">USER</span>
                        </button>
                        <ul class="member-dropdown-menu" id="userDropdownMenu">
                            <li><a href="#" id="memberLogoutBtn">Logout</a></li>
                        </ul>
                    </div>
                </nav>
                <button class="member-hamburger" id="memberHamburger" aria-label="Open menu">
                    <span></span><span></span><span></span>
                </button>
            </div>
        </header>
    `;

    // ── Init on DOM ready ─────────────────────────────────────────────────────
    document.addEventListener('DOMContentLoaded', async () => {
        // Inject CSS
        const style = document.createElement('style');
        style.textContent = css;
        document.head.appendChild(style);

        // Auth guard
        const { data: { session } } = await _supabase.auth.getSession();
        if (!session) {
            // Public pages (e.g. roster.html) are viewable without login — don't redirect
            if (!window.MEMBER_NAV_PUBLIC_PAGE) {
                window.location.replace('index.html');
            }
            return;
        }

        // Inject header
        document.body.insertAdjacentHTML('afterbegin', headerHTML);
        document.body.classList.add('member-page');

        // On public pages the original public <header> is still in the DOM — hide it
        // so only the member nav is shown to logged-in users.
        if (window.MEMBER_NAV_PUBLIC_PAGE) {
            const publicHeader = document.querySelector('header.header');
            if (publicHeader) publicHeader.style.display = 'none';
        }

        // Clocks — NTP-synced via worldtimeapi.org
        const _kbtvFmt = new Intl.DateTimeFormat('en-US', {
            timeZone: 'America/New_York',
            hour: '2-digit', minute: '2-digit', second: '2-digit',
            hour12: false
        });
        let _clockOffset = 0; // ms difference: serverTime - Date.now()
        let _clockTick = null;

        function _startClockTick() {
            if (_clockTick) clearInterval(_clockTick);
            function tick() {
                const now = new Date(Date.now() + _clockOffset);
                const pad = n => String(n).padStart(2, '0');
                const localEl = document.getElementById('memberNavLocalClock');
                const zuluEl  = document.getElementById('memberNavZuluClock');
                if (localEl) localEl.textContent = _kbtvFmt.format(now).replace(/^24/, '00');
                if (zuluEl)  zuluEl.textContent  = `${pad(now.getUTCHours())}:${pad(now.getUTCMinutes())}:${pad(now.getUTCSeconds())}`;
            }
            tick();
            _clockTick = setInterval(tick, 1000);
        }

        function _syncClocks() {
            const localEl = document.getElementById('memberNavLocalClock');
            const zuluEl  = document.getElementById('memberNavZuluClock');
            if (localEl) localEl.textContent = 'Resyncing...';
            if (zuluEl)  zuluEl.textContent  = 'Resyncing...';
            if (_clockTick) { clearInterval(_clockTick); _clockTick = null; }

            const t0 = Date.now();
            fetch('https://worldtimeapi.org/api/timezone/Etc/UTC')
                .then(r => r.json())
                .then(data => {
                    const serverMs = new Date(data.utc_datetime).getTime();
                    const rtt = Date.now() - t0;
                    _clockOffset = serverMs + rtt / 2 - Date.now();
                    _startClockTick();
                })
                .catch(() => {
                    // Fall back to system time silently
                    _clockOffset = 0;
                    _startClockTick();
                });
        }

        _syncClocks();
        setInterval(_syncClocks, 5 * 60 * 1000); // resync every 5 minutes

        // Populate username
        const user = session.user;
        const label = (user.user_metadata && user.user_metadata.callsign)
            ? user.user_metadata.callsign.toUpperCase()
            : user.email.split('@')[0].toUpperCase();
        document.getElementById('memberUserLabel').textContent = label;

        // Highlight current page nav link
        const currentFile = window.location.pathname.split('/').pop() || 'airfield-status.html';
        document.querySelectorAll('.member-nav-link[href]').forEach(link => {
            if (link.getAttribute('href') === currentFile) link.classList.add('active-page');
        });

        // Dropdown toggles
        ['opsDropdownItem', 'pilotResourcesDropdownItem', 'userDropdownItem'].forEach(id => {
            const item = document.getElementById(id);
            const btn = item.querySelector('button');
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const isOpen = item.classList.contains('open');
                // Close all
                document.querySelectorAll('.member-nav-item.open').forEach(el => el.classList.remove('open'));
                if (!isOpen) item.classList.add('open');
            });
        });

        // Close dropdowns when clicking outside
        document.addEventListener('click', () => {
            document.querySelectorAll('.member-nav-item.open').forEach(el => el.classList.remove('open'));
            // Also close mobile menu
            const memberNav = document.getElementById('memberNav');
            if (memberNav) memberNav.classList.remove('mobile-open');
        });

        // Mobile hamburger toggle
        const memberHamburgerBtn = document.getElementById('memberHamburger');
        const memberNavEl = document.getElementById('memberNav');
        if (memberHamburgerBtn && memberNavEl) {
            memberHamburgerBtn.addEventListener('click', function (e) {
                e.stopPropagation();
                memberNavEl.classList.toggle('mobile-open');
            });
        }

        // Logout
        document.getElementById('memberLogoutBtn').addEventListener('click', async (e) => {
            e.preventDefault();
            await _supabase.auth.signOut();
            window.location.replace('index.html');
        });

        // Listen for session expiry
        _supabase.auth.onAuthStateChange((_event, session) => {
            if (!session && !window.MEMBER_NAV_PUBLIC_PAGE) window.location.replace('index.html');
        });
    });
}());
