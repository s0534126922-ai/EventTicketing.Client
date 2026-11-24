import { api } from "./api.js";

import {
    saveSession,
    isAuthenticated,
    redirectAfterLogin
} from "./auth.js";

import { renderLayout } from "./layout.js";

import {
    getFormData,
    showMessage,
    clearMessage,
    setButtonLoading,
    getQueryParam
} from "./utils.js";

function initialize() {
    if (isAuthenticated()) {
        redirectAfterLogin();
        return;
    }

    renderLayout();

    const form = document.getElementById("auth-form");
    const message = document.getElementById("form-message");
    const submitButton = form.querySelector('[type="submit"]');
    const switchLink = document.getElementById("switch-auth");

    const isRegister = form.dataset.mode === "register";

    const returnUrl = getQueryParam("returnUrl");

    if (returnUrl) {
        const target = isRegister
            ? "login.html"
            : "register.html";

        switchLink.href =
            `${target}?returnUrl=${encodeURIComponent(returnUrl)}`;
    }

    let submitting = false;

    form.addEventListener("submit", async event => {
        event.preventDefault();

        if (submitting) return;

        clearMessage(message);

        const values = getFormData(form);

        const email = values.email.trim();
        const password = values.password;

        if (!email || !password) {
            showMessage(message, "יש למלא את כל השדות.");
            return;
        }

        const request = {
            email,
            password
        };

        if (isRegister) {
            const name = values.name.trim();

            if (!name) {
                showMessage(message, "יש להזין שם מלא.");
                return;
            }

            if (password.length < 8) {
                showMessage(
                    message,
                    "הסיסמה חייבת להכיל לפחות 8 תווים."
                );

                return;
            }

            if (password !== values.confirmPassword) {
                showMessage(message, "הסיסמאות אינן תואמות.");
                return;
            }

            request.name = name;
        }

        submitting = true;

        setButtonLoading(
            submitButton,
            true,
            isRegister ? "יוצר חשבון..." : "מתחבר..."
        );

        try {
            const response = isRegister
                ? await api.auth.register(request)
                : await api.auth.login(request);

            saveSession(response);

            redirectAfterLogin();
        } catch (error) {
            let errorMessage = error.message;

            if (isRegister && error.status === 409) {
                errorMessage =
                    "לא ניתן להירשם עם כתובת הדוא\"ל הזו. ייתכן שכבר קיים חשבון.";
            }

            if (!isRegister && error.status === 401) {
                errorMessage =
                    "כתובת הדוא\"ל או הסיסמה אינן נכונות.";
            }

            showMessage(message, errorMessage);
        } finally {
            submitting = false;
            setButtonLoading(submitButton, false);
        }
    });
}

initialize();