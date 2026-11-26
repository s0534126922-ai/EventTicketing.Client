import { api } from "./api.js";

import {
    ROLES,
    EVENT_STATUS,
    EVENT_STATUS_LABELS,
    BOOKING_STATUS_LABELS
} from "./config.js";

import { requireAuth } from "./auth.js";
import { renderLayout } from "./layout.js";
import { SeatMap } from "./seat-map.js";

import {
    escapeHtml,
    formatDate,
    formatTimeRange,
    toIsraelDateTimeInput,
    getFormData,
    showMessage,
    clearMessage,
    showLoading,
    showEmpty,
    showError,
    setButtonLoading,
    confirmAction,
    renderPagination,
    debounce
} from "./utils.js";

const $ = id => document.getElementById(id);

const elements = {
    content: $("admin-content"),
    message: $("admin-message"),
    eventsTable: $("events-table"),
    eventsPagination: $("events-pagination"),
    eventFilters: $("event-filters"),
    eventDialog: $("event-dialog"),
    eventForm: $("event-form"),
    eventFormMessage: $("event-form-message"),
    hallsTable: $("halls-table"),
    hallDialog: $("hall-dialog"),
    hallForm: $("hall-form"),
    hallFormMessage: $("hall-form-message"),
    seatEvent: $("seat-event"),
    seatMode: $("seat-mode"),
    seatSearch: $("seat-event-search"),
    seatPagination: $("seat-events-pagination"),
    seatMessage: $("admin-seat-message"),
    seatContainer: $("admin-seat-map"),
    seatSelection: $("admin-selected-seats"),
    seatAction: $("apply-seat-action"),
    seatRefresh: $("refresh-admin-seats"),
    seatDetails: $("seat-event-details")
};

let halls = [];
let events = [];
let seatEvents = [];

let currentTab = "events";
let eventPage = 1;
let seatEventPage = 1;

let editingEventId = null;
let editingHallId = null;

let busy = false;
let seatsLoading = false;
let seatsReady = false;

let eventsRequest = null;
let seatEventsRequest = null;
let seatsRequest = null;

const seatMap = new SeatMap(elements.seatContainer, {
    mode: "reserve",
    onSelectionChange: updateSeatSelection
});

function reportError(error, container = elements.message) {
    showMessage(
        container,
        error.message || "אירעה שגיאה בלתי צפויה.",
        error.status === 409 ? "warning" : "error"
    );
}

function actionButton(action, id, label, style = "outline") {
    return `
        <button type="button"
            class="btn btn-${style} btn-small"
            data-action="${escapeHtml(action)}"
            data-id="${escapeHtml(id)}">
            ${escapeHtml(label)}
        </button>
    `;
}

function renderTable(container, headers, rows) {
    container.innerHTML = `
        <div class="table-wrapper">
            <table class="data-table">
                <thead>
                    <tr>
                        ${headers.map(header =>
                            `<th scope="col">${escapeHtml(header)}</th>`
                        ).join("")}
                    </tr>
                </thead>

                <tbody>
                    ${rows.join("")}
                </tbody>
            </table>
        </div>
    `;
}

function todayInIsrael() {
    return toIsraelDateTimeInput(new Date()).slice(0, 10);
}

function eventDateInIsrael(event) {
    return toIsraelDateTimeInput(event.startTime).slice(0, 10);
}

function isFutureEvent(event) {
    return Date.parse(event.startTime) > Date.now();
}

function isActiveFutureEvent(event) {
    return event.status === EVENT_STATUS.ACTIVE &&
        isFutureEvent(event);
}

function canEditEvent(event) {
    return event.status === EVENT_STATUS.ACTIVE &&
        eventDateInIsrael(event) > todayInIsrael();
}

function canRestoreEvent(event) {
    return event.status === EVENT_STATUS.CANCELLED &&
        eventDateInIsrael(event) > todayInIsrael();
}

