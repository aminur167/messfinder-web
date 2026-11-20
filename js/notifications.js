// The Notifications page (every role). A list with the newest first. The ones that are not read yet have
// a light ochre background. Pressing a notification marks it as read. Filter: All or Unread.

Layout.start({ active: 'notifications', title: 'Notifications', login: true });

const listBox = document.getElementById('list');
const pagination = document.getElementById('pagination');
const readAllButton = document.getElementById('read-all');
const unreadCount = document.getElementById('unread-count');

let filter = 'all';          // 'all' or 'unread'
let currentPage = 1;
let lastRequest = 0;

// The backend sends only the text, so the icon is chosen from the words of the text
function iconFor(message) {
    const text = message.toLowerCase();
    if (text.includes('interested')) return 'fa-heart';
    if (text.includes('comment on')) return 'fa-comment';
    if (text.includes('message')) return 'fa-envelope';
    if (text.includes('visit')) return 'fa-calendar-check';
    if (text.includes('complaint')) return 'fa-flag';
    if (text.includes('review')) return 'fa-star';
    if (text.includes('payment') || text.includes('due')) return 'fa-money-bill-wave';
    if (text.includes('verification') || text.includes('verified') || text.includes('suspended')) return 'fa-shield-halved';
    if (text.includes('added to') || text.includes('marked as left')) return 'fa-house';
    return 'fa-bell';
}

function itemHtml(item) {
    const unread = !item.is_read;
    return `
        <button type="button" data-id="${item.notification_id}" data-unread="${unread ? '1' : '0'}"
            class="flex w-full items-start gap-3 border-b border-line px-4 py-3 text-left last:border-0 hover:bg-page ${unread ? 'bg-ochre-soft/60' : ''}">
            <span class="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${unread ? 'bg-ochre-soft text-ochre' : 'bg-page text-ink-soft'}">
                <i class="fa-solid ${iconFor(item.message)}"></i>
            </span>
            <span class="min-w-0 flex-1">
                <span class="block break-words text-sm ${unread ? 'font-medium' : ''}">${Ui.escape(item.message)}</span>
                <span class="mt-0.5 block text-xs text-ink-soft">${Ui.timeAgo(item.created_at)}</span>
            </span>
            ${unread ? '<span class="mt-2 h-2.5 w-2.5 shrink-0 rounded-full bg-ochre" aria-label="Unread"></span>' : ''}
        </button>`;
}

// the filter buttons, the number on "Unread" and the state of "Mark all as read"
function showControls(unread) {
    document.querySelectorAll('#tabs [data-filter]').forEach((tab) => {
        const on = tab.dataset.filter === filter;
        tab.classList.toggle('border-ochre', on);
        tab.classList.toggle('text-ink', on);
        tab.classList.toggle('border-transparent', !on);
        tab.classList.toggle('text-ink-soft', !on);
    });
    unreadCount.textContent = `(${unread})`;
    unreadCount.classList.toggle('hidden', unread === 0);
    readAllButton.disabled = unread === 0;
    Layout.setBellBadge(unread);
}

async function loadList() {
    const myNumber = ++lastRequest;
    listBox.innerHTML = Ui.skeleton(4, 'h-16');
    try {
        const answer = await Api.get('/notifications', { unread: filter === 'unread' ? 1 : '', page: currentPage, limit: 20 });
        if (myNumber !== lastRequest) return;

        showControls(answer.unread_count);
        if (answer.data.length === 0) {
            listBox.innerHTML = filter === 'unread'
                ? '<p class="px-6 py-12 text-center text-sm text-ink-soft"><i class="fa-regular fa-circle-check mb-2 block text-3xl text-ochre"></i>You have read everything.</p>'
                : '<p class="px-6 py-12 text-center text-sm text-ink-soft"><i class="fa-regular fa-bell mb-2 block text-3xl text-ochre"></i>No notifications yet.</p>';
            pagination.innerHTML = '';
            return;
        }
        listBox.innerHTML = answer.data.map(itemHtml).join('');
        Ui.renderPagination(pagination, answer.page, answer.total_pages, (number) => {
            currentPage = number;
            loadList();
            window.scrollTo({ top: 0 });
        });
    } catch (error) {
        if (myNumber !== lastRequest) return;
        listBox.innerHTML = '';
        const banner = Ui.errorBanner(error.message, loadList);
        banner.classList.add('m-3');
        listBox.appendChild(banner);
        pagination.innerHTML = '';
    }
}

// Pressing an unread notification makes it read (the row changes at once, the number follows)
listBox.addEventListener('click', async (event) => {
    const row = event.target.closest('[data-id]');
    if (!row || row.dataset.unread !== '1') return;
    row.dataset.unread = '0';
    try {
        await Api.patch(`/notifications/${row.dataset.id}/read`);
        loadList();
    } catch (error) {
        row.dataset.unread = '1';
        Ui.toast(error.message, 'error');
    }
});

readAllButton.addEventListener('click', async () => {
    Ui.setLoading(readAllButton, true, 'Please wait');
    try {
        await Api.patch('/notifications/read-all');
        Ui.setLoading(readAllButton, false);
        Ui.toast('All notifications are marked as read');
        loadList();                 // this also disables the button again, nothing is left to read
    } catch (error) {
        Ui.setLoading(readAllButton, false);
        Ui.toast(error.message, 'error');
    }
});

document.getElementById('tabs').addEventListener('click', (event) => {
    const tab = event.target.closest('[data-filter]');
    if (!tab || tab.dataset.filter === filter) return;
    filter = tab.dataset.filter;
    currentPage = 1;
    loadList();
});

loadList();
