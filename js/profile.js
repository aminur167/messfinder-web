// The Profile page (every role): the details of the account, and the change of the password.
// Name and phone can be changed by everybody. A student can also change university, department and roll,
// a manager the address. Email, gender and NID cannot be changed here (the backend does not allow it).

Layout.start({ active: 'profile', title: 'Profile', login: true });

const box = document.getElementById('profile');
const inputClass = 'h-11 w-full rounded-lg border border-line bg-white px-3 text-sm placeholder:text-mute focus:border-ochre focus:outline-none focus:ring-2 focus:ring-ochre/40 disabled:bg-page disabled:text-ink-soft';

let me = null;            // the answer of GET /auth/me

// ---------- small pieces of the page ----------

function fieldHtml({ name, label, value = '', type = 'text', disabled = false, help = '', maxlength = '' }) {
    return `
        <div>
            <label for="field-${name}" class="mb-1 block text-sm font-medium">${label}</label>
            <input id="field-${name}" name="${name}" type="${type}" value="${Ui.escape(value)}" ${disabled ? 'disabled' : ''} ${maxlength ? `maxlength="${maxlength}"` : ''}
                class="${inputClass}">
            ${help ? `<p class="mt-1 text-xs text-ink-soft">${help}</p>` : ''}
            <p data-error-for="${name}" class="mt-1 text-xs text-red-600"></p>
        </div>`;
}

// "2105031234567890" -> "*********7890" (the NID is private, only the end is shown)
function hiddenNid(nid) {
    return nid ? '*'.repeat(Math.max(nid.length - 4, 0)) + nid.slice(-4) : '';
}

// The part of the form that depends on the role
function roleFieldsHtml() {
    if (me.role === 'student') {
        const p = me.profile;
        return `
            <div>
                <label for="field-university_id" class="mb-1 block text-sm font-medium">University</label>
                <select id="field-university_id" name="university_id" class="${inputClass}">
                    <option value="${p.university_id}">${Ui.escape(p.university_short_name)}</option>
                </select>
                <p data-error-for="university_id" class="mt-1 text-xs text-red-600"></p>
            </div>
            <div class="grid gap-4 sm:grid-cols-2">
                ${fieldHtml({ name: 'department', label: 'Department <span class="font-normal text-ink-soft">(optional)</span>', value: p.department || '', maxlength: 80 })}
                ${fieldHtml({ name: 'student_roll', label: 'Roll <span class="font-normal text-ink-soft">(optional)</span>', value: p.student_roll || '', maxlength: 30 })}
            </div>
            ${fieldHtml({ name: 'gender', label: 'Gender', value: p.gender === 'female' ? 'Female' : 'Male', disabled: true, help: 'Gender cannot be changed.' })}`;
    }
    if (me.role === 'manager') {
        const p = me.profile;
        return `
            <div>
                <label for="field-address" class="mb-1 block text-sm font-medium">Address <span class="font-normal text-ink-soft">(optional)</span></label>
                <textarea id="field-address" name="address" rows="2" maxlength="255" class="w-full rounded-lg border border-line bg-white px-3 py-2 text-sm focus:border-ochre focus:outline-none focus:ring-2 focus:ring-ochre/40">${Ui.escape(p.address || '')}</textarea>
                <p data-error-for="address" class="mt-1 text-xs text-red-600"></p>
            </div>
            ${fieldHtml({ name: 'nid_no', label: 'NID number', value: hiddenNid(p.nid_no), disabled: true, help: 'The NID cannot be changed.' })}`;
    }
    return '';
}