function eventStatusClass(status) {
    switch (status) {
        case EVENT_STATUS.ACTIVE:
            return "status-active";

        case EVENT_STATUS.CANCELLED:
            return "status-cancelled";

        default:
            return "status-finished";
    }
}

function fillHallOptions(select, includeAll = false) {
    const previousValue = select.value;

    select.replaceChildren();

    select.add(new Option(
        includeAll ? "כל האולמות" : "בחרו אולם",
        ""
    ));

    for (const hall of halls) {
        select.add(new Option(
            `${hall.name} (${hall.seatCount} מקומות)`,
            String(hall.id)
        ));
    }

    if (halls.some(hall =>
        String(hall.id) === previousValue
    )) {
        select.value = previousValue;
    }
}

async function loadHalls() {
    halls = await api.halls.getAll();

    fillHallOptions($("filter-hall"), true);
    fillHallOptions($("event-hall"));

    renderHalls();
}

function renderHalls() {
    if (!halls.length) {
        showEmpty(
            elements.hallsTable,
            "עדיין אין אולמות",
            "צרו אולם חדש כדי להתחיל ליצור אירועים."
        );

        return;
    }

    const rows = halls.map(hall => `
        <tr>
            <td>${escapeHtml(hall.id)}</td>

            <td>
                <strong>${escapeHtml(hall.name)}</strong>
            </td>

            <td>${escapeHtml(hall.seatCount)}</td>

            <td>
                <div class="actions">
                    ${actionButton(
                        "edit-hall",
                        hall.id,
                        "עריכה"
                    )}

                    ${hall.hasEverHostedEvent !== true
                        ? actionButton(
                            "delete-hall",
                            hall.id,
                            "מחיקה",
                            "danger"
                        )
                        : `<small class="muted">
                            לא ניתן למחוק אולם ששימש לאירוע
                           </small>`
                    }
                </div>
            </td>
        </tr>
    `);

    renderTable(
        elements.hallsTable,
        ["מספר", "שם האולם", "מספר כיסאות", "פעולות"],
        rows
    );
}

async function showEventBookings(id) {
    const event = events.find(item => item.id === id);
    if (!event) return;

    const dialog = $("event-bookings-dialog");
    const container = $("event-bookings-table");
    $("event-bookings-title").textContent = `הזמנות לאירוע ${event.name}`;

    const request = new AbortController();
    dialog.addEventListener("close", () => request.abort(), { once: true });
    dialog.showModal();
    showLoading(container);

    try {
        const bookings = await api.bookings.getForEvent(id, {
            signal: request.signal
        });

        if (!bookings.length) {
            showEmpty(container, "אין הזמנות לאירוע");
            return;
        }

        const rows = bookings.map(({ booking, userName, userEmail }) => `
            <tr>
                <td>${escapeHtml(booking.id)}</td>
                <td>${escapeHtml(booking.seatNumber)}</td>
                <td>${escapeHtml(userName)}</td>
                <td>${escapeHtml(userEmail)}</td>
                <td>${escapeHtml(BOOKING_STATUS_LABELS[booking.status] || "לא ידוע")}</td>
            </tr>
        `);

        renderTable(container, ["הזמנה", "כיסא", "שם", "דוא״ל", "סטטוס"], rows);
    } catch (error) {
        if (error.name !== "AbortError") showError(container, error);
    }
}

