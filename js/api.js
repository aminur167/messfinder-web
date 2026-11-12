// Every call to the backend goes through this file.
// Usage:  const data = await Api.get('/messes', { area_id: 3 });
//         await Api.post('/auth/login', { email, password });
// When something goes wrong it throws an ApiError, with the message the backend sent.

class ApiError extends Error {
    constructor(status, message) {
        super(message);
        this.status = status;
    }
}

async function sendRequest(method, path, body) {
    const headers = {};
    const token = Auth.getToken();
    if (token) headers.Authorization = 'Bearer ' + token;
    if (body !== undefined) headers['Content-Type'] = 'application/json';

    let response;
    try {
        response = await fetch(API_URL + path, {
            method,
            headers,
            body: body === undefined ? undefined : JSON.stringify(body),
        });
    } catch (error) {
        // the server is off, or the address is wrong
        throw new ApiError(0, 'Cannot reach the server. Please check that the backend is running.');
    }

    const text = await response.text();
    const data = text ? JSON.parse(text) : null;

    if (!response.ok) {
        // an old or blocked token: log out and ask for a new login
        // (a wrong current password on the Profile page is also a 401, but the login is still good)
        if (response.status === 401 && token && path !== '/auth/password') {
            Auth.logout('expired');
        }
        throw new ApiError(response.status, (data && data.error) || 'Something went wrong');
    }
    return data;
}

const Api = {
    // params are put in the address (?a=1&b=2). Empty values are left out.
    get(path, params) {
        let query = '';
        if (params) {
            const search = new URLSearchParams();
            Object.entries(params).forEach(([key, value]) => {
                if (value !== undefined && value !== null && value !== '') search.append(key, value);
            });
            if ([...search].length > 0) query = '?' + search.toString();
        }
        return sendRequest('GET', path + query);
    },
    post: (path, body = {}) => sendRequest('POST', path, body),
    put: (path, body = {}) => sendRequest('PUT', path, body),
    patch: (path, body = {}) => sendRequest('PATCH', path, body),
    delete: (path) => sendRequest('DELETE', path),
};
