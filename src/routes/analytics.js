const express = require("express");
const db = require("../db/database");
const { authenticate, authorize } = require("../middleware/auth");

const router = express.Router();

router.get("/overview", authenticate, authorize("ADMIN", "DISPATCHER", "WAREHOUSE"), (req, res) => {
    const byStatus = db.all(
        "SELECT current_status AS status, COUNT(*) AS count FROM shipments GROUP BY current_status"
    );
    const byService = db.all(
        `SELECT service_type AS serviceType, COUNT(*) AS bookings, COALESCE(SUM(weight_kg), 0) AS totalWeight, COALESCE(SUM(estimated_cost), 0) AS revenue
         FROM bookings GROUP BY service_type`
    );
    const topCustomers = db.all(
        `SELECT c.customer_name AS customerName, c.city, COUNT(b.booking_id) AS bookings, COALESCE(SUM(b.estimated_cost), 0) AS revenue
         FROM customers c
         LEFT JOIN bookings b ON b.customer_id = c.customer_id
         GROUP BY c.customer_id
         ORDER BY revenue DESC
         LIMIT 6`
    );
    const fleetUtil = db.all(
        "SELECT availability_status AS status, COUNT(*) AS count FROM vehicles GROUP BY availability_status"
    );
    const deliveryMetrics = db.get(
        `SELECT
            COUNT(*) AS totalShipments,
            SUM(CASE WHEN current_status = 'DELIVERED' THEN 1 ELSE 0 END) AS delivered,
            SUM(CASE WHEN current_status = 'DELIVERED' AND (actual_delivery_date <= estimated_delivery_date OR estimated_delivery_date IS NULL) THEN 1 ELSE 0 END) AS onTime
         FROM shipments`
    );

    const onTimeRate = deliveryMetrics && deliveryMetrics.delivered > 0
        ? Math.round((deliveryMetrics.onTime / deliveryMetrics.delivered) * 100)
        : 100;

    return res.json({
        byStatus,
        byService,
        topCustomers,
        fleetUtil,
        onTimeRate,
        totalShipments: deliveryMetrics ? deliveryMetrics.totalShipments : 0,
        deliveredShipments: deliveryMetrics ? deliveryMetrics.delivered : 0
    });
});

router.get("/export/bookings.csv", authenticate, authorize("ADMIN", "DISPATCHER"), (req, res) => {
    const rows = db.all(
        `SELECT
            b.booking_reference,
            s.tracking_number,
            c.customer_name,
            b.service_type,
            b.pickup_address,
            b.delivery_address,
            b.weight_kg,
            b.estimated_cost,
            s.current_status,
            b.booking_date
         FROM bookings b
         JOIN customers c ON c.customer_id = b.customer_id
         LEFT JOIN shipments s ON s.booking_id = b.booking_id
         ORDER BY b.booking_id DESC`
    );

    const esc = (v) => `"${String(v == null ? "" : v).replace(/"/g, '""')}"`;
    const header = [
        "Booking Reference",
        "Tracking Number",
        "Customer",
        "Service Type",
        "Pickup Address",
        "Delivery Address",
        "Weight (kg)",
        "Estimated Cost (INR)",
        "Status",
        "Booking Date"
    ].join(",");

    const lines = rows.map((r) =>
        [
            r.booking_reference,
            r.tracking_number,
            r.customer_name,
            r.service_type,
            r.pickup_address,
            r.delivery_address,
            r.weight_kg,
            r.estimated_cost,
            r.current_status,
            r.booking_date
        ]
            .map(esc)
            .join(",")
    );

    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader("Content-Disposition", 'attachment; filename="smartlogix-bookings-report.csv"');
    return res.send([header, ...lines].join("\n"));
});

router.get("/audit-logs", authenticate, authorize("ADMIN", "DISPATCHER"), (req, res) => {
    const limit = Math.min(200, Math.max(10, Number(req.query.limit || 50)));
    const logs = db.all(
        `SELECT log_id AS logId, actor_email AS actorEmail, actor_role AS actorRole, action, entity_type AS entityType, entity_id AS entityId, details, ip_address AS ipAddress, created_at AS createdAt
         FROM audit_logs
         ORDER BY log_id DESC
         LIMIT ?`,
        [limit]
    );
    return res.json(logs);
});

router.get("/notifications", authenticate, (req, res) => {
    const rows = db.all(
        `SELECT notification_id AS notificationId, target_role AS targetRole, title, message, severity, link, is_read AS isRead, created_at AS createdAt
         FROM notifications
         WHERE target_user_id = ? OR target_role = ? OR (target_role IS NULL AND target_user_id IS NULL) OR ? = 'ADMIN'
         ORDER BY notification_id DESC
         LIMIT 30`,
        [req.user.userId, req.user.role, req.user.role]
    );
    const unreadCount = rows.filter((r) => !r.isRead).length;
    return res.json({ unreadCount, notifications: rows });
});

router.post("/notifications/read-all", authenticate, (req, res) => {
    db.run(
        `UPDATE notifications
         SET is_read = 1
         WHERE target_user_id = ? OR target_role = ? OR ? = 'ADMIN'`,
        [req.user.userId, req.user.role, req.user.role]
    );
    return res.json({ message: "All notifications marked as read." });
});

module.exports = router;