function renderEvents() {
    if (!events.length) {
        showEmpty(
            elements.eventsTable,
            "לא נמצאו אירועים",
            "ניתן לשנות את הסינון או ליצור אירוע חדש."
        );

        return;
    }

    const rows = events.map(event => `
        <tr>
            <td>
                <strong>${escapeHtml(event.name)}</strong>
            </td>

            <td>${escapeHtml(event.hallName)}</td>

            <td>
                ${escapeHtml(formatDate(event.startTime))}
            </td>

            <td>
                <bdi>
                    ${escapeHtml(formatTimeRange(
                        event.startTime,
                        event.endTime
                    ))}
                </bdi>
            </td>

            <td>
                <span class="status-badge ${eventStatusClass(event.status)}">
                    ${escapeHtml(
                        EVENT_STATUS_LABELS[event.status] ||
                        "לא ידוע"
                    )}
                </span>
            </td>

            <td>
                <div class="actions">
                    ${actionButton("view-bookings", event.id, "הזמנות")}

                    ${canEditEvent(event)
                        ? actionButton(
                            "edit-event",
                            event.id,
                            "עריכה"
                        )
                        : ""
                    }

                    ${isActiveFutureEvent(event)
                        ? actionButton(
                            "cancel-event",
                            event.id,
                            "ביטול",
                            "danger"
                        )
                        : ""
                    }

                    ${canRestoreEvent(event)
                        ? actionButton(
                            "restore-event",
                            event.id,
                            "שחזור",
                            "primary"
                        )
                        : ""
                    }

                    ${isActiveFutureEvent(event)
                        ? actionButton(
                            "manage-seats",
                            event.id,
                            "ניהול מקומות"
                        )
                        : ""
                    }
                </div>
            </td>
        </tr>
    `);

    renderTable(
        elements.eventsTable,
        [
            "שם האירוע",
            "אולם",
            "תאריך",
            "שעות",
            "סטטוס",
            "פעולות"
        ],
        rows
    );
}

async function loadEvents(page = 1) {
    eventsRequest?.abort();

    const controller = new AbortController();

    eventsRequest = controller;
    eventPage = page;

    elements.eventsPagination.replaceChildren();

    showLoading(
        elements.eventsTable,
        "טוען את רשימת האירועים..."
    );

    try {
        const filters = getFormData(elements.eventFilters);

        const data = await api.events.search({
            search: filters.search.trim(),
            hallId: filters.hallId || undefined,
            status: filters.status || undefined,
            descending: filters.descending === "true",
            pageNumber: page
        }, {
            signal: controller.signal
        });

        if (controller.signal.aborted) return;

        if (
            data.totalPages > 0 &&
            page > data.totalPages
        ) {
            await loadEvents(data.totalPages);
            return;
        }

        events = data.items;

        renderEvents();

        renderPagination(
            elements.eventsPagination,
            data,
            loadEvents
        );
    } catch (error) {
        if (error.name === "AbortError") return;

        events = [];

        showError(
            elements.eventsTable,
            error,
            () => loadEvents(eventPage)
        );
    }
}

async function openEventEditor(id = null) {
    if (busy) return;

    busy = true;

    clearMessage(elements.message);
    clearMessage(elements.eventFormMessage);

    try {
        await loadHalls();

        if (!halls.length) {
            showMessage(
                elements.message,
                "יש ליצור אולם לפני יצירת אירוע.",
                "warning"
            );

            return;
        }

        editingEventId = id;

        elements.eventForm.reset();

        fillHallOptions($("event-hall"));

        $("event-name").maxLength = 100;
        $("event-description").maxLength = 1000;

        $("event-dialog-title").textContent = id
            ? "עריכת אירוע"
            : "יצירת אירוע חדש";

        $("event-edit-note").hidden = !id;

        $("event-edit-note").textContent =
            "לאחר שבוצעה הזמנת משתמש באירוע, " +
            "לא ניתן לשנות את האולם, התאריך או השעות.";

        if (id) {
            const event = await api.events.get(id);

            if (!canEditEvent(event)) {
                showMessage(
                    elements.message,
                    "לא ניתן לערוך אירוע זה במועד הנוכחי.",
                    "warning"
                );

                await loadEvents(eventPage);
                return;
            }

            $("event-name").value = event.name;
            $("event-description").value =
                event.description || "";

            $("event-hall").value = String(event.hallId);

            $("event-start").value =
                toIsraelDateTimeInput(event.startTime);

            $("event-end").value =
                toIsraelDateTimeInput(event.endTime);
        }

        elements.eventDialog.showModal();
    } catch (error) {
        reportError(error);
    } finally {
        busy = false;
    }
}

