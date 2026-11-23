// Reports of the admin: money summary, messes and free seats in every area, the best rated messes,
// and the new members of the last 12 months. The two charts are drawn with Chart.js
// (loaded in reports.html). The numbers come from GET /admin/reports.

Layout.start({ active: 'reports', title: 'Reports', roles: ['admin'] });

const pageBox = document.getElementById('admin-page');

// the colours of the theme (the same as js/tailwind-config.js)
const ESPRESSO = '#322D27';
const OCHRE = '#BF8440';

let charts = [];            // the drawn charts, so that they can be removed before drawing again

// ---------- the pieces ----------

function moneyCardHtml(icon, label, value) {
    return `
        <div class="rounded-xl border border-line border-t-2 border-t-ochre bg-white p-4 shadow-sm">
            <p class="flex items-center gap-2 text-xs font-medium text-ink-soft"><i class="fa-solid ${icon} text-ochre"></i>${label}</p>
            <p class="mt-2 text-xl font-semibold sm:text-2xl">${value}</p>
        </div>`;
}

function chartCardHtml(title, note, canvasId, height) {
    return `
        <section class="min-w-0 rounded-xl border border-line bg-white p-4 shadow-sm">
            <h2 class="text-sm font-semibold">${title}</h2>
            <p class="mb-3 text-xs text-ink-soft">${note}</p>
            <div class="relative" style="height: ${height}px"><canvas id="${canvasId}"></canvas></div>
        </section>`;
}

function topRatedHtml(list) {
    const body = list.length === 0
        ? '<p class="px-4 py-8 text-center text-sm text-ink-soft">No mess has a review yet.</p>'
        : list.map((mess) => `
            <a href="${SITE_ROOT}pages/mess-details.html?id=${mess.mess_id}" class="flex items-center gap-3 px-4 py-3 hover:bg-page">
                <span class="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-ochre-soft text-sm font-semibold text-ochre-dark">${mess.ranking}</span>
                <span class="min-w-0 flex-1">
                    <span class="block truncate text-sm font-medium">${Ui.escape(mess.mess_name)}</span>
                    <span class="block text-xs text-ink-soft">${Ui.escape(mess.area_name)}</span>
                </span>
                ${Ui.stars(Number(mess.avg_rating), mess.review_count)}
            </a>`).join('');
    return `
        <section class="rounded-xl border border-line bg-white shadow-sm">
            <div class="border-b border-line px-4 py-3"><h2 class="text-sm font-semibold">Top rated messes</h2></div>
            <div class="divide-y divide-line">${body}</div>
        </section>`;
}

// "2026-11" -> "Nov 26"
function shortMonth(text) {
    const day = new Date(text + '-01T00:00:00');
    return day.toLocaleDateString('en-GB', { month: 'short', year: '2-digit' });
}

// ---------- the charts ----------

function drawCharts(data) {
    charts.forEach((chart) => chart.destroy());
    charts = [];
    if (typeof Chart === 'undefined') {
        // Chart.js comes from the internet; without it the page still shows the numbers
        document.querySelectorAll('canvas').forEach((canvas) => {
            canvas.parentElement.innerHTML = '<p class="text-sm text-ink-soft">The chart could not be loaded. Please check the internet and reload the page.</p>';
        });
        return;
    }
    Chart.defaults.font.family = "Inter, 'Hind Siliguri', system-ui, sans-serif";
    Chart.defaults.color = '#7F7265';

    // areas: verified messes and free seats side by side (horizontal bars)
    charts.push(new Chart(document.getElementById('area-chart'), {
        type: 'bar',
        data: {
            labels: data.areas.map((area) => area.area_name),
            datasets: [
                { label: 'Verified messes', data: data.areas.map((area) => area.verified_messes), backgroundColor: ESPRESSO, borderRadius: 4 },
                { label: 'Free seats', data: data.areas.map((area) => Number(area.free_seats)), backgroundColor: OCHRE, borderRadius: 4 },
            ],
        },
        options: {
            indexAxis: 'y',
            maintainAspectRatio: false,
            scales: { x: { beginAtZero: true, ticks: { precision: 0 } }, y: { grid: { display: false } } },
            plugins: { legend: { position: 'bottom' } },
        },
    }));

    // new members per month (the backend gives all 12 months, also the empty ones)
    charts.push(new Chart(document.getElementById('member-chart'), {
        type: 'line',
        data: {
            labels: data.new_members_per_month.map((item) => shortMonth(item.month)),
            datasets: [{
                label: 'New members',
                data: data.new_members_per_month.map((item) => item.new_members),
                borderColor: ESPRESSO,
                backgroundColor: OCHRE,
                pointBackgroundColor: OCHRE,
                tension: 0.25,
            }],
        },
        options: {
            maintainAspectRatio: false,
            scales: { y: { beginAtZero: true, ticks: { precision: 0 } }, x: { grid: { display: false } } },
            plugins: { legend: { display: false } },
        },
    }));
}

// ---------- the page ----------

async function loadReports() {
    pageBox.innerHTML = `
        <div class="grid grid-cols-2 gap-3 lg:grid-cols-5">${Ui.skeleton(5, 'h-24')}</div>
        <div class="grid gap-4 lg:grid-cols-2">${Ui.skeleton(2, 'h-72')}</div>`;
    try {
        const data = await Api.get('/admin/reports');
        const money = data.money;
        const areaHeight = Math.max(220, data.areas.length * 44 + 60);

        pageBox.innerHTML = `
            <div>
                <h2 class="text-lg font-semibold">Reports</h2>
                <p class="text-sm text-ink-soft">The numbers of all messes together.</p>
            </div>
            <div class="grid grid-cols-2 gap-3 lg:grid-cols-5">
                ${moneyCardHtml('fa-scale-balanced', 'Total outstanding', Ui.money(money.total_outstanding))}
                ${moneyCardHtml('fa-sack-dollar', 'Collected this month', Ui.money(money.collected_this_month))}
                ${moneyCardHtml('fa-clock', 'Overdue dues', money.overdue_dues)}
                ${moneyCardHtml('fa-users', 'Active members', Number(money.active_members))}
                ${moneyCardHtml('fa-door-open', 'Free seats', Number(money.free_seats))}
            </div>
            <div class="grid gap-4 lg:grid-cols-2">
                ${chartCardHtml('Messes and free seats by area', 'Verified messes and the seats that are free now.', 'area-chart', areaHeight)}
                <div class="min-w-0 space-y-4">
                    ${chartCardHtml('New members each month', 'The last 12 months.', 'member-chart', 240)}
                    ${topRatedHtml(data.top_rated)}
                </div>
            </div>`;
        drawCharts(data);
    } catch (error) {
        pageBox.innerHTML = '';
        pageBox.appendChild(Ui.errorBanner(error.message, loadReports));
    }
}

loadReports();
