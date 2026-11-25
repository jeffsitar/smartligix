const NAV_ITEMS = [
    { section: "Operations", href: "dashboard.html", icon: "bi-grid-1x2-fill", label: "Control Tower", roles: ["ADMIN", "DISPATCHER", "WAREHOUSE", "DRIVER", "CUSTOMER"] },
    { section: "Operations", href: "bookings.html", icon: "bi-box-seam-fill", label: "Bookings & Orders", roles: ["ADMIN", "DISPATCHER", "WAREHOUSE", "CUSTOMER"] },
    { section: "Operations", href: "dispatch.html", icon: "bi-diagram-3-fill", label: "Dispatch & Routes", roles: ["ADMIN", "DISPATCHER", "WAREHOUSE", "DRIVER"] },
    { section: "Operations", href: "tracking.html", icon: "bi-geo-alt-fill", label: "Live Tracking & POD", roles: ["ADMIN", "DISPATCHER", "WAREHOUSE", "DRIVER", "CUSTOMER"] },
    { section: "Resources", href: "fleet.html", icon: "bi-truck", label: "Fleet & Drivers", roles: ["ADMIN", "DISPATCHER", "WAREHOUSE"] },
    { section: "Resources", href: "customers.html", icon: "bi-buildings-fill", label: "Customers", roles: ["ADMIN", "DISPATCHER", "WAREHOUSE"] },
    { section: "Finance & Admin", href: "billing.html", icon: "bi-receipt-cutoff", label: "Invoices & Payments", roles: ["ADMIN", "DISPATCHER", "CUSTOMER"] },
    { section: "Finance & Admin", href: "analytics.html", icon: "bi-bar-chart-line-fill", label: "Analytics & Audit", roles: ["ADMIN", "DISPATCHER", "WAREHOUSE"] },
    { section: "Finance & Admin", href: "settings.html", icon: "bi-sliders", label: "Settings & Users", roles: ["ADMIN"] }
];

