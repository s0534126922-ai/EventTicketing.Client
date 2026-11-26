import { api } from "./api.js";
import { CONFIG } from "./config.js";
import { renderLayout } from "./layout.js";

import {
    escapeHtml,
    formatDate,
    formatTimeRange,
    showLoading,
    showEmpty,
    showError,
    renderPagination,
    debounce
} from "./utils.js";

renderLayout();

const form = document.getElementById("filters-form");
const searchInput = document.getElementById("search");
const hallInput = document.getElementById("hall");
const sortInput = document.getElementById("sort");
const grid = document.getElementById("events-grid");
const pagination = document.getElementById("pagination");
const count = document.getElementById("events-count");

let currentPage = 1;
let activeRequest = null;

const ticketSymbol = `
    <svg viewBox="0 0 80 80" fill="none" aria-hidden="true">
        <rect x="8" y="15" width="64" height="50" rx="8"
            stroke="currentColor" stroke-width="2"/>
        <path d="M53 15v50"
            stroke="currentColor" stroke-width="2"
            stroke-dasharray="4 4"/>
        <path d="m30 27 4 9 10 1-7 7 2 10-9-5-9 5
            2-10-7-7 10-1z"
            stroke="currentColor" stroke-width="2"
            stroke-linejoin="round"/>
    </svg>
`;

function createEventCard(event) {
    const date = new Date(event.startTime);

    const day = new Intl.DateTimeFormat("he-IL", {
        timeZone: CONFIG.TIME_ZONE,
        day: "numeric"
    }).format(date);

    const month = new Intl.DateTimeFormat("he-IL", {
        timeZone: CONFIG.TIME_ZONE,
        month: "long"
    }).format(date);

    const variant = Number(event.id) % 4;

    return `
        <article class="event-card">
            <div class="event-card-banner variant-${variant}">
                <div class="event-date-tile">
                    <strong>${escapeHtml(day)}</strong>
                    <span>${escapeHtml(month)}</span>
                </div>

                <div class="event-banner-symbol">
                    ${ticketSymbol}
                </div>
            </div>

            <div class="event-card-body">
                <h3>${escapeHtml(event.name)}</h3>

                <p class="event-description">
                    ${escapeHtml(
                        event.description ||
                        "לפרטי האירוע ולבחירת מקום."
                    )}
                </p>

                <div class="event-meta">
                    <span>
                        <strong>אולם:</strong>
                        ${escapeHtml(event.hallName)}
                    </span>

                    <span>
                        <strong>תאריך:</strong>
                        ${escapeHtml(formatDate(event.startTime))}
                    </span>

                    <span>
                        <strong>שעות:</strong>
                        <bdi>
                            ${escapeHtml(formatTimeRange(
                                event.startTime,
                                event.endTime
                            ))}
                        </bdi>
                    </span>
                </div>

                <div class="event-card-footer">
                    <a href="event.html?id=${encodeURIComponent(event.id)}"
                        class="btn btn-primary btn-block">
                        לפרטי האירוע ובחירת מקום
                    </a>
                </div>
            </div>
        </article>
    `;
}

async function loadEvents(page = 1) {
    activeRequest?.abort();

    const controller = new AbortController();

    activeRequest = controller;
    currentPage = page;

    count.textContent = "";
    pagination.replaceChildren();

    showLoading(grid, "טוען את האירועים הקרובים...");

    try {
        const data = await api.events.search({
            search: searchInput.value.trim(),
            hallId: hallInput.value || undefined,
            descending: sortInput.value === "true",
            pageNumber: page
        }, {
            authenticated: false,
            signal: controller.signal
        });

        if (controller.signal.aborted) return;

        count.textContent = `${data.totalCount} אירועים נמצאו`;

        if (!data.items.length) {
            if (data.totalPages > 0 && page > data.totalPages) {
                await loadEvents(data.totalPages);
                return;
            }

            showEmpty(
                grid,
                "לא נמצאו אירועים",
                "נסו לשנות את החיפוש או לחזור בהמשך."
            );

            return;
        }

        grid.innerHTML = data.items
            .map(createEventCard)
            .join("");

        renderPagination(pagination, data, nextPage => {
            loadEvents(nextPage);

            document.getElementById("events")
                .scrollIntoView({ behavior: "smooth" });
        });
    } catch (error) {
        if (error.name === "AbortError") return;

        showError(grid, error, () => loadEvents(currentPage));
    }
}

const searchEvents = debounce(() => loadEvents(1));

form.addEventListener("submit", event => {
    event.preventDefault();
    loadEvents(1);
});

form.addEventListener("reset", () => {
    setTimeout(() => loadEvents(1), 0);
});

searchInput.addEventListener("input", searchEvents);

sortInput.addEventListener("change", () => loadEvents(1));

hallInput.addEventListener("change", () => loadEvents(1));

async function loadHallOptions() {
    try {
        const halls = await api.halls.getAll({ authenticated: false });

        for (const hall of halls) {
            hallInput.add(new Option(hall.name, hall.id));
        }
    } catch {
        hallInput.disabled = true;
        hallInput.options[0].textContent = "סינון לפי אולם אינו זמין";
    }
}

loadHallOptions();
loadEvents();