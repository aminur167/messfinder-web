// The Mess details page: header with the contact buttons, six sections, a Quick info card,
// the review form for students who lived here, and the visit request box.
// The address is  mess-details.html?id=3

Layout.start({ active: 'browse', title: 'Mess details' });

const messId = Number(new URLSearchParams(location.search).get('id'));
const stateBox = document.getElementById('state');
const pageBox = document.getElementById('mess');

let mess = null;            // the answer of GET /messes/:id
let reviewPage = 1;

// who is looking at the page
const user = Auth.isLoggedIn() ? Auth.getUser() : null;
const isStudent = Boolean(user && user.role === 'student');
const loginLink = SITE_ROOT + 'pages/login.html?next=' + encodeURIComponent(location.href);

// ---------- small helpers ----------

function yesNo(value) {
    return value ? 'Yes' : 'No';
}

// A section title with an icon
function sectionTitle(icon, text) {
    return `<h2 class="mb-3 text-lg font-semibold"><i class="fa-solid ${icon} mr-2 text-ochre"></i>${text}</h2>`;
}

// A word in the sentence "Label: value" for the Pricing and History sections
function infoRow(label, value) {
    return `
        <div class="flex items-center justify-between gap-4 border-b border-line py-2.5 last:border-0">
            <dt class="text-sm text-ink-soft">${label}</dt>
            <dd class="text-sm font-semibold">${value}</dd>
        </div>`;
}

// ---------- the header ----------

// The buttons depend on who looks: a visitor, a student, or the manager and the admin
function actionButtonsHtml() {
    const secondary = 'inline-flex h-10 items-center justify-center gap-2 rounded-lg border border-line bg-white px-4 text-sm font-medium hover:bg-page';
    const primary = 'inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-espresso px-4 text-sm font-medium text-white hover:bg-espresso-hover';

    if (!user) {
        return `
            <a href="${loginLink}" class="${primary}"><i class="fa-solid fa-lock"></i> Login to contact</a>
            <a href="${loginLink}" class="${secondary}"><i class="fa-regular fa-calendar-check"></i> Request visit</a>`;
    }

    const call = `<a href="tel:+${Ui.escape(mess.contact_phone)}" class="${secondary}"><i class="fa-solid fa-phone"></i> Call</a>`;
    const whatsapp = `<a href="https://wa.me/${Ui.escape(mess.contact_whatsapp)}" target="_blank" rel="noopener" class="${secondary}"><i class="fa-brands fa-whatsapp"></i> WhatsApp</a>`;

    if (!isStudent) {
        // a manager or the admin can only read the numbers
        return mess.viewer.is_owner ? '' : call + whatsapp;
    }

    const interested = mess.viewer.is_interested;
    return `
        <button type="button" id="btn-chat" class="${primary}"><i class="fa-solid fa-comments"></i> Chat</button>
        ${call}${whatsapp}
        <button type="button" id="btn-interested" class="${secondary}">
            <i class="${interested ? 'fa-solid' : 'fa-regular'} fa-heart text-ochre"></i> <span>${interested ? 'Interested' : 'Mark interested'}</span>
        </button>
        <button type="button" id="btn-visit" class="${secondary}"><i class="fa-regular fa-calendar-check"></i> Request visit</button>`;
}

function renderHeader() {
    const verified = mess.status === 'verified'
        ? Ui.badge('Verified', 'green')
        : Ui.statusBadge(mess.status);
    const rating = mess.stats.review_count > 0
        ? Ui.stars(mess.stats.avg_rating, mess.stats.review_count)
        : '<span class="text-sm text-ink-soft">No reviews yet</span>';

    let notice = '';
    if (mess.viewer.is_owner) {
        notice = `
            <div class="mt-4 rounded-lg bg-ochre-soft px-4 py-3 text-sm text-ochre-dark">
                <i class="fa-solid fa-circle-info mr-1"></i> This is how students see your mess.
                ${mess.status !== 'verified' ? 'It is not shown to the public until the admin verifies it.' : ''}
            </div>`;
    }

    document.getElementById('header-card').innerHTML = `
        <div class="flex flex-wrap items-center gap-2">
            <h1 class="text-2xl font-semibold">${Ui.escape(mess.mess_name)}</h1>
            ${verified}
            ${Ui.badge(mess.mess_type === 'girls' ? 'Girls' : 'Boys', 'slate')}
        </div>
        <div class="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-ink-soft">
            <span><i class="fa-solid fa-location-dot mr-1.5 text-ochre"></i>${Ui.escape(mess.area_name)}</span>
            ${rating}
        </div>
        <div class="mt-4 flex flex-wrap gap-2">${actionButtonsHtml()}</div>
        ${notice}`;
}