function validateEvent(data) {
    if (!data.name) {
        return "יש להזין שם לאירוע.";
    }

    if (
        !Number.isSafeInteger(data.hallId) ||
        data.hallId <= 0
    ) {
        return "יש לבחור אולם.";
    }

    if (!data.startTime || !data.endTime) {
        return "יש להזין מועד התחלה ומועד סיום.";
    }

    if (
        data.startTime.slice(0, 10) !==
        data.endTime.slice(0, 10)
    ) {
        return "האירוע חייב להתחיל ולהסתיים באותו יום.";
    }

    if (data.startTime.slice(11, 16) < "08:00") {
        return "לא ניתן להתחיל אירוע לפני השעה 08:00.";
    }

    if (data.endTime <= data.startTime) {
        return "שעת הסיום חייבת להיות מאוחרת משעת ההתחלה.";
    }

    if (!editingEventId) {
        const minimum = toIsraelDateTimeInput(
            new Date(Date.now() + 24 * 60 * 60 * 1000)
        );

        if (data.startTime < minimum) {
            return "יש ליצור אירוע לפחות 24 שעות מראש.";
        }
    } else if (
        data.startTime.slice(0, 10) <= todayInIsrael()
    ) {
        return "לא ניתן להעביר אירוע להיום או לתאריך שעבר.";
    }

    return null;
}

async function saveEvent(event) {
    event.preventDefault();

    if (busy) return;

    clearMessage(elements.eventFormMessage);

    const values = getFormData(elements.eventForm);

    const data = {
        name: values.name.trim(),
        description: values.description.trim() || null,
        hallId: Number(values.hallId),
        startTime: values.startTime,
        endTime: values.endTime
    };

    const validationError = validateEvent(data);

    if (validationError) {
        showMessage(
            elements.eventFormMessage,
            validationError
        );

        return;
    }

    const button = elements.eventForm.querySelector(
        '[type="submit"]'
    );

    busy = true;

    setButtonLoading(button, true, "שומר אירוע...");

    try {
        if (editingEventId) {
            await api.events.update(editingEventId, data);
        } else {
            await api.events.create(data);
        }

        elements.eventDialog.close();

        showMessage(
            elements.message,
            editingEventId
                ? "האירוע עודכן בהצלחה."
                : "האירוע נוצר בהצלחה.",
            "success"
        );

        await loadEvents(eventPage);
    } catch (error) {
        if (error.status === 409) {
            showMessage(
                elements.eventFormMessage,
                "לא ניתן לשמור את האירוע. בדקו שאין התנגשות " +
                "עם אירוע אחר באולם, שנשמר מרווח של שעה " +
                "ושלא שונו פרטים האסורים לשינוי לאחר הזמנה.",
                "warning"
            );
        } else {
            reportError(error, elements.eventFormMessage);
        }
    } finally {
        busy = false;
        setButtonLoading(button, false);
    }
}

async function changeEventStatus(id, restore = false) {
    if (busy) return;

    const event = events.find(item => item.id === id);

    if (!event) return;

    if (
        restore
            ? !canRestoreEvent(event)
            : !isActiveFutureEvent(event)
    ) {
        showMessage(
            elements.message,
            "לא ניתן לבצע את הפעולה במצב האירוע הנוכחי.",
            "warning"
        );

        await loadEvents(eventPage);
        return;
    }

    busy = true;

    clearMessage(elements.message);

    try {
        const confirmed = await confirmAction({
            title: restore
                ? "שחזור אירוע"
                : "ביטול אירוע",

            message: restore
                ? `האם לשחזר את האירוע "${event.name}"? ` +
                  "הזמנות המשתמשים שבוטלו לא ישוחזרו. " +
                  "שריוני המנהל יישארו כפי שהיו."
                : `האם לבטל את האירוע "${event.name}"? ` +
                  "כל הזמנות המשתמשים הפעילות יבוטלו.",

            confirmText: restore
                ? "שחזור האירוע"
                : "ביטול האירוע",

            danger: !restore
        });

        if (!confirmed) return;

        if (restore) {
            await api.events.restore(id);
        } else {
            await api.events.cancel(id);
        }

        showMessage(
            elements.message,
            restore
                ? "האירוע שוחזר בהצלחה."
                : "האירוע בוטל בהצלחה.",
            "success"
        );

        await loadEvents(eventPage);
    } catch (error) {
        reportError(error);

        if (error.status === 409) {
            await loadEvents(eventPage);
        }
    } finally {
        busy = false;
    }
}

