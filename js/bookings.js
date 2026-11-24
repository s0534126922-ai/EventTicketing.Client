import { api } from "./api.js";

import {
    ROLES,
    BOOKING_STATUS,
    BOOKING_STATUS_LABELS
} from "./config.js";

import { requireAuth } from "./auth.js";
import { renderLayout } from "./layout.js";

import {
    escapeHtml,
    formatDate,
    formatDateTime,
    formatTimeRange,
    showLoading,
    showEmpty,
    showError,
    showMessage,
    clearMessage,
    setButtonLoading,
    confirmAction
} from "./utils.js";

const list = document.getElementById("bookings-list");
const message = document.getElementById("bookings-message");

let groups = [];
let busy = false;

function getCancellationDeadline(booking) {
    return new Date(
        Date.parse(booking.eventStartTimeAtBooking) -
        60 * 60 * 1000
    );
}

function canCancel(booking) {
    return (
        booking.status === BOOKING_STATUS.CONFIRMED &&
        Date.now() < getCancellationDeadline(booking).getTime()
    );
}

function getStatusClass(status) {
    switch (status) {
        case BOOKING_STATUS.CONFIRMED:
            return "status-confirmed";

        case BOOKING_STATUS.DELETED:
            return "status-deleted";

        case BOOKING_STATUS.CANCELLED_BY_EVENT:
            return "status-cancelled";

        default:
            return "status-finished";
    }
}

function renderBooking(booking, group) {
    const statusLabel =
        BOOKING_STATUS_LABELS[booking.status] ||
        "סטטוס לא ידוע";

    const cancellable = canCancel(booking);

    const isConfirmed =
        booking.status === BOOKING_STATUS.CONFIRMED;

    const deadline = getCancellationDeadline(booking);

    let cancellationInfo = "";

    if (isConfirmed) {
        cancellationInfo = cancellable
            ? `ניתן לבטל עד ${formatDateTime(deadline)}`
            : "מועד ביטול ההזמנה חלף.";
    }

    const isPast =
        Date.parse(booking.eventEndTimeAtBooking) <= Date.now();

    return `
        <article class="booking-item">
            <div class="booking-item-details">
                <div class="actions">
                    <span class="booking-seat-number">
                        כיסא מספר ${escapeHtml(booking.seatNumber)}
                    </span>

                    <span class="status-badge ${getStatusClass(booking.status)}">
                        ${escapeHtml(statusLabel)}
                    </span>

                    ${isPast ? `
                        <span class="status-badge status-finished">
                            אירוע שהסתיים
                        </span>
                    ` : ""}
                </div>

                <span class="muted">
                    מספר הזמנה: ${escapeHtml(booking.id)}
                </span>

                <span>
                    <strong>תאריך האירוע:</strong>
                    ${escapeHtml(formatDate(
                        booking.eventStartTimeAtBooking
                    ))}
                </span>

                <span>
                    <strong>שעות:</strong>
                    <bdi>
                        ${escapeHtml(formatTimeRange(
                            booking.eventStartTimeAtBooking,
                            booking.eventEndTimeAtBooking
                        ))}
                    </bdi>
                </span>

                <span class="muted">
                    הוזמן בתאריך:
                    ${escapeHtml(formatDateTime(booking.bookedAt))}
                </span>

                ${booking.deletedAt ? `
                    <span class="muted">
                        בוטל בתאריך:
                        ${escapeHtml(formatDateTime(booking.deletedAt))}
                    </span>
                ` : ""}
            </div>

            <div class="booking-item-actions">
                ${cancellationInfo ? `
                    <small class="muted">
                        ${escapeHtml(cancellationInfo)}
                    </small>
                ` : ""}

                ${cancellable ? `
                    <button type="button"
                        class="btn btn-danger btn-small"
                        data-cancel-booking="${escapeHtml(booking.id)}">
                        ביטול הזמנה
                    </button>

                    <a href="event.html?id=${encodeURIComponent(group.eventId)}"
                        class="text-link">
                        הזמנת כיסא נוסף
                    </a>
                ` : ""}
            </div>
        </article>
    `;
}

function renderGroup(group) {
    return `
        <section class="booking-group">
            <header class="booking-group-header">
                <h2>${escapeHtml(group.eventName)}</h2>

                <p>
                    ${escapeHtml(group.hallName)}
                    |
                    ${group.bookings.length} הזמנות
                </p>
            </header>

            ${group.bookings.map(
                booking => renderBooking(booking, group)
            ).join("")}
        </section>
    `;
}

function renderBookings() {
    if (!groups.length) {
        showEmpty(
            list,
            "עדיין אין לכם הזמנות",
            "בחרו אירוע והזמינו את המקום הראשון שלכם."
        );

        const link = document.createElement("a");

        link.href = "index.html";
        link.className = "btn btn-primary";
        link.textContent = "לכל האירועים";

        list.firstElementChild.append(link);

        return;
    }

    list.innerHTML = groups.map(renderGroup).join("");
}

async function loadBookings() {
    showLoading(list, "טוען את ההזמנות שלכם...");

    try {
        const response = await api.bookings.getMy();

        groups = response.events;

        renderBookings();
    } catch (error) {
        showError(list, error, loadBookings);
    }
}

function findBooking(bookingId) {
    for (const group of groups) {
        const booking = group.bookings.find(
            item => item.id === bookingId
        );

        if (booking) {
            return { booking, group };
        }
    }

    return null;
}

async function cancelBooking(bookingId, button) {
    if (busy) return;

    const result = findBooking(bookingId);

    if (!result) return;

    const { booking, group } = result;

    clearMessage(message);

    if (!canCancel(booking)) {
        showMessage(
            message,
            "מועד ביטול ההזמנה חלף.",
            "warning"
        );

        renderBookings();

        return;
    }

    busy = true;

    try {
        const confirmed = await confirmAction({
            title: "ביטול הזמנה",
            message:
                `האם לבטל את ההזמנה לכיסא מספר ` +
                `${booking.seatNumber} באירוע ` +
                `"${group.eventName}"? המקום ישוחרר להזמנה מחדש.`,
            confirmText: "ביטול ההזמנה",
            danger: true
        });

        if (!confirmed) return;

        setButtonLoading(
            button,
            true,
            "מבטל הזמנה..."
        );

        await api.bookings.cancel(bookingId);

        await loadBookings();

        showMessage(
            message,
            "ההזמנה בוטלה בהצלחה.",
            "success"
        );
    } catch (error) {
        if (error.status === 409) {
            await loadBookings();

            showMessage(
                message,
                "לא ניתן לבטל את ההזמנה. ייתכן שמצבה השתנה או שמועד הביטול חלף. הנתונים עודכנו.",
                "warning"
            );
        } else {
            showMessage(
                message,
                error.message
            );
        }
    } finally {
        busy = false;
        setButtonLoading(button, false);
    }
}

function initialize() {
    if (!requireAuth(ROLES.USER)) return;

    renderLayout();

    list.addEventListener("click", event => {
        const button = event.target.closest(
            "[data-cancel-booking]"
        );

        if (!button) return;

        const bookingId = Number(
            button.dataset.cancelBooking
        );

        if (
            Number.isSafeInteger(bookingId) &&
            bookingId > 0
        ) {
            cancelBooking(bookingId, button);
        }
    });

    loadBookings();
}

initialize();