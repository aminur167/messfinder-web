// Moderation: the admin takes down posts and comments that break the rules.
// Three tabs: Vacancy posts, Seat wanted posts and Comments. Nothing is deleted (soft delete):
// a removed post gets the status "removed" and a removed comment is hidden.
// Lists: GET /admin/posts?type=&status=&page= and GET /admin/comments?page= (20 on a page).
// Remove: PATCH /admin/posts/:type/:id/remove and DELETE /comments/:id.

Layout.start({ active: 'moderation', title: 'Moderation', roles: ['admin'] });

const pageBox = document.getElementById('admin-page');

const tabs = [['vacancy', 'Vacancy posts'], ['wanted', 'Seat wanted posts'], ['comments', 'Comments']];
const dangerButton = 'h-9 rounded-lg border border-red-200 bg-white px-3 text-sm font-medium text-red-700 hover:bg-red-50 disabled:opacity-60';

let currentTab = 'vacancy';
let postStatus = '';
let currentPage = 1;

pageBox.innerHTML = `
    <div>
        <h2 class="text-lg font-semibold">Moderation</h2>
        <p class="text-sm text-ink-soft">Remove a post or a comment that breaks the rules. It is hidden, not deleted.</p>
    </div>
    <div id="tabs" class="hide-scrollbar flex gap-1 overflow-x-auto border-b border-line" role="tablist"></div>
    <div id="toolbar"></div>
    <div id="list"></div>
    <div id="pagination"></div>`;

const tabsBox = document.getElementById('tabs');
const toolbar = document.getElementById('toolbar');
const listBox = document.getElementById('list');
const pagesBox = document.getElementById('pagination');

function renderTabs() {
    tabsBox.innerHTML = tabs.map(([key, label]) => {
        const on = key === currentTab;
        return `<button type="button" data-tab="${key}" role="tab" class="h-11 shrink-0 border-b-2 px-4 text-sm font-medium ${on ? 'border-ochre text-ink' : 'border-transparent text-ink-soft'}">${label}</button>`;
    }).join('');
    // only the post tabs have a status filter
    toolbar.innerHTML = currentTab === 'comments' ? '' : `
        <select id="status-filter" aria-label="Status" class="h-11 rounded-lg border border-line bg-white px-3 text-sm focus:border-ochre focus:outline-none focus:ring-2 focus:ring-ochre/40">
            <option value="">All statuses</option>
            ${['open', 'closed', 'expired', 'removed'].map((value) => `<option value="${value}" ${postStatus === value ? 'selected' : ''}>${value.charAt(0).toUpperCase() + value.slice(1)}</option>`).join('')}
        </select>`;
}

tabsBox.addEventListener('click', (event) => {
    const tab = event.target.closest('[data-tab]');
    if (!tab || tab.dataset.tab === currentTab) return;
    currentTab = tab.dataset.tab;
    currentPage = 1;
    renderTabs();
    loadList();
});
toolbar.addEventListener('change', (event) => {
    if (event.target.id !== 'status-filter') return;
    postStatus = event.target.value;
    currentPage = 1;
    loadList();
});

// ---------- tables ----------

function tableHtml(headings, rows) {
    return `
        <div class="overflow-x-auto rounded-xl border border-line bg-white shadow-sm">
            <table class="w-full text-left text-sm">
                <thead class="bg-slate-50 text-xs text-ink-soft"><tr>${headings.map((text) => `<th class="px-4 py-2.5 font-medium">${text}</th>`).join('')}</tr></thead>
                <tbody>${rows.join('')}</tbody>
            </table>
        </div>`;
}