function openHallEditor(id = null) {
    if (busy) return;

    clearMessage(elements.hallFormMessage);

    editingHallId = id;

    elements.hallForm.reset();

    const name = $("hall-name");
    const seatCount = $("hall-seat-count");

    name.maxLength = 100;

    seatCount.disabled = Boolean(id);

    $("hall-dialog-title").textContent = id
        ? "עריכת אולם"
        : "יצירת אולם חדש";

    if (id) {
        const hall = halls.find(item => item.id === id);

        if (!hall) return;

        name.value = hall.name;
        seatCount.value = hall.seatCount;
    }

    elements.hallDialog.showModal();
}

async function saveHall(event) {
    event.preventDefault();

    if (busy) return;

    clearMessage(elements.hallFormMessage);

    const values = getFormData(elements.hallForm);

    const data = {
        name: values.name.trim()
    };

    if (!data.name) {
        showMessage(
            elements.hallFormMessage,
            "יש להזין שם אולם."
        );

        return;
    }

    if (!editingHallId) {
        data.seatCount = Number(values.seatCount);

        if (
            !Number.isSafeInteger(data.seatCount) ||
            data.seatCount <= 0
        ) {
            showMessage(
                elements.hallFormMessage,
                "יש להזין מספר כיסאות שלם וחיובי."
            );

            return;
        }
    }

    const button = elements.hallForm.querySelector(
        '[type="submit"]'
    );

    busy = true;

    setButtonLoading(button, true, "שומר אולם...");

    try {
        if (editingHallId) {
            await api.halls.update(editingHallId, data);
        } else {
            await api.halls.create(data);
        }

        elements.hallDialog.close();

        showMessage(
            elements.message,
            editingHallId
                ? "האולם עודכן בהצלחה."
                : "האולם נוצר בהצלחה.",
            "success"
        );

        try {
            await loadHalls();
        } catch (error) {
            showError(
                elements.hallsTable,
                error,
                loadHalls
            );
        }
    } catch (error) {
        reportError(error, elements.hallFormMessage);
    } finally {
        busy = false;
        setButtonLoading(button, false);
    }
}

async function deleteHall(id) {
    if (busy) return;

    const hall = halls.find(item => item.id === id);

    if (!hall) return;

    busy = true;

    clearMessage(elements.message);

    try {
        const confirmed = await confirmAction({
            title: "מחיקת אולם",

            message:
                `האם למחוק את האולם "${hall.name}"? ` +
                "ניתן למחוק רק אולם שמעולם לא שימש לאירוע.",

            confirmText: "מחיקת האולם",
            danger: true
        });

        if (!confirmed) return;

        await api.halls.delete(id);

        showMessage(
            elements.message,
            "האולם נמחק בהצלחה.",
            "success"
        );

        try {
            await loadHalls();
        } catch (error) {
            showError(
                elements.hallsTable,
                error,
                loadHalls
            );
        }
    } catch (error) {
        if (error.status === 409) {
            showMessage(
                elements.message,
                "לא ניתן למחוק את האולם. ייתכן שכבר נוצר בו אירוע.",
                "warning"
            );
        } else {
            reportError(error);
        }
    } finally {
        busy = false;
    }
}

function getSelectedEventId() {
    const id = Number(elements.seatEvent.value);

    return Number.isSafeInteger(id) && id > 0
        ? id
        : null;
}

