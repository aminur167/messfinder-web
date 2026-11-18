// The Chat page, for students and managers.
// Left: the list of chats. Right: the open chat (the address is  chat.html?id=5).
// Messages travel through Socket.io, so they arrive at once. When the live connection is not there,
// sending still works through the normal API.
// On a phone only one panel is shown: the list, and after a tap the chat with a Back button.

Layout.start({ active: 'chat', title: 'Chat', roles: ['student', 'manager'] });

const user = Auth.getUser();
const isStudent = user.role === 'student';

const listPanel = document.getElementById('list-panel');
const threadPanel = document.getElementById('thread-panel');
const listBox = document.getElementById('chat-list');
const searchInput = document.getElementById('chat-search');
const emptyBox = document.getElementById('thread-empty');
const threadBox = document.getElementById('thread');
const headerBox = document.getElementById('thread-header');
const messagesBox = document.getElementById('messages');
const sendForm = document.getElementById('send-form');
const messageInput = document.getElementById('message-input');
const sendButton = document.getElementById('send-button');
const offlineNote = document.getElementById('offline-note');

let conversations = [];     // the inbox: GET /conversations
let activeId = null;        // the chat that is open
let activeChat = null;      // its details (names, phone numbers)
let messages = [];          // its messages, oldest first
let hasMore = false;        // are there earlier messages on the server?
let socket = null;

// ---------- small helpers ----------

function parseTime(text) {
    return new Date(String(text).replace(' ', 'T'));
}

// "6:30 pm"
function clock(text) {
    return parseTime(text).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }).toLowerCase();
}

// "Today", "Yesterday" or "24 Nov 2026"
function dayLabel(text) {
    const day = parseTime(text);
    const today = new Date();
    const yesterday = new Date();
    yesterday.setDate(today.getDate() - 1);
    if (day.toDateString() === today.toDateString()) return 'Today';
    if (day.toDateString() === yesterday.toDateString()) return 'Yesterday';
    return Ui.date(text);
}

function findConversation(id) {
    return conversations.find((chat) => chat.conversation_id === id);
}

// the number on the Chat link is the sum of the unread messages of all chats
function updateBadge() {
    Layout.setChatBadge(conversations.reduce((sum, chat) => sum + Number(chat.unread_count), 0));
}

// On a phone one panel at a time: 'list' or 'thread'
function showPanel(which) {
    listPanel.classList.toggle('hidden', which === 'thread');
    threadPanel.classList.toggle('hidden', which === 'list');
    threadPanel.classList.toggle('flex', which === 'thread');
}

// ---------- the list of chats ----------

function chatItemHtml(chat) {
    const isActive = chat.conversation_id === activeId;
    const preview = chat.last_message
        ? (chat.last_sender_id === user.user_id ? 'You: ' : '') + chat.last_message
        : 'No messages yet';
    const unread = Number(chat.unread_count) > 0
        ? `<span class="ml-2 shrink-0 rounded-full bg-ochre px-1.5 text-xs font-semibold text-espresso">${chat.unread_count > 9 ? '9+' : chat.unread_count}</span>` : '';
    const time = chat.last_message_at ? Ui.timeAgo(chat.last_message_at) : '';
    return `
        <button type="button" data-chat-id="${chat.conversation_id}"
            class="flex w-full items-center gap-3 border-b border-line px-3 py-3 text-left hover:bg-page ${isActive ? 'bg-ochre-soft' : ''}">
            ${Ui.avatar(chat.title, 'h-11 w-11 text-sm')}
            <div class="min-w-0 flex-1">
                <div class="flex items-center justify-between gap-2">
                    <p class="truncate text-sm font-semibold">${Ui.escape(chat.title)}</p>
                    <span class="shrink-0 text-xs text-ink-soft">${time}</span>
                </div>
                <div class="mt-0.5 flex items-center justify-between">
                    <p class="truncate text-sm ${Number(chat.unread_count) > 0 ? 'font-medium text-ink' : 'text-ink-soft'}">${Ui.escape(preview)}</p>
                    ${unread}
                </div>
            </div>
        </button>`;
}

