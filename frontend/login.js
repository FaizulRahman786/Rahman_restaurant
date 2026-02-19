const GOOGLE_CLIENT_ID = "";
const AUTH_STORAGE_KEY = "rahman_auth_session";
const LEGACY_STORAGE_KEY = "rahman_google_user";
const REDIRECT_AFTER_LOGIN = "index-scroll.html";
const API_TIMEOUT_MS = 12000;
const API_RETRY_COUNT = 2;
const PRODUCTION_API_BASE = "https://rahman-restaurant.onrender.com";

function isNetworkFetchError(error) {
    if (!error) {
        return false;
    }

    const message = String(error.message || "").toLowerCase();
    return (
        error.name === "TypeError" ||
        error.name === "AbortError" ||
        message.includes("failed to fetch") ||
        message.includes("networkerror") ||
        message.includes("load failed") ||
        message.includes("network request failed")
    );
}

function getFriendlyConnectionMessage() {
    return "Cannot reach the server right now. Please try again in a moment.";
}

function getFriendlyAuthMessage(error, fallbackMessage) {
    if (isNetworkFetchError(error)) {
        return getFriendlyConnectionMessage();
    }

    const message = String(error?.message || "").trim();
    return message || fallbackMessage;
}

function wait(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

async function fetchWithTimeout(url, options = {}, timeoutMs = API_TIMEOUT_MS) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    try {
        return await fetch(url, {
            ...options,
            signal: controller.signal
        });
    } finally {
        clearTimeout(timer);
    }
}

function getApiBaseCandidates() {
    const locationOrigin = window.location.origin;
    const candidates = [];

    if (window.location.protocol === "file:") {
        candidates.push(PRODUCTION_API_BASE, "http://localhost:3000", "http://127.0.0.1:3000");
        return candidates;
    }

    if (locationOrigin === PRODUCTION_API_BASE) {
        candidates.push(locationOrigin);
    } else {
        candidates.push(PRODUCTION_API_BASE, locationOrigin);
    }

    if (locationOrigin !== "http://localhost:3000") {
        candidates.push("http://localhost:3000");
    }

    if (locationOrigin !== "http://127.0.0.1:3000") {
        candidates.push("http://127.0.0.1:3000");
    }

    return candidates;
}

function getStatusElement() {
    return document.getElementById("status");
}

async function getGoogleClientId() {
    if (GOOGLE_CLIENT_ID && !GOOGLE_CLIENT_ID.startsWith("YOUR_GOOGLE_CLIENT_ID")) {
        return GOOGLE_CLIENT_ID;
    }

    const bases = getApiBaseCandidates();

    for (const base of bases) {
        try {
            const response = await fetch(`${base}/api/public/auth-config`);
            if (!response.ok) {
                continue;
            }

            const data = await response.json().catch(() => ({}));
            const clientId = String(data?.googleClientId || "").trim();

            if (clientId) {
                return clientId;
            }
        } catch {
        }
    }

    return "";
}

function setStatus(message, isError = true) {
    const status = getStatusElement();
    if (!status) {
        return;
    }

    status.textContent = message || "";
    status.style.color = isError ? "#b22a2a" : "#1f7a45";
}

function hasValidSession() {
    try {
        const raw = localStorage.getItem(AUTH_STORAGE_KEY);
        if (!raw) {
            return false;
        }

        const session = JSON.parse(raw);
        if (!session || !session.exp || !session.token) {
            return false;
        }

        return session.exp > Math.floor(Date.now() / 1000);
    } catch {
        return false;
    }
}

function saveSession(session) {
    localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(session));

    if (session && session.user && session.exp) {
        localStorage.setItem(
            LEGACY_STORAGE_KEY,
            JSON.stringify({
                email: session.user.email,
                name: session.user.name,
                picture: session.user.picture,
                exp: session.exp
            })
        );
    }
}

async function apiRequest(path, payload) {
    const bases = getApiBaseCandidates();
    let lastError = null;
    let sawHttpResponseError = false;

    for (const base of bases) {
        for (let attempt = 1; attempt <= API_RETRY_COUNT; attempt++) {
            try {
                const response = await fetchWithTimeout(`${base}${path}`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify(payload)
                });

                const data = await response.json().catch(() => ({}));

                if (!response.ok) {
                    const message = data.message || `Request failed (${response.status})`;
                    sawHttpResponseError = true;
                    throw new Error(message);
                }

                return data;
            } catch (error) {
                lastError = error;

                const isRetryableNetworkError = isNetworkFetchError(error) && attempt < API_RETRY_COUNT;
                if (isRetryableNetworkError) {
                    await wait(250 * attempt);
                    continue;
                }

                break;
            }
        }
    }

    if (isNetworkFetchError(lastError) || !sawHttpResponseError) {
        throw new Error(getFriendlyConnectionMessage());
    }

    throw new Error(lastError?.message || "Could not connect to auth server. Start backend on port 3000.");
}

function toggleEmailButtons(disabled) {
    const loginBtn = document.getElementById("emailLoginBtn");
    const registerBtn = document.getElementById("emailRegisterBtn");

    if (loginBtn) {
        loginBtn.disabled = disabled;
    }

    if (registerBtn) {
        registerBtn.disabled = disabled;
    }
}

