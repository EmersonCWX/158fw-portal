// Mobile Menu Toggle
const hamburger = document.querySelector('.hamburger');
const navMenu = document.querySelector('.nav-menu');

if (hamburger) {
    hamburger.addEventListener('click', () => {
        navMenu.style.display = navMenu.style.display === 'flex' ? 'none' : 'flex';
        navMenu.style.flexDirection = 'column';
        navMenu.style.position = 'absolute';
        navMenu.style.top = '100%';
        navMenu.style.left = '0';
        navMenu.style.right = '0';
        navMenu.style.backgroundColor = 'var(--dark-blue)';
        navMenu.style.padding = '1rem';
        navMenu.style.borderBottom = '3px solid var(--bright-orange)';
    });
}

// Close menu when a link is clicked
const navLinks = document.querySelectorAll('.nav-link');
navLinks.forEach(link => {
    link.addEventListener('click', () => {
        if (navMenu && window.innerWidth <= 768) {
            navMenu.style.display = 'none';
        }
    });
});

// Header Navigation System
const headerLinks = document.querySelectorAll('.header-link');
const pageSections = document.querySelectorAll('.page-section');
const homeSection = document.querySelector('#home');

headerLinks.forEach(link => {
    link.addEventListener('click', (e) => {
        const href = link.getAttribute('href');
        const pageId = href.substring(1);
        showPage(pageId);
        window.location.hash = pageId;
    });
});

function showPage(pageId) {
    // Hide all page sections
    if (homeSection) homeSection.style.display = 'none';
    pageSections.forEach(section => {
        section.style.display = 'none';
        section.classList.remove('active');
    });
    
    // Show the selected page
    const selectedPage = document.querySelector('#' + pageId);
    if (selectedPage) {
        selectedPage.style.display = 'block';
        selectedPage.classList.add('active');
        selectedPage.scrollIntoView();
    } else if (pageId === 'home') {
        if (homeSection) {
            homeSection.style.display = 'block';
            homeSection.scrollIntoView();
        }
    }
}

// Initialize page on load
window.addEventListener('load', () => {
    const pageId = window.location.hash ? window.location.hash.substring(1) : 'home';
    showPage(pageId);
});

// Contact Form Handling
const contactForm = document.querySelector('.contact-form');
if (contactForm) {
    contactForm.addEventListener('submit', (e) => {
        e.preventDefault();
        
        const name = contactForm.querySelector('input[type="text"]').value;
        const email = contactForm.querySelector('input[type="email"]').value;
        const message = contactForm.querySelector('textarea').value;
        
        // Simple validation
        if (name && email && message) {
            // In a real application, this would send to a server
            alert(`Thank you, ${name}! Your message has been received. We will contact you at ${email} soon.`);
            contactForm.reset();
        } else {
            alert('Please fill out all fields.');
        }
    });
}

// Smooth scroll enhancement (for non-nav links)
document.querySelectorAll('a[href^="#"]').forEach(anchor => {
    // Skip if it's a nav link (already handled by page navigation)
    if (!anchor.classList.contains('nav-link')) {
        anchor.addEventListener('click', function (e) {
            const href = this.getAttribute('href');
            if (href !== '#') {
                e.preventDefault();
                const target = document.querySelector(href);
                if (target) {
                    target.scrollIntoView({
                        behavior: 'smooth',
                        block: 'start'
                    });
                }
            }
        });
    }
});

// Animation on scroll
const observerOptions = {
    threshold: 0.1,
    rootMargin: '0px 0px -100px 0px'
};

const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
        if (entry.isIntersecting) {
            entry.target.style.opacity = '1';
            entry.target.style.transform = 'translateY(0)';
        }
    });
}, observerOptions);

// Observe all sections for fade-in effect
document.querySelectorAll('section').forEach(section => {
    section.style.opacity = '0';
    section.style.transform = 'translateY(20px)';
    section.style.transition = 'opacity 0.6s ease, transform 0.6s ease';
    observer.observe(section);
});