function updateSeatSelection(seats = []) {
    const release = elements.seatMode.value === "release";

    elements.seatSelection.textContent = seats.length
        ? `${seats.length} כיסאות נבחרו: ` +
          seats.map(seat => seat.seatNumber).join(", ")
        : "טרם נבחרו כיסאות";

    elements.seatAction.textContent = release
        ? "אישור שחרור"
        : "אישור שריון";

    elements.seatAction.disabled =
        !seats.length ||
        !seatsReady ||
        busy ||
        seatsLoading;
}

function resetSeatMap() {
    seatsRequest?.abort();

    seatsRequest = null;
    seatsLoading = false;
    seatsReady = false;

    seatMap.setDisabled(true);
    seatMap.setSeats([]);

    elements.seatDetails.textContent = "";
    elements.seatRefresh.disabled = true;

    updateSeatSelection();
}

async function loadSeatEvents(page = 1, selectedEvent = null) {
    seatEventsRequest?.abort();

    const controller = new AbortController();

    seatEventsRequest = controller;
    seatEventPage = page;

    resetSeatMap();

    elements.seatEvent.disabled = true;
    elements.seatPagination.replaceChildren();

    elements.seatEvent.replaceChildren(
        new Option("טוען אירועים...", "")
    );

    try {
        const data = await api.events.search({
            search: elements.seatSearch.value.trim(),
            pageNumber: page
        }, {
            authenticated: false,
            signal: controller.signal
        });

        if (controller.signal.aborted) return;

        seatEvents = data.items;

        if (
            selectedEvent &&
            !seatEvents.some(item => item.id === selectedEvent.id)
        ) {
            seatEvents = [selectedEvent, ...seatEvents];
        }

        elements.seatEvent.replaceChildren(
            new Option("בחרו אירוע", "")
        );

        for (const event of seatEvents) {
            elements.seatEvent.add(new Option(
                `${event.name} | ${formatDate(event.startTime)}`,
                String(event.id)
            ));
        }

        renderPagination(
            elements.seatPagination,
            data,
            nextPage => loadSeatEvents(nextPage)
        );

        if (selectedEvent) {
            elements.seatEvent.value =
                String(selectedEvent.id);

            await loadAdminSeats();
        }

        if (!seatEvents.length) {
            showEmpty(
                elements.seatContainer,
                "לא נמצאו אירועים פעילים",
                "נסו לשנות את החיפוש."
            );
        }
    } catch (error) {
        if (error.name === "AbortError") return;

        elements.seatEvent.replaceChildren(
            new Option("לא ניתן לטעון אירועים", "")
        );

        showError(
            elements.seatContainer,
            error,
            () => loadSeatEvents(seatEventPage)
        );
    } finally {
        if (seatEventsRequest === controller) {
            elements.seatEvent.disabled = false;
        }
    }
}

async function loadAdminSeats() {
    resetSeatMap();

    const id = getSelectedEventId();

    if (!id) return;

    const controller = new AbortController();

    seatsRequest = controller;
    seatsLoading = true;

    clearMessage(elements.seatMessage);

    showLoading(
        elements.seatContainer,
        "טוען את מפת האולם..."
    );

    try {
        const [event, seats] = await Promise.all([
            api.events.get(id, {
                signal: controller.signal
            }),

            api.seats.get(id, {
                signal: controller.signal
            })
        ]);

        if (controller.signal.aborted) return;

        elements.seatDetails.textContent =
            `${event.name} | ${event.hallName} | ` +
            `${formatDate(event.startTime)} | ` +
            formatTimeRange(event.startTime, event.endTime);

        seatsReady = isActiveFutureEvent(event);

        seatMap.setMode(elements.seatMode.value);
        seatMap.setSeats(seats);
        seatMap.setDisabled(!seatsReady || busy);

        if (!seatsReady) {
            showMessage(
                elements.seatMessage,
                "ניתן לשריין ולשחרר כיסאות רק באירוע פעיל שטרם התחיל.",
                "warning"
            );
        }
    } catch (error) {
        if (error.name === "AbortError") return;

        seatsReady = false;

        showError(
            elements.seatContainer,
            error,
            loadAdminSeats
        );
    } finally {
        if (seatsRequest === controller) {
            seatsLoading = false;
            elements.seatRefresh.disabled = busy;

            updateSeatSelection(
                seatMap.getSelectedSeats()
            );
        }
    }
}

