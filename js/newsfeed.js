// The Newsfeed page: vacancy posts of the managers and seat wanted posts of the students, in one list.
// Everybody can read it and read the comments. To comment, press Interested or post, a visitor must login.
// A student can post a seat wanted (the form in the top card) and close his own posts.
// A manager can read, comment and send a message to a student who wants a seat.
// The chosen filters are kept in the address (?type=vacancy&area_id=3), like on the Browse page.

Layout.start({ active: 'newsfeed', title: 'Newsfeed' });

const MAX_OPEN_WANTED = 5;          // the same limit as the backend

const feedBox = document.getElementById('feed');
const pagination = document.getElementById('pagination');
const composerBox = document.getElementById('composer');
const areaSelect = document.getElementById('filter-area');
const messTypeSelect = document.getElementById('filter-mess-type');
const openCheckbox = document.getElementById('filter-open');

const user = Auth.isLoggedIn() ? Auth.getUser() : null;
const isStudent = Boolean(user && user.role === 'student');
const isManager = Boolean(user && user.role === 'manager');

const filters = { type: '', area_id: '', mess_type: '', openOnly: false };
let currentPage = 1;
let lastRequest = 0;                 // an old answer that arrives late is ignored
const posts = new Map();             // the posts on the screen, by key like "vacancy-3"

// ---------- small helpers ----------

const buttonClass = 'inline-flex h-10 items-center justify-center gap-1.5 rounded-lg px-2 text-sm sm:gap-2 sm:px-3 font-medium hover:bg-page disabled:cursor-not-allowed disabled:text-mute';
const primaryClass = 'inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-espresso px-4 text-sm font-medium text-white hover:bg-espresso-hover disabled:opacity-70';
const secondaryClass = 'inline-flex h-10 items-center justify-center gap-2 rounded-lg border border-line bg-white px-4 text-sm font-medium hover:bg-page';
const inputClass = 'w-full rounded-lg border border-line bg-white px-3 text-sm placeholder:text-mute focus:border-ochre focus:outline-none focus:ring-2 focus:ring-ochre/40';

// the address of the login page that brings the user back here
function loginUrl() {
    return SITE_ROOT + 'pages/login.html?next=' + encodeURIComponent(location.href);
}

// A visitor who presses a button that needs a login goes to the login page. Gives true when he was sent away.
function sendToLogin() {
    if (user) return false;
    location.href = loginUrl();
    return true;
}

function postKey(post) {
    return post.post_type + '-' + post.post_id;
}

// the address of the comments says "vacancy" or "wanted"
function commentPath(post) {
    return `/posts/${post.post_type === 'vacancy' ? 'vacancy' : 'wanted'}/${post.post_id}/comments`;
}

// "৳3,000 - ৳4,500", "Up to ৳4,000", "From ৳3,000"
function budgetText(min, max) {
    if (min === null && max === null) return 'Budget not set';
    if (min === null) return 'Up to ' + Ui.money(max);
    if (max === null) return 'From ' + Ui.money(min);
    return Number(min) === Number(max) ? Ui.money(min) : Ui.money(min) + ' - ' + Ui.money(max);
}

// today as 2026-12-01 (the computer's own day), for the date input
function todayText() {
    const now = new Date();
    now.setMinutes(now.getMinutes() - now.getTimezoneOffset());
    return now.toISOString().slice(0, 10);
}

// ---------- one post ----------

function seatChipHtml(seat) {
    const name = `Room ${Ui.escape(seat.room_no)}, ${Ui.escape(seat.seat_label)}`;
    if (seat.status === 'available') {
        return `<span class="rounded-lg bg-green-100 px-2.5 py-1 text-xs font-medium text-green-800">${name} &middot; ${Ui.money(seat.monthly_rent)}</span>`;
    }
    return `<span class="rounded-lg bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-500">${name} &middot; Taken</span>`;
}

