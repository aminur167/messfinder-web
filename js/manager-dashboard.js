// The Dashboard of the manager: six overview cards, the occupancy bar, the members who owe the most,
// the recent activity and two quick actions. A manager without a mess sees a card to create one.
// The numbers come from GET /manager/dashboard (the backend answers 404 when there is no mess yet).

Layout.start({ active: 'dashboard', title: 'Dashboard', roles: ['manager'] });

const dashboardBox = document.getElementById('dashboard');

const messSetupLink = SITE_ROOT + 'pages/manager/mess-setup.html';
const membersLink = SITE_ROOT + 'pages/manager/members.html';

// ---------- the pieces of the page ----------

// The bar at the top when the admin has not verified the mess yet, or has suspended it
function statusBannerHtml(status) {
    if (status === 'pending') {
        return `
            <div class="flex items-start gap-3 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
                <i class="fa-solid fa-hourglass-half mt-0.5"></i>
                <span><strong>Pending verification.</strong> The admin has not verified your mess yet. Students cannot find it until then.</span>
            </div>`;
    }
    if (status === 'suspended') {
        return `
            <div class="flex items-start gap-3 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
                <i class="fa-solid fa-ban mt-0.5"></i>
                <span><strong>Suspended.</strong> The admin has suspended your mess, so students cannot see it. Please contact the admin.</span>
            </div>`;
    }
    return '';
}

// One short sentence with an icon ("Your daily insights" strip on top of the page)
function insightHtml(icon, text) {
    return `
        <div class="flex items-center gap-3 rounded-xl border border-line bg-white px-4 py-3 shadow-sm">
            <span class="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-ochre-soft text-ochre"><i class="fa-solid ${icon}"></i></span>
            <p class="text-sm">${text}</p>
        </div>`;
}

function insightsHtml(stats, activity, unreadChats) {
    const total = Number(stats.total_seats) || 0;
    const free = Number(stats.free_seats) || 0;
    const owing = Number(stats.members_with_dues) || 0;
    const waiting = activity.pending_visits + unreadChats;

    const seats = total === 0
        ? 'You have not added any seat yet.'
        : free === 0 ? 'All <strong>' + total + '</strong> seats are filled.' : '<strong>' + free + '</strong> of ' + total + ' seats are free.';
    const money = owing === 0
        ? 'Nobody owes you money.'
        : '<strong>' + owing + '</strong> ' + (owing === 1 ? 'member owes' : 'members owe') + ' you <strong>' + Ui.money(stats.total_outstanding) + '</strong>.';
    const work = waiting === 0
        ? 'No visit request or message is waiting.'
        : '<strong>' + activity.pending_visits + '</strong> visit ' + (activity.pending_visits === 1 ? 'request' : 'requests') + ' and <strong>' + unreadChats + '</strong> unread ' + (unreadChats === 1 ? 'message' : 'messages') + '.';

    return `
        <div class="grid gap-3 md:grid-cols-3">
            ${insightHtml('fa-bed', seats)}
            ${insightHtml('fa-scale-balanced', money)}
            ${insightHtml('fa-bell', work)}
        </div>`;
}

// One of the six cards. The small ochre line on top is the accent of the theme.
function statCardHtml(icon, label, value) {
    return `
        <div class="rounded-xl border border-line border-t-2 border-t-ochre bg-white p-4 shadow-sm">
            <p class="flex items-center gap-2 text-xs font-medium text-ink-soft"><i class="fa-solid ${icon} text-ochre"></i>${label}</p>
            <p class="mt-2 text-2xl font-semibold">${value}</p>
        </div>`;
}

