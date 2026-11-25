const fs = require("fs");
const bcrypt = require("bcryptjs");
const db = require("./database");
const config = require("../config");
const { calculateFreightQuote } = require("../services/pricingService");

function formatDate(date) {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, "0");
    const d = String(date.getDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
}

function addDays(date, days) {
    const copy = new Date(date.getTime());
    copy.setDate(copy.getDate() + days);
    return copy;
}

function seedSettings() {
    const defaults = {
        company_name: "SmartLogix Global Logistics Pvt. Ltd.",
        company_gstin: "27AABCS1429B1Z5",
        company_address: "Plot 14, Logistics Park, Andheri East, Mumbai 400069",
        support_email: "ops@smartlogix.in",
        support_phone: "+91 22 4091 8800",
        currency: "INR",
        base_rate: "450",
        per_kg_rate: "38",
        fuel_surcharge_pct: "12",
        gst_pct: "18",
        payment_terms_days: "15"
    };
    const now = new Date().toISOString();
    for (const [k, v] of Object.entries(defaults)) {
        const exists = db.get("SELECT setting_key FROM settings WHERE setting_key = ?", [k]);
        if (!exists) {
            db.run(
                "INSERT INTO settings (setting_key, setting_value, updated_at) VALUES (?, ?, ?)",
                [k, v, now]
            );
        }
    }
}

