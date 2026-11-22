// Reviews of the manager: what the members wrote about the mess, with the average rating on top.
// A review can get one reply (PATCH /manager/reviews/:id/reply). The list is GET /manager/reviews, 10 on a page.

Layout.start({ active: 'reviews', title: 'Reviews', roles: ['manager'] });

const summaryBox = document.getElementById('summary');
const listBox = document.getElementById('list');
const pagesBox = document.getElementById('pagination');

let currentPage = 1;

// ---------- the summary on top ----------

function summaryHtml(summary) {
    if (summary.review_count === 0) return '';
    // the three small averages (a review may leave them empty, then the average is null)
    const small = [['Cleanliness', summary.cleanliness], ['Safety', summary.safety], ['Food', summary.food]]
        .filter(([, value]) => value !== null)
        .map(([label, value]) => `<div><p class="text-xs text-ink-soft">${label}</p>${Ui.stars(Number(value))}</div>`)
        .join('');
    return `
        <section class="flex flex-wrap items-center gap-x-8 gap-y-3 rounded-xl border border-line border-t-2 border-t-ochre bg-white p-4 shadow-sm">
            <div>
                <p class="text-3xl font-semibold">${Number(summary.overall).toFixed(1)}</p>
                ${Ui.stars(Number(summary.overall))}
                <p class="mt-1 text-xs text-ink-soft">${summary.review_count} ${summary.review_count === 1 ? 'review' : 'reviews'}</p>
            </div>
            <div class="flex flex-wrap gap-x-6 gap-y-2">${small}</div>
        </section>`;
}

// ---------- one review ----------

function reviewHtml(review) {
    const parts = [['Cleanliness', review.cleanliness_rating], ['Safety', review.safety_rating], ['Food', review.food_rating]]
        .filter(([, value]) => value !== null)
        .map(([label, value]) => `<span class="text-xs text-ink-soft">${label} ${Ui.stars(value)}</span>`)
        .join('');
    const typeBadge = Ui.badge(review.reviewer_type, review.reviewer_type === 'Current member' ? 'ochre' : 'slate');

    // a reply is shown in a grey box; a review without a reply gets a small form
    const reply = review.manager_reply !== null
        ? `
            <div class="mt-3 rounded-lg bg-page px-4 py-3 text-sm">
                <p class="mb-1 text-xs font-semibold text-ink-soft"><i class="fa-solid fa-reply mr-1"></i>Your reply &middot; ${Ui.date(review.replied_at)}</p>
                <p class="whitespace-pre-line break-words">${Ui.escape(review.manager_reply)}</p>
            </div>`
        : `
            <form data-reply-form="${review.review_id}" class="mt-3 space-y-2" novalidate>
                <label for="reply-${review.review_id}" class="block text-xs font-semibold text-ink-soft">Reply to this review (you can reply only once)</label>
                <textarea id="reply-${review.review_id}" name="reply" rows="2" maxlength="500" placeholder="Write a polite reply"
                    class="w-full rounded-lg border border-line bg-white px-3 py-2 text-sm placeholder:text-mute focus:border-ochre focus:outline-none focus:ring-2 focus:ring-ochre/40"></textarea>
                <p data-error-for="reply" class="text-xs text-red-600"></p>
                <div class="flex justify-end">
                    <button type="submit" class="h-9 rounded-lg bg-espresso px-4 text-sm font-medium text-white hover:bg-espresso-hover disabled:opacity-70">Reply</button>
                </div>
            </form>`;

    return `
        <article class="rounded-xl border border-line bg-white p-4 shadow-sm">
            <div class="flex items-start gap-3">
                ${Ui.avatar(review.reviewer_name, 'h-10 w-10 text-sm')}
                <div class="min-w-0 flex-1">
                    <p class="flex flex-wrap items-center gap-2"><span class="font-semibold">${Ui.escape(review.reviewer_name)}</span>${typeBadge}</p>
                    <p class="text-xs text-ink-soft">${Ui.date(review.created_at)}</p>
                </div>
                ${Ui.stars(review.rating)}
            </div>
            ${parts ? `<p class="mt-2 flex flex-wrap gap-x-4 gap-y-1">${parts}</p>` : ''}
            ${review.comment ? `<p class="mt-2 whitespace-pre-line break-words text-sm">${Ui.escape(review.comment)}</p>` : ''}
            ${reply}
        </article>`;
}

// ---------- loading ----------

async function loadReviews(page = 1) {
    currentPage = page;
    listBox.innerHTML = Ui.skeleton(3, 'h-32');
    try {
        const answer = await Api.get('/manager/reviews', { page, limit: 10 });
        summaryBox.innerHTML = summaryHtml(answer.summary);
        if (answer.data.length === 0) {
            listBox.innerHTML = Ui.empty({ icon: 'fa-regular fa-star', title: 'No reviews yet', text: 'Members and ex-members can review your mess. Their reviews will be shown here.' });
            pagesBox.innerHTML = '';
            return;
        }
        listBox.innerHTML = answer.data.map(reviewHtml).join('');
        Ui.renderPagination(pagesBox, answer.page, answer.total_pages, loadReviews);
    } catch (error) {
        summaryBox.innerHTML = '';
        pagesBox.innerHTML = '';
        if (error.status === 404) {
            // no mess yet
            listBox.innerHTML = Ui.empty({
                icon: 'fa-solid fa-building',
                title: 'Set up your mess to get started',
                text: 'Reviews come after your mess has members.',
                buttonHtml: `<a href="${SITE_ROOT}pages/manager/mess-setup.html" class="inline-flex h-10 items-center rounded-lg bg-espresso px-5 text-sm font-medium text-white hover:bg-espresso-hover">Create mess</a>`,
            });
        } else {
            listBox.innerHTML = '';
            listBox.appendChild(Ui.errorBanner(error.message, () => loadReviews(page)));
        }
    }
}

// send a reply
listBox.addEventListener('submit', async (event) => {
    const form = event.target.closest('[data-reply-form]');
    if (!form) return;
    event.preventDefault();
    Ui.clearFieldErrors(form);

    const text = form.elements.reply.value.trim();
    if (text === '') {
        Ui.showFieldError(form, 'reply', 'Please write your reply.');
        return;
    }
    const button = form.querySelector('button[type=submit]');
    Ui.setLoading(button, true, 'Sending');
    try {
        await Api.patch(`/manager/reviews/${form.dataset.replyForm}/reply`, { reply: text });
        Ui.toast('Your reply is saved');
        loadReviews(currentPage);
    } catch (error) {
        Ui.showFieldError(form, 'reply', error.message);       // for example: already replied
        Ui.setLoading(button, false);
    }
});

loadReviews();