function occupancyHtml(stats) {
    const total = Number(stats.total_seats) || 0;
    const booked = Number(stats.booked_seats) || 0;
    const percent = total > 0 ? Math.round((booked / total) * 100) : 0;
    const text = total > 0 ? `${booked} of ${total} seats filled (${percent}%)` : 'No seats yet. Add rooms and seats in Mess setup.';
    return `
        <section class="rounded-xl border border-line bg-white p-4 shadow-sm">
            <h2 class="text-sm font-semibold">Occupancy</h2>
            <p class="mt-1 text-sm text-ink-soft">${text}</p>
            <div class="mt-3 h-3 w-full overflow-hidden rounded-full bg-page" role="progressbar" aria-valuenow="${percent}" aria-valuemin="0" aria-valuemax="100">
                <div class="h-full rounded-full bg-espresso" style="width: ${percent}%"></div>
            </div>
        </section>`;
}

// The members who owe the most (the top five from the backend)
function duesHtml(topDues) {
    let rows;
    if (topDues.length === 0) {
        rows = '<p class="px-4 py-8 text-center text-sm text-ink-soft"><i class="fa-regular fa-circle-check mr-1 text-ochre"></i>Nobody owes money right now.</p>';
    } else {
        rows = topDues.map((member) => `
            <a href="${membersLink}" class="flex items-center gap-3 px-4 py-3 hover:bg-page">
                ${Ui.avatar(member.full_name)}
                <span class="min-w-0 flex-1">
                    <span class="block truncate text-sm font-medium">${Ui.escape(member.full_name)}</span>
                    <span class="block truncate text-xs text-ink-soft">Room ${Ui.escape(member.room_no)}, seat ${Ui.escape(member.seat_label)}</span>
                </span>
                ${Ui.statusBadge(member.current_month_status)}
                <span class="w-20 shrink-0 text-right text-sm font-semibold text-red-700">${Ui.money(member.outstanding)}</span>
            </a>`).join('');
    }
    return `
        <section class="rounded-xl border border-line bg-white shadow-sm">
            <div class="flex items-center justify-between gap-3 border-b border-line px-4 py-3">
                <h2 class="text-sm font-semibold">Members with dues</h2>
                <a href="${membersLink}" class="text-sm font-medium text-link hover:underline">View all</a>
            </div>
            <div class="divide-y divide-line">${rows}</div>
        </section>`;
}

// One line of the recent activity: an icon, a short text and a link to the page that has the details
function activityLineHtml(icon, text, link) {
    return `
        <a href="${link}" class="flex items-center gap-3 px-4 py-3 text-sm hover:bg-page">
            <i class="fa-solid ${icon} w-5 text-center text-ochre"></i>
            <span class="min-w-0 flex-1">${text}</span>
            <i class="fa-solid fa-chevron-right text-xs text-mute"></i>
        </a>`;
}

function activityHtml(activity, unreadChats) {
    const lines = [];

    if (activity.new_interests_last_7_days > 0) {
        const names = activity.recent_interests.map((item) => Ui.escape(item.full_name)).join(', ');
        lines.push(activityLineHtml(
            'fa-heart',
            `<strong>${activity.new_interests_last_7_days}</strong> ${activity.new_interests_last_7_days === 1 ? 'student' : 'students'} showed interest in the last 7 days<span class="block truncate text-xs text-ink-soft">${names}</span>`,
            SITE_ROOT + 'pages/manager/interested.html'
        ));
    }
    if (unreadChats > 0) {
        lines.push(activityLineHtml('fa-comments', `<strong>${unreadChats}</strong> unread ${unreadChats === 1 ? 'message' : 'messages'}`, SITE_ROOT + 'pages/chat.html'));
    }
    if (activity.pending_visits > 0) {
        lines.push(activityLineHtml('fa-calendar-check', `<strong>${activity.pending_visits}</strong> visit ${activity.pending_visits === 1 ? 'request' : 'requests'} waiting for you`, SITE_ROOT + 'pages/manager/visits.html'));
    }

    const body = lines.length === 0
        ? '<p class="px-4 py-8 text-center text-sm text-ink-soft"><i class="fa-regular fa-bell mr-1 text-ochre"></i>Nothing new right now.</p>'
        : lines.join('');
    return `
        <section class="rounded-xl border border-line bg-white shadow-sm">
            <div class="border-b border-line px-4 py-3"><h2 class="text-sm font-semibold">Recent activity</h2></div>
            <div class="divide-y divide-line">${body}</div>
        </section>`;
}

