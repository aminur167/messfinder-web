// The Interested page of a student: the messes he marked with the heart.
// Each one is the same card as on the Browse page, with the day he marked it and three buttons:
// Chat, View and Remove. The heart on the card also removes the mess from the list.

Layout.start({ active: 'interested', title: 'Interested messes', roles: ['student'] });

const list = document.getElementById('list');
const title = document.getElementById('title');

// ---------- one card ----------

function itemHtml(item) {
    // the card shows a filled heart, because every mess on this page is interested
    const card = MessCard.html({ ...item, is_interested: true });
    return `
        <div data-mess-id="${item.mess_id}" data-conversation-id="${item.conversation_id || ''}" class="flex flex-col gap-2">
            ${card}
            <p class="px-1 text-xs text-ink-soft"><i class="fa-regular fa-clock mr-1.5"></i>Interested on ${Ui.date(item.interested_at)}</p>
            <div class="flex gap-2">
                <button type="button" data-chat class="inline-flex h-10 flex-1 items-center justify-center gap-2 rounded-lg bg-espresso px-3 text-sm font-medium text-white hover:bg-espresso-hover disabled:opacity-70">
                    <i class="fa-solid fa-comments"></i> Chat
                </button>
                <a href="${SITE_ROOT}pages/mess-details.html?id=${item.mess_id}" class="inline-flex h-10 items-center justify-center gap-2 rounded-lg border border-line bg-white px-3 text-sm font-medium hover:bg-page">View</a>
                <button type="button" data-remove class="inline-flex h-10 items-center justify-center gap-2 rounded-lg border border-line bg-white px-3 text-sm font-medium hover:bg-page disabled:opacity-70">Remove</button>
            </div>
        </div>`;
}

function emptyHtml() {
    return `<div class="sm:col-span-2 lg:col-span-3">${Ui.empty({
        icon: 'fa-regular fa-heart',
        title: 'No messes yet',
        text: 'Press Interested on a mess you like.',
        buttonHtml: `<a href="${SITE_ROOT}pages/browse.html" class="inline-flex h-10 items-center rounded-lg bg-espresso px-4 text-sm font-medium text-white hover:bg-espresso-hover">Browse messes</a>`,
    })}</div>`;
}

function showCount(count) {
    title.textContent = count > 0 ? `Interested messes (${count})` : 'Interested messes';
}

// ---------- loading ----------

async function loadList() {
    list.innerHTML = MessCard.skeleton().repeat(3);
    try {
        const items = await Api.get('/interests/my');
        showCount(items.length);
        list.innerHTML = items.length === 0 ? emptyHtml() : items.map(itemHtml).join('');
    } catch (error) {
        list.innerHTML = '';
        const banner = Ui.errorBanner(error.message, loadList);
        banner.classList.add('sm:col-span-2', 'lg:col-span-3');
        list.appendChild(banner);
    }
}

// ---------- the buttons ----------

// Takes the mess off the list (the heart of the card does the same)
async function removeMess(item, button) {
    button.disabled = true;
    try {
        const result = await Api.post('/interests/toggle', { mess_id: Number(item.dataset.messId) });
        if (result.is_interested) {
            // it was already gone (for example removed in another tab) and is added again: show the real list
            await loadList();
            return;
        }
        item.remove();
        const left = list.querySelectorAll('[data-mess-id]').length;
        showCount(left);
        if (left === 0) list.innerHTML = emptyHtml();
        Ui.toast('Removed from your interested list');
    } catch (error) {
        Ui.toast(error.message, 'error');
        button.disabled = false;
    }
}

// Chat: the chat of this mess if there is one, else a new one is opened first
async function openChat(item, button) {
    if (item.dataset.conversationId) {
        location.href = SITE_ROOT + 'pages/chat.html?id=' + item.dataset.conversationId;
        return;
    }
    Ui.setLoading(button, true, 'Opening');
    try {
        const chat = await Api.post('/conversations', { mess_id: Number(item.dataset.messId) });
        location.href = SITE_ROOT + 'pages/chat.html?id=' + chat.conversation_id;
    } catch (error) {
        Ui.toast(error.message, 'error');
        Ui.setLoading(button, false);
    }
}

// One listener for all the cards
list.addEventListener('click', (event) => {
    const item = event.target.closest('[data-mess-id]');
    if (!item) return;
    if (event.target.closest('[data-remove]')) removeMess(item, event.target.closest('[data-remove]'));
    else if (event.target.closest('[data-heart]')) removeMess(item, event.target.closest('[data-heart]'));
    else if (event.target.closest('[data-chat]')) openChat(item, event.target.closest('[data-chat]'));
});

loadList();
