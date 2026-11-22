// Members page of the manager.
//   Active members   search, filter by the rent status of this month, table with the money
//                    (record a payment, see the details, mark as left), and Add member
//   Ex-members       the people who left, with what they paid and what they left unpaid
// Other pages can open a form with the address:
//   members.html?add=1            the Add member drawer
//   members.html?seat_id=5        the Add member drawer with seat 5 chosen
//   members.html?member_id=7      the Details drawer of member 7

Layout.start({ active: 'members', title: 'Members', roles: ['manager'] });

const listBox = document.getElementById('member-list');
const pagesBox = document.getElementById('member-pages');
const chipsBox = document.getElementById('chips');
const exList = document.getElementById('ex-list');
const exPages = document.getElementById('ex-pages');
const activeTab = document.getElementById('tab-active');
const exTab = document.getElementById('tab-ex');

const inputClass = 'h-11 w-full rounded-lg border border-line bg-white px-3 text-sm placeholder:text-mute focus:border-ochre focus:outline-none focus:ring-2 focus:ring-ochre/40';
const primaryButton = 'h-10 rounded-lg bg-espresso px-5 text-sm font-medium text-white hover:bg-espresso-hover disabled:opacity-70';
const secondaryButton = 'h-10 rounded-lg border border-line bg-white px-4 text-sm font-medium hover:bg-page';
const smallButton = 'h-9 rounded-lg border border-line bg-white px-3 text-sm font-medium hover:bg-page';

let filter = '';              // '', paid, partial, due or overdue
let searchWord = '';
let currentPage = 1;
let summary = null;           // the numbers on the chips
let loadCounter = 0;          // so that a slow old answer cannot replace a newer one
let exLoaded = false;

// ---------- small helpers ----------

// "2026-11-24" -> "2026-11-24" in the local time of the computer, plus or minus some days
function dayText(plusDays = 0) {
    const day = new Date();
    day.setDate(day.getDate() + plusDays);
    return day.toLocaleDateString('en-CA');
}

// "2026-11-01" -> "Nov 2026"
function monthText(text) {
    const day = new Date(String(text).replace(' ', 'T'));
    return isNaN(day) ? text : day.toLocaleDateString('en-GB', { month: 'short', year: 'numeric' });
}

const methodNames = { cash: 'Cash', bkash: 'bKash', nagad: 'Nagad' };

function fieldHtml({ name, label, value = '', type = 'text', placeholder = '', help = '', maxlength = '', extra = '' }) {
    return `
        <div>
            <label for="field-${name}" class="mb-1 block text-sm font-medium">${label}</label>
            <input id="field-${name}" name="${name}" type="${type}" value="${Ui.escape(value)}" placeholder="${Ui.escape(placeholder)}" ${maxlength ? `maxlength="${maxlength}"` : ''} ${extra}
                class="${inputClass}">
            ${help ? `<p class="mt-1 text-xs text-ink-soft">${help}</p>` : ''}
            <p data-error-for="${name}" class="mt-1 text-xs text-red-600"></p>
        </div>`;
}

function methodSelectHtml(name) {
    return `
        <div>
            <label for="field-${name}" class="mb-1 block text-sm font-medium">Method</label>
            <select id="field-${name}" name="${name}" class="${inputClass}">
                <option value="cash">Cash</option><option value="bkash">bKash</option><option value="nagad">Nagad</option>
            </select>
        </div>`;
}

// A manager with no mess has nothing to show on this page
function noMessHtml() {
    return Ui.empty({
        icon: 'fa-solid fa-building',
        title: 'Set up your mess to get started',
        text: 'Create your mess and add rooms and seats first. Then you can add members.',
        buttonHtml: `<a href="${SITE_ROOT}pages/manager/mess-setup.html" class="inline-flex h-10 items-center rounded-lg bg-espresso px-5 text-sm font-medium text-white hover:bg-espresso-hover">Create mess</a>`,
    });
}

// =====================================================================
//  Tabs
// =====================================================================

function showTab(name) {
    document.querySelectorAll('[data-tab]').forEach((button) => {
        const active = button.dataset.tab === name;
        button.classList.toggle('border-ochre', active);
        button.classList.toggle('text-ink', active);
        button.classList.toggle('border-transparent', !active);
        button.classList.toggle('text-ink-soft', !active);
        button.setAttribute('aria-selected', active);
    });
    activeTab.classList.toggle('hidden', name !== 'active');
    exTab.classList.toggle('hidden', name !== 'ex');
    if (name === 'ex' && !exLoaded) loadExMembers(1);
}

document.querySelectorAll('[data-tab]').forEach((button) => {
    button.addEventListener('click', () => showTab(button.dataset.tab));
});

