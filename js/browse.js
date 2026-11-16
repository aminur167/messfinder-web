// The Browse page: filters on the left, mess cards on the right.
// The chosen filters are kept in the address of the page (?area_id=3&type=boys), so the Back button,
// a reload and a shared link all show the same list.

Layout.start({ active: 'browse', title: 'Browse messes' });

const form = document.getElementById('filter-form');
const results = document.getElementById('results');
const pagination = document.getElementById('pagination');
const sortSelect = document.getElementById('sort');
const searchBox = document.getElementById('search-q');
const nearSelect = document.getElementById('near_university_id');
const kmSelect = document.getElementById('km');

let currentPage = 1;
let lastRequest = 0;      // every request gets a number, an old answer that arrives late is ignored
let nearWas = '';         // the "Nearby" university before the last change

// ---------- reading and writing the filters ----------

// The form fields that go to the API as they are (name in the form = name in the API)
const SIMPLE_FIELDS = ['university_id', 'area_id', 'min_rent', 'max_rent', 'min_rating', 'near_university_id'];
const CHECKBOX_FIELDS = ['has_meal', 'utility_included', 'only_free'];

// Everything the user chose, as a list of name/value pairs (empty values left out)
function collectParams() {
    const params = new URLSearchParams();
    const add = (name, value) => { if (value !== '' && value !== null && value !== undefined) params.set(name, value); };

    add('q', searchBox.value.trim());
    SIMPLE_FIELDS.forEach((name) => add(name, form.elements[name].value));
    add('type', form.elements.type.value);
    CHECKBOX_FIELDS.forEach((name) => { if (form.elements[name].checked) params.set(name, '1'); });

    const facilities = [...form.querySelectorAll('input[name="facility"]:checked')].map((box) => box.value);
    if (facilities.length > 0) params.set('facility_ids', facilities.join(','));

    if (nearSelect.value !== '') params.set('km', kmSelect.value);
    if (sortSelect.value !== 'newest') params.set('sort', sortSelect.value);
    return params;
}

// Puts the values of the address into the form (when the page opens)
function fillFormFrom(params) {
    searchBox.value = params.get('q') || '';
    SIMPLE_FIELDS.forEach((name) => { form.elements[name].value = params.get(name) || ''; });
    form.elements.type.value = params.get('type') || '';
    CHECKBOX_FIELDS.forEach((name) => { form.elements[name].checked = params.get(name) === '1'; });

    const chosen = (params.get('facility_ids') || '').split(',');
    form.querySelectorAll('input[name="facility"]').forEach((box) => { box.checked = chosen.includes(box.value); });

    kmSelect.value = params.get('km') || '3';
    updateNearState();                      // first, so the "Nearest" option exists when the sort is chosen
    sortSelect.value = params.get('sort') || 'newest';
    nearWas = nearSelect.value;
    currentPage = Number(params.get('page')) || 1;
}

// "Nearest" can only be used with a chosen university, and the distance list too
function updateNearState() {
    const hasNear = nearSelect.value !== '';
    kmSelect.disabled = !hasNear;

    const nearestOption = sortSelect.querySelector('option[value="nearest"]');
    if (hasNear && !nearestOption) {
        sortSelect.insertAdjacentHTML('afterbegin', '<option value="nearest">Sort: Nearest</option>');
    }
    if (!hasNear && nearestOption) {
        nearestOption.remove();
        if (sortSelect.value === 'nearest') sortSelect.value = 'newest';
    }
}

// How many filters are on (shown on the Filters button of phones)
function showFilterCount(params) {
    const names = [...SIMPLE_FIELDS, 'type', ...CHECKBOX_FIELDS, 'facility_ids'];
    const count = names.filter((name) => params.has(name)).length;
    const badge = document.getElementById('filter-count');
    badge.textContent = count;
    badge.classList.toggle('hidden', count === 0);
}

// ---------- loading the list ----------

