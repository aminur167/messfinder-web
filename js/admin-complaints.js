// Complaints: the admin reads the complaints of students and managers.
// A click on a row opens a drawer with the whole complaint, a status (open, in review, resolved,
// dismissed) and a note for the person who complained. The list is GET /admin/complaints (20 on a page).
// Saving is PATCH /admin/complaints/:id. The person who complained is told when the status changes.

Layout.start({ active: 'complaints', title: 'Complaints', roles: ['admin'] });

const pageBox = document.getElementById('admin-page');

const inputClass = 'w-full rounded-lg border border-line bg-white px-3 text-sm placeholder:text-mute focus:border-ochre focus:outline-none focus:ring-2 focus:ring-ochre/40';
const statuses = [['open', 'Open'], ['in_review', 'In review'], ['resolved', 'Resolved'], ['dismissed', 'Dismissed']];

let filter = '';
let currentPage = 1;
let complaints = [];          // the complaints on the screen

pageBox.innerHTML = `
    <div>
        <h2 class="text-lg font-semibold">Complaints</h2>
        <p class="text-sm text-ink-soft">Complaints that are not finished come first. Open one to answer it.</p>
    </div>
    <div id="chips" class="hide-scrollbar flex gap-5 overflow-x-auto"></div>
    <div id="list"></div>
    <div id="pagination"></div>`;

const chipsBox = document.getElementById('chips');
const listBox = document.getElementById('list');
const pagesBox = document.getElementById('pagination');

function renderChips() {
    chipsBox.innerHTML = [['', 'All'], ...statuses].map(([value, label]) => {
        const on = value === filter;
        return `<button type="button" data-chip="${value}" class="h-9 shrink-0 border-b-2 px-0.5 text-sm font-medium ${on ? 'border-ochre text-ink' : 'border-transparent text-ink-soft hover:text-ink'}">${label}</button>`;
    }).join('');
}

chipsBox.addEventListener('click', (event) => {
    const chip = event.target.closest('[data-chip]');
    if (!chip) return;
    filter = chip.dataset.chip;
    currentPage = 1;
    renderChips();
    loadComplaints();
});

// ---------- the table ----------

function rowHtml(complaint, index) {
    const about = complaint.mess_name || complaint.against_name || '-';
    return `
        <tr class="cursor-pointer border-t border-line hover:bg-page/60" data-index="${index}">
            <td class="px-4 py-3">
                <span class="font-medium">${Ui.escape(complaint.subject)}</span>
                <span class="block text-xs text-ink-soft">${Ui.escape(complaint.complainant_name)} (${Ui.escape(complaint.complainant_role)})</span>
            </td>
            <td class="px-4 py-3">${Ui.escape(about)}</td>
            <td class="whitespace-nowrap px-4 py-3">${Ui.statusBadge(complaint.status)}</td>
            <td class="whitespace-nowrap px-4 py-3">${Ui.date(complaint.created_at)}</td>
            <td class="whitespace-nowrap px-4 py-3 text-right"><button type="button" data-open="${index}" class="h-9 rounded-lg border border-line bg-white px-3 text-sm font-medium hover:bg-page">Open</button></td>
        </tr>`;
}

async function loadComplaints() {
    listBox.innerHTML = Ui.skeleton(4, 'h-14');
    try {
        const answer = await Api.get('/admin/complaints', { status: filter, page: currentPage, limit: 20 });
        complaints = answer.data;
        if (complaints.length === 0) {
            listBox.innerHTML = Ui.empty({ icon: 'fa-regular fa-flag', title: 'No complaints', text: filter ? 'No complaint has this status.' : 'Nobody has complained yet.' });
            pagesBox.innerHTML = '';
            return;
        }
        listBox.innerHTML = `
            <div class="overflow-x-auto rounded-xl border border-line bg-white shadow-sm">
                <table class="w-full text-left text-sm">
                    <thead class="bg-slate-50 text-xs text-ink-soft">
                        <tr>
                            <th class="px-4 py-2.5 font-medium">Complaint</th><th class="px-4 py-2.5 font-medium">About</th>
                            <th class="px-4 py-2.5 font-medium">Status</th><th class="px-4 py-2.5 font-medium">Date</th><th></th>
                        </tr>
                    </thead>
                    <tbody>${complaints.map(rowHtml).join('')}</tbody>
                </table>
            </div>`;
        Ui.renderPagination(pagesBox, answer.page, answer.total_pages, (page) => { currentPage = page; loadComplaints(); });
    } catch (error) {
        pagesBox.innerHTML = '';
        listBox.innerHTML = '';
        listBox.appendChild(Ui.errorBanner(error.message, loadComplaints));
    }
}

