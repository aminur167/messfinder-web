// Visit requests of the manager: students who want to see the mess.
// A pending request can be confirmed or rejected, a confirmed one can be marked completed.
// The list comes from GET /manager/visits (pending first), 15 on a page. The chips ask the server for one status
// and show the number of requests of every status (the "counts" of the answer).

Layout.start({ active: 'visits', title: 'Visit requests', roles: ['manager'] });

const chipsBox = document.getElementById('chips');
const listBox = document.getElementById('list');
const pagesBox = document.getElementById('pagination');

const smallButton = 'h-9 rounded-lg border border-line bg-white px-3 text-sm font-medium hover:bg-page';

let visits = [];          // the requests of this page
let counts = null;        // how many requests every status has
let filter = '';          // '' (all) or a status
let currentPage = 1;

const filters = [['', 'All'], ['pending', 'Pending'], ['confirmed', 'Confirmed'], ['completed', 'Completed'], ['rejected', 'Rejected'], ['cancelled', 'Cancelled']];

function renderChips() {
    chipsBox.innerHTML = filters.map(([value, label]) => {
        const count = counts === null ? '' : value === '' ? counts.all : counts[value];
        const on = value === filter;
        return `<button type="button" data-chip="${value}" class="h-9 shrink-0 border-b-2 px-0.5 text-sm font-medium ${on ? 'border-ochre text-ink' : 'border-transparent text-ink-soft hover:text-ink'}">${label} <span class="text-ink-soft">${count}</span></button>`;
    }).join('');
}

function actionsHtml(visit) {
    if (visit.status === 'pending') {
        return `
            <button type="button" data-action="confirm" data-visit-id="${visit.visit_id}" class="h-9 rounded-lg bg-espresso px-3 text-sm font-medium text-white hover:bg-espresso-hover disabled:opacity-70">Confirm</button>
            <button type="button" data-action="reject" data-visit-id="${visit.visit_id}" class="${smallButton} text-red-700">Reject</button>`;
    }
    if (visit.status === 'confirmed') {
        return `<button type="button" data-action="complete" data-visit-id="${visit.visit_id}" class="${smallButton}">Mark completed</button>`;
    }
    return '';
}

function rowHtml(visit) {
    return `
        <tr class="border-t border-line hover:bg-page/60">
            <td class="px-4 py-3">
                <span class="font-medium">${Ui.escape(visit.full_name)}</span>
                <span class="block text-xs text-ink-soft">${Ui.escape(visit.university)}, ${Ui.escape(visit.phone)}</span>
            </td>
            <td class="whitespace-nowrap px-4 py-3">${Ui.dateTime(visit.visit_time)}</td>
            <td class="px-4 py-3">${visit.student_note ? `<span class="break-words">${Ui.escape(visit.student_note)}</span>` : '<span class="text-ink-soft">-</span>'}</td>
            <td class="whitespace-nowrap px-4 py-3">${Ui.statusBadge(visit.status)}</td>
            <td class="whitespace-nowrap px-4 py-3 text-right">${actionsHtml(visit)}</td>
        </tr>`;
}

function renderList() {
    renderChips();
    const shown = visits;
    if (counts.all === 0) {
        listBox.innerHTML = Ui.empty({ icon: 'fa-regular fa-calendar-check', title: 'No visit requests', text: 'When a student asks to visit your mess, the request will be here.' });
        return;
    }
    if (shown.length === 0) {
        listBox.innerHTML = Ui.empty({ icon: 'fa-regular fa-calendar', title: 'Nothing here', text: 'No request has this status.' });
        return;
    }
    listBox.innerHTML = `
        <div class="overflow-x-auto rounded-xl border border-line bg-white shadow-sm">
            <table class="w-full text-left text-sm">
                <thead class="bg-slate-50 text-xs text-ink-soft">
                    <tr>
                        <th class="px-4 py-2.5 font-medium">Student</th><th class="px-4 py-2.5 font-medium">Visit time</th>
                        <th class="px-4 py-2.5 font-medium">Note</th><th class="px-4 py-2.5 font-medium">Status</th>
                        <th class="px-4 py-2.5 text-right font-medium">Actions</th>
                    </tr>
                </thead>
                <tbody>${shown.map(rowHtml).join('')}</tbody>
            </table>
        </div>`;
}

async function loadVisits() {
    listBox.innerHTML = Ui.skeleton(4, 'h-14');
    try {
        const answer = await Api.get('/manager/visits', { status: filter, page: currentPage, limit: 15 });
        // the last page may be gone after an answer (for example the only request of the page was answered)
        if (answer.data.length === 0 && currentPage > 1) {
            currentPage = Math.max(1, answer.total_pages);
            loadVisits();
            return;
        }
        visits = answer.data;
        counts = answer.counts;
        renderList();
        Ui.renderPagination(pagesBox, answer.page, answer.total_pages, (page) => { currentPage = page; loadVisits(); });
    } catch (error) {
        chipsBox.innerHTML = '';
        pagesBox.innerHTML = '';
        if (error.status === 404) {
            // no mess yet
            listBox.innerHTML = Ui.empty({
                icon: 'fa-solid fa-building',
                title: 'Set up your mess to get started',
                text: 'Students can ask to visit after your mess is created and verified.',
                buttonHtml: `<a href="${SITE_ROOT}pages/manager/mess-setup.html" class="inline-flex h-10 items-center rounded-lg bg-espresso px-5 text-sm font-medium text-white hover:bg-espresso-hover">Create mess</a>`,
            });
        } else {
            listBox.innerHTML = '';
            listBox.appendChild(Ui.errorBanner(error.message, loadVisits));
        }
    }
}

chipsBox.addEventListener('click', (event) => {
    const chip = event.target.closest('[data-chip]');
    if (!chip) return;
    filter = chip.dataset.chip;
    currentPage = 1;
    loadVisits();
});

// confirm, reject (after a question) and complete
listBox.addEventListener('click', async (event) => {
    const button = event.target.closest('[data-action]');
    if (!button) return;
    const action = button.dataset.action;

    if (action === 'reject') {
        const sure = await Ui.confirm({
            title: 'Reject this request',
            message: 'The student will be told that the visit is rejected.',
            confirmText: 'Reject',
            danger: true,
        });
        if (!sure) return;
    }

    const done = { confirm: 'The visit is confirmed', reject: 'The request is rejected', complete: 'The visit is marked as completed' };
    button.disabled = true;
    try {
        await Api.patch(`/manager/visits/${button.dataset.visitId}/${action}`);
        Ui.toast(done[action]);
        loadVisits();
    } catch (error) {
        Ui.toast(error.message, 'error');       // for example: this request was cancelled by the student
        loadVisits();
    }
});

loadVisits();
