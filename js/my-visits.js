// The My visits page of a student: the visit requests he sent, with the answer of the manager.
// A request that is pending or confirmed (and still in the future) can be cancelled.

Layout.start({ active: 'my-visits', title: 'My visits', roles: ['student'] });

const list = document.getElementById('list');

function visitHtml(visit) {
    const note = visit.student_note
        ? `<p class="mt-2 whitespace-pre-line break-words text-sm text-ink-soft"><i class="fa-regular fa-note-sticky mr-1.5"></i>${Ui.escape(visit.student_note)}</p>` : '';
    const cancel = Number(visit.can_cancel) === 1
        ? `<div class="mt-3 text-right"><button type="button" data-cancel="${visit.visit_id}" class="h-10 rounded-lg border border-line bg-white px-4 text-sm font-medium hover:bg-page">Cancel request</button></div>` : '';
    return `
        <article class="rounded-xl border border-line bg-white p-4 shadow-sm">
            <div class="flex items-start justify-between gap-3">
                <div class="min-w-0">
                    <h2 class="truncate font-semibold"><a href="${SITE_ROOT}pages/mess-details.html?id=${visit.mess_id}" class="hover:underline">${Ui.escape(visit.mess_name)}</a></h2>
                    <p class="text-sm text-ink-soft"><i class="fa-solid fa-location-dot mr-1.5 text-ochre"></i>${Ui.escape(visit.area_name)}</p>
                </div>
                ${Ui.statusBadge(visit.status)}
            </div>
            <p class="mt-2 text-sm"><i class="fa-regular fa-calendar-check mr-1.5 text-ochre"></i>${Ui.dateTime(visit.visit_time)}</p>
            ${note}
            <p class="mt-2 text-xs text-ink-soft">Sent ${Ui.timeAgo(visit.created_at)}</p>
            ${cancel}
        </article>`;
}

async function loadList() {
    list.innerHTML = Ui.skeleton(3, 'h-28');
    try {
        const visits = await Api.get('/visits/my');
        if (visits.length === 0) {
            list.innerHTML = Ui.empty({
                icon: 'fa-regular fa-calendar',
                title: 'No visit requests yet',
                text: 'Open a mess you like and press Request visit.',
                buttonHtml: `<a href="${SITE_ROOT}pages/browse.html" class="inline-flex h-10 items-center rounded-lg bg-espresso px-4 text-sm font-medium text-white hover:bg-espresso-hover">Browse messes</a>`,
            });
            return;
        }
        list.innerHTML = '<div class="grid gap-3 lg:grid-cols-2 lg:items-start">' + visits.map(visitHtml).join('') + '</div>';
    } catch (error) {
        list.innerHTML = '';
        list.appendChild(Ui.errorBanner(error.message, loadList));
    }
}

list.addEventListener('click', async (event) => {
    const button = event.target.closest('[data-cancel]');
    if (!button) return;

    const confirmed = await Ui.confirm({
        title: 'Cancel visit request',
        message: 'The manager will not expect you at that time. Do you want to cancel?',
        confirmText: 'Cancel request',
        danger: true,
    });
    if (!confirmed) return;

    Ui.setLoading(button, true, 'Cancelling');
    try {
        await Api.patch(`/visits/${button.dataset.cancel}/cancel`);
        Ui.toast('Your visit request is cancelled');
        loadList();
    } catch (error) {
        Ui.toast(error.message, 'error');
        Ui.setLoading(button, false);
    }
});

loadList();
