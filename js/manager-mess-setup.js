// Mess setup of the manager. Two tabs:
//   Mess info         the form of the mess (create with POST /manager/mess, change with PUT /manager/mess)
//   Rooms and seats   rooms and seats of the mess (add, change the rent, switch off and on)
// A manager has one mess only. Before it exists the Rooms tab asks him to save the mess info first.

Layout.start({ active: 'mess-setup', title: 'Mess setup', roles: ['manager'] });

const statusBanner = document.getElementById('status-banner');
const infoTab = document.getElementById('tab-info');
const roomsTab = document.getElementById('tab-rooms');

const inputClass = 'h-11 w-full rounded-lg border border-line bg-white px-3 text-sm placeholder:text-mute focus:border-ochre focus:outline-none focus:ring-2 focus:ring-ochre/40';
const textareaClass = 'w-full rounded-lg border border-line bg-white px-3 py-2 text-sm placeholder:text-mute focus:border-ochre focus:outline-none focus:ring-2 focus:ring-ochre/40';
const primaryButton = 'h-10 rounded-lg bg-espresso px-5 text-sm font-medium text-white hover:bg-espresso-hover disabled:opacity-70';
const secondaryButton = 'h-10 rounded-lg border border-line bg-white px-4 text-sm font-medium hover:bg-page';

let mess = null;              // the mess of the manager (null until it is created)
let facilities = [];

let roomsData = null;         // the answer of GET /manager/rooms-seats
let emptyRooms = [];          // rooms added in this visit that have no seat yet (the backend list only shows rooms with seats)
const openRooms = new Set();  // the rooms that are open in the accordion
let roomsOpenedBefore = false;

// ---------- tabs ----------

function showTab(name) {
    document.querySelectorAll('[data-tab]').forEach((button) => {
        const active = button.dataset.tab === name;
        button.classList.toggle('border-ochre', active);
        button.classList.toggle('text-ink', active);
        button.classList.toggle('border-transparent', !active);
        button.classList.toggle('text-ink-soft', !active);
        button.setAttribute('aria-selected', active);
    });
    infoTab.classList.toggle('hidden', name !== 'info');
    roomsTab.classList.toggle('hidden', name !== 'rooms');
    if (name === 'rooms') loadRooms();
}

document.querySelectorAll('[data-tab]').forEach((button) => {
    button.addEventListener('click', () => showTab(button.dataset.tab));
});

// ---------- the status banner ----------

function renderStatusBanner() {
    if (!mess) {
        statusBanner.innerHTML = `
            <div class="flex items-start gap-3 rounded-lg border border-line bg-white px-4 py-3 text-sm">
                <i class="fa-solid fa-circle-info mt-0.5 text-ochre"></i>
                <span><strong>You have not created your mess yet.</strong> Fill the form below. The admin will check it before students can find it.</span>
            </div>`;
        return;
    }
    const banners = {
        pending: ['border-amber-200 bg-amber-50 text-amber-800', 'fa-hourglass-half', 'Pending verification.', 'The admin has not verified your mess yet. Students cannot find it until then.'],
        verified: ['border-green-200 bg-green-50 text-green-800', 'fa-circle-check', 'Verified.', 'Your mess is visible to students.'],
        suspended: ['border-red-200 bg-red-50 text-red-800', 'fa-ban', 'Suspended.', 'The admin has suspended your mess, so students cannot see it. Please contact the admin.'],
        closed: ['border-line bg-slate-100 text-slate-700', 'fa-lock', 'Closed.', 'This mess is closed and is not shown to students.'],
    };
    const [colours, icon, title, text] = banners[mess.status] || banners.closed;
    statusBanner.innerHTML = `
        <div class="flex items-start gap-3 rounded-lg border px-4 py-3 text-sm ${colours}">
            <i class="fa-solid ${icon} mt-0.5"></i>
            <span><strong>${title}</strong> ${text}</span>
        </div>`;
}

// =====================================================================
//  Tab 1: Mess info
// =====================================================================

// The phone is saved with the country code (8801711000000), but the manager writes 01711000000
function withoutCountryCode(phone) {
    if (!phone) return '';
    return phone.length === 13 && phone.startsWith('88') ? phone.slice(2) : phone;
}

function fieldHtml({ name, label, value = '', type = 'text', placeholder = '', help = '', maxlength = '', extra = '' }) {
    return `
        <div>
            <label for="field-${name}" class="mb-1 block text-sm font-medium">${label}</label>
            <input id="field-${name}" name="${name}" type="${type}" value="${Ui.escape(value)}" placeholder="${Ui.escape(placeholder)}" ${maxlength ? `maxlength="${maxlength}"` : ''} ${extra}
                class="${inputClass}">
            ${help ? `<p class="mt-1 text-xs text-ink-soft">${help}</p>` : ''}
            <p data-error-for="${name}" class="mt-1 text-xs text-red-600"></p>
        </div>`;
}

