// The My mess page of a student. It only has something to show when a manager has linked
// the account of the student to a member: the room and seat, the rent, the dues month by month
// and the payments. Without a link the page says "You are not in a mess yet".

Layout.start({ active: 'my-mess', title: 'My mess', roles: ['student'] });

const content = document.getElementById('content');

// ---------- small helpers ----------

// "2026-11-01" -> "Nov 2026"
function monthLabel(text) {
    const day = new Date(String(text).slice(0, 10) + 'T00:00:00');
    return isNaN(day) ? text : day.toLocaleDateString('en-GB', { month: 'short', year: 'numeric' });
}

// "bkash" -> "Bkash", "monthly" -> "Monthly"
function capital(word) {
    return word ? word.charAt(0).toUpperCase() + word.slice(1) : '';
}

// A box with a small title and a big value
function summaryCard(label, valueHtml, noteHtml = '') {
    return `
        <div class="rounded-xl border border-line bg-white p-4">
            <p class="text-sm text-ink-soft">${label}</p>
            <div class="mt-1 text-xl font-semibold">${valueHtml}</div>
            ${noteHtml ? `<p class="mt-1 text-xs text-ink-soft">${noteHtml}</p>` : ''}
        </div>`;
}

// ---------- the parts of the page ----------

function messCardHtml(member) {
    const button = 'inline-flex h-10 items-center justify-center gap-2 rounded-lg border border-line bg-white px-4 text-sm font-medium hover:bg-page';
    return `
        <section class="rounded-xl border border-line bg-white p-5">
            <div class="flex items-start gap-3">
                <span class="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-ochre-soft text-xl text-ochre"><i class="fa-solid fa-house"></i></span>
                <div class="min-w-0">
                    <h2 class="text-lg font-semibold"><a href="${SITE_ROOT}pages/mess-details.html?id=${member.mess_id}" class="hover:underline">${Ui.escape(member.mess_name)}</a></h2>
                    <p class="text-sm text-ink-soft">Room ${Ui.escape(member.room_no)}, seat ${Ui.escape(member.seat_label)} &middot; joined on ${Ui.date(member.join_date)}</p>
                </div>
            </div>
            <dl class="mt-4 grid gap-3 sm:grid-cols-2">
                <div><dt class="text-sm text-ink-soft">Rent per month</dt><dd class="font-semibold">${Ui.money(member.monthly_rent)}</dd></div>
                <div><dt class="text-sm text-ink-soft">Advance paid</dt><dd class="font-semibold">${Ui.money(member.advance_amount)}</dd></div>
            </dl>
            <div class="mt-4 flex flex-wrap gap-2">
                <button type="button" id="chat-button" class="inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-espresso px-4 text-sm font-medium text-white hover:bg-espresso-hover disabled:opacity-70"><i class="fa-solid fa-comments"></i> Chat with the manager</button>
                <a href="tel:+${Ui.escape(member.contact_phone)}" class="${button}"><i class="fa-solid fa-phone"></i> Call</a>
                <a href="${SITE_ROOT}pages/mess-details.html?id=${member.mess_id}#reviews" class="${button}"><i class="fa-regular fa-star"></i> Write a review</a>
            </div>
        </section>`;
}

function summaryHtml(dues, payments) {
    const status = dues.current_month_status
        ? Ui.statusBadge(dues.current_month_status)
        : '<span class="text-base font-medium text-ink-soft">No due yet</span>';
    const owed = Number(dues.outstanding);
    const last = payments[0];
    return `
        <div class="grid gap-3 sm:grid-cols-3">
            ${summaryCard('This month', status)}
            ${summaryCard('Total due', `<span class="${owed > 0 ? 'text-red-700' : ''}">${Ui.money(owed)}</span>`, owed > 0 ? 'Please pay it to the manager.' : 'You have nothing to pay.')}
            ${summaryCard('Last payment', last ? Ui.money(last.amount) : '<span class="text-base font-medium text-ink-soft">None yet</span>', last ? Ui.date(last.paid_at) : '')}
        </div>`;
}