// News page image carousel
const newsSlides = document.querySelectorAll('.news-slide');
const newsDots = document.querySelectorAll('.news-dot');
const newsPrevButton = document.querySelector('.news-nav-prev');
const newsNextButton = document.querySelector('.news-nav-next');
const newsBioTitle = document.getElementById('newsBioTitle');
const newsBioText = document.getElementById('newsBioText');
const NEWS_SLIDE_KEY = 'currentNewsSlide';
const newsBioContent = [
    {
        title: 'Night Flying at the 158th Fighter Wing',
        text: 'U.S. Air National Guard Airmen assigned to the 158th Fighter Wing conduct night flying operations with the F-35A Lightning II in South Burlington, VT, January 9, 2026. These airmen are required to conduct nighttime operations in order to maintain mission readiness.'
    },
    {
        title: 'Night Flying at the 158th Fighter Wing',
        text: 'U.S. Air National Guard Airmen assigned to the 158th Fighter Wing conduct night flying operations with the F-35A Lightning II in South Burlington, VT, January 9, 2026. These airmen are required to conduct nighttime operations in order to maintain mission readiness.'
    }
];
let currentNewsSlide = 0;

function setCurrentNewsSlide(index) {
    localStorage.setItem(NEWS_SLIDE_KEY, String(index));
}

function getCurrentNewsSlide() {
    const savedIndex = Number.parseInt(localStorage.getItem(NEWS_SLIDE_KEY), 10);
    if (Number.isNaN(savedIndex) || savedIndex < 0 || savedIndex >= newsSlides.length) {
        return 0;
    }
    return savedIndex;
}

function showNewsSlide(index) {
    if (!newsSlides.length) return;

    currentNewsSlide = (index + newsSlides.length) % newsSlides.length;

    newsSlides.forEach((slide, slideIndex) => {
        slide.classList.toggle('active', slideIndex === currentNewsSlide);
    });

    newsDots.forEach((dot, dotIndex) => {
        dot.classList.toggle('active', dotIndex === currentNewsSlide);
    });

    const activeBio = newsBioContent[currentNewsSlide];
    if (activeBio && newsBioTitle && newsBioText) {
        newsBioTitle.textContent = activeBio.title;
        newsBioText.textContent = activeBio.text;
    }

    setCurrentNewsSlide(currentNewsSlide);
}

if (newsPrevButton) {
    newsPrevButton.addEventListener('click', () => {
        showNewsSlide(currentNewsSlide - 1);
    });
}

if (newsNextButton) {
    newsNextButton.addEventListener('click', () => {
        showNewsSlide(currentNewsSlide + 1);
    });
}

newsDots.forEach((dot, index) => {
    dot.addEventListener('click', () => {
        showNewsSlide(index);
    });
});

showNewsSlide(getCurrentNewsSlide());

// Persistent Login - Helper Functions
function setLoginState(email, callsign) {
    localStorage.setItem('isLoggedIn', 'true');
    localStorage.setItem('userEmail', email);
    localStorage.setItem('userCallsign', callsign);
}

function getLoginState() {
    return {
        isLoggedIn: localStorage.getItem('isLoggedIn') === 'true',
        email: localStorage.getItem('userEmail'),
        callsign: localStorage.getItem('userCallsign')
    };
}

function clearLoginState() {
    localStorage.removeItem('isLoggedIn');
    localStorage.removeItem('userEmail');
    localStorage.removeItem('userCallsign');
}

// Restore login state on page load
function restoreLoginState() {
    const state = getLoginState();
    if (state.isLoggedIn && state.callsign) {
        const operationsMenu = document.getElementById('operationsMenu');
        const loginNavItem = document.getElementById('loginNavItem');
        const userMenuNavItem = document.getElementById('userMenuNavItem');
        const userName = document.getElementById('userName');
        const navClock = document.getElementById('navClock');
        
        if (operationsMenu) operationsMenu.style.display = 'block';
        if (loginNavItem) loginNavItem.style.display = 'none';
        if (userMenuNavItem) userMenuNavItem.style.display = 'block';
        if (userName) userName.textContent = state.callsign;
        if (navClock) {
            navClock.style.display = '';
            startNavClock();
        }
    }
}

