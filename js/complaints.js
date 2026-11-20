// The Complaints page of a student and of a manager: a form to send a complaint, and the list of
// the complaints already sent, with their status and the note of the admin.
// A student complains about a mess (chosen from a list). A manager's complaint is linked to his own mess,
// and he can also name a student (searched by name, email or phone).
// A mess can be chosen with the address too:  complaints.html?mess_id=3

Layout.start({ active: 'complaints', title: 'Complaints', roles: ['student', 'manager'] });

const user = Auth.getUser();
const isStudent = user.role === 'student';

const form = document.getElementById('complaint-form');
const aboutBox = document.getElementById('about-box');
const messageLine = document.getElementById('form-message');
const list = document.getElementById('list');

const inputClass = 'h-11 w-full rounded-lg border border-line bg-white px-3 text-sm placeholder:text-mute focus:border-ochre focus:outline-none focus:ring-2 focus:ring-ochre/40';

let chosenStudent = null;        // manager only: the student he complains about
let foundStudents = [];          // manager only: the result of the last search

// ---------- the "about" part of the form ----------

// The student searches the mess by its name (there can be thousands of messes, so no long list).
// The chosen mess is kept in a hidden field named mess_id, the rest of the form reads it from there.
function renderAboutForStudent() {
    aboutBox.innerHTML = `
        <span class="mb-1 block text-sm font-medium">Which mess is it about?</span>
        <input type="hidden" name="mess_id" value="">
        <div id="mess-chosen"></div>
        <div id="mess-search">
            <input id="mess-query" type="search" autocomplete="off" placeholder="Type the name of the mess" aria-label="Search a mess" class="${inputClass}">
            <div id="mess-results" class="mt-2 space-y-1"></div>
        </div>
        <p data-error-for="mess_id" class="mt-1 text-xs text-red-600"></p>`;

    const hidden = form.elements.mess_id;
    const chosenBox = document.getElementById('mess-chosen');
    const searchBox = document.getElementById('mess-search');
    const queryBox = document.getElementById('mess-query');
    const resultsBox = document.getElementById('mess-results');
    let found = [];                  // the result of the last search
    let timer = null;
    let lastSearch = 0;              // an old slow answer must not replace a newer one

    // shows the chosen mess (with a Remove button), or the search box when nothing is chosen
    function showChosen(mess) {
        hidden.value = mess ? mess.mess_id : '';
        resultsBox.innerHTML = '';
        searchBox.classList.toggle('hidden', Boolean(mess));
        chosenBox.innerHTML = mess ? `
            <div class="flex items-center justify-between gap-2 rounded-lg bg-ochre-soft px-3 py-2 text-sm">
                <span class="min-w-0 truncate"><i class="fa-solid fa-building mr-2 text-ochre"></i>${Ui.escape(mess.mess_name)} <span class="text-ink-soft">${Ui.escape(mess.area_name)}</span></span>
                <button type="button" id="mess-remove" class="shrink-0 text-sm font-medium text-link hover:underline">Change</button>
            </div>` : '';
        if (!mess) queryBox.focus();
    }

    async function search() {
        const word = queryBox.value.trim();
        const thisSearch = ++lastSearch;
        if (word.length < 2) {
            resultsBox.innerHTML = word.length === 0 ? '' : '<p class="text-sm text-ink-soft">Type at least 2 letters.</p>';
            return;
        }
        resultsBox.innerHTML = Ui.skeleton(1, 'h-10');
        try {
            const answer = await Api.get('/messes', { q: word, limit: 8 });
            if (thisSearch !== lastSearch) return;
            found = answer.data;
            resultsBox.innerHTML = found.length === 0
                ? '<p class="text-sm text-ink-soft">No mess found. Try another word.</p>'
                : found.map((mess) => `
                    <button type="button" data-mess-id="${mess.mess_id}" class="flex w-full items-center justify-between gap-2 rounded-lg border border-line px-3 py-2 text-left text-sm hover:bg-page">
                        <span class="min-w-0 truncate font-medium">${Ui.escape(mess.mess_name)}</span>
                        <span class="shrink-0 text-xs text-ink-soft">${Ui.escape(mess.area_name)}</span>
                    </button>`).join('');
        } catch (error) {
            if (thisSearch === lastSearch) resultsBox.innerHTML = `<p class="text-sm text-red-700">${Ui.escape(error.message)}</p>`;
        }
    }

    queryBox.addEventListener('input', () => {
        clearTimeout(timer);
        timer = setTimeout(search, 300);       // wait a little after the last key
    });
    queryBox.addEventListener('keydown', (event) => {
        if (event.key === 'Enter') event.preventDefault();      // Enter must not send the complaint
    });
    resultsBox.addEventListener('click', (event) => {
        const pick = event.target.closest('[data-mess-id]');
        if (pick) showChosen(found.find((mess) => String(mess.mess_id) === pick.dataset.messId));
    });
    chosenBox.addEventListener('click', (event) => {
        if (event.target.closest('#mess-remove')) showChosen(null);
    });

    // a mess can be chosen with the address too:  complaints.html?mess_id=3
    const idFromAddress = new URLSearchParams(location.search).get('mess_id');
    if (idFromAddress) {
        Api.get('/messes/' + encodeURIComponent(idFromAddress))
            .then((mess) => showChosen({ mess_id: mess.mess_id, mess_name: mess.mess_name, area_name: mess.area_name }))
            .catch(() => { /* a wrong id in the address: the student just searches */ });
    }
}