function textareaHtml({ name, label, value = '', rows = 3, maxlength = 5000, placeholder = '' }) {
    return `
        <div>
            <label for="field-${name}" class="mb-1 block text-sm font-medium">${label}</label>
            <textarea id="field-${name}" name="${name}" rows="${rows}" maxlength="${maxlength}" placeholder="${Ui.escape(placeholder)}" class="${textareaClass}">${Ui.escape(value)}</textarea>
            <p data-error-for="${name}" class="mt-1 text-xs text-red-600"></p>
        </div>`;
}

function checkboxHtml(name, label, checked) {
    return `
        <label class="flex min-h-10 cursor-pointer items-center gap-2 text-sm">
            <input type="checkbox" name="${name}" ${checked ? 'checked' : ''} class="h-4 w-4 rounded border-line accent-espresso">
            ${label}
        </label>`;
}

// One row of "nearby universities": a university and the distance in km.
// The university is searched (see startUniversityPickers), so the select starts empty.
function universityRowHtml(universityId, distance) {
    return `
        <div data-university-row class="flex items-center gap-2">
            <select data-university-select data-initial="${universityId || ''}" aria-label="University" class="${inputClass}"></select>
            <input data-university-distance type="number" min="0" max="100" step="0.1" value="${distance === undefined ? '' : Ui.escape(distance)}" placeholder="km" aria-label="Distance in km"
                class="${inputClass} !w-24 shrink-0">
            <button type="button" data-remove-university class="h-11 w-10 shrink-0 rounded-lg text-ink-soft hover:bg-page" aria-label="Remove this university"><i class="fa-solid fa-xmark"></i></button>
        </div>`;
}

function infoFormHtml() {
    const m = mess || {};
    const chosenFacilities = (m.facilities || []).map((item) => item.facility_id);
    const facilityBoxes = facilities.map((item) => `
        <label class="flex min-h-10 cursor-pointer items-center gap-2 rounded-lg border border-line px-3 text-sm hover:bg-page">
            <input type="checkbox" name="facility" value="${item.facility_id}" ${chosenFacilities.includes(item.facility_id) ? 'checked' : ''} class="h-4 w-4 rounded border-line accent-espresso">
            <i class="fa-solid ${Ui.facilityIcon(item.facility_name)} w-4 text-center text-ochre"></i>${Ui.escape(item.facility_name)}
        </label>`).join('');
    const universityRows = (m.universities || []).map((item) => universityRowHtml(item.university_id, item.distance_km)).join('');

    return `
        <form id="mess-form" class="space-y-5" novalidate>
            <div class="grid gap-5 lg:grid-cols-2 lg:items-start">
            <div class="space-y-5">
            <section class="space-y-4 rounded-xl border border-line bg-white p-5">
                <h2 class="font-semibold">About the mess</h2>
                ${fieldHtml({ name: 'mess_name', label: 'Mess name', value: m.mess_name, maxlength: 120, placeholder: 'For example: Rahman Boys Mess' })}
                <div class="grid gap-4 sm:grid-cols-2">
                    <div>
                        <label for="field-mess_type" class="mb-1 block text-sm font-medium">Type</label>
                        <select id="field-mess_type" name="mess_type" class="${inputClass}">
                            <option value="">Choose</option>
                            <option value="boys" ${m.mess_type === 'boys' ? 'selected' : ''}>Boys</option>
                            <option value="girls" ${m.mess_type === 'girls' ? 'selected' : ''}>Girls</option>
                        </select>
                        <p data-error-for="mess_type" class="mt-1 text-xs text-red-600"></p>
                    </div>
                    <div>
                        <label for="field-area_id" class="mb-1 block text-sm font-medium">Area</label>
                        <select id="field-area_id" name="area_id" class="${inputClass}"></select>
                        <p data-error-for="area_id" class="mt-1 text-xs text-red-600"></p>
                    </div>
                </div>
                ${fieldHtml({ name: 'address', label: 'Address', value: m.address, maxlength: 255, placeholder: 'House, road and area' })}
                ${textareaHtml({ name: 'description', label: 'Description <span class="font-normal text-ink-soft">(optional)</span>', value: m.description || '', placeholder: 'Tell students what is good about your mess' })}
                ${textareaHtml({ name: 'rules', label: 'Rules <span class="font-normal text-ink-soft">(optional)</span>', value: m.rules || '', placeholder: 'For example: gate closes at 11 pm' })}
                ${fieldHtml({ name: 'established_year', label: 'Started in <span class="font-normal text-ink-soft">(optional)</span>', value: m.established_year || '', type: 'number', placeholder: 'For example: 2018', extra: 'min="1950" max="' + new Date().getFullYear() + '"' })}
            </section>

            <section class="space-y-4 rounded-xl border border-line bg-white p-5">
                <h2 class="font-semibold">Facilities</h2>
                <div class="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">${facilityBoxes}</div>
            </section>
            </div>
            <div class="space-y-5">
            <section class="space-y-4 rounded-xl border border-line bg-white p-5">
                <h2 class="font-semibold">Contact</h2>
                <div class="grid gap-4 sm:grid-cols-2">
                    ${fieldHtml({ name: 'contact_phone', label: 'Contact phone', value: withoutCountryCode(m.contact_phone), type: 'tel', placeholder: '01712345678' })}
                    ${fieldHtml({ name: 'contact_whatsapp', label: 'WhatsApp <span class="font-normal text-ink-soft">(optional)</span>', value: withoutCountryCode(m.contact_whatsapp), type: 'tel', placeholder: '01712345678' })}
                </div>
            </section>

            <section class="space-y-4 rounded-xl border border-line bg-white p-5">
                <h2 class="font-semibold">Money and meals</h2>
                <div class="grid gap-4 sm:grid-cols-2">
                    ${fieldHtml({ name: 'advance_amount', label: 'Advance (৳)', value: m.advance_amount === undefined ? '' : Number(m.advance_amount), type: 'number', placeholder: '0', extra: 'min="0"', help: 'Money a new member pays when he joins. Write 0 if there is none.' })}
                    <div class="sm:pt-7">${checkboxHtml('utility_included', 'Utility bills are included in the rent', m.utility_included)}</div>
                </div>
                <div class="grid gap-4 sm:grid-cols-2">
                    <div class="sm:pt-2">${checkboxHtml('has_meal', 'The mess serves meals', m.has_meal)}</div>
                    <div id="meal-cost-box" class="${m.has_meal ? '' : 'hidden'}">
                        ${fieldHtml({ name: 'meal_cost_monthly', label: 'Meal cost per month (৳)', value: m.meal_cost_monthly === null || m.meal_cost_monthly === undefined ? '' : Number(m.meal_cost_monthly), type: 'number', extra: 'min="0"' })}
                    </div>
                </div>
            </section>

            <section class="space-y-4 rounded-xl border border-line bg-white p-5">
                <h2 class="font-semibold">Location</h2>
                <div class="grid gap-4 sm:grid-cols-2">
                    ${fieldHtml({ name: 'latitude', label: 'Latitude', value: m.latitude === undefined ? '' : Number(m.latitude), type: 'number', placeholder: '23.8103', extra: 'step="any"' })}
                    ${fieldHtml({ name: 'longitude', label: 'Longitude', value: m.longitude === undefined ? '' : Number(m.longitude), type: 'number', placeholder: '90.4125', extra: 'step="any"' })}
                </div>
                <p class="-mt-2 text-xs text-ink-soft">To find the two numbers, open Google Maps, right click on your building and click the numbers that appear.</p>
            </section>


            <section class="space-y-3 rounded-xl border border-line bg-white p-5">
                <h2 class="font-semibold">Nearby universities</h2>
                <p class="text-sm text-ink-soft">Choose the universities that are close and write the distance in km. Students can search by university.</p>
                <div id="university-rows" class="space-y-2">${universityRows}</div>
                <p data-error-for="universities" class="text-xs text-red-600"></p>
                <button type="button" id="add-university" class="${secondaryButton}"><i class="fa-solid fa-plus mr-1"></i>Add a university</button>
            </section>

            </div>
            </div>

            <p id="form-message" class="hidden text-sm text-red-700"></p>
            <div class="flex justify-end">
                <button type="submit" class="${primaryButton}">${mess ? 'Save changes' : 'Create mess'}</button>
            </div>
        </form>`;
}