listBox.addEventListener('click', (event) => {
    const row = event.target.closest('[data-index]');
    if (row) openComplaint(complaints[Number(row.dataset.index)]);
});

// ---------- the drawer ----------

function openComplaint(complaint) {
    const line = (label, value) => `<div><dt class="text-xs text-ink-soft">${label}</dt><dd class="text-sm font-medium">${value}</dd></div>`;
    const options = statuses
        .map(([value, label]) => `<option value="${value}" ${complaint.status === value ? 'selected' : ''}>${label}</option>`)
        .join('');

    const drawer = Ui.drawer({
        title: 'Complaint',
        size: 'max-w-lg',
        bodyHtml: `
            <div class="space-y-5">
                <div>
                    <h3 class="font-semibold leading-snug">${Ui.escape(complaint.subject)}</h3>
                    <p class="mt-2 whitespace-pre-line break-words text-sm">${Ui.escape(complaint.description)}</p>
                </div>
                <dl class="grid grid-cols-2 gap-3 rounded-lg bg-page p-4">
                    ${line('From', `${Ui.escape(complaint.complainant_name)} (${Ui.escape(complaint.complainant_role)})`)}
                    ${line('Date', Ui.date(complaint.created_at))}
                    ${line('Against', Ui.escape(complaint.against_name) || '-')}
                    ${line('Mess', Ui.escape(complaint.mess_name) || '-')}
                </dl>
                <form class="space-y-4" novalidate>
                    <div>
                        <label for="field-status" class="mb-1 block text-sm font-medium">Status</label>
                        <select id="field-status" name="status" class="h-11 ${inputClass}">${options}</select>
                    </div>
                    <div>
                        <label for="field-admin_note" class="mb-1 block text-sm font-medium">Note for the person who complained <span class="font-normal text-ink-soft">(optional)</span></label>
                        <textarea id="field-admin_note" name="admin_note" rows="4" maxlength="255" placeholder="Write what you did or decided" class="py-2 ${inputClass}">${Ui.escape(complaint.admin_note || '')}</textarea>
                        <p data-error-for="admin_note" class="mt-1 text-xs text-red-600"></p>
                    </div>
                    <p data-form-message class="hidden text-sm text-red-700"></p>
                    <div class="flex justify-end gap-2">
                        <button type="button" data-close class="h-10 rounded-lg border border-line bg-white px-4 text-sm font-medium hover:bg-page">Cancel</button>
                        <button type="submit" class="h-10 rounded-lg bg-espresso px-5 text-sm font-medium text-white hover:bg-espresso-hover disabled:opacity-70">Save</button>
                    </div>
                </form>
            </div>`,
    });

    const form = drawer.element.querySelector('form');
    form.addEventListener('submit', async (event) => {
        event.preventDefault();
        const message = form.querySelector('[data-form-message]');
        message.classList.add('hidden');
        const button = form.querySelector('button[type=submit]');
        Ui.setLoading(button, true, 'Saving');
        try {
            await Api.patch(`/admin/complaints/${complaint.complaint_id}`, {
                status: form.elements.status.value,
                admin_note: form.elements.admin_note.value.trim(),
            });
            Ui.toast('The complaint is saved');
            drawer.close();
            loadComplaints();
        } catch (error) {
            message.textContent = error.message;
            message.classList.remove('hidden');
            Ui.setLoading(button, false);
        }
    });
}

renderChips();
loadComplaints();