// who wrote the post: the mess (vacancy) or the student (seat wanted)
function postHeaderHtml(post) {
    const typeBadge = Ui.badge(post.mess_type === 'girls' ? 'Girls' : 'Boys', 'slate');
    const statusBadge = Ui.statusBadge(post.status);
    const when = Ui.timeAgo(post.created_at);

    if (post.post_type === 'vacancy') {
        const rating = post.mess && post.mess.review_count > 0
            ? `<span class="mr-2">${Ui.stars(post.mess.avg_rating, post.mess.review_count)}</span>` : '';
        return `
            <div class="flex items-start gap-3">
                <span class="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-ochre-soft text-ochre"><i class="fa-solid fa-building"></i></span>
                <div class="min-w-0 flex-1">
                    <a href="${SITE_ROOT}pages/mess-details.html?id=${post.mess_id}" class="block truncate font-semibold hover:underline">${Ui.escape(post.author_name)}</a>
                    <p class="flex flex-wrap items-center text-xs text-ink-soft">${rating}${Ui.escape(post.area_name)} &middot; ${when}</p>
                </div>
                <div class="flex shrink-0 flex-col items-end gap-1">${typeBadge}${statusBadge}</div>
            </div>`;
    }

    const university = post.author_university ? 'Student at ' + post.author_university : 'Student';
    return `
        <div class="flex items-start gap-3">
            ${Ui.avatar(post.author_name, 'h-10 w-10 text-sm')}
            <div class="min-w-0 flex-1">
                <p class="truncate font-semibold">${Ui.escape(post.author_name)}${post.viewer.is_mine ? ' <span class="text-xs font-normal text-ink-soft">(you)</span>' : ''}</p>
                <p class="text-xs text-ink-soft">${Ui.escape(university)} &middot; ${when}</p>
            </div>
            <div class="flex shrink-0 flex-col items-end gap-1">${typeBadge}${statusBadge}</div>
        </div>`;
}

// the facts under the title
function postDetailsHtml(post) {
    if (post.post_type === 'vacancy') {
        const seats = post.seats.length > 0
            ? `<div class="mt-3 flex flex-wrap gap-1.5">${post.seats.map(seatChipHtml).join('')}</div>`
            : '<p class="mt-3 text-sm text-ink-soft">The seats of this post are not listed.</p>';
        return `
            <p class="mt-2 text-sm text-ink-soft"><i class="fa-regular fa-calendar mr-1.5 text-ochre"></i>Available from ${Ui.date(post.date_from)}</p>
            ${seats}`;
    }

    const university = post.preferred_university
        ? `<span><i class="fa-solid fa-graduation-cap mr-1.5 text-ochre"></i>Near ${Ui.escape(post.preferred_university)}</span>` : '';
    return `
        <div class="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-sm text-ink-soft">
            <span><i class="fa-solid fa-location-dot mr-1.5 text-ochre"></i>${Ui.escape(post.area_name || 'Any area')}</span>
            ${university}
            <span><i class="fa-solid fa-wallet mr-1.5 text-ochre"></i>${budgetText(post.budget_min, post.budget_max)}</span>
            <span><i class="fa-regular fa-calendar mr-1.5 text-ochre"></i>Needed from ${Ui.date(post.date_from)}</span>
        </div>`;
}

// the heart is filled when the student is interested in this mess
function interestedButtonInner(isOn) {
    return `<i class="${isOn ? 'fa-solid' : 'fa-regular'} fa-heart text-ochre"></i> <span>Interested</span>`;
}

// the buttons under the post depend on who looks and what kind of post it is
function postButtonsHtml(post) {
    const isOpen = post.status === 'open';
    const comments = `
        <button type="button" data-action="comments" class="${buttonClass}">
            <i class="fa-regular fa-comment"></i> <span>Comments (<span data-comment-count>${post.comment_count}</span>)</span>
        </button>`;
    let buttons = '';

    if (post.post_type === 'vacancy') {
        if (post.viewer.is_mine) {
            buttons = `<span class="px-2 text-sm text-ink-soft"><i class="fa-solid fa-heart mr-1.5 text-ochre"></i>${post.interest_count} interested</span>`;
        } else if (!user || isStudent) {
            buttons = `
                <button type="button" data-action="interested" data-mess-id="${post.mess_id}" class="${buttonClass}" ${isOpen ? '' : 'disabled title="This post has expired"'}>
                    ${interestedButtonInner(post.viewer.is_interested)}
                </button>
                <button type="button" data-action="chat-mess" class="${buttonClass}"><i class="fa-regular fa-comments"></i> Chat</button>`;
        }
    } else if (post.viewer.is_mine) {
        if (isOpen) {
            buttons = `<button type="button" data-action="close-wanted" class="${buttonClass}"><i class="fa-regular fa-circle-xmark"></i> Close post</button>`;
        }
    } else if (isManager) {
        buttons = `<button type="button" data-action="chat-student" class="${buttonClass}"><i class="fa-regular fa-message"></i> Message</button>`;
    }

    // the small negative margin gives the three buttons enough room on a phone
    return `<div class="-mx-1 mt-3 flex flex-wrap items-center gap-0.5 border-t border-line pt-2">${comments}${buttons}</div>`;
}

function postHtml(post) {
    return `
        <article data-key="${postKey(post)}" class="rounded-xl border border-line bg-white p-4 shadow-sm">
            ${postHeaderHtml(post)}
            <h2 class="mt-3 text-base font-semibold leading-snug">${Ui.escape(post.title)}</h2>
            ${post.description ? `<p class="mt-1 whitespace-pre-line text-sm leading-relaxed">${Ui.escape(post.description)}</p>` : ''}
            ${postDetailsHtml(post)}
            ${postButtonsHtml(post)}
            <div data-comments class="mt-3 hidden border-t border-line pt-3"></div>
        </article>`;
}