// =====================================================================
//  Active members
// =====================================================================

function renderChips() {
    const chips = [
        ['', 'All', summary.total],
        ['paid', 'Paid', summary.paid],
        ['partial', 'Partial', summary.partial],
        ['due', 'Due', summary.due],
        ['overdue', 'Overdue', summary.overdue],
    ];
    chipsBox.innerHTML = chips.map(([value, label, count]) => {
        const on = value === filter;
        return `<button type="button" data-chip="${value}" class="h-9 shrink-0 border-b-2 px-0.5 text-sm font-medium ${on ? 'border-ochre text-ink' : 'border-transparent text-ink-soft hover:text-ink'}">${label} <span class="text-ink-soft">${count}</span></button>`;
    }).join('');
}

chipsBox.addEventListener('click', (event) => {
    const chip = event.target.closest('[data-chip]');
    if (!chip) return;
    filter = chip.dataset.chip;
    currentPage = 1;
    loadMembers();
});

let searchTimer = null;
document.getElementById('search').addEventListener('input', (event) => {
    clearTimeout(searchTimer);
    searchTimer = setTimeout(() => {
        searchWord = event.target.value.trim();
        currentPage = 1;
        loadMembers();
    }, 300);
});

function memberRowHtml(member) {
    const owes = Number(member.outstanding) > 0
        ? `<span class="font-semibold text-red-700">${Ui.money(member.outstanding)}</span>`
        : '<span class="text-ink-soft">৳0</span>';
    const linked = member.is_linked ? ' ' + Ui.statusBadge('linked') : '';
    const monthStatus = member.current_month_status ? Ui.statusBadge(member.current_month_status) : '<span class="text-ink-soft">-</span>';
    return `
        <tr class="border-t border-line hover:bg-page/60">
            <td class="px-4 py-3">
                <span class="font-medium">${Ui.escape(member.full_name)}</span>${linked}
                <span class="block text-xs text-ink-soft">${Ui.escape(member.phone)}</span>
            </td>
            <td class="whitespace-nowrap px-4 py-3">${Ui.escape(member.room_no)}-${Ui.escape(member.seat_label)}</td>
            <td class="whitespace-nowrap px-4 py-3">${Ui.money(member.monthly_rent)}</td>
            <td class="whitespace-nowrap px-4 py-3">${monthStatus}</td>
            <td class="whitespace-nowrap px-4 py-3">${owes}</td>
            <td class="whitespace-nowrap px-4 py-3 text-right">
                <button type="button" data-action="pay" data-member-id="${member.member_id}" class="${smallButton}">Record payment</button>
                <button type="button" data-action="details" data-member-id="${member.member_id}" class="${smallButton}">Details</button>
                <button type="button" data-action="leave" data-member-id="${member.member_id}" data-name="${Ui.escape(member.full_name)}" data-join-date="${Ui.escape(String(member.join_date).slice(0, 10))}" class="${smallButton} text-red-700">Mark left</button>
            </td>
        </tr>`;
}

function memberTableHtml(rows) {
    return `
        <div class="overflow-x-auto rounded-xl border border-line bg-white shadow-sm">
            <table class="w-full text-left text-sm">
                <thead class="bg-slate-50 text-xs text-ink-soft">
                    <tr>
                        <th class="px-4 py-2.5 font-medium">Member</th><th class="px-4 py-2.5 font-medium">Seat</th>
                        <th class="px-4 py-2.5 font-medium">Monthly rent</th><th class="px-4 py-2.5 font-medium">This month</th>
                        <th class="px-4 py-2.5 font-medium">Owes</th><th class="px-4 py-2.5 text-right font-medium">Actions</th>
                    </tr>
                </thead>
                <tbody>${rows.map(memberRowHtml).join('')}</tbody>
            </table>
        </div>`;
}

async function loadMembers() {
    const thisLoad = ++loadCounter;
    listBox.innerHTML = Ui.skeleton(5, 'h-14');
    try {
        const answer = await Api.get('/manager/members', { month_status: filter, q: searchWord, page: currentPage, limit: 15 });
        if (thisLoad !== loadCounter) return;
        summary = answer.summary;
        renderChips();

        if (answer.data.length === 0) {
            const nothingYet = summary.total === 0 && filter === '' && searchWord === '';
            listBox.innerHTML = nothingYet
                ? Ui.empty({
                    icon: 'fa-solid fa-users',
                    title: 'No members yet',
                    text: 'Give a free seat to a person and the first rent due is made for them.',
                    buttonHtml: `<button type="button" data-action="add" class="${primaryButton}">Add member</button>`,
                })
                : Ui.empty({ icon: 'fa-solid fa-magnifying-glass', title: 'No member found', text: 'Try another word or another filter.' });
            pagesBox.innerHTML = '';
            return;
        }
        listBox.innerHTML = memberTableHtml(answer.data);
        Ui.renderPagination(pagesBox, answer.page, answer.total_pages, (page) => { currentPage = page; loadMembers(); });
    } catch (error) {
        if (thisLoad !== loadCounter) return;
        pagesBox.innerHTML = '';
        if (error.status === 404) {
            listBox.innerHTML = noMessHtml();
        } else {
            listBox.innerHTML = '';
            listBox.appendChild(Ui.errorBanner(error.message, loadMembers));
        }
    }
}