async function loadMesses() {
    const params = collectParams();
    showFilterCount(params);

    // keep the address in step with the filters (without adding a history entry for each change)
    const shown = new URLSearchParams(params);
    if (currentPage > 1) shown.set('page', currentPage);
    history.replaceState(null, '', location.pathname + (shown.toString() ? '?' + shown.toString() : ''));

    // the API wants other names for two of the fields
    const request = Object.fromEntries(params);
    request.page = currentPage;
    request.limit = 12;

    const myNumber = ++lastRequest;
    results.innerHTML = MessCard.skeleton().repeat(6);
    try {
        const answer = await Api.get('/messes', request);
        if (myNumber !== lastRequest) return;

        document.getElementById('result-title').textContent =
            answer.total === 0 ? 'Browse messes' : `${answer.total} ${answer.total === 1 ? 'mess' : 'messes'} found`;

        if (answer.data.length === 0) {
            results.innerHTML = `<div class="sm:col-span-2 xl:col-span-3">${Ui.empty({
                icon: 'fa-solid fa-house-circle-xmark',
                title: 'No mess matches these filters',
                text: 'Try a bigger area, a higher rent or fewer facilities.',
                buttonHtml: '<button type="button" id="empty-clear" class="h-10 rounded-lg bg-espresso px-4 text-sm font-medium text-white hover:bg-espresso-hover">Clear all filters</button>',
            })}</div>`;
            document.getElementById('empty-clear').addEventListener('click', clearFilters);
            pagination.innerHTML = '';
            return;
        }

        results.innerHTML = answer.data.map(MessCard.html).join('');
        Ui.renderPagination(pagination, answer.page, answer.total_pages, (number) => {
            currentPage = number;
            loadMesses();
            window.scrollTo({ top: 0 });
        });
    } catch (error) {
        if (myNumber !== lastRequest) return;
        results.innerHTML = '';
        const banner = Ui.errorBanner(error.message, loadMesses);
        banner.classList.add('sm:col-span-2', 'xl:col-span-3');
        results.appendChild(banner);
        pagination.innerHTML = '';
    }
}

// A change of a filter starts again from the first page
function filtersChanged() {
    currentPage = 1;
    updateNearState();

    // the first time a university is chosen for "Nearby", the nearest mess comes first
    if (nearSelect.value !== '' && nearWas === '' && sortSelect.value === 'newest') {
        sortSelect.value = 'nearest';
    }
    nearWas = nearSelect.value;
    loadMesses();
}

function clearFilters() {
    form.reset();
    searchBox.value = '';
    kmSelect.value = '3';
    sortSelect.value = 'newest';
    filtersChanged();
}

// ---------- the lists inside the filter (universities and areas are searched, facilities are listed) ----------

async function loadFilterLists() {
    try {
        // there can be thousands of universities and areas, so they are searched, not listed
        Ui.picker(form.elements.university_id, { path: '/reference/universities', idKey: 'university_id', labelOf: (u) => u.short_name, anyLabel: 'Any university' });
        Ui.picker(nearSelect, { path: '/reference/universities', idKey: 'university_id', labelOf: (u) => 'From ' + u.short_name, anyLabel: 'Not used' });
        Ui.picker(form.elements.area_id, { path: '/reference/areas', idKey: 'area_id', labelOf: (a) => a.area_name, anyLabel: 'Any area' });
        const facilities = await Api.get('/reference/facilities');
        document.getElementById('facility-list').innerHTML = facilities
            .map((f) => `
                <label class="flex items-center gap-2">
                    <input type="checkbox" name="facility" value="${f.facility_id}" class="accent-espresso">
                    <i class="fa-solid ${Ui.facilityIcon(f.facility_name)} w-4 text-center text-ink-soft"></i>${Ui.escape(f.facility_name)}
                </label>`)
            .join('');
    } catch (error) {
        document.getElementById('facility-list').innerHTML = '<p class="text-red-700">Could not load the lists.</p>';
    }
}

// ---------- the panel of phones ----------

const panel = document.getElementById('filters');
const backdrop = document.getElementById('filter-backdrop');

function setPanel(open) {
    panel.classList.toggle('open', open);
    backdrop.classList.toggle('hidden', !open);
    document.body.classList.toggle('no-scroll', open);
}
document.getElementById('open-filters').addEventListener('click', () => setPanel(true));
document.getElementById('close-filters').addEventListener('click', () => setPanel(false));
document.getElementById('apply-filters').addEventListener('click', () => setPanel(false));
backdrop.addEventListener('click', () => setPanel(false));

// ---------- start ----------

form.addEventListener('change', filtersChanged);
form.addEventListener('submit', (event) => { event.preventDefault(); filtersChanged(); });
sortSelect.addEventListener('change', filtersChanged);
document.getElementById('clear-filters').addEventListener('click', clearFilters);

// the search box waits a little after the last key, so it does not ask the server for every letter
let typingTimer;
searchBox.addEventListener('input', () => {
    clearTimeout(typingTimer);
    typingTimer = setTimeout(filtersChanged, 400);
});

MessCard.activateHearts(results);

(async () => {
    await loadFilterLists();             // the options must exist before the address can choose them
    fillFormFrom(new URLSearchParams(location.search));
    loadMesses();
})();
