// Who is logged in. The token and the user are kept in the browser (localStorage).
// The pages use this file to ask "is somebody logged in?" and "which role?".

const Auth = {
    // ---------- saved login ----------
    getToken() {
        try { return localStorage.getItem('mf_token'); } catch (error) { return null; }
    },

    getUser() {
        try { return JSON.parse(localStorage.getItem('mf_user')); } catch (error) { return null; }
    },

    isLoggedIn() {
        return Auth.getToken() !== null && Auth.getUser() !== null;
    },

    save(token, user) {
        localStorage.setItem('mf_token', token);
        localStorage.setItem('mf_user', JSON.stringify(user));
    },

    // Removes the login and goes to the login page.
    // With the reason "expired" the login page shows a message and sends the user back after login.
    logout(reason) {
        try {
            localStorage.removeItem('mf_token');
            localStorage.removeItem('mf_user');
        } catch (error) { /* nothing to remove */ }

        let address = SITE_ROOT + 'pages/login.html';
        if (reason === 'expired') address += '?expired=1&next=' + encodeURIComponent(location.href);
        location.href = address;
    },

    // ---------- where each role starts ----------
    homeFor(role) {
        if (role === 'manager') return SITE_ROOT + 'pages/manager/dashboard.html';
        if (role === 'admin') return SITE_ROOT + 'pages/admin/dashboard.html';
        return SITE_ROOT + 'pages/browse.html';
    },

    // Where to go right after login: the page the user wanted, or the home of his role.
    // The "next" address must belong to this website (nobody can send a user to another site).
    goAfterLogin(user) {
        const next = new URLSearchParams(location.search).get('next');
        if (next && next.startsWith(SITE_ROOT)) {
            location.href = next;
        } else {
            location.href = Auth.homeFor(user.role);
        }
    },

    // ---------- page guard ----------
    // Call at the top of a page that needs a login. roles is the list of allowed roles (all, if left out).
    // A visitor goes to the login page and comes back later, a user with a wrong role goes to his own home.
    // Returns the user when the page may open.
    requireLogin(roles) {
        const user = Auth.getUser();
        if (!Auth.isLoggedIn()) {
            location.href = SITE_ROOT + 'pages/login.html?next=' + encodeURIComponent(location.href);
            return null;
        }
        if (roles && !roles.includes(user.role)) {
            location.href = Auth.homeFor(user.role);
            return null;
        }
        return user;
    },
};