function setSeatControlsDisabled(disabled) {
    elements.seatEvent.disabled = disabled;
    elements.seatMode.disabled = disabled;
    elements.seatSearch.disabled = disabled;

    elements.seatRefresh.disabled =
        disabled || seatsLoading || !getSelectedEventId();

    elements.seatPagination
        .querySelectorAll("button")
        .forEach(button => {
            if (disabled) {
                button.dataset.wasDisabled =
                    String(button.disabled);

                button.disabled = true;
            } else {
                button.disabled =
                    button.dataset.wasDisabled === "true";

                delete button.dataset.wasDisabled;
            }
        });

    seatMap.setDisabled(disabled || !seatsReady);
}

async function applySeatAction() {
    if (busy || seatsLoading || !seatsReady) return;

    const id = getSelectedEventId();

    const selectedSeats = seatMap.getSelectedSeats();

    const selectedIds = seatMap.getSelectedIds();

    if (!id || !selectedIds.length) return;

    const release = elements.seatMode.value === "release";

    busy = true;

    clearMessage(elements.seatMessage);

    setSeatControlsDisabled(true);

    updateSeatSelection(selectedSeats);

    try {
        const confirmed = await confirmAction({
            title: release
                ? "שחרור כיסאות"
                : "שריון כיסאות",

            message:
                `האם ${release ? "לשחרר" : "לשריין"} ` +
                `את הכיסאות הבאים: ` +
                selectedSeats.map(seat => seat.seatNumber)
                    .join(", ") + "?",

            confirmText: release
                ? "אישור שחרור"
                : "אישור שריון"
        });

        if (!confirmed) return;

        setButtonLoading(
            elements.seatAction,
            true,
            "מבצע פעולה..."
        );

        if (release) {
            await api.seats.release(id, selectedIds);
        } else {
            await api.seats.reserve(id, selectedIds);
        }

        await loadAdminSeats();

        showMessage(
            elements.seatMessage,
            release
                ? "הכיסאות שוחררו בהצלחה."
                : "הכיסאות שוריינו בהצלחה.",
            "success"
        );
    } catch (error) {
        if (error.status === 409) {
            await loadAdminSeats();

            showMessage(
                elements.seatMessage,
                "לא ניתן להשלים את הפעולה. ייתכן שמצב אחד " +
                "הכיסאות השתנה. בחרו מחדש לאחר רענון המפה.",
                "warning"
            );
        } else {
            reportError(error, elements.seatMessage);
        }
    } finally {
        busy = false;

        setButtonLoading(elements.seatAction, false);

        setSeatControlsDisabled(false);

        updateSeatSelection(
            seatMap.getSelectedSeats()
        );
    }
}

async function switchTab(tab, selectedEvent = null) {
    if (busy) return;

    currentTab = tab;

    clearMessage(elements.message);

    for (const button of document.querySelectorAll("[data-tab]")) {
        const active = button.dataset.tab === tab;

        button.classList.toggle("active", active);
        button.classList.toggle("btn-primary", active);
        button.classList.toggle("btn-outline", !active);

        button.setAttribute(
            "aria-pressed",
            String(active)
        );
    }

    for (const name of ["events", "halls", "seats"]) {
        $(`${name}-panel`).hidden = name !== tab;
    }

    if (tab !== "seats") {
        seatEventsRequest?.abort();
        resetSeatMap();
    }

    if (tab === "events") {
        await loadEvents(eventPage);
    }

    if (tab === "halls") {
        showLoading(elements.hallsTable);

        try {
            await loadHalls();
        } catch (error) {
            showError(
                elements.hallsTable,
                error,
                loadHalls
            );
        }
    }

    if (tab === "seats") {
        elements.seatSearch.value = "";

        clearMessage(elements.seatMessage);

        await loadSeatEvents(1, selectedEvent);
    }
}

