# Mess Finder - Frontend

The website of Mess Finder. Students find a mess, managers advertise free seats and manage members, the admin checks everything.
It talks to the API of the `backend` repository.

## Technology

| Part | Technology |
|---|---|
| Pages | HTML |
| Style | Tailwind CSS (CDN) and a small `css/style.css` |
| Logic | Plain JavaScript (no framework, no build step) |
| Icons and font | Font Awesome 6, Inter and Hind Siliguri (for Bangla text) |
| Charts | Chart.js (only the admin reports) |
| Chat | Socket.io client |

## Run the website

1. Start the backend first, see the `backend` repository. The API must answer at `http://localhost:5000/api`.
2. Serve this folder on **port 5500**. The backend allows exactly this address (`CLIENT_ORIGIN` in its `.env` file).
   - With the VS Code extension Live Server: right click `index.html`, then "Open with Live Server".
   - Or from this folder:

```powershell
python -m http.server 5500
```

3. Open `http://localhost:5500`.

If the backend runs on another address, change the two lines in `js/config.js`.

## Demo logins

All demo accounts use the password `Demo@1234`.

| Role | Email |
|---|---|
| Student | `rafsan.jani@example.com` |
| Manager | `abdur.rahman@example.com` |
| Admin | `admin@example.com` |

The login page has three **Quick login** buttons (Student, Manager, Admin) that fill in these accounts and log in.
More accounts are listed in `backend/database/README.md`.

## Folder structure

```
frontend/
|-- index.html              home page
|-- pages/                  one HTML file for each page
|   |-- manager/            pages of the manager
|   `-- admin/              pages of the admin
|-- js/
|   |-- config.js           address of the backend (change it here)
|   |-- tailwind-config.js  the colours of the theme (change them here)
|   |-- api.js              every call to the backend
|   |-- auth.js             who is logged in, page guards, where to go after login
|   |-- components.js       toast, modal, drawer, confirm, badge, avatar, stars, pagination, search picker...
|   |-- layout.js           navbar, tab bar of phones, sidebar of manager and admin
|   |-- mess-card.js        the mess card (Home, Browse, Interested)
|   `-- (one js file for each page)
`-- css/style.css           the few styles that Tailwind classes cannot do
```

## How a page is built

Every page has the same shape. It writes its content inside `<div id="page">`, loads the shared scripts,
and calls `Layout.start(...)`. The layout adds the frame that fits the user (navbar for visitors and students,
sidebar for managers and admins).

```html
<div id="page"> ...the content of the page... </div>

<script src="../js/config.js"></script>
<script src="../js/auth.js"></script>
<script src="../js/api.js"></script>
<script src="../js/components.js"></script>
<script src="../js/layout.js"></script>
<script>
    Layout.start({ active: 'browse', title: 'Browse messes' });
</script>
```

A page that needs a login adds `login: true`, a page for one role adds `roles: ['manager']`.
A visitor is sent to the login page and comes back after login. A user with a wrong role goes to his own home.

## Change the colours

All colours are in `js/tailwind-config.js` (the theme is "Warm earth"). The page uses names like
`bg-espresso`, `text-ink-soft`, `border-line`, so changing a value there changes the whole website.

## Big lists: pages and search boxes

The database can hold thousands of users, messes and posts, so no page loads a whole table:

- Every long list is shown in **pages** (`Ui.renderPagination`): Browse, Newsfeed, Notifications, Members, Interested
  students, Visit requests, Posts, Reviews, and the admin lists (Verification, Users, Complaints, Moderation).
- Lists of areas and universities (filters, forms) and the mess of a complaint are **search boxes**
  (`Ui.picker` in `js/components.js`): type a few letters, the backend answers with the first matches.

## Look and feel

- Light page colour that melts into the white cards, small text on laptops (14px base, 16px on phones),
  headings in Outfit and the rest in Inter (Hind Siliguri for Bangla).
- Laptop layouts use two or three columns (Newsfeed, Profile, Complaints, My mess, Mess setup, Reviews).
  On phones every page is one column, tables scroll sideways, the sidebar becomes a drawer.
- Filters that choose one thing (All, Paid, Overdue...) are plain text with a line under the chosen one.

## A short tour for the demo

1. **Student:** Quick login as Student, search a mess on Browse, open it, press Interested, write on the Newsfeed.
2. **Manager:** Quick login as Manager, look at the Dashboard, add a member to a free seat, record a payment.
3. **Admin:** Quick login as Admin, approve a new manager and mess on Verification, open Reports.

## Pages

| Page | State |
|---|---|
| Login, Register | Done |
| Home, Browse, Mess details | Done |
| Newsfeed (with comments and the Interested button), Interested list | Done |
| Chat (live with Socket.io), Notifications, Profile | Done |
| My mess, My visits, Complaints (student and manager) | Done |
| Manager: Dashboard, Mess setup (mess info, rooms and seats) | Done |
| Manager: Members (with payments), Room-wise seats | Done |
| Manager: Posts, Interested students, Visit requests, Reviews | Done |
| Admin: Dashboard, Verification, Users, Complaints, Moderation, Reports (with Chart.js) | Done |