function seedEnterpriseData() {
    seedSettings();

    const userCount = db.get("SELECT COUNT(*) AS cnt FROM users").cnt;
    if (userCount > 0) {
        return;
    }

    const now = new Date();
    const nowIso = now.toISOString();

    // 1. Seed Vehicles
    const vehicles = [
        ["MH-01-CV-4521", "Light Commercial Van", "1,500 kg", 1500, "Andheri East Hub, Mumbai", "AVAILABLE", "Diesel", "2026-10-18"],
        ["MH-04-TR-8810", "Mini Cargo Truck", "3,500 kg", 3500, "Lonavala Expressway", "ON_TRIP", "Diesel", "2026-10-05"],
        ["MH-43-BL-1904", "Heavy Box Truck", "7,000 kg", 7000, "Bhiwandi Logistics Park", "AVAILABLE", "Diesel", "2026-11-01"],
        ["MH-12-RF-6722", "Refrigerated Reefer Van", "2,800 kg", 2800, "Pune Hinjewadi Sorting Hub", "ON_TRIP", "Diesel", "2026-11-10"],
        ["GJ-01-CT-3390", "40ft Container Trailer", "22,000 kg", 22000, "JNPT / Nhava Sheva Port", "AVAILABLE", "Diesel", "2026-10-28"],
        ["KA-01-EV-9012", "Electric Urban Delivery Van", "1,200 kg", 1200, "Bengaluru Electronic City Hub", "MAINTENANCE", "Electric", "2026-11-20"]
    ];
    for (const v of vehicles) {
        db.run(
            `INSERT INTO vehicles (registration_number, vehicle_type, capacity, capacity_kg, current_hub, availability_status, fuel_type, last_service_date, created_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [...v, nowIso]
        );
    }

    // 2. Seed Drivers
    const drivers = [
        ["Suresh Patil", "+91 98192 44102", "MH01-2019004512", "Andheri East Hub, Mumbai", "AVAILABLE", 4.9],
        ["Ramesh Jadhav", "+91 98211 77319", "MH04-2018007834", "Mumbai Central Hub", "ON_TRIP", 4.8],
        ["Vikram Deshmukh", "+91 97654 32108", "MH12-2020001922", "Pune Hinjewadi Sorting Hub", "ON_TRIP", 4.7],
        ["Imran Shaikh", "+91 98204 55910", "MH43-2017009104", "Bhiwandi Logistics Park", "AVAILABLE", 4.9],
        ["Arjun Nair", "+91 99001 88421", "KA01-2021006431", "Bengaluru Electronic City Hub", "AVAILABLE", 4.6]
    ];
    for (const d of drivers) {
        db.run(
            `INSERT INTO drivers (driver_name, phone, licence_reference, home_hub, availability_status, rating, created_at)
             VALUES (?, ?, ?, ?, ?, ?, ?)`,
            [...d, nowIso]
        );
    }

    // 3. Seed Customers
    const customers = [
        ["Rohan Traders", "Rohan Industrial Components LLP", "+91 98200 11223", "rohan@traders.in", "27AAACR5055K1Z8", "Andheri East, Mumbai - 400069", "Mumbai", 500000],
        ["Apex MedTech Pharma", "Apex MedTech Diagnostics Pvt. Ltd.", "+91 98201 44512", "supply@apexmedtech.in", "27AABCA9921F1Z2", "MIDC Rabale, Navi Mumbai - 400701", "Mumbai", 1200000],
        ["Deccan Precision Auto", "Deccan Auto Systems Ltd.", "+91 98500 77812", "logistics@deccanauto.in", "27AABCD4410M1Z9", "Chakan Industrial Area, Pune - 410501", "Pune", 800000],
        ["Vanguard Retail Exports", "Vanguard Global Apparel Pvt. Ltd.", "+91 98111 66340", "dispatch@vanguardretail.in", "07AAACV3312E1Z4", "Udyog Vihar Phase 4, Gurugram - 122015", "Gurugram", 950000]
    ];
    for (const c of customers) {
        db.run(
            `INSERT INTO customers (customer_name, company_name, phone, email, gstin, address, city, credit_limit, account_status, created_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'ACTIVE', ?)`,
            [...c, nowIso]
        );
    }

    // 4. Seed Users across all 5 enterprise roles
    const users = [
        ["Lalit Rajpurohit", "admin@smartlogix.in", "admin123", "ADMIN", "+91 98200 00001", null, null],
        ["Priya Kulkarni", "dispatcher@smartlogix.in", "dispatch123", "DISPATCHER", "+91 98200 00002", null, null],
        ["Dispatch Staff", "staff@smartlogix.in", "staff123", "DISPATCHER", "+91 98200 00003", null, null],
        ["Anil Verma", "warehouse@smartlogix.in", "warehouse123", "WAREHOUSE", "+91 98200 00004", null, null],
        ["Ramesh Jadhav", "driver@smartlogix.in", "driver123", "DRIVER", "+91 98211 77319", null, 2],
        ["Rohan Mehta", "customer@traders.in", "customer123", "CUSTOMER", "+91 98200 11223", 1, null]
    ];
    for (const [fullName, email, pwd, role, phone, custId, drvId] of users) {
        db.run(
            `INSERT INTO users (full_name, email, password_hash, role, phone, customer_id, driver_id, active, created_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, 1, ?)`,
            [fullName, email, bcrypt.hashSync(pwd, 10), role, phone, custId, drvId, nowIso]
        );
    }

    // 5. Seed Bookings, Shipments, Tracking History, Invoices & Payments
    const sampleConsignments = [
        {
            ref: "SLX-BK-2026-1001",
            trk: "TRK-2026-88912",
            customerId: 1,
            pickup: "Andheri East, Mumbai - 400069",
            delivery: "Hinjewadi Phase 1, Pune - 411057",
            desc: "Industrial Electronic Parts (18.5 kg)",
            serviceType: "EXPRESS",
            weightKg: 18.5,
            dims: "60x45x40",
            declared: 85000,
            daysAgo: 1,
            etaOffset: 1,
            status: "IN_TRANSIT",
            vehicleId: 2,
            driverId: 2,
            curLoc: "Lonavala Highway Checkpoint",
            curLat: 18.7557,
            curLng: 73.4091,
            paidFraction: 1,
            history: [
                ["BOOKED", "Andheri Hub, Mumbai", 19.1136, 72.8697, "Consignment registered and verified.", "admin@smartlogix.in", -20],
                ["PICKED_UP", "Andheri East, Mumbai", 19.1136, 72.8697, "Collected by fleet vehicle MH-04-TR-8810.", "driver@smartlogix.in", -14],
                ["IN_TRANSIT", "Lonavala Highway Checkpoint", 18.7557, 73.4091, "Dispatched via Mumbai-Pune Expressway.", "dispatcher@smartlogix.in", -4]
            ]
        },
        {
            ref: "SLX-BK-2026-1002",
            trk: "TRK-2026-89902",
            customerId: 2,
            pickup: "Bhiwandi Logistics Park, Mumbai - 421302",
            delivery: "Electronic City Phase 2, Bengaluru - 560100",
            desc: "Temperature-Controlled Diagnostic Kits",
            serviceType: "COLD_CHAIN",
            weightKg: 42.0,
            dims: "90x60x60",
            declared: 240000,
            daysAgo: 2,
            etaOffset: 0,
            status: "OUT_FOR_DELIVERY",
            vehicleId: 4,
            driverId: 3,
            curLoc: "Bengaluru Electronic City Hub",
            curLat: 12.9716,
            curLng: 77.5946,
            paidFraction: 0.5,
            history: [
                ["BOOKED", "Bhiwandi Logistics Park", 19.2813, 73.0483, "Cold-chain booking confirmed (2-8°C).", "dispatcher@smartlogix.in", -44],
                ["PICKED_UP", "Bhiwandi Cold Storage Bay 3", 19.2813, 73.0483, "Loaded into Reefer Van MH-12-RF-6722.", "warehouse@smartlogix.in", -36],
                ["IN_TRANSIT", "Pune NH48 Corridor", 18.5913, 73.7389, "Reefer telemetry nominal at 4.1°C.", "dispatcher@smartlogix.in", -22],
                ["OUT_FOR_DELIVERY", "Bengaluru Electronic City Hub", 12.9716, 77.5946, "Final-mile courier dispatched to consignee.", "dispatcher@smartlogix.in", -2]
            ]
        },
        {
            ref: "SLX-BK-2026-1003",
            trk: "TRK-2026-89903",
            customerId: 3,
            pickup: "Pune Hinjewadi Sorting Hub, Pune - 411057",
            delivery: "Ahmedabad Freight Terminal, Gujarat - 380015",
            desc: "CNC Machined Transmission Assemblies",
            serviceType: "STANDARD",
            weightKg: 125.0,
            dims: "120x80x75",
            declared: 310000,
            daysAgo: 5,
            etaOffset: -1,
            status: "DELIVERED",
            vehicleId: 3,
            driverId: 4,
            curLoc: "Ahmedabad Freight Terminal",
            curLat: 23.0225,
            curLng: 72.5714,
            pod: { receiver: "Kiran Patel (Plant Receiving)", notes: "Delivered intact, 4 wooden crates verified.", code: "POD-9941-AHM" },
            paidFraction: 1,
            history: [
                ["BOOKED", "Pune Hinjewadi Sorting Hub", 18.5913, 73.7389, "Heavy freight booking scheduled.", "dispatcher@smartlogix.in", -115],
                ["PICKED_UP", "Chakan Industrial Area, Pune", 18.7606, 73.8636, "Palletized cargo loaded and strapped.", "warehouse@smartlogix.in", -104],
                ["IN_TRANSIT", "Surat Textile Cargo Hub", 21.1702, 72.8311, "Cleared Maharashtra-Gujarat border checkpoint.", "dispatcher@smartlogix.in", -68],
                ["OUT_FOR_DELIVERY", "Ahmedabad Freight Terminal", 23.0225, 72.5714, "Out for dock delivery.", "dispatcher@smartlogix.in", -30],
                ["DELIVERED", "Ahmedabad Freight Terminal", 23.0225, 72.5714, "Signed POD received by Kiran Patel.", "driver@smartlogix.in", -24]
            ]
        },
        {
            ref: "SLX-BK-2026-1004",
            trk: "TRK-2026-89904",
            customerId: 4,
            pickup: "JNPT / Nhava Sheva Port, Navi Mumbai - 400707",
            delivery: "Gurugram Fulfillment Center, Delhi NCR - 122015",
            desc: "Export Garment Cartons (18 Pallets)",
            serviceType: "PORT_CONTAINER",
            weightKg: 480.0,
            dims: "240x120x150",
            declared: 620000,
            daysAgo: 0,
            etaOffset: 4,
            status: "BOOKED",
            vehicleId: null,
            driverId: null,
            curLoc: "JNPT / Nhava Sheva Port",
            curLat: 18.9490,
            curLng: 72.9522,
            paidFraction: 0,
            history: [
                ["BOOKED", "JNPT / Nhava Sheva Port", 18.9490, 72.9522, "Customs cleared. Awaiting trailer dispatch assignment.", "dispatcher@smartlogix.in", -1]
            ]
        },
        {
            ref: "SLX-BK-2026-1005",
            trk: "TRK-2026-89905",
            customerId: 1,
            pickup: "Andheri East, Mumbai - 400069",
            delivery: "Hyderabad Shamshabad Hub - 501218",
            desc: "High-Voltage Switchgear Modules",
            serviceType: "EXPRESS",
            weightKg: 34.0,
            dims: "75x50x50",
            declared: 145000,
            daysAgo: 3,
            etaOffset: -1,
            status: "DELIVERED",
            vehicleId: 1,
            driverId: 1,
            curLoc: "Hyderabad Shamshabad Hub",
            curLat: 17.3850,
            curLng: 78.4867,
            pod: { receiver: "Srinivas Rao", notes: "Handed over to warehouse security with seal intact.", code: "POD-8820-HYD" },
            paidFraction: 1,
            history: [
                ["BOOKED", "Andheri East Hub, Mumbai", 19.1136, 72.8697, "Express consignment logged.", "admin@smartlogix.in", -72],
                ["IN_TRANSIT", "Pune Expressway Corridor", 18.5913, 73.7389, "Line-haul in progress.", "dispatcher@smartlogix.in", -50],
                ["DELIVERED", "Hyderabad Shamshabad Hub", 17.3850, 78.4867, "Delivered ahead of SLA.", "driver@smartlogix.in", -20]
            ]
        }
    ];

    sampleConsignments.forEach((item, idx) => {
        const quote = calculateFreightQuote({
            weightKg: item.weightKg,
            serviceType: item.serviceType,
            declaredValue: item.declared
        });
        const bDate = formatDate(addDays(now, -item.daysAgo));
        const etaDate = formatDate(addDays(now, item.etaOffset));
        const originCoords = config.resolveCoordinates(item.pickup);
        const destCoords = config.resolveCoordinates(item.delivery);

        const bRes = db.run(
            `INSERT INTO bookings (booking_reference, customer_id, pickup_address, delivery_address, parcel_description, service_type, weight_kg, dimensions_cm, declared_value, booking_date, scheduled_pickup_date, booking_status, estimated_cost, created_by, created_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'ACTIVE', ?, ?, ?)`,
            [
                item.ref,
                item.customerId,
                item.pickup,
                item.delivery,
                item.desc,
                item.serviceType,
                item.weightKg,
                item.dims,
                item.declared,
                bDate,
                bDate,
                quote.totalAmount,
                "admin@smartlogix.in",
                nowIso
            ]
        );
        const bookingId = bRes.lastInsertRowid;

        const podTimestamp = item.pod ? new Date(now.getTime() - 20 * 3600000).toISOString() : null;
        const sRes = db.run(
            `INSERT INTO shipments (tracking_number, booking_id, vehicle_id, driver_id, current_status, current_location, origin_lat, origin_lng, dest_lat, dest_lng, current_lat, current_lng, estimated_delivery_date, actual_delivery_date, pod_receiver_name, pod_notes, pod_signature_code, pod_timestamp, updated_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
                item.trk,
                bookingId,
                item.vehicleId,
                item.driverId,
                item.status,
                item.curLoc,
                originCoords.lat,
                originCoords.lng,
                destCoords.lat,
                destCoords.lng,
                item.curLat,
                item.curLng,
                etaDate,
                item.pod ? formatDate(addDays(now, -1)) : null,
                item.pod ? item.pod.receiver : null,
                item.pod ? item.pod.notes : null,
                item.pod ? item.pod.code : null,
                podTimestamp,
                nowIso
            ]
        );
        const shipmentId = sRes.lastInsertRowid;

        for (const [st, loc, lat, lng, rem, by, hrsOffset] of item.history) {
            const ts = new Date(now.getTime() + hrsOffset * 3600000).toISOString();
            db.run(
                `INSERT INTO tracking_history (shipment_id, status, location_note, lat, lng, remarks, updated_by, updated_at)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
                [shipmentId, st, loc, lat, lng, rem, by, ts]
            );
        }

        const invNum = `INV-2026-${String(1001 + idx).padStart(4, "0")}`;
        const amountPaid = Math.round(quote.totalAmount * item.paidFraction * 100) / 100;
        const paymentStatus = amountPaid >= quote.totalAmount ? "PAID" : amountPaid > 0 ? "PARTIAL" : "UNPAID";
        const invRes = db.run(
            `INSERT INTO invoices (invoice_number, booking_id, customer_id, base_charge, weight_charge, fuel_surcharge, tax_amount, total_amount, amount_paid, payment_status, due_date, issued_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
                invNum,
                bookingId,
                item.customerId,
                quote.baseCharge,
                quote.weightCharge,
                quote.fuelSurcharge,
                quote.taxAmount,
                quote.totalAmount,
                amountPaid,
                paymentStatus,
                formatDate(addDays(now, 15 - item.daysAgo)),
                nowIso
            ]
        );

        if (amountPaid > 0) {
            db.run(
                `INSERT INTO payments (invoice_id, amount, payment_method, reference_number, recorded_by, paid_at)
                 VALUES (?, ?, ?, ?, ?, ?)`,
                [
                    invRes.lastInsertRowid,
                    amountPaid,
                    idx % 2 === 0 ? "NEFT/RTGS" : "UPI",
                    `TXN-SLX-${70010 + idx}`,
                    "admin@smartlogix.in",
                    nowIso
                ]
            );
        }
    });

    // 6. Seed Notifications
    db.run(
        `INSERT INTO notifications (target_role, title, message, severity, link, is_read, created_at)
         VALUES (?, ?, ?, ?, ?, 0, ?)`,
        ["DISPATCHER", "Unassigned Port Cargo", "Booking SLX-BK-2026-1004 (480 kg) at JNPT Port awaits vehicle & driver assignment.", "WARNING", "dispatch.html", nowIso]
    );
    db.run(
        `INSERT INTO notifications (target_role, title, message, severity, link, is_read, created_at)
         VALUES (?, ?, ?, ?, ?, 0, ?)`,
        ["ADMIN", "Vehicle Under Maintenance", "Electric Van KA-01-EV-9012 is currently marked MAINTENANCE at Bengaluru Hub.", "INFO", "fleet.html", nowIso]
    );

    // 7. Seed Initial Audit Log
    db.run(
        `INSERT INTO audit_logs (actor_email, actor_role, action, entity_type, entity_id, details, ip_address, created_at)
         VALUES ('system@smartlogix.in', 'SYSTEM', 'DATABASE_INITIALIZED', 'SYSTEM', 'v2.0', 'Initialized SmartLogix Enterprise SQLite database with operational seed data.', '127.0.0.1', ?)`,
        [nowIso]
    );
}

module.exports = {
    seedEnterpriseData,
    seedSettings
};
