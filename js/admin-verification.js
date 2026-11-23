// Verification: the admin checks new managers and new messes. Two tabs, Managers and Messes.
// A mess can be verified only after its manager is verified (the backend checks it too).
// Approve a manager: PATCH /admin/managers/:id/verify. Reject a manager: the account is blocked.
// Approve a mess: PATCH /admin/messes/:id/verify. Suspend a mess: PATCH /admin/messes/:id/suspend.

Layout.start({ active: 'verification', title: 'Verification', roles: ['admin'] });

const pageBox = document.getElementById('admin-page');

const primaryButton = 'h-10 rounded-lg bg-espresso px-4 text-sm font-medium text-white hover:bg-espresso-hover disabled:cursor-not-allowed disabled:opacity-60';
const dangerButton = 'h-10 rounded-lg border border-red-200 bg-white px-4 text-sm font-medium text-red-700 hover:bg-red-50 disabled:opacity-60';

let pending = null;           // the answer of GET /admin/pending: { managers: {data, total...}, messes: {data, total...} }
let currentTab = 'managers';
const pages = { managers: 1, messes: 1 };      // the page of each list

// ---------- the cards ----------

function factHtml(label, value) {
    return `<div><dt class="text-xs text-ink-soft">${label}</dt><dd class="break-words text-sm font-medium">${value}</dd></div>`;
}

function managerCardHtml(manager) {
    const mess = manager.mess_id
        ? `${Ui.escape(manager.mess_name)} ${Ui.statusBadge(manager.mess_status)}` : '<span class="text-ink-soft">No mess yet</span>';
    return `
        <article class="rounded-xl border border-line bg-white p-4 shadow-sm">
            <div class="flex items-start gap-3">
                ${Ui.avatar(manager.full_name, 'h-11 w-11 text-sm')}
                <div class="min-w-0 flex-1">
                    <h3 class="truncate font-semibold">${Ui.escape(manager.full_name)}</h3>
                    <p class="text-xs text-ink-soft">Registered ${Ui.date(manager.created_at)}</p>
                </div>
                ${Ui.badge('Pending', 'amber')}
            </div>
            <dl class="mt-3 grid grid-cols-2 gap-3 rounded-lg bg-page p-3">
                <div class="col-span-2">${factHtml('Email', Ui.escape(manager.email))}</div>
                ${factHtml('Phone', Ui.escape(manager.phone))}
                ${factHtml('NID number', Ui.escape(manager.nid_no))}
                <div class="col-span-2">${factHtml('Address', Ui.escape(manager.address) || '-')}</div>
                <div class="col-span-2"><dt class="text-xs text-ink-soft">Mess</dt><dd class="text-sm font-medium">${mess}</dd></div>
            </dl>
            <div class="mt-3 flex justify-end gap-2">
                <button type="button" data-action="reject-manager" data-id="${manager.user_id}" data-name="${Ui.escape(manager.full_name)}" class="${dangerButton}">Reject</button>
                <button type="button" data-action="approve-manager" data-id="${manager.user_id}" class="${primaryButton}">Approve</button>
            </div>
        </article>`;
}

function messCardHtml(mess) {
    const managerOk = Boolean(mess.manager_verified);
    return `
        <article class="rounded-xl border border-line bg-white p-4 shadow-sm">
            <div class="flex items-start gap-3">
                <span class="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-ochre-soft text-ochre"><i class="fa-solid fa-building"></i></span>
                <div class="min-w-0 flex-1">
                    <h3 class="truncate font-semibold">${Ui.escape(mess.mess_name)}</h3>
                    <p class="text-xs text-ink-soft">Added ${Ui.date(mess.created_at)}</p>
                </div>
                ${Ui.badge('Pending', 'amber')}
            </div>
            <dl class="mt-3 grid grid-cols-2 gap-3 rounded-lg bg-page p-3">
                ${factHtml('Type', mess.mess_type === 'girls' ? 'Girls' : 'Boys')}
                ${factHtml('Area', Ui.escape(mess.area_name))}
                <div class="col-span-2">${factHtml('Address', Ui.escape(mess.address))}</div>
                ${factHtml('Manager', Ui.escape(mess.manager_name) + ' ' + (managerOk ? Ui.statusBadge('verified') : Ui.badge('Not verified', 'amber')))}
                ${factHtml('Seats', mess.seat_count)}
            </dl>
            ${managerOk ? '' : '<p class="mt-2 text-xs text-amber-800"><i class="fa-solid fa-circle-info mr-1"></i>Verify the manager first, then you can approve this mess.</p>'}
            <div class="mt-3 flex justify-end gap-2">
                <button type="button" data-action="suspend-mess" data-id="${mess.mess_id}" data-name="${Ui.escape(mess.mess_name)}" class="${dangerButton}">Suspend</button>
                <button type="button" data-action="approve-mess" data-id="${mess.mess_id}" ${managerOk ? '' : 'disabled'} class="${primaryButton}">Approve</button>
            </div>
        </article>`;
}