// ---------- comments ----------

function commentHtml(comment) {
    const role = comment.role === 'manager' ? ' ' + Ui.badge('Manager', 'ochre') : comment.role === 'admin' ? ' ' + Ui.badge('Admin', 'slate') : '';
    const remove = comment.can_delete
        ? `<button type="button" data-action="delete-comment" data-comment-id="${comment.comment_id}" class="text-xs font-medium text-link hover:underline">Delete</button>` : '';
    return `
        <div data-comment class="flex gap-2.5 py-2">
            ${Ui.avatar(comment.full_name, 'h-8 w-8 text-xs')}
            <div class="min-w-0 flex-1 rounded-lg bg-page px-3 py-2">
                <p class="flex flex-wrap items-center gap-x-2 text-sm font-semibold">${Ui.escape(comment.full_name)}${role}
                    <span class="text-xs font-normal text-ink-soft">${Ui.timeAgo(comment.created_at)}</span></p>
                <p class="mt-0.5 whitespace-pre-line break-words text-sm">${Ui.escape(comment.body)}</p>
                ${remove ? `<p class="mt-1">${remove}</p>` : ''}
            </div>
        </div>`;
}

const noCommentsHtml = '<p data-no-comments class="py-2 text-sm text-ink-soft">No comments yet. Be the first to write one.</p>';

// the box under a comment list: a form, or a reason why there is none
function commentFormHtml(post) {
    if (!user) {
        return `<p class="text-sm"><a href="${loginUrl()}" class="font-medium text-link hover:underline">Login</a> to write a comment.</p>`;
    }
    if (post.status !== 'open') {
        return '<p class="text-sm text-ink-soft"><i class="fa-solid fa-lock mr-1.5"></i>Comments are closed because this post is not open any more.</p>';
    }
    return `
        <form data-comment-form class="space-y-2" novalidate>
            <label class="sr-only" for="comment-${postKey(post)}">Write a comment</label>
            <textarea id="comment-${postKey(post)}" name="body" rows="2" maxlength="500" placeholder="Write a comment..."
                class="${inputClass} py-2"></textarea>
            <p data-comment-error class="hidden text-sm text-red-700"></p>
            <div class="flex justify-end">
                <button type="submit" class="h-10 rounded-lg bg-espresso px-4 text-sm font-medium text-white hover:bg-espresso-hover disabled:opacity-70">Comment</button>
            </div>
        </form>`;
}

async function loadComments(box, post) {
    box.innerHTML = Ui.skeleton(2, 'h-12');
    try {
        const list = await Api.get(commentPath(post));
        box.dataset.loaded = '1';
        box.innerHTML = `
            <div data-comment-list>${list.length === 0 ? noCommentsHtml : list.map(commentHtml).join('')}</div>
            <div class="mt-2">${commentFormHtml(post)}</div>`;
    } catch (error) {
        box.innerHTML = '';
        box.appendChild(Ui.errorBanner(error.message, () => loadComments(box, post)));
    }
}

// The Comments button opens and closes the box. The comments are asked from the server only the first time.
function toggleComments(card, post) {
    const box = card.querySelector('[data-comments]');
    const nowHidden = box.classList.toggle('hidden');
    if (!nowHidden && !box.dataset.loaded) loadComments(box, post);
}

// the number on the Comments button follows the comments that are added or deleted
function changeCommentCount(card, post, change) {
    post.comment_count += change;
    card.querySelector('[data-comment-count]').textContent = post.comment_count;
}

async function sendComment(form) {
    const card = form.closest('[data-key]');
    const post = posts.get(card.dataset.key);
    const text = form.elements.body.value.trim();
    const error = form.querySelector('[data-comment-error]');
    error.classList.add('hidden');
    if (text === '') {
        error.textContent = 'Please write something first.';
        error.classList.remove('hidden');
        return;
    }

    const button = form.querySelector('button[type=submit]');
    Ui.setLoading(button, true, 'Sending');
    try {
        const comment = await Api.post(commentPath(post), { body: text });
        const list = card.querySelector('[data-comment-list]');
        const note = list.querySelector('[data-no-comments]');
        if (note) note.remove();
        list.insertAdjacentHTML('beforeend', commentHtml(comment));
        form.elements.body.value = '';
        changeCommentCount(card, post, 1);
    } catch (problem) {
        error.textContent = problem.message;
        error.classList.remove('hidden');
    }
    Ui.setLoading(button, false);
}