function bindEvents() {
    document.querySelectorAll("[data-tab]")
        .forEach(button => {
            button.addEventListener("click", () => {
                switchTab(button.dataset.tab);
            });
        });

    document.querySelectorAll("[data-close-dialog]")
        .forEach(button => {
            button.addEventListener("click", () => {
                if (!busy) {
                    $(button.dataset.closeDialog).close();
                }
            });
        });

    for (const dialog of [
        elements.eventDialog,
        elements.hallDialog
    ]) {
        dialog.addEventListener("cancel", event => {
            if (busy) event.preventDefault();
        });
    }

    $("create-event").addEventListener(
        "click",
        () => openEventEditor()
    );

    $("create-hall").addEventListener(
        "click",
        () => openHallEditor()
    );

    elements.eventForm.addEventListener(
        "submit",
        saveEvent
    );

    elements.hallForm.addEventListener(
        "submit",
        saveHall
    );

    elements.eventFilters.addEventListener(
        "submit",
        event => {
            event.preventDefault();

            if (!busy) loadEvents(1);
        }
    );

    elements.eventFilters.addEventListener(
        "reset",
        () => {
            setTimeout(() => {
                if (!busy) loadEvents(1);
            }, 0);
        }
    );

    $("event-search").addEventListener(
        "input",
        debounce(() => {
            if (!busy && currentTab === "events") {
                loadEvents(1);
            }
        })
    );

    for (const id of [
        "filter-hall",
        "filter-status",
        "event-sort"
    ]) {
        $(id).addEventListener("change", () => {
            if (!busy) loadEvents(1);
        });
    }

    elements.eventsTable.addEventListener(
        "click",
        event => {
            if (busy) return;

            const button = event.target.closest(
                "[data-action]"
            );

            if (!button) return;

            const id = Number(button.dataset.id);

            switch (button.dataset.action) {
                case "view-bookings":
                    showEventBookings(id);
                    break;

                case "edit-event":
                    openEventEditor(id);
                    break;

                case "cancel-event":
                    changeEventStatus(id);
                    break;

                case "restore-event":
                    changeEventStatus(id, true);
                    break;

                case "manage-seats": {
                    const selectedEvent = events.find(
                        item => item.id === id
                    );

                    if (selectedEvent) {
                        switchTab("seats", selectedEvent);
                    }

                    break;
                }
            }
        }
    );

    elements.hallsTable.addEventListener(
        "click",
        event => {
            if (busy) return;

            const button = event.target.closest(
                "[data-action]"
            );

            if (!button) return;

            const id = Number(button.dataset.id);

            switch (button.dataset.action) {
                case "edit-hall":
                    openHallEditor(id);
                    break;

                case "delete-hall":
                    deleteHall(id);
                    break;
            }
        }
    );

    elements.seatSearch.addEventListener(
        "input",
        debounce(() => {
            if (!busy && currentTab === "seats") {
                loadSeatEvents(1);
            }
        })
    );

    elements.seatEvent.addEventListener(
        "change",
        () => {
            if (!busy) loadAdminSeats();
        }
    );

    elements.seatMode.addEventListener(
        "change",
        () => {
            if (busy) return;

            clearMessage(elements.seatMessage);

            seatMap.setMode(elements.seatMode.value);

            updateSeatSelection();
        }
    );

    elements.seatRefresh.addEventListener(
        "click",
        () => {
            if (!busy) loadAdminSeats();
        }
    );

    elements.seatAction.addEventListener(
        "click",
        applySeatAction
    );
}

async function initialize() {
    if (!requireAuth(ROLES.ADMIN)) return;

    renderLayout();

    elements.content.hidden = false;

    bindEvents();

    resetSeatMap();

    try {
        await loadHalls();
    } catch (error) {
        reportError(error);
    }

    await switchTab("events");
}

initialize();