// Nav Clock - Local + UTC
function startNavClock() {
    function pad(n) { return n.toString().padStart(2, '0'); }
    function updateClock() {
        const now = new Date();
        const lH = pad(now.getHours());
        const lM = pad(now.getMinutes());
        const lS = pad(now.getSeconds());
        const uH = pad(now.getUTCHours());
        const uM = pad(now.getUTCMinutes());
        const uS = pad(now.getUTCSeconds());
        const localEl = document.getElementById('localTime');
        const utcEl = document.getElementById('utcTime');
        if (localEl) localEl.textContent = `${lH}:${lM}:${lS}`;
        if (utcEl) utcEl.textContent = `${uH}:${uM}:${uS}`;
        // Detect timezone abbreviation
        const tzAbbrEl = document.getElementById('tzAbbr');
        if (tzAbbrEl) {
            const tz = Intl.DateTimeFormat('en-US', { timeZoneName: 'short' })
                .formatToParts(now).find(p => p.type === 'timeZoneName');
            if (tz) tzAbbrEl.textContent = tz.value;
        }
    }
    updateClock();
    setInterval(updateClock, 1000);
}

// Call restore on page load
window.addEventListener('DOMContentLoaded', restoreLoginState);
window.addEventListener('load', () => {
    window.scrollTo(0, 0);
});
// Also call immediately in case DOM is already loaded
restoreLoginState();

// Login Modal Handling — modal is managed by auth.js
// Use auth.js openLoginModal/closeLoginModal functions
const signupModal = document.getElementById('signupModal');
const closeBtn = document.querySelector('.login-modal-close');
const signupCloseBtn = document.querySelector('.signup-modal-close');
const signupLinks = document.querySelectorAll('.signup-link');

// User Credentials Database
// Add users from Excel file here
const users = [
    {
        email: 'theemwx@gmail.com',
        password: 'SabreV158!',
        callsign: 'Sabre'
    },
    {
        email: 'emerson@virtual158th.com',
        password: 'Sabre158!',
        callsign: 'Sabre'
    },
    {
        email: 'marceline@virtual158th.com',
        password: 'Smore158!',
        callsign: 'Smore'
    }
    // Add more users here as they're provided from the Excel file
];

// Handle Sign In button
const signInBtn = document.querySelector('.btn-signin');
if (signInBtn) {
    signInBtn.addEventListener('click', (e) => {
        e.preventDefault();
        
        // Get login inputs
        const emailInput = document.querySelector('.login-input[type="email"]');
        const passwordInput = document.querySelector('.login-input[type="password"]');
        
        const email = emailInput ? emailInput.value : '';
        const password = passwordInput ? passwordInput.value : '';
        
        // Simple validation
        if (!email || !password) {
            alert('Please enter both email and password.');
            return;
        }
        
        // Check credentials against users database
        const user = users.find(u => u.email === email && u.password === password);
        
        if (user) {
            // Successful login
            alert('Welcome back, ' + user.callsign + '!');
            
            // Save login state to localStorage
            setLoginState(user.email, user.callsign);
            
            // Hide login modal
            closeLoginModal();
            
            // Show Operations menu and user menu
            const operationsMenu = document.getElementById('operationsMenu');
            const loginNavItem = document.getElementById('loginNavItem');
            const userMenuNavItem = document.getElementById('userMenuNavItem');
            const userName = document.getElementById('userName');
            
            if (operationsMenu) operationsMenu.style.display = 'block';
            if (loginNavItem) loginNavItem.style.display = 'none';
            if (userMenuNavItem) userMenuNavItem.style.display = 'block';
            if (userName) userName.textContent = user.callsign;
            
            // Clear inputs
            if (emailInput) emailInput.value = '';
            if (passwordInput) passwordInput.value = '';
        } else {
            // Invalid credentials
            alert('Invalid email or password. Please try again.');
        }
    });
}

