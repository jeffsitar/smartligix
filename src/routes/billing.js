const express = require("express");
const db = require("../db/database");
const { authenticate, authorize } = require("../middleware/auth");
const { logAudit } = require("../services/auditService");
const { createNotification } = require("../services/notificationService");

const router = express.Router();

router.get("/invoices", authenticate, authorize("ADMIN", "DISPATCHER", "CUSTOMER"), (req, res) => {
    const status = String(req.query.status || "").trim().toUpperCase();
    const clauses = [];
    const params = [];

    if (req.user.role === "CUSTOMER") {
        clauses.push("i.customer_id = ?");
        params.push(req.user.customerId || -1);
    }
    if (status && status !== "ALL") {
        clauses.push("i.payment_status = ?");
        params.push(status);
    }

    const whereSql = clauses.length ? `WHERE ${clauses.join(" AND ")}` : "";
    const invoices = db.all(
        `SELECT
            i.invoice_id AS invoiceId,
            i.invoice_number AS invoiceNumber,
            b.booking_reference AS bookingReference,
            s.tracking_number AS trackingNumber,
            c.customer_name AS customerName,
            c.company_name AS companyName,
            c.gstin AS customerGstin,
            b.service_type AS serviceType,
            b.weight_kg AS weightKg,
            i.base_charge AS baseCharge,
            i.weight_charge AS weightCharge,
            i.fuel_surcharge AS fuelSurcharge,
            i.tax_amount AS taxAmount,
            i.total_amount AS totalAmount,
            i.amount_paid AS amountPaid,
            ROUND(i.total_amount - i.amount_paid, 2) AS balanceDue,
            i.payment_status AS paymentStatus,
            i.due_date AS dueDate,
            i.issued_at AS issuedAt
         FROM invoices i
         JOIN bookings b ON b.booking_id = i.booking_id
         JOIN customers c ON c.customer_id = i.customer_id
         LEFT JOIN shipments s ON s.booking_id = b.booking_id
         ${whereSql}
         ORDER BY i.invoice_id DESC`,
        params
    );

    const summary = invoices.reduce(
        (acc, inv) => {
            acc.totalBilled += inv.totalAmount;
            acc.totalCollected += inv.amountPaid;
            acc.outstanding += inv.balanceDue;
            return acc;
        },
        { totalBilled: 0, totalCollected: 0, outstanding: 0 }
    );

    return res.json({ summary, invoices });
});

router.get("/invoices/:invoiceId", authenticate, authorize("ADMIN", "DISPATCHER", "CUSTOMER"), (req, res) => {
    const invoiceId = Number(req.params.invoiceId);
    const inv = db.get(
        `SELECT
            i.*,
            b.booking_reference,
            b.pickup_address,
            b.delivery_address,
            b.parcel_description,
            b.service_type,
            b.weight_kg,
            c.customer_name,
            c.company_name,
            c.gstin AS customer_gstin,
            c.address AS customer_address,
            c.phone AS customer_phone,
            s.tracking_number
         FROM invoices i
         JOIN bookings b ON b.booking_id = i.booking_id
         JOIN customers c ON c.customer_id = i.customer_id
         LEFT JOIN shipments s ON s.booking_id = b.booking_id
         WHERE i.invoice_id = ?`,
        [invoiceId]
    );
    if (!inv) return res.status(404).json({ message: "Invoice not found." });
    if (req.user.role === "CUSTOMER" && inv.customer_id !== req.user.customerId) {
        return res.status(403).json({ message: "Access denied." });
    }

    const payments = db.all(
        `SELECT payment_id AS paymentId, amount, payment_method AS paymentMethod, reference_number AS referenceNumber, recorded_by AS recordedBy, paid_at AS paidAt
         FROM payments WHERE invoice_id = ? ORDER BY payment_id DESC`,
        [invoiceId]
    );

    return res.json({ invoice: inv, payments });
});

router.post("/invoices/:invoiceId/payments", authenticate, authorize("ADMIN", "DISPATCHER", "CUSTOMER"), (req, res) => {
    const invoiceId = Number(req.params.invoiceId);
    const inv = db.get("SELECT * FROM invoices WHERE invoice_id = ?", [invoiceId]);
    if (!inv) return res.status(404).json({ message: "Invoice not found." });
    if (req.user.role === "CUSTOMER" && inv.customer_id !== req.user.customerId) {
        return res.status(403).json({ message: "Access denied." });
    }

    const body = req.body || {};
    const amount = Number(body.amount);
    const paymentMethod = String(body.paymentMethod || "NEFT/RTGS").trim();
    const referenceNumber = String(body.referenceNumber || `TXN-${Date.now().toString().slice(-6)}`).trim();

    if (Number.isNaN(amount) || amount <= 0) {
        return res.status(400).json({ message: "Payment amount must be greater than zero." });
    }

    const balance = Math.round((inv.total_amount - inv.amount_paid) * 100) / 100;
    if (balance <= 0) {
        return res.status(400).json({ message: "This invoice is already fully paid." });
    }
    if (amount > balance + 0.01) {
        return res.status(400).json({ message: `Payment exceeds remaining balance (INR ${balance.toFixed(2)}).` });
    }

    const newPaid = Math.round((inv.amount_paid + amount) * 100) / 100;
    const newStatus = newPaid >= inv.total_amount - 0.01 ? "PAID" : "PARTIAL";
    const nowIso = new Date().toISOString();

    db.transaction(() => {
        db.run(
            `INSERT INTO payments (invoice_id, amount, payment_method, reference_number, recorded_by, paid_at)
             VALUES (?, ?, ?, ?, ?, ?)`,
            [invoiceId, amount, paymentMethod, referenceNumber, req.user.email, nowIso]
        );
        db.run(
            "UPDATE invoices SET amount_paid = ?, payment_status = ? WHERE invoice_id = ?",
            [newPaid, newStatus, invoiceId]
        );
    });

    logAudit({
        actorEmail: req.user.email,
        actorRole: req.user.role,
        action: "PAYMENT_RECORDED",
        entityType: "INVOICE",
        entityId: inv.invoice_number,
        details: `INR ${amount.toFixed(2)} via ${paymentMethod} (${referenceNumber}) -> ${newStatus}`,
        ipAddress: req.ip
    });

    createNotification({
        targetRole: "ADMIN",
        title: "Payment Received",
        message: `INR ${amount.toFixed(2)} recorded for ${inv.invoice_number} (${newStatus}).`,
        severity: "SUCCESS",
        link: "billing.html"
    });

    return res.json({
        message: `Payment of INR ${amount.toFixed(2)} recorded (${newStatus}).`,
        paymentStatus: newStatus,
        amountPaid: newPaid
    });
});

module.exports = router;
