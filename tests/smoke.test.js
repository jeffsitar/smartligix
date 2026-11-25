const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");

const { initDatabase, closeDatabase } = require("../src/db/database");
const { seedEnterpriseData } = require("../src/db/seed");
const { createApp } = require("../src/app");

let server;
let baseUrl;
let tmpDb;

test.before(async () => {
    tmpDb = path.join(os.tmpdir(), `smartlogix-test-${Date.now()}.sqlite`);
    await initDatabase(tmpDb);
    seedEnterpriseData();
    const app = createApp();
    await new Promise((resolve) => {
        server = app.listen(0, () => {
            baseUrl = `http://127.0.0.1:${server.address().port}`;
            resolve();
        });
    });
});

test.after(async () => {
    await new Promise((resolve) => server.close(resolve));
    closeDatabase();
    if (fs.existsSync(tmpDb)) fs.unlinkSync(tmpDb);
});

async function api(urlPath, { method = "GET", body, cookie } = {}) {
    const headers = {};
    if (body) headers["Content-Type"] = "application/json";
    if (cookie) headers["Cookie"] = cookie;
    const res = await fetch(`${baseUrl}${urlPath}`, {
        method,
        headers,
        body: body ? JSON.stringify(body) : undefined
    });
    const setCookie = res.headers.get("set-cookie");
    const data = await res.json().catch(() => ({}));
    return { status: res.status, data, cookie: setCookie ? setCookie.split(";")[0] : cookie };
}

test("Health endpoint returns ok", async () => {
    const r = await api("/api/health");
    assert.equal(r.status, 200);
    assert.equal(r.data.status, "ok");
});

test("Protected endpoints reject unauthenticated requests", async () => {
    const r = await api("/api/dashboard/summary");
    assert.equal(r.status, 401);
});

test("Public shipment tracking works for seeded shipment", async () => {
    const r = await api("/api/shipments/TRK-2026-88912");
    assert.equal(r.status, 200);
    assert.equal(r.data.trackingNumber, "TRK-2026-88912");
    assert.ok(Array.isArray(r.data.timeline) && r.data.timeline.length >= 2);
});

test("Full end-to-end logistics workflow (Auth -> Quote -> Booking -> Dispatch -> POD -> Payment)", async () => {
    const login = await api("/api/auth/login", {
        method: "POST",
        body: { email: "admin@smartlogix.in", password: "admin123" }
    });
    assert.equal(login.status, 200);
    assert.ok(login.cookie);

    const quote = await api("/api/bookings/quote", {
        method: "POST",
        cookie: login.cookie,
        body: { weightKg: 25, serviceType: "EXPRESS", declaredValue: 100000 }
    });
    assert.equal(quote.status, 200);
    assert.ok(quote.data.totalAmount > 0);

    const booking = await api("/api/bookings", {
        method: "POST",
        cookie: login.cookie,
        body: {
            customerName: "Test Enterprise Corp",
            phone: "+91 98200 99999",
            pickupAddress: "Andheri East, Mumbai",
            deliveryAddress: "Pune Hinjewadi",
            parcelDescription: "Server Racks",
            serviceType: "EXPRESS",
            weightKg: 25
        }
    });
    assert.equal(booking.status, 201);
    assert.ok(booking.data.trackingNumber.startsWith("TRK-2026-"));

    const track = await api(`/api/shipments/${booking.data.trackingNumber}`, { cookie: login.cookie });
    assert.equal(track.status, 200);

    const pod = await api(`/api/shipments/${track.data.shipmentId}/status`, {
        method: "POST",
        cookie: login.cookie,
        body: {
            status: "DELIVERED",
            locationNote: "Pune Hinjewadi Sorting Hub",
            podReceiverName: "Vikram Shah",
            podNotes: "Received intact"
        }
    });
    assert.equal(pod.status, 200);
    assert.ok(pod.data.podSignatureCode);

    const invoices = await api("/api/billing/invoices", { cookie: login.cookie });
    assert.equal(invoices.status, 200);
    const inv = invoices.data.invoices.find((i) => i.bookingReference === booking.data.bookingReference);
    assert.ok(inv);

    const pay = await api(`/api/billing/invoices/${inv.invoiceId}/payments`, {
        method: "POST",
        cookie: login.cookie,
        body: { amount: inv.totalAmount, paymentMethod: "NEFT/RTGS", referenceNumber: "UTRTST001" }
    });
    assert.equal(pay.status, 200);
    assert.equal(pay.data.paymentStatus, "PAID");
});