// Turns the select of every new row into a search box (and shows the university that was saved before)
function startUniversityPickers() {
    document.querySelectorAll('[data-university-select]:not([data-ready])').forEach((select) => {
        Ui.picker(select, { path: '/reference/universities', idKey: 'university_id', labelOf: (u) => u.short_name + ' - ' + u.name, anyLabel: 'Choose a university', wrapperClass: 'min-w-0 flex-1' });
        select.dataset.ready = '1';
        if (select.dataset.initial) select.value = select.dataset.initial;
    });
}

function renderInfoTab() {
    infoTab.innerHTML = infoFormHtml();
    const form = document.getElementById('mess-form');

    // the area and the universities are searched (there can be thousands)
    Ui.picker(form.elements.area_id, { path: '/reference/areas', idKey: 'area_id', labelOf: (a) => a.area_name, anyLabel: 'Choose an area' });
    if (mess) form.elements.area_id.value = mess.area_id;
    startUniversityPickers();

    // the meal cost is only asked when the mess serves meals
    form.elements.has_meal.addEventListener('change', () => {
        document.getElementById('meal-cost-box').classList.toggle('hidden', !form.elements.has_meal.checked);
    });

    document.getElementById('add-university').addEventListener('click', () => {
        document.getElementById('university-rows').insertAdjacentHTML('beforeend', universityRowHtml());
        startUniversityPickers();
    });
    document.getElementById('university-rows').addEventListener('click', (event) => {
        const remove = event.target.closest('[data-remove-university]');
        if (remove) remove.closest('[data-university-row]').remove();
    });

    form.addEventListener('submit', saveMess);
}