// The buttons of the table (and the one of the empty state)
activeTab.addEventListener('click', (event) => {
    const target = event.target.closest('[data-action]');
    if (!target) return;
    const memberId = Number(target.dataset.memberId);
    if (target.dataset.action === 'add') openAddMember();
    if (target.dataset.action === 'pay') openPayment(memberId);
    if (target.dataset.action === 'details') openDetails(memberId);
    if (target.dataset.action === 'leave') openLeave(memberId, target.dataset.name, target.dataset.joinDate);
});

document.getElementById('add-member-button').addEventListener('click', () => openAddMember());

// =====================================================================
//  Ex-members
// =====================================================================

function stayedText(member) {
    if (member.months_stayed >= 1) return member.months_stayed + (member.months_stayed === 1 ? ' month' : ' months');
    return member.days_stayed + (member.days_stayed === 1 ? ' day' : ' days');
}

function exRowHtml(member) {
    const owes = Number(member.outstanding) > 0
        ? `<span class="font-semibold text-red-700">${Ui.money(member.outstanding)}</span> <span class="text-xs text-red-700">left unpaid</span>`
        : '<span class="text-ink-soft">Nothing</span>';
    return `
        <tr class="border-t border-line hover:bg-page/60">
            <td class="px-4 py-3">
                <span class="font-medium">${Ui.escape(member.full_name)}</span>${member.is_linked ? ' ' + Ui.statusBadge('linked') : ''}
                <span class="block text-xs text-ink-soft">${Ui.escape(member.phone)}${member.occupation ? ', ' + Ui.escape(member.occupation) : ''}</span>
            </td>
            <td class="whitespace-nowrap px-4 py-3">${Ui.escape(member.room_no)}-${Ui.escape(member.seat_label)}</td>
            <td class="whitespace-nowrap px-4 py-3">${Ui.date(member.join_date)}</td>
            <td class="whitespace-nowrap px-4 py-3">${Ui.date(member.leave_date)}<span class="block text-xs text-ink-soft">${stayedText(member)}</span></td>
            <td class="whitespace-nowrap px-4 py-3">${Ui.money(member.total_paid)}</td>
            <td class="whitespace-nowrap px-4 py-3">${owes}</td>
            <td class="whitespace-nowrap px-4 py-3 text-right"><button type="button" data-action="details" data-member-id="${member.member_id}" class="${smallButton}">Details</button></td>
        </tr>`;
}

async function loadExMembers(page) {
    exList.innerHTML = Ui.skeleton(4, 'h-14');
    try {
        const answer = await Api.get('/manager/members/ex', { page, limit: 15 });
        exLoaded = true;
        if (answer.data.length === 0) {
            exList.innerHTML = Ui.empty({ icon: 'fa-solid fa-user-clock', title: 'No ex-members', text: 'Members you mark as left will be listed here.' });
            exPages.innerHTML = '';
            return;
        }
        exList.innerHTML = `
            <div class="overflow-x-auto rounded-xl border border-line bg-white shadow-sm">
                <table class="w-full text-left text-sm">
                    <thead class="bg-slate-50 text-xs text-ink-soft">
                        <tr>
                            <th class="px-4 py-2.5 font-medium">Member</th><th class="px-4 py-2.5 font-medium">Seat</th>
                            <th class="px-4 py-2.5 font-medium">Joined</th><th class="px-4 py-2.5 font-medium">Left</th>
                            <th class="px-4 py-2.5 font-medium">Paid in total</th><th class="px-4 py-2.5 font-medium">Dues</th><th></th>
                        </tr>
                    </thead>
                    <tbody>${answer.data.map(exRowHtml).join('')}</tbody>
                </table>
            </div>`;
        Ui.renderPagination(exPages, answer.page, answer.total_pages, loadExMembers);
    } catch (error) {
        exPages.innerHTML = '';
        if (error.status === 404) {
            exList.innerHTML = noMessHtml();
        } else {
            exList.innerHTML = '';
            exList.appendChild(Ui.errorBanner(error.message, () => loadExMembers(page)));
        }
    }
}