// ---------- the sections ----------

function renderOverview() {
    const universities = mess.universities.length === 0 ? '' : `
        <h3 class="mb-2 mt-5 text-sm font-semibold">Near these universities</h3>
        <div class="flex flex-wrap gap-2">
            ${mess.universities.map((u) => `<span class="rounded-full bg-page px-3 py-1 text-sm" title="${Ui.escape(u.name)}">${Ui.escape(u.short_name)} <span class="text-ink-soft">${Number(u.distance_km).toFixed(1)} km</span></span>`).join('')}
        </div>`;

    document.getElementById('overview').innerHTML = `
        ${sectionTitle('fa-circle-info', 'Overview')}
        <p class="whitespace-pre-line text-sm leading-relaxed">${Ui.escape(mess.description || 'No description yet.')}</p>
        <h3 class="mb-1 mt-5 text-sm font-semibold">Rules</h3>
        <p class="whitespace-pre-line text-sm leading-relaxed text-ink-soft">${Ui.escape(mess.rules || 'No rules added.')}</p>
        <h3 class="mb-1 mt-5 text-sm font-semibold">Address</h3>
        <p class="text-sm text-ink-soft"><i class="fa-solid fa-location-dot mr-1.5 text-ochre"></i>${Ui.escape(mess.address)}</p>
        ${universities}`;
}

function seatChipHtml(seat) {
    if (seat.status === 'available') {
        return `<span class="rounded-lg bg-green-100 px-2.5 py-1 text-xs font-medium text-green-800">Seat ${Ui.escape(seat.seat_label)} &middot; ${Ui.money(seat.monthly_rent)}</span>`;
    }
    if (seat.status === 'booked') {
        return `<span class="rounded-lg bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-500">Seat ${Ui.escape(seat.seat_label)} &middot; Occupied</span>`;
    }
    return `<span class="rounded-lg border border-dashed border-line px-2.5 py-1 text-xs text-ink-soft">Seat ${Ui.escape(seat.seat_label)} &middot; Off</span>`;
}

function renderRooms(seatData) {
    const box = document.getElementById('rooms');
    const { summary, rooms } = seatData;

    if (rooms.length === 0) {
        box.innerHTML = sectionTitle('fa-bed', 'Rooms and seats') + '<p class="text-sm text-ink-soft">No rooms added yet.</p>';
        return;
    }

    const cards = rooms.map((room) => `
        <div class="rounded-lg border border-line p-3">
            <div class="flex items-center justify-between gap-2">
                <h3 class="font-semibold">Room ${Ui.escape(room.room_no)}</h3>
                <span class="text-xs text-ink-soft">Floor ${room.floor_no}</span>
            </div>
            <div class="mt-1 flex gap-3 text-xs text-ink-soft">
                ${room.has_attached_bath ? '<span><i class="fa-solid fa-bath mr-1 text-ochre"></i>Attached bath</span>' : ''}
                ${room.has_balcony ? '<span><i class="fa-solid fa-door-open mr-1 text-ochre"></i>Balcony</span>' : ''}
            </div>
            <div class="mt-3 flex flex-wrap gap-1.5">${room.seats.map(seatChipHtml).join('')}</div>
        </div>`).join('');

    box.innerHTML = `
        ${sectionTitle('fa-bed', 'Rooms and seats')}
        <p class="mb-3 text-sm"><span class="font-semibold">${summary.free} of ${summary.total} seats free</span>
            <span class="text-ink-soft">(${summary.booked} occupied)</span></p>
        <div class="grid gap-3 sm:grid-cols-2">${cards}</div>`;
}

function renderFacilities() {
    const list = mess.facilities.length === 0
        ? '<p class="text-sm text-ink-soft">No facilities added yet.</p>'
        : `<ul class="grid gap-2 sm:grid-cols-2">${mess.facilities.map((f) => `
            <li class="flex items-center gap-3 text-sm">
                <span class="flex h-8 w-8 items-center justify-center rounded-full bg-ochre-soft text-ochre"><i class="fa-solid ${Ui.facilityIcon(f.facility_name)}"></i></span>
                ${Ui.escape(f.facility_name)}
            </li>`).join('')}</ul>`;
    document.getElementById('facilities').innerHTML = sectionTitle('fa-wifi', 'Facilities') + list;
}

