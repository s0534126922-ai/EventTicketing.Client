import { CONFIG, ROLES } from "./config.js";

import {
    getCurrentUser,
    logout
} from "./auth.js";

import { escapeHtml } from "./utils.js";

export function renderLayout() {
    renderHeader();
    renderFooter();
}

function renderHeader() {
    const header = document.getElementById("site-header");

    if (!header) return;

    const user = getCurrentUser();

    const currentPage =
        window.location.pathname.split("/").pop() || "index.html";

    const navLink = (href, label) => `
        <a href="${href}"
            class="nav-link ${currentPage === href ? "active" : ""}"
            ${currentPage === href ? 'aria-current="page"' : ""}>
            ${label}
        </a>
    `;

    let navigation = navLink("index.html", "כל האירועים");
    let account = "";

    if (user?.role === ROLES.USER) {
        navigation += navLink("bookings.html", "ההזמנות שלי");
    }

    if (user?.role === ROLES.ADMIN) {
        navigation += navLink("admin.html", "ניהול המערכת");
    }

    if (user) {
        account = `
            <span class="user-greeting">
                שלום, ${escapeHtml(user.name)}
            </span>

            <button type="button"
                class="btn btn-header-outline btn-small"
                id="logout-button">
                התנתקות
            </button>
        `;
    } else {
        account = `
            <a href="login.html" class="nav-link">
                התחברות
            </a>

            <a href="register.html" class="btn btn-gold btn-small">
                הרשמה
            </a>
        `;
    }

    header.className = "site-header";

    header.innerHTML = `
        <div class="container header-inner">

            <a href="index.html" class="brand"
                aria-label="EventTicketing - עמוד הבית">

                <span class="brand-symbol" aria-hidden="true">
                    <svg viewBox="0 0 48 48" fill="none">
                        <path d="M5 13h38v8a4 4 0 0 0 0 8v8H5v-8a4 4 0 0 0 0-8z"
                            stroke="currentColor"
                            stroke-width="2.5"
                            stroke-linejoin="round"/>

                        <path d="M30 13v24"
                            stroke="currentColor"
                            stroke-width="2"
                            stroke-dasharray="3 3"/>

                        <path d="m17 19 2 4 4 .6-3 3 .7 4.4-3.7-2-3.7 2 .7-4.4-3-3 4-.6z"
                            fill="currentColor"/>
                    </svg>
                </span>

                <span class="brand-name" dir="ltr">
                    Event<span>Ticketing</span>
                </span>
            </a>

            <button type="button"
                class="menu-toggle"
                id="menu-toggle"
                aria-label="פתיחת תפריט"
                aria-controls="header-menu"
                aria-expanded="false">

                <span></span>
                <span></span>
                <span></span>
            </button>

            <div class="header-menu" id="header-menu">
                <nav class="main-nav" aria-label="ניווט ראשי">
                    ${navigation}
                </nav>

                <div class="account-nav">
                    ${account}
                </div>
            </div>
        </div>
    `;

    document.getElementById("logout-button")
        ?.addEventListener("click", logout);

    const toggle = document.getElementById("menu-toggle");
    const menu = document.getElementById("header-menu");

    toggle.addEventListener("click", () => {
        const expanded = menu.classList.toggle("open");

        toggle.setAttribute("aria-expanded", String(expanded));
    });
}

function renderFooter() {
    const footer = document.getElementById("site-footer");

    if (!footer) return;

    footer.className = "site-footer";

    footer.innerHTML = `
        <div class="container footer-inner">
            <div>
                <strong class="footer-brand" dir="ltr">
                    ${CONFIG.APP_NAME}
                </strong>

                <p>הדרך הנוחה לבחור את המקום שלך.</p>
            </div>

            <span class="footer-copyright">
                כל הזכויות שמורות &copy; ${new Date().getFullYear()}
            </span>
        </div>
    `;
}