// The register page. One form for two roles: the student fields or the manager fields are shown.

const form = document.getElementById('register-form');
const message = document.getElementById('form-message');
const button = document.getElementById('register-button');
let role = 'student';

if (Auth.isLoggedIn()) {
    Auth.goAfterLogin(Auth.getUser());
}

// keep the page the user wanted, so he can go there after the account is made
const next = new URLSearchParams(location.search).get('next');
if (next) document.getElementById('login-link').href = 'login.html?next=' + encodeURIComponent(next);

// ---------- Student / Manager switch ----------

function showRole(newRole) {
    role = newRole;
    const isStudent = role === 'student';
    document.getElementById('student-fields').classList.toggle('hidden', !isStudent);
    document.getElementById('manager-fields').classList.toggle('hidden', isStudent);

    // the chosen tab is white with a small shadow, the other one is plain
    const active = 'bg-white shadow-sm text-ink';
    const plain = 'text-ink-soft hover:text-ink';
    document.getElementById('tab-student').className = `h-10 rounded-md text-sm font-medium ${isStudent ? active : plain}`;
    document.getElementById('tab-manager').className = `h-10 rounded-md text-sm font-medium ${isStudent ? plain : active}`;
    document.getElementById('tab-student').setAttribute('aria-selected', isStudent);
    document.getElementById('tab-manager').setAttribute('aria-selected', !isStudent);

    Ui.clearFieldErrors(form);
    message.classList.add('hidden');
}

document.querySelectorAll('[data-role]').forEach((tab) => {
    tab.addEventListener('click', () => showRole(tab.dataset.role));
});
showRole('student');

// ---------- the eye button ----------

document.getElementById('toggle-password').addEventListener('click', () => {
    const field = form.elements.password;
    const show = field.type === 'password';
    field.type = show ? 'text' : 'password';
    document.querySelector('#toggle-password i').className = show ? 'fa-regular fa-eye-slash' : 'fa-regular fa-eye';
});

// ---------- checking the form (the backend checks again, this only saves a trip) ----------

function formIsValid() {
    Ui.clearFieldErrors(form);
    let ok = true;
    const fail = (name, text) => { Ui.showFieldError(form, name, text); ok = false; };
    const value = (name) => form.elements[name].value.trim();

    if (value('full_name').length < 2) fail('full_name', 'Please enter your full name');

    if (value('email') === '') fail('email', 'Please enter your email');
    else if (!/^\S+@\S+\.\S+$/.test(value('email'))) fail('email', 'This does not look like an email');

    // a Bangladeshi mobile number, with or without +88
    const phone = value('phone').replace(/[\s-]/g, '');
    if (phone === '') fail('phone', 'Please enter your phone number');
    else if (!/^(\+?88)?01[3-9]\d{8}$/.test(phone)) fail('phone', 'Use a number like 01712345678');

    const password = form.elements.password.value;
    if (password.length < 8 || password.length > 72) fail('password', 'The password must have 8 to 72 characters');
    else if (!/[A-Za-z]/.test(password) || !/\d/.test(password)) fail('password', 'The password needs a letter and a number');

    if (role === 'student') {
        if (value('university_name').length < 3) fail('university_name', 'Please write your university name');
        if (value('area_name').length < 2) fail('area_name', 'Please write the area of your university');
        if (value('gender') === '') fail('gender', 'Please select your gender');
    } else if (!/^\d{10,17}$/.test(value('nid_no'))) {
        fail('nid_no', 'The NID number must be 10 to 17 digits');
    }
    return ok;
}

// The backend says which value is already used. Put that message under the right field.
function showServerError(error) {
    const text = error.message;
    const fields = { email: 'email', phone: 'phone', NID: 'nid_no' };
    for (const [word, field] of Object.entries(fields)) {
        if (error.status === 409 && text.includes(word)) {
            Ui.showFieldError(form, field, text);
            return;
        }
    }
    message.textContent = text;
    message.classList.remove('hidden');
}

form.addEventListener('submit', async (event) => {
    event.preventDefault();
    message.classList.add('hidden');
    if (!formIsValid()) return;

    const value = (name) => form.elements[name].value.trim();
    const body = {
        role,
        full_name: value('full_name'),
        email: value('email'),
        phone: value('phone'),
        password: form.elements.password.value,
    };
    if (role === 'student') {
        body.university_name = value('university_name');
        body.area_name = value('area_name');
        body.gender = value('gender');
        body.student_roll = value('student_roll');
        body.department = value('department');
    } else {
        body.nid_no = value('nid_no');
        body.address = value('address');
    }

    Ui.setLoading(button, true, 'Creating account');
    try {
        const result = await Api.post('/auth/register', body);
        Auth.save(result.token, result.user);
        Auth.goAfterLogin(result.user);
    } catch (error) {
        showServerError(error);
        Ui.setLoading(button, false);
    }
});
