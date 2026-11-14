// The frame around every page: the navbar of students and visitors (with the tab bar of phones),
// and the sidebar of managers and admins.
//
// A page only has to write its own content inside  <div id="page">  and call, at the end of its body:
//     Layout.start({ active: 'browse', title: 'Browse messes' });
// Layout.start builds the frame and moves the content into it. Extra options:
//     login: true            the page needs a login (a visitor is sent to the login page)
//     roles: ['manager']     only these roles may open the page

const Layout = {
    // ---------- menus ----------

    // The sidebar of the manager and the admin: key (for the active item), label, icon, page
    sidebarItems: {
        manager: [
            { key: 'dashboard', label: 'Dashboard', icon: 'fa-gauge', page: 'pages/manager/dashboard.html' },
            { key: 'mess-setup', label: 'Mess setup', icon: 'fa-building', page: 'pages/manager/mess-setup.html' },
            { key: 'members', label: 'Members', icon: 'fa-users', page: 'pages/manager/members.html' },
            { key: 'room-seats', label: 'Room-wise seats', icon: 'fa-bed', page: 'pages/manager/room-seats.html' },
            { key: 'posts', label: 'Posts', icon: 'fa-bullhorn', page: 'pages/manager/posts.html' },
            { key: 'interested', label: 'Interested students', icon: 'fa-heart', page: 'pages/manager/interested.html' },
            { key: 'visits', label: 'Visit requests', icon: 'fa-calendar-check', page: 'pages/manager/visits.html' },
            { key: 'reviews', label: 'Reviews', icon: 'fa-star', page: 'pages/manager/reviews.html' },
            { key: 'newsfeed', label: 'Newsfeed', icon: 'fa-newspaper', page: 'pages/newsfeed.html' },
            { key: 'chat', label: 'Chat', icon: 'fa-comments', page: 'pages/chat.html', badge: true },
            { key: 'complaints', label: 'Complaints', icon: 'fa-flag', page: 'pages/complaints.html' },
        ],
        admin: [
            { key: 'dashboard', label: 'Dashboard', icon: 'fa-gauge', page: 'pages/admin/dashboard.html' },
            { key: 'verification', label: 'Verification', icon: 'fa-user-check', page: 'pages/admin/verification.html' },
            { key: 'users', label: 'Users', icon: 'fa-users', page: 'pages/admin/users.html' },
            { key: 'complaints', label: 'Complaints', icon: 'fa-flag', page: 'pages/admin/complaints.html' },
            { key: 'moderation', label: 'Moderation', icon: 'fa-shield-halved', page: 'pages/admin/moderation.html' },
            { key: 'reports', label: 'Reports', icon: 'fa-chart-column', page: 'pages/admin/reports.html' },
        ],
    },

    // The links of the avatar menu (top right)
    avatarMenuItems(user) {
        const items = [{ label: 'Profile', icon: 'fa-user', page: 'pages/profile.html' }];
        if (user.role === 'student') {
            items.push(
                { label: 'My mess', icon: 'fa-house', page: 'pages/my-mess.html' },
                { label: 'My visits', icon: 'fa-calendar-check', page: 'pages/my-visits.html' },
                { label: 'Complaints', icon: 'fa-flag', page: 'pages/complaints.html' }
            );
        }
        return items;
    },

    // ---------- start ----------

    start({ active = '', title = '', roles, login = false } = {}) {
        // 1. the guard
        if (login || roles) {
            if (!Auth.requireLogin(roles)) return false;
        }

        const user = Auth.isLoggedIn() ? Auth.getUser() : null;
        if (title) document.title = title + ' | Mess Finder';

        // 2. build the frame that fits the role
        const page = document.getElementById('page');
        if (user && (user.role === 'manager' || user.role === 'admin')) {
            Layout.buildDashboardShell(page, user, active, title);
        } else {
            Layout.buildPublicShell(page, user, active);
        }

        // 3. the numbers on the bell and the chat (not important, so a failure is ignored)
        if (user) Layout.refreshBadges(user);
        return true;
    },

    // ---------- the shell of students and visitors ----------

    buildPublicShell(page, user, active) {
        const link = (key, label, path, badge) => {
            const isActive = key === active;
            const classes = isActive ? 'border-ochre text-white' : 'border-transparent text-white/70 hover:text-white';
            const dot = badge ? ' <span class="chat-badge hidden rounded-full bg-ochre px-1.5 text-xs font-semibold text-espresso"></span>' : '';
            return `<a href="${SITE_ROOT + path}" class="flex h-14 items-center border-b-2 px-3 text-sm font-medium ${classes}">${label}${dot}</a>`;
        };

        let links = link('browse', 'Browse', 'pages/browse.html') + link('newsfeed', 'Newsfeed', 'pages/newsfeed.html');
        if (user) links += link('interested', 'Interested', 'pages/interested.html') + link('chat', 'Chat', 'pages/chat.html', true);

        let right;
        if (user) {
            right = Layout.bellHtml() + Layout.avatarMenuHtml(user);
        } else {
            right = `
                <a href="${SITE_ROOT}pages/login.html" class="rounded-lg px-3 py-2 text-sm font-medium text-white/80 hover:text-white">Login</a>
                <a href="${SITE_ROOT}pages/register.html" class="hidden rounded-lg bg-white px-3 py-2 text-sm font-medium text-espresso hover:bg-ochre-soft sm:block">Register</a>`;
        }

        const header = document.createElement('header');
        header.className = 'sticky top-0 z-40 bg-espresso text-white';
        header.innerHTML = `
            <div class="mx-auto flex h-14 max-w-[88rem] items-center gap-4 px-4">
                <a href="${SITE_ROOT}index.html" class="flex items-center gap-2 text-lg font-semibold">
                    <i class="fa-solid fa-house-chimney-window text-ochre"></i> Mess Finder
                </a>
                <nav class="ml-4 hidden items-center md:flex">${links}</nav>
                <div class="ml-auto flex items-center gap-1">${right}</div>
            </div>`;

        // the content gets a container of the right width
        page.classList.add('mx-auto', 'w-full', 'max-w-[88rem]', 'flex-1', 'px-4', 'py-6');
        if (active === 'home') page.classList.remove('max-w-[88rem]', 'px-4', 'py-6');

        // a short page still pushes the footer to the bottom of the window
        document.body.classList.add('flex', 'min-h-screen', 'flex-col');

        const footer = document.createElement('footer');
        footer.className = 'border-t border-line bg-white py-6 text-center text-sm text-ink-soft';
        footer.innerHTML = '<i class="fa-solid fa-house-chimney-window mr-1 text-ochre"></i> Mess Finder, a university project. Find a mess, meet the manager, move in.';

        document.body.prepend(header);
        document.body.appendChild(footer);
        document.body.appendChild(Layout.tabBar(user, active));
        document.body.classList.add('has-tab-bar');
        Layout.activateMenus();
    },

    // The 5 tabs at the bottom of a phone
    tabBar(user, active) {
        const tab = (key, label, icon, path, badge) => {
            const isActive = key === active;
            const dot = badge ? '<span class="chat-badge absolute right-4 top-1 hidden rounded-full bg-ochre px-1.5 text-xs font-semibold text-espresso"></span>' : '';
            return `
                <a href="${SITE_ROOT + path}" class="relative flex flex-1 flex-col items-center justify-center gap-0.5 py-2 text-xs ${isActive ? 'font-semibold text-espresso' : 'text-ink-soft'}">
                    <i class="fa-solid ${icon} text-lg ${isActive ? 'text-ochre' : ''}"></i>${label}${dot}
                </a>`;
        };
        const chatPath = user ? 'pages/chat.html' : 'pages/login.html?next=' + encodeURIComponent(SITE_ROOT + 'pages/chat.html');
        const mePath = user ? 'pages/profile.html' : 'pages/login.html';

        const bar = document.createElement('nav');
        bar.className = 'fixed inset-x-0 bottom-0 z-40 flex border-t border-line bg-white md:hidden';
        bar.innerHTML =
            tab('home', 'Home', 'fa-house', 'index.html') +
            tab('browse', 'Browse', 'fa-magnifying-glass', 'pages/browse.html') +
            tab('newsfeed', 'Feed', 'fa-newspaper', 'pages/newsfeed.html') +
            tab('chat', 'Chat', 'fa-comments', chatPath, true) +
            tab('profile', 'Me', 'fa-user', mePath);
        return bar;
    },

    // ---------- the shell of managers and admins ----------

    buildDashboardShell(page, user, active, title) {
        const items = Layout.sidebarItems[user.role]
            .map((item) => {
                const isActive = item.key === active;
                const badge = item.badge ? ' <span class="chat-badge ml-auto hidden rounded-full bg-ochre px-1.5 text-xs font-semibold text-espresso"></span>' : '';
                return `
                    <a href="${SITE_ROOT + item.page}" class="flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium ${isActive ? 'bg-white/10 text-white' : 'text-white/75 hover:bg-white/10 hover:text-white'}">
                        <i class="fa-solid ${item.icon} w-5 text-center ${isActive ? 'text-ochre' : 'text-white/60'}"></i>${item.label}${badge}
                    </a>`;
            })
            .join('');

        const shell = document.createElement('div');
        shell.className = 'min-h-screen md:flex';
        shell.innerHTML = `
            <div id="drawer-backdrop" class="fixed inset-0 z-40 hidden bg-espresso/60 md:hidden"></div>
            <aside id="sidebar" class="fixed inset-y-0 left-0 z-50 flex w-64 -translate-x-full flex-col bg-espresso text-white transition-transform md:sticky md:top-0 md:h-screen md:shrink-0 md:translate-x-0">
                <a href="${Auth.homeFor(user.role)}" class="flex h-14 shrink-0 items-center gap-2 border-b border-white/10 px-4 text-lg font-semibold">
                    <i class="fa-solid fa-house-chimney-window text-ochre"></i> Mess Finder
                </a>
                <nav class="flex-1 space-y-1 overflow-y-auto p-3">${items}</nav>
                <p class="px-4 py-3 text-xs text-white/50">${user.role === 'admin' ? 'Admin panel' : 'Manager panel'}</p>
            </aside>
            <div class="flex min-w-0 flex-1 flex-col">
                <header class="sticky top-0 z-30 flex h-14 items-center gap-3 border-b border-line bg-white px-4">
                    <button type="button" id="open-drawer" class="h-10 w-10 rounded-lg text-lg hover:bg-page md:hidden" aria-label="Open menu"><i class="fa-solid fa-bars"></i></button>
                    <h1 class="truncate text-base font-semibold">${Ui.escape(title)}</h1>
                    <div class="ml-auto flex items-center gap-1 text-ink">${Layout.bellHtml(true)}${Layout.avatarMenuHtml(user, true)}</div>
                </header>
                <div id="content-slot" class="w-full flex-1 p-4 md:p-6"></div>
            </div>`;

        document.body.prepend(shell);
        shell.querySelector('#content-slot').appendChild(page);

        // the drawer of phones
        const sidebar = shell.querySelector('#sidebar');
        const backdrop = shell.querySelector('#drawer-backdrop');
        const setDrawer = (open) => {
            sidebar.classList.toggle('-translate-x-full', !open);
            backdrop.classList.toggle('hidden', !open);
            document.body.classList.toggle('no-scroll', open);
        };
        shell.querySelector('#open-drawer').addEventListener('click', () => setDrawer(true));
        backdrop.addEventListener('click', () => setDrawer(false));
        document.addEventListener('keydown', (event) => { if (event.key === 'Escape') setDrawer(false); });

        Layout.activateMenus();
    },

    // ---------- the bell and the avatar menu (same in both shells) ----------

    bellHtml(onWhite = false) {
        const colour = onWhite ? 'text-ink hover:bg-page' : 'text-white hover:bg-white/10';
        return `
            <a href="${SITE_ROOT}pages/notifications.html" class="relative flex h-10 w-10 items-center justify-center rounded-lg ${colour}" aria-label="Notifications">
                <i class="fa-regular fa-bell text-lg"></i>
                <span id="bell-badge" class="absolute right-1 top-1 hidden min-w-4 rounded-full bg-ochre px-1 text-center text-[10px] font-semibold leading-4 text-espresso"></span>
            </a>`;
    },

    avatarMenuHtml(user, onWhite = false) {
        const links = Layout.avatarMenuItems(user)
            .map((item) => `<a href="${SITE_ROOT + item.page}" class="flex items-center gap-2 rounded-lg px-3 py-2 text-sm hover:bg-page"><i class="fa-solid ${item.icon} w-4 text-center text-ink-soft"></i>${item.label}</a>`)
            .join('');
        const colour = onWhite ? 'hover:bg-page' : 'hover:bg-white/10';
        return `
            <div class="relative">
                <button type="button" data-menu-button class="flex h-10 items-center gap-2 rounded-lg px-1.5 ${colour}" aria-haspopup="true">
                    ${Ui.avatar(user.full_name, 'h-8 w-8 text-xs')}
                    <i class="fa-solid fa-chevron-down hidden text-xs sm:block"></i>
                </button>
                <div data-menu class="absolute right-0 top-12 z-50 hidden w-56 rounded-xl border border-line bg-white p-2 text-ink shadow-lg">
                    <div class="border-b border-line px-3 pb-2 pt-1">
                        <p class="truncate text-sm font-semibold">${Ui.escape(user.full_name)}</p>
                        <p class="truncate text-xs text-ink-soft">${Ui.escape(user.email)}</p>
                    </div>
                    <div class="py-1">${links}</div>
                    <button type="button" data-logout class="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm hover:bg-page">
                        <i class="fa-solid fa-right-from-bracket w-4 text-center text-ink-soft"></i>Logout
                    </button>
                </div>
            </div>`;
    },

    // Opens and closes the avatar menu, and makes Logout work.
    activateMenus() {
        document.querySelectorAll('[data-menu-button]').forEach((button) => {
            const menu = button.parentElement.querySelector('[data-menu]');
            button.addEventListener('click', (event) => {
                event.stopPropagation();
                menu.classList.toggle('hidden');
            });
            menu.querySelector('[data-logout]').addEventListener('click', () => Auth.logout());
        });
        document.addEventListener('click', () => {
            document.querySelectorAll('[data-menu]').forEach((menu) => menu.classList.add('hidden'));
        });
        document.addEventListener('keydown', (event) => {
            if (event.key === 'Escape') document.querySelectorAll('[data-menu]').forEach((menu) => menu.classList.add('hidden'));
        });
    },

    // ---------- the numbers on the bell and the chat ----------

    setBellBadge(count) {
        const badge = document.getElementById('bell-badge');
        if (!badge) return;
        badge.textContent = count > 9 ? '9+' : count;
        badge.classList.toggle('hidden', !(count > 0));
    },

    setChatBadge(count) {
        document.querySelectorAll('.chat-badge').forEach((badge) => {
            badge.textContent = count > 9 ? '9+' : count;
            badge.classList.toggle('hidden', !(count > 0));
        });
    },

    async refreshBadges(user) {
        try {
            const notifications = await Api.get('/notifications', { unread: 1, limit: 1 });
            Layout.setBellBadge(notifications.unread_count);
            if (user.role === 'student' || user.role === 'manager') {
                const chat = await Api.get('/conversations/unread-count');
                Layout.setChatBadge(chat.unread);
            }
        } catch (error) {
            // the numbers are only a help, the page works without them
        }
    },
};