function duesTableHtml(dues) {
    if (dues.length === 0) {
        return '<p class="text-sm text-ink-soft">No rent has been added yet.</p>';
    }
    const rows = dues.map((due) => `
        <tr class="border-t border-line">
            <td class="whitespace-nowrap px-2 py-2.5 font-medium sm:px-3">${monthLabel(due.due_month)}</td>
            <td class="px-2 py-2.5 text-right sm:px-3">${Ui.money(due.amount)}</td>
            <td class="px-2 py-2.5 text-right sm:px-3">${Ui.money(due.paid)}</td>
            <td class="px-2 py-2.5 text-right font-medium sm:px-3 ${Number(due.remaining) > 0 ? 'text-red-700' : ''}">${Ui.money(due.remaining)}</td>
            <td class="px-2 py-2.5 sm:px-3">${Ui.statusBadge(due.status)}</td>
        </tr>`).join('');
    return `
        <div class="overflow-x-auto">
            <table class="w-full text-xs sm:text-sm">
                <thead class="bg-slate-50 text-left text-xs uppercase text-ink-soft">
                    <tr><th class="px-2 py-2 sm:px-3">Month</th><th class="px-2 py-2 text-right sm:px-3">Rent</th><th class="px-2 py-2 text-right sm:px-3">Paid</th><th class="px-2 py-2 text-right sm:px-3">Left</th><th class="px-2 py-2 sm:px-3">Status</th></tr>
                </thead>
                <tbody>${rows}</tbody>
            </table>
        </div>`;
}

function paymentsHtml(payments) {
    if (payments.length === 0) {
        return '<p class="text-sm text-ink-soft">You have not paid anything through the manager yet.</p>';
    }
    return payments.map((payment) => `
        <div class="flex items-center justify-between gap-3 border-t border-line py-2.5 first:border-0">
            <div class="min-w-0">
                <p class="text-sm font-medium">${Ui.money(payment.amount)} <span class="font-normal text-ink-soft">&middot; ${capital(payment.payment_type)}${payment.due_month ? ' for ' + monthLabel(payment.due_month) : ''}</span></p>
                <p class="truncate text-xs text-ink-soft">${Ui.escape(payment.mess_name)} &middot; ${capital(payment.method)}</p>
            </div>
            <span class="shrink-0 text-xs text-ink-soft">${Ui.date(payment.paid_at)}</span>
        </div>`).join('');
}

function sectionHtml(title, innerHtml) {
    return `<section class="rounded-xl border border-line bg-white p-5"><h2 class="mb-3 font-semibold">${title}</h2>${innerHtml}</section>`;
}

// ---------- loading ----------

async function startChat(button, messId) {
    Ui.setLoading(button, true, 'Opening');
    try {
        const chat = await Api.post('/conversations', { mess_id: messId });
        location.href = SITE_ROOT + 'pages/chat.html?id=' + chat.conversation_id;
    } catch (error) {
        Ui.toast(error.message, 'error');
        Ui.setLoading(button, false);
    }
}

async function loadPage() {
    content.innerHTML = Ui.skeleton(1, 'h-40') + Ui.skeleton(1, 'h-24') + Ui.skeleton(1, 'h-56');
    try {
        const [membership, dues, payments] = await Promise.all([
            Api.get('/me/membership'),
            Api.get('/me/dues'),
            Api.get('/me/payments'),
        ]);

        // not linked to a member: the page is empty (old payments, if any, are still shown)
        if (membership.membership === null) {
            content.innerHTML = Ui.empty({
                icon: 'fa-solid fa-house-circle-xmark',
                title: "You're not in a mess yet",
                text: 'When a manager adds you as a member, your seat, rent and payments will show up here.',
                buttonHtml: `<a href="${SITE_ROOT}pages/browse.html" class="inline-flex h-10 items-center rounded-lg bg-espresso px-4 text-sm font-medium text-white hover:bg-espresso-hover">Browse messes</a>`,
            }) + (payments.length > 0 ? sectionHtml('Your payments', paymentsHtml(payments)) : '');
            return;
        }

        const member = membership.membership;
        content.innerHTML = messCardHtml(member)
            + summaryHtml(dues, payments)
            + '<div class="grid gap-4 lg:grid-cols-2 lg:items-start">'
            + sectionHtml('Monthly rent', duesTableHtml(dues.dues))
            + sectionHtml('Your payments', paymentsHtml(payments))
            + '</div>';
        document.getElementById('chat-button').addEventListener('click', (event) => startChat(event.currentTarget, member.mess_id));
    } catch (error) {
        content.innerHTML = '';
        content.appendChild(Ui.errorBanner(error.message, loadPage));
    }
}

loadPage();
