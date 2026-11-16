// The home page: the search bar, the latest seat posts and the top-rated messes.

Layout.start({ active: 'home', title: 'Mess Finder' });

const latestPosts = document.getElementById('latest-posts');
const topMesses = document.getElementById('top-messes');

// ---------- the search bar ----------

// there can be thousands of universities and areas, so they are searched, not listed
function fillSearchLists() {
    Ui.picker(document.getElementById('search-university'), { path: '/reference/universities', idKey: 'university_id', labelOf: (u) => u.short_name, anyLabel: 'Any university' });
    Ui.picker(document.getElementById('search-area'), { path: '/reference/areas', idKey: 'area_id', labelOf: (a) => a.area_name, anyLabel: 'Any area' });
}

// The search goes to the Browse page with the chosen filters in the address
document.getElementById('search-form').addEventListener('submit', (event) => {
    event.preventDefault();
    const params = new URLSearchParams();
    const university = document.getElementById('search-university').value;
    const area = document.getElementById('search-area').value;
    const rent = document.getElementById('search-rent').value;
    if (university) params.set('university_id', university);
    if (area) params.set('area_id', area);
    if (rent) params.set('max_rent', rent);
    location.href = SITE_ROOT + 'pages/browse.html' + (params.toString() ? '?' + params.toString() : '');
});

// ---------- latest seat posts ----------

function postCardHtml(post) {
    const rents = post.seats.map((seat) => seat.monthly_rent);
    const seatLine = post.seats.length > 0
        ? `${post.seats.length} ${post.seats.length === 1 ? 'seat' : 'seats'} from ${Ui.money(Math.min(...rents))}`
        : 'Seats not listed';
    return `
        <a href="${SITE_ROOT}pages/newsfeed.html" class="flex flex-col gap-2 rounded-xl border border-line bg-white p-4 shadow-sm hover:border-mute">
            <div class="flex items-center justify-between gap-2">
                ${Ui.badge(post.mess_type === 'girls' ? 'Girls' : 'Boys', 'slate')}
                <span class="text-xs text-ink-soft">${Ui.timeAgo(post.created_at)}</span>
            </div>
            <h3 class="font-semibold leading-snug">${Ui.escape(post.title)}</h3>
            <p class="text-sm text-ink-soft"><i class="fa-solid fa-building mr-1.5 text-ochre"></i>${Ui.escape(post.author_name)}, ${Ui.escape(post.area_name)}</p>
            <p class="text-sm"><i class="fa-solid fa-bed mr-1.5 text-ochre"></i>${seatLine}</p>
            <p class="text-sm text-ink-soft"><i class="fa-regular fa-calendar mr-1.5 text-ochre"></i>Available from ${Ui.date(post.date_from)}</p>
        </a>`;
}

async function loadLatestPosts() {
    latestPosts.innerHTML = Ui.skeleton(3, 'h-40');
    try {
        const result = await Api.get('/newsfeed', { type: 'vacancy', status: 'open', limit: 3 });
        if (result.data.length === 0) {
            latestPosts.innerHTML = `<div class="md:col-span-3">${Ui.empty({ icon: 'fa-regular fa-newspaper', title: 'No seat posts yet', text: 'New posts from managers will show up here.' })}</div>`;
            return;
        }
        latestPosts.innerHTML = result.data.map(postCardHtml).join('');
    } catch (error) {
        latestPosts.innerHTML = '';
        const banner = Ui.errorBanner(error.message, loadLatestPosts);
        banner.classList.add('md:col-span-3');
        latestPosts.appendChild(banner);
    }
}

// ---------- top-rated messes ----------

async function loadTopMesses() {
    topMesses.innerHTML = MessCard.skeleton().repeat(4);
    try {
        const result = await Api.get('/messes', { sort: 'rating', limit: 4 });
        if (result.data.length === 0) {
            topMesses.innerHTML = `<div class="sm:col-span-2 lg:col-span-4">${Ui.empty({ icon: 'fa-solid fa-building', title: 'No messes yet', text: 'Verified messes will show up here.' })}</div>`;
            return;
        }
        topMesses.innerHTML = result.data.map(MessCard.html).join('');
    } catch (error) {
        topMesses.innerHTML = '';
        const banner = Ui.errorBanner(error.message, loadTopMesses);
        banner.classList.add('sm:col-span-2', 'lg:col-span-4');
        topMesses.appendChild(banner);
    }
}

MessCard.activateHearts(topMesses);
fillSearchLists();
loadLatestPosts();
loadTopMesses();