function postRowHtml(post) {
    const action = post.status === 'removed'
        ? '<span class="text-xs text-ink-soft">Removed</span>'
        : `<button type="button" data-remove-post="${post.post_id}" data-title="${Ui.escape(post.title)}" class="${dangerButton}">Remove</button>`;
    return `
        <tr class="border-t border-line hover:bg-page/60">
            <td class="px-4 py-3">
                <span class="font-medium">${Ui.escape(post.title)}</span>
                <span class="block max-w-md truncate text-xs text-ink-soft">${Ui.escape(post.description)}</span>
            </td>
            <td class="px-4 py-3">${Ui.escape(post.author_name)}</td>
            <td class="whitespace-nowrap px-4 py-3">${Ui.statusBadge(post.status)}</td>
            <td class="whitespace-nowrap px-4 py-3">${post.comment_count}</td>
            <td class="whitespace-nowrap px-4 py-3">${Ui.date(post.created_at)}</td>
            <td class="whitespace-nowrap px-4 py-3 text-right">${action}</td>
        </tr>`;
}

function commentRowHtml(comment) {
    return `
        <tr class="border-t border-line hover:bg-page/60">
            <td class="px-4 py-3"><span class="line-clamp-3 break-words">${Ui.escape(comment.body)}</span></td>
            <td class="px-4 py-3">${Ui.escape(comment.full_name)} <span class="text-xs text-ink-soft">(${Ui.escape(comment.role)})</span></td>
            <td class="px-4 py-3"><span class="block max-w-xs truncate">${Ui.escape(comment.post_title)}</span><span class="text-xs text-ink-soft">${comment.post_type === 'vacancy' ? 'Vacancy post' : 'Seat wanted post'}</span></td>
            <td class="whitespace-nowrap px-4 py-3">${Ui.timeAgo(comment.created_at)}</td>
            <td class="whitespace-nowrap px-4 py-3 text-right"><button type="button" data-remove-comment="${comment.comment_id}" class="${dangerButton}">Remove</button></td>
        </tr>`;
}

async function loadList() {
    listBox.innerHTML = Ui.skeleton(4, 'h-14');
    try {
        const answer = currentTab === 'comments'
            ? await Api.get('/admin/comments', { page: currentPage, limit: 20 })
            : await Api.get('/admin/posts', { type: currentTab, status: postStatus, page: currentPage, limit: 20 });

        if (answer.data.length === 0) {
            listBox.innerHTML = Ui.empty({ icon: 'fa-regular fa-folder-open', title: 'Nothing to show', text: 'There is nothing in this list.' });
            pagesBox.innerHTML = '';
            return;
        }
        listBox.innerHTML = currentTab === 'comments'
            ? tableHtml(['Comment', 'Written by', 'On', 'When', ''], answer.data.map(commentRowHtml))
            : tableHtml(['Post', currentTab === 'vacancy' ? 'Mess' : 'Student', 'Status', 'Comments', 'Date', ''], answer.data.map(postRowHtml));
        Ui.renderPagination(pagesBox, answer.page, answer.total_pages, (page) => { currentPage = page; loadList(); });
    } catch (error) {
        pagesBox.innerHTML = '';
        listBox.innerHTML = '';
        listBox.appendChild(Ui.errorBanner(error.message, loadList));
    }
}

// ---------- remove ----------

listBox.addEventListener('click', async (event) => {
    const postButton = event.target.closest('[data-remove-post]');
    const commentButton = event.target.closest('[data-remove-comment]');
    if (!postButton && !commentButton) return;

    const sure = await Ui.confirm(postButton
        ? { title: 'Remove this post', message: `"${postButton.dataset.title}" will be hidden from the Newsfeed.`, confirmText: 'Remove', danger: true }
        : { title: 'Remove this comment', message: 'The comment will be hidden from everybody.', confirmText: 'Remove', danger: true });
    if (!sure) return;

    const button = postButton || commentButton;
    button.disabled = true;
    try {
        if (postButton) await Api.patch(`/admin/posts/${currentTab}/${postButton.dataset.removePost}/remove`);
        else await Api.delete(`/comments/${commentButton.dataset.removeComment}`);
        Ui.toast(postButton ? 'The post is removed' : 'The comment is removed');
    } catch (error) {
        Ui.toast(error.message, 'error');
    }
    loadList();
});

renderTabs();
loadList();