function renderPricing() {
    const s = mess.stats;
    const seatRent = s.min_rent === null ? 'Not set' : rentRange(s.min_rent, s.max_rent);
    document.getElementById('pricing').innerHTML = `
        ${sectionTitle('fa-tags', 'Pricing')}
        <dl>
            ${infoRow('Seat rent per month', seatRent)}
            ${infoRow('Meal', mess.has_meal ? Ui.money(mess.meal_cost_monthly) + ' per month' : 'Not available')}
            ${infoRow('Utility bills in the rent', yesNo(mess.utility_included))}
            ${infoRow('Advance (security deposit)', Ui.money(mess.advance_amount))}
        </dl>`;
}

// "৳3,000 - ৳4,500", or one amount when both are the same
function rentRange(min, max) {
    return Number(min) === Number(max) ? Ui.money(min) : Ui.money(min) + ' - ' + Ui.money(max);
}

function renderHistory() {
    const h = mess.history || {};
    document.getElementById('history').innerHTML = `
        ${sectionTitle('fa-clock-rotate-left', 'History')}
        <dl>
            ${infoRow('Started in', h.established_year || 'Not given')}
            ${infoRow('Members who stayed so far', h.total_members_ever ?? 0)}
            ${infoRow('Members living here now', h.current_members ?? 0)}
        </dl>`;
}

function renderQuickInfo() {
    const s = mess.stats;
    const secondary = 'flex h-10 w-full items-center justify-center gap-2 rounded-lg border border-line bg-white px-4 text-sm font-medium hover:bg-page';
    const primary = 'flex h-10 w-full items-center justify-center gap-2 rounded-lg bg-espresso px-4 text-sm font-medium text-white hover:bg-espresso-hover';

    let buttons = '';
    if (!user) {
        buttons = `<a href="${loginLink}" class="${primary}"><i class="fa-solid fa-lock"></i> Login to contact</a>`;
    } else if (isStudent) {
        buttons = `
            <button type="button" id="quick-chat" class="${primary}"><i class="fa-solid fa-comments"></i> Chat</button>
            <button type="button" id="quick-visit" class="${secondary}"><i class="fa-regular fa-calendar-check"></i> Request visit</button>`;
    }

    document.getElementById('quick-info').innerHTML = `
        <p class="text-sm text-ink-soft">Rent from</p>
        <p class="text-3xl font-semibold">${s.min_rent === null ? '-' : Ui.money(s.min_rent)}<span class="text-sm font-normal text-ink-soft"> / month</span></p>
        <dl class="mt-3">
            ${infoRow('Free seats', s.free_seats > 0 ? Ui.badge(s.free_seats + ' free', 'green') : Ui.badge('Full', 'slate'))}
            ${infoRow('Advance', Ui.money(mess.advance_amount))}
            ${infoRow('Meal', yesNo(mess.has_meal))}
        </dl>
        <div class="mt-4 space-y-2">${buttons}</div>`;
}

// ---------- reviews ----------

// One bar of the rating summary: label, a bar as long as the average, and the number
function ratingBar(label, value) {
    const width = value ? Math.round((value / 5) * 100) : 0;
    return `
        <div class="flex items-center gap-3 text-sm">
            <span class="w-24 shrink-0 text-ink-soft">${label}</span>
            <div class="h-2 flex-1 rounded-full bg-page"><div class="h-2 rounded-full bg-ochre" style="width: ${width}%"></div></div>
            <span class="w-8 text-right font-medium">${value ? Number(value).toFixed(1) : '-'}</span>
        </div>`;
}