async function deleteComment(button) {
    const card = button.closest('[data-key]');
    const post = posts.get(card.dataset.key);
    const confirmed = await Ui.confirm({
        title: 'Delete comment', message: 'Do you want to delete your comment?', confirmText: 'Delete', danger: true,
    });
    if (!confirmed) return;

    try {
        await Api.delete('/comments/' + button.dataset.commentId);
        const list = card.querySelector('[data-comment-list]');
        button.closest('[data-comment]').remove();
        if (!list.querySelector('[data-comment]')) list.innerHTML = noCommentsHtml;
        changeCommentCount(card, post, -1);
        Ui.toast('Comment deleted');
    } catch (error) {
        Ui.toast(error.message, 'error');
    }
}

// ---------- the buttons of a post ----------

// The heart belongs to the mess, so every post of the same mess changes together
async function toggleInterested(button, post) {
    if (sendToLogin()) return;
    button.disabled = true;
    try {
        const result = await Api.post('/interests/toggle', { mess_id: post.mess_id, post_id: post.post_id });
        posts.forEach((other) => { if (other.mess_id === post.mess_id) other.viewer.is_interested = result.is_interested; });
        document.querySelectorAll(`[data-action="interested"][data-mess-id="${post.mess_id}"]`).forEach((heart) => {
            heart.innerHTML = interestedButtonInner(result.is_interested);
        });
        Ui.toast(result.is_interested ? 'Added to your interested list' : 'Removed from your interested list');
        loadSideList();
    } catch (error) {
        Ui.toast(error.message, 'error');
    }
    button.disabled = false;
}

// Opens (or finds) the chat and goes to the chat page. body is { mess_id } for a student, { student_id } for a manager.
async function startChat(button, body) {
    if (sendToLogin()) return;
    Ui.setLoading(button, true, 'Opening');
    try {
        const chat = await Api.post('/conversations', body);
        location.href = SITE_ROOT + 'pages/chat.html?id=' + chat.conversation_id;
    } catch (error) {
        Ui.toast(error.message, 'error');
        Ui.setLoading(button, false);
    }
}

async function closeWantedPost(wantedId) {
    const confirmed = await Ui.confirm({
        title: 'Close post', message: 'Managers will not see this post any more. Do you want to close it?', confirmText: 'Close post',
    });
    if (!confirmed) return false;
    try {
        await Api.patch(`/seat-wanted/${wantedId}/close`);
        Ui.toast('Your post is closed');
        loadFeed();
        return true;
    } catch (error) {
        Ui.toast(error.message, 'error');
        return false;
    }
}

// One listener for all the buttons of all the posts (also for posts that are added later)
feedBox.addEventListener('click', (event) => {
    const button = event.target.closest('[data-action]');
    if (!button) return;
    const card = button.closest('[data-key]');
    const post = posts.get(card.dataset.key);

    switch (button.dataset.action) {
        case 'comments': toggleComments(card, post); break;
        case 'interested': toggleInterested(button, post); break;
        case 'chat-mess': startChat(button, { mess_id: post.mess_id }); break;
        case 'chat-student': startChat(button, { student_id: post.author_user_id }); break;
        case 'close-wanted': closeWantedPost(post.post_id); break;
        case 'delete-comment': deleteComment(button); break;
    }
});

feedBox.addEventListener('submit', (event) => {
    const form = event.target.closest('[data-comment-form]');
    if (!form) return;
    event.preventDefault();
    sendComment(form);
});

// ---------- the list ----------

// The filters go into the address, so Back, a reload and a shared link show the same list
function writeAddress() {
    const params = new URLSearchParams();
    if (filters.type) params.set('type', filters.type);
    if (filters.area_id) params.set('area_id', filters.area_id);
    if (filters.mess_type) params.set('mess_type', filters.mess_type);
    if (filters.openOnly) params.set('open', '1');
    if (currentPage > 1) params.set('page', currentPage);
    history.replaceState(null, '', location.pathname + (params.toString() ? '?' + params.toString() : ''));
}

function readAddress() {
    const params = new URLSearchParams(location.search);
    filters.type = ['vacancy', 'seat_wanted'].includes(params.get('type')) ? params.get('type') : '';
    filters.area_id = params.get('area_id') || '';
    filters.mess_type = ['boys', 'girls'].includes(params.get('mess_type')) ? params.get('mess_type') : '';
    filters.openOnly = params.get('open') === '1';
    currentPage = Number(params.get('page')) || 1;
}

// paints the chips and the fields so they show the filters
function showFilters() {
    document.querySelectorAll('#type-chips [data-type]').forEach((chip) => {
        const on = chip.dataset.type === filters.type;
        chip.classList.toggle('border-ochre', on);
        chip.classList.toggle('text-ink', on);
        chip.classList.toggle('border-transparent', !on);
        chip.classList.toggle('text-ink-soft', !on);
    });
    areaSelect.value = filters.area_id;
    messTypeSelect.value = filters.mess_type;
    openCheckbox.checked = filters.openOnly;
}

