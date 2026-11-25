const express = require("express");
const db = require("../db/database");
const config = require("../config");
const { authenticate, authorize } = require("../middleware/auth");
const { calculateFreightQuote, getPricingSettings } = require("../services/pricingService");
const { logAudit } = require("../services/auditService");
const { createNotification } = require("../services/notificationService");

const router = express.Router();

function formatDate(d) {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${y}-${m}-${day}`;
}

function addDays(d, days) {
    const c = new Date(d.getTime());
    c.setDate(c.getDate() + days);
    return c;
}

router.post("/quote", authenticate, (req, res) => {
    const body = req.body || {};
    const quote = calculateFreightQuote({
        weightKg: body.weightKg,
        serviceType: body.serviceType,
        declaredValue: body.declaredValue
    });
    return res.json(quote);
});

router.get("/", authenticate, (req, res) => {
    const search = String(req.query.q || "").trim().toLowerCase();
    const status = String(req.query.status || "").trim().toUpperCase();
    const serviceType = String(req.query.serviceType || "").trim().toUpperCase();

    const clauses = [];
    const params = [];

    if (req.user.role === "CUSTOMER") {
        clauses.push("b.customer_id = ?");
        params.push(req.user.customerId || -1);
    } else if (req.user.role === "DRIVER") {
        clauses.push("s.driver_id = ?");
        params.push(req.user.driverId || -1);
    }

    if (status && status !== "ALL") {
        clauses.push("s.current_status = ?");
        params.push(status);
    }
    if (serviceType && serviceType !== "ALL") {
        clauses.push("b.service_type = ?");
        params.push(serviceType);
    }
    if (search) {
        clauses.push(`(
            LOWER(b.booking_reference) LIKE ? OR
            LOWER(s.tracking_number) LIKE ? OR
            LOWER(c.customer_name) LIKE ? OR
            LOWER(b.pickup_address) LIKE ? OR
            LOWER(b.delivery_address) LIKE ? OR
            LOWER(b.parcel_description) LIKE ?
        )`);
        const like = `%${search}%`;
        params.push(like, like, like, like, like, like);
    }

    const whereSql = clauses.length ? `WHERE ${clauses.join(" AND ")}` : "";
    const rows = db.all(
        `SELECT
            b.booking_id AS bookingId,
            b.booking_reference AS bookingReference,
            s.shipment_id AS shipmentId,
            s.tracking_number AS trackingNumber,
            b.customer_id AS customerId,
            c.customer_name AS customerName,
            c.company_name AS companyName,
            c.phone AS phone,
            c.email AS customerEmail,
            b.pickup_address AS pickupAddress,
            b.delivery_address AS deliveryAddress,
            b.parcel_description AS parcelDescription,
            b.service_type AS serviceType,
            b.weight_kg AS weightKg,
            b.dimensions_cm AS dimensionsCm,
            b.declared_value AS declaredValue,
            b.booking_date AS bookingDate,
            b.scheduled_pickup_date AS scheduledPickupDate,
            b.estimated_cost AS estimatedCost,
            COALESCE(s.current_status, b.booking_status) AS status,
            s.estimated_delivery_date AS estimatedDeliveryDate,
            v.registration_number AS vehicleReg,
            d.driver_name AS driverName,
            i.invoice_number AS invoiceNumber,
            i.payment_status AS paymentStatus
         FROM bookings b
         JOIN customers c ON c.customer_id = b.customer_id
         LEFT JOIN shipments s ON s.booking_id = b.booking_id
         LEFT JOIN vehicles v ON v.vehicle_id = s.vehicle_id
         LEFT JOIN drivers d ON d.driver_id = s.driver_id
         LEFT JOIN invoices i ON i.booking_id = b.booking_id
         ${whereSql}
         ORDER BY b.booking_id DESC`,
        params
    );

    return res.json(rows);
});

router.post("/", authenticate, authorize("ADMIN", "DISPATCHER", "WAREHOUSE", "CUSTOMER"), (req, res) => {
    const body = req.body || {};
    const pickupAddress = String(body.pickupAddress || "").trim();
    const deliveryAddress = String(body.deliveryAddress || "").trim();
    const parcelDescription = String(body.parcelDescription || "").trim();
    const serviceType = config.SERVICE_TYPES[body.serviceType] ? body.serviceType : "STANDARD";
    const dimensionsCm = String(body.dimensionsCm || "40x30x25").trim();
    const declaredValue = Math.max(0, Number(body.declaredValue || 0) || 0);
    const scheduledPickupDate = String(body.scheduledPickupDate || formatDate(new Date())).trim();

    let weightKg = 1.0;
    if (body.weightKg != null && String(body.weightKg).trim() !== "") {
        weightKg = Number(body.weightKg);
        if (Number.isNaN(weightKg) || weightKg <= 0) {
            return res.status(400).json({ message: "Weight must be a positive number." });
        }
    }

    if (!pickupAddress || !deliveryAddress || !parcelDescription) {
        return res.status(400).json({ message: "Pickup address, delivery address, and parcel description are required." });
    }

    let customerId = null;
    if (req.user.role === "CUSTOMER") {
        customerId = req.user.customerId;
        if (!customerId) {
            return res.status(400).json({ message: "Customer profile not linked to your account." });
        }
    } else if (body.customerId) {
        const existingCustomer = db.get("SELECT customer_id FROM customers WHERE customer_id = ?", [Number(body.customerId)]);
        if (!existingCustomer) {
            return res.status(404).json({ message: "Selected customer not found." });
        }
        customerId = existingCustomer.customer_id;
    } else {
        const customerName = String(body.customerName || "").trim();
        const phone = String(body.phone || "").trim();
        const email = String(body.email || "").trim();
        if (!customerName || !phone) {
            return res.status(400).json({ message: "Customer name and contact phone are required." });
        }
        const nowIso = new Date().toISOString();
        const cRes = db.run(
            `INSERT INTO customers (customer_name, company_name, phone, email, address, created_at)
             VALUES (?, ?, ?, ?, ?, ?)`,
            [customerName, customerName, phone, email, pickupAddress, nowIso]
        );
        customerId = cRes.lastInsertRowid;
    }

    const quote = calculateFreightQuote({ weightKg, serviceType, declaredValue });
    const pricingSettings = getPricingSettings();
    const now = new Date();
    const nowIso = now.toISOString();

    const maxBookingRow = db.get("SELECT COALESCE(MAX(booking_id), 0) AS maxId FROM bookings");
    const seq = 1001 + (maxBookingRow ? maxBookingRow.maxId : 0);
    const bookingRef = `SLX-BK-2026-${seq}`;
    const trackingNum = `TRK-2026-${88900 + seq}`;
    const invoiceNum = `INV-2026-${String(seq).padStart(4, "0")}`;

    const originCoords = config.resolveCoordinates(pickupAddress);
    const destCoords = config.resolveCoordinates(deliveryAddress);

    const created = db.transaction(() => {
        const bRes = db.run(
            `INSERT INTO bookings (booking_reference, customer_id, pickup_address, delivery_address, parcel_description, service_type, weight_kg, dimensions_cm, declared_value, booking_date, scheduled_pickup_date, booking_status, estimated_cost, created_by, created_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'ACTIVE', ?, ?, ?)`,
            [
                bookingRef,
                customerId,
                pickupAddress,
                deliveryAddress,
                parcelDescription,
                serviceType,
                weightKg,
                dimensionsCm,
                declaredValue,
                formatDate(now),
                scheduledPickupDate,
                quote.totalAmount,
                req.user.email,
                nowIso
            ]
        );
        const bookingId = bRes.lastInsertRowid;

        const sRes = db.run(
            `INSERT INTO shipments (tracking_number, booking_id, current_status, current_location, origin_lat, origin_lng, dest_lat, dest_lng, current_lat, current_lng, estimated_delivery_date, updated_at)
             VALUES (?, ?, 'BOOKED', 'Origin Dispatch Desk', ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
                trackingNum,
                bookingId,
                originCoords.lat,
                originCoords.lng,
                destCoords.lat,
                destCoords.lng,
                originCoords.lat,
                originCoords.lng,
                formatDate(addDays(now, quote.etaDays)),
                nowIso
            ]
        );
        const shipmentId = sRes.lastInsertRowid;

        db.run(
            `INSERT INTO tracking_history (shipment_id, status, location_note, lat, lng, remarks, updated_by, updated_at)
             VALUES (?, 'BOOKED', 'Origin Dispatch Desk', ?, ?, ?, ?, ?)`,
            [
                shipmentId,
                originCoords.lat,
                originCoords.lng,
                `Booking confirmed (${quote.serviceLabel}) and tracking ID generated.`,
                req.user.email,
                nowIso
            ]
        );

        const invRes = db.run(
            `INSERT INTO invoices (invoice_number, booking_id, customer_id, base_charge, weight_charge, fuel_surcharge, tax_amount, total_amount, amount_paid, payment_status, due_date, issued_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0, 'UNPAID', ?, ?)`,
            [
                invoiceNum,
                bookingId,
                customerId,
                quote.baseCharge,
                quote.weightCharge,
                quote.fuelSurcharge,
                quote.taxAmount,
                quote.totalAmount,
                formatDate(addDays(now, pricingSettings.paymentTermsDays)),
                nowIso
            ]
        );

        return { bookingId, shipmentId, invoiceId: invRes.lastInsertRowid };
    });

    logAudit({
        actorEmail: req.user.email,
        actorRole: req.user.role,
        action: "BOOKING_CREATED",
        entityType: "BOOKING",
        entityId: bookingRef,
        details: `Tracking ${trackingNum}, ${weightKg} kg, INR ${quote.totalAmount}`,
        ipAddress: req.ip
    });

    createNotification({
        targetRole: "DISPATCHER",
        title: "New Consignment Ready for Dispatch",
        message: `${bookingRef} (${trackingNum}) — ${weightKg} kg ${quote.serviceLabel} awaiting vehicle assignment.`,
        severity: "INFO",
        link: "dispatch.html"
    });

    return res.status(201).json({
        message: "Booking created successfully!",
        bookingId: created.bookingId,
        bookingReference: bookingRef,
        trackingNumber: trackingNum,
        invoiceNumber: invoiceNum,
        estimatedCost: quote.totalAmount
    });
});