function reviewHtml(review) {
    const reply = review.manager_reply ? `
        <div class="mt-3 rounded-lg bg-page px-4 py-3 text-sm">
            <p class="mb-1 text-xs font-semibold text-ink-soft"><i class="fa-solid fa-reply mr-1"></i>Reply from the manager</p>
            <p class="whitespace-pre-line">${Ui.escape(review.manager_reply)}</p>
        </div>` : '';
    return `
        <article class="border-b border-line py-4 last:border-0">
            <div class="flex items-center gap-3">
                ${Ui.avatar(review.reviewer_name)}
                <div class="min-w-0">
                    <p class="flex flex-wrap items-center gap-2 text-sm font-semibold">${Ui.escape(review.reviewer_name)}
                        ${Ui.badge(review.reviewer_type, review.reviewer_type === 'Current member' ? 'ochre' : 'slate')}</p>
                    <p class="text-xs text-ink-soft">${Ui.date(review.created_at)}</p>
                </div>
                <div class="ml-auto">${Ui.stars(review.rating)}</div>
            </div>
            ${review.comment ? `<p class="mt-2 whitespace-pre-line text-sm">${Ui.escape(review.comment)}</p>` : ''}
            ${reply}
        </article>`;
}

// The form for a student who lived here and has not written a review yet
function reviewFormHtml() {
    const picker = (id, label, required) => `
        <div class="flex flex-wrap items-center justify-between gap-2">
            <span class="text-sm">${label}${required ? '' : ' <span class="text-ink-soft">(optional)</span>'}</span>
            <div id="${id}"></div>
        </div>`;
    return `
        <form id="review-form" class="mb-5 space-y-3 rounded-lg border border-line bg-page p-4" novalidate>
            <h3 class="font-semibold">Write a review</h3>
            <p class="text-sm text-ink-soft">You lived here, so your review helps the next student. You can write one review for a mess.</p>
            ${picker('pick-rating', 'Overall rating', true)}
            ${picker('pick-clean', 'Cleanliness', false)}
            ${picker('pick-safety', 'Safety', false)}
            ${picker('pick-food', 'Food', false)}
            <div>
                <label for="review-comment" class="mb-1 block text-sm">Your experience <span class="text-ink-soft">(optional)</span></label>
                <textarea id="review-comment" rows="3" maxlength="500" class="w-full rounded-lg border border-line bg-white p-3 text-sm focus:border-ochre focus:outline-none focus:ring-2 focus:ring-ochre/40"></textarea>
            </div>
            <p id="review-error" class="hidden text-sm text-red-700"></p>
            <button type="submit" class="h-10 rounded-lg bg-espresso px-5 text-sm font-medium text-white hover:bg-espresso-hover disabled:opacity-70">Submit review</button>
        </form>`;
}

function activateReviewForm() {
    const form = document.getElementById('review-form');
    if (!form) return;
    const pickers = {
        rating: Ui.starPicker(document.getElementById('pick-rating'), 'Overall rating'),
        cleanliness_rating: Ui.starPicker(document.getElementById('pick-clean'), 'Cleanliness'),
        safety_rating: Ui.starPicker(document.getElementById('pick-safety'), 'Safety'),
        food_rating: Ui.starPicker(document.getElementById('pick-food'), 'Food'),
    };
    const error = document.getElementById('review-error');

    form.addEventListener('submit', async (event) => {
        event.preventDefault();
        error.classList.add('hidden');
        if (pickers.rating.get() === 0) {
            error.textContent = 'Please choose the overall rating.';
            error.classList.remove('hidden');
            return;
        }
        const body = { mess_id: messId, comment: document.getElementById('review-comment').value.trim() };
        Object.entries(pickers).forEach(([name, picker]) => { if (picker.get() > 0) body[name] = picker.get(); });

        const button = form.querySelector('button[type=submit]');
        Ui.setLoading(button, true, 'Sending');
        try {
            await Api.post('/reviews', body);
            Ui.toast('Thank you, your review is saved');
            await loadPage();                 // the form goes away and the new review shows up
        } catch (problem) {
            error.textContent = problem.message;
            error.classList.remove('hidden');
            Ui.setLoading(button, false);
        }
    });
}