// ---------- the page ----------

function render() {
    const tab = (key, label, count) => {
        const on = key === currentTab;
        return `<button type="button" data-tab="${key}" role="tab" class="h-11 shrink-0 border-b-2 px-4 text-sm font-medium ${on ? 'border-ochre text-ink' : 'border-transparent text-ink-soft'}">${label} ${Ui.badge(count, count > 0 ? 'amber' : 'slate')}</button>`;
    };
    const items = pending[currentTab].data;
    const cards = items.length === 0
        ? Ui.empty({
            icon: 'fa-regular fa-circle-check',
            title: currentTab === 'managers' ? 'No manager is waiting' : 'No mess is waiting',
            text: 'New ones will show up here for you to check.',
        })
        : `<div class="grid gap-4 md:grid-cols-2">${items.map(currentTab === 'managers' ? managerCardHtml : messCardHtml).join('')}</div>`;

    pageBox.innerHTML = `
        <div>
            <h2 class="text-lg font-semibold">Verification</h2>
            <p class="text-sm text-ink-soft">A mess is shown to students only after its manager and the mess are both verified.</p>
        </div>
        <div class="hide-scrollbar flex gap-1 overflow-x-auto border-b border-line" role="tablist">
            ${tab('managers', 'Managers', pending.managers.total)}${tab('messes', 'Messes', pending.messes.total)}
        </div>
        ${cards}
        <div id="pagination"></div>`;
    Ui.renderPagination(document.getElementById('pagination'), pending[currentTab].page, pending[currentTab].total_pages, (page) => {
        pages[currentTab] = page;
        loadPending();
    });
}

async function loadPending() {
    pageBox.innerHTML = Ui.skeleton(3, 'h-32');
    try {
        pending = await Api.get('/admin/pending', { managers_page: pages.managers, messes_page: pages.messes, limit: 12 });
        // a page that is gone after an answer (the last card was approved): go to the last page that exists
        if (pending.managers.data.length === 0 && pages.managers > 1) { pages.managers = Math.max(1, pending.managers.total_pages); loadPending(); return; }
        if (pending.messes.data.length === 0 && pages.messes > 1) { pages.messes = Math.max(1, pending.messes.total_pages); loadPending(); return; }
        render();
    } catch (error) {
        pageBox.innerHTML = '';
        pageBox.appendChild(Ui.errorBanner(error.message, loadPending));
    }
}

// ---------- the buttons ----------

// Runs one answer of the admin: asks (if needed), calls the backend, shows a toast and loads the list again
async function answer({ button, ask, path, method = 'patch', success }) {
    if (ask && !(await Ui.confirm(ask))) return;
    button.disabled = true;
    try {
        await Api[method](path);
        Ui.toast(success);
    } catch (error) {
        Ui.toast(error.message, 'error');
    }
    loadPending();
}

pageBox.addEventListener('click', (event) => {
    const tab = event.target.closest('[data-tab]');
    if (tab) {
        currentTab = tab.dataset.tab;
        render();
        return;
    }
    const button = event.target.closest('[data-action]');
    if (!button) return;
    const id = button.dataset.id;

    switch (button.dataset.action) {
        case 'approve-manager':
            answer({ button, path: `/admin/managers/${id}/verify`, success: 'The manager is verified' });
            break;
        case 'reject-manager':
            answer({
                button, path: `/admin/users/${id}/block`,
                ask: { title: 'Reject this manager', message: `${button.dataset.name} will be blocked and cannot log in. You can unblock the account later on the Users page.`, confirmText: 'Reject', danger: true },
                success: 'The manager is rejected and blocked',
            });
            break;
        case 'approve-mess':
            answer({ button, path: `/admin/messes/${id}/verify`, success: 'The mess is verified and shown to students' });
            break;
        case 'suspend-mess':
            answer({
                button, path: `/admin/messes/${id}/suspend`,
                ask: { title: 'Suspend this mess', message: `${button.dataset.name} will not be shown to students. The manager is told about it.`, confirmText: 'Suspend', danger: true },
                success: 'The mess is suspended',
            });
            break;
        default: break;
    }
});

loadPending();