function quickActionsHtml() {
    return `
        <div class="flex flex-wrap gap-2">
            <a href="${membersLink}?add=1" class="inline-flex h-10 items-center gap-2 rounded-lg bg-espresso px-4 text-sm font-medium text-white hover:bg-espresso-hover"><i class="fa-solid fa-user-plus"></i>Add member</a>
            <a href="${SITE_ROOT}pages/manager/posts.html?new=1" class="inline-flex h-10 items-center gap-2 rounded-lg border border-line bg-white px-4 text-sm font-medium hover:bg-page"><i class="fa-solid fa-bullhorn"></i>Post a vacancy</a>
        </div>`;
}

// The page of a manager who has no mess yet
function onboardingHtml() {
    return Ui.empty({
        icon: 'fa-solid fa-building',
        title: 'Set up your mess to get started',
        text: 'Add the details of your mess, then its rooms and seats. After the admin verifies it, students can find it.',
        buttonHtml: `<a href="${messSetupLink}" class="inline-flex h-10 items-center rounded-lg bg-espresso px-5 text-sm font-medium text-white hover:bg-espresso-hover">Create mess</a>`,
    });
}

// ---------- loading ----------

// The number of unread chat messages is not in the dashboard answer, so it is asked separately.
// If this fails the dashboard still works (it just shows no chat line).
async function loadUnreadChats() {
    try {
        const answer = await Api.get('/conversations/unread-count');
        return answer.unread;
    } catch (error) {
        return 0;
    }
}

async function loadDashboard() {
    dashboardBox.innerHTML = `
        <div class="grid grid-cols-2 gap-3 lg:grid-cols-3 xl:grid-cols-6">${Ui.skeleton(6, 'h-24')}</div>
        ${Ui.skeleton(1, 'h-20')}
        <div class="grid gap-4 lg:grid-cols-2">${Ui.skeleton(2, 'h-56')}</div>`;

    try {
        const [data, unreadChats] = await Promise.all([Api.get('/manager/dashboard'), loadUnreadChats()]);
        showDashboard(data, unreadChats);
    } catch (error) {
        if (error.status === 404) {
            dashboardBox.innerHTML = onboardingHtml();      // no mess yet
        } else {
            dashboardBox.innerHTML = '';
            dashboardBox.appendChild(Ui.errorBanner(error.message, loadDashboard));
        }
    }
}

function showDashboard(data, unreadChats) {
    // a mess without any room has no row in the view, so every number is 0
    const stats = data.stats || {};
    const cards = [
        statCardHtml('fa-bed', 'Total seats', Number(stats.total_seats) || 0),
        statCardHtml('fa-door-open', 'Free seats', Number(stats.free_seats) || 0),
        statCardHtml('fa-users', 'Active members', Number(stats.active_members) || 0),
        statCardHtml('fa-user-clock', 'Members with dues', Number(stats.members_with_dues) || 0),
        statCardHtml('fa-scale-balanced', 'Total outstanding', Ui.money(stats.total_outstanding)),
        statCardHtml('fa-sack-dollar', 'Collected this month', Ui.money(stats.collected_this_month)),
    ].join('');

    dashboardBox.innerHTML = `
        <div>
            <h2 class="text-lg font-semibold">${Ui.escape(data.mess.mess_name)}</h2>
            <p class="text-sm text-ink-soft">Here is how your mess is doing.</p>
        </div>
        ${statusBannerHtml(data.mess.status)}
        ${insightsHtml(stats, data.activity, unreadChats)}
        <div class="grid grid-cols-2 gap-3 lg:grid-cols-3 xl:grid-cols-6">${cards}</div>
        ${occupancyHtml(stats)}
        <div class="grid gap-4 lg:grid-cols-2">
            ${duesHtml(data.top_dues)}
            ${activityHtml(data.activity, unreadChats)}
        </div>
        ${quickActionsHtml()}`;
}

loadDashboard();