async function renderReviews() {
    const box = document.getElementById('reviews');
    let answer;
    try {
        answer = await Api.get(`/messes/${messId}/reviews`, { page: reviewPage, limit: 5 });
    } catch (error) {
        box.innerHTML = sectionTitle('fa-star', 'Reviews');
        box.appendChild(Ui.errorBanner(error.message, renderReviews));
        return;
    }

    const s = answer.summary;
    const summary = answer.total === 0 ? '' : `
        <div class="mb-4 flex flex-wrap items-center gap-6 rounded-lg bg-page p-4">
            <div class="text-center">
                <p class="text-4xl font-semibold">${Number(s.overall).toFixed(1)}</p>
                <div class="mt-1">${Ui.stars(s.overall)}</div>
                <p class="mt-1 text-xs text-ink-soft">${s.review_count} ${s.review_count === 1 ? 'review' : 'reviews'}</p>
            </div>
            <div class="min-w-48 flex-1 space-y-2">
                ${ratingBar('Cleanliness', s.cleanliness)}
                ${ratingBar('Safety', s.safety)}
                ${ratingBar('Food', s.food)}
            </div>
        </div>`;

    const form = mess.viewer.can_review ? reviewFormHtml() : '';
    const note = mess.viewer.has_reviewed
        ? '<p class="mb-3 rounded-lg bg-ochre-soft px-4 py-2 text-sm text-ochre-dark"><i class="fa-solid fa-circle-check mr-1"></i>You have already reviewed this mess.</p>' : '';
    const list = answer.total === 0
        ? Ui.empty({ icon: 'fa-regular fa-comment-dots', title: 'No reviews yet', text: 'Students who lived here can write the first review.' })
        : answer.data.map(reviewHtml).join('');

    box.innerHTML = `${sectionTitle('fa-star', 'Reviews')}${summary}${note}${form}<div>${list}</div><div id="review-pages" class="mt-4"></div>`;
    activateReviewForm();
    Ui.renderPagination(document.getElementById('review-pages'), answer.page, answer.total_pages, (number) => {
        reviewPage = number;
        renderReviews().then(() => document.getElementById('reviews').scrollIntoView());
    });
}

// ---------- the buttons ----------

// Chat: open (or find) the conversation, then go to the chat page
async function startChat(button) {
    Ui.setLoading(button, true, 'Opening');
    try {
        const chat = await Api.post('/conversations', { mess_id: messId });
        location.href = SITE_ROOT + 'pages/chat.html?id=' + chat.conversation_id;
    } catch (error) {
        Ui.toast(error.message, 'error');
        Ui.setLoading(button, false);
    }
}

async function toggleInterested(button) {
    button.disabled = true;
    try {
        const result = await Api.post('/interests/toggle', { mess_id: messId });
        mess.viewer.is_interested = result.is_interested;
        button.querySelector('i').className = (result.is_interested ? 'fa-solid' : 'fa-regular') + ' fa-heart text-ochre';
        button.querySelector('span').textContent = result.is_interested ? 'Interested' : 'Mark interested';
        Ui.toast(result.is_interested ? 'Added to your interested list' : 'Removed from your interested list');
    } catch (error) {
        Ui.toast(error.message, 'error');
    }
    button.disabled = false;
}

// The box for a visit request: a date and time, and a short note
function openVisitBox() {
    // the earliest time is one hour from now, written the way the input wants it (local time)
    const soon = new Date(Date.now() + 60 * 60 * 1000);
    soon.setMinutes(soon.getMinutes() - soon.getTimezoneOffset());
    const earliest = soon.toISOString().slice(0, 16);

    const box = Ui.modal({
        title: 'Request a visit',
        bodyHtml: `
            <p class="mb-4 text-sm text-ink-soft">Choose a time to see ${Ui.escape(mess.mess_name)}. The manager will confirm or suggest another time.</p>
            <form id="visit-form" class="space-y-4" novalidate>
                <div>
                    <label for="visit-time" class="mb-1 block text-sm font-medium">Date and time</label>
                    <input id="visit-time" type="datetime-local" min="${earliest}"
                        class="h-11 w-full rounded-lg border border-line bg-white px-3 text-sm focus:border-ochre focus:outline-none focus:ring-2 focus:ring-ochre/40">
                </div>
                <div>
                    <label for="visit-note" class="mb-1 block text-sm font-medium">Note <span class="font-normal text-ink-soft">(optional)</span></label>
                    <textarea id="visit-note" rows="3" maxlength="255" placeholder="For example: I will come with a friend"
                        class="w-full rounded-lg border border-line bg-white p-3 text-sm placeholder:text-mute focus:border-ochre focus:outline-none focus:ring-2 focus:ring-ochre/40"></textarea>
                </div>
                <p id="visit-error" class="hidden text-sm text-red-700"></p>
                <div class="flex justify-end gap-2">
                    <button type="button" data-close class="h-10 rounded-lg border border-line bg-white px-4 text-sm font-medium hover:bg-page">Cancel</button>
                    <button type="submit" class="h-10 rounded-lg bg-espresso px-4 text-sm font-medium text-white hover:bg-espresso-hover disabled:opacity-70">Send request</button>
                </div>
            </form>`,
    });

    const form = box.element.querySelector('#visit-form');
    const error = box.element.querySelector('#visit-error');
    form.addEventListener('submit', async (event) => {
        event.preventDefault();
        error.classList.add('hidden');
        const time = form.querySelector('#visit-time').value;
        if (time === '') {
            error.textContent = 'Please choose a date and time.';
            error.classList.remove('hidden');
            return;
        }
        const button = form.querySelector('button[type=submit]');
        Ui.setLoading(button, true, 'Sending');
        try {
            await Api.post('/visits', {
                mess_id: messId,
                visit_time: time.replace('T', ' '),
                student_note: form.querySelector('#visit-note').value.trim(),
            });
            box.close();
            Ui.toast('Visit request sent. The manager will answer soon.');
        } catch (problem) {
            error.textContent = problem.message;
            error.classList.remove('hidden');
            Ui.setLoading(button, false);
        }
    });
}