async function loadFeed() {
    writeAddress();
    showFilters();

    const myNumber = ++lastRequest;
    feedBox.innerHTML = Ui.skeleton(3, 'h-48');
    try {
        const answer = await Api.get('/newsfeed', {
            type: filters.type,
            area_id: filters.area_id,
            mess_type: filters.mess_type,
            status: filters.openOnly ? 'open' : '',
            page: currentPage,
            limit: 10,
        });
        if (myNumber !== lastRequest) return;

        posts.clear();
        answer.data.forEach((post) => posts.set(postKey(post), post));

        if (answer.data.length === 0) {
            const filtered = filters.type || filters.area_id || filters.mess_type || filters.openOnly;
            feedBox.innerHTML = Ui.empty({
                icon: 'fa-regular fa-newspaper',
                title: filtered ? 'No post matches these filters' : 'No posts yet',
                text: filtered ? 'Try another area or show all posts.' : 'New seat posts will show up here.',
                buttonHtml: filtered ? '<button type="button" id="empty-clear" class="h-10 rounded-lg bg-espresso px-4 text-sm font-medium text-white hover:bg-espresso-hover">Clear filters</button>' : '',
            });
            const clear = document.getElementById('empty-clear');
            if (clear) clear.addEventListener('click', clearFilters);
            pagination.innerHTML = '';
            return;
        }

        feedBox.innerHTML = answer.data.map(postHtml).join('');
        Ui.renderPagination(pagination, answer.page, answer.total_pages, (number) => {
            currentPage = number;
            loadFeed();
            window.scrollTo({ top: 0 });
        });
    } catch (error) {
        if (myNumber !== lastRequest) return;
        feedBox.innerHTML = '';
        feedBox.appendChild(Ui.errorBanner(error.message, loadFeed));
        pagination.innerHTML = '';
    }
}

function clearFilters() {
    filters.type = '';
    filters.area_id = '';
    filters.mess_type = '';
    filters.openOnly = false;
    currentPage = 1;
    loadFeed();
}

// A change of a filter starts again from the first page
function filterChanged() {
    filters.area_id = areaSelect.value;
    filters.mess_type = messTypeSelect.value;
    filters.openOnly = openCheckbox.checked;
    currentPage = 1;
    loadFeed();
}

document.getElementById('type-chips').addEventListener('click', (event) => {
    const chip = event.target.closest('[data-type]');
    if (!chip) return;
    filters.type = chip.dataset.type;
    currentPage = 1;
    loadFeed();
});
areaSelect.addEventListener('change', filterChanged);
messTypeSelect.addEventListener('change', filterChanged);
openCheckbox.addEventListener('change', filterChanged);

// ---------- the top card ----------

function renderComposer() {
    if (isStudent) {
        composerBox.innerHTML = `
            <div class="flex items-center gap-2">
                ${Ui.avatar(user.full_name, 'h-8 w-8 text-xs')}
                <input id="open-wanted-form" type="text" readonly placeholder="Need a seat? Write..." aria-label="Post a seat wanted"
                    class="h-9 min-w-0 flex-1 cursor-pointer rounded-lg border border-line bg-page px-3 text-sm placeholder:text-ink-soft hover:border-ochre focus:outline-none focus:ring-2 focus:ring-ochre/40">
            </div>
            <div class="mt-2 flex items-center justify-between text-xs text-ink-soft">
                <span>Share what you need</span>
                <button type="button" id="open-my-posts" class="font-medium text-link hover:underline">My posts</button>
            </div>
            ${wantedFormHtml()}`;
        activateWantedForm();
    } else if (isManager) {
        composerBox.innerHTML = `
            <div class="flex items-center gap-2">
                ${Ui.avatar(user.full_name, 'h-8 w-8 text-xs')}
                <a href="${SITE_ROOT}pages/manager/posts.html?new=1" class="flex h-9 min-w-0 flex-1 items-center rounded-lg border border-line bg-page px-3 text-sm text-ink-soft hover:border-ochre">Have free seats? Post a vacancy...</a>
            </div>`;
    } else if (!user) {
        composerBox.innerHTML = `
            <p class="text-sm"><a href="${loginUrl()}" class="font-medium text-link hover:underline">Login</a> to post what you need, to comment and to mark a mess as interested.</p>`;
    } else {
        composerBox.remove();       // the admin only reads the feed
    }
}

// ---------- the seat wanted form (students) ----------

