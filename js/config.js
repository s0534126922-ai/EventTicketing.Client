import { DEPLOYED_API_BASE_URL } from "./deployment.js";

const isLocal = ["localhost", "127.0.0.1"].includes(
    window.location.hostname
);

export const CONFIG = Object.freeze({
    APP_NAME: "EventTicketing",
    API_BASE_URL: isLocal
        ? "http://localhost:5066/api"
        : DEPLOYED_API_BASE_URL,
    PAGE_SIZE: 10,
    SEATS_PER_ROW: 12,
    TIME_ZONE: "Asia/Jerusalem",
    SESSION_KEY: "eventticketing.session"
});

export const ROLES = Object.freeze({
    USER: "User",
    ADMIN: "Admin"
});

export const EVENT_STATUS = Object.freeze({
    ACTIVE: 1,
    CANCELLED: 2,
    FINISHED: 3
});

export const SEAT_STATUS = Object.freeze({
    AVAILABLE: 1,
    BOOKED: 2,
    RESERVED_BY_ADMIN: 3
});

export const BOOKING_STATUS = Object.freeze({
    CONFIRMED: 1,
    DELETED: 2,
    CANCELLED_BY_EVENT: 3
});

export const EVENT_STATUS_LABELS = Object.freeze({
    [EVENT_STATUS.ACTIVE]: "פעיל",
    [EVENT_STATUS.CANCELLED]: "מבוטל",
    [EVENT_STATUS.FINISHED]: "הסתיים"
});

export const BOOKING_STATUS_LABELS = Object.freeze({
    [BOOKING_STATUS.CONFIRMED]: "מאושרת",
    [BOOKING_STATUS.DELETED]: "נמחקה",
    [BOOKING_STATUS.CANCELLED_BY_EVENT]:
        "בוטלה עקב ביטול האירוע"
});

export const ENDPOINTS = Object.freeze({
    LOGIN: "/auth/login",
    REGISTER: "/auth/register",

    EVENTS: "/events",
    EVENT: id => `/events/${id}`,
    EVENT_STATUS: id => `/events/${id}/status`,

    EVENT_BOOKINGS: id => `/events/${id}/bookings`,
    EVENT_SEATS: id => `/events/${id}/seats`,
    SEAT_RESERVATIONS: id =>
        `/events/${id}/seats/reservations`,

    BOOKINGS: "/bookings",
    BOOKING: id => `/bookings/${id}`,
    MY_BOOKINGS: "/bookings/my",

    HALLS: "/halls",
    HALL: id => `/halls/${id}`
});