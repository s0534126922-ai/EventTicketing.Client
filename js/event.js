import { api } from "./api.js";
import { SEAT_STATUS } from "./config.js";

import {
    isAuthenticated,
    isAdmin,
    redirectToLogin
} from "./auth.js";

import { renderLayout } from "./layout.js";
import { SeatMap } from "./seat-map.js";

import {
    getPositiveId,
    formatDate,
    formatTimeRange,
    showMessage,
    clearMessage,
    showLoading,
    showError,
    setButtonLoading,
    confirmAction
} from "./utils.js";

renderLayout();

const eventId = getPositiveId();

const elements = {
    content: document.getElementById("event-content"),
    pageMessage: document.getElementById("page-message"),
    seatMessage: document.getElementById("seat-message"),
    bookingMessage: document.getElementById("booking-message"),
    eventName: document.getElementById("event-name"),
    description: document.getElementById("event-description"),
    hallName: document.getElementById("hall-name"),
    date: document.getElementById("event-date"),
    time: document.getElementById("event-time"),
    availableCount: document.getElementById("available-count"),
    selectedSeat: document.getElementById("selected-seat"),
    bookButton: document.getElementById("book-button"),
    bookingNote: document.getElementById("booking-note"),
    refreshButton: document.getElementById("refresh-seats"),
    seatMap: document.getElementById("seat-map"),
    successDialog: document.getElementById("success-dialog"),
    confirmationDetails: document.getElementById("confirmation-details"),
    bookAnother: document.getElementById("book-another")
};

let eventDetails = null;
let selectedSeat = null;
let busy = false;
let loadingSeats = false;

const seatMap = new SeatMap(elements.seatMap, {
    mode: isAdmin() ? "view" : "user",

    onSelectionChange: seats => {
        selectedSeat = seats[0] ?? null;
        updateSelection();
    }
});

function eventHasStarted() {
    return eventDetails !== null &&
        Date.parse(eventDetails.startTime) <= Date.now();
}

function updateSelection() {
    elements.selectedSeat.textContent = selectedSeat
        ? `כיסא מספר ${selectedSeat.seatNumber}`
        : "טרם נבחר כיסא";

    elements.bookButton.disabled =
        !selectedSeat ||
        busy ||
        loadingSeats ||
        isAdmin() ||
        eventHasStarted();

    if (isAdmin()) {
        elements.bookingNote.textContent =
            "שריון מקומות למנהל מתבצע בממשק הניהול.";

        elements.bookButton.textContent = "אישור הזמנה";
    } else if (!isAuthenticated()) {
        elements.bookingNote.textContent =
            "ניתן לצפות במקומות ללא התחברות. ביצוע הזמנה דורש חשבון.";

        elements.bookButton.textContent = "התחברות והמשך להזמנה";
    } else {
        elements.bookingNote.textContent =
            "ניתן להזמין כיסא אחד בכל פעולה.";

        if (!busy) {
            elements.bookButton.textContent = "אישור הזמנה";
        }
    }
}

function renderEvent(event) {
    elements.eventName.textContent = event.name;

    elements.description.textContent =
        event.description || "";

    elements.description.hidden = !event.description;

    elements.hallName.textContent = event.hallName;

    elements.date.textContent =
        formatDate(event.startTime);

    elements.time.textContent =
        formatTimeRange(event.startTime, event.endTime);

    document.title =
        `EventTicketing | ${event.name}`;
}

async function loadSeats() {
    if (loadingSeats) return;

    loadingSeats = true;

    clearMessage(elements.seatMessage);

    elements.refreshButton.disabled = true;

    seatMap.clearSelection();
    seatMap.setDisabled(true);

    updateSelection();

    showLoading(elements.seatMap, "טוען את מפת האולם...");

    try {
        const seats = await api.seats.get(eventId, {
            authenticated: false
        });

        const available = seats.filter(
            seat => seat.status === SEAT_STATUS.AVAILABLE
        ).length;

        elements.availableCount.textContent =
            String(available);

        seatMap.setSeats(seats);

        seatMap.setDisabled(
            isAdmin() || eventHasStarted()
        );

        if (available === 0) {
            showMessage(
                elements.seatMessage,
                "כל המקומות באירוע תפוסים כרגע.",
                "info"
            );
        }
    } catch (error) {
        seatMap.setSeats([]);

        elements.availableCount.textContent = "—";

        showError(
            elements.seatMap,
            error,
            loadSeats
        );
    } finally {
        loadingSeats = false;
        elements.refreshButton.disabled = busy;

        updateSelection();
    }
}

async function initialize() {
    if (!eventId) {
        showMessage(
            elements.pageMessage,
            "לא נבחר אירוע תקין."
        );

        return;
    }

    showMessage(
        elements.pageMessage,
        "טוען את פרטי האירוע...",
        "info"
    );

    try {
        eventDetails = await api.events.get(eventId, {
            authenticated: false
        });

        renderEvent(eventDetails);

        clearMessage(elements.pageMessage);

        elements.content.hidden = false;

        await loadSeats();
    } catch (error) {
        showMessage(
            elements.pageMessage,
            error.message
        );
    }
}

async function bookSeat() {
    if (
        busy ||
        loadingSeats ||
        !selectedSeat ||
        isAdmin()
    ) {
        return;
    }

    clearMessage(elements.bookingMessage);

    if (!isAuthenticated()) {
        redirectToLogin();
        return;
    }

    if (eventHasStarted()) {
        showMessage(
            elements.bookingMessage,
            "האירוע כבר התחיל ולא ניתן לבצע הזמנה."
        );

        seatMap.setDisabled(true);
        updateSelection();

        return;
    }

    const seat = selectedSeat;

    busy = true;

    elements.refreshButton.disabled = true;
    seatMap.setDisabled(true);

    updateSelection();

    try {
        const confirmed = await confirmAction({
            title: "אישור הזמנת מקום",
            message:
                `האם להזמין את כיסא מספר ${seat.seatNumber} ` +
                `באירוע "${eventDetails.name}"?`,
            confirmText: "אישור הזמנה"
        });

        if (!confirmed) return;

        setButtonLoading(
            elements.bookButton,
            true,
            "מבצע הזמנה..."
        );

        const response = await api.bookings.create(seat.id);

        elements.confirmationDetails.textContent =
            `כיסא מספר ${response.booking.seatNumber} ` +
            `באירוע "${eventDetails.name}" הוזמן בהצלחה.`;

        elements.successDialog.showModal();

        await loadSeats();
    } catch (error) {
        if (error.status === 409) {
            await loadSeats();

            showMessage(
                elements.bookingMessage,
                "לא ניתן להשלים את ההזמנה. ייתכן שהמקום נתפס בינתיים. מפת האולם עודכנה, אנא בחרו מקום פנוי ונסו שוב.",
                "warning"
            );
        } else {
            showMessage(
                elements.bookingMessage,
                error.message
            );
        }
    } finally {
        busy = false;

        setButtonLoading(elements.bookButton, false);

        elements.refreshButton.disabled = false;

        seatMap.setDisabled(
            isAdmin() || eventHasStarted()
        );

        updateSelection();
    }
}

elements.bookButton.addEventListener(
    "click",
    bookSeat
);

elements.refreshButton.addEventListener(
    "click",
    () => {
        if (!busy) {
            clearMessage(elements.bookingMessage);
            loadSeats();
        }
    }
);

elements.bookAnother.addEventListener(
    "click",
    () => {
        elements.successDialog.close();
        seatMap.clearSelection();
    }
);

initialize();