// Handle Logout button
const logoutBtn = document.getElementById('logoutBtn');
if (logoutBtn) {
    logoutBtn.addEventListener('click', (e) => {
        e.preventDefault();
        
        // Clear login state from localStorage
        clearLoginState();
        
        // Hide Operations menu and user menu
        const operationsMenu = document.getElementById('operationsMenu');
        const loginNavItem = document.getElementById('loginNavItem');
        const userMenuNavItem = document.getElementById('userMenuNavItem');
        
        if (operationsMenu) operationsMenu.style.display = 'none';
        if (loginNavItem) loginNavItem.style.display = 'block';
        if (userMenuNavItem) userMenuNavItem.style.display = 'none';
        
        alert('You have been logged out.');
    });
}

// Handle Operations dropdown toggle
const dropdownItems = document.querySelectorAll('.dropdown-item');
dropdownItems.forEach(item => {
    const toggle = item.querySelector('.dropdown-toggle');
    if (toggle) {
        toggle.addEventListener('click', (e) => {
            e.preventDefault();
            
            // Close other dropdowns
            dropdownItems.forEach(otherItem => {
                if (otherItem !== item) {
                    otherItem.classList.remove('dropdown-open');
                }
            });
            
            // Toggle current dropdown
            item.classList.toggle('dropdown-open');
        });
    }
    
    // Close dropdown when a link is clicked
    const links = item.querySelectorAll('.dropdown-link');
    links.forEach(link => {
        link.addEventListener('click', () => {
            item.classList.remove('dropdown-open');
        });
    });
});

// Close dropdown when clicking outside
document.addEventListener('click', (e) => {
    dropdownItems.forEach(item => {
        if (!item.contains(e.target)) {
            item.classList.remove('dropdown-open');
        }
    });
});

// Signup modal handling
signupLinks.forEach(link => {
    link.addEventListener('click', (e) => {
        e.preventDefault();
        // Close login modal if open
        closeLoginModal();
        // Open signup modal
        if (signupModal) {
            signupModal.classList.add('show');
        }
    });
});

if (signupCloseBtn) {
    signupCloseBtn.addEventListener('click', () => {
        signupModal.classList.remove('show');
    });
}

// Close modal when clicking outside of it
// loginModal click-outside is handled by auth.js

if (signupModal) {
    signupModal.addEventListener('click', (e) => {
        if (e.target === signupModal) {
            signupModal.classList.remove('show');
        }
    });
    
    // Close modal on Escape key
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            if (signupModal.classList.contains('show')) {
                signupModal.classList.remove('show');
            }
            if (loginModal && loginModal.classList.contains('active')) {
                closeLoginModal();
            }
        }
    });
}

// Signup form handling
const signupForm = document.querySelector('.signup-modal-form');
if (signupForm) {
    const signupBtn = document.querySelector('.btn-signup');
    
    signupBtn.addEventListener('click', (e) => {
        e.preventDefault();
        
        const callsign = document.getElementById('callsign').value;
        const email = document.getElementById('email').value;
        const password = document.getElementById('password').value;
        const confirmPassword = document.getElementById('confirm-password').value;
        const discord = document.getElementById('discord').value;
        const notes = document.getElementById('notes').value;
        
        // Validation
        if (!callsign || !email || !password || !confirmPassword) {
            alert('Please fill out all required fields.');
            return;
        }
        
        if (password !== confirmPassword) {
            alert('Passwords do not match.');
            return;
        }
        
        if (password.length < 6) {
            alert('Password must be at least 6 characters.');
            return;
        }
        
        // In a real application, this would send to a server
        alert(`Account created! Welcome ${callsign}!\n\nYour access request has been submitted. You will be notified once approved.`);
        
        // Reset form and close modal
        document.getElementById('callsign').value = '';
        document.getElementById('email').value = '';
        document.getElementById('password').value = '';
        document.getElementById('confirm-password').value = '';
        document.getElementById('discord').value = '';
        document.getElementById('notes').value = '';
        
        signupModal.classList.remove('show');
    });
}

