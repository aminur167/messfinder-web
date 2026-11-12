// The two addresses of the backend. Change them here if the backend runs somewhere else.
const API_URL = 'https://mess-finder-backend-production.up.railway.app/api';
const SOCKET_URL = 'https://mess-finder-backend-production.up.railway.app';

// The folder of the website, found from the place where this file was loaded.
// Every link and redirect is built from it, so the same code works from pages/ and pages/manager/.
const SITE_ROOT = new URL('../', document.currentScript.src).href;