// One listener for the buttons of the header and of the Quick info card
pageBox.addEventListener('click', (event) => {
    const button = event.target.closest('button');
    if (!button) return;
    if (button.id === 'btn-chat' || button.id === 'quick-chat') startChat(button);
    if (button.id === 'btn-interested') toggleInterested(button);
    if (button.id === 'btn-visit' || button.id === 'quick-visit') openVisitBox();
});

// ---------- the section tabs ----------

const tabs = [...document.querySelectorAll('[data-tab]')];

function markActiveTab(name) {
    tabs.forEach((tab) => {
        const on = tab.dataset.tab === name;
        tab.classList.toggle('border-ochre', on);
        tab.classList.toggle('text-ink', on);
        tab.classList.toggle('border-transparent', !on);
        tab.classList.toggle('text-ink-soft', !on);
    });
}

// The last section whose top has passed the tab bar is the active one
function followScroll() {
    let current = tabs[0].dataset.tab;
    tabs.forEach((tab) => {
        const section = document.getElementById(tab.dataset.tab);
        if (section.getBoundingClientRect().top <= 140) current = tab.dataset.tab;
    });
    markActiveTab(current);
}
let scrollWaiting = false;
window.addEventListener('scroll', () => {
    if (scrollWaiting) return;
    scrollWaiting = true;
    requestAnimationFrame(() => { followScroll(); scrollWaiting = false; });
});

// ---------- loading the page ----------

function showState(html) {
    pageBox.classList.add('hidden');
    stateBox.classList.remove('hidden');
    stateBox.innerHTML = html;
}

async function loadPage() {
    if (!Number.isInteger(messId) || messId < 1) {
        showState(Ui.empty({
            icon: 'fa-solid fa-house-circle-xmark', title: 'Mess not found', text: 'This address has no mess number.',
            buttonHtml: `<a href="${SITE_ROOT}pages/browse.html" class="inline-flex h-10 items-center rounded-lg bg-espresso px-4 text-sm font-medium text-white hover:bg-espresso-hover">Browse messes</a>`,
        }));
        return;
    }

    showState(Ui.skeleton(1, 'h-32') + Ui.skeleton(1, 'h-12') + Ui.skeleton(3, 'h-40'));
    try {
        const [details, seatData] = await Promise.all([
            Api.get(`/messes/${messId}`),
            Api.get(`/messes/${messId}/seats`),
        ]);
        mess = details;
        document.title = mess.mess_name + ' | Mess Finder';

        stateBox.classList.add('hidden');
        pageBox.classList.remove('hidden');
        renderHeader();
        renderOverview();
        renderRooms(seatData);
        renderFacilities();
        renderPricing();
        renderHistory();
        renderQuickInfo();
        reviewPage = 1;
        await renderReviews();
        followScroll();
    } catch (error) {
        if (error.status === 404) {
            showState(Ui.empty({
                icon: 'fa-solid fa-house-circle-xmark', title: 'Mess not found', text: 'This mess does not exist, or it is not verified yet.',
                buttonHtml: `<a href="${SITE_ROOT}pages/browse.html" class="inline-flex h-10 items-center rounded-lg bg-espresso px-4 text-sm font-medium text-white hover:bg-espresso-hover">Browse messes</a>`,
            }));
        } else {
            showState('');
            stateBox.appendChild(Ui.errorBanner(error.message, loadPage));
        }
    }
}

loadPage();
