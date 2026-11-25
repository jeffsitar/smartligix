window.SLX = window.SLX || {};

function escapeHtml(str) {
    return String(str == null ? "" : str)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#39;");
}

function formatINR(amount) {
    const n = Number(amount || 0);
    return new Intl.NumberFormat("en-IN", {
        style: "currency",
        currency: "INR",
        maximumFractionDigits: 2
    }).format(n);
}

function formatServiceType(code) {
    const map = {
        STANDARD: "Standard Road",
        EXPRESS: "Express Air",
        COLD_CHAIN: "Cold Chain",
        PORT_CONTAINER: "Port / Container"
    };
    return map[code] || code || "Standard";
}

function getStatusBadge(status) {
    const map = {
        BOOKED: "slx-badge-booked",
        PICKED_UP: "slx-badge-picked",
        IN_TRANSIT: "slx-badge-transit",
        OUT_FOR_DELIVERY: "slx-badge-ofd",
        DELIVERED: "slx-badge-delivered",
        CANCELLED: "slx-badge-cancelled",
        AVAILABLE: "slx-badge-delivered",
        ON_TRIP: "slx-badge-transit",
        MAINTENANCE: "slx-badge-cancelled",
        PAID: "slx-badge-delivered",
        PARTIAL: "slx-badge-transit",
        UNPAID: "slx-badge-cancelled",
        ACTIVE: "slx-badge-delivered"
    };
    const cls = map[status] || "slx-badge-booked";
    const label = String(status || "UNKNOWN").replace(/_/g, " ");
    return `<span class="slx-badge ${cls}">${escapeHtml(label)}</span>`;
}

function showToast(message, type = "info") {
    let container = document.getElementById("slxToastContainer");
    if (!container) {
        container = document.createElement("div");
        container.id = "slxToastContainer";
        container.className = "slx-toast-container";
        document.body.appendChild(container);
    }
    const icon = type === "success" ? "bi-check-circle-fill text-success" : type === "error" ? "bi-exclamation-triangle-fill text-danger" : "bi-info-circle-fill text-warning";
    const toast = document.createElement("div");
    toast.className = `slx-toast ${type}`;
    toast.innerHTML = `<i class="bi ${icon}"></i><span>${escapeHtml(message)}</span>`;
    container.appendChild(toast);
    setTimeout(() => {
        toast.style.opacity = "0";
        toast.style.transition = "opacity 0.25s ease";
        setTimeout(() => toast.remove(), 260);
    }, 3600);
}

async function apiFetch(url, options = {}) {
    const config = {
        credentials: "same-origin",
        headers: {
            ...(options.body ? { "Content-Type": "application/json" } : {}),
            ...(options.headers || {})
        },
        ...options
    };
    const res = await fetch(url, config);
    const contentType = res.headers.get("content-type") || "";
    const data = contentType.includes("application/json") ? await res.json().catch(() => ({})) : await res.text();

    if (res.status === 401 && !window.location.pathname.endsWith("index.html") && window.location.pathname !== "/") {
        window.location.href = "index.html";
        throw new Error("Session expired");
    }
    if (!res.ok) {
        const msg = (data && data.message) || `Request failed (${res.status})`;
        throw new Error(msg);
    }
    return data;
}

window.SLX.escapeHtml = escapeHtml;
window.SLX.formatINR = formatINR;
window.SLX.formatServiceType = formatServiceType;
window.SLX.getStatusBadge = getStatusBadge;
window.SLX.showToast = showToast;
window.SLX.apiFetch = apiFetch;