// The manager: his complaint goes with his mess, and a student can be added
function renderAboutForManager() {
    aboutBox.innerHTML = `
        <span class="mb-1 block text-sm font-medium">About a student <span class="font-normal text-ink-soft">(optional)</span></span>
        <p class="mb-2 text-xs text-ink-soft">The complaint is linked to your mess. To name a student, search by name, email or phone (at least 3 letters).</p>
        <div id="student-chosen"></div>
        <div id="student-search" class="flex gap-2">
            <input id="student-query" type="search" placeholder="Search a student" aria-label="Search a student" class="${inputClass}">
            <button type="button" id="student-search-button" class="h-11 shrink-0 rounded-lg border border-line bg-white px-4 text-sm font-medium hover:bg-page">Search</button>
        </div>
        <div id="student-results" class="mt-2 space-y-1"></div>`;
}

function showChosenStudent() {
    const chosen = document.getElementById('student-chosen');
    const search = document.getElementById('student-search');
    document.getElementById('student-results').innerHTML = '';
    if (!chosenStudent) {
        chosen.innerHTML = '';
        search.classList.remove('hidden');
        return;
    }
    search.classList.add('hidden');
    chosen.innerHTML = `
        <div class="flex items-center justify-between gap-2 rounded-lg bg-ochre-soft px-3 py-2 text-sm">
            <span class="min-w-0 truncate"><i class="fa-solid fa-user mr-2 text-ochre"></i>${Ui.escape(chosenStudent.full_name)} <span class="text-ink-soft">${Ui.escape(chosenStudent.university)}</span></span>
            <button type="button" id="student-remove" class="shrink-0 text-sm font-medium text-link hover:underline">Remove</button>
        </div>`;
}

async function searchStudents() {
    const word = document.getElementById('student-query').value.trim();
    const results = document.getElementById('student-results');
    if (word.length < 3) {
        results.innerHTML = '<p class="text-sm text-red-700">Write at least 3 letters.</p>';
        return;
    }
    results.innerHTML = Ui.skeleton(1, 'h-10');
    try {
        const students = await Api.get('/manager/students/search', { q: word });
        results.innerHTML = students.length === 0
            ? '<p class="text-sm text-ink-soft">No student found.</p>'
            : students.map((student) => `
                <button type="button" data-student-id="${student.user_id}" class="flex w-full items-center justify-between gap-2 rounded-lg border border-line px-3 py-2 text-left text-sm hover:bg-page">
                    <span class="min-w-0 truncate font-medium">${Ui.escape(student.full_name)} <span class="font-normal text-ink-soft">${Ui.escape(student.email)}</span></span>
                    <span class="shrink-0 text-xs text-ink-soft">${Ui.escape(student.university)}</span>
                </button>`).join('');
        foundStudents = students;       // kept so the chosen one can be found again
    } catch (error) {
        results.innerHTML = `<p class="text-sm text-red-700">${Ui.escape(error.message)}</p>`;
    }
}

