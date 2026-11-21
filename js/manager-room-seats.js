// Room-wise seats of the manager: every room as a card with its seats, who lives in them,
// and a button to add a member to a free seat (or to see the member of an occupied seat).
// The data comes from GET /manager/rooms-seats. Rooms and seats are created in Mess setup.

Layout.start({ active: 'room-seats', title: 'Room-wise seats', roles: ['manager'] });

const seatsBox = document.getElementById('room-seats');
const membersLink = SITE_ROOT + 'pages/manager/members.html';

let data = null;            // the answer of the backend
let onlyFree = false;       // the checkbox "Only rooms with free seats"

// ---------- the pieces of the page ----------

function summaryHtml(summary) {
    const item = (label, value) => `
        <div class="rounded-xl border border-line border-t-2 border-t-ochre bg-white px-4 py-3 shadow-sm">
            <p class="text-xs font-medium text-ink-soft">${label}</p>
            <p class="mt-1 text-xl font-semibold">${value}</p>
        </div>`;
    return `
        <div class="grid grid-cols-2 gap-3 sm:grid-cols-4">
            ${item('Total seats', summary.total)}
            ${item('Free', summary.free)}
            ${item('Occupied', summary.booked)}
            ${item('Inactive', summary.inactive)}
        </div>`;
}

function floorText(floor) {
    if (floor === null || floor === undefined) return '';
    return Number(floor) === 0 ? 'Ground floor' : 'Floor ' + floor;
}

// One line of a room card: seat label, rent, status chip and the button
function seatLineHtml(seat) {
    let chip;
    let button = '';
    if (seat.status === 'available') {
        chip = Ui.badge('Free', 'green');
        button = `<a href="${membersLink}?seat_id=${seat.seat_id}" class="inline-flex h-9 items-center whitespace-nowrap rounded-lg bg-espresso px-3 text-sm font-medium text-white hover:bg-espresso-hover">Add member</a>`;
    } else if (seat.status === 'booked') {
        chip = Ui.badge('Occupied', 'ochre');
        const memberId = seat.member ? seat.member.member_id : '';
        button = `<a href="${membersLink}?member_id=${memberId}" class="inline-flex h-9 items-center whitespace-nowrap rounded-lg border border-line bg-white px-3 text-sm font-medium hover:bg-page">View</a>`;
    } else {
        chip = Ui.statusBadge('inactive');
    }
    const person = seat.member
        ? `<span class="block truncate text-xs text-ink-soft">${Ui.escape(seat.member.full_name)}</span>` : '';

    return `
        <li class="flex items-center gap-3 px-4 py-2.5">
            <span class="w-8 shrink-0 text-sm font-semibold">${Ui.escape(seat.seat_label)}</span>
            <span class="min-w-0 flex-1">
                <span class="block text-sm">${Ui.money(seat.monthly_rent)}</span>
                ${person}
            </span>
            ${chip}
            <span class="flex w-28 shrink-0 justify-end">${button}</span>
        </li>`;
}

function roomCardHtml(room) {
    const usable = room.seats.filter((seat) => seat.status !== 'inactive').length;
    const filled = room.seats.filter((seat) => seat.status === 'booked').length;
    const percent = usable > 0 ? Math.round((filled / usable) * 100) : 0;
    const icons = [
        room.has_attached_bath ? '<i class="fa-solid fa-shower text-ochre" title="Attached bath"></i>' : '',
        room.has_balcony ? '<i class="fa-solid fa-table-cells-large text-ochre" title="Balcony"></i>' : '',
    ].join(' ');

    return `
        <article class="overflow-hidden rounded-xl border border-line bg-white shadow-sm ${room.is_active ? '' : 'opacity-70'}">
            <div class="border-b border-line px-4 py-3">
                <div class="flex items-center justify-between gap-2">
                    <h3 class="font-semibold">Room ${Ui.escape(room.room_no)}</h3>
                    <span class="flex items-center gap-2 text-sm">${icons}${room.is_active ? '' : Ui.statusBadge('inactive')}</span>
                </div>
                <p class="text-xs text-ink-soft">${Ui.escape(floorText(room.floor_no)) || 'No floor set'}</p>
                <div class="mt-2 flex items-center gap-2">
                    <div class="h-2 flex-1 overflow-hidden rounded-full bg-page"><div class="h-full rounded-full bg-espresso" style="width: ${percent}%"></div></div>
                    <span class="text-xs text-ink-soft">${filled} of ${usable} filled</span>
                </div>
            </div>
            <ul class="divide-y divide-line">${room.seats.map(seatLineHtml).join('')}</ul>
        </article>`;
}

// ---------- show ----------

function showRooms() {
    const rooms = onlyFree
        ? data.rooms.filter((room) => room.is_active && room.seats.some((seat) => seat.status === 'available'))
        : data.rooms;

    const cards = rooms.length === 0
        ? Ui.empty({ icon: 'fa-solid fa-bed', title: 'No room to show', text: 'Every room is full. Untick the box to see all the rooms.' })
        : `<div class="grid gap-4 md:grid-cols-2 xl:grid-cols-3">${rooms.map(roomCardHtml).join('')}</div>`;

    seatsBox.innerHTML = `
        ${summaryHtml(data.summary)}
        <label class="flex min-h-10 w-fit cursor-pointer items-center gap-2 text-sm">
            <input type="checkbox" id="only-free" ${onlyFree ? 'checked' : ''} class="h-4 w-4 rounded border-line accent-espresso">
            Only rooms with free seats
        </label>
        ${cards}`;
    document.getElementById('only-free').addEventListener('change', (event) => {
        onlyFree = event.target.checked;
        showRooms();
    });
}

async function loadRooms() {
    seatsBox.innerHTML = `
        <div class="grid grid-cols-2 gap-3 sm:grid-cols-4">${Ui.skeleton(4, 'h-16')}</div>
        <div class="grid gap-4 md:grid-cols-2 xl:grid-cols-3">${Ui.skeleton(3, 'h-48')}</div>`;
    try {
        data = await Api.get('/manager/rooms-seats');
        if (data.rooms.length === 0) {
            seatsBox.innerHTML = Ui.empty({
                icon: 'fa-solid fa-bed',
                title: 'No rooms yet',
                text: 'Add your rooms and seats in Mess setup. They will be listed here.',
                buttonHtml: `<a href="${SITE_ROOT}pages/manager/mess-setup.html#rooms" class="inline-flex h-10 items-center rounded-lg bg-espresso px-5 text-sm font-medium text-white hover:bg-espresso-hover">Go to Mess setup</a>`,
            });
            return;
        }
        showRooms();
    } catch (error) {
        if (error.status === 404) {
            // no mess yet
            seatsBox.innerHTML = Ui.empty({
                icon: 'fa-solid fa-building',
                title: 'Set up your mess to get started',
                text: 'Create your mess first, then add its rooms and seats.',
                buttonHtml: `<a href="${SITE_ROOT}pages/manager/mess-setup.html" class="inline-flex h-10 items-center rounded-lg bg-espresso px-5 text-sm font-medium text-white hover:bg-espresso-hover">Create mess</a>`,
            });
        } else {
            seatsBox.innerHTML = '';
            seatsBox.appendChild(Ui.errorBanner(error.message, loadRooms));
        }
    }
}

loadRooms();