function wantedFormHtml() {
    const errorLine = (name) => `<p data-error-for="${name}" class="mt-1 text-xs text-red-700"></p>`;
    return `
        <form id="wanted-form" class="hidden space-y-4" novalidate>
            <div>
                <label for="wanted-title" class="mb-1 block text-sm font-medium">Title</label>
                <input id="wanted-title" name="title" type="text" maxlength="150" placeholder="For example: Need a seat near Dhaka University from January"
                    class="h-11 ${inputClass} border-line">
                ${errorLine('title')}
            </div>
            <div>
                <label for="wanted-description" class="mb-1 block text-sm font-medium">Details <span class="font-normal text-ink-soft">(optional)</span></label>
                <textarea id="wanted-description" name="description" rows="3" maxlength="2000" placeholder="Anything the manager should know"
                    class="${inputClass} border-line py-2"></textarea>
            </div>
            <div class="grid gap-4 sm:grid-cols-2">
                <div>
                    <label for="wanted-area" class="mb-1 block text-sm font-medium">Area <span class="font-normal text-ink-soft">(optional)</span></label>
                    <select id="wanted-area" name="area_id" class="h-11 ${inputClass}"><option value="">Any area</option></select>
                </div>
                <div>
                    <label for="wanted-university" class="mb-1 block text-sm font-medium">Near university <span class="font-normal text-ink-soft">(optional)</span></label>
                    <select id="wanted-university" name="university_id" class="h-11 ${inputClass}"><option value="">Any university</option></select>
                </div>
            </div>
            <div class="grid gap-4 sm:grid-cols-2">
                <div>
                    <label for="wanted-min" class="mb-1 block text-sm font-medium">Budget from (৳) <span class="font-normal text-ink-soft">(optional)</span></label>
                    <input id="wanted-min" name="budget_min" type="number" min="0" step="100" placeholder="3000" class="h-11 ${inputClass}">
                </div>
                <div>
                    <label for="wanted-max" class="mb-1 block text-sm font-medium">Budget up to (৳) <span class="font-normal text-ink-soft">(optional)</span></label>
                    <input id="wanted-max" name="budget_max" type="number" min="0" step="100" placeholder="5000" class="h-11 ${inputClass} border-line">
                    ${errorLine('budget_max')}
                </div>
            </div>
            <div class="grid gap-4 sm:grid-cols-2">
                <div>
                    <span class="mb-1 block text-sm font-medium">Boys or girls mess</span>
                    <div class="flex h-11 items-center gap-5 text-sm">
                        <label class="flex items-center gap-1.5"><input type="radio" name="mess_type" value="boys" class="accent-espresso"> Boys</label>
                        <label class="flex items-center gap-1.5"><input type="radio" name="mess_type" value="girls" class="accent-espresso"> Girls</label>
                    </div>
                    ${errorLine('mess_type')}
                </div>
                <div>
                    <label for="wanted-from" class="mb-1 block text-sm font-medium">Needed from</label>
                    <input id="wanted-from" name="needed_from" type="date" min="${todayText()}" class="h-11 ${inputClass} border-line">
                    ${errorLine('needed_from')}
                </div>
            </div>
            <p id="wanted-error" class="hidden text-sm text-red-700"></p>
            <div class="flex justify-end gap-2">
                <button type="button" id="cancel-wanted" class="${secondaryClass}">Cancel</button>
                <button type="submit" class="${primaryClass}">Post</button>
            </div>
        </form>`;
}

function activateWantedForm() {
    const form = document.getElementById('wanted-form');
    const errorLine = document.getElementById('wanted-error');

    let box = null;
    const setOpen = (open) => {
        if (open && !box) {
            box = Ui.modal({ title: 'Post a seat wanted', bodyHtml: '', size: 'max-w-lg' });
            box.element.querySelector('[data-modal-body]').appendChild(form);
            form.classList.remove('hidden');
            form.elements.title.focus();
            // when the box is closed (also with Esc) the form goes back to its place
            const watcher = new MutationObserver(() => {
                if (document.body.contains(box.element)) return;
                watcher.disconnect();
                composerBox.appendChild(form);
                form.classList.add('hidden');
                box = null;
            });
            watcher.observe(document.body, { childList: true });
        } else if (!open && box) {
            box.close();
        }
    };
    document.getElementById('open-wanted-form').addEventListener('click', () => setOpen(true));
    document.getElementById('cancel-wanted').addEventListener('click', () => setOpen(false));
    document.getElementById('open-my-posts').addEventListener('click', openMyPosts);

    form.addEventListener('submit', async (event) => {
        event.preventDefault();
        Ui.clearFieldErrors(form);
        errorLine.classList.add('hidden');

        // check the form before it goes to the server
        const f = form.elements;
        let ok = true;
        const fail = (name, message) => { Ui.showFieldError(form, name, message); ok = false; };

        const title = f.title.value.trim();
        if (title.length < 3) fail('title', 'Please write a title of at least 3 letters.');
        if (!f.mess_type.value) fail('mess_type', 'Please choose boys or girls.');
        if (f.needed_from.value === '') fail('needed_from', 'Please choose the date.');
        else if (f.needed_from.value < todayText()) fail('needed_from', 'The date cannot be in the past.');
        if (f.budget_min.value !== '' && f.budget_max.value !== '' && Number(f.budget_min.value) > Number(f.budget_max.value)) {
            fail('budget_max', 'The highest budget must not be less than the lowest.');
        }
        if (!ok) return;

        // only the filled fields are sent
        const body = { title, mess_type: f.mess_type.value, needed_from: f.needed_from.value };
        ['description', 'area_id', 'university_id', 'budget_min', 'budget_max'].forEach((name) => {
            const value = f[name].value.trim();
            if (value !== '') body[name] = name.endsWith('_id') || name.startsWith('budget') ? Number(value) : value;
        });

        const button = form.querySelector('button[type=submit]');
        Ui.setLoading(button, true, 'Posting');
        try {
            await Api.post('/seat-wanted', body);
            Ui.toast('Your post is live');
            form.reset();
            setOpen(false);
            // the new post must be visible: it needs "All" or "Seat wanted" and the first page
            if (filters.type === 'vacancy') filters.type = '';
            currentPage = 1;
            loadFeed();
        } catch (problem) {
            errorLine.textContent = problem.message;
            errorLine.classList.remove('hidden');
        }
        Ui.setLoading(button, false);
    });
}

