// Posts of the manager: a form to post a vacancy for the free seats (it shows on the Newsfeed),
// and the list of his own posts with the number of interested students and comments.
// A post can be closed. Posts: GET/POST /manager/posts, PATCH /manager/posts/:id/close.
// The page can be opened with  posts.html?new=1  (from the Dashboard) to start at the form.

Layout.start({ active: 'posts', title: 'Posts', roles: ['manager'] });

const postsBox = document.getElementById('posts');

const inputClass = 'h-11 w-full rounded-lg border border-line bg-white px-3 text-sm placeholder:text-mute focus:border-ochre focus:outline-none focus:ring-2 focus:ring-ochre/40';
const primaryButton = 'h-10 rounded-lg bg-espresso px-5 text-sm font-medium text-white hover:bg-espresso-hover disabled:opacity-70';

let freeRooms = [];         // the rooms that have free seats (for the checkboxes)

// today as 2026-12-01 (the computer's own day), for the date input
function todayText() {
    return new Date().toLocaleDateString('en-CA');
}

// ---------- the form ----------

function seatBoxesHtml() {
    if (freeRooms.length === 0) {
        return `<p class="rounded-lg bg-page px-4 py-4 text-sm text-ink-soft">You have no free seat to post. Add a seat in
            <a href="${SITE_ROOT}pages/manager/mess-setup.html#rooms" class="font-medium text-link hover:underline">Mess setup</a>
            or mark a member as left.</p>`;
    }
    return freeRooms.map((room) => `
        <div>
            <p class="mb-1 text-xs font-semibold text-ink-soft">Room ${Ui.escape(room.room_no)}</p>
            <div class="grid gap-2">
                ${room.seats.map((seat) => `
                    <label class="flex min-h-10 cursor-pointer items-center gap-2 rounded-lg border border-line px-3 text-sm hover:bg-page">
                        <input type="checkbox" name="seat" value="${seat.seat_id}" class="h-4 w-4 rounded border-line accent-espresso">
                        Seat ${Ui.escape(seat.seat_label)} <span class="ml-auto text-ink-soft">${Ui.money(seat.monthly_rent)}</span>
                    </label>`).join('')}
            </div>
        </div>`).join('');
}

function formHtml() {
    return `
        <form id="post-form" class="space-y-4 rounded-xl border border-line bg-white p-5" novalidate>
            <h2 class="font-semibold">New vacancy post</h2>
            <div>
                <label for="field-title" class="mb-1 block text-sm font-medium">Title</label>
                <input id="field-title" name="title" type="text" maxlength="150" placeholder="For example: 2 seats free near the university" class="${inputClass}">
                <p data-error-for="title" class="mt-1 text-xs text-red-600"></p>
            </div>
            <div>
                <label for="field-description" class="mb-1 block text-sm font-medium">Description <span class="font-normal text-ink-soft">(optional)</span></label>
                <textarea id="field-description" name="description" rows="3" maxlength="2000" placeholder="Tell students about the seats"
                    class="w-full rounded-lg border border-line bg-white px-3 py-2 text-sm placeholder:text-mute focus:border-ochre focus:outline-none focus:ring-2 focus:ring-ochre/40"></textarea>
                <p data-error-for="description" class="mt-1 text-xs text-red-600"></p>
            </div>
            <div>
                <label for="field-available_from" class="mb-1 block text-sm font-medium">Available from</label>
                <input id="field-available_from" name="available_from" type="date" value="${todayText()}" min="${todayText()}" class="${inputClass}">
                <p data-error-for="available_from" class="mt-1 text-xs text-red-600"></p>
            </div>
            <div>
                <span class="mb-2 block text-sm font-medium">Free seats in this post</span>
                <div id="seat-boxes" class="space-y-3">${seatBoxesHtml()}</div>
                <p data-error-for="seats" class="mt-1 text-xs text-red-600"></p>
            </div>
            <p id="form-message" class="hidden text-sm text-red-700"></p>
            <div class="flex justify-end">
                <button type="submit" class="${primaryButton}" ${freeRooms.length === 0 ? 'disabled' : ''}>Post vacancy</button>
            </div>
        </form>`;
}

async function savePost(event) {
    event.preventDefault();
    const form = event.target;
    Ui.clearFieldErrors(form);
    const message = document.getElementById('form-message');
    message.classList.add('hidden');

    let ok = true;
    const fail = (name, text) => { Ui.showFieldError(form, name, text); ok = false; };
    const title = form.elements.title.value.trim();
    const date = form.elements.available_from.value;
    const seatIds = [...form.querySelectorAll('input[name=seat]:checked')].map((box) => Number(box.value));

    if (title.length < 3) fail('title', 'Please write a title of at least 3 letters.');
    if (date === '' || date < todayText()) fail('available_from', 'Choose today or a later day.');
    if (seatIds.length === 0) fail('seats', 'Choose at least one seat.');
    if (!ok) return;

    const body = { title, available_from: date, seat_ids: seatIds };
    const description = form.elements.description.value.trim();
    if (description !== '') body.description = description;

    const button = form.querySelector('button[type=submit]');
    Ui.setLoading(button, true, 'Posting');
    try {
        await Api.post('/manager/posts', body);
        Ui.toast('Your post is on the Newsfeed');
        postPage = 1;           // the new post is the first one
        await loadPage();
    } catch (error) {
        message.textContent = error.message;       // for example: the mess is not verified yet
        message.classList.remove('hidden');
        Ui.setLoading(button, false);
    }
}