// Reads the form, checks it (the same rules as the backend) and gives the body to send.
// Returns null when something is wrong; the messages are put under the fields.
function readMessForm(form) {
    Ui.clearFieldErrors(form);
    let ok = true;
    const fail = (name, text) => { Ui.showFieldError(form, name, text); ok = false; };
    const value = (name) => form.elements[name].value.trim();

    const body = {
        mess_name: value('mess_name'),
        mess_type: value('mess_type'),
        area_id: value('area_id'),
        address: value('address'),
        description: value('description'),
        rules: value('rules'),
        contact_phone: value('contact_phone'),
        contact_whatsapp: value('contact_whatsapp'),
        has_meal: form.elements.has_meal.checked,
        utility_included: form.elements.utility_included.checked,
    };

    if (body.mess_name.length < 2) fail('mess_name', 'Please write the name of your mess.');
    if (body.mess_type === '') fail('mess_type', 'Please choose Boys or Girls.');
    if (body.area_id === '') fail('area_id', 'Please choose an area.');
    if (body.address.length < 5) fail('address', 'Please write the address (at least 5 letters).');

    const phonePattern = /^(?:\+?88)?(01[3-9]\d{8})$/;
    if (!phonePattern.test(body.contact_phone.replace(/[\s-]/g, ''))) fail('contact_phone', 'Write a mobile number like 01712345678.');
    if (body.contact_whatsapp !== '' && !phonePattern.test(body.contact_whatsapp.replace(/[\s-]/g, ''))) fail('contact_whatsapp', 'Write a mobile number like 01712345678.');

    const year = value('established_year');
    if (year !== '') {
        body.established_year = Number(year);
        if (!(body.established_year >= 1950 && body.established_year <= new Date().getFullYear())) fail('established_year', 'The year must be from 1950 to this year.');
    }

    const advance = value('advance_amount');
    body.advance_amount = advance === '' ? 0 : Number(advance);
    if (!(body.advance_amount >= 0)) fail('advance_amount', 'The advance cannot be less than 0.');

    if (body.has_meal) {
        const cost = value('meal_cost_monthly');
        body.meal_cost_monthly = cost === '' ? null : Number(cost);
        if (cost === '' || !(body.meal_cost_monthly >= 0)) fail('meal_cost_monthly', 'Write the meal cost, or untick "serves meals".');
    }

    const latitude = value('latitude');
    const longitude = value('longitude');
    body.latitude = Number(latitude);
    body.longitude = Number(longitude);
    if (latitude === '' || !(body.latitude >= -90 && body.latitude <= 90)) fail('latitude', 'Latitude is a number from -90 to 90.');
    if (longitude === '' || !(body.longitude >= -180 && body.longitude <= 180)) fail('longitude', 'Longitude is a number from -180 to 180.');

    body.facility_ids = [...form.querySelectorAll('input[name=facility]:checked')].map((box) => Number(box.value));

    // the nearby universities (an empty row is ignored, the same university cannot be added twice)
    body.universities = [];
    form.querySelectorAll('[data-university-row]').forEach((row) => {
        const id = row.querySelector('[data-university-select]').value;
        const distance = row.querySelector('[data-university-distance]').value;
        if (id === '' && distance === '') return;
        if (id === '' || distance === '' || !(Number(distance) >= 0 && Number(distance) <= 100)) {
            fail('universities', 'Choose a university and a distance from 0 to 100 km for every row.');
            return;
        }
        if (body.universities.some((item) => item.university_id === Number(id))) {
            fail('universities', 'A university is added twice.');
            return;
        }
        body.universities.push({ university_id: Number(id), distance_km: Number(distance) });
    });

    if (!ok) {
        // take the manager to the first mistake
        const first = form.querySelector('[data-error-for]:not(:empty)');
        if (first) first.scrollIntoView({ behavior: 'smooth', block: 'center' });
        return null;
    }
    body.area_id = Number(body.area_id);
    return body;
}

async function saveMess(event) {
    event.preventDefault();
    const form = event.target;
    const messageLine = document.getElementById('form-message');
    messageLine.classList.add('hidden');

    const body = readMessForm(form);
    if (!body) return;

    const isNew = mess === null;
    const button = form.querySelector('button[type=submit]');
    Ui.setLoading(button, true, 'Saving');
    try {
        mess = isNew ? await Api.post('/manager/mess', body) : await Api.put('/manager/mess', body);
        Ui.toast(isNew ? 'Your mess is created. The admin will verify it soon.' : 'Your changes are saved');
        renderStatusBanner();
        renderInfoTab();
        if (isNew) showTab('rooms');      // the next step: add the rooms and seats
    } catch (error) {
        messageLine.textContent = error.message;
        messageLine.classList.remove('hidden');
        Ui.setLoading(button, false);
    }
}

// =====================================================================
//  Tab 2: Rooms and seats
// =====================================================================

// The rooms of the backend and the rooms added in this visit that still have no seat
function allRooms() {
    const loadedIds = roomsData.rooms.map((room) => room.room_id);
    emptyRooms = emptyRooms.filter((room) => !loadedIds.includes(room.room_id));
    return [...roomsData.rooms, ...emptyRooms.map((room) => ({ ...room, seats: [] }))];
}