// ---------- my seat wanted posts (students) ----------

function myPostHtml(post) {
    const isOpen = post.status === 'open';
    return `
        <div class="rounded-lg border border-line p-3">
            <div class="flex items-start justify-between gap-2">
                <h3 class="text-sm font-semibold leading-snug">${Ui.escape(post.title)}</h3>
                ${Ui.statusBadge(post.status)}
            </div>
            <p class="mt-1 text-xs text-ink-soft">${budgetText(post.budget_min, post.budget_max)} &middot; Needed from ${Ui.date(post.needed_from)} &middot; ${post.comment_count} ${post.comment_count === 1 ? 'comment' : 'comments'}</p>
            ${isOpen ? `<div class="mt-2 text-right"><button type="button" data-close-my="${post.wanted_id}" class="h-9 rounded-lg border border-line bg-white px-3 text-sm font-medium hover:bg-page">Close post</button></div>` : ''}
        </div>`;
}

async function openMyPosts() {
    const box = Ui.modal({ title: 'My seat wanted posts', bodyHtml: Ui.skeleton(2, 'h-20'), size: 'max-w-lg' });
    const body = box.element.querySelector('[data-modal-body]');

    async function fill() {
        try {
            const list = await Api.get('/seat-wanted/my');
            const openCount = list.filter((post) => post.status === 'open').length;
            body.innerHTML = list.length === 0
                ? '<p class="text-sm text-ink-soft">You have not posted anything yet.</p>'
                : `<p class="mb-3 text-sm text-ink-soft">${openCount} of ${MAX_OPEN_WANTED} open posts used.</p><div class="space-y-3">${list.map(myPostHtml).join('')}</div>`;
        } catch (error) {
            body.innerHTML = '';
            body.appendChild(Ui.errorBanner(error.message, fill));
        }
    }

    body.addEventListener('click', async (event) => {
        const button = event.target.closest('[data-close-my]');
        if (!button) return;
        if (await closeWantedPost(button.dataset.closeMy)) fill();
    });
    fill();
}

// ---------- the side box (students) ----------

async function loadSideList() {
    const box = document.getElementById('side-list');
    try {
        const list = await Api.get('/interests/my');
        if (list.length === 0) {
            box.innerHTML = '<p class="text-sm text-ink-soft">No messes yet. Press Interested on a mess you like.</p>';
            return;
        }
        box.innerHTML = list.slice(0, 5).map((mess) => `
                <a href="${SITE_ROOT}pages/mess-details.html?id=${mess.mess_id}" class="block rounded-lg px-2 py-2 hover:bg-page">
                    <p class="truncate text-sm font-medium">${Ui.escape(mess.mess_name)}</p>
                    <p class="truncate text-xs text-ink-soft">${Ui.escape(mess.area_name)}</p>
                </a>`).join('')
            + `<a href="${SITE_ROOT}pages/interested.html" class="mt-2 block px-2 text-sm font-medium text-link hover:underline">See all (${list.length})</a>`;
    } catch (error) {
        box.innerHTML = '<p class="text-sm text-red-700">Could not load the list.</p>';
    }
}

// ---------- the right box: the best rated messes (everybody) ----------