aboutBox.addEventListener('click', (event) => {
    if (event.target.closest('#student-search-button')) searchStudents();
    if (event.target.closest('#student-remove')) { chosenStudent = null; showChosenStudent(); }
    const pick = event.target.closest('[data-student-id]');
    if (pick) {
        chosenStudent = foundStudents.find((s) => String(s.user_id) === pick.dataset.studentId);
        showChosenStudent();
    }
});
aboutBox.addEventListener('keydown', (event) => {
    if (event.key === 'Enter' && event.target.id === 'student-query') {
        event.preventDefault();
        searchStudents();
    }
});

// ---------- sending ----------

form.addEventListener('submit', async (event) => {
    event.preventDefault();
    Ui.clearFieldErrors(form);
    messageLine.classList.add('hidden');

    let ok = true;
    const fail = (name, text) => { Ui.showFieldError(form, name, text); ok = false; };
    const subject = form.elements.subject.value.trim();
    const description = form.elements.description.value.trim();
    if (subject.length < 3) fail('subject', 'Please write a subject of at least 3 letters.');
    if (description.length < 5) fail('description', 'Please tell us what happened (at least 5 letters).');
    if (isStudent && form.elements.mess_id.value === '') fail('mess_id', 'Please choose a mess.');
    if (!ok) return;

    const body = { subject, description };
    if (isStudent) body.mess_id = Number(form.elements.mess_id.value);
    else if (chosenStudent) body.against_user_id = chosenStudent.user_id;

    const button = form.querySelector('button[type=submit]');
    Ui.setLoading(button, true, 'Sending');
    try {
        await Api.post('/complaints', body);
        Ui.toast('Your complaint is sent to the admin');
        form.elements.subject.value = '';
        form.elements.description.value = '';
        if (!isStudent) { chosenStudent = null; showChosenStudent(); }
        loadList();
    } catch (error) {
        messageLine.textContent = error.message;
        messageLine.classList.remove('hidden');
    }
    Ui.setLoading(button, false);
});

// ---------- my complaints ----------

function complaintHtml(complaint) {
    const about = complaint.mess_name
        ? `<span><i class="fa-solid fa-building mr-1.5 text-ochre"></i>${Ui.escape(complaint.mess_name)}</span>` : '';
    const against = complaint.against_name
        ? `<span><i class="fa-solid fa-user mr-1.5 text-ochre"></i>${Ui.escape(complaint.against_name)}</span>` : '';
    const note = complaint.admin_note ? `
        <div class="mt-3 rounded-lg bg-page px-4 py-3 text-sm">
            <p class="mb-1 text-xs font-semibold text-ink-soft"><i class="fa-solid fa-reply mr-1"></i>Note from the admin</p>
            <p class="whitespace-pre-line break-words">${Ui.escape(complaint.admin_note)}</p>
        </div>` : '';
    return `
        <article class="rounded-xl border border-line bg-white p-4 shadow-sm">
            <div class="flex items-start justify-between gap-3">
                <h3 class="font-semibold leading-snug">${Ui.escape(complaint.subject)}</h3>
                ${Ui.statusBadge(complaint.status)}
            </div>
            <p class="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-xs text-ink-soft">${about}${against}<span>${Ui.date(complaint.created_at)}</span></p>
            <p class="mt-2 whitespace-pre-line break-words text-sm">${Ui.escape(complaint.description)}</p>
            ${note}
        </article>`;
}

async function loadList() {
    list.innerHTML = Ui.skeleton(2, 'h-28');
    try {
        const complaints = await Api.get('/complaints/my');
        list.innerHTML = complaints.length === 0
            ? Ui.empty({ icon: 'fa-regular fa-flag', title: 'No complaints', text: 'The complaints you send will be listed here with their status.' })
            : complaints.map(complaintHtml).join('');
    } catch (error) {
        list.innerHTML = '';
        list.appendChild(Ui.errorBanner(error.message, loadList));
    }
}

// ---------- start ----------

if (isStudent) renderAboutForStudent();
else renderAboutForManager();
loadList();
