// Users: the admin looks for users and blocks or unblocks them.
// A blocked user cannot log in. Nothing is deleted. An admin account cannot be blocked.
// The list is GET /admin/users?role=&status=&q=&page=, 20 users on a page.

Layout.start({ active: 'users', title: 'Users', roles: ['admin'] });

const pageBox = document.getElementById('admin-page');
const me = Auth.getUser();

const inputClass = 'h-11 rounded-lg border border-line bg-white px-3 text-sm placeholder:text-mute focus:border-ochre focus:outline-none focus:ring-2 focus:ring-ochre/40';

let role = '';
let status = '';
let searchWord = '';
let currentPage = 1;
let loadCounter = 0;          // an old slow answer must not replace a newer one

// ---------- the frame (filters stay, only the table changes) ----------

pageBox.innerHTML = `
    <div>
        <h2 class="text-lg font-semibold">Users</h2>
        <p class="text-sm text-ink-soft">Search the users of the website. A blocked user cannot log in.</p>
    </div>
    <div class="flex flex-col gap-3 sm:flex-row">
        <input id="search" type="search" placeholder="Search by name, email or phone" aria-label="Search users" class="${inputClass} w-full sm:max-w-xs">
        <select id="role" aria-label="Role" class="${inputClass}">
            <option value="">All roles</option><option value="student">Students</option><option value="manager">Managers</option><option value="admin">Admins</option>
        </select>
        <select id="status" aria-label="Status" class="${inputClass}">
            <option value="">All statuses</option><option value="active">Active</option><option value="blocked">Blocked</option>
        </select>
    </div>
    <div id="list"></div>
    <div id="pagination"></div>`;

const listBox = document.getElementById('list');
const pagesBox = document.getElementById('pagination');

// ---------- the table ----------

function rowHtml(user) {
    const roleBadge = Ui.badge(user.role.charAt(0).toUpperCase() + user.role.slice(1), user.role === 'admin' ? 'ochre' : 'slate');
    const isBlocked = !user.is_active;
    let action = '<span class="text-xs text-ink-soft">-</span>';
    if (user.role !== 'admin' && user.user_id !== me.user_id) {
        action = isBlocked
            ? `<button type="button" data-action="unblock" data-id="${user.user_id}" data-name="${Ui.escape(user.full_name)}" class="h-9 rounded-lg border border-line bg-white px-3 text-sm font-medium hover:bg-page">Unblock</button>`
            : `<button type="button" data-action="block" data-id="${user.user_id}" data-name="${Ui.escape(user.full_name)}" class="h-9 rounded-lg border border-red-200 bg-white px-3 text-sm font-medium text-red-700 hover:bg-red-50">Block</button>`;
    }
    return `
        <tr class="border-t border-line hover:bg-page/60">
            <td class="px-4 py-3">
                <span class="flex items-center gap-3">${Ui.avatar(user.full_name)}<span class="font-medium">${Ui.escape(user.full_name)}</span></span>
            </td>
            <td class="px-4 py-3">${Ui.escape(user.email)}</td>
            <td class="whitespace-nowrap px-4 py-3">${Ui.escape(user.phone)}</td>
            <td class="whitespace-nowrap px-4 py-3">${roleBadge}</td>
            <td class="whitespace-nowrap px-4 py-3">${Ui.statusBadge(isBlocked ? 'blocked' : 'active')}</td>
            <td class="whitespace-nowrap px-4 py-3">${Ui.date(user.created_at)}</td>
            <td class="whitespace-nowrap px-4 py-3 text-right">${action}</td>
        </tr>`;
}

async function loadUsers() {
    const thisLoad = ++loadCounter;
    listBox.innerHTML = Ui.skeleton(5, 'h-14');
    try {
        const answer = await Api.get('/admin/users', { role, status, q: searchWord, page: currentPage, limit: 20 });
        if (thisLoad !== loadCounter) return;
        if (answer.data.length === 0) {
            listBox.innerHTML = Ui.empty({ icon: 'fa-solid fa-magnifying-glass', title: 'No user found', text: 'Try another word or another filter.' });
            pagesBox.innerHTML = '';
            return;
        }
        listBox.innerHTML = `
            <p class="mb-2 text-sm text-ink-soft">${answer.total} ${answer.total === 1 ? 'user' : 'users'}</p>
            <div class="overflow-x-auto rounded-xl border border-line bg-white shadow-sm">
                <table class="w-full text-left text-sm">
                    <thead class="bg-slate-50 text-xs text-ink-soft">
                        <tr>
                            <th class="px-4 py-2.5 font-medium">Name</th><th class="px-4 py-2.5 font-medium">Email</th>
                            <th class="px-4 py-2.5 font-medium">Phone</th><th class="px-4 py-2.5 font-medium">Role</th>
                            <th class="px-4 py-2.5 font-medium">Status</th><th class="px-4 py-2.5 font-medium">Joined</th>
                            <th class="px-4 py-2.5 text-right font-medium">Action</th>
                        </tr>
                    </thead>
                    <tbody>${answer.data.map(rowHtml).join('')}</tbody>
                </table>
            </div>`;
        Ui.renderPagination(pagesBox, answer.page, answer.total_pages, (page) => { currentPage = page; loadUsers(); });
    } catch (error) {
        if (thisLoad !== loadCounter) return;
        pagesBox.innerHTML = '';
        listBox.innerHTML = '';
        listBox.appendChild(Ui.errorBanner(error.message, loadUsers));
    }
}

// ---------- filters and buttons ----------

let searchTimer = null;
document.getElementById('search').addEventListener('input', (event) => {
    clearTimeout(searchTimer);
    searchTimer = setTimeout(() => { searchWord = event.target.value.trim(); currentPage = 1; loadUsers(); }, 300);
});
document.getElementById('role').addEventListener('change', (event) => { role = event.target.value; currentPage = 1; loadUsers(); });
document.getElementById('status').addEventListener('change', (event) => { status = event.target.value; currentPage = 1; loadUsers(); });

listBox.addEventListener('click', async (event) => {
    const button = event.target.closest('[data-action]');
    if (!button) return;
    const block = button.dataset.action === 'block';

    if (block) {
        const sure = await Ui.confirm({
            title: 'Block this user',
            message: `${button.dataset.name} will not be able to log in any more. You can unblock the account later.`,
            confirmText: 'Block',
            danger: true,
        });
        if (!sure) return;
    }
    button.disabled = true;
    try {
        await Api.patch(`/admin/users/${button.dataset.id}/${block ? 'block' : 'unblock'}`);
        Ui.toast(block ? 'The user is blocked' : 'The user is unblocked');
    } catch (error) {
        Ui.toast(error.message, 'error');
    }
    loadUsers();
});

loadUsers();
