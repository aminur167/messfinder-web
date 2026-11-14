// The mess card, used on the Home, Browse and Interested pages.
// MessCard.html(mess) gives the card as HTML text.
// MessCard.activateHearts(container) makes the heart buttons inside the container work (call it once).

const MessCard = {
    // 3000 and 4500 -> "৳3,000 - ৳4,500", the same rent twice -> "৳3,000"
    rentText(min, max) {
        if (min === null || min === undefined) return 'Rent not set';
        if (Number(min) === Number(max)) return Ui.money(min);
        return Ui.money(min) + ' - ' + Ui.money(max);
    },

    html(mess) {
        const detailsLink = `${SITE_ROOT}pages/mess-details.html?id=${mess.mess_id}`;

        const seats = mess.free_seats > 0
            ? Ui.badge(`${mess.free_seats} ${mess.free_seats === 1 ? 'seat' : 'seats'} free`, 'green')
            : Ui.badge('Full', 'slate');

        const rating = mess.review_count > 0
            ? Ui.stars(mess.avg_rating, mess.review_count)
            : '<span class="text-sm text-ink-soft">No reviews yet</span>';

        // the first 3 facilities as small icons
        const facilities = (mess.facilities || []).slice(0, 3)
            .map((f) => `<span class="inline-flex h-7 w-7 items-center justify-center rounded-full bg-page text-xs text-ink-soft" title="${Ui.escape(f.facility_name)}"><i class="fa-solid ${Ui.facilityIcon(f.facility_name)}"></i></span>`)
            .join('');
        const moreFacilities = (mess.facilities || []).length > 3
            ? `<span class="text-xs text-ink-soft">+${mess.facilities.length - 3}</span>` : '';

        const distance = mess.distance_km !== null && mess.distance_km !== undefined
            ? `<span class="absolute bottom-2 left-2 rounded-full bg-white px-2.5 py-0.5 text-xs font-medium"><i class="fa-solid fa-location-dot mr-1 text-ochre"></i>${Number(mess.distance_km).toFixed(1)} km</span>`
            : '';

        const heartOn = mess.is_interested;
        return `
            <article class="relative flex flex-col overflow-hidden rounded-xl border border-line bg-white shadow-sm hover:border-mute">
                <a href="${detailsLink}" class="flex flex-1 flex-col">
                    <div class="relative flex h-28 items-center justify-center bg-ochre-soft">
                        <i class="fa-solid fa-building text-4xl text-ochre"></i>
                        <span class="absolute left-2 top-2">${Ui.badge(mess.mess_type === 'girls' ? 'Girls' : 'Boys', 'slate')}</span>
                        ${distance}
                    </div>
                    <div class="flex flex-1 flex-col gap-2 p-4">
                        <h3 class="text-base font-semibold leading-snug">${Ui.escape(mess.mess_name)}</h3>
                        <p class="text-sm text-ink-soft"><i class="fa-solid fa-location-dot mr-1.5 text-ochre"></i>${Ui.escape(mess.area_name)}</p>
                        <p class="text-sm font-semibold">${MessCard.rentText(mess.min_rent, mess.max_rent)} <span class="font-normal text-ink-soft">/ month</span></p>
                        <div class="flex flex-wrap items-center justify-between gap-2">
                            ${seats}
                            ${rating}
                        </div>
                        <div class="mt-auto flex items-center gap-1.5 pt-2">${facilities}${moreFacilities}</div>
                    </div>
                </a>
                <button type="button" data-heart="${mess.mess_id}" data-on="${heartOn ? '1' : '0'}"
                    class="absolute right-2 top-2 flex h-9 w-9 items-center justify-center rounded-full bg-white shadow hover:bg-ochre-soft"
                    aria-label="Interested" title="Interested">
                    <i class="${heartOn ? 'fa-solid text-ochre' : 'fa-regular text-ink-soft'} fa-heart"></i>
                </button>
            </article>`;
    },

    // The skeleton of a card, shown while the list is loading
    skeleton() {
        return '<div class="skeleton h-72 w-full rounded-xl"></div>';
    },

    // One listener for all the hearts of a container (also for hearts that are added later).
    activateHearts(container) {
        container.addEventListener('click', async (event) => {
            const button = event.target.closest('[data-heart]');
            if (!button) return;

            // a visitor must login first, and come back to this page
            const user = Auth.isLoggedIn() ? Auth.getUser() : null;
            if (!user) {
                location.href = SITE_ROOT + 'pages/login.html?next=' + encodeURIComponent(location.href);
                return;
            }
            if (user.role !== 'student') {
                Ui.toast('Only students can mark a mess as interested', 'error');
                return;
            }

            button.disabled = true;
            try {
                const result = await Api.post('/interests/toggle', { mess_id: Number(button.dataset.heart) });
                button.dataset.on = result.is_interested ? '1' : '0';
                button.querySelector('i').className = (result.is_interested ? 'fa-solid text-ochre' : 'fa-regular text-ink-soft') + ' fa-heart';
                Ui.toast(result.is_interested ? 'Added to your interested list' : 'Removed from your interested list');
            } catch (error) {
                Ui.toast(error.message, 'error');
            }
            button.disabled = false;
        });
    },
};