// A room that has no seat is only known to this page, so keep its newest details here
function rememberEmptyRoom(room) {
    emptyRooms = emptyRooms.filter((item) => item.room_id !== room.room_id);
    emptyRooms.push(room);
}

async function loadRooms() {
    if (!mess) {
        roomsTab.innerHTML = Ui.empty({
            icon: 'fa-solid fa-bed',
            title: 'Save your mess info first',
            text: 'Rooms and seats belong to your mess. Create the mess in the first tab, then come back here.',
            buttonHtml: `<button type="button" data-action="go-info" class="${primaryButton}">Go to Mess info</button>`,
        });
        return;
    }
    if (roomsData === null) roomsTab.innerHTML = Ui.skeleton(3, 'h-16');
    try {
        roomsData = await Api.get('/manager/rooms-seats');
        if (!roomsOpenedBefore && allRooms().length > 0) openRooms.add(allRooms()[0].room_id);
        roomsOpenedBefore = true;
        renderRooms();
    } catch (error) {
        roomsTab.innerHTML = '';
        roomsTab.appendChild(Ui.errorBanner(error.message, loadRooms));
    }
}

function floorText(floor) {
    if (floor === null || floor === undefined) return '';
    return Number(floor) === 0 ? 'Ground floor' : 'Floor ' + floor;
}

function seatStatusBadge(status) {
    if (status === 'available') return Ui.badge('Free', 'green');
    if (status === 'booked') return Ui.badge('Occupied', 'ochre');
    return Ui.statusBadge('inactive');
}

function seatRowHtml(seat) {
    const member = seat.member
        ? `<span class="font-medium">${Ui.escape(seat.member.full_name)}</span><span class="block text-xs text-ink-soft">${Ui.escape(seat.member.phone)}</span>`
        : '<span class="text-ink-soft">-</span>';
    const button = seat.status === 'inactive'
        ? `<button type="button" data-action="seat-activate" data-seat-id="${seat.seat_id}" class="h-9 rounded-lg border border-line bg-white px-3 text-sm font-medium hover:bg-page">Activate</button>`
        : `<button type="button" data-action="seat-deactivate" data-seat-id="${seat.seat_id}" class="h-9 rounded-lg border border-red-200 bg-white px-3 text-sm font-medium text-red-700 hover:bg-red-50">Deactivate</button>`;
    return `
        <tr class="border-t border-line">
            <td class="whitespace-nowrap px-3 py-2 font-medium">${Ui.escape(seat.seat_label)}</td>
            <td class="whitespace-nowrap px-3 py-2" data-rent-cell="${seat.seat_id}">
                ${Ui.money(seat.monthly_rent)}
                <button type="button" data-action="edit-rent" data-seat-id="${seat.seat_id}" data-rent="${Number(seat.monthly_rent)}" class="ml-1 h-8 w-8 rounded-lg text-ink-soft hover:bg-page" aria-label="Change the rent of seat ${Ui.escape(seat.seat_label)}"><i class="fa-solid fa-pen text-xs"></i></button>
            </td>
            <td class="whitespace-nowrap px-3 py-2">${seatStatusBadge(seat.status)}</td>
            <td class="whitespace-nowrap px-3 py-2">${member}</td>
            <td class="whitespace-nowrap px-3 py-2 text-right">${button}</td>
        </tr>`;
}

function roomHtml(room) {
    const isOpen = openRooms.has(room.room_id);
    const details = [floorText(room.floor_no), room.has_attached_bath ? 'Attached bath' : '', room.has_balcony ? 'Balcony' : ''].filter(Boolean).join(', ');
    const seatTable = room.seats.length === 0
        ? '<p class="rounded-lg bg-page px-4 py-6 text-center text-sm text-ink-soft">This room has no seat yet. Add the first seat.</p>'
        : `<div class="overflow-x-auto rounded-lg border border-line">
                <table class="w-full text-left text-sm">
                    <thead class="bg-slate-50 text-xs text-ink-soft">
                        <tr><th class="px-3 py-2 font-medium">Seat</th><th class="px-3 py-2 font-medium">Monthly rent</th><th class="px-3 py-2 font-medium">Status</th><th class="px-3 py-2 font-medium">Member</th><th class="px-3 py-2"></th></tr>
                    </thead>
                    <tbody>${room.seats.map(seatRowHtml).join('')}</tbody>
                </table>
            </div>`;
    const roomSwitch = room.is_active
        ? `<button type="button" data-action="room-deactivate" data-room-id="${room.room_id}" class="h-10 rounded-lg border border-red-200 bg-white px-4 text-sm font-medium text-red-700 hover:bg-red-50">Deactivate room</button>`
        : `<button type="button" data-action="room-activate" data-room-id="${room.room_id}" class="${secondaryButton}">Activate room</button>`;

    return `
        <div class="rounded-xl border border-line bg-white shadow-sm">
            <button type="button" data-action="toggle-room" data-room-id="${room.room_id}" aria-expanded="${isOpen}" class="flex min-h-14 w-full items-center gap-3 px-4 py-3 text-left">
                <i class="fa-solid fa-chevron-${isOpen ? 'down' : 'right'} w-4 text-xs text-ink-soft"></i>
                <span class="min-w-0 flex-1">
                    <span class="font-semibold">Room ${Ui.escape(room.room_no)}</span>
                    <span class="block truncate text-xs text-ink-soft">${Ui.escape(details) || 'No details'}</span>
                </span>
                ${room.is_active ? '' : Ui.statusBadge('inactive')}
                <span class="shrink-0 text-xs text-ink-soft">${room.seats.length} ${room.seats.length === 1 ? 'seat' : 'seats'}</span>
            </button>
            <div class="${isOpen ? '' : 'hidden'} space-y-3 border-t border-line p-4">
                ${seatTable}
                <div class="flex flex-wrap gap-2">
                    <button type="button" data-action="add-seat" data-room-id="${room.room_id}" class="${primaryButton}"><i class="fa-solid fa-plus mr-1"></i>Add seat</button>
                    <button type="button" data-action="edit-room" data-room-id="${room.room_id}" class="${secondaryButton}">Edit room</button>
                    ${roomSwitch}
                </div>
            </div>
        </div>`;
}