async function handleEmailLogin(event) {
    event.preventDefault();

    const email = (document.getElementById("email")?.value || "").trim().toLowerCase();
    const password = (document.getElementById("password")?.value || "").trim();

    if (!email || !password) {
        setStatus("Please enter email and password.");
        return;
    }

    try {
        toggleEmailButtons(true);
        setStatus("Signing in...", false);
        const result = await apiRequest("/api/auth/login", { email, password });
        if (!result || !result.token || !result.user) {
            throw new Error("Authentication response is invalid. Please retry.");
        }
        saveSession(result);
        window.location.href = REDIRECT_AFTER_LOGIN;
    } catch (error) {
        const msg = getFriendlyAuthMessage(error, "Email login failed.");
        if (/invalid email or password/i.test(msg)) {
            setStatus("Invalid credentials. Check email/password or click Register to create account.");
            return;
        }
        setStatus(msg);
    } finally {
        toggleEmailButtons(false);
    }
}

async function handleForgotPassword() {
    const emailInput = document.getElementById("email");
    const email = (emailInput?.value || "").trim().toLowerCase();

    if (!email) {
        setStatus("Enter your email first, then click Forgot password.");
        if (emailInput) {
            emailInput.focus();
        }
        return;
    }

    try {
        const response = await apiRequest("/api/auth/forgot-password", {
            email
        });

        setStatus(response.message || "If this email exists, reset instructions have been sent.", false);

        if (!response || !response.devResetCode) {
            return;
        }

        const wantsResetNow = window.confirm("Reset code generated for development. Do you want to set a new password now?");
        if (!wantsResetNow) {
            return;
        }

        const enteredCode = (window.prompt("Enter reset code", response.devResetCode) || "").trim();
        if (!enteredCode) {
            setStatus("Password reset cancelled.");
            return;
        }

        const newPassword = (window.prompt("Enter new password (minimum 6 characters)") || "").trim();
        if (!newPassword) {
            setStatus("Password reset cancelled.");
            return;
        }

        const resetResponse = await apiRequest("/api/auth/reset-password", {
            email,
            code: enteredCode,
            newPassword
        });

        setStatus(resetResponse.message || "Password reset successfully. You can now sign in.", false);
    } catch (error) {
        setStatus(getFriendlyAuthMessage(error, "Failed to process forgot password request."));
    }
}

async function handleEmailRegister() {
    const email = (document.getElementById("email")?.value || "").trim().toLowerCase();
    const password = (document.getElementById("password")?.value || "").trim();

    if (!email || !password) {
        setStatus("Enter email and password to create account.");
        return;
    }

    try {
        toggleEmailButtons(true);
        setStatus("Creating account...", false);
        const result = await apiRequest("/api/auth/register", {
            email,
            password,
            name: email.split("@")[0]
        });
        saveSession(result);
        window.location.href = REDIRECT_AFTER_LOGIN;
    } catch (error) {
        setStatus(getFriendlyAuthMessage(error, "Could not create account."));
    } finally {
        toggleEmailButtons(false);
    }
}

async function handleGoogleResponse(response) {
    try {
        if (!response || !response.credential) {
            setStatus("Google login failed. Please try again.");
            return;
        }

        setStatus("Verifying Google account...", false);
        const result = await apiRequest("/api/auth/google", { credential: response.credential });
        saveSession(result);
        window.location.href = REDIRECT_AFTER_LOGIN;
    } catch (error) {
        setStatus(getFriendlyAuthMessage(error, "Google login could not be completed."));
    }
}

async function initGoogleSignIn() {
    if (!window.google || !window.google.accounts || !window.google.accounts.id) {
        setStatus("", false);
        return;
    }

    const clientId = await getGoogleClientId();

    if (!clientId) {
        const googleButton = document.getElementById("googleSignInBtn");
        if (googleButton) {
            googleButton.innerHTML = "";
        }
        return;
    }

    window.google.accounts.id.initialize({
        client_id: clientId,
        callback: handleGoogleResponse,
        auto_select: true,
        cancel_on_tap_outside: true
    });

    window.google.accounts.id.renderButton(document.getElementById("googleSignInBtn"), {
        type: "standard",
        theme: "outline",
        size: "large",
        shape: "pill",
        text: "continue_with",
        logo_alignment: "left",
        width: Math.min(350, Math.max(220, window.innerWidth - 56))
    });

    window.google.accounts.id.prompt();
}

function initEmailAuth() {
    const form = document.getElementById("emailAuthForm");
    const registerBtn = document.getElementById("emailRegisterBtn");
    const forgotPasswordBtn = document.getElementById("forgotPasswordBtn");

    if (form) {
        form.addEventListener("submit", handleEmailLogin);
    }

    if (registerBtn) {
        registerBtn.addEventListener("click", handleEmailRegister);
    }
    if (forgotPasswordBtn) {
        forgotPasswordBtn.addEventListener("click", handleForgotPassword);
    }
}

window.addEventListener("load", () => {
    if (hasValidSession()) {
        window.location.href = REDIRECT_AFTER_LOGIN;
        return;
    }

    initEmailAuth();
    initGoogleSignIn();
});