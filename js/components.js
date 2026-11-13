// Small pieces used by every page: toast, modal, badge, avatar, stars, empty state, formatters...
// Each one is a function of the object Ui. Most of them return a piece of HTML as text.
// Anything that comes from a user must go through Ui.escape() before it is put in HTML.

const Ui = {
    // ---------- text helpers ----------

    // Makes text safe to put in HTML (so a name like <b> cannot break the page).
    escape(text) {
        return String(text === null || text === undefined ? '' : text)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
    },

    // 4500 -> "৳4,500"
    money(amount) {
        return '৳' + Number(amount || 0).toLocaleString('en-US');
    },

    // "2026-11-24" -> "24 Nov 2026"
    date(text) {
        if (!text) return '';
        const day = new Date(String(text).replace(' ', 'T'));
        if (isNaN(day)) return text;
        return day.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
    },

    // "2026-11-24 18:30:00" -> "24 Nov 2026, 6:30 pm"
    dateTime(text) {
        if (!text) return '';
        const day = new Date(String(text).replace(' ', 'T'));
        if (isNaN(day)) return text;
        return day.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
            + ', ' + day.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }).toLowerCase();
    },

    // "5 minutes ago", for the chat and the notifications
    timeAgo(text) {
        const day = new Date(String(text).replace(' ', 'T'));
        if (isNaN(day)) return '';
        const seconds = Math.round((Date.now() - day.getTime()) / 1000);
        if (seconds < 60) return 'just now';
        if (seconds < 3600) return Math.floor(seconds / 60) + ' min ago';
        if (seconds < 86400) return Math.floor(seconds / 3600) + ' h ago';
        if (seconds < 7 * 86400) return Math.floor(seconds / 86400) + ' d ago';
        return Ui.date(text);
    },

    // ---------- small visual pieces ----------

    // Pill with a status word. kind: green, amber, red, slate or ochre (see the table in the plan).
    badge(text, kind = 'slate') {
        const colours = {
            green: 'bg-green-100 text-green-800',
            amber: 'bg-amber-100 text-amber-800',
            red: 'bg-red-100 text-red-800',
            slate: 'bg-slate-100 text-slate-700',
            ochre: 'bg-ochre-soft text-ochre-dark',
        };
        return `<span class="inline-block rounded-full px-2.5 py-0.5 text-xs font-medium ${colours[kind] || colours.slate}">${Ui.escape(text)}</span>`;
    },

    // The same word has the same colour on every page.
    statusBadge(status) {
        const kinds = {
            paid: 'green', free: 'green', available: 'green', verified: 'green', open: 'green',
            confirmed: 'green', resolved: 'green', active: 'green',
            partial: 'amber', pending: 'amber', in_review: 'amber',
            overdue: 'red', rejected: 'red', suspended: 'red', removed: 'red', blocked: 'red',
            due: 'slate', closed: 'slate', cancelled: 'slate', inactive: 'slate', left: 'slate',
            expired: 'slate', dismissed: 'slate',
            occupied: 'ochre', completed: 'ochre', linked: 'ochre',
        };
        const label = String(status).replace(/_/g, ' ');
        return Ui.badge(label.charAt(0).toUpperCase() + label.slice(1), kinds[status] || 'slate');
    },

    // A round circle with the first letters of the name. The colour comes from the name, so it stays the same.
    avatar(name, size = 'h-9 w-9 text-sm') {
        const palette = ['bg-amber-700', 'bg-emerald-700', 'bg-sky-700', 'bg-rose-700', 'bg-violet-700', 'bg-teal-700', 'bg-orange-700'];
        let sum = 0;
        for (const letter of String(name)) sum += letter.charCodeAt(0);
        const words = String(name).trim().split(/\s+/);
        const letters = (words[0][0] + (words.length > 1 ? words[words.length - 1][0] : '')).toUpperCase();
        return `<span class="inline-flex ${size} shrink-0 items-center justify-center rounded-full font-semibold text-white ${palette[sum % palette.length]}">${Ui.escape(letters)}</span>`;
    },

    // 4.3 -> five small stars (full, half and empty). The stars are ochre.
    stars(rating, count) {
        const value = Number(rating) || 0;
        let html = '';
        for (let i = 1; i <= 5; i += 1) {
            const icon = value >= i - 0.25 ? 'fa-solid fa-star' : value >= i - 0.75 ? 'fa-solid fa-star-half-stroke' : 'fa-regular fa-star';
            html += `<i class="${icon} text-ochre"></i>`;
        }
        const text = value > 0 ? `<span class="ml-1 text-sm font-medium">${value.toFixed(1)}</span>` : '';
        const total = count !== undefined ? `<span class="ml-1 text-sm text-ink-soft">(${count})</span>` : '';
        return `<span class="inline-flex items-center gap-0.5" aria-label="Rating ${value} of 5">${html}${text}${total}</span>`;
    },

    // Five stars to click, for a form. The chosen number is read with picker.get().
    // Pressing the chosen star again clears it (an optional rating can be left empty).
    starPicker(container, label = 'Rating') {
        let value = 0;
        container.setAttribute('role', 'group');
        container.setAttribute('aria-label', label);
        container.innerHTML = [1, 2, 3, 4, 5]
            .map((n) => `<button type="button" data-star="${n}" class="h-9 w-8 text-xl" aria-label="${n} of 5"><i class="fa-regular fa-star text-ochre"></i></button>`)
            .join('');

        function paint() {
            container.querySelectorAll('[data-star]').forEach((button) => {
                const on = Number(button.dataset.star) <= value;
                button.querySelector('i').className = (on ? 'fa-solid' : 'fa-regular') + ' fa-star text-ochre';
            });
        }
        container.addEventListener('click', (event) => {
            const button = event.target.closest('[data-star]');
            if (!button) return;
            const number = Number(button.dataset.star);
            value = value === number ? 0 : number;
            paint();
        });
        return { get: () => value, reset: () => { value = 0; paint(); } };
    },

    // Shown when a list is empty: icon, one title, one sentence and (maybe) one button.
    empty({ icon = 'fa-regular fa-folder-open', title, text = '', buttonHtml = '' }) {
        return `
            <div class="rounded-xl border border-line bg-white px-6 py-12 text-center">
                <i class="${icon} text-3xl text-ochre"></i>
                <h3 class="mt-3 text-base font-semibold">${Ui.escape(title)}</h3>
                ${text ? `<p class="mt-1 text-sm text-ink-soft">${Ui.escape(text)}</p>` : ''}
                ${buttonHtml ? `<div class="mt-4">${buttonHtml}</div>` : ''}
            </div>`;
    },

    // Grey blocks shown while the data is coming.
    skeleton(rows = 3, height = 'h-20') {
        return Array.from({ length: rows }, () => `<div class="skeleton ${height} w-full"></div>`).join('');
    },

    // A red bar with the error and a "Try again" button (the page gives the function to call again).
    errorBanner(message, onRetry) {
        const wrapper = document.createElement('div');
        wrapper.className = 'flex items-center justify-between gap-3 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800';
        wrapper.innerHTML = `<span><i class="fa-solid fa-circle-exclamation mr-2"></i>${Ui.escape(message)}</span>`;
        if (onRetry) {
            const button = document.createElement('button');
            button.type = 'button';
            button.className = 'shrink-0 rounded-lg border border-red-300 bg-white px-3 py-1 font-medium hover:bg-red-100';
            button.textContent = 'Try again';
            button.addEventListener('click', onRetry);
            wrapper.appendChild(button);
        }
        return wrapper;
    },

    // ---------- buttons and forms ----------

    // The button shows a spinner and cannot be pressed twice while the request is running.
    setLoading(button, isLoading, loadingText = 'Please wait') {
        if (isLoading) {
            button.dataset.label = button.innerHTML;
            button.disabled = true;
            button.innerHTML = `<span class="spinner"></span> ${Ui.escape(loadingText)}`;
        } else {
            button.disabled = false;
            if (button.dataset.label !== undefined) button.innerHTML = button.dataset.label;
        }
    },

    // Puts a red message under a field. The field needs a  <p data-error-for="name">  below it.
    showFieldError(form, name, message) {
        const input = form.elements[name];
        const place = form.querySelector(`[data-error-for="${name}"]`);
        if (input && input.classList) {
            input.classList.add('border-red-500');
            input.classList.remove('border-line');
        }
        if (place) place.textContent = message;
    },

    clearFieldErrors(form) {
        form.querySelectorAll('[data-error-for]').forEach((place) => { place.textContent = ''; });
        form.querySelectorAll('.border-red-500').forEach((input) => {
            input.classList.remove('border-red-500');
            input.classList.add('border-line');
        });
    },

    // ---------- toast ----------

    // A small message at the top right. kind: success (green) or error (red). It goes away after 3 seconds.
    toast(message, kind = 'success') {
        let holder = document.getElementById('toast-holder');
        if (!holder) {
            holder = document.createElement('div');
            holder.id = 'toast-holder';
            holder.className = 'fixed right-4 top-4 z-[60] flex w-72 max-w-[calc(100%-2rem)] flex-col gap-2';
            document.body.appendChild(holder);
        }
        const toast = document.createElement('div');
        const colours = kind === 'error' ? 'border-red-200 bg-red-50 text-red-800' : 'border-green-200 bg-green-50 text-green-800';
        const icon = kind === 'error' ? 'fa-circle-exclamation' : 'fa-circle-check';
        toast.className = `rounded-lg border px-4 py-3 text-sm shadow ${colours}`;
        toast.setAttribute('role', 'status');
        toast.innerHTML = `<i class="fa-solid ${icon} mr-2"></i>${Ui.escape(message)}`;
        holder.appendChild(toast);
        setTimeout(() => toast.remove(), 3000);
    },

    // ---------- modal and confirm ----------

    // Opens a box in the middle. Esc or a click outside closes it.
    // bodyHtml is the inside of the box. Returns { element, close } so the page can fill and close it.
    modal({ title, bodyHtml, size = 'max-w-md' }) {
        const overlay = document.createElement('div');
        overlay.className = 'fixed inset-0 z-50 flex items-center justify-center bg-espresso/60 p-4';
        overlay.innerHTML = `
            <div class="w-full ${size} max-h-[90vh] overflow-y-auto rounded-xl bg-white p-5 shadow-lg" role="dialog" aria-modal="true">
                <div class="mb-3 flex items-start justify-between gap-3">
                    <h2 class="text-lg font-semibold">${Ui.escape(title)}</h2>
                    <button type="button" data-close class="h-8 w-8 shrink-0 rounded-lg text-ink-soft hover:bg-page" aria-label="Close"><i class="fa-solid fa-xmark"></i></button>
                </div>
                <div data-modal-body>${bodyHtml}</div>
            </div>`;

        function close() {
            document.removeEventListener('keydown', onKey);
            document.body.classList.remove('no-scroll');
            overlay.remove();
        }
        function onKey(event) {
            if (event.key === 'Escape') close();
        }
        overlay.addEventListener('click', (event) => {
            if (event.target === overlay || event.target.closest('[data-close]')) close();
        });
        document.addEventListener('keydown', onKey);
        document.body.classList.add('no-scroll');
        document.body.appendChild(overlay);
        return { element: overlay, close };
    },

    // A panel that comes in from the right, for a bigger form or for details. Esc or a click outside closes it.
    // The same as Ui.modal, only the shape is different. Returns { element, close }.
    drawer({ title, bodyHtml, size = 'max-w-md' }) {
        const overlay = document.createElement('div');
        overlay.className = 'fixed inset-0 z-50 flex justify-end bg-espresso/60';
        overlay.innerHTML = `
            <aside class="h-full w-full ${size} overflow-y-auto bg-white p-5 shadow-lg" role="dialog" aria-modal="true">
                <div class="mb-4 flex items-start justify-between gap-3">
                    <h2 class="text-lg font-semibold">${Ui.escape(title)}</h2>
                    <button type="button" data-close class="h-8 w-8 shrink-0 rounded-lg text-ink-soft hover:bg-page" aria-label="Close"><i class="fa-solid fa-xmark"></i></button>
                </div>
                <div data-drawer-body>${bodyHtml}</div>
            </aside>`;

        function close() {
            document.removeEventListener('keydown', onKey);
            document.body.classList.remove('no-scroll');
            overlay.remove();
        }
        function onKey(event) {
            if (event.key === 'Escape') close();
        }
        overlay.addEventListener('click', (event) => {
            if (event.target === overlay || event.target.closest('[data-close]')) close();
        });
        document.addEventListener('keydown', onKey);
        document.body.classList.add('no-scroll');
        document.body.appendChild(overlay);
        return { element: overlay, close };
    },

    // "Are you sure?" before something that cannot be undone. Gives true (confirmed) or false.
    // Usage:  if (await Ui.confirm({ title: 'Block user', message: '...', confirmText: 'Block', danger: true })) { ... }
    confirm({ title, message, confirmText = 'Confirm', danger = false }) {
        return new Promise((resolve) => {
            const buttonColour = danger ? 'bg-red-600 hover:bg-red-700' : 'bg-espresso hover:bg-espresso-hover';
            const box = Ui.modal({
                title,
                bodyHtml: `
                    <p class="text-sm text-ink-soft">${Ui.escape(message)}</p>
                    <div class="mt-5 flex justify-end gap-2">
                        <button type="button" data-answer="no" class="h-10 rounded-lg border border-line bg-white px-4 text-sm font-medium hover:bg-page">Cancel</button>
                        <button type="button" data-answer="yes" class="h-10 rounded-lg px-4 text-sm font-medium text-white ${buttonColour}">${Ui.escape(confirmText)}</button>
                    </div>`,
            });
            let answered = false;
            box.element.addEventListener('click', (event) => {
                const answer = event.target.closest('[data-answer]');
                if (!answer) {
                    // closed with the X, Esc or a click outside
                    if (!answered && (event.target === box.element || event.target.closest('[data-close]'))) {
                        answered = true;
                        resolve(false);
                    }
                    return;
                }
                answered = true;
                box.close();
                resolve(answer.dataset.answer === 'yes');
            });
            // Esc has no click, so watch for the removed box too
            const watcher = new MutationObserver(() => {
                if (!document.body.contains(box.element)) {
                    watcher.disconnect();
                    if (!answered) { answered = true; resolve(false); }
                }
            });
            watcher.observe(document.body, { childList: true });
        });
    },

    // ---------- lists for forms ----------

    // One Font Awesome icon for each facility (a facility we do not know gets a check mark)
    facilityIcon(name) {
        const icons = {
            'WiFi': 'fa-wifi',
            'Gas supply': 'fa-fire-flame-simple',
            'Generator backup': 'fa-bolt',
            'Lift': 'fa-elevator',
            'Filtered water': 'fa-droplet',
            'CCTV': 'fa-video',
            'Security guard': 'fa-shield-halved',
            'Washing machine': 'fa-soap',
            'Rooftop access': 'fa-sun',
            'Study table': 'fa-book-open',
        };
        return icons[name] || 'fa-circle-check';
    },

    // Makes a <select> that would have thousands of options searchable. The select stays in the form (hidden)
    // and keeps the chosen id, so  form.elements.university_id.value  still works, also to set a value:
    //     select.value = '3'      shows the name of university 3 (found with ?id=3)
    // A search box is shown instead. Typing asks the backend (path?q=word&limit=8) and lists what it finds.
    // Choosing sends a "change" event from the select, like a normal select does.
    //     options: { path: '/reference/areas', idKey: 'area_id', labelOf: (area) => area.area_name, anyLabel: 'Any area' }
    picker(select, { path, idKey, labelOf, anyLabel, limit = 8, wrapperClass = '' }) {
        let currentId = '';
        let currentLabel = '';
        let lastSearch = 0;          // an old slow answer must not replace a newer one
        let timer = null;
        let found = [];

        const wrapper = document.createElement('div');
        wrapper.className = ('relative ' + wrapperClass).trim();
        const input = document.createElement('input');
        input.type = 'text';
        input.autocomplete = 'off';
        if (select.id) input.id = select.id + '-search';
        input.className = select.className;
        input.placeholder = anyLabel;
        input.setAttribute('aria-label', anyLabel);
        const panel = document.createElement('div');
        panel.className = 'absolute left-0 right-0 z-30 mt-1 hidden max-h-60 overflow-y-auto rounded-lg border border-line bg-white py-1 text-sm shadow-lg';
        wrapper.append(input, panel);

        // the select is hidden, its label now belongs to the search box
        select.hidden = true;
        select.insertAdjacentElement('afterend', wrapper);
        const label = select.id ? document.querySelector(`label[for="${select.id}"]`) : null;
        if (label && input.id) label.setAttribute('for', input.id);

        function close() {
            panel.classList.add('hidden');
            input.value = currentLabel;          // a word that was typed but not chosen is dropped
        }

        function showList(items) {
            found = items;
            const any = currentId !== '' ? `<button type="button" data-pick="" class="block w-full px-3 py-2 text-left text-ink-soft hover:bg-page">${Ui.escape(anyLabel)}</button>` : '';
            const rows = items.map((item, index) => `<button type="button" data-pick="${index}" class="block w-full truncate px-3 py-2 text-left hover:bg-page">${Ui.escape(labelOf(item))}</button>`).join('');
            const hint = items.length >= limit ? '<p class="px-3 py-1.5 text-xs text-ink-soft">Type more letters to find others.</p>' : '';
            panel.innerHTML = any + rows + hint || '<p class="px-3 py-2 text-ink-soft">Nothing found.</p>';
            if (items.length === 0 && any) panel.insertAdjacentHTML('beforeend', '<p class="px-3 py-2 text-ink-soft">Nothing found.</p>');
            panel.classList.remove('hidden');
        }

        async function search(word) {
            const thisSearch = ++lastSearch;
            try {
                const items = await Api.get(path, { q: word, limit });
                if (thisSearch === lastSearch) showList(items);
            } catch (error) {
                if (thisSearch === lastSearch) panel.innerHTML = '<p class="px-3 py-2 text-red-700">Could not load the list.</p>';
            }
        }

        function choose(item) {
            currentId = item ? String(item[idKey]) : '';
            currentLabel = item ? labelOf(item) : '';
            input.value = currentLabel;
            panel.classList.add('hidden');
            select.dispatchEvent(new Event('change', { bubbles: true }));
        }

        input.addEventListener('focus', () => { input.select(); search(''); });
        input.addEventListener('input', () => {
            clearTimeout(timer);
            timer = setTimeout(() => search(input.value.trim()), 250);      // wait a little after the last key
        });
        input.addEventListener('change', (event) => event.stopPropagation());   // typing is not a choice
        input.addEventListener('keydown', (event) => {
            if (event.key === 'Escape') { close(); input.blur(); }
            if (event.key === 'Enter') {
                event.preventDefault();
                if (!panel.classList.contains('hidden') && found.length > 0) choose(found[0]);
            }
        });
        panel.addEventListener('mousedown', (event) => event.preventDefault());    // the box keeps the focus
        panel.addEventListener('click', (event) => {
            const pick = event.target.closest('[data-pick]');
            if (pick) choose(pick.dataset.pick === '' ? null : found[Number(pick.dataset.pick)]);
        });
        document.addEventListener('click', (event) => {
            if (!wrapper.contains(event.target) && !panel.classList.contains('hidden')) close();
        });

        // select.value = '3' and form.reset() work like they do for a normal select
        Object.defineProperty(select, 'value', {
            get: () => currentId,
            set: (value) => {
                const next = String(value === null || value === undefined ? '' : value);
                if (next === currentId && (next === '' || currentLabel !== '')) return;     // nothing changes
                currentId = next;
                currentLabel = '';
                input.value = '';
                if (currentId === '') return;
                const wanted = currentId;
                Api.get(path, { id: wanted }).then((items) => {
                    if (currentId === wanted && items.length > 0) {
                        currentLabel = labelOf(items[0]);
                        input.value = currentLabel;
                    }
                }).catch(() => { /* the id stays, only its name is missing */ });
            },
        });
        if (select.form) select.form.addEventListener('reset', () => { select.value = ''; });
    },

    // Fills a <select> with options. labelOf(item) gives the text of an option.
    fillSelect(select, items, valueKey, labelOf, firstLabel) {
        select.innerHTML = `<option value="">${Ui.escape(firstLabel)}</option>` + items
            .map((item) => `<option value="${item[valueKey]}">${Ui.escape(labelOf(item))}</option>`)
            .join('');
    },

    // ---------- pagination ----------

    // Fills the container with page numbers. onChange(page) is called when a number is pressed.
    renderPagination(container, page, totalPages, onChange) {
        if (totalPages <= 1) {
            container.innerHTML = '';
            return;
        }
        const first = Math.max(1, page - 2);
        const last = Math.min(totalPages, first + 4);
        const button = (label, target, active, disabled) => `
            <button type="button" data-page="${target}" ${disabled ? 'disabled' : ''}
                class="h-10 min-w-10 rounded-lg border px-3 text-sm font-medium ${active ? 'border-espresso bg-espresso text-white' : 'border-line bg-white hover:bg-page'} disabled:cursor-not-allowed disabled:text-mute">${label}</button>`;

        let html = button('<i class="fa-solid fa-chevron-left"></i>', page - 1, false, page === 1);
        for (let number = first; number <= last; number += 1) html += button(number, number, number === page, false);
        html += button('<i class="fa-solid fa-chevron-right"></i>', page + 1, false, page === totalPages);

        container.innerHTML = `<div class="flex flex-wrap items-center justify-center gap-1.5">${html}</div>`;
        container.onclick = (event) => {
            const target = event.target.closest('[data-page]');
            if (target && !target.disabled) onChange(Number(target.dataset.page));
        };
    },
};