function renderList() {
    const word = searchInput.value.trim().toLowerCase();
    const shown = conversations.filter((chat) => chat.title.toLowerCase().includes(word));

    if (conversations.length === 0) {
        const text = isStudent
            ? 'Open a mess and press Chat to talk to its manager.'
            : 'A chat starts when a student writes to you, or when you press Message on a seat wanted post.';
        listBox.innerHTML = `
            <div class="px-6 py-10 text-center">
                <i class="fa-regular fa-comments text-3xl text-ochre"></i>
                <h2 class="mt-3 text-base font-semibold">No chats yet</h2>
                <p class="mt-1 text-sm text-ink-soft">${text}</p>
                ${isStudent ? `<a href="${SITE_ROOT}pages/browse.html" class="mt-4 inline-flex h-10 items-center rounded-lg bg-espresso px-4 text-sm font-medium text-white hover:bg-espresso-hover">Browse messes</a>` : ''}
            </div>`;
        return;
    }
    listBox.innerHTML = shown.length === 0
        ? '<p class="px-4 py-6 text-center text-sm text-ink-soft">No chat matches your search.</p>'
        : shown.map(chatItemHtml).join('');
}

async function loadInbox() {
    try {
        conversations = await Api.get('/conversations');
        renderList();
        updateBadge();
    } catch (error) {
        listBox.innerHTML = '';
        const banner = Ui.errorBanner(error.message, loadInbox);
        banner.classList.add('m-3');
        listBox.appendChild(banner);
    }
}

searchInput.addEventListener('input', renderList);
listBox.addEventListener('click', (event) => {
    const item = event.target.closest('[data-chat-id]');
    if (item) openChat(Number(item.dataset.chatId));
});

// ---------- the open chat ----------

function renderHeader() {
    const chat = activeChat;
    const iconButton = 'flex h-10 w-10 items-center justify-center gap-2 rounded-lg border border-line bg-white text-sm font-medium hover:bg-page sm:w-auto sm:px-3';
    // the phone numbers belong to the mess, so only the student needs them
    const contact = isStudent ? `
        <a href="${SITE_ROOT}pages/mess-details.html?id=${chat.mess_id}" class="${iconButton}" aria-label="View mess"><i class="fa-solid fa-building"></i><span class="hidden sm:inline">Mess</span></a>
        <a href="tel:+${Ui.escape(chat.contact_phone)}" class="${iconButton}" aria-label="Call"><i class="fa-solid fa-phone"></i><span class="hidden sm:inline">Call</span></a>
        <a href="https://wa.me/${Ui.escape(chat.contact_whatsapp)}" target="_blank" rel="noopener" class="${iconButton}" aria-label="WhatsApp"><i class="fa-brands fa-whatsapp"></i><span class="hidden sm:inline">WhatsApp</span></a>` : '';

    headerBox.innerHTML = `
        <button type="button" id="back-button" class="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg hover:bg-page md:hidden" aria-label="Back to the chats">
            <i class="fa-solid fa-arrow-left"></i>
        </button>
        ${Ui.avatar(chat.title, 'h-10 w-10 text-sm')}
        <div class="min-w-0 flex-1">
            <p class="truncate text-sm font-semibold">${Ui.escape(chat.title)}</p>
            <p class="truncate text-xs text-ink-soft">${Ui.escape(chat.subtitle)}</p>
        </div>
        <div class="flex shrink-0 gap-1.5">${contact}</div>`;
}

// one message as a bubble: mine on the right (dark), the other person's on the left (white)
function bubbleHtml(message) {
    const mine = message.sender_id === user.user_id;
    const text = Ui.escape(message.body);
    if (mine) {
        const icon = message.is_read ? 'fa-check-double text-ochre' : 'fa-check';
        return `
            <div data-message-id="${message.message_id}" class="flex justify-end">
                <div class="max-w-[80%]">
                    <p class="whitespace-pre-wrap break-words rounded-2xl rounded-br-md bg-espresso px-3 py-2 text-sm text-white">${text}</p>
                    <p class="mt-0.5 text-right text-[11px] text-ink-soft">${clock(message.sent_at)} <i data-status class="fa-solid ${icon}"></i></p>
                </div>
            </div>`;
    }
    return `
        <div data-message-id="${message.message_id}" class="flex justify-start">
            <div class="max-w-[80%]">
                <p class="whitespace-pre-wrap break-words rounded-2xl rounded-bl-md border border-line bg-white px-3 py-2 text-sm">${text}</p>
                <p class="mt-0.5 text-[11px] text-ink-soft">${clock(message.sent_at)}</p>
            </div>
        </div>`;
}

