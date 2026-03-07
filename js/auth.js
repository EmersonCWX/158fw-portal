// Supabase Auth Integration
const SUPABASE_URL = 'https://gcumgpfyfqtfwbskkngt.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdjdW1ncGZ5ZnF0Zndic2trbmd0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzI4MDczMTAsImV4cCI6MjA4ODM4MzMxMH0.OSY0XEPQp-WsFWuiGrUG5fcLIVMI3c8AxBEv2shFftg';

const _supabase = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

const loginBtn = document.getElementById('loginBtn');
const loginModal = document.getElementById('loginModal');
const loginForm = document.getElementById('loginForm');
const loginEmailInput = document.getElementById('loginEmail');
const loginPasswordInput = document.getElementById('loginPassword');
const loginSubmitBtn = loginForm ? loginForm.querySelector('.login-submit-btn') : null;
const loginErrorEl = document.getElementById('loginError');

// Open modal
if (loginBtn) {
    loginBtn.addEventListener('click', () => {
        loginModal.classList.add('active');
        document.body.style.overflow = 'hidden';
        if (loginEmailInput) loginEmailInput.focus();
    });
}

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

        setLoginLoading(false);

        if (error) {
            showLoginError(error.message);
            return;
        }

        // Successful login — redirect to member area
        loginForm.reset();
        closeLoginModal();
        window.location.href = 'airfield-status.html';
    });
}

// Update header button to show logged-in state
function updateAuthUI(user) {
    if (!loginBtn) return;
    if (user) {
        const label = user.user_metadata?.callsign || user.email.split('@')[0].toUpperCase();
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
}

// Restore session on page load
_supabase.auth.getSession().then(({ data: { session } }) => {
    if (session) updateAuthUI(session.user);
});

// Listen for auth state changes across tabs
_supabase.auth.onAuthStateChange((_event, session) => {
    updateAuthUI(session ? session.user : null);
});
