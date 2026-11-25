const express = require("express");
const db = require("../db/database");
const { authenticate, authorize } = require("../middleware/auth");
const { logAudit } = require("../services/auditService");

const router = express.Router();

router.get("/", authenticate, authorize("ADMIN", "DISPATCHER", "WAREHOUSE"), (req, res) => {
    const q = String(req.query.q || "").trim().toLowerCase();
    const params = [];
    let where = "";
    if (q) {
        where = "WHERE LOWER(c.customer_name) LIKE ? OR LOWER(c.company_name) LIKE ? OR LOWER(c.email) LIKE ? OR LOWER(c.city) LIKE ?";
        const like = `%${q}%`;
        params.push(like, like, like, like);
    }

    const rows = db.all(
        `SELECT
            c.customer_id AS customerId,
            c.customer_name AS customerName,
            c.company_name AS companyName,
            c.phone,
            c.email,
            c.gstin,
            c.address,
            c.city,
            c.credit_limit AS creditLimit,
            c.account_status AS accountStatus,
            COUNT(DISTINCT b.booking_id) AS totalBookings,
            COALESCE(SUM(i.total_amount), 0) AS totalSpend,
            COALESCE(SUM(i.total_amount - i.amount_paid), 0) AS outstandingBalance
         FROM customers c
         LEFT JOIN bookings b ON b.customer_id = c.customer_id
         LEFT JOIN invoices i ON i.customer_id = c.customer_id
         ${where}
         GROUP BY c.customer_id
         ORDER BY c.customer_id DESC`,
        params
    );
    return res.json(rows);
});

router.post("/", authenticate, authorize("ADMIN", "DISPATCHER"), (req, res) => {
    const body = req.body || {};
    const customerName = String(body.customerName || "").trim();
    const companyName = String(body.companyName || "").trim();
    const phone = String(body.phone || "").trim();
    const email = String(body.email || "").trim();
    const gstin = String(body.gstin || "").trim().toUpperCase();
    const address = String(body.address || "").trim();
    const city = String(body.city || "Mumbai").trim();
    const creditLimit = Math.max(0, Number(body.creditLimit || 250000) || 250000);

    if (!customerName || !phone || !address) {
        return res.status(400).json({ message: "Customer name, phone, and address are required." });
    }

    const r = db.run(
        `INSERT INTO customers (customer_name, company_name, phone, email, gstin, address, city, credit_limit, account_status, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'ACTIVE', ?)`,
        [customerName, companyName || customerName, phone, email, gstin, address, city, creditLimit, new Date().toISOString()]
    );

    logAudit({
        actorEmail: req.user.email,
        actorRole: req.user.role,
        action: "CUSTOMER_CREATED",
        entityType: "CUSTOMER",
        entityId: r.lastInsertRowid,
        details: `${customerName} (${city})`,
        ipAddress: req.ip
    });

    return res.status(201).json({
        message: "Customer account created.",
        customerId: r.lastInsertRowid
    });
});

router.get("/:customerId/shipments", authenticate, (req, res) => {
    const customerId = Number(req.params.customerId);
    if (req.user.role === "CUSTOMER" && req.user.customerId !== customerId) {
        return res.status(403).json({ message: "Access denied to other customer records." });
    }
    const customer = db.get(
        `SELECT customer_id AS customerId, customer_name AS customerName, company_name AS companyName, phone, email, gstin, address, city, credit_limit AS creditLimit
         FROM customers WHERE customer_id = ?`,
        [customerId]
    );
    if (!customer) return res.status(404).json({ message: "Customer not found." });

    const bookings = db.all(
        `SELECT
            b.booking_reference AS bookingReference,
            s.tracking_number AS trackingNumber,
            b.pickup_address AS pickupAddress,
            b.delivery_address AS deliveryAddress,
            b.service_type AS serviceType,
            b.weight_kg AS weightKg,
            b.estimated_cost AS estimatedCost,
            b.booking_date AS bookingDate,
            s.current_status AS status
         FROM bookings b
         LEFT JOIN shipments s ON s.booking_id = b.booking_id
         WHERE b.customer_id = ?
         ORDER BY b.booking_id DESC`,
        [customerId]
    );

    return res.json({ customer, bookings });
});

module.exports = router;