exTab.addEventListener('click', (event) => {
    const target = event.target.closest('[data-action=details]');
    if (target) openDetails(Number(target.dataset.memberId));
});

// =====================================================================
//  Details drawer
// =====================================================================

function detailsHtml(data) {
    const member = data.member;
    const isActive = member.status === 'active';

    const dueRows = data.dues.length === 0
        ? '<tr><td colspan="5" class="px-3 py-4 text-center text-ink-soft">No dues yet</td></tr>'
        : data.dues.map((due) => `
            <tr class="border-t border-line">
                <td class="whitespace-nowrap px-3 py-2">${monthText(due.due_month)}</td>
                <td class="whitespace-nowrap px-3 py-2">${Ui.money(due.amount)}</td>
                <td class="whitespace-nowrap px-3 py-2">${Ui.money(due.paid)}</td>
                <td class="whitespace-nowrap px-3 py-2 ${Number(due.remaining) > 0 ? 'font-semibold text-red-700' : ''}">${Ui.money(due.remaining)}</td>
                <td class="whitespace-nowrap px-3 py-2">${Ui.statusBadge(due.status)}</td>
            </tr>`).join('');

    const paymentRows = data.payments.length === 0
        ? '<tr><td colspan="4" class="px-3 py-4 text-center text-ink-soft">No payment yet</td></tr>'
        : data.payments.map((payment) => `
            <tr class="border-t border-line">
                <td class="whitespace-nowrap px-3 py-2">${Ui.date(payment.paid_at)}</td>
                <td class="whitespace-nowrap px-3 py-2">${payment.payment_type === 'advance' ? 'Advance' : 'Rent'}</td>
                <td class="whitespace-nowrap px-3 py-2">${Ui.escape(methodNames[payment.method] || payment.method)}</td>
                <td class="whitespace-nowrap px-3 py-2 font-medium">${Ui.money(payment.amount)}</td>
            </tr>`).join('');

    const line = (label, value) => `<div><dt class="text-xs text-ink-soft">${label}</dt><dd class="text-sm font-medium">${value}</dd></div>`;
    const buttons = isActive ? `
        <div class="flex flex-wrap gap-2">
            <button type="button" data-drawer-action="pay" class="${primaryButton}">Record payment</button>
            <button type="button" data-drawer-action="leave" class="${secondaryButton} text-red-700">Mark left</button>
        </div>` : '';

    return `
        <div class="space-y-5">
            <div class="flex items-center gap-3">
                ${Ui.avatar(member.full_name, 'h-12 w-12 text-base')}
                <div class="min-w-0">
                    <p class="truncate font-semibold">${Ui.escape(member.full_name)} ${member.is_linked ? Ui.statusBadge('linked') : ''}</p>
                    <p class="text-sm text-ink-soft">${Ui.statusBadge(member.status)}</p>
                </div>
            </div>

            <dl class="grid grid-cols-2 gap-3 rounded-lg bg-page p-4">
                ${line('Phone', Ui.escape(member.phone))}
                ${line('Seat', `Room ${Ui.escape(member.room_no)}, seat ${Ui.escape(member.seat_label)}`)}
                ${line('Gender', member.gender === 'female' ? 'Female' : 'Male')}
                ${line('Occupation', Ui.escape(member.occupation) || '-')}
                ${line('Monthly rent', Ui.money(member.monthly_rent))}
                ${line('Advance', Ui.money(member.advance_amount))}
                ${line('Joined', Ui.date(member.join_date))}
                ${line(isActive ? 'Owes now' : 'Left on', isActive ? `<span class="${Number(data.outstanding) > 0 ? 'text-red-700' : ''}">${Ui.money(data.outstanding)}</span>` : Ui.date(member.leave_date))}
            </dl>

            ${buttons}

            <section>
                <h3 class="mb-2 text-sm font-semibold">Monthly dues</h3>
                <div class="overflow-x-auto rounded-lg border border-line">
                    <table class="w-full text-left text-sm">
                        <thead class="bg-slate-50 text-xs text-ink-soft"><tr><th class="px-3 py-2 font-medium">Month</th><th class="px-3 py-2 font-medium">Amount</th><th class="px-3 py-2 font-medium">Paid</th><th class="px-3 py-2 font-medium">Left</th><th class="px-3 py-2 font-medium">Status</th></tr></thead>
                        <tbody>${dueRows}</tbody>
                    </table>
                </div>
            </section>

            <section>
                <h3 class="mb-2 text-sm font-semibold">Payments</h3>
                <div class="overflow-x-auto rounded-lg border border-line">
                    <table class="w-full text-left text-sm">
                        <thead class="bg-slate-50 text-xs text-ink-soft"><tr><th class="px-3 py-2 font-medium">Date</th><th class="px-3 py-2 font-medium">For</th><th class="px-3 py-2 font-medium">Method</th><th class="px-3 py-2 font-medium">Amount</th></tr></thead>
                        <tbody>${paymentRows}</tbody>
                    </table>
                </div>
            </section>
        </div>`;
}