function renderMessages() {
    if (messages.length === 0) {
        messagesBox.innerHTML = `
            <div class="flex h-full flex-col items-center justify-center text-center">
                <i class="fa-regular fa-hand text-3xl text-ochre"></i>
                <p class="mt-2 text-sm font-semibold">Say hello</p>
                <p class="text-sm text-ink-soft">Write the first message to ${Ui.escape(activeChat.title)}.</p>
            </div>`;
        return;
    }

    let html = hasMore
        ? '<div class="pb-2 text-center"><button type="button" id="load-earlier" class="h-9 rounded-lg border border-line bg-white px-3 text-sm font-medium hover:bg-page">Load earlier messages</button></div>'
        : '';
    let lastDay = '';
    messages.forEach((message) => {
        const day = parseTime(message.sent_at).toDateString();
        if (day !== lastDay) {
            html += `<p class="py-2 text-center text-xs text-ink-soft">${dayLabel(message.sent_at)}</p>`;
            lastDay = day;
        }
        html += bubbleHtml(message);
    });
    messagesBox.innerHTML = html;
}

function scrollToBottom() {
    messagesBox.scrollTop = messagesBox.scrollHeight;
}

async function openChat(id, push = true) {
    activeId = id;
    renderList();
    if (push) history.pushState(null, '', location.pathname + '?id=' + id);

    emptyBox.classList.add('hidden');
    threadBox.classList.remove('hidden');
    threadBox.classList.add('flex');
    showPanel('thread');
    headerBox.innerHTML = '';
    messagesBox.innerHTML = Ui.skeleton(3, 'h-12');
    sendForm.classList.remove('hidden');
    if (window.innerWidth >= 768) messageInput.focus({ preventScroll: true });    // a phone keyboard would cover the chat

    try {
        const data = await Api.get(`/conversations/${id}/messages`, { limit: 30 });
        if (activeId !== id) return;                 // another chat was opened meanwhile
        activeChat = data.conversation;
        messages = data.messages;
        hasMore = data.has_more;
        document.title = activeChat.title + ' | Mess Finder';
        renderHeader();
        renderMessages();
        scrollToBottom();
        markActiveRead();
    } catch (error) {
        if (activeId !== id) return;
        messagesBox.innerHTML = '';
        if (error.status === 404) {
            sendForm.classList.add('hidden');        // nothing to write to
            messagesBox.innerHTML = '<div class="flex h-full items-center justify-center px-6 text-center text-sm text-ink-soft">This chat does not exist, or it is not yours.</div>';
            headerBox.innerHTML = '<button type="button" id="back-button" class="flex h-10 w-10 items-center justify-center rounded-lg hover:bg-page md:hidden" aria-label="Back to the chats"><i class="fa-solid fa-arrow-left"></i></button>';
        } else {
            const banner = Ui.errorBanner(error.message, () => openChat(id, false));
            banner.classList.add('m-3');
            messagesBox.appendChild(banner);
        }
    }
}

// Phone: the Back button goes to the list
function closeChat() {
    activeId = null;
    activeChat = null;
    history.pushState(null, '', location.pathname);
    document.title = 'Chat | Mess Finder';
    emptyBox.classList.remove('hidden');
    threadBox.classList.add('hidden');
    threadBox.classList.remove('flex');
    showPanel('list');
    renderList();
}

headerBox.addEventListener('click', (event) => {
    if (event.target.closest('#back-button')) closeChat();
});

// the browser's Back and Forward buttons follow the address
window.addEventListener('popstate', () => {
    const id = Number(new URLSearchParams(location.search).get('id'));
    if (id) {
        openChat(id, false);
    } else {
        activeId = null;
        emptyBox.classList.remove('hidden');
        threadBox.classList.add('hidden');
        threadBox.classList.remove('flex');
        showPanel('list');
        renderList();
    }
});

// "Load earlier messages": the older ones are put on top and the page stays where it was
messagesBox.addEventListener('click', async (event) => {
    const button = event.target.closest('#load-earlier');
    if (!button) return;
    Ui.setLoading(button, true, 'Loading');
    try {
        const data = await Api.get(`/conversations/${activeId}/messages`, { limit: 30, before: messages[0].message_id });
        const oldHeight = messagesBox.scrollHeight;
        messages = data.messages.concat(messages);
        hasMore = data.has_more;
        renderMessages();
        messagesBox.scrollTop = messagesBox.scrollHeight - oldHeight;
    } catch (error) {
        Ui.toast(error.message, 'error');
        Ui.setLoading(button, false);
    }
});

// ---------- read marks ----------