// A line under the name: the mess of a student, or the mess of a manager
function extraInfoHtml() {
    if (me.role === 'student' && me.membership) {
        const m = me.membership;
        return `<p class="mt-3 rounded-lg bg-ochre-soft px-4 py-2 text-sm text-ochre-dark"><i class="fa-solid fa-house mr-2"></i>You live in <a href="${SITE_ROOT}pages/mess-details.html?id=${m.mess_id}" class="font-semibold underline">${Ui.escape(m.mess_name)}</a>, room ${Ui.escape(m.room_no)}, seat ${Ui.escape(m.seat_label)}.</p>`;
    }
    if (me.role === 'manager') {
        const verified = me.profile.is_verified ? Ui.badge('Verified', 'green') : Ui.badge('Not verified yet', 'amber');
        const mess = me.mess
            ? `<a href="${SITE_ROOT}pages/manager/mess-setup.html" class="font-semibold text-link hover:underline">${Ui.escape(me.mess.mess_name)}</a> ${Ui.statusBadge(me.mess.status)}`
            : 'You have not created your mess yet.';
        return `<p class="mt-3 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-ink-soft">${verified} <span>Your mess:</span> ${mess}</p>`;
    }
    return '';
}

// ---------- the page ----------

function render() {
    const roleName = me.role.charAt(0).toUpperCase() + me.role.slice(1);
    box.innerHTML = `
        <section class="rounded-xl border border-line bg-white p-5">
            <div class="flex items-center gap-4">
                ${Ui.avatar(me.full_name, 'h-14 w-14 text-lg')}
                <div class="min-w-0">
                    <h2 class="truncate text-lg font-semibold">${Ui.escape(me.full_name)}</h2>
                    <p class="truncate text-sm text-ink-soft">${Ui.escape(me.email)}</p>
                    <p class="mt-1 flex flex-wrap items-center gap-2 text-xs text-ink-soft">${Ui.badge(roleName, 'ochre')} Member since ${Ui.date(me.created_at)}</p>
                </div>
            </div>
            ${extraInfoHtml()}

            <form id="profile-form" class="mt-5 space-y-4 border-t border-line pt-5" novalidate>
                <h3 class="font-semibold">Your details</h3>
                ${fieldHtml({ name: 'full_name', label: 'Full name', value: me.full_name, maxlength: 100 })}
                <div class="grid gap-4 sm:grid-cols-2">
                    ${fieldHtml({ name: 'email', label: 'Email', value: me.email, type: 'email', disabled: true, help: 'The email cannot be changed.' })}
                    ${fieldHtml({ name: 'phone', label: 'Phone', value: me.phone, type: 'tel' })}
                </div>
                ${roleFieldsHtml()}
                <p id="profile-message" class="hidden text-sm text-red-700"></p>
                <div class="flex justify-end">
                    <button type="submit" class="h-10 rounded-lg bg-espresso px-5 text-sm font-medium text-white hover:bg-espresso-hover disabled:opacity-70">Save changes</button>
                </div>
            </form>
        </section>

        <section class="rounded-xl border border-line bg-white p-5">
            <h3 class="font-semibold">Change password</h3>
            <form id="password-form" class="mt-4 space-y-4" novalidate>
                ${fieldHtml({ name: 'current_password', label: 'Current password', type: 'password' })}
                <div class="grid gap-4 sm:grid-cols-2">
                    ${fieldHtml({ name: 'new_password', label: 'New password', type: 'password', help: '8 to 72 characters, with a letter and a number.' })}
                    ${fieldHtml({ name: 'confirm_password', label: 'Repeat the new password', type: 'password' })}
                </div>
                <p id="password-message" class="hidden text-sm text-red-700"></p>
                <div class="flex justify-end">
                    <button type="submit" class="h-10 rounded-lg bg-espresso px-5 text-sm font-medium text-white hover:bg-espresso-hover disabled:opacity-70">Change password</button>
                </div>
            </form>
        </section>

        <div class="text-center">
            <button type="button" id="logout-button" class="h-10 rounded-lg border border-line bg-white px-5 text-sm font-medium hover:bg-page"><i class="fa-solid fa-right-from-bracket mr-2"></i>Logout</button>
        </div>`;

    if (me.role === 'student') fillUniversities();
    document.getElementById('profile-form').addEventListener('submit', saveProfile);
    document.getElementById('password-form').addEventListener('submit', changePassword);
    document.getElementById('logout-button').addEventListener('click', () => Auth.logout());
}