function renderRooms() {
    const rooms = allRooms();
    const summary = roomsData.summary;
    const summaryText = rooms.length === 0
        ? ''
        : `${summary.total} ${summary.total === 1 ? 'seat' : 'seats'}: ${summary.free} free, ${summary.booked} occupied, ${summary.inactive} inactive`;

    const list = rooms.length === 0
        ? Ui.empty({
            icon: 'fa-solid fa-bed',
            title: 'No rooms yet',
            text: 'Add your first room with its first seat. Students can see the free seats after the admin verifies your mess.',
            buttonHtml: `<button type="button" data-action="add-room" class="${primaryButton}">Add room</button>`,
        })
        : `<div class="space-y-3">${rooms.map(roomHtml).join('')}</div>`;

    const top = rooms.length === 0 ? '' : `
        <div class="flex flex-wrap items-center justify-between gap-3">
            <p class="text-sm text-ink-soft">${summaryText}</p>
            <button type="button" data-action="add-room" class="${primaryButton}"><i class="fa-solid fa-plus mr-1"></i>Add room</button>
        </div>
        <p class="rounded-lg bg-ochre-soft px-4 py-3 text-sm text-ochre-dark"><i class="fa-solid fa-circle-info mr-2"></i>When you change the rent of a seat, members who already live there keep the rent they joined with. The new rent is for new members only.</p>`;

    roomsTab.innerHTML = `<div class="space-y-4">${top}${list}</div>`;
}

// ---------- clicks on the rooms tab ----------

roomsTab.addEventListener('click', (event) => {
    const target = event.target.closest('[data-action]');
    if (!target) return;
    const roomId = Number(target.dataset.roomId);
    const seatId = Number(target.dataset.seatId);

    switch (target.dataset.action) {
        case 'go-info': showTab('info'); break;
        case 'toggle-room':
            if (openRooms.has(roomId)) openRooms.delete(roomId); else openRooms.add(roomId);
            renderRooms();
            break;
        case 'add-room': openRoomModal(null); break;
        case 'edit-room': openRoomModal(allRooms().find((room) => room.room_id === roomId)); break;
        case 'add-seat': openSeatModal(allRooms().find((room) => room.room_id === roomId)); break;
        case 'edit-rent': startRentEdit(target, seatId); break;
        case 'save-rent': saveRent(target, seatId); break;
        case 'cancel-rent': renderRooms(); break;
        case 'seat-deactivate': switchSeat(target, seatId, false); break;
        case 'seat-activate': switchSeat(target, seatId, true); break;
        case 'room-deactivate': switchRoom(target, roomId, false); break;
        case 'room-activate': switchRoom(target, roomId, true); break;
        default: break;
    }
});

// Enter saves the rent, Esc cancels it
roomsTab.addEventListener('keydown', (event) => {
    const input = event.target.closest('[data-rent-input]');
    if (!input) return;
    if (event.key === 'Enter') {
        event.preventDefault();
        input.parentElement.querySelector('[data-action=save-rent]').click();
    }
    if (event.key === 'Escape') renderRooms();
});

// ---------- the rent, inline ----------

function startRentEdit(button, seatId) {
    const cell = button.closest('[data-rent-cell]');
    cell.innerHTML = `
        <div class="flex items-center gap-1">
            <input data-rent-input type="number" min="1" max="1000000" value="${Ui.escape(button.dataset.rent)}" aria-label="New monthly rent" class="h-9 w-28 rounded-lg border border-line px-2 text-sm focus:border-ochre focus:outline-none focus:ring-2 focus:ring-ochre/40">
            <button type="button" data-action="save-rent" data-seat-id="${seatId}" class="h-9 rounded-lg bg-espresso px-3 text-sm font-medium text-white hover:bg-espresso-hover">Save</button>
            <button type="button" data-action="cancel-rent" class="h-9 rounded-lg border border-line bg-white px-3 text-sm font-medium hover:bg-page">Cancel</button>
        </div>`;
    cell.querySelector('input').focus();
}