// The messages of the other person in the open chat are read now: tell the server (and so the other person)
function markActiveRead() {
    const chat = findConversation(activeId);
    if (!chat) return;
    const hasUnread = Number(chat.unread_count) > 0 || messages.some((m) => m.sender_id !== user.user_id && !m.is_read);
    if (!hasUnread) return;

    chat.unread_count = 0;
    messages.forEach((m) => { if (m.sender_id !== user.user_id) m.is_read = 1; });
    renderList();
    updateBadge();
    if (socket && socket.connected) {
        socket.emit('mark_read', { conversation_id: activeId });
    } else {
        Api.patch(`/conversations/${activeId}/read`).catch(() => { /* the next visit marks it again */ });
    }
}

// The other person read my messages: the single check mark becomes a double one
function showMyMessagesRead() {
    messages.forEach((m) => { if (m.sender_id === user.user_id) m.is_read = 1; });
    messagesBox.querySelectorAll('[data-status]').forEach((icon) => {
        icon.className = 'fa-solid fa-check-double text-ochre';
    });
}

// ---------- a new message arrives (also my own, which comes back from the server) ----------

function onNewMessage(message) {
    const chat = findConversation(message.conversation_id);
    if (!chat) {
        loadInbox();                  // a chat that is new to this page: the list asks the server
        return;
    }
    const mine = message.sender_id === user.user_id;
    chat.last_message = message.body;
    chat.last_sender_id = message.sender_id;
    chat.last_message_at = message.sent_at;

    if (message.conversation_id === activeId) {
        if (!messages.some((m) => m.message_id === message.message_id)) {
            const nearBottom = messagesBox.scrollHeight - messagesBox.scrollTop - messagesBox.clientHeight < 80;
            messages.push(message);
            renderMessages();
            if (mine || nearBottom) scrollToBottom();
        }
        if (!mine) markActiveRead();
    } else if (!mine) {
        chat.unread_count = Number(chat.unread_count) + 1;
    }

    // the chat with the newest message goes to the top of the list
    conversations = [chat, ...conversations.filter((other) => other !== chat)];
    renderList();
    updateBadge();
}

// ---------- sending ----------

messageInput.addEventListener('input', () => {
    messageInput.style.height = 'auto';
    messageInput.style.height = Math.min(messageInput.scrollHeight, 112) + 'px';
});

// Enter sends, Shift+Enter makes a new line
messageInput.addEventListener('keydown', (event) => {
    if (event.key === 'Enter' && !event.shiftKey) {
        event.preventDefault();
        sendForm.requestSubmit();
    }
});

sendForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    const text = messageInput.value.trim();
    if (text === '' || activeId === null) return;

    sendButton.disabled = true;
    const done = (message) => {
        onNewMessage(message);
        messageInput.value = '';
        messageInput.style.height = 'auto';
        sendButton.disabled = false;
        messageInput.focus();
    };
    const failed = (reason) => {
        Ui.toast(reason, 'error');
        sendButton.disabled = false;
    };

    if (socket && socket.connected) {
        socket.timeout(8000).emit('send_message', { conversation_id: activeId, body: text }, (error, answer) => {
            if (error) failed('The message was not confirmed. Please try again.');
            else if (!answer.ok) failed(answer.error);
            else done(answer.message);
        });
        return;
    }

    // no live connection: the normal API saves the message
    try {
        done(await Api.post(`/conversations/${activeId}/messages`, { body: text }));
    } catch (problem) {
        failed(problem.message);
    }
});

// ---------- the live connection ----------

function connectSocket() {
    if (typeof io === 'undefined') {
        offlineNote.classList.remove('hidden');
        return;
    }
    let connectedBefore = false;
    socket = io(SOCKET_URL, { auth: { token: Auth.getToken() } });

    socket.on('connect', () => {
        offlineNote.classList.add('hidden');
        // after a lost connection some messages may have been missed: ask for them again
        if (connectedBefore) {
            loadInbox();
            if (activeId !== null) openChat(activeId, false);
        }
        connectedBefore = true;
    });
    socket.on('disconnect', () => offlineNote.classList.remove('hidden'));
    socket.on('connect_error', () => offlineNote.classList.remove('hidden'));

    socket.on('new_message', onNewMessage);
    socket.on('messages_read', (data) => {
        if (data.conversation_id === activeId) showMyMessagesRead();
    });
}

// ---------- start ----------

(async () => {
    connectSocket();
    await loadInbox();
    const id = Number(new URLSearchParams(location.search).get('id'));
    if (id) openChat(id, false);
    else showPanel('list');
})();