async function openDetails(memberId) {
    let data;
    try {
        data = await Api.get('/manager/members/' + memberId);
    } catch (error) {
        Ui.toast(error.message, 'error');
        return;
    }
    const drawer = Ui.drawer({ title: 'Member details', bodyHtml: detailsHtml(data), size: 'max-w-lg' });
    drawer.element.addEventListener('click', (event) => {
        const action = event.target.closest('[data-drawer-action]');
        if (!action) return;
        if (action.dataset.drawerAction === 'pay') openPayment(memberId, () => { drawer.close(); openDetails(memberId); });
        if (action.dataset.drawerAction === 'leave') openLeave(memberId, data.member.full_name, String(data.member.join_date).slice(0, 10), drawer.close);
    });
}

// =====================================================================
//  Record payment
// =====================================================================

async function openPayment(memberId, afterSaved) {
    let data;
    try {
        data = await Api.get('/manager/members/' + memberId);
    } catch (error) {
        Ui.toast(error.message, 'error');
        return;
    }

    // the dues that still need money, the oldest first
    const open = data.dues.filter((due) => Number(due.remaining) > 0).reverse();
    const options = open
        .map((due) => `<option value="${due.due_id}" data-remaining="${Number(due.remaining)}">${monthText(due.due_month)}: ${Ui.money(due.remaining)} left of ${Ui.money(due.amount)}</option>`)
        .join('') + '<option value="" data-remaining="">Advance (not for a month)</option>';
    const first = open[0];

    const box = Ui.modal({
        title: 'Record payment',
        bodyHtml: `
            <form novalidate class="space-y-4">
                <p class="text-sm text-ink-soft">${Ui.escape(data.member.full_name)}, room ${Ui.escape(data.member.room_no)}-${Ui.escape(data.member.seat_label)}</p>
                <div>
                    <label for="field-due_id" class="mb-1 block text-sm font-medium">Payment for</label>
                    <select id="field-due_id" name="due_id" class="${inputClass}">${options}</select>
                </div>
                <div class="grid gap-4 sm:grid-cols-2">
                    ${fieldHtml({ name: 'amount', label: 'Amount (৳)', value: first ? Number(first.remaining) : '', type: 'number', extra: 'min="1"' })}
                    ${methodSelectHtml('method')}
                </div>
                ${fieldHtml({ name: 'paid_date', label: 'Date', value: dayText(), type: 'date', extra: `max="${dayText()}"` })}
                <p data-form-message class="hidden text-sm text-red-700"></p>
                <div class="flex justify-end gap-2">
                    <button type="button" data-close class="${secondaryButton}">Cancel</button>
                    <button type="submit" class="${primaryButton}">Save payment</button>
                </div>
            </form>`,
    });

    const form = box.element.querySelector('form');
    // choosing another due fills its remaining money
    form.elements.due_id.addEventListener('change', () => {
        const remaining = form.elements.due_id.selectedOptions[0].dataset.remaining;
        form.elements.amount.value = remaining;
    });

    form.addEventListener('submit', async (event) => {
        event.preventDefault();
        Ui.clearFieldErrors(form);
        const message = form.querySelector('[data-form-message]');
        message.classList.add('hidden');

        const amount = Number(form.elements.amount.value);
        const remaining = form.elements.due_id.selectedOptions[0].dataset.remaining;
        let ok = true;
        if (form.elements.amount.value === '' || !(amount >= 1)) {
            Ui.showFieldError(form, 'amount', 'Write an amount of at least ৳1.');
            ok = false;
        } else if (remaining !== '' && amount > Number(remaining)) {
            Ui.showFieldError(form, 'amount', `This month has only ${Ui.money(remaining)} left to pay.`);
            ok = false;
        }
        const paidDate = form.elements.paid_date.value;
        if (paidDate === '' || paidDate > dayText()) {
            Ui.showFieldError(form, 'paid_date', 'Choose a date that is not in the future.');
            ok = false;
        }
        if (!ok) return;

        const body = { member_id: memberId, amount, method: form.elements.method.value };
        if (form.elements.due_id.value !== '') body.due_id = Number(form.elements.due_id.value);
        if (paidDate !== dayText()) body.paid_at = paidDate + ' 12:00';     // today: the backend uses the time now

        const button = form.querySelector('button[type=submit]');
        Ui.setLoading(button, true, 'Saving');
        try {
            await Api.post('/manager/payments', body);
            Ui.toast('The payment is saved');
            box.close();
            if (afterSaved) afterSaved();
            loadMembers();
        } catch (error) {
            message.textContent = error.message;       // for example: more than the due
            message.classList.remove('hidden');
            Ui.setLoading(button, false);
        }
    });
}

