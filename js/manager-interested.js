// Interested students of the manager: who pressed Interested on the mess or on a post.
// Chat opens the chat with the student (a new one is made if there is none), Call dials the phone.
// The list comes from GET /manager/interests, 20 students on a page.

Layout.start({ active: 'interested', title: 'Interested students', roles: ['manager'] });

const listBox = document.getElementById('list');
const pagesBox = document.getElementById('pagination');

const smallButton = 'inline-flex h-9 items-center rounded-lg border border-line bg-white px-3 text-sm font-medium hover:bg-page';

function rowHtml(item) {
    // the post he came from, or the page of the mess
    const from = item.post_title
        ? `<i class="fa-solid fa-bullhorn mr-1.5 text-ochre"></i>${Ui.escape(item.post_title)}`
        : '<i class="fa-solid fa-building mr-1.5 text-ochre"></i>Mess page';
    const chatAttribute = item.conversation_id ? `data-conversation-id="${item.conversation_id}"` : '';
    return `
        <tr class="border-t border-line hover:bg-page/60">
            <td class="px-4 py-3">
                <span class="font-medium">${Ui.escape(item.full_name)}</span>
                <span class="block text-xs text-ink-soft">${Ui.escape(item.phone)}</span>
            </td>
            <td class="whitespace-nowrap px-4 py-3">${Ui.escape(item.university)}</td>
            <td class="px-4 py-3">${Ui.escape(item.department) || '<span class="text-ink-soft">-</span>'}</td>
            <td class="whitespace-nowrap px-4 py-3">${item.gender === 'female' ? 'Female' : 'Male'}</td>
            <td class="px-4 py-3">${from}</td>
            <td class="whitespace-nowrap px-4 py-3">${Ui.date(item.interested_at)}</td>
            <td class="whitespace-nowrap px-4 py-3 text-right">
                <button type="button" data-chat-student="${item.student_id}" ${chatAttribute} class="${smallButton}"><i class="fa-regular fa-comments mr-1.5"></i>Chat</button>
                <a href="tel:${Ui.escape(item.phone)}" class="${smallButton}"><i class="fa-solid fa-phone mr-1.5"></i>Call</a>
            </td>
        </tr>`;
}

async function loadList(page = 1) {
    listBox.innerHTML = Ui.skeleton(4, 'h-14');
    try {
        const answer = await Api.get('/manager/interests', { page, limit: 20 });
        if (answer.data.length === 0) {
            listBox.innerHTML = Ui.empty({
                icon: 'fa-regular fa-heart',
                title: 'No one has shown interest yet.',
                text: 'Post about your free seats to reach more students.',
                buttonHtml: `<a href="${SITE_ROOT}pages/manager/posts.html" class="inline-flex h-10 items-center rounded-lg bg-espresso px-5 text-sm font-medium text-white hover:bg-espresso-hover">Post a vacancy</a>`,
            });
            pagesBox.innerHTML = '';
            return;
        }
        listBox.innerHTML = `
            <div class="overflow-x-auto rounded-xl border border-line bg-white shadow-sm">
                <table class="w-full text-left text-sm">
                    <thead class="bg-slate-50 text-xs text-ink-soft">
                        <tr>
                            <th class="px-4 py-2.5 font-medium">Student</th><th class="px-4 py-2.5 font-medium">University</th>
                            <th class="px-4 py-2.5 font-medium">Department</th><th class="px-4 py-2.5 font-medium">Gender</th>
                            <th class="px-4 py-2.5 font-medium">Came from</th><th class="px-4 py-2.5 font-medium">Date</th>
                            <th class="px-4 py-2.5 text-right font-medium">Actions</th>
                        </tr>
                    </thead>
                    <tbody>${answer.data.map(rowHtml).join('')}</tbody>
                </table>
            </div>`;
        Ui.renderPagination(pagesBox, answer.page, answer.total_pages, loadList);
    } catch (error) {
        pagesBox.innerHTML = '';
        if (error.status === 404) {
            // no mess yet
            listBox.innerHTML = Ui.empty({
                icon: 'fa-solid fa-building',
                title: 'Set up your mess to get started',
                text: 'Students can show interest after your mess is created and verified.',
                buttonHtml: `<a href="${SITE_ROOT}pages/manager/mess-setup.html" class="inline-flex h-10 items-center rounded-lg bg-espresso px-5 text-sm font-medium text-white hover:bg-espresso-hover">Create mess</a>`,
            });
        } else {
            listBox.innerHTML = '';
            listBox.appendChild(Ui.errorBanner(error.message, () => loadList(page)));
        }
    }
}

// Chat: the chat with this student if there is one, else a new one is opened first
listBox.addEventListener('click', async (event) => {
    const button = event.target.closest('[data-chat-student]');
    if (!button) return;
    if (button.dataset.conversationId) {
        location.href = SITE_ROOT + 'pages/chat.html?id=' + button.dataset.conversationId;
        return;
    }
    Ui.setLoading(button, true, 'Opening');
    try {
        const chat = await Api.post('/conversations', { student_id: Number(button.dataset.chatStudent) });
        location.href = SITE_ROOT + 'pages/chat.html?id=' + chat.conversation_id;
    } catch (error) {
        Ui.toast(error.message, 'error');
        Ui.setLoading(button, false);
    }
});

loadList();
