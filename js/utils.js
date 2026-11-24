import { CONFIG } from "./config.js";

export function escapeHtml(value) {
    return String(value ?? "").replace(/[&<>"']/g, char => ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#39;"
    })[char]);
}

export function formatDate(value) {
    if (!value) return "—";

    const date = new Date(value);

    if (Number.isNaN(date.getTime())) return "—";

    return new Intl.DateTimeFormat("he-IL", {
        timeZone: CONFIG.TIME_ZONE,
        day: "numeric",
        month: "long",
        year: "numeric"
    }).format(date);
}

export function formatTime(value) {
    if (!value) return "—";

    const date = new Date(value);

    if (Number.isNaN(date.getTime())) return "—";

    return new Intl.DateTimeFormat("he-IL", {
        timeZone: CONFIG.TIME_ZONE,
        hour: "2-digit",
        minute: "2-digit",
        hourCycle: "h23"
    }).format(date);
}

export function formatDateTime(value) {
    return `${formatDate(value)} | ${formatTime(value)}`;
}

export function formatTimeRange(start, end) {
    return `${formatTime(start)} – ${formatTime(end)}`;
}

export function toIsraelDateTimeInput(value) {
    const date = new Date(value);

    if (Number.isNaN(date.getTime())) return "";

    const parts = new Intl.DateTimeFormat("en-GB", {
        timeZone: CONFIG.TIME_ZONE,
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
        hourCycle: "h23"
    }).formatToParts(date);

    const result = Object.fromEntries(
        parts.map(part => [part.type, part.value])
    );

    return `${result.year}-${result.month}-${result.day}T${result.hour}:${result.minute}`;
}

export function getQueryParam(name) {
    return new URLSearchParams(
        window.location.search
    ).get(name);
}

export function getPositiveId(name = "id") {
    const value = Number(getQueryParam(name));

    return Number.isSafeInteger(value) && value > 0
        ? value
        : null;
}

export function getFormData(form) {
    return Object.fromEntries(new FormData(form));
}

export function setButtonLoading(button, loading, text = "נא להמתין...") {
    if (!button) return;

    if (loading) {
        if (!button.dataset.originalText) {
            button.dataset.originalText = button.textContent;
        }

        button.disabled = true;
        button.textContent = text;
        button.setAttribute("aria-busy", "true");
    } else {
        button.disabled = false;

        if (button.dataset.originalText) {
            button.textContent = button.dataset.originalText;
            delete button.dataset.originalText;
        }

        button.removeAttribute("aria-busy");
    }
}

export function showMessage(container, message, type = "error") {
    if (!container) return;

    const allowedTypes = ["error", "success", "info", "warning"];

    const safeType = allowedTypes.includes(type)
        ? type
        : "info";

    container.className = `message message-${safeType}`;
    container.textContent = message;
    container.hidden = false;

    container.setAttribute(
        "role",
        safeType === "error" ? "alert" : "status"
    );
}

export function clearMessage(container) {
    if (!container) return;

    container.hidden = true;
    container.textContent = "";
}

export function showLoading(container, text = "טוען נתונים...") {
    container.innerHTML = `
        <div class="loading-state" role="status">
            <span class="spinner"></span>
            <p>${escapeHtml(text)}</p>
        </div>
    `;
}

export function showEmpty(container, title, description = "") {
    container.innerHTML = `
        <div class="empty-state">
            <h3>${escapeHtml(title)}</h3>
            <p>${escapeHtml(description)}</p>
        </div>
    `;
}

export function showError(container, error, retry = null) {
    container.innerHTML = `
        <div class="empty-state error-state">
            <h3>לא ניתן לטעון את הנתונים</h3>
            <p>${escapeHtml(error?.message ?? "אירעה שגיאה.")}</p>
        </div>
    `;

    if (typeof retry === "function") {
        const button = document.createElement("button");

        button.type = "button";
        button.className = "btn btn-primary";
        button.textContent = "ניסיון נוסף";
        button.addEventListener("click", retry);

        container.firstElementChild.append(button);
    }
}

export function notify(message, type = "success") {
    let container = document.getElementById("toast-container");

    if (!container) {
        container = document.createElement("div");
        container.id = "toast-container";
        container.className = "toast-container";
        container.setAttribute("aria-live", "polite");

        document.body.append(container);
    }

    const toast = document.createElement("div");

    toast.className = `toast message-${type}`;
    toast.textContent = message;

    container.append(toast);

    setTimeout(() => toast.remove(), 4500);
}

export function confirmAction({
    title = "אישור פעולה",
    message = "האם להמשיך בביצוע הפעולה?",
    confirmText = "אישור",
    danger = false
} = {}) {
    return new Promise(resolve => {
        const dialog = document.createElement("dialog");

        dialog.className = "app-dialog";

        dialog.innerHTML = `
            <div class="dialog-content">
                <h2>${escapeHtml(title)}</h2>
                <p>${escapeHtml(message)}</p>

                <div class="dialog-actions">
                    <button type="button" class="btn btn-outline"
                        data-action="cancel">
                        חזרה
                    </button>

                    <button type="button"
                        class="btn ${danger ? "btn-danger" : "btn-primary"}"
                        data-action="confirm">
                        ${escapeHtml(confirmText)}
                    </button>
                </div>
            </div>
        `;

        document.body.append(dialog);

        dialog.querySelector('[data-action="confirm"]')
            .addEventListener("click", () => dialog.close("confirm"));

        dialog.querySelector('[data-action="cancel"]')
            .addEventListener("click", () => dialog.close("cancel"));

        dialog.addEventListener("close", () => {
            const confirmed = dialog.returnValue === "confirm";

            dialog.remove();
            resolve(confirmed);
        }, { once: true });

        dialog.showModal();
    });
}

export function renderPagination(container, data, onChange) {
    container.replaceChildren();

    const current = Number(data.pageNumber);
    const total = Number(data.totalPages);

    if (total <= 1) return;

    const createButton = (label, page, disabled, active = false) => {
        const button = document.createElement("button");

        button.type = "button";
        button.className = `pagination-button${active ? " active" : ""}`;
        button.textContent = label;
        button.disabled = disabled;

        if (active) {
            button.setAttribute("aria-current", "page");
        }

        button.addEventListener("click", () => onChange(page));

        container.append(button);
    };

    createButton("הקודם", current - 1, current <= 1);

    const start = Math.max(1, current - 2);
    const end = Math.min(total, current + 2);

    if (start > 1) {
        createButton("1", 1, false);
    }

    for (let page = start; page <= end; page++) {
        createButton(
            String(page),
            page,
            page === current,
            page === current
        );
    }

    if (end < total) {
        createButton(String(total), total, false);
    }

    createButton("הבא", current + 1, current >= total);
}

export function debounce(callback, delay = 350) {
    let timer;

    return (...args) => {
        clearTimeout(timer);
        timer = setTimeout(() => callback(...args), delay);
    };
}