// the university is searched (there can be thousands); the chosen one is shown first
function fillUniversities() {
    const select = document.getElementById('field-university_id');
    Ui.picker(select, { path: '/reference/universities', idKey: 'university_id', labelOf: (u) => u.short_name + ' - ' + u.name, anyLabel: 'Search your university' });
    select.value = me.profile.university_id;
}

// ---------- save the details ----------

async function saveProfile(event) {
    event.preventDefault();
    const form = event.target;
    const message = document.getElementById('profile-message');
    Ui.clearFieldErrors(form);
    message.classList.add('hidden');

    const value = (name) => form.elements[name].value.trim();
    let ok = true;
    const fail = (name, text) => { Ui.showFieldError(form, name, text); ok = false; };

    if (value('full_name').length < 2) fail('full_name', 'Please enter your full name');
    const phone = value('phone').replace(/[\s-]/g, '');
    if (phone === '') fail('phone', 'Please enter your phone number');
    else if (!/^(\+?88)?01[3-9]\d{8}$/.test(phone)) fail('phone', 'Use a number like 01712345678');
    if (!ok) return;

    const body = { full_name: value('full_name'), phone: value('phone') };
    if (me.role === 'student') {
        body.university_id = Number(value('university_id'));
        body.department = value('department');
        body.student_roll = value('student_roll');
    } else if (me.role === 'manager') {
        body.address = value('address');
    }

    const button = form.querySelector('button[type=submit]');
    Ui.setLoading(button, true, 'Saving');
    try {
        me = await Api.patch('/auth/me', body);
        // the name and phone are also kept in the browser, for the menu at the top
        Auth.save(Auth.getToken(), { ...Auth.getUser(), full_name: me.full_name, phone: me.phone });
        Ui.toast('Your details are saved');
        render();
    } catch (error) {
        message.textContent = error.message;
        message.classList.remove('hidden');
        Ui.setLoading(button, false);
    }
}

// ---------- change the password ----------

async function changePassword(event) {
    event.preventDefault();
    const form = event.target;
    const message = document.getElementById('password-message');
    Ui.clearFieldErrors(form);
    message.classList.add('hidden');

    const current = form.elements.current_password.value;
    const next = form.elements.new_password.value;
    let ok = true;
    const fail = (name, text) => { Ui.showFieldError(form, name, text); ok = false; };

    if (current === '') fail('current_password', 'Please enter your current password');
    if (next.length < 8 || next.length > 72) fail('new_password', 'The password must have 8 to 72 characters');
    else if (!/[A-Za-z]/.test(next) || !/\d/.test(next)) fail('new_password', 'The password needs a letter and a number');
    if (form.elements.confirm_password.value !== next) fail('confirm_password', 'The two passwords are not the same');
    if (!ok) return;

    const button = form.querySelector('button[type=submit]');
    Ui.setLoading(button, true, 'Saving');
    try {
        await Api.patch('/auth/password', { current_password: current, new_password: next });
        form.reset();
        Ui.toast('Your password is changed');
    } catch (error) {
        // a wrong current password belongs under its field, anything else goes in the red line
        if (error.status === 401) {
            Ui.showFieldError(form, 'current_password', error.message);
        } else {
            message.textContent = error.message;
            message.classList.remove('hidden');
        }
    }
    Ui.setLoading(button, false);
}

// ---------- start ----------

async function loadProfile() {
    box.innerHTML = Ui.skeleton(1, 'h-96');
    try {
        me = await Api.get('/auth/me');
        render();
    } catch (error) {
        box.innerHTML = '';
        box.appendChild(Ui.errorBanner(error.message, loadProfile));
    }
}

loadProfile();