router.post("/:bookingId/cancel", authenticate, authorize("ADMIN", "DISPATCHER"), (req, res) => {
    const bookingId = Number(req.params.bookingId);
    const reason = String((req.body && req.body.reason) || "Cancelled by operations").trim();
    const booking = db.get("SELECT * FROM bookings WHERE booking_id = ?", [bookingId]);
    if (!booking) {
        return res.status(404).json({ message: "Booking not found." });
    }
    const shipment = db.get("SELECT * FROM shipments WHERE booking_id = ?", [bookingId]);
    if (shipment && shipment.current_status === "DELIVERED") {
        return res.status(400).json({ message: "Delivered shipments cannot be cancelled." });
    }

    const nowIso = new Date().toISOString();
    db.transaction(() => {
        db.run("UPDATE bookings SET booking_status = 'CANCELLED' WHERE booking_id = ?", [bookingId]);
        if (shipment) {
            db.run("UPDATE shipments SET current_status = 'CANCELLED', updated_at = ? WHERE shipment_id = ?", [nowIso, shipment.shipment_id]);
            db.run(
                `INSERT INTO tracking_history (shipment_id, status, location_note, remarks, updated_by, updated_at)
                 VALUES (?, 'CANCELLED', ?, ?, ?, ?)`,
                [shipment.shipment_id, shipment.current_location || "Dispatch Desk", reason, req.user.email, nowIso]
            );
            if (shipment.vehicle_id) {
                db.run("UPDATE vehicles SET availability_status = 'AVAILABLE' WHERE vehicle_id = ?", [shipment.vehicle_id]);
            }
            if (shipment.driver_id) {
                db.run("UPDATE drivers SET availability_status = 'AVAILABLE' WHERE driver_id = ?", [shipment.driver_id]);
            }
        }
    });

    logAudit({
        actorEmail: req.user.email,
        actorRole: req.user.role,
        action: "BOOKING_CANCELLED",
        entityType: "BOOKING",
        entityId: booking.booking_reference,
        details: reason,
        ipAddress: req.ip
    });

    return res.json({ message: `Booking ${booking.booking_reference} cancelled.` });
});

module.exports = router;