// =====================================================================
//  Mark left
// =====================================================================

function openLeave(memberId, name, joinDate, afterLeft) {
    const box = Ui.modal({
        title: 'Mark as left',
        bodyHtml: `
            <form novalidate class="space-y-4">
                <p class="text-sm text-ink-soft"><strong class="text-ink">${Ui.escape(name)}</strong> will leave the seat and the seat becomes free.</p>
                ${fieldHtml({ name: 'leave_date', label: 'Leave date', value: dayText(), type: 'date', extra: `min="${Ui.escape(joinDate)}"` })}
                <p class="rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-800"><i class="fa-solid fa-triangle-exclamation mr-2"></i>The rent of this month stays due in full. Money that is not paid is not removed.</p>
                <p data-form-message class="hidden text-sm text-red-700"></p>
                <div class="flex justify-end gap-2">
                    <button type="button" data-close class="${secondaryButton}">Cancel</button>
                    <button type="submit" class="h-10 rounded-lg bg-red-600 px-5 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-70">Mark left</button>
                </div>
            </form>`,
    });

    const form = box.element.querySelector('form');
    form.addEventListener('submit', async (event) => {
        event.preventDefault();
        Ui.clearFieldErrors(form);
        const message = form.querySelector('[data-form-message]');
        message.classList.add('hidden');

        const leaveDate = form.elements.leave_date.value;
        if (leaveDate === '' || leaveDate < joinDate) {
            Ui.showFieldError(form, 'leave_date', 'The leave date cannot be before the join date (' + Ui.date(joinDate) + ').');
            return;
        }
        const button = form.querySelector('button[type=submit]');
        Ui.setLoading(button, true, 'Saving');
        try {
            await Api.patch(`/manager/members/${memberId}/leave`, { leave_date: leaveDate });
            Ui.toast('The member is marked as left');
            box.close();
            if (afterLeft) afterLeft();
            exLoaded = false;
            loadMembers();
        } catch (error) {
            message.textContent = error.message;
            message.classList.remove('hidden');
            Ui.setLoading(button, false);
        }
    });
}

// =====================================================================
//  Add member (drawer)
// =====================================================================

