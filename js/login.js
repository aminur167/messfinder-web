// The login page.

const form = document.getElementById('login-form');
const message = document.getElementById('form-message');
const button = document.getElementById('login-button');

// Somebody who is already logged in does not need this page
if (Auth.isLoggedIn()) {
    Auth.goAfterLogin(Auth.getUser());
}

// The page the user wanted before the login (and the message when the old login ended)
const params = new URLSearchParams(location.search);
if (params.get('expired')) document.getElementById('expired-message').classList.remove('hidden');
if (params.get('next')) {
    document.getElementById('register-link').href = 'register.html?next=' + encodeURIComponent(params.get('next'));
}

// The eye button shows or hides the password
document.getElementById('toggle-password').addEventListener('click', () => {
    const field = form.elements.password;
    const show = field.type === 'password';
    field.type = show ? 'text' : 'password';
    document.querySelector('#toggle-password i').className = show ? 'fa-regular fa-eye-slash' : 'fa-regular fa-eye';
});

// Quick login: a button fills the email and the password of a demo account and logs in.
// All the demo accounts have the same password (see the README).
const DEMO_PASSWORD = 'Demo@1234';
document.querySelectorAll('[data-quick-email]').forEach((quickButton) => {
    quickButton.addEventListener('click', () => {
        form.elements.email.value = quickButton.dataset.quickEmail;
        form.elements.password.value = DEMO_PASSWORD;
        form.requestSubmit();
    });
});

// Checks the form before it is sent. Gives true if everything is fine.
function formIsValid() {
    Ui.clearFieldErrors(form);
    let ok = true;

    const email = form.elements.email.value.trim();
    if (email === '') {
        Ui.showFieldError(form, 'email', 'Please enter your email');
        ok = false;
    } else if (!/^\S+@\S+\.\S+$/.test(email)) {
        Ui.showFieldError(form, 'email', 'This does not look like an email');
        ok = false;
    }
    if (form.elements.password.value === '') {
        Ui.showFieldError(form, 'password', 'Please enter your password');
        ok = false;
    }
    return ok;
}

form.addEventListener('submit', async (event) => {
    event.preventDefault();
    message.classList.add('hidden');
    if (!formIsValid()) return;

    Ui.setLoading(button, true, 'Logging in');
    try {
        const result = await Api.post('/auth/login', {
            email: form.elements.email.value.trim(),
            password: form.elements.password.value,
        });
        Auth.save(result.token, result.user);
        Auth.goAfterLogin(result.user);
    } catch (error) {
        message.textContent = error.message;
        message.classList.remove('hidden');
        Ui.setLoading(button, false);
    }
});
