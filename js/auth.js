import { CONFIG, ROLES } from "./config.js";

export function saveSession(response) {
    if (
        !response?.token ||
        !response?.user ||
        !response?.expiresAt ||
        !Object.values(ROLES).includes(response.user.role)
    ) {
        throw new Error("התקבלה תגובת התחברות לא תקינה.");
    }

    const expiresAt = Date.parse(response.expiresAt);

    if (!Number.isFinite(expiresAt) || expiresAt <= Date.now()) {
        throw new Error("תוקף ההתחברות אינו תקין.");
    }

    const session = {
        token: response.token,
        expiresAt: response.expiresAt,
        user: {
            id: response.user.id,
            name: response.user.name,
            email: response.user.email,
            role: response.user.role
        }
    };

    sessionStorage.setItem(
        CONFIG.SESSION_KEY,
        JSON.stringify(session)
    );

    return session;
}

export function clearSession() {
    sessionStorage.removeItem(CONFIG.SESSION_KEY);
}

export function getSession() {
    try {
        const stored = sessionStorage.getItem(
            CONFIG.SESSION_KEY
        );

        if (!stored) {
            return null;
        }

        const session = JSON.parse(stored);
        const expiresAt = Date.parse(session.expiresAt);

        if (
            !session.token ||
            !session.user ||
            !Object.values(ROLES).includes(session.user.role) ||
            !Number.isFinite(expiresAt) ||
            expiresAt <= Date.now()
        ) {
            clearSession();
            return null;
        }

        return session;
    } catch {
        clearSession();
        return null;
    }
}

export function getToken() {
    return getSession()?.token ?? null;
}

export function getCurrentUser() {
    return getSession()?.user ?? null;
}

export function isAuthenticated() {
    return getSession() !== null;
}

export function isAdmin() {
    return getCurrentUser()?.role === ROLES.ADMIN;
}

export function isUser() {
    return getCurrentUser()?.role === ROLES.USER;
}

export function redirectToLogin() {
    const returnUrl =
        window.location.pathname + window.location.search;

    window.location.replace(
        `login.html?returnUrl=${encodeURIComponent(returnUrl)}`
    );
}

export function requireAuth(role = null) {
    const user = getCurrentUser();

    if (!user) {
        redirectToLogin();
        return false;
    }

    if (role && user.role !== role) {
        window.location.replace(
            user.role === ROLES.ADMIN
                ? "admin.html"
                : "index.html"
        );

        return false;
    }

    return true;
}

export function redirectAfterLogin() {
    const user = getCurrentUser();

    if (!user) {
        window.location.replace("login.html");
        return;
    }

    if (user.role === ROLES.ADMIN) {
        window.location.replace("admin.html");
        return;
    }

    const returnUrl = new URLSearchParams(
        window.location.search
    ).get("returnUrl");

    if (returnUrl) {
        try {
            const target = new URL(
                returnUrl,
                window.location.href
            );

            const page = target.pathname.split("/").pop();

            const allowedPages = [
                "index.html",
                "event.html",
                "bookings.html"
            ];

            if (
                target.origin === window.location.origin &&
                allowedPages.includes(page)
            ) {
                window.location.replace(target.href);
                return;
            }
        } catch {
            // Continue to the default page.
        }
    }

    window.location.replace("index.html");
}

export function logout() {
    clearSession();
    window.location.replace("index.html");
}