async function openAddMember(wantedSeatId) {
    let roomsAnswer;
    let mess;
    try {
        [roomsAnswer, mess] = await Promise.all([Api.get('/manager/rooms-seats'), Api.get('/manager/mess')]);
    } catch (error) {
        Ui.toast(error.status === 404 ? 'Create your mess first.' : error.message, 'error');
        return;
    }

    // only free seats of active rooms can be given
    const freeSeats = [];
    const seatOptions = roomsAnswer.rooms
        .filter((room) => room.is_active)
        .map((room) => {
            const seats = room.seats.filter((seat) => seat.status === 'available');
            seats.forEach((seat) => freeSeats.push(seat));
            if (seats.length === 0) return '';
            return `<optgroup label="Room ${Ui.escape(room.room_no)}">${seats
                .map((seat) => `<option value="${seat.seat_id}" data-rent="${Number(seat.monthly_rent)}" ${seat.seat_id === wantedSeatId ? 'selected' : ''}>Room ${Ui.escape(room.room_no)}, seat ${Ui.escape(seat.seat_label)} (${Ui.money(seat.monthly_rent)})</option>`)
                .join('')}</optgroup>`;
        })
        .join('');

    if (freeSeats.length === 0) {
        Ui.drawer({
            title: 'Add member',
            bodyHtml: Ui.empty({
                icon: 'fa-solid fa-bed',
                title: 'No free seat',
                text: 'Every seat is taken or switched off. Add a seat in Mess setup, or mark a member as left.',
                buttonHtml: `<a href="${SITE_ROOT}pages/manager/mess-setup.html#rooms" class="inline-flex h-10 items-center rounded-lg bg-espresso px-5 text-sm font-medium text-white hover:bg-espresso-hover">Go to Mess setup</a>`,
            }),
        });
        return;
    }

    const wanted = freeSeats.find((seat) => seat.seat_id === wantedSeatId);
    const firstSeat = wanted || freeSeats[0];

    const drawer = Ui.drawer({
        title: 'Add member',
        bodyHtml: `
            <form novalidate class="space-y-4">
                <div>
                    <label for="field-seat_id" class="mb-1 block text-sm font-medium">Seat</label>
                    <select id="field-seat_id" name="seat_id" class="${inputClass}">${seatOptions}</select>
                    <p data-error-for="seat_id" class="mt-1 text-xs text-red-600"></p>
                </div>

                <div class="rounded-lg border border-line p-3">
                    <p class="text-sm font-medium">Link a student account <span class="font-normal text-ink-soft">(optional)</span></p>
                    <p class="mb-2 text-xs text-ink-soft">If the person has an account, the member can see the rent in My mess. Search by name, email or phone (at least 3 letters).</p>
                    <div id="student-chosen"></div>
                    <div id="student-search" class="flex gap-2">
                        <input id="student-query" type="search" placeholder="Search a student" aria-label="Search a student" class="${inputClass}">
                        <button type="button" id="student-search-button" class="h-11 shrink-0 ${secondaryButton}">Search</button>
                    </div>
                    <div id="student-results" class="mt-2 space-y-1"></div>
                </div>

                <div id="person-fields" class="space-y-4">
                    ${fieldHtml({ name: 'full_name', label: 'Full name', maxlength: 100 })}
                    <div class="grid gap-4 sm:grid-cols-2">
                        ${fieldHtml({ name: 'phone', label: 'Phone', type: 'tel', placeholder: '01712345678' })}
                        <div>
                            <label for="field-gender" class="mb-1 block text-sm font-medium">Gender</label>
                            <select id="field-gender" name="gender" class="${inputClass}">
                                <option value="">Choose</option>
                                <option value="male" ${mess.mess_type === 'boys' ? 'selected' : ''}>Male</option>
                                <option value="female" ${mess.mess_type === 'girls' ? 'selected' : ''}>Female</option>
                            </select>
                            <p data-error-for="gender" class="mt-1 text-xs text-red-600"></p>
                        </div>
                    </div>
                </div>

                ${fieldHtml({ name: 'occupation', label: 'Occupation <span class="font-normal text-ink-soft">(optional)</span>', maxlength: 100, placeholder: 'Student, job...' })}
                <div class="grid gap-4 sm:grid-cols-2">
                    ${fieldHtml({ name: 'monthly_rent', label: 'Monthly rent (৳)', value: Number(firstSeat.monthly_rent), type: 'number', extra: 'min="1" max="1000000"', help: 'Filled from the seat. You can change it for this member.' })}
                    ${fieldHtml({ name: 'advance_amount', label: 'Advance paid (৳)', value: Number(mess.advance_amount), type: 'number', extra: 'min="0"', help: 'Write 0 if no advance is paid now.' })}
                </div>
                <div class="grid gap-4 sm:grid-cols-2">
                    ${methodSelectHtml('payment_method')}
                    ${fieldHtml({ name: 'join_date', label: 'Join date', value: dayText(), type: 'date', extra: `min="${dayText(-365)}" max="${dayText(60)}"` })}
                </div>

                <p data-form-message class="hidden text-sm text-red-700"></p>
                <div class="flex justify-end gap-2 pb-2">
                    <button type="button" data-close class="${secondaryButton}">Cancel</button>
                    <button type="submit" class="${primaryButton}">Add member</button>
                </div>
            </form>`,
    });

    const form = drawer.element.querySelector('form');
    let chosenStudent = null;
    let foundStudents = [];

    // choosing another seat fills its rent
    form.elements.seat_id.addEventListener('change', () => {
        form.elements.monthly_rent.value = form.elements.seat_id.selectedOptions[0].dataset.rent;
    });

    // ----- the student account -----
    const chosenBox = form.querySelector('#student-chosen');
    const searchBox = form.querySelector('#student-search');
    const resultsBox = form.querySelector('#student-results');
    const personFields = form.querySelector('#person-fields');

    function showChosenStudent() {
        resultsBox.innerHTML = '';
        personFields.classList.toggle('hidden', chosenStudent !== null);      // name, phone and gender come from the account
        searchBox.classList.toggle('hidden', chosenStudent !== null);
        chosenBox.innerHTML = chosenStudent === null ? '' : `
            <div class="flex items-center justify-between gap-2 rounded-lg bg-ochre-soft px-3 py-2 text-sm">
                <span class="min-w-0 truncate"><i class="fa-solid fa-user mr-2 text-ochre"></i>${Ui.escape(chosenStudent.full_name)} <span class="text-ink-soft">${Ui.escape(chosenStudent.phone)}</span></span>
                <button type="button" id="student-remove" class="shrink-0 text-sm font-medium text-link hover:underline">Remove</button>
            </div>`;
    }

    async function searchStudents() {
        const word = form.querySelector('#student-query').value.trim();
        if (word.length < 3) {
            resultsBox.innerHTML = '<p class="text-sm text-red-700">Write at least 3 letters.</p>';
            return;
        }
        resultsBox.innerHTML = Ui.skeleton(1, 'h-10');
        try {
            foundStudents = await Api.get('/manager/students/search', { q: word });
            resultsBox.innerHTML = foundStudents.length === 0
                ? '<p class="text-sm text-ink-soft">No student found.</p>'
                : foundStudents.map((student) => {
                    // a student of the other gender or one who already lives in a mess cannot be added
                    const problem = !student.gender_ok ? 'Gender does not fit this mess' : student.already_in_a_mess ? 'Already lives in a mess' : '';
                    return `
                        <button type="button" data-student-id="${student.user_id}" ${problem ? 'disabled' : ''}
                            class="flex w-full items-center justify-between gap-2 rounded-lg border border-line px-3 py-2 text-left text-sm ${problem ? 'cursor-not-allowed opacity-60' : 'hover:bg-page'}">
                            <span class="min-w-0 truncate font-medium">${Ui.escape(student.full_name)} <span class="font-normal text-ink-soft">${Ui.escape(student.email)}</span></span>
                            <span class="shrink-0 text-xs ${problem ? 'text-red-700' : 'text-ink-soft'}">${problem || Ui.escape(student.university)}</span>
                        </button>`;
                }).join('');
        } catch (error) {
            resultsBox.innerHTML = `<p class="text-sm text-red-700">${Ui.escape(error.message)}</p>`;
        }
    }

    form.addEventListener('click', (event) => {
        if (event.target.closest('#student-search-button')) searchStudents();
        if (event.target.closest('#student-remove')) { chosenStudent = null; showChosenStudent(); }
        const pick = event.target.closest('[data-student-id]');
        if (pick && !pick.disabled) {
            chosenStudent = foundStudents.find((student) => String(student.user_id) === pick.dataset.studentId);
            showChosenStudent();
        }
    });
    form.addEventListener('keydown', (event) => {
        if (event.key === 'Enter' && event.target.id === 'student-query') {
            event.preventDefault();
            searchStudents();
        }
    });

    // ----- save -----
    form.addEventListener('submit', async (event) => {
        event.preventDefault();
        Ui.clearFieldErrors(form);
        const message = form.querySelector('[data-form-message]');
        message.classList.add('hidden');

        let ok = true;
        const fail = (name, text) => { Ui.showFieldError(form, name, text); ok = false; };
        const value = (name) => form.elements[name].value.trim();

        const body = {
            seat_id: Number(value('seat_id')),
            monthly_rent: Number(value('monthly_rent')),
            advance_amount: value('advance_amount') === '' ? 0 : Number(value('advance_amount')),
            payment_method: value('payment_method'),
            join_date: value('join_date'),
        };
        if (value('occupation') !== '') body.occupation = value('occupation');

        if (chosenStudent) {
            body.student_id = chosenStudent.user_id;
        } else {
            body.full_name = value('full_name');
            body.phone = value('phone');
            body.gender = value('gender');
            if (body.full_name.length < 2) fail('full_name', 'Please write the name of the member.');
            if (!/^(?:\+?88)?(01[3-9]\d{8})$/.test(body.phone.replace(/[\s-]/g, ''))) fail('phone', 'Write a mobile number like 01712345678.');
            if (body.gender === '') fail('gender', 'Please choose the gender.');
        }
        if (!(body.monthly_rent >= 1 && body.monthly_rent <= 1000000)) fail('monthly_rent', 'The rent is a number from 1 to 1,000,000.');
        if (!(body.advance_amount >= 0)) fail('advance_amount', 'The advance cannot be less than 0.');
        if (body.join_date === '' || body.join_date < dayText(-365) || body.join_date > dayText(60)) {
            fail('join_date', 'The join date must be within the last year or the next 60 days.');
        }
        if (!ok) return;

        const button = form.querySelector('button[type=submit]');
        Ui.setLoading(button, true, 'Saving');
        try {
            await Api.post('/manager/members', body);
            Ui.toast('The member is added and the first rent due is made');
            drawer.close();
            currentPage = 1;
            loadMembers();
        } catch (error) {
            message.textContent = error.message;       // for example: the mess is not verified yet
            message.classList.remove('hidden');
            Ui.setLoading(button, false);
        }
    });
}

// =====================================================================
//  Start
// =====================================================================

showTab('active');
loadMembers();

// a form asked for by the address (from the Dashboard or the Room-wise seats page)
const params = new URLSearchParams(location.search);
if (params.get('member_id')) openDetails(Number(params.get('member_id')));
else if (params.get('seat_id')) openAddMember(Number(params.get('seat_id')));
else if (params.get('add')) openAddMember();
