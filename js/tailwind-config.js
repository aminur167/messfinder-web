// The colours of the "Warm earth" theme. This is the only place where a colour is chosen.
// To change the look of the whole site, change the values here.
// Load this file after the Tailwind script and before the page content.
tailwind.config = {
    theme: {
        extend: {
            colors: {
                espresso: { DEFAULT: '#322D27', hover: '#4a4239' },   // navbar, sidebar, main buttons
                ochre: { DEFAULT: '#BF8440', soft: '#f1e4d0', dark: '#6b4a1f' },   // icons, stars, small lines
                link: '#8a5a1f',                                      // text links (a darker ochre, easier to read)
                ink: { DEFAULT: '#322D27', soft: '#7F7265' },         // main text and helper text
                mute: '#AAAAAE',                                      // placeholder and disabled
                line: '#e4e2ea',                                      // borders and dividers
                page: '#F5F4F8',                                      // background of the pages (almost white, close to the cards)
            },
            fontFamily: {
                sans: ['Inter', '"Hind Siliguri"', 'system-ui', 'sans-serif'],
                display: ['Outfit', 'Inter', '"Hind Siliguri"', 'sans-serif'],   // headings
            },
        },
    },
};
