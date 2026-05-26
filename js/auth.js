// Supabase Auth Integration
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

const loginBtn = document.getElementById('loginBtn');
const loginModal = document.getElementById('loginModal');
const loginForm = document.getElementById('loginForm');
const loginEmailInput = document.getElementById('loginEmail');
const loginPasswordInput = document.getElementById('loginPassword');
const loginSubmitBtn = loginForm ? loginForm.querySelector('.login-submit-btn') : null;
const loginErrorEl = document.getElementById('loginError');

// Password reset elements
const loginSection = document.getElementById('loginSection');
const resetSection = document.getElementById('resetSection');
const forgotPasswordLink = document.getElementById('forgotPasswordLink');
const backToLoginLink = document.getElementById('backToLoginLink');
const resetSubmitBtn = document.getElementById('resetSubmitBtn');
const resetEmailInput = document.getElementById('resetEmail');
const modalTitle = document.getElementById('modalTitle');

// Open modal
if (loginBtn) {
    loginBtn.addEventListener('click', () => {
        loginModal.classList.add('active');
        document.body.style.overflow = 'hidden';
        if (loginEmailInput) loginEmailInput.focus();
    });
}

// Close modal — X button and overlay click
const modalClose = document.getElementById('modalClose');
if (modalClose) {
    modalClose.addEventListener('click', closeLoginModal);
}
if (loginModal) {
    loginModal.addEventListener('click', (e) => {
        if (e.target === loginModal) closeLoginModal();
    });
}
document.addEventListener('keydown', (e) => {
    if (loginModal && e.key === 'Escape' && loginModal.classList.contains('active')) {
        closeLoginModal();
    }
});

// Handle login form submit
if (loginForm) {
    loginForm.addEventListener('submit', async (e) => {
        e.preventDefault();

        const email = loginEmailInput.value.trim();
        const password = loginPasswordInput.value;

        if (!email || !password) return;

        setLoginLoading(true);
        clearLoginError();

        const { data, error } = await _supabase.auth.signInWithPassword({ email, password });

        if (error) {
            setLoginLoading(false);
            showLoginError(error.message);
            return;
        }

        // Check member approval status before allowing access
        const { data: memberRow } = await _supabase
            .from('members')
            .select('status')
            .eq('id', data.user.id)
            .maybeSingle();

        setLoginLoading(false);

        if (memberRow?.status === 'pending') {
            await _supabase.auth.signOut();
            showLoginError('Your account is pending admin review. You\'ll be able to log in once approved.');
            return;
        }

        if (memberRow?.status === 'denied') {
            await _supabase.auth.signOut();
            showLoginError('Your access request was not approved. Contact wing leadership for assistance.');
            return;
        }

        // Successful login — redirect to member area
        loginForm.reset();
        closeLoginModal();
        window.location.href = 'airfield-status.html';
    });
}

// Update header button to show logged-in state
async function updateAuthUI(user) {
    if (!loginBtn) return;
    if (user) {
        let callsign = user.user_metadata?.callsign;
        if (!callsign) {
            const { data: memberRow } = await _supabase
                .from('members')
                .select('callsign')
                .eq('id', user.id)
                .maybeSingle();
            callsign = memberRow?.callsign;
        }
        const label = callsign ? callsign.toUpperCase() : user.email.split('@')[0].toUpperCase();
        loginBtn.textContent = label;
        loginBtn.classList.add('logged-in');
        loginBtn.removeEventListener('click', openLoginModal);
        loginBtn.addEventListener('click', handleLogout);
    } else {
        loginBtn.textContent = 'LOGIN';
        loginBtn.classList.remove('logged-in');
        loginBtn.removeEventListener('click', handleLogout);
        loginBtn.addEventListener('click', openLoginModal);
    }
}

function openLoginModal() {
    loginModal.classList.add('active');
    document.body.style.overflow = 'hidden';
    if (loginEmailInput) loginEmailInput.focus();
}

async function handleLogout() {
    await _supabase.auth.signOut();
    updateAuthUI(null);
}

function setLoginLoading(isLoading) {
    if (!loginSubmitBtn) return;
    loginSubmitBtn.disabled = isLoading;
    loginSubmitBtn.textContent = isLoading ? 'AUTHENTICATING...' : 'LOGIN';
}

function showLoginError(message) {
    if (!loginErrorEl) return;
    loginErrorEl.textContent = message;
    loginErrorEl.style.display = 'block';
}

function clearLoginError() {
    if (!loginErrorEl) return;
    loginErrorEl.textContent = '';
    loginErrorEl.style.display = 'none';
}

function closeLoginModal() {
    if (loginModal) loginModal.classList.remove('active');
    document.body.style.overflow = '';
    clearLoginError();
    // Reset back to login view
    if (loginSection) loginSection.style.display = '';
    if (resetSection) resetSection.style.display = 'none';
    if (modalTitle) modalTitle.textContent = 'MEMBER LOGIN';
    if (loginErrorEl) loginErrorEl.style.color = '';
}

// Forgot password — switch to reset view
if (forgotPasswordLink) {
    forgotPasswordLink.addEventListener('click', (e) => {
        e.preventDefault();
        if (loginSection) loginSection.style.display = 'none';
        if (resetSection) resetSection.style.display = 'block';
        if (modalTitle) modalTitle.textContent = 'RESET PASSWORD';
        clearLoginError();
        if (resetEmailInput) {
            resetEmailInput.value = loginEmailInput ? loginEmailInput.value : '';
            resetEmailInput.focus();
        }
    });
}

// Back to login — switch back
if (backToLoginLink) {
    backToLoginLink.addEventListener('click', (e) => {
        e.preventDefault();
        if (resetSection) resetSection.style.display = 'none';
        if (loginSection) loginSection.style.display = '';
        if (modalTitle) modalTitle.textContent = 'MEMBER LOGIN';
        clearLoginError();
        if (loginErrorEl) loginErrorEl.style.color = '';
    });
}

// Send password reset email
if (resetSubmitBtn) {
    resetSubmitBtn.addEventListener('click', async () => {
        const email = resetEmailInput ? resetEmailInput.value.trim() : '';
        if (!email) {
            showLoginError('Please enter your email address.');
            return;
        }
        resetSubmitBtn.disabled = true;
        resetSubmitBtn.textContent = 'SENDING...';
        clearLoginError();

        const { error } = await _supabase.auth.resetPasswordForEmail(email, {
            redirectTo: 'https://virtual158th.com/reset-password.html'
        });

        resetSubmitBtn.disabled = false;
        resetSubmitBtn.textContent = 'SEND RESET LINK';

        if (error) {
            showLoginError(error.message);
        } else {
            if (loginErrorEl) {
                loginErrorEl.textContent = 'Check your email for a password reset link.';
                loginErrorEl.style.display = 'block';
                loginErrorEl.style.color = '#6dbf67';
            }
        }
    });
}

// Restore session on page load
_supabase.auth.getSession().then(({ data: { session } }) => {
    if (session) updateAuthUI(session.user);
});

// Listen for auth state changes across tabs
_supabase.auth.onAuthStateChange((_event, session) => {
    updateAuthUI(session ? session.user : null);
});
