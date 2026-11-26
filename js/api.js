import { CONFIG, ENDPOINTS } from "./config.js";

import {
    getToken,
    clearSession,
    redirectToLogin
} from "./auth.js";

export class ApiError extends Error {
    constructor(status, message, data = null) {
        super(message);

        this.name = "ApiError";
        this.status = status;
        this.data = data;
    }
}

function getErrorMessage(status, data) {
    switch (status) {
        case 400:
            return "הנתונים שהוזנו אינם תקינים. יש לבדוק את הפרטים.";

        case 401:
            return "פרטי ההתחברות אינם תקינים או שתוקף ההתחברות הסתיים.";

        case 403:
            return "אין לך הרשאה לבצע פעולה זו.";

        case 404:
            return "המידע המבוקש לא נמצא או אינו זמין עוד.";

        case 409:
            return "לא ניתן להשלים את הפעולה עקב התנגשות או מגבלה במערכת. יש לרענן את הנתונים ולבדוק שוב.";

        case 429:
            return "בוצעו יותר מדי בקשות. יש לנסות שוב בהמשך.";

        default:
            return status >= 500
                ? "אירעה תקלה בשרת. יש לנסות שוב בהמשך."
                : "לא ניתן להשלים את הפעולה.";
    }
}

export async function request(
    endpoint,
    {
        method = "GET",
        body = undefined,
        query = undefined,
        authenticated = true,
        signal = undefined
    } = {}
) {
    if (!CONFIG.API_BASE_URL) {
        throw new ApiError(
            0,
            "כתובת השרת טרם הוגדרה."
        );
    }

    const url = new URL(
        `${CONFIG.API_BASE_URL}${endpoint}`
    );

    if (query) {
        Object.entries(query).forEach(([key, value]) => {
            if (
                value !== undefined &&
                value !== null &&
                value !== ""
            ) {
                url.searchParams.set(key, String(value));
            }
        });
    }

    const headers = {
        Accept: "application/json"
    };

    if (body !== undefined) {
        headers["Content-Type"] = "application/json";
    }

    const token = authenticated ? getToken() : null;

    if (token) {
        headers.Authorization = `Bearer ${token}`;
    }

    let response;

    try {
        response = await fetch(url, {
            method,
            headers,
            body: body !== undefined
                ? JSON.stringify(body)
                : undefined,
            signal,
            cache: "no-store"
        });
    } catch (error) {
        if (error.name === "AbortError") {
            throw error;
        }

        throw new ApiError(
            0,
            "לא ניתן להתחבר לשרת. יש לבדוק את החיבור ולנסות שוב."
        );
    }

    let data = null;

    if (response.status !== 204) {
        const contentType =
            response.headers.get("content-type") ?? "";

        if (contentType.includes("json")) {
            try {
                data = await response.json();
            } catch {
                if (response.ok) {
                    throw new ApiError(
                        response.status,
                        "התקבלה תגובה לא תקינה מהשרת."
                    );
                }
            }
        }
    }

    if (!response.ok) {
        if (response.status === 401 && authenticated) {
            clearSession();
            redirectToLogin();
        }

        throw new ApiError(
            response.status,
            getErrorMessage(response.status, data),
            data
        );
    }

    return data;
}

export const api = Object.freeze({
    auth: {
        login: data => request(ENDPOINTS.LOGIN, {
            method: "POST",
            body: data,
            authenticated: false
        }),

        register: data => request(ENDPOINTS.REGISTER, {
            method: "POST",
            body: data,
            authenticated: false
        })
    },

    events: {
        search: (query = {}, options = {}) =>
            request(ENDPOINTS.EVENTS, {
                query,
                ...options
            }),

        get: (id, options = {}) =>
            request(ENDPOINTS.EVENT(id), options),

        create: data => request(ENDPOINTS.EVENTS, {
            method: "POST",
            body: data
        }),

        update: (id, data) =>
            request(ENDPOINTS.EVENT(id), {
                method: "PUT",
                body: data
            }),

        cancel: id => request(ENDPOINTS.EVENT(id), {
            method: "DELETE"
        }),

        restore: id =>
            request(ENDPOINTS.EVENT_STATUS(id), {
                method: "PATCH"
            })
    },

    seats: {
        get: (eventId, options = {}) =>
            request(
                ENDPOINTS.EVENT_SEATS(eventId),
                options
            ),

        reserve: (eventId, eventSeatIds) =>
            request(
                ENDPOINTS.SEAT_RESERVATIONS(eventId),
                {
                    method: "POST",
                    body: { eventSeatIds }
                }
            ),

        release: (eventId, eventSeatIds) =>
            request(
                ENDPOINTS.SEAT_RESERVATIONS(eventId),
                {
                    method: "PATCH",
                    body: { eventSeatIds }
                }
            )
    },

    bookings: {
        getForEvent: (id, options = {}) =>
            request(ENDPOINTS.EVENT_BOOKINGS(id), options),

        create: eventSeatId =>
            request(ENDPOINTS.BOOKINGS, {
                method: "POST",
                body: { eventSeatId }
            }),

        get: id =>
            request(ENDPOINTS.BOOKING(id)),

        getMy: () =>
            request(ENDPOINTS.MY_BOOKINGS),

        cancel: id =>
            request(ENDPOINTS.BOOKING(id), {
                method: "DELETE"
            })
    },

    halls: {
        getAll: options =>
            request(ENDPOINTS.HALLS, options),

        get: id =>
            request(ENDPOINTS.HALL(id)),

        create: data =>
            request(ENDPOINTS.HALLS, {
                method: "POST",
                body: data
            }),

        update: (id, data) =>
            request(ENDPOINTS.HALL(id), {
                method: "PUT",
                body: data
            }),

        delete: id =>
            request(ENDPOINTS.HALL(id), {
                method: "DELETE"
            })
    }
});