async function initAppShell(pageTitle) {
    let user;
    try {
        user = await window.SLX.apiFetch("/api/auth/me");
        window.SLX.user = user;
    } catch (_) {
        window.location.href = "index.html";
        return null;
    }

    const currentFile = window.location.pathname.split("/").pop() || "dashboard.html";
    const allowedNav = NAV_ITEMS.filter((item) => item.roles.includes(user.role));

    // Group nav items by section
    const sections = {};
    for (const item of allowedNav) {
        if (!sections[item.section]) sections[item.section] = [];
        sections[item.section].push(item);
    }

    let navHtml = "";
    for (const [secName, items] of Object.entries(sections)) {
        navHtml += `<div class="slx-nav-section">${window.SLX.escapeHtml(secName)}</div>`;
        for (const item of items) {
            const active = currentFile === item.href ? "active" : "";
            navHtml += `
                <a class="slx-nav-link ${active}" href="${item.href}">
                    <i class="bi ${item.icon}"></i>
                    <span>${window.SLX.escapeHtml(item.label)}</span>
                </a>`;
        }
    }

    const sidebarEl = document.getElementById("slxSidebar");
    if (sidebarEl) {
        sidebarEl.innerHTML = `
            <div class="slx-brand">
                <div class="slx-brand-mark"><i class="bi bi-boxes"></i></div>
                <div class="slx-brand-text">
                    <h5>SMARTLOGIX</h5>
                    <span>Enterprise LMS</span>
                </div>
            </div>
            <nav class="slx-nav">${navHtml}</nav>
            <div class="slx-sidebar-footer">
                <div class="fw-semibold text-white text-truncate">${window.SLX.escapeHtml(user.fullName)}</div>
                <div class="d-flex justify-content-between align-items-center mt-1">
                    <span class="badge bg-secondary" style="font-size:0.65rem;">${window.SLX.escapeHtml(user.role)}</span>
                    <a href="#" id="sidebarLogoutBtn" class="text-warning text-decoration-none small fw-semibold">
                        <i class="bi bi-box-arrow-right"></i> Sign out
                    </a>
                </div>
            </div>`;
    }

    const topbarEl = document.getElementById("slxTopbar");
    if (topbarEl) {
        topbarEl.innerHTML = `
            <div class="d-flex align-items-center gap-2">
                <button class="btn btn-light btn-sm d-lg-none border" id="mobileMenuBtn" aria-label="Toggle Menu">
                    <i class="bi bi-list fs-5"></i>
                </button>
                <h5 class="mb-0 fw-bold">${window.SLX.escapeHtml(pageTitle)}</h5>
            </div>
            <div class="d-flex align-items-center gap-2 gap-md-3">
                <form id="quickTrackForm" class="d-none d-md-flex input-group input-group-sm" style="width: 240px;">
                    <input type="text" id="quickTrackInput" class="form-control" placeholder="Quick track (TRK-...)" aria-label="Quick track">
                    <button class="btn btn-outline-secondary" type="submit" aria-label="Track"><i class="bi bi-search"></i></button>
                </form>
                <div class="dropdown">
                    <button class="btn btn-light btn-sm border position-relative" data-bs-toggle="dropdown" aria-label="Notifications">
                        <i class="bi bi-bell"></i>
                        <span id="notifBadge" class="position-absolute top-0 start-100 translate-middle badge rounded-pill bg-danger d-none" style="font-size:0.62rem;">0</span>
                    </button>
                    <div class="dropdown-menu dropdown-menu-end shadow-lg border-0 p-0" style="width: 320px; max-height: 380px; overflow-y: auto;">
                        <div class="d-flex justify-content-between align-items-center px-3 py-2 border-bottom bg-light">
                            <span class="fw-semibold small">Notifications</span>
                            <button class="btn btn-link btn-sm p-0 text-decoration-none small" id="markAllReadBtn">Mark all read</button>
                        </div>
                        <div id="notifList" class="p-2 small text-muted text-center">Loading...</div>
                    </div>
                </div>
                <div class="d-none d-sm-flex align-items-center gap-2 ps-2 border-start">
                    <div class="rounded-circle bg-dark text-white d-flex align-items-center justify-content-center fw-bold" style="width:32px;height:32px;font-size:0.78rem;">
                        ${window.SLX.escapeHtml(user.fullName.slice(0, 2).toUpperCase())}
                    </div>
                    <div class="lh-sm">
                        <div class="small fw-semibold">${window.SLX.escapeHtml(user.fullName)}</div>
                        <div class="text-muted" style="font-size:0.68rem;">${window.SLX.escapeHtml(user.role)}</div>
                    </div>
                </div>
            </div>`;
    }

    // Mobile drawer handlers
    const backdrop = document.getElementById("slxBackdrop");
    const mobileBtn = document.getElementById("mobileMenuBtn");
    if (mobileBtn && sidebarEl && backdrop) {
        mobileBtn.addEventListener("click", () => {
            sidebarEl.classList.toggle("open");
            backdrop.classList.toggle("open");
        });
        backdrop.addEventListener("click", () => {
            sidebarEl.classList.remove("open");
            backdrop.classList.remove("open");
        });
    }

    // Logout handler
    const logoutBtn = document.getElementById("sidebarLogoutBtn");
    if (logoutBtn) {
        logoutBtn.addEventListener("click", async (e) => {
            e.preventDefault();
            try { await window.SLX.apiFetch("/api/auth/logout", { method: "POST" }); } catch (_) {}
            window.location.href = "index.html";
        });
    }

    // Quick track handler
    const qtForm = document.getElementById("quickTrackForm");
    if (qtForm) {
        qtForm.addEventListener("submit", (e) => {
            e.preventDefault();
            const val = document.getElementById("quickTrackInput").value.trim();
            if (val) window.location.href = `tracking.html?trk=${encodeURIComponent(val)}`;
        });
    }

    // Load Notifications
    loadNotifications();
    const markBtn = document.getElementById("markAllReadBtn");
    if (markBtn) {
        markBtn.addEventListener("click", async (e) => {
            e.preventDefault();
            e.stopPropagation();
            await window.SLX.apiFetch("/api/analytics/notifications/read-all", { method: "POST" });
            loadNotifications();
        });
    }

    return user;
}

async function loadNotifications() {
    try {
        const data = await window.SLX.apiFetch("/api/analytics/notifications");
        const badge = document.getElementById("notifBadge");
        const list = document.getElementById("notifList");
        if (!badge || !list) return;

        if (data.unreadCount > 0) {
            badge.textContent = data.unreadCount;
            badge.classList.remove("d-none");
        } else {
            badge.classList.add("d-none");
        }

        if (!data.notifications.length) {
            list.innerHTML = `<div class="py-3 text-muted">No notifications yet.</div>`;
            return;
        }

        list.innerHTML = data.notifications.slice(0, 8).map((n) => `
            <a href="${window.SLX.escapeHtml(n.link || "#")}" class="d-block text-decoration-none p-2 rounded mb-1 ${n.isRead ? "" : "bg-light"}" style="color:inherit;">
                <div class="d-flex justify-content-between align-items-center">
                    <span class="fw-semibold small">${window.SLX.escapeHtml(n.title)}</span>
                    ${n.isRead ? "" : '<span class="badge bg-primary" style="font-size:0.6rem;">New</span>'}
                </div>
                <div class="text-muted" style="font-size:0.75rem;">${window.SLX.escapeHtml(n.message)}</div>
            </a>
        `).join("");
    } catch (_) {
        // ignore notification errors
    }
}

window.SLX.initAppShell = initAppShell;
