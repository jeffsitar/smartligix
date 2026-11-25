const express = require("express");
const db = require("../db/database");
const { authenticate } = require("../middleware/auth");

const router = express.Router();

router.get("/summary", authenticate, (req, res) => {
    const isCustomer = req.user.role === "CUSTOMER";
    const isDriver = req.user.role === "DRIVER";

    let bookingWhere = "";
    let params = [];
    if (isCustomer) {
        bookingWhere = "WHERE b.customer_id = ?";
        params = [req.user.customerId || -1];
    } else if (isDriver) {
        bookingWhere = "WHERE s.driver_id = ?";
        params = [req.user.driverId || -1];
    }

    const stats = db.get(
        `SELECT
            COUNT(DISTINCT b.booking_id) AS totalBookings,
            SUM(CASE WHEN s.current_status NOT IN ('DELIVERED', 'CANCELLED') THEN 1 ELSE 0 END) AS activeShipments,
            SUM(CASE WHEN s.current_status = 'DELIVERED' THEN 1 ELSE 0 END) AS deliveredCount,
            SUM(CASE WHEN s.vehicle_id IS NULL AND s.current_status NOT IN ('DELIVERED', 'CANCELLED') THEN 1 ELSE 0 END) AS unassignedCount
         FROM bookings b
         LEFT JOIN shipments s ON s.booking_id = b.booking_id
         ${bookingWhere}`,
        params
    );

    const vehicleStats = db.get(
        `SELECT
            COUNT(*) AS totalVehicles,
            SUM(CASE WHEN availability_status = 'AVAILABLE' THEN 1 ELSE 0 END) AS availableVehicles,
            SUM(CASE WHEN availability_status = 'ON_TRIP' THEN 1 ELSE 0 END) AS onTripVehicles
         FROM vehicles`
    );

    let revSql = "SELECT COALESCE(SUM(total_amount), 0) AS totalBilled, COALESCE(SUM(amount_paid), 0) AS totalCollected FROM invoices";
    let revParams = [];
    if (isCustomer) {
        revSql += " WHERE customer_id = ?";
        revParams = [req.user.customerId || -1];
    }
    const revStats = db.get(revSql, revParams);

    const statusBreakdown = db.all(
        `SELECT s.current_status AS status, COUNT(*) AS count
         FROM shipments s
         JOIN bookings b ON b.booking_id = s.booking_id
         ${bookingWhere}
         GROUP BY s.current_status`,
        params
    );

    const serviceBreakdown = db.all(
        `SELECT b.service_type AS serviceType, COUNT(*) AS count, COALESCE(SUM(b.estimated_cost), 0) AS revenue
         FROM bookings b
         LEFT JOIN shipments s ON s.booking_id = b.booking_id
         ${bookingWhere}
         GROUP BY b.service_type`,
        params
    );

    const recentBookings = db.all(
        `SELECT
            b.booking_id AS bookingId,
            b.booking_reference AS bookingReference,
            s.tracking_number AS trackingNumber,
            c.customer_name AS customerName,
            b.pickup_address AS origin,
            b.delivery_address AS destination,
            b.service_type AS serviceType,
            b.weight_kg AS weightKg,
            b.estimated_cost AS estimatedCost,
            b.booking_date AS bookingDate,
            COALESCE(s.current_status, b.booking_status) AS status,
            v.registration_number AS vehicleReg,
            d.driver_name AS driverName
         FROM bookings b
         JOIN customers c ON c.customer_id = b.customer_id
         LEFT JOIN shipments s ON s.booking_id = b.booking_id
         LEFT JOIN vehicles v ON v.vehicle_id = s.vehicle_id
         LEFT JOIN drivers d ON d.driver_id = s.driver_id
         ${bookingWhere}
         ORDER BY b.booking_id DESC
         LIMIT 10`,
        params
    );

    return res.json({
        totalBookings: stats.totalBookings || 0,
        activeShipments: stats.activeShipments || 0,
        deliveredCount: stats.deliveredCount || 0,
        unassignedCount: stats.unassignedCount || 0,
        availableVehicles: vehicleStats.availableVehicles || 0,
        onTripVehicles: vehicleStats.onTripVehicles || 0,
        totalVehicles: vehicleStats.totalVehicles || 0,
        totalBilled: revStats.totalBilled || 0,
        totalCollected: revStats.totalCollected || 0,
        outstandingBalance: Math.max(0, (revStats.totalBilled || 0) - (revStats.totalCollected || 0)),
        statusBreakdown,
        serviceBreakdown,
        recentBookings
    });
});

module.exports = router;
