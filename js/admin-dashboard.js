// The Dashboard of the admin: four cards (Users, Messes, Pending verifications, Open complaints),
// a short list of what waits for verification, and shortcuts to the other admin pages.
// The numbers come from GET /admin/dashboard.

Layout.start({ active: 'dashboard', title: 'Admin dashboard', roles: ['admin'] });

const pageBox = document.getElementById('admin-page');
const adminLink = (name) => SITE_ROOT + 'pages/admin/' + name + '.html';

// One card: a link to the page that has the details
function cardHtml({ icon, label, value, note, link }) {
    return `
        <a href="${link}" class="block rounded-xl border border-line border-t-2 border-t-ochre bg-white p-4 shadow-sm hover:bg-page/60">
            <p class="flex items-center gap-2 text-xs font-medium text-ink-soft"><i class="fa-solid ${icon} text-ochre"></i>${label}</p>
            <p class="mt-2 text-2xl font-semibold">${value}</p>
            <p class="mt-1 text-xs text-ink-soft">${note}</p>
        </a>`;
}

// "Recent pending": the newest managers and messes that wait for the admin
function pendingHtml(recent) {
    const items = [
        ...recent.managers.map((manager) => ({ icon: 'fa-user-tie', name: manager.full_name, kind: 'Manager', date: manager.created_at })),
        ...recent.messes.map((mess) => ({ icon: 'fa-building', name: mess.mess_name, kind: 'Mess', date: mess.created_at })),
    ];
    const body = items.length === 0
        ? '<p class="px-4 py-8 text-center text-sm text-ink-soft"><i class="fa-regular fa-circle-check mr-1 text-ochre"></i>Nothing is waiting for you.</p>'
        : items.map((item) => `
            <a href="${adminLink('verification')}" class="flex items-center gap-3 px-4 py-3 hover:bg-page">
                <i class="fa-solid ${item.icon} w-5 text-center text-ochre"></i>
                <span class="min-w-0 flex-1">
                    <span class="block truncate text-sm font-medium">${Ui.escape(item.name)}</span>
                    <span class="block text-xs text-ink-soft">${item.kind}, registered ${Ui.timeAgo(item.date)}</span>
                </span>
                ${Ui.badge('Pending', 'amber')}
            </a>`).join('');
    return `
        <section class="rounded-xl border border-line bg-white shadow-sm">
            <div class="flex items-center justify-between gap-3 border-b border-line px-4 py-3">
                <h2 class="text-sm font-semibold">Recent pending</h2>
                <a href="${adminLink('verification')}" class="text-sm font-medium text-link hover:underline">Open verification</a>
            </div>
            <div class="divide-y divide-line">${body}</div>
        </section>`;
}

function shortcutsHtml() {
    const shortcuts = [
        ['verification', 'fa-user-check', 'Verification'],
        ['users', 'fa-users', 'Users'],
        ['complaints', 'fa-flag', 'Complaints'],
        ['moderation', 'fa-shield-halved', 'Moderation'],
        ['reports', 'fa-chart-column', 'Reports'],
    ];
    return `
        <section class="rounded-xl border border-line bg-white shadow-sm">
            <div class="border-b border-line px-4 py-3"><h2 class="text-sm font-semibold">Shortcuts</h2></div>
            <div class="grid gap-2 p-4 sm:grid-cols-2">
                ${shortcuts.map(([page, icon, label]) => `
                    <a href="${adminLink(page)}" class="flex h-11 items-center gap-3 rounded-lg border border-line px-3 text-sm font-medium hover:bg-page">
                        <i class="fa-solid ${icon} w-5 text-center text-ochre"></i>${label}
                    </a>`).join('')}
            </div>
        </section>`;
}

async function loadDashboard() {
    pageBox.innerHTML = `
        <div class="grid grid-cols-2 gap-3 lg:grid-cols-4">${Ui.skeleton(4, 'h-28')}</div>
        <div class="grid gap-4 lg:grid-cols-2">${Ui.skeleton(2, 'h-56')}</div>`;
    try {
        const data = await Api.get('/admin/dashboard');
        const cards = [
            cardHtml({ icon: 'fa-users', label: 'Users', value: data.users.total,
                note: `${data.users.students} students, ${data.users.managers} managers, ${data.users.blocked} blocked`, link: adminLink('users') }),
            cardHtml({ icon: 'fa-building', label: 'Messes', value: data.messes.total,
                note: `${data.messes.verified} verified, ${data.messes.pending} pending, ${data.messes.suspended} suspended`, link: adminLink('verification') }),
            cardHtml({ icon: 'fa-user-check', label: 'Pending verifications', value: data.pending_verifications,
                note: 'Managers and messes waiting', link: adminLink('verification') }),
            cardHtml({ icon: 'fa-flag', label: 'Open complaints', value: data.open_complaints,
                note: 'Open or in review', link: adminLink('complaints') }),
        ].join('');

        pageBox.innerHTML = `
            <div>
                <h2 class="text-lg font-semibold">Welcome, ${Ui.escape(Auth.getUser().full_name)}</h2>
                <p class="text-sm text-ink-soft">Here is what needs your attention.</p>
            </div>
            <div class="grid grid-cols-2 gap-3 lg:grid-cols-4">${cards}</div>
            <div class="grid gap-4 lg:grid-cols-2">
                ${pendingHtml(data.recent_pending)}
                ${shortcutsHtml()}
            </div>`;
    } catch (error) {
        pageBox.innerHTML = '';
        pageBox.appendChild(Ui.errorBanner(error.message, loadDashboard));
    }
}

loadDashboard();