async function saveRent(button, seatId) {
    const input = button.parentElement.querySelector('[data-rent-input]');
    const rent = Number(input.value);
    if (input.value === '' || !(rent >= 1 && rent <= 1000000)) {
        Ui.toast('The rent must be a number from 1 to 1,000,000', 'error');
        return;
    }
    Ui.setLoading(button, true, 'Saving');
    try {
        await Api.patch(`/manager/seats/${seatId}/rent`, { monthly_rent: rent });
        Ui.toast('The rent is changed');
        await loadRooms();
    } catch (error) {
        Ui.toast(error.message, 'error');
        Ui.setLoading(button, false);
    }
}

// ---------- switch a seat or a room off and on ----------

async function switchSeat(button, seatId, makeActive) {
    if (!makeActive) {
        const sure = await Ui.confirm({
            title: 'Deactivate this seat',
            message: 'The seat will not be shown to students. You can activate it again later.',
            confirmText: 'Deactivate',
            danger: true,
        });
        if (!sure) return;
    }
    button.disabled = true;
    try {
        await Api.patch(`/manager/seats/${seatId}/${makeActive ? 'activate' : 'deactivate'}`);
        Ui.toast(makeActive ? 'The seat is active again' : 'The seat is switched off');
        await loadRooms();
    } catch (error) {
        Ui.toast(error.message, 'error');      // for example: this seat has a member
        button.disabled = false;
    }
}

async function switchRoom(button, roomId, makeActive) {
    if (!makeActive) {
        const sure = await Ui.confirm({
            title: 'Deactivate this room',
            message: 'The room will not be shown to students. You can activate it again later.',
            confirmText: 'Deactivate',
            danger: true,
        });
        if (!sure) return;
    }
    button.disabled = true;
    try {
        const room = await Api.patch(`/manager/rooms/${roomId}/${makeActive ? 'activate' : 'deactivate'}`);
        if (emptyRooms.some((item) => item.room_id === roomId)) rememberEmptyRoom(room);
        Ui.toast(makeActive ? 'The room is active again' : 'The room is switched off');
        await loadRooms();
    } catch (error) {
        Ui.toast(error.message, 'error');      // for example: this room still has members
        button.disabled = false;
    }
}

// ---------- the room form (add and edit) ----------

function openRoomModal(room) {
    const isEdit = Boolean(room);
    const seatPart = isEdit ? '' : `
        <div class="border-t border-line pt-4">
            <p class="mb-3 text-sm text-ink-soft">A room needs at least one seat. Add the first seat now, more can be added later.</p>
            <div class="grid gap-4 sm:grid-cols-2">
                ${fieldHtml({ name: 'seat_label', label: 'Seat label', maxlength: 10, placeholder: 'A' })}
                ${fieldHtml({ name: 'monthly_rent', label: 'Monthly rent (৳)', type: 'number', placeholder: '3000', extra: 'min="1" max="1000000"' })}
            </div>
        </div>`;

    const box = Ui.modal({
        title: isEdit ? 'Edit room' : 'Add room',
        bodyHtml: `
            <form novalidate class="space-y-4">
                <div class="grid gap-4 sm:grid-cols-2">
                    ${fieldHtml({ name: 'room_no', label: 'Room number', value: isEdit ? room.room_no : '', maxlength: 10, placeholder: '101' })}
                    ${fieldHtml({ name: 'floor_no', label: 'Floor <span class="font-normal text-ink-soft">(optional)</span>', value: isEdit && room.floor_no !== null ? room.floor_no : '', type: 'number', placeholder: '1', extra: 'min="0" max="100"' })}
                </div>
                <div class="flex flex-wrap gap-x-6">
                    ${checkboxHtml('has_attached_bath', 'Attached bath', isEdit && room.has_attached_bath)}
                    ${checkboxHtml('has_balcony', 'Balcony', isEdit && room.has_balcony)}
                </div>
                ${seatPart}
                <p data-form-message class="hidden text-sm text-red-700"></p>
                <div class="flex justify-end gap-2">
                    <button type="button" data-close class="${secondaryButton}">Cancel</button>
                    <button type="submit" class="${primaryButton}">${isEdit ? 'Save room' : 'Add room'}</button>
                </div>
            </form>`,
    });

    const form = box.element.querySelector('form');
    form.addEventListener('submit', async (event) => {
        event.preventDefault();
        Ui.clearFieldErrors(form);
        const message = form.querySelector('[data-form-message]');
        message.classList.add('hidden');

        let ok = true;
        const fail = (name, text) => { Ui.showFieldError(form, name, text); ok = false; };
        const roomNo = form.elements.room_no.value.trim();
        const floor = form.elements.floor_no.value.trim();
        if (roomNo === '') fail('room_no', 'Please write the room number.');
        if (floor !== '' && !(Number(floor) >= 0 && Number(floor) <= 100)) fail('floor_no', 'The floor is a number from 0 to 100.');
        if (!isEdit) {
            if (form.elements.seat_label.value.trim() === '') fail('seat_label', 'Please write a label for the seat.');
            const rent = Number(form.elements.monthly_rent.value);
            if (form.elements.monthly_rent.value === '' || !(rent >= 1 && rent <= 1000000)) fail('monthly_rent', 'The rent is a number from 1 to 1,000,000.');
        }
        if (!ok) return;

        const body = {
            room_no: roomNo,
            has_attached_bath: form.elements.has_attached_bath.checked,
            has_balcony: form.elements.has_balcony.checked,
        };
        if (floor !== '') body.floor_no = Number(floor);

        const button = form.querySelector('button[type=submit]');
        Ui.setLoading(button, true, 'Saving');
        try {
            if (isEdit) {
                const updated = await Api.patch(`/manager/rooms/${room.room_id}`, body);
                if (emptyRooms.some((item) => item.room_id === room.room_id)) rememberEmptyRoom(updated);
                Ui.toast('The room is saved');
            } else {
                const created = await Api.post('/manager/rooms', body);
                openRooms.add(created.room_id);
                try {
                    await Api.post(`/manager/rooms/${created.room_id}/seats`, {
                        seat_label: form.elements.seat_label.value.trim(),
                        monthly_rent: Number(form.elements.monthly_rent.value),
                    });
                    Ui.toast('The room is added');
                } catch (seatError) {
                    // the room exists but has no seat: keep it on the page so the seat can be added again
                    rememberEmptyRoom(created);
                    Ui.toast('The room is added, but the seat failed: ' + seatError.message, 'error');
                }
            }
            box.close();
            await loadRooms();
        } catch (error) {
            message.textContent = error.message;
            message.classList.remove('hidden');
            Ui.setLoading(button, false);
        }
    });
}