// ---------- my posts ----------

function postHtml(post) {
    const seats = post.seats.map((seat) => `<span class="rounded-lg bg-page px-2.5 py-1 text-xs font-medium">Room ${Ui.escape(seat.room_no)}, ${Ui.escape(seat.seat_label)} &middot; ${Ui.money(seat.monthly_rent)}</span>`).join('');
    const closeButton = post.status === 'open'
        ? `<button type="button" data-close-post="${post.post_id}" class="h-9 rounded-lg border border-line bg-white px-3 text-sm font-medium hover:bg-page">Close post</button>` : '';
    return `
        <article class="rounded-xl border border-line bg-white p-4 shadow-sm">
            <div class="flex items-start justify-between gap-3">
                <h3 class="min-w-0 font-semibold leading-snug">${Ui.escape(post.title)}</h3>
                ${Ui.statusBadge(post.status)}
            </div>
            <p class="mt-1 text-xs text-ink-soft">Posted ${Ui.timeAgo(post.created_at)} &middot; Available from ${Ui.date(post.date_from)}</p>
            ${post.description ? `<p class="mt-2 whitespace-pre-line break-words text-sm">${Ui.escape(post.description)}</p>` : ''}
            <div class="mt-3 flex flex-wrap gap-1.5">${seats}</div>
            <div class="mt-3 flex flex-wrap items-center gap-4 border-t border-line pt-3 text-sm">
                <span title="Interested students"><i class="fa-solid fa-heart mr-1.5 text-ochre"></i>${post.interest_count} interested</span>
                <span title="Comments"><i class="fa-regular fa-comment mr-1.5 text-ochre"></i>${post.comment_count} ${post.comment_count === 1 ? 'comment' : 'comments'}</span>
                <span class="ml-auto">${closeButton}</span>
            </div>
        </article>`;
}

let postPage = 1;

async function loadPosts() {
    const list = document.getElementById('post-list');
    const pages = document.getElementById('post-pages');
    list.innerHTML = Ui.skeleton(2, 'h-32');
    try {
        const answer = await Api.get('/manager/posts', { page: postPage, limit: 10 });
        if (answer.data.length === 0 && postPage > 1) {      // the last page is gone (the posts changed)
            postPage = Math.max(1, answer.total_pages);
            loadPosts();
            return;
        }
        list.innerHTML = answer.data.length === 0
            ? Ui.empty({ icon: 'fa-solid fa-bullhorn', title: 'No posts yet', text: 'Your vacancy posts will be listed here after you post.' })
            : answer.data.map(postHtml).join('');
        Ui.renderPagination(pages, answer.page, answer.total_pages, (page) => { postPage = page; loadPosts(); });
    } catch (error) {
        pages.innerHTML = '';
        list.innerHTML = '';
        list.appendChild(Ui.errorBanner(error.message, loadPosts));
    }
}

// ---------- the page ----------

async function loadPage() {
    postsBox.innerHTML = Ui.skeleton(2, 'h-48');
    try {
        // the free seats of the active rooms
        const data = await Api.get('/manager/rooms-seats');
        freeRooms = data.rooms
            .filter((room) => room.is_active)
            .map((room) => ({ ...room, seats: room.seats.filter((seat) => seat.status === 'available') }))
            .filter((room) => room.seats.length > 0);
    } catch (error) {
        if (error.status === 404) {
            // no mess yet
            postsBox.innerHTML = Ui.empty({
                icon: 'fa-solid fa-building',
                title: 'Set up your mess to get started',
                text: 'Create your mess and its seats first. Then you can post about free seats.',
                buttonHtml: `<a href="${SITE_ROOT}pages/manager/mess-setup.html" class="inline-flex h-10 items-center rounded-lg bg-espresso px-5 text-sm font-medium text-white hover:bg-espresso-hover">Create mess</a>`,
            });
        } else {
            postsBox.innerHTML = '';
            postsBox.appendChild(Ui.errorBanner(error.message, loadPage));
        }
        return;
    }

    postsBox.innerHTML = `
        <div class="grid gap-6 lg:grid-cols-5">
            <div class="lg:col-span-2">${formHtml()}</div>
            <section class="lg:col-span-3">
                <h2 class="mb-3 font-semibold">My posts</h2>
                <div id="post-list" class="space-y-3"></div>
                <div id="post-pages" class="mt-4"></div>
            </section>
        </div>`;
    document.getElementById('post-form').addEventListener('submit', savePost);
    loadPosts();
}

// Close post (after a question)
postsBox.addEventListener('click', async (event) => {
    const button = event.target.closest('[data-close-post]');
    if (!button) return;
    const sure = await Ui.confirm({
        title: 'Close this post',
        message: 'Students will not see it as open any more. This cannot be undone.',
        confirmText: 'Close post',
        danger: true,
    });
    if (!sure) return;
    button.disabled = true;
    try {
        await Api.patch(`/manager/posts/${button.dataset.closePost}/close`);
        Ui.toast('The post is closed');
        loadPosts();
    } catch (error) {
        Ui.toast(error.message, 'error');
        button.disabled = false;
    }
});

loadPage().then(() => {
    // from the Dashboard: start at the form
    if (new URLSearchParams(location.search).get('new')) {
        const title = document.getElementById('field-title');
        if (title) title.focus();
    }
});