async function loadTopList() {
    const box = document.getElementById('top-list');
    try {
        const result = await Api.get('/messes', { sort: 'rating', limit: 4 });
        box.innerHTML = result.data.length === 0
            ? '<p class="text-sm text-ink-soft">No mess has a review yet.</p>'
            : result.data.map((mess) => `
                <a href="${SITE_ROOT}pages/mess-details.html?id=${mess.mess_id}" class="block rounded-lg px-2 py-2 hover:bg-page">
                    <p class="truncate text-sm font-medium">${Ui.escape(mess.mess_name)}</p>
                    <p class="flex items-center gap-2 text-xs text-ink-soft">${Ui.stars(Number(mess.avg_rating), mess.review_count)}<span class="truncate">${Ui.escape(mess.area_name)}</span></p>
                </a>`).join('')
              + `<a href="${SITE_ROOT}pages/browse.html" class="mt-2 block px-2 text-sm font-medium text-link hover:underline">Browse all</a>`;
    } catch (error) {
        box.innerHTML = '<p class="text-sm text-red-700">Could not load the list.</p>';
    }
}

// ---------- the left box: who you are and where you can go ----------

function renderLeftBox() {
    const link = (icon, label, page) => `
        <a href="${SITE_ROOT}pages/${page}" class="flex items-center gap-3 rounded-lg px-3 py-2 text-sm hover:bg-page">
            <i class="fa-solid ${icon} w-5 text-center text-ochre"></i>${label}
        </a>`;

    if (!user) {
        document.getElementById('left').innerHTML = `
            <section class="rounded-xl border border-line bg-white p-4">
                <h2 class="font-semibold">Join Mess Finder</h2>
                <p class="mt-1 text-sm text-ink-soft">Login to comment, to post and to chat with managers.</p>
                <a href="${loginUrl()}" class="mt-3 flex h-10 items-center justify-center rounded-lg bg-espresso text-sm font-medium text-white hover:bg-espresso-hover">Login</a>
                <a href="${SITE_ROOT}pages/register.html" class="mt-2 flex h-10 items-center justify-center rounded-lg border border-line bg-white text-sm font-medium hover:bg-page">Create an account</a>
            </section>`;
        return;
    }

    const links = isStudent
        ? link('fa-house', 'My mess', 'my-mess.html') + link('fa-heart', 'Interested', 'interested.html')
            + link('fa-calendar-check', 'My visits', 'my-visits.html') + link('fa-flag', 'Complaints', 'complaints.html')
        : link('fa-gauge', 'Dashboard', 'manager/dashboard.html') + link('fa-bullhorn', 'My posts', 'manager/posts.html')
            + link('fa-heart', 'Interested students', 'manager/interested.html') + link('fa-calendar-check', 'Visit requests', 'manager/visits.html');

    document.getElementById('left').innerHTML = `
        <section class="rounded-xl border border-line bg-white p-4 text-center">
            <div class="flex justify-center">${Ui.avatar(user.full_name, 'h-16 w-16 text-xl')}</div>
            <p class="mt-3 truncate font-semibold">${Ui.escape(user.full_name)}</p>
            <p class="truncate text-xs text-ink-soft">${Ui.escape(user.email)}</p>
            <div class="mt-2">${Ui.badge(user.role.charAt(0).toUpperCase() + user.role.slice(1), 'ochre')}</div>
        </section>
        <nav class="mt-2 rounded-xl border border-line bg-white p-2">${links}</nav>`;
}

// ---------- the lists for the filter and the form ----------

// there can be thousands of areas and universities, so they are searched, not listed
function loadLists() {
    Ui.picker(areaSelect, { path: '/reference/areas', idKey: 'area_id', labelOf: (a) => a.area_name, anyLabel: 'Any area' });
    areaSelect.value = filters.area_id;     // the address may have chosen an area
    if (isStudent) {
        Ui.picker(document.getElementById('wanted-area'), { path: '/reference/areas', idKey: 'area_id', labelOf: (a) => a.area_name, anyLabel: 'Any area' });
        Ui.picker(document.getElementById('wanted-university'), { path: '/reference/universities', idKey: 'university_id', labelOf: (u) => u.short_name, anyLabel: 'Any university' });
    }
}

// ---------- start ----------

renderComposer();
renderLeftBox();

// the "write a post" card sits in the left box on wide screens, on top of the feed on smaller screens
const wideScreen = window.matchMedia('(min-width: 1280px)');
function placeComposer() {
    if (!document.body.contains(composerBox)) return;
    if (wideScreen.matches) document.getElementById('left').appendChild(composerBox);
    else document.getElementById('center').prepend(composerBox);
    composerBox.classList.toggle('mt-2', wideScreen.matches);
}
placeComposer();
wideScreen.addEventListener('change', placeComposer);
if (isStudent) loadSideList();
else document.getElementById('side-interested').remove();
loadTopList();

readAddress();
loadLists();
loadFeed();