// ---------- the seat form ----------

function openSeatModal(room) {
    // the rent of the last seat is a good first guess for the next one
    const lastSeat = room.seats[room.seats.length - 1];
    const box = Ui.modal({
        title: 'Add seat to room ' + room.room_no,
        bodyHtml: `
            <form novalidate class="space-y-4">
                <div class="grid gap-4 sm:grid-cols-2">
                    ${fieldHtml({ name: 'seat_label', label: 'Seat label', maxlength: 10, placeholder: 'B' })}
                    ${fieldHtml({ name: 'monthly_rent', label: 'Monthly rent (৳)', value: lastSeat ? Number(lastSeat.monthly_rent) : '', type: 'number', extra: 'min="1" max="1000000"' })}
                </div>
                <p data-form-message class="hidden text-sm text-red-700"></p>
                <div class="flex justify-end gap-2">
                    <button type="button" data-close class="${secondaryButton}">Cancel</button>
                    <button type="submit" class="${primaryButton}">Add seat</button>
                </div>
            </form>`,
    });

    const form = box.element.querySelector('form');
    form.elements.seat_label.focus();
    form.addEventListener('submit', async (event) => {
        event.preventDefault();
        Ui.clearFieldErrors(form);
        const message = form.querySelector('[data-form-message]');
        message.classList.add('hidden');

        let ok = true;
        const fail = (name, text) => { Ui.showFieldError(form, name, text); ok = false; };
        const label = form.elements.seat_label.value.trim();
        const rent = Number(form.elements.monthly_rent.value);
        if (label === '') fail('seat_label', 'Please write a label for the seat.');
        if (form.elements.monthly_rent.value === '' || !(rent >= 1 && rent <= 1000000)) fail('monthly_rent', 'The rent is a number from 1 to 1,000,000.');
        if (!ok) return;

        const button = form.querySelector('button[type=submit]');
        Ui.setLoading(button, true, 'Saving');
        try {
            await Api.post(`/manager/rooms/${room.room_id}/seats`, { seat_label: label, monthly_rent: rent });
            Ui.toast('The seat is added');
            box.close();
            openRooms.add(room.room_id);
            await loadRooms();
        } catch (error) {
            message.textContent = error.message;       // for example: the label is used in this room
            message.classList.remove('hidden');
            Ui.setLoading(button, false);
        }
    });
}

// =====================================================================
//  Start
// =====================================================================

async function start() {
    infoTab.innerHTML = Ui.skeleton(3, 'h-40');
    try {
        // the mess answers 404 when it is not created yet, that is not an error for this page
        const [facilityList, messAnswer] = await Promise.all([
            Api.get('/reference/facilities'),
            Api.get('/manager/mess').catch((error) => {
                if (error.status === 404) return null;
                throw error;
            }),
        ]);
        facilities = facilityList;
        mess = messAnswer;
    } catch (error) {
        infoTab.innerHTML = '';
        infoTab.appendChild(Ui.errorBanner(error.message, start));
        return;
    }
    renderStatusBanner();
    renderInfoTab();
    showTab(location.hash === '#rooms' && mess ? 'rooms' : 'info');
}

showTab('info');
start();
